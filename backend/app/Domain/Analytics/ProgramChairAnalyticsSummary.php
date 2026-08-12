<?php

namespace App\Domain\Analytics;

/**
 * College-scoped bundle for the Program Chair analytics page, following the
 * same "several aggregate concerns behind one dashboard Action" shape as
 * App\Domain\Dashboard\InstitutionSummary. Every count here is grouped by
 * App\Domain\Enrollment\EnrollmentStatus or App\Domain\Academic\GradeStatus,
 * both PRD-authoritative enums — see ADR 0017. `payments.amount` is never
 * summed here.
 */
final readonly class ProgramChairAnalyticsSummary
{
    /**
     * @param  array<string, int>  $enrollmentStatusCounts  EnrollmentStatus value => row count, this term+college
     * @param  array<string, int>  $gradeStatusCounts  GradeStatus value => row count, this term+college
     * @param  list<RetentionBreakdownRow>  $retentionBreakdown  full GradeStatus x EnrollmentStatus matrix, zero-filled
     * @param  list<AnalyticsYearOverYearPoint>  $yearOverYear  one entry per (school_year, semester), all terms, this college, chronological
     */
    public function __construct(
        public int $academicTermId,
        public string $college,
        public array $enrollmentStatusCounts,
        public array $gradeStatusCounts,
        public array $retentionBreakdown,
        public array $yearOverYear,
    ) {}
}
