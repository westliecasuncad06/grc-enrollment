<?php

namespace App\Actions\Scheduling;

use App\Models\Section;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

final class ListSections
{
    /** @return Collection<int, Section> */
    public function execute(User $user, ?int $academicTermId = null): Collection
    {
        $query = Section::query()
            ->visibleTo($user)
            ->with('professor:id,name');

        if ($academicTermId !== null) {
            $query->where('academic_term_id', $academicTermId);
        }

        return $query
            ->orderBy('academic_term_id')
            ->orderBy('subject_id')
            ->orderBy('section_code')
            ->get();
    }
}
