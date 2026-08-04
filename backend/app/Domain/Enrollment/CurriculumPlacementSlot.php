<?php

namespace App\Domain\Enrollment;

use App\Domain\Curriculum\SemesterSlot;

/**
 * A pure, DB-free view of one `curriculum_subjects` row, carrying just what
 * `EnrollmentCategoryClassifier` needs — no Eloquent model, so the
 * classifier stays unit-testable without a database.
 */
final readonly class CurriculumPlacementSlot
{
    public function __construct(
        public int $subjectId,
        public string $subjectCode,
        public int $yearLevel,
        public SemesterSlot $semester,
        public bool $isRequired,
    ) {}

    /**
     * This placement's position in the 4-year plan — see
     * `SemesterSlot::ordinal()`.
     */
    public function ordinal(): int
    {
        return $this->semester->ordinal($this->yearLevel);
    }
}
