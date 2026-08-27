<?php

namespace App\Policies;

use App\Domain\Identity\UserRole;
use App\Models\StudentProfile;
use App\Models\User;

/**
 * A Student may view only their own record. Admission Staff is the one
 * broader role-based reader/writer here, per PRD §3.2's Student Records
 * directory: it may list, view, and directly correct any profile. No other
 * staff role gets a general student-profile read through this endpoint —
 * Accounting Staff's narrower `viewAccount`/`recordAccountPayment`
 * abilities below are the only exception, scoped to the payment desk.
 */
final class StudentProfilePolicy
{
    public function view(User $user, StudentProfile $profile): bool
    {
        return $user->id === $profile->user_id
            || $user->role === UserRole::AdmissionStaff;
    }

    public function viewAny(User $user): bool
    {
        return $user->role === UserRole::AdmissionStaff;
    }

    public function create(User $user): bool
    {
        return $user->role === UserRole::AdmissionStaff;
    }

    public function update(User $user, StudentProfile $profile): bool
    {
        return $user->role === UserRole::AdmissionStaff;
    }

    /**
     * This narrower account-summary ability does not widen the ordinary
     * student-profile read endpoint: a Student may read only their own
     * account, while Accounting Staff may read account context at the
     * payment desk.
     */
    public function viewAccount(User $user, StudentProfile $profile): bool
    {
        return ($user->role === UserRole::Student && $user->id === $profile->user_id)
            || $user->role === UserRole::AccountingStaff;
    }

    public function recordAccountPayment(User $user, StudentProfile $profile): bool
    {
        return $user->role === UserRole::AccountingStaff;
    }
}
