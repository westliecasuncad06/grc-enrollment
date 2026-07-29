<?php

namespace App\Policies;

use App\Domain\Identity\UserRole;
use App\Models\User;

/**
 * Own-record only, no broader role-based visibility — matching
 * StudentProfilePolicy. "Which enrollments" is resolved by the controller's
 * `where('student_id', ...)` scope, the same division of labor ADR 0008
 * establishes throughout this codebase.
 */
final class EnrollmentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->role === UserRole::Student;
    }

    public function create(User $user): bool
    {
        return $user->role === UserRole::Student;
    }
}
