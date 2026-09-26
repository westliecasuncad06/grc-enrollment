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
    /** Asked for (by the Student, or recorded by the Program Chair); awaiting the Program Chair's mapping. */
    case Pending = 'pending';
    /** Mapped to a subject and endorsed by the Program Chair; awaiting Registrar Staff. */
    case Endorsed = 'endorsed';
    case Approved = 'approved';
    case Rejected = 'rejected';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::Endorsed => 'Endorsed',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
        };
    }

    /** Still moving through the workflow: not yet approved or rejected. */
    public function isOpen(): bool
    {
        return $this === self::Pending || $this === self::Endorsed;
    }
}
