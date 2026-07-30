<?php

namespace App\Http\Requests\Api\V1\TransfereeCredit;

use App\Domain\Academic\TransfereeCreditStatus;
use App\Models\TransfereeCredit;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * One route serves two concerns, distinguished by whether `action` is
 * present — the same shape `UpdateAcademicGradeRequest` established:
 *
 *   - No `action`: a plain content edit by Registrar Staff, allowed only
 *     while the credit is still `pending`.
 *   - `action: approve|reject`: a pure status transition, requiring the
 *     credit currently be `pending`; `reject` requires a reason (recorded
 *     only in the audit row, since `transferee_credits` has no column of
 *     its own for it — mirrors `UpdateWithdrawalRequestRequest`).
 */
final class UpdateTransfereeCreditRequest extends FormRequest
{
    private const REQUIRED_CURRENT_STATUS = TransfereeCreditStatus::Pending;

    private const REASON_REQUIRED_ACTIONS = ['reject'];

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'action' => ['sometimes', 'string', Rule::in(['approve', 'reject'])],
            'reason' => [
                Rule::requiredIf(fn (): bool => in_array($this->input('action'), self::REASON_REQUIRED_ACTIONS, true)),
                'nullable',
                'string',
            ],
            'source_institution' => ['prohibited_if:action,approve,reject', 'sometimes', 'string'],
            'source_subject_code' => ['prohibited_if:action,approve,reject', 'sometimes', 'string'],
            'source_subject_title' => ['prohibited_if:action,approve,reject', 'sometimes', 'string'],
            'source_grade' => ['prohibited_if:action,approve,reject', 'sometimes', 'nullable', 'string'],
            'credited_units' => ['prohibited_if:action,approve,reject', 'sometimes', 'integer', 'between:1,255'],
            'subject_id' => ['prohibited_if:action,approve,reject', 'sometimes', 'nullable', 'integer', 'exists:subjects,id'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            /** @var TransfereeCredit $transfereeCredit */
            $transfereeCredit = $this->route('transfereeCredit');
            $action = $this->input('action');

            if (is_string($action) && $transfereeCredit->status !== self::REQUIRED_CURRENT_STATUS) {
                $validator->errors()->add(
                    'action',
                    'This action requires the transferee credit to currently be '.
                    "'".self::REQUIRED_CURRENT_STATUS->value."'; it is currently ".
                    "'{$transfereeCredit->status->value}'.",
                );

                return;
            }

            if (! is_string($action) && $transfereeCredit->status !== self::REQUIRED_CURRENT_STATUS) {
                $validator->errors()->add(
                    'source_institution',
                    "This transferee credit is '{$transfereeCredit->status->value}' and can no longer be edited directly.",
                );
            }
        });
    }
}
