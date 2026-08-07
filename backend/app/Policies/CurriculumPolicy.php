<?php

namespace App\Policies;

use App\Domain\Identity\UserRole;
use App\Models\Curriculum;
use App\Models\User;

/**
 * Read access follows the same shape as ProgramPolicy/AcademicTermPolicy.
 * `create`/`update` are Program-Chair-only by role alone (unchanged — note
 * this means neither actually stops a chair from editing another
 * college's curriculum by id today; that pre-existing gap is out of scope
 * here). The three new abilities below back the approval chain's
 * transition endpoint (CurriculumController::transition): `submit` adds a
 * real college check on top of the role check (see its own docblock) since
 * it starts a chain other people rely on, but `approveAsDean`/
 * `approveAsExecutive` are role-scoped only, NOT college-scoped: per
 * `ScheduleProposalPolicy` and `NotifyScheduleTransition`'s docblock,
 * neither the Dean nor the Executive Director is scoped to a single
 * college in this system — every active Dean/Executive Director is a
 * legitimate reviewer for any college's curriculum.
 */
final class CurriculumPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Curriculum $curriculum): bool
    {
        if (! $user->role->isLearnerScoped()) {
            return true;
        }

        return $curriculum->status->isVisibleToLearners();
    }

    public function create(User $user): bool
    {
        return $user->role === UserRole::ProgramChair;
    }

    public function update(User $user, Curriculum $curriculum): bool
    {
        return $user->role === UserRole::ProgramChair;
    }

    /**
     * Unlike `create`/`update` (Program-Chair-only by role alone — an
     * existing gap this method deliberately does not repeat), `submit` is
     * the first step of a chain other people rely on (Dean review,
     * notifications routed to the submitter), so a role check alone isn't
     * enough: it must also confirm the curriculum's own program actually
     * belongs to the acting chair's college, the same defense-in-depth
     * `AutoAssignSectionScheduleReferences` applies ("the role check alone
     * does not stop one college's Chair from bulk-writing another
     * college's [resource]").
     */
    public function submit(User $user, Curriculum $curriculum): bool
    {
        if ($user->role !== UserRole::ProgramChair) {
            return false;
        }

        return $user->college !== null && $curriculum->program->college === $user->college;
    }

    public function approveAsDean(User $user): bool
    {
        return $user->role === UserRole::Dean;
    }

    public function approveAsExecutive(User $user): bool
    {
        return $user->role === UserRole::ExecutiveDirector;
    }
}
