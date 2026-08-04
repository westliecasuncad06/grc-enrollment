<?php

namespace App\Actions\Enrollment;

use App\Domain\Enrollment\EnrollmentAccessContext;
use App\Domain\Enrollment\EnrollmentAudience;
use App\Domain\Enrollment\EnrollmentWindowResolver;
use App\Models\AcademicTerm;
use App\Models\AcademicTermEnrollmentWindow;
use App\Models\StudentProfile;
use Carbon\CarbonImmutable;

/**
 * Resolves all five audience windows for a term in one query, so callers
 * can answer block-access questions without re-reading windows per section.
 *
 * Like `BuildEnrollmentScheduleSummary`, this never writes: a term with no
 * `academic_term_enrollment_windows` rows falls back to the term-wide
 * window in memory. Both actions decide openness through the same pure
 * `EnrollmentWindowResolver`, which is the single definition of the rule.
 */
final class BuildEnrollmentAccessContext
{
    public function execute(AcademicTerm $term, StudentProfile $student): EnrollmentAccessContext
    {
        $now = CarbonImmutable::now();
        $windows = AcademicTermEnrollmentWindow::query()
            ->where('academic_term_id', $term->id)
            ->get()
            ->keyBy(fn (AcademicTermEnrollmentWindow $window): string => $window->audience->value);

        $openAudiences = [];
        foreach (EnrollmentAudience::cases() as $audience) {
            $window = $windows->get($audience->value);

            $availability = EnrollmentWindowResolver::resolve(
                $term->status,
                $term->enrollment_opens_at,
                $term->enrollment_closes_at,
                $window?->opens_at,
                $window?->closes_at,
                $now,
            );

            if ($availability->isOpen) {
                $openAudiences[] = $audience;
            }
        }

        $viewerAudience = EnrollmentAudience::forStudent(
            $student->enrollment_category,
            $student->year_level,
        );

        return new EnrollmentAccessContext(
            $viewerAudience,
            in_array($viewerAudience, $openAudiences, true),
            in_array(EnrollmentAudience::Irregular, $openAudiences, true),
            $openAudiences,
        );
    }
}
