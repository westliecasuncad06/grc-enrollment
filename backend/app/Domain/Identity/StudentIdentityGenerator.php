<?php

namespace App\Domain\Identity;

/**
 * Deterministically generates synthetic student identities (student number,
 * email, and display name) for demo/seed enrollment rosters.
 *
 * Every value is a pure function of `$entryYear` and `$sequence`, so calling
 * `forIndex()` twice with the same arguments always returns the same result
 * — no database lookups, no randomness, and no state to keep in sync across
 * runs.
 *
 * Sequences are expected to start at 1001 per entry year, which keeps
 * generated student numbers (`{year}-06-01001` and up) clear of the small
 * reserved numbers (`{year}-06-00001` through `00100`) used by the existing
 * demo enrollment roster.
 */
final class StudentIdentityGenerator
{
    /**
     * @return array{student_number: string, email: string, name: string}
     */
    public static function forIndex(int $entryYear, int $sequence): array
    {
        return [
            'student_number' => self::studentNumber($entryYear, $sequence),
            'email' => self::email($entryYear, $sequence),
            'name' => self::name($entryYear, $sequence),
        ];
    }

    private static function studentNumber(int $entryYear, int $sequence): string
    {
        return sprintf('%d-06-%05d', $entryYear, $sequence);
    }

    private static function email(int $entryYear, int $sequence): string
    {
        return sprintf('s%02d%05d@grc.test', $entryYear % 100, $sequence);
    }

    private static function name(int $entryYear, int $sequence): string
    {
        [$given, $surname] = self::pools();

        $hash = crc32("{$entryYear}-{$sequence}");

        // Decorrelate the three picks by deriving them from different bit
        // ranges of the same hash: a direct modulo for the given name, a
        // large-prime-divided modulo for the surname, and a different
        // large-prime-divided modulo (mod 26) for the middle initial.
        $givenIndex = $hash % count($given);
        $surnameIndex = intdiv($hash, 97) % count($surname);
        $middleInitial = chr(65 + intdiv($hash, 9973) % 26);

        return sprintf('%s %s. %s', $given[$givenIndex], $middleInitial, $surname[$surnameIndex]);
    }

    /**
     * @return array{0: list<string>, 1: list<string>}
     */
    private static function pools(): array
    {
        static $pools = null;

        if ($pools === null) {
            $data = require base_path('database/seeders/data/filipino-name-pools.php');
            $pools = [$data['given'], $data['surname']];
        }

        return $pools;
    }
}
