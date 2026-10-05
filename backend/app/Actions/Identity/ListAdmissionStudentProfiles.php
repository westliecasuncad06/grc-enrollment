<?php

namespace App\Actions\Identity;

use App\Domain\Enrollment\EnrollmentStatus;
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
            ->with(['user', 'program', 'curriculum', 'queueTicket'])
            ->withExists('enrollments')
            // Read by `StudentProfileResource` for a paid freshman, so a page costs no query per row.
            ->withExists(['enrollments as active_enrollment_exists' => fn (Builder $enrollments) => $enrollments
                ->whereNotIn('status', [EnrollmentStatus::Rejected->value, EnrollmentStatus::Cancelled->value, EnrollmentStatus::Withdrawn->value])])
            ->withSum(['accountPayments as held_advance_payment_sum' => fn (Builder $payments) => $payments->whereNull('enrollment_id')], 'amount')
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
