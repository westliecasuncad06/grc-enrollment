<?php

namespace App\Http\Requests\Api\V1\StudentProfile;

use App\Domain\Enrollment\EnrollmentCategory;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\FinancialStatus;
use App\Models\StudentProfile;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateStudentProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $profile = $this->route('studentProfile');
        $profileId = $profile instanceof StudentProfile ? $profile->id : null;
        $userId = $profile instanceof StudentProfile ? $profile->user_id : null;

        return [
            'first_name' => ['sometimes', 'string', 'max:255'],
            'middle_initial' => ['sometimes', 'nullable', 'string', 'max:10'],
            'last_name' => ['sometimes', 'string', 'max:255'],
            'suffix' => ['sometimes', 'nullable', 'string', 'max:20'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($userId)],
            'address' => ['sometimes', 'string', 'max:1000'],
            'student_number' => ['sometimes', 'string', 'max:255', 'regex:/^\d{4}-(0[1-9]|1[0-2])-\d{5}$/', Rule::unique('student_profiles', 'student_number')->ignore($profileId)],
            'program_id' => ['sometimes', 'integer', Rule::exists('programs', 'id')],
            'entry_year' => ['sometimes', 'integer', 'digits:4'],
            'year_level' => ['sometimes', 'integer', 'between:1,4'],
            'enrollment_category' => ['sometimes', Rule::enum(EnrollmentCategory::class)],
            'financial_status' => ['sometimes', 'nullable', Rule::enum(FinancialStatus::class)],
            'admission_status' => ['sometimes', Rule::enum(AdmissionStatus::class)],
            'curriculum_id' => ['prohibited'],
            'academic_standing' => ['prohibited'],
            'reason' => ['required', 'string', 'max:1000'],
            'identity_verified_in_person' => ['required', 'accepted'],
        ];
    }
}
