<?php

namespace App\Actions\Enrollment;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Enrollment\QueueTicketStatus;
use App\Models\QueueTicket;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * PRD §5.3 FR-FIN-006. Follows ADR 0011's shape: a `TARGET_STATUS` /
 * `REQUIRED_CURRENT_STATUS` / `AUDIT_ACTION` constant trio, a row lock, and
 * a `ValidationException` when the current status doesn't match.
 *
 * §17 leaves reset cadence, priority, and "how many tickets may be
 * `serving` at once" unconfirmed — this Action enforces only the two-step
 * order (`waiting` → `serving` → `served`), never a single-active-ticket
 * rule or any numbering/priority policy. No notification is sent: calling
 * or completing a ticket is Accounting's own operational action, with no
 * live-queue display this slice implements to make a push notification
 * meaningful yet.
 */
final readonly class TransitionQueueTicket
{
    /**
     * @var array<string, QueueTicketStatus>
     */
    private const TARGET_STATUS = [
        'serve' => QueueTicketStatus::Serving,
        'complete' => QueueTicketStatus::Served,
    ];

    /**
     * @var array<string, QueueTicketStatus>
     */
    private const REQUIRED_CURRENT_STATUS = [
        'serve' => QueueTicketStatus::Waiting,
        'complete' => QueueTicketStatus::Serving,
    ];

    /**
     * @var array<string, string>
     */
    private const AUDIT_ACTION = [
        'serve' => AuditAction::QUEUE_TICKET_SERVING_STARTED,
        'complete' => AuditAction::QUEUE_TICKET_SERVED,
    ];

    public function __construct(private AuditRecorder $auditRecorder) {}

    public function execute(QueueTicket $ticket, string $action, User $actor, AuditRequestContext $context): QueueTicket
    {
        if (! isset(self::TARGET_STATUS[$action])) {
            throw new InvalidArgumentException('Unknown queue ticket transition.');
        }

        return DB::transaction(function () use ($ticket, $action, $actor, $context): QueueTicket {
            $lockedTicket = QueueTicket::query()
                ->whereKey($ticket->id)
                ->lockForUpdate()
                ->firstOrFail();
            $requiredStatus = self::REQUIRED_CURRENT_STATUS[$action];

            if ($lockedTicket->status !== $requiredStatus) {
                throw ValidationException::withMessages([
                    'action' => "This action requires the ticket to currently be '{$requiredStatus->value}'; ".
                        "it is currently '{$lockedTicket->status->value}'.",
                ]);
            }

            $beforeValues = self::snapshot($lockedTicket);
            $targetStatus = self::TARGET_STATUS[$action];

            $lockedTicket->update([
                'status' => $targetStatus,
                'served_at' => $targetStatus === QueueTicketStatus::Served ? now() : $lockedTicket->served_at,
            ]);
            $lockedTicket->refresh();

            $this->auditRecorder->record(
                $actor,
                self::AUDIT_ACTION[$action],
                AuditableType::QUEUE_TICKET,
                $lockedTicket->id,
                $beforeValues,
                self::snapshot($lockedTicket),
                null,
                $context,
            );

            return $lockedTicket->refresh()->load(['enrollment.student']);
        });
    }

    /**
     * @return array{status: string, served_at: ?string}
     */
    private static function snapshot(QueueTicket $ticket): array
    {
        return [
            'status' => $ticket->status->value,
            'served_at' => $ticket->served_at?->utc()->format('Y-m-d\TH:i:s\Z'),
        ];
    }
}
