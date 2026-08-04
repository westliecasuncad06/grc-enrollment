<?php

namespace App\Domain\Billing;

/**
 * The two kinds of line an assessment can carry. Treat this enum as
 * authoritative — see `App\Domain\Enrollment\EnrollmentStatus`'s identical
 * convention. Adding a third category (e.g. a discount or scholarship
 * line) is a deliberate new PRD §17 decision, not something to bolt on
 * silently.
 */
enum AssessmentItemCategory: string
{
    case Tuition = 'tuition';
    case Miscellaneous = 'miscellaneous';

    public function label(): string
    {
        return match ($this) {
            self::Tuition => 'Tuition',
            self::Miscellaneous => 'Miscellaneous',
        };
    }
}
