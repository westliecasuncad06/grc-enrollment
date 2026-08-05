<?php

namespace App\Domain\Identity;

/**
 * PROVISIONAL VOCABULARY — NOT AN APPROVED INSTITUTIONAL POLICY VALUE.
 *
 * Whether a student is a fee-paying Payee or a Scholar, informational only —
 * set at admission provisioning and shown to Registrar/Accounting staff so
 * they know who they are dealing with. This deliberately does not change any
 * fee computation: `App\Domain\Billing\AssessmentComputation` reads only
 * total units and the fee schedule, never this value. A real
 * scholarship-waiver policy is a separate, not-yet-approved institutional
 * decision (PRD §17).
 */
enum FinancialStatus: string
{
    case Scholar = 'scholar';
    case Payee = 'payee';

    public function label(): string
    {
        return match ($this) {
            self::Scholar => 'Scholar',
            self::Payee => 'Payee',
        };
    }
}
