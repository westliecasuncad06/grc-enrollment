<?php

namespace App\Actions\Enrollment;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Enrollment\EnrollmentSubjectStatus;
use App\Domain\Enrollment\QueueTicketStatus;
use App\Domain\Notifications\NotificationType;
use App\Models\AcademicTerm;
use App\Models\Enrollment;
use App\Models\EnrollmentSubject;
use App\Models\Notification;
use App\Models\QueueTicket;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\DB;

/**
 * DFD 2.4 "Finalize Subject and Generate Queue Ticket" (FR-ENR-007–009):
 * atomically records the verified subject selection as a Pending PEF record
 * and issues one queue ticket. `StoreEnrollmentRequest` has already
 * re-validated every submitted section against a freshly built eligible pool
 * before this executes — this action only writes.
 *
 * All five writes happen in one transaction (FR-ENR-007's "submit
 * atomically" and its acceptance criterion: "exactly one enrollment, the
 * selected enrollment subjects, one queue ticket, one audit entry, and the
 * appropriate notification"). `enrollments.active_academic_term_id`'s
 * generated-column uniqueness constraint is what actually prevents a
 * duplicate active enrollment at the database layer; the Form Request's
 * pre-check exists only to turn that into a clean 422 instead of a raw
 * QueryException.
 */
final readonly class SubmitEnrollment
{
    public function __construct(private AuditRecorder $auditRecorder) {}

    /**
     * @param  list<int>  $sectionIds
     */
    public function execute(
        StudentProfile $student,
        AcademicTerm $term,
        array $sectionIds,
        User $actor,
        AuditRequestContext $context,
    ): Enrollment {
        return DB::transaction(function () use ($student, $term, $sectionIds, $actor, $context): Enrollment {
            $sections = Section::query()->whereIn('id', $sectionIds)->with('subject')->get();
            $totalUnits = (float) $sections->sum(fn (Section $section): float => $section->subject->units);

            $enrollment = Enrollment::create([
                'student_id' => $student->id,
                'academic_term_id' => $term->id,
                'status' => EnrollmentStatus::PendingRegistrarApproval,
                'total_units' => $totalUnits,
                'submitted_at' => now(),
            ]);

            foreach ($sectionIds as $sectionId) {
                EnrollmentSubject::create([
                    'enrollment_id' => $enrollment->id,
                    'section_id' => $sectionId,
                    'status' => EnrollmentSubjectStatus::Selected,
                ]);
            }

            Section::query()->whereIn('id', $sectionIds)->increment('enrolled_count');

            // Opaque per the queue_tickets migration's own docblock: PRD §17
            // leaves the numbering scheme, daily reset, and priority policy
            // unconfirmed. The enrollment ID guarantees the required global
            // uniqueness without asserting any of that unconfirmed policy.
            $queueTicket = QueueTicket::create([
                'enrollment_id' => $enrollment->id,
                'ticket_number' => sprintf('Q%06d', $enrollment->id),
                'queue_date' => now()->toDateString(),
                'status' => QueueTicketStatus::Waiting,
            ]);

            $this->auditRecorder->record(
                $actor,
                AuditAction::ENROLLMENT_SUBMITTED,
                AuditableType::ENROLLMENT,
                $enrollment->id,
                null,
                [
                    'student_id' => $enrollment->student_id,
                    'academic_term_id' => $enrollment->academic_term_id,
                    'section_ids' => $sectionIds,
                    'total_units' => $enrollment->total_units,
                    'queue_ticket_number' => $queueTicket->ticket_number,
                ],
                null,
                $context,
            );

            Notification::create([
                'user_id' => $actor->id,
                'type' => NotificationType::EnrollmentSubmitted,
                'message' => sprintf(
                    'Your enrollment for %s %s has been submitted and is pending registrar approval. Queue ticket: %s.',
                    $term->school_year,
                    $term->semester,
                    $queueTicket->ticket_number,
                ),
            ]);

            return $enrollment->refresh()->load(['enrollmentSubjects.section.subject', 'queueTicket']);
        });
    }
}
