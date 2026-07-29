<?php

namespace App\Policies;

use App\Domain\Identity\UserRole;
use App\Models\Section;
use App\Models\User;

/**
 * Same shape as CurriculumPolicy: read access follows the learner/planner
 * visibility split; write access is restricted to the Program Chair role,
 * matching curriculum authorship (sections are the chair's schedule plan).
 */
final class SectionPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Section $section): bool
    {
        if (! $user->role->isLearnerScoped()) {
            return true;
        }

        if ($user->role === UserRole::Faculty) {
            return $section->professor_id === $user->id
                && $section->status->isVisibleToLearners();
        }

        return $section->status->isVisibleToLearners();
    }

    public function create(User $user): bool
    {
        return $user->role === UserRole::ProgramChair;
    }

    public function update(User $user, Section $section): bool
    {
        return $user->role === UserRole::ProgramChair;
    }
}
