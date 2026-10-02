<?php

namespace App\Http\Requests\Api\V1\StudentProfile;

use Illuminate\Foundation\Http\FormRequest;

/**
 * `year_level` decides which requirement lists apply (Freshman for Year 1, Transferee for Years 2-4,
 * plus Additional); see `ListApplicableAdmissionRequirements`.
 */
final class IndexAdmissionRequirementTypesRequest extends FormRequest
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
            'year_level' => ['required', 'integer', 'between:1,4'],
        ];
    }
}
