<?php

namespace App\Http\Requests\Api\V1\FacultyAvailability;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateFacultyAvailabilityRequest extends FormRequest
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
            'academic_term_id' => ['required', 'integer', 'exists:academic_terms,id'],
            'day_of_week' => ['required', 'integer', 'between:1,7'],
            'starts_at_time' => [
                'required',
                'date_format:H:i:s',
                Rule::unique('faculty_availabilities')->where(
                    fn ($query) => $query
                        ->where('professor_id', $this->user()?->id)
                        ->where('academic_term_id', $this->input('academic_term_id'))
                        ->where('day_of_week', $this->input('day_of_week')),
                )->ignore($this->route('facultyAvailability')),
            ],
            'ends_at_time' => ['required', 'date_format:H:i:s', 'after:starts_at_time'],
        ];
    }
}
