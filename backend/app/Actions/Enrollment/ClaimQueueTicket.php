<?php

namespace App\Actions\Enrollment;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Enrollment\QueueServiceDate;
use App\Domain\Enrollment\QueueTicketPriority;
use App\Domain\Enrollment\QueueTicketStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Notifications\NotificationType;
use App\Models\Enrollment;
use App\Models\QueueCycle;
use App\Models\QueueTicket;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use App\Support\Notifications\NotificationRecorder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Issues the one queue ticket an approved (`pending_payment`) enrollment
 * may ever hold (`unique(enrollment_id)` on `queue_tickets` makes this
 * idempotent by construction — a repeat claim returns the existing ticket
 * rather than erroring). Replaces the old registrar-approval-time
 * auto-issue (see `TransitionEnrollment`): a student now has no queue
 * number until they claim one, or Accounting Staff issues one on their
 * behalf.
 *
 * Numbering is scoped to the single open `queue_cycles` row, not the
 * calendar day — a cycle can span multiple service days once a cut-off
 * carries unserved tickets forward (see `QueueCycle`). Allocation locks
 * that one row (`lockForUpdate`), never `queue_tickets`, so concurrent
 * claims serialize on a single integer bump rather than a table scan. See
 * docs/superpowers/specs/2026-08-23-queue-kiosk-claim-carryover-cutoff-design.md.
 *
 * `allocate()` self-guards the `pending_payment` status (ADR 0011), the
 * same convention `TransitionEnrollment`/`TransitionQueueTicket`/
 * `TransitionQueueCycle` follow — even though today's only caller
 * (`QueueTicketController::resolveEnrollment()`) already filters to
 * `pending_payment` before ever reaching `execute()`, so this Action stays
 * safe against a future caller (a kiosk-claim slice is expected to call
 * `execute()` directly) that might not.
 */
final readonly class ClaimQueueTicket
{
    private const MAX_ALLOCATION_ATTEMPTS = 3;

    public function __construct(
        private AuditRecorder $auditRecorder,
        private NotificationRecorder $notificationRecorder,
    ) {}

    public function execute(Enrollment $enrollment, User $actor, AuditRequestContext $context): QueueTicket
    {
        $existing = QueueTicket::query()->where('enrollment_id', $enrollment->id)->first();

        if ($existing !== null) {
            return $existing;
        }

        for ($attempt = 1; ; $attempt++) {
            try {
                return DB::transaction(fn (): QueueTicket => $this->allocate($enrollment, $actor, $context));
            } catch (QueryException $exception) {
                // The only unique constraints reachable inside allocate()
                // are queue_cycles_single_open_cycle_unique and
                // (queue_cycle_id, ticket_sequence) — queue_tickets'
                // pre-check above means a duplicate-enrollment collision is
                // also always this: any 23000 here is an allocation
                // collision from a concurrent claim, safe to retry.
                if ($attempt >= self::MAX_ALLOCATION_ATTEMPTS || $exception->getCode() !== '23000') {
                    throw $exception;
                }

                usleep(random_int(2_000, 20_000));
            }
        }
    }

    private function allocate(Enrollment $enrollment, User $actor, AuditRequestContext $context): QueueTicket
    {
        // Re-check inside the transaction: a concurrent claim for the same
        // enrollment may have committed between the pre-check in execute()
        // and this attempt starting.
        $existing = QueueTicket::query()->where('enrollment_id', $enrollment->id)->first();

        if ($existing !== null) {
            return $existing;
        }

        if ($enrollment->status !== EnrollmentStatus::PendingPayment) {
            throw ValidationException::withMessages([
                'enrollment' => "This enrollment is not pending payment; it is currently '{$enrollment->status->value}'.",
            ]);
        }

        $today = QueueServiceDate::today();
        $cycle = QueueCycle::query()->whereNull('closed_at')->lockForUpdate()->first();

        if ($cycle !== null
            && $cycle->last_claimed_on !== null
            && $cycle->last_claimed_on->toDateString() < $today
            && $cycle->isDrained()) {
            $cycle->update(['closed_at' => now()]);
            $this->auditRecorder->record(
                $actor,
                AuditAction::QUEUE_CYCLE_CLOSED,
                AuditableType::QUEUE_CYCLE,
                $cycle->id,
                ['closed_at' => null],
                ['closed_at' => now()->utc()->format('Y-m-d\TH:i:s\Z')],
                null,
                $context,
            );
            $cycle = null;
        }

        if ($cycle === null) {
            // RACE: two claims can both see no open cycle and both INSERT.
            // There is no row to lock, so lockForUpdate() cannot serialize
            // this specific case — the single-open-cycle generated-column
            // unique index is what makes the loser's insert throw 23000;
            // execute()'s retry then finds and locks the winner's row.
            $cycle = QueueCycle::create(['opened_on' => $today, 'last_ticket_sequence' => 0]);
            $cycle = QueueCycle::query()->whereKey($cycle->id)->lockForUpdate()->firstOrFail();
        }

        $sequence = $cycle->last_ticket_sequence + 1;

        $ticket = QueueTicket::create([
            'enrollment_id' => $enrollment->id,
            'queue_cycle_id' => $cycle->id,
            'ticket_sequence' => $sequence,
            'ticket_number' => sprintf('Q%03d', $sequence),
            'queue_date' => $today,
            'status' => QueueTicketStatus::Waiting,
            'priority' => QueueTicketPriority::Regular,
        ]);

        $cycle->update(['last_ticket_sequence' => $sequence, 'last_claimed_on' => $today]);

        $this->auditRecorder->record(
            $actor,
            AuditAction::QUEUE_TICKET_CLAIMED,
            AuditableType::QUEUE_TICKET,
            $ticket->id,
            null,
            ['ticket_number' => $ticket->ticket_number, 'queue_cycle_id' => $cycle->id],
            null,
            $context,
        );

        $this->notificationRecorder->recordManyForRole(
            UserRole::AccountingStaff,
            NotificationType::QueueTicketClaimed,
            "{$enrollment->student->student_number} claimed queue ticket {$ticket->ticket_number}.",
        );

        return $ticket->load(['enrollment.student']);
    }
}
