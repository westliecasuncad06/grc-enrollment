<?php

namespace App\Policies;

use App\Domain\Identity\UserRole;
use App\Models\StudentProfile;
use App\Models\User;

/**
 * Own-record only, no broader role-based visibility — unlike every other
 * Policy in this codebase, there is no "planning role sees everyone's" case
 * here. Nothing in PRD §3 grants any role a general student-profile read;
 * Admission Staff writes (creates) profiles but does not read them back
 * through this endpoint.
 */
final class StudentProfilePolicy
{
    public function view(User $user, StudentProfile $profile): bool
    {
        return $user->id === $profile->user_id;
    }

    public function create(User $user): bool
    {
        return $user->role === UserRole::AdmissionStaff;
    }
}
