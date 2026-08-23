<?php

namespace App\Actions\Enrollment;

use App\Models\QueueCycle;
use App\Models\QueueTicket;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * PRD §5.3 FR-FIN-006: Accounting Staff's operational view of the payment
 * queue. `cycle=open` scopes to the single currently-open `queue_cycles`
 * row — the current line, which may span multiple Manila service days
 * once a cut-off has carried tickets forward (see docs/superpowers/specs/
 * 2026-08-23-queue-kiosk-claim-carryover-cutoff-design.md). `queue_date`
 * remains available as an independent "claimed on this date" filter, no
 * longer the scope key.
 *
 * Ordered deterministically by `queue_date` then the ticket's effective
 * order (`COALESCE(requeued_at, created_at)`, then the requeued-regime
 * split, then `id`) -- plain arrival order for a never-skipped ticket, or
 * requeue order for one that was skipped. §17 leaves any reset or priority
 * policy unconfirmed, so no priority-tier ordering is asserted at this
 * list level (the Cashier's own waiting-line display sorts by priority
 * tier itself; see `byQueueOrder` in `accounting-payment-workspace.tsx`).
 *
 * A tie on that effective order (routine under a fast test suite, and not
 * impossible at a real front desk, since `created_at`/`requeued_at` are
 * whole-second columns) can't be broken by `id` alone: a low-id ticket
 * requeued after a higher-id ticket already exists must now sort *after*
 * it, which a plain `id` comparison gets backwards. So the tie first
 * splits on `requeued_at IS NOT NULL` -- never-requeued (arrival order)
 * always precedes requeued (skip moment) -- and only falls back to `id`
 * once both candidates agree on that split. This mirrors
 * `QueueTicket::position()`'s own tie-break exactly, so the two never
 * disagree on the order of the same pair of tickets.
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
        $cycle = isset($filters['cycle']) ? (string) $filters['cycle'] : null;
        $page = isset($filters['page']) ? (int) $filters['page'] : 1;
        $perPage = isset($filters['per_page']) ? (int) $filters['per_page'] : 20;

        $openCycleId = $cycle === 'open' ? QueueCycle::query()->whereNull('closed_at')->value('id') : null;

        return QueueTicket::query()
            ->with(['enrollment.student'])
            ->when($queueDate !== null, fn ($query) => $query->whereDate('queue_date', $queueDate))
            ->when($status !== null, fn ($query) => $query->where('status', $status))
            ->when($cycle === 'open', function ($query) use ($openCycleId) {
                if ($openCycleId === null) {
                    // No open cycle exists (fresh install, or everything has
                    // drained) -- the correct answer is an empty list, never
                    // every historical ticket. `whereRaw` guarantees this
                    // regardless of how Eloquent would otherwise translate a
                    // null comparison.
                    $query->whereRaw('1 = 0');

                    return;
                }

                $query->where('queue_cycle_id', $openCycleId);
            })
            ->orderBy('queue_date')
            ->orderByRaw('COALESCE(requeued_at, created_at)')
            ->orderByRaw('requeued_at IS NOT NULL')
            ->orderBy('id')
            ->paginate($perPage, ['*'], 'page', $page)
            ->withQueryString();
    }
}
