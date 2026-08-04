<?php

namespace App\Policies;

use App\Domain\Identity\UserRole;
use App\Models\AcademicTermSectionPlan;
use App\Models\User;

final class AcademicTermSectionPlanPolicy
{
    public function viewAny(User $user): bool
    {
        return in_array($user->role, [UserRole::ProgramChair, UserRole::Dean, UserRole::ExecutiveDirector], true);
    }

    public function view(User $user, AcademicTermSectionPlan $plan): bool
    {
        return $user->role !== UserRole::ProgramChair || $user->college?->value === $plan->college;
    }

    public function update(User $user, AcademicTermSectionPlan $plan): bool
    {
        return $user->role === UserRole::ProgramChair
            && $user->college?->value === $plan->college
            && $plan->status->value === 'draft';
    }
}
