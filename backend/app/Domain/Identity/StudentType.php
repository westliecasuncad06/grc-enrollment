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
    case Returnee = 'returnee';
    /** Already a student of the school; Admission only needs to give them an account (stakeholder Doc 20). */
    case ExistingStudent = 'existing_student';

    public function label(): string
    {
        return match ($this) {
            self::Freshman => 'Freshman',
            self::Transferee => 'Transferee',
            self::Returnee => 'Returnee',
            self::ExistingStudent => 'Existing Student',
        };
    }

    /**
     * Whether Admission may enter a student number the student already has
     * instead of getting a new one (ADR 0042). Only a Returnee and an Existing
     * Student have records at the school; a Freshman has no number yet and a
     * Transferee's number belongs to the school they came from.
     */
    public function canHaveExistingStudentNumber(): bool
    {
        return $this === self::Returnee || $this === self::ExistingStudent;
    }
}
