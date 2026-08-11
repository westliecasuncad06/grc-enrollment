<?php

namespace App\Policies;

use App\Domain\Identity\UserRole;
use App\Models\User;

final class ItControlPolicy
{
    public function viewAccountBrowser(User $user): bool
    {
        return $user->role === UserRole::ItAdmin;
    }

    public function viewAutomationRuns(User $user): bool
    {
        return $user->role === UserRole::ItAdmin;
    }

    public function createAutomationRuns(User $user): bool
    {
        return $user->role === UserRole::ItAdmin;
    }
}
