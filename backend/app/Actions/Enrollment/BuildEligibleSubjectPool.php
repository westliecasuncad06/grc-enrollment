<?php

namespace App\Actions\Enrollment;

use App\Domain\Academic\GradeStatus;
use App\Domain\Academic\PrerequisiteEvaluator;
use App\Domain\Academic\PrerequisiteVerdict;
use App\Domain\Enrollment\BlockSectionAccessPolicy;
use App\Domain\Enrollment\EligibleSubjectEntry;
use App\Domain\Enrollment\EnrollmentAccessContext;
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
    public function __construct(
        private PrerequisiteEvaluator $evaluator,
        private BuildEnrollmentAccessContext $accessContext,
    ) {}

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

        // Resolved once for the whole pool: which audience windows are open
        // is a property of the term, not of any single placement.
        $context = $this->accessContext->execute($term, $student);

        return array_values(array_map(
            fn (CurriculumSubject $placement): EligibleSubjectEntry => $this->evaluatePlacement($student, $term, $placement, $context),
            $placements->all(),
        ));
    }

    private function evaluatePlacement(
        StudentProfile $student,
        AcademicTerm $term,
        CurriculumSubject $placement,
        EnrollmentAccessContext $context,
    ): EligibleSubjectEntry {
        /** @var list<array{code: string, message: string}> $reasons */
        $reasons = [];
        $excluded = false;

        $ownGrade = $this->latestLockedGrade($student->id, $placement->subject_id);
        if ($this->verdictFor($ownGrade, (string) config('enrollment.grading.passing_grade'))->isSatisfied()) {
            $reasons[] = ['code' => 'completed', 'message' => 'This subject has already been completed with a passing grade.'];
            $excluded = true;
        }

        if ($this->isAlreadySelectedThisTerm($student->id, $term->id, $placement->subject_id)) {
            $reasons[] = ['code' => 'already_selected', 'message' => 'This subject is already part of your current enrollment for this term.'];
            $excluded = true;
        }

        foreach ($placement->prerequisites as $edge) {
            $prerequisiteGrade = $this->latestLockedGrade($student->id, $edge->prerequisite_subject_id);
            $verdict = $this->verdictFor($prerequisiteGrade, $edge->minimum_grade);

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
                ->with('sectionPlan')
                ->get();

            $openSections = $sectionsThisTerm
                ->filter(fn (Section $section): bool => $section->status === SectionStatus::Published && $section->remainingSeats() > 0)
                ->values();

            if ($openSections->isEmpty()) {
                $reasons[] = ['code' => 'no_sections_available', 'message' => 'No published sections with open seats are offered for this subject in the selected term.'];
                $excluded = true;
            } else {
                $unrestricted = $openSections->filter(
                    fn (Section $section): bool => BlockSectionAccessPolicy::allows(
                        $section->is_block_exclusive,
                        $this->blockYearLevel($section),
                        $context,
                    ),
                )->values();

                if ($unrestricted->isEmpty()) {
                    // $openSections was already proven non-empty above.
                    $representativeSection = $openSections->first();
                    $withheldCode = BlockSectionAccessPolicy::reasonFor(
                        $representativeSection->is_block_exclusive,
                        $this->blockYearLevel($representativeSection),
                        $context,
                    ) ?? 'block_restricted';

                    $reasons[] = $withheldCode === 'block_other_year'
                        ? ['code' => 'block_other_year', 'message' => 'The only open sections for this subject belong to another year level\'s block.']
                        : ['code' => 'block_restricted', 'message' => 'The only open sections for this subject are block sections, which open to irregular students when the irregular enrollment window starts.'];
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
     * reaching `PrerequisiteEvaluator` — that evaluator only compares
     * numeric grades and treats every non-numeric value (including `C`) as
     * a special mark, which would make `LEAD1`'s `C` permanently fail to
     * satisfy `LEAD2`'s prerequisite. This short-circuit is the fix; the
     * evaluator itself is intentionally left untouched.
     *
     * Falls back to `mark->value` (e.g. `'NC'`, `'INC'`) or, for legacy
     * rows locked before `mark` existed, the raw `final_grade` string — so
     * `PrerequisiteEvaluator`'s existing special-marks/numeric handling
     * still runs unchanged for every case except Complete.
     */
    private function verdictFor(?AcademicGrade $grade, string $required): PrerequisiteVerdict
    {
        // Read into a local first: chaining a second `?->` off the result of
        // the first (`$grade?->mark?->x`) only protects against `$grade`
        // itself being null. If `$grade` is non-null but `mark` is null, a
        // further method call needs its own `?->` — a plain `->method()` on
        // null is a fatal error, unlike plain property access.
        $mark = $grade?->mark;

        if ($mark?->isCompletion() === true) {
            return PrerequisiteVerdict::satisfied('Recorded mark C (Complete) satisfies this completion-only requirement.');
        }

        // Explicit null checks, not `?->`/plain `->`: PHP itself tolerates
        // `$mark->value` here even when `$mark` is null (a property-access
        // chain on the left of `??` degrades silently to null, with no
        // nullsafe operator needed) — but PHPStan's static analysis can't
        // see that runtime allowance and flags it as a possible-null
        // dereference regardless. Explicit checks satisfy both.
        $markValue = $mark !== null ? $mark->value : null;
        $finalGrade = $grade !== null ? $grade->final_grade : null;
        $rawGrade = $markValue ?? $finalGrade;

        return $this->evaluator->evaluate($rawGrade, $required);
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

    /**
     * The year level a block section belongs to.
     *
     * `section_plan_id` is authoritative — it is the row the Program Chair
     * actually planned against. The section-code suffix is only a fallback
     * for legacy rows generated before section plans existed (`IT201` → 2),
     * and null when neither is available, which the access policy treats as
     * "do not withhold".
     */
    private function blockYearLevel(?Section $section): ?int
    {
        if ($section === null) {
            return null;
        }

        if ($section->sectionPlan !== null) {
            return $section->sectionPlan->year_level;
        }

        return preg_match('/(\d)\d{2}$/u', $section->section_code, $matches) === 1
            ? (int) $matches[1]
            : null;
    }
}
