<?php

namespace App\Http\Requests\Api\V1\AcademicGrade;

use App\Models\AcademicGrade;
use App\Models\Section;
use App\Models\User;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Faculty-only (DFD 3.1): every grade this endpoint creates is tied to one
 * of the encoding professor's own sections, so `section_id` is required here
 * even though the column itself is nullable (that nullability exists for a
 * future transferee-credit path this slice does not implement). Re-checks
 * `section.professor_id === auth()->id()` as defense in depth alongside
 * `AcademicGradePolicy::create`, the same shape `StoreEnrollmentRequest`
 * uses for its own server-side re-validation.
 */
final class StoreAcademicGradeRequest extends FormRequest
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
            'subject_id' => ['required', 'integer', 'exists:subjects,id'],
            'section_id' => ['required', 'integer', 'exists:sections,id'],
            'academic_term_id' => ['required', 'integer', 'exists:academic_terms,id'],
            'final_grade' => ['sometimes', 'nullable', 'numeric', 'between:0,999.99'],
            'remarks' => ['sometimes', 'nullable', 'string'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $sectionId = $this->input('section_id');

            if (! is_numeric($sectionId)) {
                return;
            }

            $section = Section::query()->find((int) $sectionId);
            $user = $this->user();

            if ($section !== null && $user instanceof User && $section->professor_id !== $user->id) {
                $validator->errors()->add('section_id', 'This section is not assigned to you.');

                return;
            }

            $studentId = $this->input('student_id');
            $subjectId = $this->input('subject_id');
            $academicTermId = $this->input('academic_term_id');

            if (! is_numeric($studentId) || ! is_numeric($subjectId) || ! is_numeric($academicTermId)) {
                return;
            }

            $duplicateExists = AcademicGrade::query()
                ->where('student_id', (int) $studentId)
                ->where('subject_id', (int) $subjectId)
                ->where('academic_term_id', (int) $academicTermId)
                ->exists();

            if ($duplicateExists) {
                $validator->errors()->add(
                    'subject_id',
                    'A grade record already exists for this student, subject, and term.',
                );
            }
        });
    }
}
