<?php

namespace App\Policies;

use App\Domain\Identity\UserRole;
use App\Models\User;

final class FacultyMemberPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->role === UserRole::ProgramChair;
    }
}
