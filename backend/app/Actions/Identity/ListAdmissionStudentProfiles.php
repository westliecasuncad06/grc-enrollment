<?php

namespace App\Actions\Identity;

use App\Models\StudentProfile;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

final class ListAdmissionStudentProfiles
{
    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, StudentProfile>
     */
    public function handle(array $filters): LengthAwarePaginator
    {
        $search = trim((string) ($filters['search'] ?? ''));
        $page = (int) ($filters['page'] ?? 1);
        $perPage = (int) ($filters['per_page'] ?? 20);

        return StudentProfile::query()
            ->with(['user', 'program', 'curriculum'])
            ->withExists('enrollments')
            ->when($search !== '', function (Builder $query) use ($search): void {
                $pattern = '%'.$search.'%';

                $query->where(function (Builder $searchQuery) use ($pattern): void {
                    $searchQuery
                        ->where('student_number', 'like', $pattern)
                        ->orWhereHas('user', fn (Builder $userQuery): Builder => $userQuery
                            ->where('name', 'like', $pattern)
                            ->orWhere('email', 'like', $pattern));
                });
            })
            ->orderBy('student_number')
            ->orderBy('id')
            ->paginate($perPage, ['*'], 'page', $page)
            ->withQueryString();
    }
}
