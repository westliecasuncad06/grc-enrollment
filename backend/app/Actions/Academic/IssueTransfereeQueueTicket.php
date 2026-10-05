<?php

namespace App\Actions\Academic;

use App\Actions\Enrollment\IssueFreshmanQueueTicket;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Enrollment\IssuedFreshmanQueueTicket;
use App\Domain\Enrollment\QueueLinkOutbox;
use App\Domain\Identity\StudentType;
use App\Domain\Notifications\NotificationType;
use App\Models\Notification;
use App\Models\QueueTicket;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Gives a transferee their queue number the moment their credit mapping has
 * nothing left open (ADR 0043, amended 2026-10-05): at least one submitted credit
 * and none `pending` or `endorsed`, which is the same test the enrollment gate
 * uses (`EvaluateCreditMappingStatus`). Called from inside the transaction of
 * every step that can close the last open row (the Registrar Head's approve or
 * reject, the Program Chair's decline, approve-all), so the decision and the
 * ticket stand or fall together.
 *
 * The ticket belongs to the student profile, like a freshman's, and draws from the
 * same open cycle and `Q%03d` sequence (`IssueFreshmanQueueTicket`). It is issued
 * once: a profile that already holds a ticket, has already paid, or is not a
 * transferee gets nothing, so every repeat and every race is a no-op. The new
 * ticket's plain link token goes to the outbox for the controller to email after
 * commit; this action only writes the in-app notice.
 */
final readonly class IssueTransfereeQueueTicket
{
    public function __construct(
        private IssueFreshmanQueueTicket $issueTicket,
        private EvaluateCreditMappingStatus $evaluateCreditMappingStatus,
    ) {}

    public function whenMappingCloses(
        StudentProfile $student,
        User $actor,
        AuditRequestContext $context,
        ?QueueLinkOutbox $outbox = null,
    ): ?IssuedFreshmanQueueTicket {
        return DB::transaction(function () use ($student, $actor, $context, $outbox): ?IssuedFreshmanQueueTicket {
            // The same lock `ConfirmFreshmanPayment` takes: serializes the ticket with the first payment.
            $locked = StudentProfile::query()->whereKey($student->id)->lockForUpdate()->firstOrFail();

            if ($locked->student_type !== StudentType::Transferee
                || $locked->freshman_payment_confirmed_at !== null
                || QueueTicket::query()->where('student_profile_id', $locked->id)->exists()
                || ! $this->evaluateCreditMappingStatus->execute($locked)->isCompleted) {
                return null;
            }

            $issued = $this->issueTicket->execute($locked, $actor, $context, source: 'transferee_credit_mapping_closed');

            Notification::create([
                'user_id' => $locked->user_id,
                'type' => NotificationType::TransfereeQueueNumberIssued,
                'message' => "Your credit mapping is done. Your queue number is {$issued->ticket->ticket_number}. ".
                    'Choose your subjects on the Enrollment page, then pay at the Cashier with this number; the Registrar approves once you have paid.',
            ]);

            $outbox?->add($issued);

            return $issued;
        });
    }
}
