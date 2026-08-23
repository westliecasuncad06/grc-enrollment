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
 * @property int $queue_cycle_id
 * @property int $ticket_sequence
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
        'queue_cycle_id',
        'ticket_number',
        'ticket_sequence',
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
     * @return BelongsTo<QueueCycle, $this>
     */
    public function cycle(): BelongsTo
    {
        return $this->belongsTo(QueueCycle::class, 'queue_cycle_id');
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
     * How many other `waiting` tickets stand ahead of this one in the
     * current open cycle — the whole queue is never exposed to a student
     * (privacy), only their own count. `null` once this ticket has left
     * `waiting`. Priority tickets always precede regular ones within the
     * same cycle; within a tier, ordered by `queue_date` (a cycle can span
     * multiple Manila service days once a cut-off carries tickets forward
     * — a carry-over always sorts ahead of a same-cycle ticket claimed on a
     * later date), then `COALESCE(requeued_at, created_at)` — arrival
     * order for a never-skipped ticket, or the moment it was last requeued
     * for one that was — with `id` as the final tiebreaker for a true
     * timestamp tie. Mirrors `App\Actions\Enrollment\ListQueueTickets`'s
     * ordering exactly; see docs/superpowers/specs/
     * 2026-08-23-queue-kiosk-claim-carryover-cutoff-design.md for why the
     * `queue_date` term is required once a cycle spans multiple dates.
     */
    public function position(): ?int
    {
        if ($this->status !== QueueTicketStatus::Waiting) {
            return null;
        }

        $waitingInCycle = self::query()
            ->where('queue_cycle_id', $this->queue_cycle_id)
            ->where('status', QueueTicketStatus::Waiting);

        $applyOrderedBefore = function ($query): void {
            $selfDate = $this->queue_date->toDateString();
            $effectiveOrder = $this->effectiveOrder()->format('Y-m-d H:i:s');
            $selfWasRequeued = (int) ($this->requeued_at !== null);

            $query->where(function ($query) use ($selfDate, $effectiveOrder, $selfWasRequeued) {
                $query->where('queue_date', '<', $selfDate)
                    ->orWhere(function ($query) use ($selfDate, $effectiveOrder, $selfWasRequeued) {
                        $query->where('queue_date', $selfDate)
                            ->where(function ($query) use ($effectiveOrder, $selfWasRequeued) {
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
                    });
            });
        };

        if ($this->priority === QueueTicketPriority::Priority) {
            $priorityQuery = (clone $waitingInCycle)->where('priority', QueueTicketPriority::Priority);
            $applyOrderedBefore($priorityQuery);

            return $priorityQuery->count();
        }

        $priorityAhead = (clone $waitingInCycle)
            ->where('priority', QueueTicketPriority::Priority)
            ->count();

        $regularQuery = (clone $waitingInCycle)->where('priority', QueueTicketPriority::Regular);
        $applyOrderedBefore($regularQuery);
        $regularAhead = $regularQuery->count();

        return $priorityAhead + $regularAhead;
    }
}
