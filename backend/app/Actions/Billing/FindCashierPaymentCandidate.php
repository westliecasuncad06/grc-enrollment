<?php

namespace App\Actions\Billing;

use App\Domain\Billing\CashierPaymentCandidate;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Enrollment\QueueTicketStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Models\AcademicTerm;
use App\Models\Enrollment;
use App\Models\QueueTicket;
use Illuminate\Database\Eloquent\Builder;
use LogicException;

/**
 * Restricts lookup to a Student who is actionable in the Cashier's current
 * queue. Keeping this a read-only query ensures finding a student can never
 * silently alter ticket order or enrollment/payment state.
 */
final readonly class FindCashierPaymentCandidate
{
    public function execute(string $studentNumber): CashierPaymentCandidate
    {
        $term = AcademicTerm::query()
            ->where('status', AcademicTermStatus::SemesterOngoing)
            ->firstOrFail();
        $queueDate = now()->toDateString();

        $enrollment = Enrollment::query()
            ->with(['student.user', 'queueTicket'])
            ->where('academic_term_id', $term->id)
            ->where('status', EnrollmentStatus::PendingPayment)
            ->whereHas('student', fn (Builder $query) => $query->where('student_number', $studentNumber))
            ->whereHas('queueTicket', fn (Builder $query) => $query
                ->whereDate('queue_date', $queueDate)
                ->whereIn('status', [
                    QueueTicketStatus::Waiting->value,
                    QueueTicketStatus::Serving->value,
                ]))
            ->firstOrFail();

        $ticket = $enrollment->queueTicket;

        if (! $ticket instanceof QueueTicket) {
            throw new LogicException('The eligible Cashier payment candidate must include its queue ticket.');
        }

        return new CashierPaymentCandidate($enrollment->student, $enrollment, $ticket);
    }
}
