<?php

namespace App\Actions\Enrollment;

use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Enrollment\QueueCycleStatus;
use App\Domain\Enrollment\QueueTicketPriority;
use App\Domain\Enrollment\QueueTicketStatus;
use App\Domain\Enrollment\StudentQueueView;
use App\Domain\Organization\AcademicTermStatus;
use App\Models\AcademicTerm;
use App\Models\Enrollment;
use App\Models\QueueCycle;
use App\Models\QueueTicket;
use App\Models\StudentProfile;
use App\Models\User;

/**
 * Read-only aggregate for the student's own "where am I in the queue" view
 * (PRD §5.3 FR-FIN-006). `upcomingTicketNumbers` never exposes another
 * student's identity — only ticket numbers, the same privacy convention
 * `QueueTicket::position()` already follows for "how many ahead of me".
 */
final readonly class BuildStudentQueueView
{
    private const UPCOMING_LIMIT = 10;

    public function execute(User $actor): StudentQueueView
    {
        $student = StudentProfile::query()->where('user_id', $actor->id)->first();
        $term = AcademicTerm::query()->where('status', AcademicTermStatus::SemesterOngoing)->first();

        $enrollment = ($student === null || $term === null) ? null : Enrollment::query()
            ->with('queueTicket')
            ->where('student_id', $student->id)
            ->where('academic_term_id', $term->id)
            ->orderByDesc('id')
            ->first();

        $stage = $this->stageFor($enrollment);
        $ticket = $enrollment?->queueTicket;
        $canClaim = $stage === 'pending_payment' && $ticket === null;

        $openCycle = QueueCycle::query()->whereNull('closed_at')->first();

        $nowServingTicketNumber = $openCycle === null ? null : QueueTicket::query()
            ->where('queue_cycle_id', $openCycle->id)
            ->where('status', QueueTicketStatus::Serving)
            ->value('ticket_number');

        $upcomingTicketNumbers = $openCycle === null ? [] : $this->upcomingTicketNumbers($openCycle->id);
        $cutOffToday = $openCycle !== null && $openCycle->status() === QueueCycleStatus::CutOff;

        return new StudentQueueView($stage, $canClaim, $ticket, $nowServingTicketNumber, $upcomingTicketNumbers, $cutOffToday);
    }

    private function stageFor(?Enrollment $enrollment): string
    {
        if ($enrollment === null) {
            return 'no_active_enrollment';
        }

        return match ($enrollment->status) {
            EnrollmentStatus::Draft, EnrollmentStatus::PendingRegistrarApproval => 'pending_registrar_approval',
            EnrollmentStatus::PendingPayment => 'pending_payment',
            EnrollmentStatus::Enrolled => 'enrolled',
            EnrollmentStatus::Rejected, EnrollmentStatus::Cancelled, EnrollmentStatus::Withdrawn => 'no_active_enrollment',
        };
    }

    /**
     * @return list<string>
     */
    private function upcomingTicketNumbers(int $openCycleId): array
    {
        $orderedWaiting = fn (QueueTicketPriority $priority) => QueueTicket::query()
            ->where('queue_cycle_id', $openCycleId)
            ->where('status', QueueTicketStatus::Waiting)
            ->where('priority', $priority)
            ->orderBy('queue_date')
            ->orderByRaw('COALESCE(requeued_at, created_at)')
            ->orderByRaw('requeued_at IS NOT NULL')
            ->orderBy('id');

        $priorityNumbers = $orderedWaiting(QueueTicketPriority::Priority)
            ->limit(self::UPCOMING_LIMIT)
            ->pluck('ticket_number')
            ->all();

        $remaining = self::UPCOMING_LIMIT - count($priorityNumbers);

        $regularNumbers = $remaining > 0
            ? $orderedWaiting(QueueTicketPriority::Regular)->limit($remaining)->pluck('ticket_number')->all()
            : [];

        // array_values(array_map(...)) is not decorative: pluck('ticket_number')
        // ->all() is typed array<mixed>, which static analysis cannot narrow to
        // a list<string> on its own — the same convention BuildEligibleSubjectPool
        // ::siblingSubjectIds() uses for the identical shape.
        return array_values(array_map(
            static fn (mixed $ticketNumber): string => (string) $ticketNumber,
            [...$priorityNumbers, ...$regularNumbers],
        ));
    }
}
