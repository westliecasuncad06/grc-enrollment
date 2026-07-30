<?php

namespace App\Http\Requests\Api\V1\Enrollment;

use App\Domain\Enrollment\EnrollmentStatus;
use App\Models\Enrollment;
use App\Models\Payment;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Both fields stay optional and unconstrained beyond basic shape: PRD §17
 * leaves the required payment-confirmation fields, currency, and rounding
 * rule open (see `Payment`'s own docblock — `amount` must never go through
 * binary floating point, hence `numeric` validated against the column's
 * exact `decimal(10,2)` capacity, not a business rule).
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
            'amount' => ['sometimes', 'nullable', 'numeric', 'between:0,99999999.99'],
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
