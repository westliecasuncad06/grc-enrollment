<?php

namespace App\Actions\Enrollment;

use App\Models\Enrollment;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * PRD §5.3 FR-FIN-001 (Registrar approval queue with filters/pagination) and
 * FR-FIN-005 (Accounting sees only `pending_payment`). `Enrollment::scopeVisibleTo`
 * resolves "which rows" per role; this Action applies the optional filters on
 * top and paginates, the same shape as `App\Actions\Audit\ListAuditLogs`.
 */
final readonly class ListEnrollments
{
    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Enrollment>
     */
    public function execute(User $actor, array $filters): LengthAwarePaginator
    {
        $status = isset($filters['status']) ? (string) $filters['status'] : null;
        $academicTermId = isset($filters['academic_term_id']) ? (int) $filters['academic_term_id'] : null;
        $page = isset($filters['page']) ? (int) $filters['page'] : 1;
        $perPage = isset($filters['per_page']) ? (int) $filters['per_page'] : 20;

        return Enrollment::query()
            ->visibleTo($actor)
            ->with(['student', 'enrollmentSubjects.section.subject', 'queueTicket', 'assessment.items'])
            ->when($status !== null, fn ($query) => $query->where('status', $status))
            ->when($academicTermId !== null, fn ($query) => $query->where('academic_term_id', $academicTermId))
            ->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->paginate($perPage, ['*'], 'page', $page)
            ->withQueryString();
    }
}
