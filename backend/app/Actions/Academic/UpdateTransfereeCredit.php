<?php

namespace App\Actions\Academic;

use App\Domain\Academic\TransfereeCreditStatus;
use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Identity\UserRole;
use App\Domain\Notifications\NotificationType;
use App\Models\Notification;
use App\Models\TransfereeCredit;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use App\Support\Notifications\NotificationRecorder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * One route serves every step after a credit exists (ADR 0026). Each step
 * re-checks the credit's status under a row lock, so a repeated or racing
 * request changes nothing a second time:
 *
 *   - No `action`: the Program Chair corrects or maps a credit (`subject_id`,
 *     units, the source details). Only while it is `pending`.
 *   - `endorse` (Program Chair, `pending` → `endorsed`): needs a mapped
 *     subject, which the same request may set. Tells Registrar Staff.
 *   - `decline` (Program Chair, `pending` → `rejected`): needs a reason.
 *     Tells the Student.
 *   - `approve` / `reject` (Registrar Staff, `endorsed` → `approved` /
 *     `rejected`): `reject` needs a reason. Tells the Student. Registrar Staff
 *     never see a credit before it is endorsed and never edit one.
 *
 * Who may do which is `TransfereeCreditPolicy`; the request class checks the
 * status and the reason; this class is the defence in depth under the lock. An
 * approval records that the subject is credited (see
 * `ResolveCreditedSubjectIds`); it writes nothing to any other table.
 */
final readonly class UpdateTransfereeCredit
{
    /** @var array<string, string> */
    private const AUDIT_ACTION = [
        'endorse' => AuditAction::TRANSFEREE_CREDIT_ENDORSED,
        'decline' => AuditAction::TRANSFEREE_CREDIT_REJECTED,
        'approve' => AuditAction::TRANSFEREE_CREDIT_APPROVED,
        'reject' => AuditAction::TRANSFEREE_CREDIT_REJECTED,
    ];

    /** @var array<string, TransfereeCreditStatus> */
    private const TARGET_STATUS = [
        'endorse' => TransfereeCreditStatus::Endorsed,
        'decline' => TransfereeCreditStatus::Rejected,
        'approve' => TransfereeCreditStatus::Approved,
        'reject' => TransfereeCreditStatus::Rejected,
    ];

    /** @var array<string, TransfereeCreditStatus> */
    private const REQUIRED_CURRENT_STATUS = [
        'endorse' => TransfereeCreditStatus::Pending,
        'decline' => TransfereeCreditStatus::Pending,
        'approve' => TransfereeCreditStatus::Endorsed,
        'reject' => TransfereeCreditStatus::Endorsed,
    ];

    public function __construct(
        private AuditRecorder $auditRecorder,
        private NotificationRecorder $notificationRecorder,
    ) {}

    /**
     * @param  array<string, mixed>  $validated
     */
    public function execute(TransfereeCredit $credit, array $validated, User $actor, AuditRequestContext $context): TransfereeCredit
    {
        $action = $validated['action'] ?? null;

        if (is_string($action) && isset(self::TARGET_STATUS[$action])) {
            return $this->transition($credit, $action, $validated, $actor, $context);
        }

        return $this->updateContent($credit, $validated, $actor, $context);
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function transition(TransfereeCredit $credit, string $action, array $validated, User $actor, AuditRequestContext $context): TransfereeCredit
    {
        return DB::transaction(function () use ($credit, $action, $validated, $actor, $context): TransfereeCredit {
            $lockedCredit = TransfereeCredit::query()->whereKey($credit->id)->lockForUpdate()->firstOrFail();
            $lockedCredit->load('student');
            $required = self::REQUIRED_CURRENT_STATUS[$action];

            if ($lockedCredit->status !== $required) {
                throw ValidationException::withMessages([
                    'action' => "This action requires the transferee credit to currently be '{$required->value}'; ".
                        "it is currently '{$lockedCredit->status->value}'.",
                ]);
            }

            $beforeValues = self::snapshot($lockedCredit);
            $reason = isset($validated['reason']) && is_string($validated['reason']) ? $validated['reason'] : null;

            if ($action === 'endorse') {
                // The chair may map and endorse in one request: apply what
                // came with it first, then insist a subject is mapped.
                $lockedCredit->fill(self::contentChanges($validated));

                if ($lockedCredit->subject_id === null) {
                    throw ValidationException::withMessages([
                        'subject_id' => 'Map this credit to a subject before endorsing it.',
                    ]);
                }

                $lockedCredit->fill(['endorsed_by' => $actor->id, 'endorsed_at' => now()]);
            } else {
                $lockedCredit->fill(['processed_by' => $actor->id, 'processed_at' => now()]);
            }

            $lockedCredit->status = self::TARGET_STATUS[$action];
            $lockedCredit->save();
            $lockedCredit->refresh();

            $this->auditRecorder->record(
                $actor,
                self::AUDIT_ACTION[$action],
                AuditableType::TRANSFEREE_CREDIT,
                $lockedCredit->id,
                $beforeValues,
                self::snapshot($lockedCredit),
                in_array($action, ['decline', 'reject'], true) ? $reason : null,
                $context,
            );

            $this->notify($lockedCredit, $action, $reason);

            return $lockedCredit->refresh()->load(['student.user', 'subject']);
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

            $lockedCredit->update(self::contentChanges($validated));
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

            return $lockedCredit->refresh()->load(['student.user', 'subject']);
        });
    }

    /**
     * The content fields a request actually carries, applied over the current
     * row. `source_grade`, `subject_id` and the school year and semester may
     * be set to null on purpose, so those are matched on key presence.
     *
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private static function contentChanges(array $validated): array
    {
        $changes = [];

        foreach (['source_institution', 'source_subject_title', 'credited_units'] as $field) {
            if (array_key_exists($field, $validated) && $validated[$field] !== null) {
                $changes[$field] = $validated[$field];
            }
        }

        foreach (['source_grade', 'source_school_year', 'source_semester', 'subject_id'] as $field) {
            if (array_key_exists($field, $validated)) {
                $changes[$field] = $validated[$field];
            }
        }

        // The code is stored as an empty string when it is unknown.
        if (array_key_exists('source_subject_code', $validated)) {
            $changes['source_subject_code'] = (string) ($validated['source_subject_code'] ?? '');
        }

        return $changes;
    }

    /**
     * The Student hears about a decision on their own request; Registrar
     * Staff hear that a credit is waiting for them.
     */
    private function notify(TransfereeCredit $credit, string $action, ?string $reason): void
    {
        if ($action === 'endorse') {
            $this->notificationRecorder->recordManyForRole(
                UserRole::RegistrarStaff,
                NotificationType::TransfereeCreditEndorsed,
                "A transferee credit for student {$credit->student->student_number} ".
                "({$credit->source_subject_title}) was endorsed by the Program Head and awaits your approval.",
            );

            return;
        }

        Notification::create([
            'user_id' => $credit->student->user_id,
            'type' => $action === 'approve'
                ? NotificationType::TransfereeCreditApproved
                : NotificationType::TransfereeCreditRejected,
            'message' => match ($action) {
                'approve' => 'Your transferee credit has been approved.',
                'decline' => "Your credit request was not accepted by the Program Head. Reason: {$reason}",
                default => "Your transferee credit was not approved. Reason: {$reason}",
            },
        ]);
    }

    /**
     * @return array{status: string, credited_units: float, subject_id: ?int}
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
