<?php

namespace App\Policies;

use App\Models\AcademicTerm;
use App\Models\User;

final class AcademicTermPolicy
{
    /**
     * Every role may list academic terms; AcademicTerm::scopeVisibleTo()
     * controls which rows a learner-scoped role actually receives.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * A learner-scoped role may not read a non-learner-visible term even by
     * direct ID lookup; planning roles may read any term.
     */
    public function view(User $user, AcademicTerm $term): bool
    {
        if (! $user->role->isLearnerScoped()) {
            return true;
        }

        return $term->status->isVisibleToLearners();
    }
}
