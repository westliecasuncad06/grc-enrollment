<?php

namespace App\Domain\Enrollment;

use App\Models\CurriculumSubject;
use App\Models\Section;
use App\Models\Subject;

/**
 * One row of the eligible-subject pool (DFD 2.2, FR-ENR-001–003/005/011):
 * a subject placed in the student's curriculum, whether it can currently be
 * selected, and the explainable reasons behind that verdict.
 */
final readonly class EligibleSubjectEntry
{
    /**
     * @param  list<array{code: string, message: string}>  $reasons
     * @param  list<Section>  $availableSections
     */
    public function __construct(
        public Subject $subject,
        public CurriculumSubject $placement,
        public bool $isEligible,
        public array $reasons,
        public array $availableSections,
    ) {}
}
