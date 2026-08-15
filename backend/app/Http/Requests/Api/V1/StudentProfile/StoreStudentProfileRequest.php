<?php

namespace App\Http\Requests\Api\V1\StudentProfile;

use App\Domain\Enrollment\EnrollmentCategory;
use App\Domain\Identity\FinancialStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            // YYYY-MM-NNNNN — the year and month provisioned, then a random
            // 5-digit suffix. The frontend generates this by default
            // (features/lib/student-number.ts); this rule is the actual
            // enforcement boundary for anyone calling the API directly.
            'student_number' => ['required', 'string', 'max:255', 'regex:/^\d{4}-(0[1-9]|1[0-2])-\d{5}$/', 'unique:student_profiles,student_number'],
            'program_id' => ['required', 'integer', 'exists:programs,id'],
            // Kept nullable only for backwards-compatible clients. It is
            // deliberately ignored: curriculum assignment is automatic from
            // program + entry year and cannot be overridden in this request.
            'curriculum_id' => ['sometimes', 'nullable', 'integer', 'exists:curricula,id'],
            'entry_year' => ['required', 'integer', 'digits:4'],
            // `EnrollmentAudience::fromYearLevel()` only knows 1–4, and a
            // year level outside that range has no enrollment window at all.
            'year_level' => ['required', 'integer', 'between:1,4'],
            'enrollment_category' => ['sometimes', 'nullable', Rule::enum(EnrollmentCategory::class)],
            'financial_status' => ['sometimes', 'nullable', Rule::enum(FinancialStatus::class)],
        ];
    }
}
