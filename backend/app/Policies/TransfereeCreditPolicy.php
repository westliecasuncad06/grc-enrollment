<?php

namespace App\Policies;

use App\Domain\Identity\UserRole;
use App\Models\TransfereeCredit;
use App\Models\User;

/**
 * Credit mapping is the Program Chair's work; Registrar Staff only approve
 * (ADR 0026, superseding PRD §3.8's "Registrar Staff process transferee
 * credit mappings"). A Student can ask for one, a Program Chair maps and
 * endorses it, and Registrar Staff approve or reject the endorsed ones. The
 * Registrar Head keeps the read-only "keeper of the official record"
 * visibility it has over enrollments, grades and withdrawals.
 *
 * "Which rows" is `TransfereeCredit::scopeVisibleTo`; these are the
 * role-level gates, plus the one ownership check a Program Chair needs (the
 * credit's student must be in their own college), which `update` makes when
 * it is given the credit.
 */
final class TransfereeCreditPolicy
{
    public function viewAny(User $user): bool
    {
        return in_array($user->role, [
            UserRole::Student,
            UserRole::ProgramChair,
            UserRole::RegistrarStaff,
            UserRole::RegistrarHead,
        ], true);
    }

    /**
     * A Student requests for themselves (the Action pins the student to the
     * caller); a Program Chair records one for a student in their college.
     */
    public function create(User $user): bool
    {
        return in_array($user->role, [UserRole::Student, UserRole::ProgramChair], true);
    }

    /**
     * Mapping, editing, endorsing, declining and asking for suggestions: the
     * Program Chair's work, on their own college's students only.
     */
    public function update(User $user, ?TransfereeCredit $credit = null): bool
    {
        if ($user->role !== UserRole::ProgramChair) {
            return false;
        }

        return $credit === null || $this->chairOwns($user, $credit);
    }

    /**
     * Approve or reject an endorsed credit. Registrar Staff only: never the
     * Program Chair (who endorses) and never the Registrar Head (read-only).
     */
    public function decide(User $user): bool
    {
        return $user->role === UserRole::RegistrarStaff;
    }

    /**
     * A chair without an assigned college is unscoped, the same fallback
     * `TransfereeCredit::scopeVisibleTo` uses.
     */
    private function chairOwns(User $chair, TransfereeCredit $credit): bool
    {
        if ($chair->college === null) {
            return true;
        }

        $credit->loadMissing('student.program');

        return $credit->student->program->college === $chair->college;
    }
}
