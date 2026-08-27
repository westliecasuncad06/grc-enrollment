<?php

namespace App\Domain\Identity;

/**
 * Composes the single display `name` stored on `users` from its structured
 * parts. Every write path that accepts first/middle/last/suffix input calls
 * this instead of letting each Action format the string its own way, so
 * "First M. Last Suffix" spacing/punctuation stays identical everywhere.
 */
final class PersonName
{
    public static function compose(
        string $firstName,
        ?string $middleInitial,
        string $lastName,
        ?string $suffix,
    ): string {
        $middle = trim((string) $middleInitial);
        $parts = [
            trim($firstName),
            $middle !== '' ? rtrim($middle, '.').'.' : null,
            trim($lastName),
            trim((string) $suffix) !== '' ? trim((string) $suffix) : null,
        ];

        return implode(' ', array_filter($parts, fn (?string $part): bool => $part !== null && $part !== ''));
    }

    /**
     * Title-cases a first/middle/last name part regardless of how it was
     * typed (ALL CAPS, all lowercase, mixed) — capitalizes the first letter
     * of every letter-run and lowercases the rest, leaving separators
     * (spaces, hyphens, apostrophes) untouched so "dela cruz" becomes
     * "Dela Cruz" and "o'brien" becomes "O'Brien".
     */
    public static function normalizeNamePart(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);
        if ($trimmed === '') {
            return '';
        }

        return (string) preg_replace_callback(
            '/\p{L}[\p{L}\p{Mn}]*/u',
            static fn (array $match): string => mb_strtoupper(mb_substr($match[0], 0, 1)).mb_strtolower(mb_substr($match[0], 1)),
            $trimmed,
        );
    }

    /**
     * Same casing fix as {@see normalizeNamePart()}, except a bare roman
     * numeral (II, III, IV, V) stays fully uppercase instead of becoming
     * "Iii" — matching the suffix vocabulary already recognized elsewhere
     * (see the split-name backfill migration).
     */
    public static function normalizeSuffix(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);
        if (preg_match('/^(I|II|III|IV|V)$/i', $trimmed) === 1) {
            return mb_strtoupper($trimmed);
        }

        return self::normalizeNamePart($trimmed);
    }
}
