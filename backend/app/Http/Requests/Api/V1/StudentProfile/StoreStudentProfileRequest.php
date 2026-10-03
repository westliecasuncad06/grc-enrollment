<?php

namespace App\Http\Requests\Api\V1\StudentProfile;

use App\Actions\Identity\ListApplicableAdmissionRequirements;
use App\Domain\Enrollment\EnrollmentCategory;
use App\Domain\Identity\FinancialStatus;
use App\Domain\Identity\StudentType;
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
        $hasExistingNumber = $this->boolean('has_existing_student_number');

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
            // The server assigns the number (ADR 0042). Admission may instead enter the number a
            // Returnee or an Existing Student already has: then it is required, in the same
            // YYYY-MM-NNNNN format, and unique. Otherwise a client-sent number is refused rather
            // than quietly ignored, so an older frontend that still makes its own number is told.
            'has_existing_student_number' => ['sometimes', 'boolean'],
            'student_number' => $hasExistingNumber
                ? ['required', 'string', 'max:255', 'regex:/^\d{4}-(0[1-9]|1[0-2])-\d{5}$/', 'unique:student_profiles,student_number']
                : ['prohibited'],
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
            // Chosen by Admission on the form (stakeholder Doc 20); no longer derived from
            // year_level as Stakeholder Doc 17 did.
            'enrollment_category' => ['required', Rule::enum(EnrollmentCategory::class)],
            'student_type' => ['required', Rule::enum(StudentType::class)],
            'financial_status' => ['sometimes', 'nullable', Rule::enum(FinancialStatus::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'student_number.unique' => 'This student number is already in use.',
            'student_number.regex' => 'Student number must be in YYYY-MM-NNNNN format (e.g. 2026-08-07107).',
            'student_number.prohibited' => 'A student number is assigned automatically. Tick "Student already has a student number" to enter one.',
        ];
    }

    /**
     * Admission ticks off the requirements the student handed in; the account may be created with some
     * still missing (stakeholder Doc 20). A list may only name requirements that apply to the chosen
     * student type. An existing student number is only for a type that has records at the school.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $this->validateExistingNumberType($validator);

            $submitted = $this->input('requirement_type_ids');
            $studentType = StudentType::tryFrom((string) $this->input('student_type'));

            if (
                ! is_array($submitted)
                || $studentType === null
                || $validator->errors()->has('requirement_type_ids')
                || $validator->errors()->has('requirement_type_ids.*')
                || $validator->errors()->has('student_type')
            ) {
                return;
            }

            $applicable = app(ListApplicableAdmissionRequirements::class)->applicableIds($studentType);

            if (array_diff(array_map('intval', $submitted), $applicable) !== []) {
                $validator->errors()->add('requirement_type_ids', 'One of the checked requirements does not apply to this student.');
            }
        });
    }

    private function validateExistingNumberType(Validator $validator): void
    {
        if (! $this->boolean('has_existing_student_number') || $validator->errors()->has('student_type')) {
            return;
        }

        $studentType = StudentType::tryFrom((string) $this->input('student_type'));

        if ($studentType !== null && ! $studentType->canHaveExistingStudentNumber()) {
            $validator->errors()->add(
                'has_existing_student_number',
                'Only a Returnee or an Existing Student can already have a student number.',
            );
        }
    }
}
