<?php

namespace App\Domain\Identity;

/**
 * PROVISIONAL VOCABULARY — NOT AN APPROVED INSTITUTIONAL POLICY VALUE.
 *
 * Whether a student entered the program as an incoming Freshman or a
 * Transferee from another institution — set once at admission provisioning
 * and shown to Admission/Registrar staff so they know who they are dealing
 * with. Informational only: it does not itself grant `TransfereeCredit`
 * rows or drive any eligibility/prerequisite logic — Registrar staff still
 * record transferee credits separately, subject by subject, via
 * `App\Actions\Academic\CreateTransfereeCredit`.
 */
enum StudentType: string
{
    case Freshman = 'freshman';
    case Transferee = 'transferee';

    public function label(): string
    {
        return match ($this) {
            self::Freshman => 'Freshman',
            self::Transferee => 'Transferee',
        };
    }
}
