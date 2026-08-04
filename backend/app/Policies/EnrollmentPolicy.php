<?php

namespace App\Policies;

use App\Domain\Identity\UserRole;
use App\Models\Enrollment;
use App\Models\User;

/**
 * Four roles may list enrollments (PRD §5.3 FR-FIN-001/005): the owning
 * Student, the Registrar Head (oversight and void), Registrar Staff (the
 * approval queue), and Accounting Staff (payment queue). "Which rows" is
 * resolved by `Enrollment::scopeVisibleTo`, the same division of labor ADR
 * 0008 establishes throughout this codebase — this Policy is the role-level
 * gate, the scope is the record-level filter.
 *
 * `decideApproval` and `void` follow ADR 0011: one `PATCH` route serves two
 * different checkpoints (the initial approval queue, and an "authorized edge
 * case" override on an already-approved-but-unpaid enrollment — PRD §3.7),
 * so there is no single `role:` middleware gating the route;
 * `EnrollmentController::update` resolves the right ability from the
 * request's `action` field, mirroring `ScheduleProposalPolicy`.
 */
final class EnrollmentPolicy
{
    public function viewAny(User $user): bool
    {
        return in_array($user->role, [
            UserRole::Student,
            UserRole::RegistrarHead,
            UserRole::RegistrarStaff,
            UserRole::AccountingStaff,
        ], true);
    }

    public function create(User $user): bool
    {
        return $user->role === UserRole::Student;
    }

    /**
     * Covers `registrar_approve` and `registrar_reject` — Registrar Staff's
     * single decision at the approval-queue checkpoint. Approval is what
     * issues the Cashier queue ticket (`TransitionEnrollment`), so this
     * checkpoint deliberately sits with the same role that works the
     * academic-records/enrollment-documents queues, not the Registrar Head.
     */
    public function decideApproval(User $user): bool
    {
        return $user->role === UserRole::RegistrarStaff;
    }

    /**
     * Covers `void` — a distinct, later checkpoint: cancelling an enrollment
     * that has already been approved (and issued a queue ticket) but not yet
     * paid. This stays with the Registrar Head as the "authorized edge case"
     * override PRD §3.7 describes, deliberately separate from the Registrar
     * Staff's ordinary approval-queue decision. Scoping void to
     * `pending_payment` keeps it non-overlapping with both `registrar_reject`
     * (pre-approval) and the Phase 7b withdrawal flow (post-enrollment).
     */
    public function void(User $user): bool
    {
        return $user->role === UserRole::RegistrarHead;
    }

    /**
     * FR-FIN-007: confirming an externally received payment is Accounting
     * Staff's own action, a third checkpoint after the Registrar Head's two
     * (`decideApproval`, `void`) — no per-enrollment ownership dimension,
     * same class-level shape as `QueueTicketPolicy::update`.
     */
    public function confirmPayment(User $user): bool
    {
        return $user->role === UserRole::AccountingStaff;
    }

    /**
     * FR-FIN-004: only the owning Student may request withdrawal from their
     * own `enrolled` enrollment — an instance-level ownership check, unlike
     * every other ability here, because this is the first Student action
     * targeting a specific pre-existing `Enrollment` by route ID rather than
     * their own resolved `StudentProfile`. Mirrors `AcademicGradePolicy::update`'s
     * role-plus-ownership shape.
     */
    public function withdraw(User $user, Enrollment $enrollment): bool
    {
        return $user->role === UserRole::Student
            && $enrollment->student->user_id === $user->id;
    }

    /**
     * Phase 7: only the owning Student may request an add/drop/change-section
     * against their own enrollment — the same instance-level ownership shape
     * as `withdraw`, since this route is also nested under a specific
     * `Enrollment` by id rather than the actor's own resolved
     * `StudentProfile`.
     */
    public function requestChange(User $user, Enrollment $enrollment): bool
    {
        return $user->role === UserRole::Student
            && $enrollment->student->user_id === $user->id;
    }
}
