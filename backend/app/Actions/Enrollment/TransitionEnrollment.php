<?php

namespace App\Actions\Enrollment;

use App\Actions\Billing\AssessEnrollment;
use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Notifications\NotificationType;
use App\Models\Assessment;
use App\Models\Enrollment;
use App\Models\Notification;
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
 */
final class TransitionEnrollment
{
    /**
     * @var array<string, EnrollmentStatus>
     */
    private const TARGET_STATUS = [
        'registrar_approve' => EnrollmentStatus::PendingPayment,
        'registrar_reject' => EnrollmentStatus::Rejected,
        'void' => EnrollmentStatus::Cancelled,
    ];

    /**
     * @var array<string, EnrollmentStatus>
     */
    private const REQUIRED_CURRENT_STATUS = [
        'registrar_approve' => EnrollmentStatus::PendingRegistrarApproval,
        'registrar_reject' => EnrollmentStatus::PendingRegistrarApproval,
        'void' => EnrollmentStatus::PendingPayment,
    ];

    /**
     * @var array<string, string>
     */
    private const AUDIT_ACTION = [
        'registrar_approve' => AuditAction::ENROLLMENT_REGISTRAR_APPROVED,
        'registrar_reject' => AuditAction::ENROLLMENT_REGISTRAR_REJECTED,
        'void' => AuditAction::ENROLLMENT_VOIDED,
    ];

    /**
     * @var array<string, NotificationType>
     */
    private const NOTIFICATION_TYPE = [
        'registrar_approve' => NotificationType::EnrollmentRegistrarApproved,
        'registrar_reject' => NotificationType::EnrollmentRegistrarRejected,
        'void' => NotificationType::EnrollmentVoided,
    ];

    private const REASON_REQUIRED_ACTIONS = ['registrar_reject', 'void'];

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

        return DB::transaction(function () use ($enrollment, $action, $actingUser, $reason, $context): Enrollment {
            $lockedEnrollment = Enrollment::query()
                ->whereKey($enrollment->id)
                ->lockForUpdate()
                ->firstOrFail();
            $requiredStatus = self::REQUIRED_CURRENT_STATUS[$action];

            if ($lockedEnrollment->status !== $requiredStatus) {
                throw ValidationException::withMessages([
                    'action' => "This action requires the enrollment to currently be '{$requiredStatus->value}'; ".
                        "it is currently '{$lockedEnrollment->status->value}'.",
                ]);
            }

            $beforeValues = self::snapshot($lockedEnrollment);

            $lockedEnrollment->update([
                'status' => self::TARGET_STATUS[$action],
                'registrar_decided_at' => now(),
            ]);
            $lockedEnrollment->refresh();

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
                self::auditAfterValues($afterValues, $assessment),
                $auditReason,
                $context,
            );

            Notification::create([
                'user_id' => $lockedEnrollment->student->user_id,
                'type' => self::NOTIFICATION_TYPE[$action],
                'message' => self::notificationMessage($action, $lockedEnrollment, $reason),
            ]);

            return $lockedEnrollment->refresh()->load([
                'student', 'enrollmentSubjects.section.subject', 'queueTicket', 'assessment.items',
            ]);
        });
    }

    /**
     * @param  array{student_id: int, academic_term_id: int, status: string, registrar_decided_at: ?string}  $afterValues
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
            'registrar_approve' => 'Your enrollment has been approved by the Registrar and is now pending payment. Visit the Cashier to claim your queue ticket.',
            'registrar_reject' => "Your enrollment was rejected by the Registrar. Reason: {$reason}",
            'void' => "Your enrollment has been voided by the Registrar. Reason: {$reason}",
            default => 'Your enrollment status has changed.',
        };
    }

    /**
     * @return array{student_id: int, academic_term_id: int, status: string, registrar_decided_at: ?string}
     */
    private static function snapshot(Enrollment $enrollment): array
    {
        return [
            'student_id' => $enrollment->student_id,
            'academic_term_id' => $enrollment->academic_term_id,
            'status' => $enrollment->status->value,
            'registrar_decided_at' => $enrollment->registrar_decided_at?->utc()->format('Y-m-d\TH:i:s\Z'),
        ];
    }
}
