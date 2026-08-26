<?php

namespace App\Actions\ItControl;

use App\Actions\Academic\ReclassifyStudentEnrollmentCategory;
use App\Actions\Enrollment\BuildEligibleSubjectPool;
use App\Actions\Enrollment\BuildEnrollmentBlockPool;
use App\Actions\Enrollment\SubmitEnrollment;
use App\Domain\Analytics\SelectAttritionHoldouts;
use App\Domain\Enrollment\EnrollmentCategory;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Organization\StudentRosterReader;
use App\Domain\Scheduling\SectionConflictDetector;
use App\Domain\Scheduling\SectionStatus;
use App\Models\AcademicTerm;
use App\Models\Enrollment;
use App\Models\ItControlAutomationRun;
use App\Models\Section;
use App\Models\StudentProfile;
use Throwable;

final class RunStudentsAutoEnroll implements RunsItControlAutomationStep
{
    use ManagesAutomationRun;

    public function __construct(
        private readonly ReclassifyStudentEnrollmentCategory $reclassify,
        private readonly BuildEnrollmentBlockPool $blocks,
        private readonly BuildEligibleSubjectPool $eligibleSubjects,
        private readonly SubmitEnrollment $submitEnrollment,
        private readonly SectionConflictDetector $conflictDetector,
        private readonly SelectAttritionHoldouts $holdouts,
        private readonly StudentRosterReader $rosterReader,
    ) {}

    public function execute(ItControlAutomationRun $run): void
    {
        $term = $run->academicTerm()->firstOrFail();
        $registrar = $this->actor(UserRole::RegistrarStaff);
        if (! Section::query()->where('academic_term_id', $term->id)->where('status', SectionStatus::Published)->exists()) {
            throw new \RuntimeException('No published sections are available for automatic enrollment.');
        }

        $scenario = $this->attritionScenario($term);

        // The cursor must use the same monotonic key as its query predicate:
        // ordering by curriculum before `chunkById()` can skip lower IDs in
        // later curricula. We keep ID-keyed retrieval and sort each bounded
        // batch for section-lock locality only after it has been retrieved.
        StudentProfile::query()
            ->when($scenario !== null, fn ($query) => $query
                ->whereIn('id', $scenario['roster_student_ids'])
                ->whereNotIn('id', $scenario['holdout_student_ids']))
            ->orderBy('id')
            ->lazyById(200)
            ->chunk(200)
            ->each(function ($students) use ($term, $registrar, $run): void {
                $students = $students->sortBy(['curriculum_id', 'year_level', 'id']);
                foreach ($students as $student) {
                    if (Enrollment::query()->where('student_id', $student->id)->where('academic_term_id', $term->id)
                        ->whereNotIn('status', EnrollmentStatus::terminalValues())->exists()) {
                        continue;
                    }
                    try {
                        $this->reclassify->execute($student, $term, $registrar, $this->context($run));
                        $student->refresh();
                        if ($student->enrollment_category === EnrollmentCategory::Regular->value) {
                            [$sectionIds, $blockCode] = $this->regularSelection($student, $term);
                        } else {
                            $sectionIds = $this->irregularSections($student, $term);
                            $blockCode = null;
                        }
                        if ($sectionIds === []) {
                            throw new \RuntimeException('No eligible published sections are available.');
                        }
                        $this->submitEnrollment->execute($student, $term, $sectionIds, $student->user, $this->context($run), $blockCode);
                        $this->processed($run);
                    } catch (Throwable $exception) {
                        $this->warning($run, "Student {$student->student_number}: {$exception->getMessage()}");
                    }
                }
            });
    }

    /**
     * Activates only for the complete committed local roster. Smaller test
     * fixtures intentionally retain the generic IT-control behavior.
     *
     * @return ?array{roster_student_ids: list<int>, holdout_student_ids: list<int>}
     */
    private function attritionScenario(AcademicTerm $term): ?array
    {
        $rows = $this->rosterReader->read(base_path('../Subject And Prerequisuite/Students-Profile.md'));
        if (count($rows) !== 3210) {
            return null;
        }

        $studentNumbers = array_column($rows, 'student_number');
        $students = StudentProfile::query()
            ->join('programs', 'programs.id', '=', 'student_profiles.program_id')
            ->where('student_profiles.is_demo_account', false)
            ->whereIn('student_profiles.student_number', $studentNumbers)
            ->orderBy('student_profiles.id')
            ->get([
                'student_profiles.id',
                'student_profiles.student_number',
                'programs.code as program_code',
                'student_profiles.year_level',
            ]);
        if ($students->count() !== count($rows)) {
            return null;
        }

        $rosterStudentIds = $students->pluck('id')->map(fn (mixed $id): int => (int) $id)->all();
        $alreadyStarted = Enrollment::query()
            ->where('academic_term_id', $term->id)
            ->whereIn('student_id', $rosterStudentIds)
            ->whereNotIn('status', EnrollmentStatus::terminalValues())
            ->pluck('student_id')
            ->map(fn (mixed $id): int => (int) $id)
            ->all();

        return [
            'roster_student_ids' => $rosterStudentIds,
            'holdout_student_ids' => $this->holdouts->select(
                $students->map(fn (StudentProfile $student): array => [
                    'id' => $student->id,
                    'student_number' => $student->student_number,
                    'program_code' => (string) $student->getAttribute('program_code'),
                    'year_level' => $student->year_level,
                ])->all(),
                $term->id,
                $alreadyStarted,
            ),
        ];
    }

    /** @return array{0: list<int>, 1: ?string} */
    private function regularSelection(StudentProfile $student, AcademicTerm $term): array
    {
        $blocks = array_values(array_filter($this->blocks->execute($student, $term), fn ($block): bool => $block->isSelectable));
        usort($blocks, fn ($left, $right): int => (($right->preferenceScore ?? -1) <=> ($left->preferenceScore ?? -1)) ?: ($left->blockCode <=> $right->blockCode));

        return $blocks === []
            ? [[], null]
            : [array_map(fn ($section): int => $section->id, $blocks[0]->sections), $blocks[0]->blockCode];
    }

    /** @return list<int> */
    private function irregularSections(StudentProfile $student, AcademicTerm $term): array
    {
        $entries = array_values(array_filter($this->eligibleSubjects->execute($student, $term), fn ($entry): bool => $entry->isEligible));
        usort($entries, fn ($left, $right): int => count($right->placement->prerequisites) <=> count($left->placement->prerequisites));
        $limit = config('enrollment.overload_max_units') ?? config('enrollment.max_regular_units');
        $units = 0.0;
        $sectionIds = [];
        /** @var list<array{schedule_days: ?string, starts_at_time: ?string, ends_at_time: ?string}> $selectedSlots */
        $selectedSlots = [];
        foreach ($entries as $entry) {
            if ($limit !== null && $units + $entry->subject->units > (float) $limit) {
                continue;
            }

            foreach ($entry->availableSections as $section) {
                $slot = [
                    'schedule_days' => $section->schedule_days,
                    'starts_at_time' => $section->starts_at_time,
                    'ends_at_time' => $section->ends_at_time,
                ];

                if ($this->conflictDetector->hasConflict($slot, $selectedSlots)) {
                    continue;
                }

                $sectionIds[] = $section->id;
                $selectedSlots[] = $slot;
                $units += $entry->subject->units;

                break;
            }
        }

        return $sectionIds;
    }
}
