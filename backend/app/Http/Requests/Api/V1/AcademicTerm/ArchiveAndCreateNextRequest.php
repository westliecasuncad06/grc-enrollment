<?php

namespace App\Http\Requests\Api\V1\AcademicTerm;

use App\Models\AcademicTerm;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Only the school year and semester of the *next* term. Enrollment dates
 * are deliberately absent — the Registrar sets those afterwards on the
 * enrollment schedule card, where the fixed 8:00 AM opening and the
 * per-audience windows are edited together.
 */
final class ArchiveAndCreateNextRequest extends FormRequest
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
            'school_year' => ['required', 'string', 'regex:/^\d{4}-\d{4}$/'],
            'semester' => ['required', 'string', Rule::in(['1st', '2nd'])],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $schoolYear = $this->input('school_year');
            $semester = $this->input('semester');

            if (! is_string($schoolYear) || ! is_string($semester)) {
                return;
            }

            $duplicateExists = AcademicTerm::query()
                ->where('school_year', $schoolYear)
                ->where('semester', $semester)
                ->exists();

            if ($duplicateExists) {
                $validator->errors()->add(
                    'school_year',
                    'A term for this school year and semester combination already exists.',
                );
            }
        });
    }
}
