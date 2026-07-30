<?php

namespace App\Policies;

use App\Domain\Identity\UserRole;
use App\Models\User;

/**
 * PRD §3.8 assigns "process dropping and withdrawal requests" to Registrar
 * Staff specifically, not the Registrar Head — a literal reading of the
 * role list, not an assumption. The Registrar Head still reads every
 * request (`viewAny`), the same "keeper of the official record" visibility
 * it already has over enrollments and grades, but `decide` is Registrar
 * Staff only. "Which rows" is resolved by
 * `WithdrawalRequest::scopeVisibleTo` — this Policy is the role-level gate.
 */
final class WithdrawalRequestPolicy
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
        return $user->role === UserRole::Student;
    }

    public function decide(User $user): bool
    {
        return $user->role === UserRole::RegistrarStaff;
    }
}
