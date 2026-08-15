<?php

namespace App\Http\Requests\Api\V1\Enrollment;

use App\Domain\Enrollment\EnrollmentStatus;
use App\Models\Enrollment;
use App\Models\Payment;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Payment confirmation remains optional in shape, but an explicitly supplied
 * enrollment payment must be at least PHP 1,000.00. This is the enrollment
 * rule agreed for the Cashier workflow; it does not apply to later account
 * balance payments. Amounts must never go through binary floating point, so
 * validation is constrained to the column's exact `decimal(10,2)` capacity.
 *
 * The current-status check mirrors `ConfirmPayment`'s own idempotency-first
 * ordering: a repeat request against an enrollment that already has a
 * `Payment` row is always allowed through, even though the enrollment's
 * status has since moved on to `enrolled`.
 */
final class ConfirmPaymentRequest extends FormRequest
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
            'external_reference' => ['sometimes', 'nullable', 'string'],
            'amount' => ['sometimes', 'nullable', 'numeric', 'min:1000', 'max:99999999.99'],
            'promissory_note_on_file' => ['sometimes', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            /** @var Enrollment $enrollment */
            $enrollment = $this->route('enrollment');

            $alreadyConfirmed = Payment::query()->where('enrollment_id', $enrollment->id)->exists();

            if ($alreadyConfirmed) {
                return;
            }

            if ($enrollment->status !== EnrollmentStatus::PendingPayment) {
                $validator->errors()->add(
                    'enrollment',
                    "Payment can only be confirmed for an enrollment that is currently 'pending_payment'; ".
                    "it is currently '{$enrollment->status->value}'.",
                );
            }
        });
    }
}
