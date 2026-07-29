<?php

namespace App\Policies;

use App\Domain\Identity\UserRole;
use App\Models\User;

/**
 * Three roles may list enrollments (PRD §5.3 FR-FIN-001/005): the owning
 * Student, the Registrar Head (approval queue), and Accounting Staff
 * (payment queue). "Which rows" is resolved by `Enrollment::scopeVisibleTo`,
 * the same division of labor ADR 0008 establishes throughout this codebase —
 * this Policy is the role-level gate, the scope is the record-level filter.
 */
final class EnrollmentPolicy
{
    public function viewAny(User $user): bool
    {
        return in_array($user->role, [
            UserRole::Student,
            UserRole::RegistrarHead,
            UserRole::AccountingStaff,
        ], true);
    }

    public function create(User $user): bool
    {
        return $user->role === UserRole::Student;
    }
}
