<?php

namespace App\Models;

use App\Domain\Enrollment\QueueTicketPriority;
use App\Domain\Enrollment\QueueTicketStatus;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $enrollment_id
 * @property string $ticket_number
 * @property CarbonImmutable $queue_date
 * @property QueueTicketStatus $status
 * @property QueueTicketPriority $priority
 * @property ?CarbonImmutable $served_at
 * @property ?int $served_by
 * @property ?CarbonImmutable $requeued_at
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read Enrollment $enrollment
 * @property-read ?User $server
 */
final class QueueTicket extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'enrollment_id',
        'ticket_number',
        'queue_date',
        'status',
        'priority',
        'served_at',
        'served_by',
        'requeued_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => QueueTicketStatus::class,
            'priority' => QueueTicketPriority::class,
            'queue_date' => 'immutable_date',
            'served_at' => 'immutable_datetime',
            'requeued_at' => 'immutable_datetime',
        ];
    }

    /**
     * @return BelongsTo<Enrollment, $this>
     */
    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }

    /**
     * The Accounting Staff member who called this ticket. Deliberately
     * never exposed via `QueueTicketResource` — actor identity is never
     * rendered to students, the same privacy convention every audited
     * action in this codebase follows.
     *
     * @return BelongsTo<User, $this>
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(User::class, 'served_by');
    }

    /**
     * The instant this ticket sorts by within its priority tier:
     * `requeued_at` if it's ever been skipped, otherwise `created_at`.
     * `created_at` is not cast in `casts()` (only `served_at`/`requeued_at`
     * are), so it comes back as a plain `Illuminate\Support\Carbon`, not a
     * `CarbonImmutable` — hence the `CarbonInterface` return type, which
     * both implement and which is all `format()` below needs. The final
     * `?? CarbonImmutable::now()` only matters for an unsaved, not-yet-
     * persisted model (no real `queue_tickets` row ever lacks
     * `created_at`) — treating that edge case as "sorts as if issued right
     * now" is honest and safe, not a behavior change for any real ticket.
     */
    private function effectiveOrder(): CarbonInterface
    {
        return $this->requeued_at ?? $this->created_at ?? CarbonImmutable::now();
    }

    /**
     * How many other `waiting` tickets stand ahead of this one today — the
     * whole queue is never exposed to a student (privacy), only their own
     * count. `null` once this ticket has left `waiting` (position no
     * longer means anything for a ticket already being served or done).
     * Priority tickets always precede regular ones within the same day;
     * within a tier, ordered by `effectiveOrder()` -- arrival order for a
     * never-skipped ticket, or the moment it was last requeued for one
     * that was.
     *
     * `created_at`/`requeued_at` are whole-second `timestamp` columns
     * (Eloquent truncates any sub-second precision on write regardless of
     * column precision, so widening them buys nothing), which means two
     * events landing in the same wall-clock second -- routine under a fast
     * test suite, and not impossible at a real front desk -- tie on
     * `COALESCE(...)` alone. `id` can't be the *whole* tiebreak for that
     * tie: a low-id ticket requeued after a higher-id ticket already
     * exists must now sort *after* it, which a plain `id` comparison gets
     * backwards. So a tie first splits on `requeued_at IS NOT NULL` --
     * never-requeued (arrival order) always precedes requeued (skip
     * moment) -- and only falls back to `id` once both candidates agree on
     * that split, i.e. a true same-instant tie within one regime.
     */
    public function position(): ?int
    {
        if ($this->status !== QueueTicketStatus::Waiting) {
            return null;
        }

        $waitingOnSameDay = self::query()
            ->where('queue_date', $this->queue_date)
            ->where('status', QueueTicketStatus::Waiting);

        $applyOrderedBefore = function ($query): void {
            $effectiveOrder = $this->effectiveOrder()->format('Y-m-d H:i:s');
            $selfWasRequeued = (int) ($this->requeued_at !== null);

            $query->where(function ($query) use ($effectiveOrder, $selfWasRequeued) {
                $query->whereRaw('COALESCE(requeued_at, created_at) < ?', [$effectiveOrder])
                    ->orWhere(function ($query) use ($effectiveOrder, $selfWasRequeued) {
                        $query->whereRaw('COALESCE(requeued_at, created_at) = ?', [$effectiveOrder])
                            ->where(function ($query) use ($selfWasRequeued) {
                                $query->whereRaw('(requeued_at IS NOT NULL) < ?', [$selfWasRequeued])
                                    ->orWhere(function ($query) use ($selfWasRequeued) {
                                        $query->whereRaw('(requeued_at IS NOT NULL) = ?', [$selfWasRequeued])
                                            ->where('id', '<', $this->id);
                                    });
                            });
                    });
            });
        };

        if ($this->priority === QueueTicketPriority::Priority) {
            $priorityQuery = (clone $waitingOnSameDay)->where('priority', QueueTicketPriority::Priority);
            $applyOrderedBefore($priorityQuery);

            return $priorityQuery->count();
        }

        $priorityAhead = (clone $waitingOnSameDay)
            ->where('priority', QueueTicketPriority::Priority)
            ->count();

        $regularQuery = (clone $waitingOnSameDay)->where('priority', QueueTicketPriority::Regular);
        $applyOrderedBefore($regularQuery);
        $regularAhead = $regularQuery->count();

        return $priorityAhead + $regularAhead;
    }
}
