<?php

namespace App\Actions\Enrollment;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Enrollment\QueueTicketPriority;
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
 * §17 leaves reset cadence and priority eligibility unconfirmed — this
 * Action enforces only the three-step order (`waiting` → `serving` →
 * `served`, with `skip` as a `cancelled` exit from either `waiting` or
 * `serving`) and a single-active-serving rule, never any numbering or
 * eligibility policy. No notification is sent: calling, completing, or
 * skipping a ticket is Accounting's own operational action, with no
 * live-queue display this slice implements to make a push notification
 * meaningful yet.
 *
 * `mark_priority` is a separate, non-status-changing write — see its own
 * method below.
 */
final readonly class TransitionQueueTicket
{
    /**
     * @var array<string, QueueTicketStatus>
     */
    private const TARGET_STATUS = [
        'serve' => QueueTicketStatus::Serving,
        'complete' => QueueTicketStatus::Served,
        'skip' => QueueTicketStatus::Cancelled,
    ];

    /**
     * @var array<string, list<QueueTicketStatus>>
     */
    private const REQUIRED_CURRENT_STATUS = [
        'serve' => [QueueTicketStatus::Waiting],
        'complete' => [QueueTicketStatus::Serving],
        'skip' => [QueueTicketStatus::Waiting, QueueTicketStatus::Serving],
    ];

    /**
     * @var array<string, string>
     */
    private const AUDIT_ACTION = [
        'serve' => AuditAction::QUEUE_TICKET_SERVING_STARTED,
        'complete' => AuditAction::QUEUE_TICKET_SERVED,
        'skip' => AuditAction::QUEUE_TICKET_SKIPPED,
    ];

    public function __construct(private AuditRecorder $auditRecorder) {}

    public function execute(QueueTicket $ticket, string $action, User $actor, AuditRequestContext $context): QueueTicket
    {
        if ($action === 'mark_priority') {
            return $this->markPriority($ticket, $actor, $context);
        }

        if (! isset(self::TARGET_STATUS[$action])) {
            throw new InvalidArgumentException('Unknown queue ticket transition.');
        }

        return DB::transaction(function () use ($ticket, $action, $actor, $context): QueueTicket {
            $lockedTicket = QueueTicket::query()
                ->whereKey($ticket->id)
                ->lockForUpdate()
                ->firstOrFail();
            $requiredStatuses = self::REQUIRED_CURRENT_STATUS[$action];

            if (! in_array($lockedTicket->status, $requiredStatuses, true)) {
                $expected = implode("' or '", array_map(
                    fn (QueueTicketStatus $status): string => $status->value,
                    $requiredStatuses,
                ));
                throw ValidationException::withMessages([
                    'action' => "This action requires the ticket to currently be '{$expected}'; ".
                        "it is currently '{$lockedTicket->status->value}'.",
                ]);
            }

            $beforeValues = self::snapshot($lockedTicket);
            $targetStatus = self::TARGET_STATUS[$action];

            if ($action === 'serve') {
                // Single-active-serving: calling a new number implicitly
                // completes whatever was already being served today, rather
                // than requiring the cashier to complete it first. Not
                // separately audited — the same bulk-update-without-per-row
                // -audit precedent ConfirmPayment already uses for
                // EnrollmentSubject transitions.
                QueueTicket::query()
                    ->where('queue_date', $lockedTicket->queue_date)
                    ->where('status', QueueTicketStatus::Serving)
                    ->whereKeyNot($lockedTicket->id)
                    ->update(['status' => QueueTicketStatus::Served, 'served_at' => now()]);
            }

            $lockedTicket->update([
                'status' => $targetStatus,
                'served_at' => $targetStatus === QueueTicketStatus::Served ? now() : $lockedTicket->served_at,
                'served_by' => $action === 'serve' ? $actor->id : $lockedTicket->served_by,
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
     * Marks a ticket `Priority` — a plain ordering flag, not a status
     * transition (see `App\Domain\Enrollment\QueueTicketPriority`'s own
     * docblock for why this never renumbers the ticket). Only from
     * `waiting`: a ticket that's already being served or is done has
     * nothing left to reorder ahead of.
     */
    private function markPriority(QueueTicket $ticket, User $actor, AuditRequestContext $context): QueueTicket
    {
        return DB::transaction(function () use ($ticket, $actor, $context): QueueTicket {
            $lockedTicket = QueueTicket::query()
                ->whereKey($ticket->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedTicket->status !== QueueTicketStatus::Waiting) {
                throw ValidationException::withMessages([
                    'action' => "Priority can only be marked while the ticket is 'waiting'; ".
                        "it is currently '{$lockedTicket->status->value}'.",
                ]);
            }

            $beforeValues = self::snapshot($lockedTicket);

            $lockedTicket->update(['priority' => QueueTicketPriority::Priority]);
            $lockedTicket->refresh();

            $this->auditRecorder->record(
                $actor,
                AuditAction::QUEUE_TICKET_MARKED_PRIORITY,
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
     * @return array{status: string, priority: string, served_at: ?string}
     */
    private static function snapshot(QueueTicket $ticket): array
    {
        return [
            'status' => $ticket->status->value,
            'priority' => $ticket->priority->value,
            'served_at' => $ticket->served_at?->utc()->format('Y-m-d\TH:i:s\Z'),
        ];
    }
}
