<?php

namespace App\Domain\Academic;

/**
 * Units-weighted GPA on GRC's descending scale (1.00 highest, 5.00 failed).
 * Pure — no DB, no Eloquent. Only numeric marks (`GradeMark::isNumeric()`)
 * enter the numerator and the denominator; `C`, `NC`, `INC`, and `DRP` are
 * excluded from both, and a `5.00` — a genuine numeric mark — is included,
 * since excluding a failure would flatter the student.
 *
 * `compute()` returns `null`, never `0.00`, when no row counts toward the
 * GPA: on a scale where lower is better, a bare 0.00 would misread as a
 * perfect score rather than "nothing to average."
 */
final class GradePointAverage
{
    /**
     * @param  list<array{mark: ?GradeMark, units: float}>  $rows
     */
    public static function compute(array $rows): ?string
    {
        $units = self::gpaUnits($rows);

        if ($units <= 0.0) {
            return null;
        }

        $weightedSum = 0.0;

        foreach ($rows as $row) {
            if ($row['mark'] === null || ! $row['mark']->countsTowardGpa()) {
                continue;
            }

            $weightedSum += (float) $row['mark']->value * $row['units'];
        }

        return number_format(round($weightedSum / $units, 2), 2);
    }

    /**
     * @param  list<array{mark: ?GradeMark, units: float}>  $rows
     */
    public static function gpaUnits(array $rows): float
    {
        $units = 0.0;

        foreach ($rows as $row) {
            if ($row['mark'] !== null && $row['mark']->countsTowardGpa()) {
                $units += $row['units'];
            }
        }

        return $units;
    }

    /**
     * The printed "TOTAL ACADEMIC UNITS" — every graded row regardless of
     * whether its mark counts toward the GPA (so an `INC` still contributes
     * its units to the academic total, just not to the GPA denominator).
     *
     * @param  list<array{mark: ?GradeMark, units: float}>  $rows
     */
    public static function academicUnits(array $rows): float
    {
        $units = 0.0;

        foreach ($rows as $row) {
            $units += $row['units'];
        }

        return $units;
    }
}
