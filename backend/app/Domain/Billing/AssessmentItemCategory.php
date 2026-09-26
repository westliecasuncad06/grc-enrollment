<?php

namespace App\Domain\Billing;

/**
 * The kinds of line an assessment can carry. Treat this enum as
 * authoritative — see `App\Domain\Enrollment\EnrollmentStatus`'s identical
 * convention. Adding a category is a deliberate PRD §17 decision, not
 * something to bolt on silently: `ScholarshipDiscount` is the one such
 * decision so far (ADR 0025 — the Cashier's 100%/40%/20% scholarship, a
 * negative line worth that share of the tuition plus miscellaneous fees).
 */
enum AssessmentItemCategory: string
{
    case Tuition = 'tuition';
    case Miscellaneous = 'miscellaneous';
    case ScholarshipDiscount = 'scholarship_discount';

    public function label(): string
    {
        return match ($this) {
            self::Tuition => 'Tuition',
            self::Miscellaneous => 'Miscellaneous',
            self::ScholarshipDiscount => 'Scholarship discount',
        };
    }
}
