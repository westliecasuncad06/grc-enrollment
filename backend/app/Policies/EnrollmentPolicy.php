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
 *
 * `decideApproval` and `void` follow ADR 0011: one `PATCH` route serves two
 * different Registrar Head checkpoints (the initial approval queue, and an
 * "authorized edge case" override on an already-approved-but-unpaid
 * enrollment — PRD §3.7), so there is no single `role:` middleware gating
 * the route; `EnrollmentController::update` resolves the right ability from
 * the request's `action` field, mirroring `ScheduleProposalPolicy`.
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

    /**
     * Covers `registrar_approve` and `registrar_reject` — the Registrar
     * Head's single decision at the approval-queue checkpoint.
     */
    public function decideApproval(User $user): bool
    {
        return $user->role === UserRole::RegistrarHead;
    }

    /**
     * Covers `void` — a distinct, later checkpoint: cancelling an enrollment
     * the Registrar Head already approved but that has not yet been paid.
     * PRD §17 leaves the exact scope of "authorized edge cases" unconfirmed;
     * scoping void to `pending_payment` keeps it non-overlapping with both
     * `registrar_reject` (pre-approval) and the Phase 7b withdrawal flow
     * (post-enrollment).
     */
    public function void(User $user): bool
    {
        return $user->role === UserRole::RegistrarHead;
    }
}
