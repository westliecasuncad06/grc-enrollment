<?php

namespace App\Actions\Analytics;

use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Enrollment\EnrollmentSubjectStatus;
use App\Models\AcademicTerm;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Aggregates real enrollment history (`enrollment_subjects` joined to
 * `sections`, `enrollments`, `student_profiles`, `programs`, and
 * `curricula`) into `section_demand_observations` rows with
 * `source = 'derived_from_enrollments'`, upserting on the table's real
 * unique key (`academic_term_id`, `program_id`, `curriculum_id`,
 * `subject_id`, `year_level`) so a derived row replaces any synthetic seed
 * row occupying the same key — see `SectionDemandObservationSeeder`
 * (`source = 'local_synthetic_aggregate'`) and `PredictivePlanningInputSeeder`
 * (`source = 'local_synthetic_planning_input'`) for the rows this can
 * supersede. A key with no matching real enrollment history is never
 * touched — its synthetic fallback row, if one exists, survives untouched.
 *
 * `year_level` here is each student's *current* `student_profiles.year_level`
 * at the time this runs, not a reconstructed per-historical-term value —
 * this schema has nowhere else to read one from (neither `enrollments` nor
 * `academic_grades` carry a year level, and `curriculum_subjects.year_level`
 * describes a curriculum *plan* position, not any individual student's own
 * placement in a specific past term). This matches the exact join-table list
 * this class's own brief specifies (`sections`, `enrollments`,
 * `student_profiles`, `programs`, `curricula` — deliberately no
 * `curriculum_subjects`), and is consistent with how `GenerateSectionDemandForecasts`
 * already reads this same column: as "the year level to plan capacity for",
 * not as "the year level the observation's term historically was".
 */
final class DeriveSectionDemandObservations
{
    private const SOURCE = 'derived_from_enrollments';

    private const UPSERT_CHUNK_SIZE = 500;

    public function execute(?AcademicTerm $term = null): int
    {
        $sectionLevelRows = $this->sectionLevelQuery($term)->get();

        if ($sectionLevelRows->isEmpty()) {
            return 0;
        }

        // Second-level grouping (per key, across that key's distinct
        // sections) happens here in PHP rather than as a SQL subquery over
        // a subquery: `$sectionLevelRows` is already one row per (key,
        // section) — at most a few thousand rows even at the full
        // 3,210-student roster's scale — so summing/counting in memory
        // avoids a second round trip without meaningfully costing anything.
        /** @var array<string, array{academic_term_id: int, program_id: int, curriculum_id: int, subject_id: int, college: string, year_level: int, section_count: int, offered_capacity: int, enrolled_count: int}> $grouped */
        $grouped = [];
        foreach ($sectionLevelRows as $row) {
            $key = implode('|', [
                $row->academic_term_id, $row->program_id, $row->curriculum_id,
                $row->subject_id, $row->college, $row->year_level,
            ]);

            $grouped[$key] ??= [
                'academic_term_id' => (int) $row->academic_term_id,
                'program_id' => (int) $row->program_id,
                'curriculum_id' => (int) $row->curriculum_id,
                'subject_id' => (int) $row->subject_id,
                'college' => (string) $row->college,
                'year_level' => (int) $row->year_level,
                'section_count' => 0,
                'offered_capacity' => 0,
                'enrolled_count' => 0,
            ];

            $grouped[$key]['section_count']++;
            $grouped[$key]['offered_capacity'] += (int) $row->section_capacity;
            $grouped[$key]['enrolled_count'] += (int) $row->section_enrolled;
        }

        $cohortSizes = $this->cohortSizes($term);
        $now = now();

        $upsertRows = [];
        foreach ($grouped as $row) {
            $cohortKey = $row['academic_term_id'].'|'.$row['program_id'].'|'.$row['year_level'];
            $upsertRows[] = array_merge($row, [
                // Falls back to this row's own enrolled_count when no
                // program+year_level cohort headcount was found (never
                // happens in practice — the same enrollments that produced
                // this subject row also produced the cohort's headcount —
                // but keeps the not-null `cohort_size` column honest rather
                // than writing a 0 no real data backs).
                'cohort_size' => $cohortSizes[$cohortKey] ?? $row['enrolled_count'],
                'source' => self::SOURCE,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach (array_chunk($upsertRows, self::UPSERT_CHUNK_SIZE) as $chunk) {
            DB::table('section_demand_observations')->upsert(
                $chunk,
                ['academic_term_id', 'program_id', 'curriculum_id', 'subject_id', 'year_level'],
                ['college', 'cohort_size', 'enrolled_count', 'section_count', 'offered_capacity', 'source', 'updated_at'],
            );
        }

        return count($upsertRows);
    }

    /**
     * One row per (key, section): the finest grain the aggregation needs.
     * `MAX(sec.capacity)` (rather than grouping by it directly) keeps this
     * portable under `ONLY_FULL_GROUP_BY` — `sec.capacity` is functionally
     * dependent on `sec.id`, which the query already groups by, but MySQL/
     * MariaDB only recognizes that exemption for a table's own primary key,
     * not a query-builder-composed `GROUP BY` list.
     */
    private function sectionLevelQuery(?AcademicTerm $term): Builder
    {
        return DB::table('enrollment_subjects as es')
            ->join('sections as sec', 'sec.id', '=', 'es.section_id')
            ->join('enrollments as e', 'e.id', '=', 'es.enrollment_id')
            ->join('student_profiles as sp', 'sp.id', '=', 'e.student_id')
            ->join('programs as p', 'p.id', '=', 'sp.program_id')
            ->join('curricula as c', 'c.id', '=', 'sp.curriculum_id')
            ->where('es.status', '!=', EnrollmentSubjectStatus::Dropped->value)
            ->whereNotIn('e.status', EnrollmentStatus::terminalValues())
            ->whereNotNull('p.college')
            ->when($term?->id, fn ($query, int $termId) => $query->where('sec.academic_term_id', $termId))
            ->groupBy(['sec.academic_term_id', 'sp.program_id', 'sp.curriculum_id', 'sec.subject_id', 'p.college', 'sp.year_level', 'sec.id'])
            ->select([
                'sec.academic_term_id as academic_term_id',
                'sp.program_id as program_id',
                'sp.curriculum_id as curriculum_id',
                'sec.subject_id as subject_id',
                'p.college as college',
                'sp.year_level as year_level',
                DB::raw('MAX(sec.capacity) as section_capacity'),
                DB::raw('COUNT(DISTINCT e.student_id) as section_enrolled'),
            ]);
    }

    /**
     * Distinct-student headcount per (academic_term_id, program_id,
     * year_level) — independent of subject/curriculum/section, unlike
     * `enrolled_count`. This is `cohort_size`'s denominator: "how many
     * students at this program and year level are enrolled this term",
     * regardless of which of that term's subjects they took.
     *
     * @return array<string, int>
     */
    private function cohortSizes(?AcademicTerm $term): array
    {
        $rows = DB::table('enrollments as e')
            ->join('student_profiles as sp', 'sp.id', '=', 'e.student_id')
            ->whereNotIn('e.status', EnrollmentStatus::terminalValues())
            ->when($term?->id, fn ($query, int $termId) => $query->where('e.academic_term_id', $termId))
            ->groupBy(['e.academic_term_id', 'sp.program_id', 'sp.year_level'])
            ->select([
                'e.academic_term_id as academic_term_id',
                'sp.program_id as program_id',
                'sp.year_level as year_level',
                DB::raw('COUNT(DISTINCT e.student_id) as cohort_size'),
            ])
            ->get();

        $map = [];
        foreach ($rows as $row) {
            $map[$row->academic_term_id.'|'.$row->program_id.'|'.$row->year_level] = (int) $row->cohort_size;
        }

        return $map;
    }
}
