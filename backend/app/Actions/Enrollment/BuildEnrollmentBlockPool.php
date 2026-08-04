<?php

namespace App\Actions\Enrollment;

use App\Domain\Academic\GradeStatus;
use App\Domain\Academic\PrerequisiteEvaluator;
use App\Domain\Academic\PrerequisiteVerdict;
use App\Domain\Enrollment\EnrollmentAudience;
use App\Domain\Enrollment\EnrollmentBlock;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Scheduling\SectionStatus;
use App\Models\AcademicGrade;
use App\Models\AcademicTerm;
use App\Models\CurriculumSubject;
use App\Models\Enrollment;
use App\Models\Section;
use App\Models\StudentProfile;

/**
 * The blocks a regular student may choose from: every section their
 * college's Program Chair generated for the student's own year level and
 * curriculum, grouped by block code (DFD 2.2 sibling for block-based
 * enrollment; FR-ENR-001–003, 011).
 *
 * Irregular students always enrol per subject via `BuildEligibleSubjectPool`
 * instead — they return an empty pool here, not an error, so the caller can
 * render "you don't use this view" rather than a broken empty state.
 */
final readonly class BuildEnrollmentBlockPool
{
    public function __construct(
        private PrerequisiteEvaluator $evaluator,
        private BuildEnrollmentAccessContext $accessContext,
    ) {}

    /**
     * @return list<EnrollmentBlock>
     */
    public function execute(StudentProfile $student, AcademicTerm $term): array
    {
        $context = $this->accessContext->execute($term, $student);

        if ($context->viewerAudience === EnrollmentAudience::Irregular) {
            return [];
        }

        $sections = Section::query()
            ->where('academic_term_id', $term->id)
            ->where('status', SectionStatus::Published)
            ->where('is_block_exclusive', true)
            ->whereHas('sectionPlan', function ($query) use ($student): void {
                $query->where('year_level', $student->year_level)
                    ->where('curriculum_id', $student->curriculum_id);
            })
            ->with(['subject', 'professor', 'sectionPlan'])
            ->orderBy('section_code')
            ->get();

        $alreadyEnrolled = $this->hasActiveEnrollmentThisTerm($student->id, $term->id);

        $blocks = $sections
            ->groupBy('section_code')
            ->map(fn ($blockSections, string $blockCode): EnrollmentBlock => $this->buildBlock(
                $student,
                $blockCode,
                array_values($blockSections->all()),
                $context->viewerWindowIsOpen,
                $alreadyEnrolled,
            ));

        return array_values($blocks->all());
    }

    /**
     * @param  list<Section>  $sections
     */
    private function buildBlock(
        StudentProfile $student,
        string $blockCode,
        array $sections,
        bool $windowIsOpen,
        bool $alreadyEnrolled,
    ): EnrollmentBlock {
        /** @var list<array{code: string, message: string}> $reasons */
        $reasons = [];

        if ($alreadyEnrolled) {
            $reasons[] = ['code' => 'already_enrolled', 'message' => 'You already have an active enrollment for this term.'];
        }

        if (! $windowIsOpen) {
            $reasons[] = ['code' => 'window_closed', 'message' => 'Enrollment for your year level is not currently open.'];
        }

        $incomplete = array_filter(
            $sections,
            fn (Section $section): bool => $section->professor_id === null
                || $section->schedule_days === null
                || $section->starts_at_time === null
                || $section->ends_at_time === null
                || $section->room === null,
        );
        if ($incomplete !== []) {
            $reasons[] = ['code' => 'incomplete_schedule', 'message' => 'This block is not fully scheduled yet — check back once every subject has a professor, day, time, and room.'];
        }

        $placements = CurriculumSubject::query()
            ->where('curriculum_id', $student->curriculum_id)
            ->whereIn('subject_id', array_map(fn (Section $section): int => $section->subject_id, $sections))
            ->with('prerequisites.prerequisiteSubject')
            ->get()
            ->keyBy('subject_id');

        foreach ($sections as $section) {
            $ownGrade = $this->latestLockedGrade($student->id, $section->subject_id);
            if ($this->verdictFor($ownGrade, (string) config('enrollment.grading.passing_grade'))->isSatisfied()) {
                $reasons[] = ['code' => 'partially_completed', 'message' => "{$section->subject->code} has already been completed with a passing grade. See the Registrar about enrolling as an irregular student."];
            }

            // Prerequisites are scoped per curriculum placement (Subject
            // itself carries no prerequisite relation) — a subject absent
            // from this curriculum's placements simply has none to check.
            $placement = $placements->get($section->subject_id);
            $prerequisites = $placement !== null ? $placement->prerequisites : [];
            foreach ($prerequisites as $edge) {
                $prerequisiteGrade = $this->latestLockedGrade($student->id, $edge->prerequisite_subject_id);
                $verdict = $this->verdictFor($prerequisiteGrade, $edge->minimum_grade);

                if ($verdict->status->value === 'not_satisfied') {
                    $reasons[] = ['code' => 'prerequisite', 'message' => sprintf('%s requires %s: %s', $section->subject->code, $edge->prerequisiteSubject->code, $verdict->reason)];
                }
            }
        }

        // A reduce, not min(): `min([])` throws at runtime, and PHPStan
        // cannot prove a `list<Section>` built from `groupBy()` is
        // non-empty even though every group always has at least one member.
        $seatsRemaining = array_reduce(
            $sections,
            fn (?int $carry, Section $section): int => $carry === null
                ? $section->remainingSeats()
                : min($carry, $section->remainingSeats()),
            null,
        ) ?? 0;
        if ($seatsRemaining <= 0) {
            $reasons[] = ['code' => 'block_full', 'message' => 'At least one subject in this block has no open seats.'];
        }

        $totalUnits = array_sum(array_map(fn (Section $section): float => (float) $section->subject->units, $sections));
        $firstSection = $sections[0];
        $sectionPlan = $firstSection->sectionPlan;
        $sectionPlanId = $firstSection->section_plan_id;
        $yearLevel = $sectionPlan !== null ? $sectionPlan->year_level : $student->year_level;
        $curriculumId = $sectionPlan !== null ? $sectionPlan->curriculum_id : $student->curriculum_id;

        return new EnrollmentBlock(
            blockCode: $blockCode,
            yearLevel: $yearLevel,
            curriculumId: $curriculumId,
            sectionPlanId: $sectionPlanId,
            sections: $sections,
            totalUnits: $totalUnits,
            seatsRemaining: max(0, $seatsRemaining),
            isSelectable: $reasons === [],
            reasons: $reasons,
        );
    }

    private function latestLockedGrade(int $studentId, int $subjectId): ?AcademicGrade
    {
        return AcademicGrade::query()
            ->where('student_id', $studentId)
            ->where('subject_id', $subjectId)
            ->where('status', GradeStatus::Locked)
            ->orderByDesc('academic_term_id')
            ->orderByDesc('id')
            ->first(['mark', 'final_grade']);
    }

    /**
     * `C` (Complete) satisfies a completion-only subject's own-completion
     * check and every prerequisite edge that requires it, without ever
     * reaching `PrerequisiteEvaluator` — see the identical helper in
     * `BuildEligibleSubjectPool` for the full rationale.
     */
    private function verdictFor(?AcademicGrade $grade, string $required): PrerequisiteVerdict
    {
        // See the identical comment in BuildEligibleSubjectPool::verdictFor()
        // for why this is split into a local variable rather than chained.
        $mark = $grade?->mark;

        if ($mark?->isCompletion() === true) {
            return PrerequisiteVerdict::satisfied('Recorded mark C (Complete) satisfies this completion-only requirement.');
        }

        // Explicit null checks: see BuildEligibleSubjectPool::verdictFor()
        // for why neither `?->` nor plain `->` satisfies PHPStan here.
        $markValue = $mark !== null ? $mark->value : null;
        $finalGrade = $grade !== null ? $grade->final_grade : null;
        $rawGrade = $markValue ?? $finalGrade;

        return $this->evaluator->evaluate($rawGrade, $required);
    }

    private function hasActiveEnrollmentThisTerm(int $studentId, int $academicTermId): bool
    {
        return Enrollment::query()
            ->where('student_id', $studentId)
            ->where('academic_term_id', $academicTermId)
            ->whereNotIn('status', EnrollmentStatus::terminalValues())
            ->exists();
    }
}
