<?php

namespace App\Actions\Enrollment;

use App\Domain\Academic\GradeStatus;
use App\Domain\Academic\PrerequisiteEvaluator;
use App\Domain\Enrollment\EligibleSubjectEntry;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Enrollment\EnrollmentSubjectStatus;
use App\Domain\Scheduling\SectionStatus;
use App\Models\AcademicGrade;
use App\Models\AcademicTerm;
use App\Models\CurriculumSubject;
use App\Models\EnrollmentSubject;
use App\Models\Section;
use App\Models\StudentProfile;

/**
 * DFD 2.2 "Validate Capacities and Prerequisites": cross-references
 * STUDENT RECORDS against CURRICULUM AND SCHEDULING to produce the Eligible
 * Subject Pool (FR-ENR-001–003, 005, 011). Every entry is explainable
 * (FR-ENR-005) — a subject is never silently omitted, it is always returned
 * with the reason it is or is not currently selectable.
 *
 * FR-ENR-003's "conflicting" section exclusion is deliberately NOT applied
 * here: the acceptance criterion is "two conflicting sections cannot be
 * SUBMITTED together," and there is no partial/draft selection state between
 * viewing the pool and Phase 6 Task 5's atomic submission for two sections to
 * conflict against yet. SectionConflictDetector is reused there instead,
 * comparing the full submitted set.
 */
final readonly class BuildEligibleSubjectPool
{
    /**
     * FR-ENR-011 needs a section-side "reserved" flag AND a student-side
     * classification to compare, but PRD §17 leaves the regular/irregular
     * vocabulary itself unconfirmed — `student_profiles.enrollment_category`
     * is a bare nullable string for exactly that reason (see its migration).
     * This literal is a documented placeholder, the same pattern already
     * used for `CurriculumSeeder::PLACEHOLDER_MINIMUM_GRADE`: it makes the
     * mechanism demonstrable and testable without asserting GRC's real
     * vocabulary. Replace it once that vocabulary is confirmed.
     */
    private const IRREGULAR_CATEGORY_PLACEHOLDER = 'irregular';

    public function __construct(private PrerequisiteEvaluator $evaluator) {}

    /**
     * @return list<EligibleSubjectEntry>
     */
    public function execute(StudentProfile $student, AcademicTerm $term): array
    {
        $placements = CurriculumSubject::query()
            ->where('curriculum_id', $student->curriculum_id)
            ->with(['subject', 'prerequisites.prerequisiteSubject'])
            ->orderBy('year_level')
            ->orderBy('semester')
            ->get();

        return array_values(array_map(
            fn (CurriculumSubject $placement): EligibleSubjectEntry => $this->evaluatePlacement($student, $term, $placement),
            $placements->all(),
        ));
    }

    private function evaluatePlacement(StudentProfile $student, AcademicTerm $term, CurriculumSubject $placement): EligibleSubjectEntry
    {
        /** @var list<array{code: string, message: string}> $reasons */
        $reasons = [];
        $excluded = false;

        $ownGrade = $this->latestLockedGrade($student->id, $placement->subject_id);
        if ($this->evaluator->evaluate($ownGrade, (string) config('enrollment.grading.passing_grade'))->isSatisfied()) {
            $reasons[] = ['code' => 'completed', 'message' => 'This subject has already been completed with a passing grade.'];
            $excluded = true;
        }

        if ($this->isAlreadySelectedThisTerm($student->id, $term->id, $placement->subject_id)) {
            $reasons[] = ['code' => 'already_selected', 'message' => 'This subject is already part of your current enrollment for this term.'];
            $excluded = true;
        }

        foreach ($placement->prerequisites as $edge) {
            $prerequisiteGrade = $this->latestLockedGrade($student->id, $edge->prerequisite_subject_id);
            $verdict = $this->evaluator->evaluate($prerequisiteGrade, $edge->minimum_grade);

            if ($verdict->status->value === 'not_satisfied') {
                $reasons[] = [
                    'code' => 'prerequisite',
                    'message' => sprintf('%s: %s', $edge->prerequisiteSubject->code, $verdict->reason),
                ];
                $excluded = true;
            } elseif ($verdict->status->value === 'needs_verification') {
                $reasons[] = [
                    'code' => 'prerequisite_advisory',
                    'message' => sprintf('%s: %s', $edge->prerequisiteSubject->code, $verdict->reason),
                ];
            }
        }

        $availableSections = [];

        if (! $excluded) {
            $sectionsThisTerm = Section::query()
                ->where('academic_term_id', $term->id)
                ->where('subject_id', $placement->subject_id)
                ->get();

            $openSections = $sectionsThisTerm
                ->filter(fn (Section $section): bool => $section->status === SectionStatus::Published && $section->remainingSeats() > 0)
                ->values();

            if ($openSections->isEmpty()) {
                $reasons[] = ['code' => 'no_sections_available', 'message' => 'No published sections with open seats are offered for this subject in the selected term.'];
                $excluded = true;
            } else {
                $unrestricted = $openSections->reject(
                    fn (Section $section): bool => $this->isBlockRestricted($section, $student->enrollment_category),
                )->values();

                if ($unrestricted->isEmpty()) {
                    $reasons[] = ['code' => 'block_restricted', 'message' => 'The only open sections for this subject are reserved for regular block students.'];
                    $excluded = true;
                } else {
                    $availableSections = array_values($unrestricted->all());
                }
            }
        }

        if (! $excluded && $reasons === []) {
            $reasons[] = ['code' => 'eligible', 'message' => 'All curriculum and prerequisite requirements are met.'];
        }

        return new EligibleSubjectEntry(
            subject: $placement->subject,
            placement: $placement,
            isEligible: ! $excluded,
            reasons: $reasons,
            availableSections: $availableSections,
        );
    }

    private function latestLockedGrade(int $studentId, int $subjectId): ?string
    {
        return AcademicGrade::query()
            ->where('student_id', $studentId)
            ->where('subject_id', $subjectId)
            ->where('status', GradeStatus::Locked)
            ->orderByDesc('academic_term_id')
            ->orderByDesc('id')
            ->value('final_grade');
    }

    private function isAlreadySelectedThisTerm(int $studentId, int $academicTermId, int $subjectId): bool
    {
        return EnrollmentSubject::query()
            ->whereHas(
                'enrollment',
                fn ($query) => $query
                    ->where('student_id', $studentId)
                    ->where('academic_term_id', $academicTermId)
                    ->whereNotIn('status', EnrollmentStatus::terminalValues()),
            )
            ->whereHas('section', fn ($query) => $query->where('subject_id', $subjectId))
            ->where('status', '!=', EnrollmentSubjectStatus::Dropped->value)
            ->exists();
    }

    private function isBlockRestricted(Section $section, ?string $enrollmentCategory): bool
    {
        return $section->is_block_exclusive === true
            && $enrollmentCategory !== null
            && strtolower($enrollmentCategory) === self::IRREGULAR_CATEGORY_PLACEHOLDER;
    }
}
