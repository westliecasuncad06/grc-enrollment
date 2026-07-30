<?php

namespace App\Policies;

use App\Domain\Identity\UserRole;
use App\Models\User;

/**
 * PRD §3.8 assigns processing transferee credits to Registrar Staff, the
 * same literal role reading `WithdrawalRequestPolicy` documents — the
 * Registrar Head still reads every credit (`viewAny`), the same "keeper of
 * the official record" visibility it already has over enrollments, grades,
 * and withdrawal requests, but never writes one. "Which rows" is resolved
 * by `TransfereeCredit::scopeVisibleTo` — this Policy is the role-level
 * gate.
 *
 * There is no ownership dimension here (unlike `AcademicGradePolicy`'s
 * own-section check) — Registrar Staff manages every transferee credit, not
 * just ones it created — so `update` and `decide` are both plain role
 * checks.
 */
final class TransfereeCreditPolicy
{
    public function viewAny(User $user): bool
    {
        return in_array($user->role, [
            UserRole::Student,
            UserRole::RegistrarStaff,
            UserRole::RegistrarHead,
        ], true);
    }

    public function create(User $user): bool
    {
        return $user->role === UserRole::RegistrarStaff;
    }

    public function update(User $user): bool
    {
        return $user->role === UserRole::RegistrarStaff;
    }

    public function decide(User $user): bool
    {
        return $user->role === UserRole::RegistrarStaff;
    }
}
