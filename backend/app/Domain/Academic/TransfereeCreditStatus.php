<?php

namespace App\Domain\Academic;

/**
 * PROVISIONAL VOCABULARY — NOT AN APPROVED INSTITUTIONAL POLICY VALUE.
 *
 * PRD §10.3 defers the transferee-credit source-institution fields to GRC
 * approval, and §17 leaves the surrounding vocabularies open. Replace these
 * values with the confirmed vocabulary via a data migration before any
 * production-like deployment.
 */
enum TransfereeCreditStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
        };
    }
}
