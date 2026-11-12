<?php

namespace App\Http\Requests\Api\V1\Section;

use Illuminate\Foundation\Http\FormRequest;

final class IndexSectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        // An unknown term simply has no visible sections. No extra existence
        // query is necessary for this optional read filter.
        return [
            'academic_term_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ];
    }
}
