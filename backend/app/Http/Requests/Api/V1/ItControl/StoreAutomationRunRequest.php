<?php

namespace App\Http\Requests\Api\V1\ItControl;

use App\Domain\ItControl\AutomationStep;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreAutomationRunRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'step' => ['required', Rule::enum(AutomationStep::class)],
        ];
    }
}
