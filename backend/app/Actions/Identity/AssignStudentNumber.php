<?php

namespace App\Actions\Identity;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Hands out the next student number, `YYYY-MM-NNNNN` (ADR 0042): the year and
 * month in the school's calendar (Asia/Manila, not the app's UTC), then a
 * running 5-digit number from one counter per year. The counter continues
 * across months and restarts at 00001 each January.
 *
 * The year's counter row is locked for the rest of the transaction, so two
 * Admission staff creating accounts at the same moment get different numbers.
 * A suffix already used by any student that year (for example a number entered
 * by hand for a Returnee) is skipped, so no two students share a suffix in a
 * year. Calling this inside a failed outer transaction gives the number back.
 */
final class AssignStudentNumber
{
    private const TIMEZONE = 'Asia/Manila';

    private const MAX_SUFFIX = 99999;

    public function handle(): string
    {
        return DB::transaction(function (): string {
            $now = now(self::TIMEZONE);
            $year = $now->year;

            $this->ensureCounterRow($year);

            $next = (int) DB::table('student_number_sequences')
                ->where('year', $year)
                ->lockForUpdate()
                ->value('last_value');

            do {
                $next++;

                if ($next > self::MAX_SUFFIX) {
                    throw ValidationException::withMessages([
                        'student_number' => "All student numbers for {$year} are already in use.",
                    ]);
                }
            } while ($this->suffixIsUsed($year, $next));

            DB::table('student_number_sequences')
                ->where('year', $year)
                ->update(['last_value' => $next, 'updated_at' => now()]);

            return sprintf('%04d-%02d-%05d', $year, $now->month, $next);
        });
    }

    private function ensureCounterRow(int $year): void
    {
        if (DB::table('student_number_sequences')->where('year', $year)->exists()) {
            return;
        }

        // `insertOrIgnore`: two first-of-the-year requests may both get here; the
        // loser's insert is ignored and both then wait on the same locked row.
        DB::table('student_number_sequences')->insertOrIgnore([
            'year' => $year,
            'last_value' => $this->highestSuffixInUse($year),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /** Highest `NNNNN` among `YYYY-MM-NNNNN` numbers of the year; `HIST-` and `TEST-` numbers never match. */
    private function highestSuffixInUse(int $year): int
    {
        return (int) DB::table('student_profiles')
            ->where('student_number', 'like', sprintf('%04d-__-_____', $year))
            ->whereRaw('CHAR_LENGTH(student_number) = 13')
            ->max(DB::raw('CAST(SUBSTRING(student_number, 9) AS UNSIGNED)'));
    }

    private function suffixIsUsed(int $year, int $suffix): bool
    {
        return DB::table('student_profiles')
            ->where('student_number', 'like', sprintf('%04d-__-%05d', $year, $suffix))
            ->exists();
    }
}
