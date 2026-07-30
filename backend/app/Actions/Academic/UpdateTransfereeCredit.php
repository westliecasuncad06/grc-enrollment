<?php

namespace App\Actions\Academic;

use App\Domain\Academic\TransfereeCreditStatus;
use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Notifications\NotificationType;
use App\Models\Notification;
use App\Models\TransfereeCredit;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * One route serves two concerns, the same shape `UpdateAcademicGrade`
 * established:
 *
 *   - No `action`: Registrar Staff corrects a content field — allowed only
 *     while the credit is still `pending`.
 *   - `action: approve|reject`: a pure status transition, re-checked here
 *     under a row lock as defense in depth even though
 *     `UpdateTransfereeCreditRequest` already checked it. Neither transition
 *     touches any other table — approving a credit records that it is
 *     credited; it does not feed `BuildEligibleSubjectPool` (PRD §17 leaves
 *     cross-institution grade equivalence unresolved; see
 *     `TransfereeCredit::scopeVisibleTo`'s docblock).
 */
final readonly class UpdateTransfereeCredit
{
    /**
     * @var array<string, TransfereeCreditStatus>
     */
    private const TARGET_STATUS = [
        'approve' => TransfereeCreditStatus::Approved,
        'reject' => TransfereeCreditStatus::Rejected,
    ];

    /**
     * @var array<string, string>
     */
    private const AUDIT_ACTION = [
        'approve' => AuditAction::TRANSFEREE_CREDIT_APPROVED,
        'reject' => AuditAction::TRANSFEREE_CREDIT_REJECTED,
    ];

    /**
     * @var array<string, NotificationType>
     */
    private const NOTIFICATION_TYPE = [
        'approve' => NotificationType::TransfereeCreditApproved,
        'reject' => NotificationType::TransfereeCreditRejected,
    ];

    private const REASON_REQUIRED_ACTIONS = ['reject'];

    public function __construct(private AuditRecorder $auditRecorder) {}

    /**
     * @param  array<string, mixed>  $validated
     */
    public function execute(TransfereeCredit $credit, array $validated, User $actor, AuditRequestContext $context): TransfereeCredit
    {
        $action = $validated['action'] ?? null;

        if (is_string($action) && isset(self::TARGET_STATUS[$action])) {
            return $this->transition($credit, $action, $actor, $validated['reason'] ?? null, $context);
        }

        return $this->updateContent($credit, $validated, $actor, $context);
    }

    private function transition(TransfereeCredit $credit, string $action, User $actor, ?string $reason, AuditRequestContext $context): TransfereeCredit
    {
        return DB::transaction(function () use ($credit, $action, $actor, $reason, $context): TransfereeCredit {
            $lockedCredit = TransfereeCredit::query()->whereKey($credit->id)->lockForUpdate()->firstOrFail();

            if ($lockedCredit->status !== TransfereeCreditStatus::Pending) {
                throw ValidationException::withMessages([
                    'action' => 'This action requires the transferee credit to currently be '.
                        "'pending'; it is currently '{$lockedCredit->status->value}'.",
                ]);
            }

            $beforeValues = self::snapshot($lockedCredit);

            $lockedCredit->update([
                'status' => self::TARGET_STATUS[$action],
                'processed_by' => $actor->id,
                'processed_at' => now(),
            ]);
            $lockedCredit->refresh();

            $auditReason = in_array($action, self::REASON_REQUIRED_ACTIONS, true) ? $reason : null;

            $this->auditRecorder->record(
                $actor,
                self::AUDIT_ACTION[$action],
                AuditableType::TRANSFEREE_CREDIT,
                $lockedCredit->id,
                $beforeValues,
                self::snapshot($lockedCredit),
                $auditReason,
                $context,
            );

            Notification::create([
                'user_id' => $lockedCredit->student->user_id,
                'type' => self::NOTIFICATION_TYPE[$action],
                'message' => self::notificationMessage($action, $reason),
            ]);

            return $lockedCredit->refresh()->load(['student', 'subject']);
        });
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function updateContent(TransfereeCredit $credit, array $validated, User $actor, AuditRequestContext $context): TransfereeCredit
    {
        return DB::transaction(function () use ($credit, $validated, $actor, $context): TransfereeCredit {
            $lockedCredit = TransfereeCredit::query()->whereKey($credit->id)->lockForUpdate()->firstOrFail();

            if ($lockedCredit->status !== TransfereeCreditStatus::Pending) {
                throw ValidationException::withMessages([
                    'source_institution' => "This transferee credit is '{$lockedCredit->status->value}' and can no longer be edited directly.",
                ]);
            }

            $beforeValues = self::snapshot($lockedCredit);

            $lockedCredit->update([
                'source_institution' => $validated['source_institution'] ?? $lockedCredit->source_institution,
                'source_subject_code' => $validated['source_subject_code'] ?? $lockedCredit->source_subject_code,
                'source_subject_title' => $validated['source_subject_title'] ?? $lockedCredit->source_subject_title,
                'source_grade' => array_key_exists('source_grade', $validated) ? $validated['source_grade'] : $lockedCredit->source_grade,
                'credited_units' => $validated['credited_units'] ?? $lockedCredit->credited_units,
                'subject_id' => array_key_exists('subject_id', $validated) ? $validated['subject_id'] : $lockedCredit->subject_id,
            ]);
            $lockedCredit->refresh();

            $this->auditRecorder->record(
                $actor,
                AuditAction::TRANSFEREE_CREDIT_UPDATED,
                AuditableType::TRANSFEREE_CREDIT,
                $lockedCredit->id,
                $beforeValues,
                self::snapshot($lockedCredit),
                null,
                $context,
            );

            return $lockedCredit->refresh()->load(['student', 'subject']);
        });
    }

    private static function notificationMessage(string $action, ?string $reason): string
    {
        return match ($action) {
            'approve' => 'Your transferee credit has been approved.',
            'reject' => "Your transferee credit was not approved. Reason: {$reason}",
            default => 'Your transferee credit status has changed.',
        };
    }

    /**
     * @return array{status: string, credited_units: int, subject_id: ?int}
     */
    private static function snapshot(TransfereeCredit $credit): array
    {
        return [
            'status' => $credit->status->value,
            'credited_units' => $credit->credited_units,
            'subject_id' => $credit->subject_id,
        ];
    }
}
