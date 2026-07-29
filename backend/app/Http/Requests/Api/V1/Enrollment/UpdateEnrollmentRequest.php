<?php

namespace App\Http\Requests\Api\V1\Enrollment;

use App\Domain\Enrollment\EnrollmentStatus;
use App\Models\Enrollment;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * One `action` field drives all three Registrar Head decisions; which role
 * may perform it is a Policy concern (`EnrollmentPolicy`), not this
 * request's — this class validates only that the action is well-formed and
 * legal *given the enrollment's current status*, and that a reason is
 * present exactly when FR-FIN-002 requires one (reject or void).
 */
final class UpdateEnrollmentRequest extends FormRequest
{
    /**
     * @var array<string, EnrollmentStatus>
     */
    private const REQUIRED_CURRENT_STATUS = [
        'registrar_approve' => EnrollmentStatus::PendingRegistrarApproval,
        'registrar_reject' => EnrollmentStatus::PendingRegistrarApproval,
        'void' => EnrollmentStatus::PendingPayment,
    ];

    private const REASON_REQUIRED_ACTIONS = ['registrar_reject', 'void'];

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
            'action' => ['required', 'string', Rule::in(array_keys(self::REQUIRED_CURRENT_STATUS))],
            'reason' => [
                Rule::requiredIf(fn (): bool => in_array($this->input('action'), self::REASON_REQUIRED_ACTIONS, true)),
                'nullable',
                'string',
            ],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $action = $this->input('action');

            if (! is_string($action) || ! isset(self::REQUIRED_CURRENT_STATUS[$action])) {
                return;
            }

            /** @var Enrollment $enrollment */
            $enrollment = $this->route('enrollment');
            $requiredStatus = self::REQUIRED_CURRENT_STATUS[$action];

            if ($enrollment->status !== $requiredStatus) {
                $validator->errors()->add(
                    'action',
                    "This action requires the enrollment to currently be '{$requiredStatus->value}'; ".
                    "it is currently '{$enrollment->status->value}'.",
                );
            }
        });
    }
}
