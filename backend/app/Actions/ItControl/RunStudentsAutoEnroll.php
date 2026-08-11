<?php

namespace App\Actions\ItControl;

use App\Actions\Academic\ReclassifyStudentEnrollmentCategory;
use App\Actions\Enrollment\BuildEligibleSubjectPool;
use App\Actions\Enrollment\BuildEnrollmentBlockPool;
use App\Actions\Enrollment\SubmitEnrollment;
use App\Domain\Enrollment\EnrollmentCategory;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Identity\UserRole;
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
    ) {}

    public function execute(ItControlAutomationRun $run): void
    {
        $term = $run->academicTerm()->firstOrFail();
        $registrar = $this->actor(UserRole::RegistrarStaff);
        if (! Section::query()->where('academic_term_id', $term->id)->where('status', SectionStatus::Published)->exists()) {
            throw new \RuntimeException('No published sections are available for automatic enrollment.');
        }

        // The cursor must use the same monotonic key as its query predicate:
        // ordering by curriculum before `chunkById()` can skip lower IDs in
        // later curricula. We keep ID-keyed retrieval and sort each bounded
        // batch for section-lock locality only after it has been retrieved.
        StudentProfile::query()->orderBy('id')->lazyById(200)->chunk(200)->each(function ($students) use ($term, $registrar, $run): void {
            $students = $students->sortBy(['curriculum_id', 'year_level', 'id']);
            foreach ($students as $student) {
                if (Enrollment::query()->where('student_id', $student->id)->where('academic_term_id', $term->id)
                    ->whereNotIn('status', EnrollmentStatus::terminalValues())->exists()) {
                    continue;
                }
                try {
                    $this->reclassify->execute($student, $term, $registrar, $this->context($run));
                    $student->refresh();
                    $sectionIds = $student->enrollment_category === EnrollmentCategory::Regular->value
                        ? $this->regularSections($student, $term)
                        : $this->irregularSections($student, $term);
                    if ($sectionIds === []) {
                        throw new \RuntimeException('No eligible published sections are available.');
                    }
                    $this->submitEnrollment->execute($student, $term, $sectionIds, $student->user, $this->context($run));
                    $this->processed($run);
                } catch (Throwable $exception) {
                    $this->warning($run, "Student {$student->student_number}: {$exception->getMessage()}");
                }
            }
        });
    }

    /** @return list<int> */
    private function regularSections(StudentProfile $student, AcademicTerm $term): array
    {
        $blocks = array_values(array_filter($this->blocks->execute($student, $term), fn ($block): bool => $block->isSelectable));
        usort($blocks, fn ($left, $right): int => (($right->preferenceScore ?? -1) <=> ($left->preferenceScore ?? -1)) ?: ($left->blockCode <=> $right->blockCode));

        return $blocks === [] ? [] : array_map(fn ($section): int => $section->id, $blocks[0]->sections);
    }

    /** @return list<int> */
    private function irregularSections(StudentProfile $student, AcademicTerm $term): array
    {
        $entries = array_values(array_filter($this->eligibleSubjects->execute($student, $term), fn ($entry): bool => $entry->isEligible));
        usort($entries, fn ($left, $right): int => count($right->placement->prerequisites) <=> count($left->placement->prerequisites));
        $limit = config('enrollment.overload_max_units') ?? config('enrollment.max_regular_units');
        $units = 0.0;
        $sectionIds = [];
        foreach ($entries as $entry) {
            $section = $entry->availableSections[0] ?? null;
            if ($section === null || ($limit !== null && $units + $entry->subject->units > (float) $limit)) {
                continue;
            }
            $sectionIds[] = $section->id;
            $units += $entry->subject->units;
        }

        return $sectionIds;
    }
}
