<?php

namespace App\Policies;

use App\Domain\Identity\UserRole;
use App\Models\FacultySpecialization;
use App\Models\User;

/** Own-record authorization for faculty teaching-capability profiles. */
final class FacultySpecializationPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, FacultySpecialization $specialization): bool
    {
        if (! $user->role->isLearnerScoped()) {
            return true;
        }

        return $specialization->professor_id === $user->id;
    }

    public function create(User $user): bool
    {
        return $user->role === UserRole::Faculty
            || ($user->role === UserRole::ProgramChair && $user->college !== null);
    }

    public function delete(User $user, FacultySpecialization $specialization): bool
    {
        return $user->role === UserRole::Faculty && $specialization->professor_id === $user->id;
    }
}
