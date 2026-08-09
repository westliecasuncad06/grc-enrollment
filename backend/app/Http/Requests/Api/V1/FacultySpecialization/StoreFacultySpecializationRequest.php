<?php

namespace App\Http\Requests\Api\V1\FacultySpecialization;

use App\Domain\Faculty\SpecializationProficiency;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreFacultySpecializationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'subject_id' => [
                'required',
                'integer',
                Rule::exists('subjects', 'id')->where(
                    fn ($query) => $query->where('college', $this->user()?->college?->value),
                ),
                Rule::unique('faculty_specializations', 'subject_id')->where(
                    fn ($query) => $query->where('professor_id', $this->user()?->id),
                ),
            ],
            'proficiency' => ['sometimes', Rule::enum(SpecializationProficiency::class)],
            'notes' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}
