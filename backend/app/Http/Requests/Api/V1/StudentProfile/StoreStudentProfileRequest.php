<?php

namespace App\Http\Requests\Api\V1\StudentProfile;

use App\Domain\Enrollment\EnrollmentCategory;
use App\Models\Curriculum;
use Illuminate\Contracts\Validation\Validator;
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
            'student_number' => ['required', 'string', 'max:255', 'unique:student_profiles,student_number'],
            'program_id' => ['required', 'integer', 'exists:programs,id'],
            'curriculum_id' => ['required', 'integer', 'exists:curricula,id'],
            // `EnrollmentAudience::fromYearLevel()` only knows 1–4, and a
            // year level outside that range has no enrollment window at all.
            'year_level' => ['required', 'integer', 'between:1,4'],
            'enrollment_category' => ['sometimes', 'nullable', Rule::enum(EnrollmentCategory::class)],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $programId = $this->input('program_id');
            $curriculumId = $this->input('curriculum_id');

            if (! is_numeric($programId) || ! is_numeric($curriculumId)) {
                return;
            }

            $curriculum = Curriculum::query()->find($curriculumId);

            if ($curriculum instanceof Curriculum && $curriculum->program_id !== (int) $programId) {
                $validator->errors()->add(
                    'curriculum_id',
                    'The selected curriculum does not belong to the selected program.',
                );
            }
        });
    }
}
