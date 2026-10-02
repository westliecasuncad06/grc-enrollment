<?php

namespace App\Http\Requests\Api\V1\StudentProfile;

use App\Actions\Identity\ListApplicableAdmissionRequirements;
use App\Domain\Identity\FinancialStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * `role`/`status`/`admission_status`/`academic_standing` are deliberately
 * not accepted here — a provisioned account is always Student/Active, and a
 * newly admitted student is always Admitted/Good standing. See
 * App\Actions\Identity\ProvisionStudent.
 */
final class StoreStudentProfileRequest extends FormRequest
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
            'first_name' => ['required', 'string', 'max:255'],
            'middle_initial' => ['sometimes', 'nullable', 'string', 'max:10'],
            'last_name' => ['required', 'string', 'max:255'],
            'suffix' => ['sometimes', 'nullable', 'string', 'max:20'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['prohibited'],
            'address' => ['required', 'string', 'max:1000'],
            // Admission ticks off each requirement the student handed in (stakeholder Doc 20). The
            // older single confirmation is still accepted when no list is sent.
            'requirement_type_ids' => ['sometimes', 'array'],
            'requirement_type_ids.*' => ['integer', 'distinct', 'exists:admission_requirement_types,id'],
            'requirements_verified' => [Rule::excludeIf(fn (): bool => $this->has('requirement_type_ids')), 'required', 'accepted'],
            // YYYY-MM-NNNNN — the year and month provisioned, then a random
            // 5-digit suffix. The frontend generates this by default
            // (features/lib/student-number.ts); this rule is the actual
            // enforcement boundary for anyone calling the API directly.
            'student_number' => ['required', 'string', 'max:255', 'regex:/^\d{4}-(0[1-9]|1[0-2])-\d{5}$/', 'unique:student_profiles,student_number'],
            'program_id' => ['required', 'integer', 'exists:programs,id'],
            // Rejected outright, not merely ignored: curriculum assignment is
            // automatic from program + entry year and must never be
            // overridable by the client.
            'curriculum_id' => ['prohibited'],
            // Derived from the current ongoing academic term
            // (Stakeholder Doc 17) — must never be client-supplied, so a
            // stale or fabricated year can't be used to pick a curriculum
            // or seed the student number. See App\Actions\Identity\ProvisionStudent.
            'entry_year' => ['prohibited'],
            // `EnrollmentAudience::fromYearLevel()` only knows 1–4, and a
            // year level outside that range has no enrollment window at all.
            'year_level' => ['required', 'integer', 'between:1,4'],
            // Derived from year_level (Stakeholder Doc 17,
            // App\Domain\Identity\AdmissionIntakeDefaults) — must never be
            // client-supplied.
            'enrollment_category' => ['prohibited'],
            'student_type' => ['prohibited'],
            'financial_status' => ['sometimes', 'nullable', Rule::enum(FinancialStatus::class)],
        ];
    }

    /**
     * An account is created only after Admission has received the requirements: when a list is sent
     * it must tick every requirement that applies to the student, and nothing that does not.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $submitted = $this->input('requirement_type_ids');
            $yearLevel = $this->input('year_level');

            if (
                ! is_array($submitted)
                || ! is_numeric($yearLevel)
                || $validator->errors()->has('requirement_type_ids')
                || $validator->errors()->has('requirement_type_ids.*')
                || $validator->errors()->has('year_level')
            ) {
                return;
            }

            $applicable = app(ListApplicableAdmissionRequirements::class)->applicableIds((int) $yearLevel);
            $ids = array_map('intval', $submitted);

            if (array_diff($applicable, $ids) !== []) {
                $validator->errors()->add('requirement_type_ids', 'Every requirement must be submitted before the account is created.');
            } elseif (array_diff($ids, $applicable) !== []) {
                $validator->errors()->add('requirement_type_ids', 'One of the checked requirements does not apply to this student.');
            }
        });
    }
}
