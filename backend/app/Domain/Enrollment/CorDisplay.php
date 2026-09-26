<?php

namespace App\Domain\Enrollment;

/**
 * Display-only wording for a Certificate of Registration (stakeholder Doc 14).
 *
 * Issued snapshots keep the raw value ("Year 1") on purpose: the COR
 * endpoint rebuilds a snapshot on every read and re-saves the row whenever its
 * hash differs, so changing the stored wording would rewrite almost every COR
 * on its next view. The institution-approved "1st Year" form is therefore
 * applied only when a COR is rendered (PDF here, the portal view in the
 * frontend), for new and legacy snapshots alike.
 */
final class CorDisplay
{
    /**
     * 1 / "1" / "Year 1" / "1st Year" becomes "1st Year"; empty or
     * non-numeric input is returned unchanged ("—" when empty).
     */
    public static function yearLevel(int|string|null $value): string
    {
        if ($value === null || $value === '') {
            return '—';
        }

        if (is_string($value)) {
            $trimmed = trim($value);

            if (preg_match('/\d+/', $trimmed, $match) !== 1) {
                return $trimmed;
            }

            $number = (int) $match[0];
        } else {
            $number = $value;
        }

        return $number > 0 ? self::ordinal($number).' Year' : '—';
    }

    /**
     * Rewrites every "Year N" inside a sentence (the admission certification
     * line) to its ordinal form, leaving the rest untouched.
     */
    public static function sentence(string $text): string
    {
        return (string) preg_replace_callback(
            '/\bYear (\d+)\b/',
            fn (array $match): string => self::yearLevel((int) $match[1]),
            $text,
        );
    }

    private static function ordinal(int $number): string
    {
        $lastTwo = $number % 100;

        if ($lastTwo >= 11 && $lastTwo <= 13) {
            return $number.'th';
        }

        return $number.match ($number % 10) {
            1 => 'st',
            2 => 'nd',
            3 => 'rd',
            default => 'th',
        };
    }
}
