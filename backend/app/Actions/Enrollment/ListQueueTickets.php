<?php

namespace App\Actions\Enrollment;

use App\Models\QueueTicket;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * PRD §5.3 FR-FIN-006: Accounting Staff's operational view of the payment
 * queue, ordered deterministically by `queue_date` then the ticket's
 * effective order (`COALESCE(requeued_at, created_at)`, then `id`) --
 * plain arrival order for a never-skipped ticket, or requeue order for one
 * that was skipped. §17 leaves any reset or priority policy unconfirmed,
 * so no priority-tier ordering is asserted at this list level (the
 * Cashier's own waiting-line display sorts by priority tier itself; see
 * `byQueueOrder` in `accounting-payment-workspace.tsx`).
 */
final readonly class ListQueueTickets
{
    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, QueueTicket>
     */
    public function execute(array $filters): LengthAwarePaginator
    {
        $queueDate = isset($filters['queue_date']) ? (string) $filters['queue_date'] : null;
        $status = isset($filters['status']) ? (string) $filters['status'] : null;
        $page = isset($filters['page']) ? (int) $filters['page'] : 1;
        $perPage = isset($filters['per_page']) ? (int) $filters['per_page'] : 20;

        return QueueTicket::query()
            ->with(['enrollment.student'])
            ->when($queueDate !== null, fn ($query) => $query->whereDate('queue_date', $queueDate))
            ->when($status !== null, fn ($query) => $query->where('status', $status))
            ->orderBy('queue_date')
            ->orderByRaw('COALESCE(requeued_at, created_at)')
            ->orderBy('id')
            ->paginate($perPage, ['*'], 'page', $page)
            ->withQueryString();
    }
}
