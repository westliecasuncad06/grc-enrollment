<?php

namespace App\Actions\Enrollment;

use Illuminate\Validation\ValidationException;

/**
 * The payment rule for a freshman's first payment (ADR 0043): at least the configured
 * minimum — the same PHP 1,000 minimum every first enrollment payment already has — and
 * no promissory note. One place for the number, so the form request, the action and
 * the settlement from held credit all use the same value.
 */
final class FreshmanPaymentRules
{
    public const DEFAULT_MINIMUM = '1000.00';

    /**
     * @return numeric-string
     */
    public static function minimumAmount(): string
    {
        $configured = config('enrollment.freshman_payment.minimum_amount', self::DEFAULT_MINIMUM);

        return is_numeric($configured) ? bcadd((string) $configured, '0', 2) : self::DEFAULT_MINIMUM;
    }

    /**
     * A received amount as an exact two-decimal string, or a 422 on `amount`.
     *
     * @return numeric-string
     */
    public static function normalizeAmount(mixed $amount): string
    {
        if (! is_numeric($amount) || bccomp((string) $amount, '99999999.99', 2) === 1) {
            throw ValidationException::withMessages(['amount' => 'Enter the amount received.']);
        }

        $normalized = bcadd((string) $amount, '0', 2);

        if (bccomp($normalized, self::minimumAmount(), 2) === -1) {
            throw ValidationException::withMessages([
                'amount' => 'The first payment must be at least PHP '.number_format((float) self::minimumAmount(), 2).'.',
            ]);
        }

        return $normalized;
    }
}
