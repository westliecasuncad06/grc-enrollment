<?php

namespace App\Policies;

use App\Domain\Identity\UserRole;
use App\Models\AuditLog;
use App\Models\User;

final class AuditLogPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->role === UserRole::RegistrarHead;
    }

    public function view(User $user, AuditLog $auditLog): bool
    {
        return $user->role === UserRole::RegistrarHead;
    }
}
