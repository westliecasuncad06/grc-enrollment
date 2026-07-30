<?php

namespace App\Policies;

use App\Domain\Identity\UserRole;
use App\Models\User;

/**
 * FR-FIN-010: only the owning Student and the Registrar Head may read
 * generated enrollment documents (the Digital COM). "Which rows" is
 * resolved by `EnrollmentDocument::scopeVisibleTo` — this Policy is the
 * role-level gate, matching `EnrollmentPolicy`'s division of labor.
 */
final class EnrollmentDocumentPolicy
{
    public function viewAny(User $user): bool
    {
        return in_array($user->role, [
            UserRole::Student,
            UserRole::RegistrarHead,
        ], true);
    }
}
