<?php

namespace App\Http\Requests\Api\V1\Dashboard;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Unlike IndexEligibleSubjectRequest, academic_term_id is optional here —
 * the controller defaults to the currently active term, since a dashboard
 * is meant to be usable without the caller already knowing which term id to
 * ask for.
 */
final class IndexDashboardRequest extends FormRequest
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
            'academic_term_id' => ['sometimes', 'integer', 'exists:academic_terms,id'],
        ];
    }
}
