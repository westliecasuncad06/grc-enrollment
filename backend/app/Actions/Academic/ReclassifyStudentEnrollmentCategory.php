<?php

namespace App\Actions\Academic;

use App\Domain\Academic\GradeMark;
use App\Domain\Academic\GradeStatus;
use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Curriculum\SemesterCoverage;
use App\Domain\Curriculum\SemesterSlot;
use App\Domain\Enrollment\ClassificationVerdict;
use App\Domain\Enrollment\CurriculumPlacementSlot;
use App\Domain\Enrollment\EnrollmentCategory;
use App\Domain\Enrollment\EnrollmentCategoryClassifier;
use App\Domain\Notifications\NotificationType;
use App\Models\AcademicGrade;
use App\Models\AcademicTerm;
use App\Models\CurriculumMigrationCredit;
use App\Models\CurriculumSubject;
use App\Models\Notification;
use App\Models\StudentProfile;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Derives and, when it has changed, writes a student's Regular/Irregular
 * `enrollment_category` from their locked grade history — see
 * `EnrollmentCategoryClassifier` for the rule itself. This is always
 * audited and the student is always notified, because `enrollment_category`
 * feeds `EnrollmentAudience::forStudent()`, which gates which block-section
 * window a student may enroll through: a category flip is a change to that
 * student's enrollment eligibility, not a cosmetic label update.
 *
 * `executeMany()` is the batch entry point `execute()` itself delegates to,
 * so a single student and a thousand students take the same 3-query shape:
 * one `whereIn` over locked grades, one `whereIn` over curriculum
 * placements (grouped by `curriculum_id`, which is shared across every
 * student on that curriculum — this is what keeps the query count constant
 * regardless of student count), then at most two bulk `UPDATE`s (one per
 * resulting category). Audit rows and notifications are written only for
 * students whose category actually changed.
 */
final readonly class ReclassifyStudentEnrollmentCategory
{
    public function __construct(private AuditRecorder $auditRecorder) {}

    public function execute(
        StudentProfile $student,
        AcademicTerm $currentTerm,
        User $actor,
        AuditRequestContext $context,
    ): ClassificationVerdict {
        $verdicts = $this->executeMany(new Collection([$student]), $currentTerm, $actor, $context);

        return $verdicts[$student->id];
    }

    /**
     * @param  Collection<int, StudentProfile>  $students
     * @return array<int, ClassificationVerdict>
     */
    public function executeMany(
        Collection $students,
        AcademicTerm $currentTerm,
        User $actor,
        AuditRequestContext $context,
    ): array {
        if ($students->isEmpty()) {
            return [];
        }

        return DB::transaction(function () use ($students, $currentTerm, $actor, $context): array {
            [$verdicts, $toRegularIds, $toIrregularIds] = $this->computeVerdicts($students, $currentTerm);

            $changedIds = [...$toRegularIds, ...$toIrregularIds];

            if ($changedIds === []) {
                return $verdicts;
            }

            $now = Carbon::now();

            if ($toRegularIds !== []) {
                StudentProfile::query()->whereIn('id', $toRegularIds)->update([
                    'enrollment_category' => EnrollmentCategory::Regular->value,
                    'enrollment_category_derived_at' => $now,
                ]);
            }

            if ($toIrregularIds !== []) {
                StudentProfile::query()->whereIn('id', $toIrregularIds)->update([
                    'enrollment_category' => EnrollmentCategory::Irregular->value,
                    'enrollment_category_derived_at' => $now,
                ]);
            }

            foreach ($students as $student) {
                if (! in_array($student->id, $changedIds, true)) {
                    continue;
                }

                $this->auditAndNotify($student, $verdicts[$student->id], $actor, $context);
            }

            return $verdicts;
        });
    }

    /**
     * Read-only: computes what `executeMany()` would decide, without
     * writing, auditing, or notifying anything. Used by the
     * `students:reclassify --dry-run` command to report a preview.
     *
     * @param  Collection<int, StudentProfile>  $students
     * @return array<int, ClassificationVerdict>
     */
    public function preview(Collection $students, AcademicTerm $currentTerm): array
    {
        [$verdicts] = $this->computeVerdicts($students, $currentTerm);

        return $verdicts;
    }

    /**
     * @param  Collection<int, StudentProfile>  $students
     * @return array{0: array<int, ClassificationVerdict>, 1: list<int>, 2: list<int>}
     */
    private function computeVerdicts(Collection $students, AcademicTerm $currentTerm): array
    {
        if ($students->isEmpty()) {
            return [[], [], []];
        }

        // array_values(), not Collection::values(): PHPStan/Larastan's
        // Collection stubs type ->values() as merely int-keyed, not
        // provably sequential from 0 -- array_values() is a plain PHP
        // function PHPStan always recognizes as producing a list<T>.
        $studentIds = array_values($students->map(static fn (StudentProfile $student): int => $student->id)->all());
        $marksByStudent = $this->latestLockedMarksByStudent($studentIds);

        $curriculumIds = array_values($students
            ->map(static fn (StudentProfile $student): int => $student->curriculum_id)
            ->unique()
            ->all());
        $marksByStudent = $this->withMigrationCredits(
            $marksByStudent,
            $students,
            $studentIds,
        );
        $placementsByCurriculum = $this->placementSlotsByCurriculum($curriculumIds);

        $currentOrdinalByYearLevel = [];
        $verdicts = [];
        $toRegularIds = [];
        $toIrregularIds = [];

        foreach ($students as $student) {
            $marks = $marksByStudent[$student->id] ?? [];
            $placements = $placementsByCurriculum[$student->curriculum_id] ?? [];
            $currentOrdinalByYearLevel[$student->year_level] ??= $this->currentOrdinal($student->year_level, $currentTerm);

            $verdict = EnrollmentCategoryClassifier::classify(
                $marks,
                $placements,
                $currentOrdinalByYearLevel[$student->year_level],
            );
            $verdicts[$student->id] = $verdict;

            if ($student->enrollment_category === $verdict->category->value) {
                continue;
            }

            if ($verdict->isRegular()) {
                $toRegularIds[] = $student->id;
            } else {
                $toIrregularIds[] = $student->id;
            }
        }

        return [$verdicts, $toRegularIds, $toIrregularIds];
    }

    private function auditAndNotify(
        StudentProfile $student,
        ClassificationVerdict $verdict,
        User $actor,
        AuditRequestContext $context,
    ): void {
        $this->auditRecorder->record(
            $actor,
            AuditAction::STUDENT_ENROLLMENT_CATEGORY_RECLASSIFIED,
            AuditableType::STUDENT_PROFILE,
            $student->id,
            ['enrollment_category' => $student->enrollment_category],
            [
                'enrollment_category' => $verdict->category->value,
                'reasons' => $verdict->reasons,
            ],
            null,
            $context,
        );

        $message = $verdict->isRegular()
            ? 'Your enrollment standing has been updated to Regular.'
            : sprintf(
                'Your enrollment standing has been updated to Irregular: %s',
                implode(' ', array_column($verdict->reasons, 'message')),
            );

        Notification::create([
            'user_id' => $student->user_id,
            'type' => NotificationType::EnrollmentCategoryReclassified,
            'message' => $message,
        ]);
    }

    /**
     * @param  list<int>  $studentIds
     * @return array<int, array<int, GradeMark>>
     */
    private function latestLockedMarksByStudent(array $studentIds): array
    {
        $grades = AcademicGrade::query()
            ->whereIn('student_id', $studentIds)
            ->where('status', GradeStatus::Locked)
            ->orderBy('student_id')
            ->orderByDesc('academic_term_id')
            ->orderByDesc('id')
            ->get(['student_id', 'subject_id', 'mark']);

        $marksByStudent = [];

        foreach ($grades as $grade) {
            if ($grade->mark === null) {
                continue;
            }

            // Rows are ordered latest-term-first per student, so the first
            // occurrence of a (student, subject) pair is always the latest
            // locked mark for it — later duplicates (older retakes) are
            // skipped.
            $marksByStudent[$grade->student_id] ??= [];

            if (! array_key_exists($grade->subject_id, $marksByStudent[$grade->student_id])) {
                $marksByStudent[$grade->student_id][$grade->subject_id] = $grade->mark;
            }
        }

        return $marksByStudent;
    }

    /**
     * Migration credits are deliberately not copied into academic_grades: the
     * original grade remains part of the old curriculum's permanent record.
     * For standing, though, a credited target subject is completed exactly as
     * a passing locked mark would be. Only credits for the student's current
     * target curriculum qualify, which keeps this first direct-migration slice
     * from accidentally chaining a previous transition into a later one.
     *
     * @param  array<int, array<int, GradeMark>>  $marksByStudent
     * @param  Collection<int, StudentProfile>  $students
     * @param  list<int>  $studentIds
     * @return array<int, array<int, GradeMark>>
     */
    private function withMigrationCredits(array $marksByStudent, Collection $students, array $studentIds): array
    {
        $currentCurriculumByStudent = $students
            ->mapWithKeys(static fn (StudentProfile $student): array => [$student->id => $student->curriculum_id])
            ->all();

        $credits = CurriculumMigrationCredit::query()
            ->whereHas('migration', static fn ($query) => $query->whereIn('student_id', $studentIds))
            ->with('migration:id,student_id,target_curriculum_id')
            ->get(['id', 'curriculum_migration_id', 'target_subject_id']);

        foreach ($credits as $credit) {
            $migration = $credit->migration;

            if ($migration === null || ($currentCurriculumByStudent[$migration->student_id] ?? null) !== $migration->target_curriculum_id) {
                continue;
            }

            $marksByStudent[$migration->student_id] ??= [];
            // A true locked grade is still authoritative if one exists.
            $marksByStudent[$migration->student_id][$credit->target_subject_id] ??= GradeMark::Passed;
        }

        return $marksByStudent;
    }

    /**
     * @param  list<int>  $curriculumIds
     * @return array<int, list<CurriculumPlacementSlot>>
     */
    private function placementSlotsByCurriculum(array $curriculumIds): array
    {
        $placements = CurriculumSubject::query()
            ->whereIn('curriculum_id', $curriculumIds)
            ->with('subject:id,code')
            ->get(['id', 'curriculum_id', 'subject_id', 'year_level', 'semester', 'is_required']);

        $slotsByCurriculum = [];

        foreach ($placements as $placement) {
            $slotsByCurriculum[$placement->curriculum_id] ??= [];
            $slotsByCurriculum[$placement->curriculum_id][] = new CurriculumPlacementSlot(
                subjectId: $placement->subject_id,
                subjectCode: $placement->subject->code,
                yearLevel: $placement->year_level,
                semester: SemesterCoverage::primary($placement->semester),
                isRequired: $placement->is_required,
            );
        }

        return $slotsByCurriculum;
    }

    private function currentOrdinal(int $yearLevel, AcademicTerm $currentTerm): int
    {
        $slot = SemesterSlot::tryFrom($currentTerm->semester) ?? SemesterSlot::First;

        return $slot->ordinal($yearLevel);
    }
}
