<?php

namespace App\Models;

use App\Domain\Enrollment\QueueTicketPriority;
use App\Domain\Enrollment\QueueTicketStatus;
use Carbon\CarbonImmutable;
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
     * How many other `waiting` tickets stand ahead of this one today — the
     * whole queue is never exposed to a student (privacy), only their own
     * count. `null` once this ticket has left `waiting` (position no
     * longer means anything for a ticket already being served or done).
     * Priority tickets always precede regular ones within the same day;
     * within a tier, earlier `id` (== earlier issuance) goes first.
     */
    public function position(): ?int
    {
        if ($this->status !== QueueTicketStatus::Waiting) {
            return null;
        }

        $waitingOnSameDay = self::query()
            ->where('queue_date', $this->queue_date)
            ->where('status', QueueTicketStatus::Waiting);

        if ($this->priority === QueueTicketPriority::Priority) {
            return (clone $waitingOnSameDay)
                ->where('priority', QueueTicketPriority::Priority)
                ->where('id', '<', $this->id)
                ->count();
        }

        $priorityAhead = (clone $waitingOnSameDay)
            ->where('priority', QueueTicketPriority::Priority)
            ->count();
        $regularAhead = (clone $waitingOnSameDay)
            ->where('priority', QueueTicketPriority::Regular)
            ->where('id', '<', $this->id)
            ->count();

        return $priorityAhead + $regularAhead;
    }
}
