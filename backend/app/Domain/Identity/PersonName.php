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
}
