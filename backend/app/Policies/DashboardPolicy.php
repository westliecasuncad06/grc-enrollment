<?php

namespace App\Policies;

use App\Domain\Identity\UserRole;
use App\Models\User;

/**
 * Computed views, not stored resources — the same shape as
 * EligibleSubjectPolicy and FacultyMemberPolicy. Each dashboard method is
 * role-exclusive by design: Enrollment Summary is shared between Dean and
 * Executive Director (both are authorized to see enrollment-level activity
 * per PRD §3.5/§3.6), but Institution Summary and Policy Settings are each
 * scoped to exactly one role.
 */
final class DashboardPolicy
{
    public function viewEnrollmentSummary(User $user): bool
    {
        return in_array($user->role, [UserRole::Dean, UserRole::ExecutiveDirector], true);
    }

    public function viewInstitutionSummary(User $user): bool
    {
        return $user->role === UserRole::ExecutiveDirector;
    }

    public function viewPolicySettings(User $user): bool
    {
        return $user->role === UserRole::RegistrarHead;
    }
}
