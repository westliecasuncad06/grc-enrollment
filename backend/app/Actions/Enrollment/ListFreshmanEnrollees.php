<?php

namespace App\Actions\Enrollment;

use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Identity\StudentType;
use App\Models\AccountPayment;
use App\Models\Payment;
use App\Models\StudentProfile;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/**
 * The Registrar's read-only list of freshmen who pay first (ADR 0043): enrolled, waiting
 * for a section to open, enrolling in the section that opened (awaiting Registrar Staff
 * approval), or not yet paid. It reads only; it changes nothing.
 *
 * Each row carries what the freshman has paid in total — the first payment recorded on
 * their enrollment plus any held credit — as aggregate sub-selects, so a page costs a
 * fixed number of queries however many freshmen it holds.
 */
final readonly class ListFreshmanEnrollees
{
    public const STATUSES = ['enrolled', 'enrolling', 'awaiting_section', 'awaiting_payment'];

    private const TERMINAL = [EnrollmentStatus::Rejected->value, EnrollmentStatus::Cancelled->value, EnrollmentStatus::Withdrawn->value];

    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, StudentProfile>
     */
    public function execute(array $filters): LengthAwarePaginator
    {
        $status = isset($filters['status']) ? (string) $filters['status'] : null;
        $search = trim((string) ($filters['search'] ?? ''));
        $page = (int) ($filters['page'] ?? 1);
        $perPage = (int) ($filters['per_page'] ?? 20);

        $enrollmentPaid = Payment::query()
            ->selectRaw('COALESCE(SUM(payments.amount), 0)')
            ->join('enrollments', 'enrollments.id', '=', 'payments.enrollment_id')
            ->whereColumn('enrollments.student_id', 'student_profiles.id');
        $heldOrApplied = AccountPayment::query()
            ->selectRaw('COALESCE(SUM(account_payments.amount), 0)')
            ->whereColumn('account_payments.student_id', 'student_profiles.id');

        return StudentProfile::query()
            ->select('student_profiles.*')
            ->selectSub($enrollmentPaid, 'enrollment_paid')
            ->selectSub($heldOrApplied, 'account_paid')
            ->where('student_profiles.student_type', StudentType::Freshman->value)
            ->with([
                'user',
                'program',
                'queueTicket',
                'enrollments' => fn ($enrollments) => $enrollments
                    ->whereNotIn('status', self::TERMINAL)
                    ->with('enrollmentSubjects.section')
                    ->orderByDesc('id'),
            ])
            ->when($status !== null, fn (Builder $query) => $this->filterByStatus($query, (string) $status))
            ->when($search !== '', function (Builder $query) use ($search): void {
                $pattern = '%'.$search.'%';
                $query->where(function (Builder $searchQuery) use ($pattern): void {
                    $searchQuery
                        ->where('student_profiles.student_number', 'like', $pattern)
                        ->orWhereHas('user', fn (Builder $userQuery): Builder => $userQuery->where('name', 'like', $pattern));
                });
            })
            ->orderByDesc('student_profiles.freshman_payment_confirmed_at')
            ->orderBy('student_profiles.student_number')
            ->orderBy('student_profiles.id')
            ->paginate($perPage, ['*'], 'page', $page)
            ->withQueryString();
    }

    /**
     * @param  Builder<StudentProfile>  $query
     * @return Builder<StudentProfile>
     */
    private function filterByStatus(Builder $query, string $status): Builder
    {
        return match ($status) {
            'awaiting_payment' => $query->whereNull('student_profiles.freshman_payment_confirmed_at'),
            'enrolled' => $this->paid($query)->whereHas('enrollments', fn ($e) => $e->where('status', EnrollmentStatus::Enrolled->value)),
            'enrolling' => $this->paid($query)
                ->whereDoesntHave('enrollments', fn ($e) => $e->where('status', EnrollmentStatus::Enrolled->value))
                ->whereHas('enrollments', fn ($e) => $e->whereNotIn('status', self::TERMINAL)),
            'awaiting_section' => $this->paid($query)->whereDoesntHave('enrollments', fn ($e) => $e->whereNotIn('status', self::TERMINAL)),
            default => $query,
        };
    }

    /**
     * @param  Builder<StudentProfile>  $query
     * @return Builder<StudentProfile>
     */
    private function paid(Builder $query): Builder
    {
        return $query->whereNotNull('student_profiles.freshman_payment_confirmed_at');
    }
}
