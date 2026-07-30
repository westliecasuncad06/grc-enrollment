<?php

namespace App\Actions\Academic;

use App\Domain\Academic\TransfereeCreditStatus;
use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Models\TransfereeCredit;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\DB;

/**
 * PRD §3.8/§10.3: Registrar Staff records one credited external subject.
 * Status starts `pending` — recording does not, by itself, grant the
 * credit; see `TransfereeCreditPolicy`/`UpdateTransfereeCredit` for the
 * separate approve/reject checkpoint.
 */
final readonly class CreateTransfereeCredit
{
    public function __construct(private AuditRecorder $auditRecorder) {}

    /**
     * @param  array<string, mixed>  $validated
     */
    public function execute(array $validated, User $actor, AuditRequestContext $context): TransfereeCredit
    {
        return DB::transaction(function () use ($validated, $actor, $context): TransfereeCredit {
            $credit = TransfereeCredit::create([
                'student_id' => $validated['student_id'],
                'source_institution' => $validated['source_institution'],
                'source_subject_code' => $validated['source_subject_code'],
                'source_subject_title' => $validated['source_subject_title'],
                'source_grade' => $validated['source_grade'] ?? null,
                'credited_units' => $validated['credited_units'],
                'subject_id' => $validated['subject_id'] ?? null,
                'status' => TransfereeCreditStatus::Pending,
            ]);

            $this->auditRecorder->record(
                $actor,
                AuditAction::TRANSFEREE_CREDIT_CREATED,
                AuditableType::TRANSFEREE_CREDIT,
                $credit->id,
                null,
                [
                    'student_id' => $credit->student_id,
                    'subject_id' => $credit->subject_id,
                    'credited_units' => $credit->credited_units,
                    'status' => $credit->status->value,
                ],
                null,
                $context,
            );

            return $credit->refresh()->load(['student', 'subject']);
        });
    }
}
