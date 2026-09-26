<?php

namespace App\Actions\Enrollment;

use App\Actions\Billing\AssessEnrollment;
use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Enrollment\EnrollmentSubjectStatus;
use App\Domain\Enrollment\QueueTicketStatus;
use App\Domain\Notifications\NotificationType;
use App\Models\Assessment;
use App\Models\Enrollment;
use App\Models\EnrollmentSubject;
use App\Models\Notification;
use App\Models\Section;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * Applies one Registrar Head decision to an enrollment (PRD §5.3 FR-FIN-001,
 * FR-FIN-002), following ADR 0011's shape exactly (see
 * `TransitionScheduleProposal`): a `TARGET_STATUS` / `REQUIRED_CURRENT_STATUS`
 * / `AUDIT_ACTION` constant trio, a row lock, and a `ValidationException` when
 * the current status doesn't match.
 *
 * Unlike `schedule_proposals`, the `enrollments` table has no `decided_by` or
 * `decision_reason` column of its own — only `registrar_decided_at`. The
 * reason required for `registrar_reject`/`void` (FR-FIN-002) is recorded
 * solely in the audit row's `reason` column, never on the enrollment itself.
 *
 * `registrar_approve` no longer issues a Cashier queue ticket — that moved
 * to `App\Actions\Enrollment\ClaimQueueTicket`, triggered by the student's
 * own claim (or Accounting Staff issuing one on their behalf) once they
 * are physically at the Cashier, matching the real front-desk process
 * (see docs/superpowers/specs/
 * 2026-08-23-queue-kiosk-claim-carryover-cutoff-design.md). This action
 * only opens the door: `pending_payment` plus an `Assessment`. The
 * Accounting-Staff-facing notification that used to fire here on approval
 * moved with it — `ClaimQueueTicket` fires it at the moment a student
 * actually joins the line, a more useful trigger than the moment they
 * merely become eligible to.
 *
 * Every transition into a terminal state (`rejected`, `cancelled`) gives the
 * enrollment's seats back exactly once: each subject still occupying a seat
 * is marked `dropped` and its section's `enrolled_count` decremented, under
 * the same row locks as the status change, so a repeat cannot release twice.
 * Before this, a rejected or voided enrollment kept its seats forever and a
 * student who re-enrolled counted twice. `student_cancel` (the student's own
 * undo, allowed until the Registrar approves) and `void` (Registrar Staff or
 * Head, any time before payment, ADR 0030) follow the same rule; a voided
 * enrollment's still-waiting queue ticket is cancelled with it.
 */
final class TransitionEnrollment
{
    /**
     * @var array<string, EnrollmentStatus>
     */
    private const TARGET_STATUS = [
        'program_head_approve' => EnrollmentStatus::PendingRegistrarApproval,
        'program_head_reject' => EnrollmentStatus::Rejected,
        'registrar_approve' => EnrollmentStatus::PendingPayment,
        'registrar_reject' => EnrollmentStatus::Rejected,
        'void' => EnrollmentStatus::Cancelled,
        'student_cancel' => EnrollmentStatus::Cancelled,
    ];

    /**
     * @var array<string, list<EnrollmentStatus>>
     */
    private const REQUIRED_CURRENT_STATUSES = [
        'program_head_approve' => [EnrollmentStatus::PendingProgramHeadApproval],
        'program_head_reject' => [EnrollmentStatus::PendingProgramHeadApproval],
        'registrar_approve' => [EnrollmentStatus::PendingRegistrarApproval],
        'registrar_reject' => [EnrollmentStatus::PendingRegistrarApproval],
        // Before payment, at any approval stage. Once enrolled it is a withdrawal.
        'void' => [
            EnrollmentStatus::PendingProgramHeadApproval,
            EnrollmentStatus::PendingRegistrarApproval,
            EnrollmentStatus::PendingPayment,
        ],
        // The student may undo their own choice only until the Registrar approves.
        'student_cancel' => [
            EnrollmentStatus::PendingProgramHeadApproval,
            EnrollmentStatus::PendingRegistrarApproval,
        ],
    ];

    /**
     * @var array<string, string>
     */
    private const AUDIT_ACTION = [
        'program_head_approve' => AuditAction::ENROLLMENT_PROGRAM_HEAD_APPROVED,
        'program_head_reject' => AuditAction::ENROLLMENT_PROGRAM_HEAD_REJECTED,
        'registrar_approve' => AuditAction::ENROLLMENT_REGISTRAR_APPROVED,
        'registrar_reject' => AuditAction::ENROLLMENT_REGISTRAR_REJECTED,
        'void' => AuditAction::ENROLLMENT_VOIDED,
        'student_cancel' => AuditAction::ENROLLMENT_CANCELLED_BY_STUDENT,
    ];

    /**
     * `student_cancel` has no entry: the student just did it, so nobody is
     * notified.
     *
     * @var array<string, NotificationType>
     */
    private const NOTIFICATION_TYPE = [
        'program_head_approve' => NotificationType::EnrollmentProgramHeadApproved,
        'program_head_reject' => NotificationType::EnrollmentProgramHeadRejected,
        'registrar_approve' => NotificationType::EnrollmentRegistrarApproved,
        'registrar_reject' => NotificationType::EnrollmentRegistrarRejected,
        'void' => NotificationType::EnrollmentVoided,
    ];

    private const REASON_REQUIRED_ACTIONS = ['program_head_reject', 'registrar_reject', 'void', 'student_cancel'];

    public function __construct(
        private readonly AuditRecorder $auditRecorder,
        private readonly AssessEnrollment $assessEnrollment,
    ) {}

    public function execute(
        Enrollment $enrollment,
        string $action,
        User $actingUser,
        ?string $reason,
        AuditRequestContext $context,
        bool $requestedByStudent = false,
    ): Enrollment {
        if (! isset(self::TARGET_STATUS[$action])) {
            throw new InvalidArgumentException('Unknown enrollment transition.');
        }

        if (
            in_array($action, self::REASON_REQUIRED_ACTIONS, true)
            && ($reason === null || trim($reason) === '')
        ) {
            throw ValidationException::withMessages([
                'reason' => 'A reason is required for this action.',
            ]);
        }

        return DB::transaction(function () use ($enrollment, $action, $actingUser, $reason, $context, $requestedByStudent): Enrollment {
            $lockedEnrollment = Enrollment::query()
                ->whereKey($enrollment->id)
                ->lockForUpdate()
                ->firstOrFail();
            $requiredStatuses = self::REQUIRED_CURRENT_STATUSES[$action];

            if (! in_array($lockedEnrollment->status, $requiredStatuses, true)) {
                $expected = implode("' or '", array_map(fn (EnrollmentStatus $status): string => $status->value, $requiredStatuses));

                throw ValidationException::withMessages([
                    'action' => "This action requires the enrollment to currently be '{$expected}'; ".
                        "it is currently '{$lockedEnrollment->status->value}'.",
                ]);
            }

            $beforeValues = self::snapshot($lockedEnrollment);

            // The Program Head's decision and the Registrar's are separate
            // moments; `void` is a Registrar-side decision too.
            // The student's own cancellation is a decision by nobody else, so it
            // stamps neither.
            $attributes = ['status' => self::TARGET_STATUS[$action]];
            if ($action !== 'student_cancel') {
                $attributes[str_starts_with($action, 'program_head_') ? 'program_head_decided_at' : 'registrar_decided_at'] = now();
            }

            $lockedEnrollment->update($attributes);
            $lockedEnrollment->refresh();

            $releasedSectionIds = $lockedEnrollment->status->isTerminal()
                ? $this->releaseSeats($lockedEnrollment)
                : [];
            if ($action === 'void') {
                $this->cancelWaitingTicket($lockedEnrollment);
            }

            $afterValues = self::snapshot($lockedEnrollment);
            $auditReason = in_array($action, self::REASON_REQUIRED_ACTIONS, true) ? $reason : null;

            // PRD §5.3 process 3.3 "computes the approved assessment" --
            // done in the same transaction as the status change above, so
            // nothing may reach `pending_payment` without one. Folded into
            // this same audit row's after_values below, not a second row
            // -- see AssessEnrollment's own docblock for why.
            $assessment = $action === 'registrar_approve'
                ? $this->assessEnrollment->execute($lockedEnrollment)
                : null;

            $this->auditRecorder->record(
                $actingUser,
                self::AUDIT_ACTION[$action],
                AuditableType::ENROLLMENT,
                $lockedEnrollment->id,
                $beforeValues,
                [
                    ...self::auditAfterValues($afterValues, $assessment),
                    'released_section_ids' => $releasedSectionIds,
                    ...($action === 'void' ? ['requested_by_student' => $requestedByStudent] : []),
                ],
                $auditReason,
                $context,
            );

            if (isset(self::NOTIFICATION_TYPE[$action])) {
                Notification::create([
                    'user_id' => $lockedEnrollment->student->user_id,
                    'type' => self::NOTIFICATION_TYPE[$action],
                    'message' => self::notificationMessage($action, $lockedEnrollment, $reason),
                ]);
            }

            return $lockedEnrollment->refresh()->load([
                'student', 'enrollmentSubjects.section.subject', 'enrollmentSubjects.section.professor', 'queueTicket', 'assessment.items',
            ]);
        });
    }

    /**
     * Marks every subject still holding a seat `dropped` and gives the seat
     * back, once. The rows are locked first, so a concurrent transition sees
     * them already dropped.
     *
     * @return list<int> the section ids whose seat was released
     */
    private function releaseSeats(Enrollment $enrollment): array
    {
        $released = [];

        EnrollmentSubject::query()
            ->where('enrollment_id', $enrollment->id)
            ->lockForUpdate()
            ->get()
            ->filter(fn (EnrollmentSubject $subject): bool => $subject->status->occupiesSeat())
            ->each(function (EnrollmentSubject $subject) use (&$released): void {
                $subject->update(['status' => EnrollmentSubjectStatus::Dropped]);
                Section::query()->whereKey($subject->section_id)->where('enrolled_count', '>', 0)->decrement('enrolled_count');
                $released[] = $subject->section_id;
            });

        return $released;
    }

    private function cancelWaitingTicket(Enrollment $enrollment): void
    {
        $enrollment->queueTicket()
            ->where('status', QueueTicketStatus::Waiting->value)
            ->update(['status' => QueueTicketStatus::Cancelled->value]);
    }

    /**
     * @param  array{student_id: int, academic_term_id: int, status: string, program_head_decided_at: ?string, registrar_decided_at: ?string}  $afterValues
     * @return array<string, mixed>
     */
    private static function auditAfterValues(array $afterValues, ?Assessment $assessment): array
    {
        if ($assessment !== null) {
            $afterValues = [...$afterValues, 'assessment_total_amount' => $assessment->total_amount, 'assessment_item_count' => $assessment->items->count()];
        }

        return $afterValues;
    }

    private static function notificationMessage(string $action, Enrollment $enrollment, ?string $reason): string
    {
        return match ($action) {
            'program_head_approve' => 'Your Program Head approved your enrollment schedule. It now waits for Registrar approval.',
            'program_head_reject' => "Your enrollment was not approved by your Program Head. Reason: {$reason}",
            'registrar_approve' => 'Your enrollment has been approved by the Registrar and is now pending payment. Visit the Cashier to claim your queue ticket.',
            'registrar_reject' => "Your enrollment was rejected by the Registrar. Reason: {$reason}",
            'void' => "Your enrollment has been voided by the Registrar. Reason: {$reason}",
            default => 'Your enrollment status has changed.',
        };
    }

    /**
     * @return array{student_id: int, academic_term_id: int, status: string, program_head_decided_at: ?string, registrar_decided_at: ?string}
     */
    private static function snapshot(Enrollment $enrollment): array
    {
        return [
            'student_id' => $enrollment->student_id,
            'academic_term_id' => $enrollment->academic_term_id,
            'status' => $enrollment->status->value,
            'program_head_decided_at' => $enrollment->program_head_decided_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'registrar_decided_at' => $enrollment->registrar_decided_at?->utc()->format('Y-m-d\TH:i:s\Z'),
        ];
    }
}
