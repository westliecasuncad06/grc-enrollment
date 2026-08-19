<?php

namespace App\Actions\Academic;

use App\Domain\Academic\GradeMark;
use App\Domain\Academic\GradeStatus;
use App\Domain\Academic\PrerequisiteEvaluator;
use App\Domain\Enrollment\ClassificationVerdict;
use App\Domain\Scheduling\SectionStatus;
use App\Models\AcademicGrade;
use App\Models\AcademicTerm;
use App\Models\CurriculumMigrationCredit;
use App\Models\CurriculumSubject;
use App\Models\Section;
use App\Models\StudentProfile;
use Illuminate\Database\Eloquent\Collection;

/**
 * Term-scoped Regular/Irregular standing (spec
 * docs/superpowers/specs/2026-08-19-term-scoped-enrollment-standing-design.md),
 * superseding the 2026-08-04 cumulative-lifetime rule that used to live in
 * the now-deleted `App\Domain\Enrollment\EnrollmentCategoryClassifier`. A
 * student is Regular for a term when they can take exactly the standard
 * block subject set the Program Chair published for their year level —
 * nothing needs adding (an offered backlog subject outside the block) and
 * nothing needs removing (a block subject already passed, or blocked by an
 * unmet prerequisite).
 *
 * `classifyMany()` is the batch entry point — every student passed in MUST
 * share the same `(curriculum_id, year_level)`; the caller
 * (`ReclassifyStudentEnrollmentCategory`) groups students by that pair
 * before calling, so the standard-set/placement/backlog queries run once
 * per group, not once per student. `classify()` is a thin single-student
 * wrapper for callers with exactly one student in hand.
 *
 * `null` means undetermined (no block published yet for that year level
 * this term) — never coerce this to Irregular. Forcing Irregular here would
 * eagerly flip every student in that year level the instant they open
 * their enrollment page, purely because setup isn't finished yet.
 */
final readonly class ClassifyEnrollmentStanding
{
    public function __construct(private PrerequisiteEvaluator $evaluator) {}

    public function classify(StudentProfile $student, AcademicTerm $term): ?ClassificationVerdict
    {
        return $this->classifyMany(new Collection([$student]), $term)[$student->id];
    }

    /**
     * @param  Collection<int, StudentProfile>  $students  Every student must share the same curriculum_id and year_level.
     * @return array<int, ?ClassificationVerdict>
     */
    public function classifyMany(Collection $students, AcademicTerm $term): array
    {
        if ($students->isEmpty()) {
            return [];
        }

        $first = $students->first();
        $curriculumId = $first->curriculum_id;
        $yearLevel = $first->year_level;
        // array_values(), not Collection::values(): PHPStan/Larastan's
        // Collection stubs type ->values() as merely int-keyed, not
        // provably sequential from 0 -- array_values() is a plain PHP
        // function PHPStan always recognizes as producing a list<T>.
        $studentIds = array_values($students->map(fn (StudentProfile $s): int => $s->id)->all());

        $standardSubjectIds = $this->standardBlockSubjectIds($term, $curriculumId, $yearLevel);

        if ($standardSubjectIds === []) {
            return collect($studentIds)->mapWithKeys(fn (int $id): array => [$id => null])->all();
        }

        $placements = CurriculumSubject::query()
            ->where('curriculum_id', $curriculumId)
            ->with(['prerequisites', 'subject:id,code'])
            ->get()
            ->keyBy('subject_id');

        $backlogSubjectIds = array_values(array_map(
            static fn (int|string $id): int => (int) $id,
            $placements->keys()->diff($standardSubjectIds)->all(),
        ));
        $openBacklogSubjectIds = $this->openNonBlockSectionSubjectIds($term, $backlogSubjectIds);

        $marksByStudent = $this->latestLockedMarksByStudent($studentIds);
        $creditedByStudent = $this->creditedSubjectIdsByStudent($studentIds, $curriculumId);

        $verdicts = [];

        foreach ($students as $student) {
            $marks = $marksByStudent[$student->id] ?? [];
            $credited = $creditedByStudent[$student->id] ?? [];
            $reasons = [];

            foreach ($standardSubjectIds as $subjectId) {
                $placement = $placements->get($subjectId);
                if ($placement === null) {
                    continue;
                }

                if ($this->isCompleted($subjectId, $marks, $credited)) {
                    $reasons[] = [
                        'code' => 'needs_removing_completed',
                        'message' => "{$placement->subject->code} has already been completed and is no longer part of this term's standard load.",
                    ];

                    continue;
                }

                if (! $this->prerequisitesSatisfied($placement, $marks, $credited)) {
                    $reasons[] = [
                        'code' => 'needs_removing_prerequisite',
                        'message' => "{$placement->subject->code} cannot be taken yet — a prerequisite is not met.",
                    ];
                }
            }

            foreach ($openBacklogSubjectIds as $subjectId) {
                $placement = $placements->get($subjectId);
                if ($placement === null || $this->isCompleted($subjectId, $marks, $credited)) {
                    continue;
                }
                if (! $this->prerequisitesSatisfied($placement, $marks, $credited)) {
                    continue;
                }

                $reasons[] = [
                    'code' => 'needs_adding_backlog',
                    'message' => "{$placement->subject->code} has an open section this term and still needs to be taken.",
                ];
            }

            $verdicts[$student->id] = $reasons === []
                ? ClassificationVerdict::regular()
                : ClassificationVerdict::irregular($reasons);
        }

        return $verdicts;
    }

    /**
     * @return list<int>
     */
    private function standardBlockSubjectIds(AcademicTerm $term, int $curriculumId, int $yearLevel): array
    {
        return array_values(array_map(
            static fn (mixed $id): int => (int) $id,
            Section::query()
                ->where('academic_term_id', $term->id)
                ->where('status', SectionStatus::Published)
                ->where('is_block_exclusive', true)
                ->whereHas('sectionPlan', fn ($query) => $query
                    ->where('year_level', $yearLevel)
                    ->where('curriculum_id', $curriculumId))
                ->distinct()
                ->pluck('subject_id')
                ->all(),
        ));
    }

    /**
     * @param  list<int>  $candidateSubjectIds
     * @return list<int>
     */
    private function openNonBlockSectionSubjectIds(AcademicTerm $term, array $candidateSubjectIds): array
    {
        if ($candidateSubjectIds === []) {
            return [];
        }

        return array_values(array_map(
            static fn (mixed $id): int => (int) $id,
            Section::query()
                ->where('academic_term_id', $term->id)
                ->where('status', SectionStatus::Published)
                ->where(fn ($query) => $query->where('is_block_exclusive', false)->orWhereNull('is_block_exclusive'))
                ->whereIn('subject_id', $candidateSubjectIds)
                ->get(['id', 'subject_id', 'capacity', 'enrolled_count'])
                ->filter(fn (Section $section): bool => $section->remainingSeats() > 0)
                ->pluck('subject_id')
                ->unique()
                ->all(),
        ));
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
            $marksByStudent[$grade->student_id] ??= [];
            if (! array_key_exists($grade->subject_id, $marksByStudent[$grade->student_id])) {
                $marksByStudent[$grade->student_id][$grade->subject_id] = $grade->mark;
            }
        }

        return $marksByStudent;
    }

    /**
     * @param  list<int>  $studentIds
     * @return array<int, array<int, true>>
     */
    private function creditedSubjectIdsByStudent(array $studentIds, int $curriculumId): array
    {
        $credits = CurriculumMigrationCredit::query()
            ->whereHas('migration', fn ($query) => $query
                ->whereIn('student_id', $studentIds)
                ->where('target_curriculum_id', $curriculumId))
            ->with('migration:id,student_id,target_curriculum_id')
            ->get(['id', 'curriculum_migration_id', 'target_subject_id']);

        $byStudent = [];
        foreach ($credits as $credit) {
            // whereHas('migration', ...) above already guarantees a match
            // exists at the DB level, but the eager-loaded relation is
            // still nullable to PHPStan's static analysis.
            if ($credit->migration === null) {
                continue;
            }

            $studentId = $credit->migration->student_id;
            $byStudent[$studentId] ??= [];
            $byStudent[$studentId][$credit->target_subject_id] = true;
        }

        return $byStudent;
    }

    /**
     * @param  array<int, GradeMark>  $marks
     * @param  array<int, true>  $credited
     */
    private function isCompleted(int $subjectId, array $marks, array $credited): bool
    {
        if (isset($credited[$subjectId])) {
            return true;
        }

        return ($marks[$subjectId] ?? null)?->isPassing() === true;
    }

    /**
     * @param  array<int, GradeMark>  $marks
     * @param  array<int, true>  $credited
     */
    private function prerequisitesSatisfied(CurriculumSubject $placement, array $marks, array $credited): bool
    {
        foreach ($placement->prerequisites as $edge) {
            if (isset($credited[$edge->prerequisite_subject_id])) {
                continue;
            }

            $mark = $marks[$edge->prerequisite_subject_id] ?? null;
            if ($mark?->isCompletion() === true) {
                continue;
            }

            $verdict = $this->evaluator->evaluate($mark?->value, $edge->minimum_grade);
            if ($verdict->status->value === 'not_satisfied') {
                return false;
            }
        }

        return true;
    }
}
