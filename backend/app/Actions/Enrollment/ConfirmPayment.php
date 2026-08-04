<?php

namespace App\Actions\Enrollment;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Enrollment\EnrollmentDocumentType;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Enrollment\EnrollmentSubjectStatus;
use App\Domain\Notifications\NotificationType;
use App\Models\Assessment;
use App\Models\Enrollment;
use App\Models\EnrollmentDocument;
use App\Models\Notification;
use App\Models\Payment;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * PRD §5.3 FR-FIN-007/008: confirms an externally received payment (no
 * gateway integration — see `Payment`'s own docblock) and generates the
 * Digital COM in the same transaction, mirroring `SubmitEnrollment`'s
 * five-write shape: the `Payment` row, the enrollment's own transition to
 * `enrolled`, the `EnrollmentDocument` (com), one audit entry, and the
 * confirmation notification.
 *
 * FR-FIN-009 idempotency rests on `payments.enrollment_id`'s unique
 * constraint: this Action checks for an existing `Payment` FIRST, before
 * checking the enrollment's status, so a repeat call — even one arriving
 * after the enrollment has already moved on to `enrolled` — returns the
 * existing records rather than erroring or creating a duplicate.
 *
 * No PDF pipeline: §17 leaves COM format, numbering, signatures, and
 * retention open, so `document_number` is an opaque deterministic string
 * (the same choice already made for `Q%06d` queue tickets) and
 * `storage_path` stays null. FR-FIN-010's "view and print/download" is
 * served by the Student module rendering this structured data as a
 * print-stylesheet page, not by generating a file here.
 *
 * Payment confirmation is also where each `EnrollmentSubject` transitions
 * `selected` → `enrolled` — the class roster (and grade submission's roster
 * filter) only ever surfaces `enrolled` rows, so a student stays invisible
 * to their professor until this step runs.
 */
final readonly class ConfirmPayment
{
    public function __construct(private AuditRecorder $auditRecorder) {}

    /**
     * @param  array<string, mixed>  $validated
     * @return array{enrollment: Enrollment, created: bool}
     */
    public function execute(Enrollment $enrollment, array $validated, User $actor, AuditRequestContext $context): array
    {
        return DB::transaction(function () use ($enrollment, $validated, $actor, $context): array {
            $lockedEnrollment = Enrollment::query()
                ->whereKey($enrollment->id)
                ->lockForUpdate()
                ->firstOrFail();

            $existingPayment = Payment::query()->where('enrollment_id', $lockedEnrollment->id)->first();

            if ($existingPayment !== null) {
                return [
                    'enrollment' => $lockedEnrollment->load(['student', 'payment', 'documents', 'assessment.items']),
                    'created' => false,
                ];
            }

            if ($lockedEnrollment->status !== EnrollmentStatus::PendingPayment) {
                throw ValidationException::withMessages([
                    'enrollment' => 'Payment can only be confirmed for an enrollment that is currently '.
                        "'pending_payment'; it is currently '{$lockedEnrollment->status->value}'.",
                ]);
            }

            $confirmedAt = now();

            // An explicitly supplied amount is always trusted as-is — §17
            // has no partial-payment or mismatch policy, so a value that
            // differs from the assessment is recorded, not rejected. Only a
            // fully-omitted amount falls back to what was assessed; an
            // enrollment with no assessment (created directly, as most test
            // fixtures still do) keeps today's behavior of staying null.
            $assessment = Assessment::query()->where('enrollment_id', $lockedEnrollment->id)->first();
            $amount = $validated['amount'] ?? $assessment?->total_amount;

            $payment = Payment::create([
                'enrollment_id' => $lockedEnrollment->id,
                'confirmed_by' => $actor->id,
                'external_reference' => $validated['external_reference'] ?? null,
                'amount' => $amount,
                'confirmed_at' => $confirmedAt,
            ]);

            $lockedEnrollment->update([
                'status' => EnrollmentStatus::Enrolled,
                'payment_confirmed_at' => $confirmedAt,
                'enrolled_at' => $confirmedAt,
            ]);
            $lockedEnrollment->refresh();

            $lockedEnrollment->enrollmentSubjects()
                ->where('status', EnrollmentSubjectStatus::Selected)
                ->update(['status' => EnrollmentSubjectStatus::Enrolled]);

            $document = EnrollmentDocument::create([
                'enrollment_id' => $lockedEnrollment->id,
                'document_type' => EnrollmentDocumentType::Com,
                'document_number' => sprintf('COM%06d', $lockedEnrollment->id),
                'storage_path' => null,
                'generated_at' => $confirmedAt,
            ]);

            $this->auditRecorder->record(
                $actor,
                AuditAction::ENROLLMENT_PAYMENT_CONFIRMED,
                AuditableType::ENROLLMENT,
                $lockedEnrollment->id,
                ['status' => EnrollmentStatus::PendingPayment->value],
                [
                    'status' => $lockedEnrollment->status->value,
                    'payment_id' => $payment->id,
                    'document_number' => $document->document_number,
                ],
                null,
                $context,
            );

            Notification::create([
                'user_id' => $lockedEnrollment->student->user_id,
                'type' => NotificationType::EnrollmentPaymentConfirmed,
                'message' => "Your payment has been confirmed. Your Certificate of Matriculation ({$document->document_number}) is ready.",
            ]);

            return [
                'enrollment' => $lockedEnrollment->load(['student', 'payment', 'documents', 'assessment.items']),
                'created' => true,
            ];
        });
    }
}
