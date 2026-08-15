<?php

namespace App\Http\Requests\Api\V1\StudentAccount;

use Illuminate\Foundation\Http\FormRequest;

final class StoreAccountPaymentRequest extends FormRequest
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
            'amount' => ['required', 'numeric', 'gt:0', 'lte:99999999.99'],
        ];
    }
}
