<?php

namespace App\Http\Requests\Api\V1\TransfereeCredit;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Registrar-Staff-only (PRD §3.8/§10.3). `subject_id` is optional — a
 * transferred subject may not map onto any local subject — and
 * `source_grade` stays a free string with no equivalence rule encoded, since
 * PRD §17 leaves cross-institution grade equivalence unresolved (see
 * `TransfereeCreditStatus`'s docblock).
 */
final class StoreTransfereeCreditRequest extends FormRequest
{
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
            'student_id' => ['required', 'integer', 'exists:student_profiles,id'],
            'source_institution' => ['required', 'string'],
            'source_subject_code' => ['required', 'string'],
            'source_subject_title' => ['required', 'string'],
            'source_grade' => ['sometimes', 'nullable', 'string'],
            'credited_units' => ['required', 'integer', 'between:1,255'],
            'subject_id' => ['sometimes', 'nullable', 'integer', 'exists:subjects,id'],
        ];
    }
}
