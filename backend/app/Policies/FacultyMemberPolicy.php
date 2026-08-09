<?php

namespace App\Policies;

use App\Domain\Identity\UserRole;
use App\Models\User;

final class FacultyMemberPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->role === UserRole::ProgramChair && $user->college !== null;
    }

    public function updateWorkforceProfile(User $user, User $facultyMember): bool
    {
        return $user->role === UserRole::ProgramChair
            && $user->college !== null
            && $facultyMember->role === UserRole::Faculty
            && $facultyMember->college === $user->college;
    }
}
