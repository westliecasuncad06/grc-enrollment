<?php

namespace App\Http\Requests\Api\V1\AcademicGrade;

use App\Domain\Academic\GradeStatus;
use App\Models\AcademicGrade;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * One route serves two different concerns, distinguished by whether
 * `action` is present:
 *
 *   - No `action`: a plain content edit (`final_grade`/`remarks`) by the
 *     encoding Faculty member, allowed only while the grade is still
 *     `draft` (PRD §4.3 — `GradeStatus::isEditableByEncoder()`).
 *   - `action: submit` (`draft` → `submitted`, Faculty) or
 *     `action: lock` (`submitted` → `locked`, Registrar Head): a pure state
 *     transition, following the same `REQUIRED_CURRENT_STATUS` shape as
 *     `UpdateEnrollmentRequest`/`UpdateScheduleProposalRequest` (ADR 0011) —
 *     content fields are prohibited on these requests so the two concerns
 *     never mix in one call.
 */
final class UpdateAcademicGradeRequest extends FormRequest
{
    /**
     * @var array<string, GradeStatus>
     */
    private const REQUIRED_CURRENT_STATUS_FOR_ACTION = [
        'submit' => GradeStatus::Draft,
        'lock' => GradeStatus::Submitted,
    ];

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
            'action' => ['sometimes', 'string', Rule::in(array_keys(self::REQUIRED_CURRENT_STATUS_FOR_ACTION))],
            'final_grade' => ['prohibited_if:action,submit,lock', 'sometimes', 'nullable', 'numeric', 'between:0,999.99'],
            'remarks' => ['prohibited_if:action,submit,lock', 'sometimes', 'nullable', 'string'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            /** @var AcademicGrade $grade */
            $grade = $this->route('academicGrade');
            $action = $this->input('action');

            if (is_string($action) && isset(self::REQUIRED_CURRENT_STATUS_FOR_ACTION[$action])) {
                $requiredStatus = self::REQUIRED_CURRENT_STATUS_FOR_ACTION[$action];

                if ($grade->status !== $requiredStatus) {
                    $validator->errors()->add(
                        'action',
                        "This action requires the grade to currently be '{$requiredStatus->value}'; ".
                        "it is currently '{$grade->status->value}'.",
                    );
                }

                return;
            }

            if (! $grade->status->isEditableByEncoder()) {
                $validator->errors()->add(
                    'final_grade',
                    "This grade is '{$grade->status->value}' and can no longer be edited directly.",
                );
            }
        });
    }
}
