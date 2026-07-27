<?php

namespace App\Policies;

use App\Domain\Identity\UserRole;
use App\Models\Curriculum;
use App\Models\User;

/**
 * Read access follows the same shape as ProgramPolicy/AcademicTermPolicy.
 * Write access is new: only the Program Chair authors curricula (matches
 * the frontend's existing "curriculum"/"subjects-prerequisites" module
 * ownership) — the first production consumer of the `role` middleware from
 * ADR 0008. The Policy re-checks the role as defense in depth; the `role`
 * middleware is the coarse route-level gate.
 */
final class CurriculumPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Curriculum $curriculum): bool
    {
        if (! $user->role->isLearnerScoped()) {
            return true;
        }

        return $curriculum->status->isVisibleToLearners();
    }

    public function create(User $user): bool
    {
        return $user->role === UserRole::ProgramChair;
    }

    public function update(User $user, Curriculum $curriculum): bool
    {
        return $user->role === UserRole::ProgramChair;
    }
}
