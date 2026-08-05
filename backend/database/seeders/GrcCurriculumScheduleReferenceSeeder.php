<?php

namespace Database\Seeders;

use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Subject;
use DateTime;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use SplFileObject;

/**
 * Fills the 8 `reference_*` schedule/faculty columns on `curriculum_subjects`
 * for the ACTIVE (2024-2029) version of all 12 real programs, from
 * `data/curriculum-2024-2029-schedule-references.csv` (see
 * `data/extract-curriculum-schedule-references.py`). Applies only to the
 * active curriculum version per program -- archived versions never had this
 * data extracted and keep every reference_* column null.
 *
 * Depends on GrcCurriculumSeeder having run first (the placements this
 * seeder attaches to must already exist).
 */
final class GrcCurriculumScheduleReferenceSeeder extends Seeder
{
    private const CSV_PATH = __DIR__.'/data/curriculum-2024-2029-schedule-references.csv';

    public function __construct(private readonly ?string $csvPathOverride = null) {}

    public function run(): void
    {
        $this->guardEnvironment();

        $rows = $this->readCsv($this->csvPathOverride ?? self::CSV_PATH);

        DB::transaction(function () use ($rows): void {
            foreach ($rows as $row) {
                $this->applyRow($row);
            }
        });
    }

    /**
     * @return list<array<string, string>>
     */
    private function readCsv(string $path): array
    {
        if (! is_file($path)) {
            throw new RuntimeException("GrcCurriculumScheduleReferenceSeeder could not find its CSV at {$path}");
        }

        $file = new SplFileObject($path);
        $file->setFlags(SplFileObject::READ_CSV | SplFileObject::SKIP_EMPTY | SplFileObject::DROP_NEW_LINE);

        $header = null;
        $rows = [];

        foreach ($file as $line) {
            if (! is_array($line) || $line === [null]) {
                continue;
            }

            if ($header === null) {
                $header = $line;

                continue;
            }

            if (count($line) !== count($header)) {
                continue;
            }

            /** @var array<string, string> $row */
            $row = array_combine($header, $line);
            $rows[] = $row;
        }

        return $rows;
    }

    /**
     * @param  array<string, string>  $row
     */
    private function applyRow(array $row): void
    {
        $college = strtolower(trim($row['college']));
        $programCode = trim($row['program_code']);
        $yearLevel = (int) $row['year_level'];
        $semester = trim($row['semester']);
        $subjectCode = trim($row['subject_code']);

        $curriculum = Curriculum::query()
            ->whereHas('program', fn ($query) => $query->where('code', $programCode))
            ->where('status', 'active')
            ->first();

        if ($curriculum === null) {
            return;
        }

        $subject = Subject::query()->where('college', $college)->where('code', $subjectCode)->first();

        if ($subject === null) {
            return;
        }

        $placement = CurriculumSubject::query()
            ->where('curriculum_id', $curriculum->id)
            ->where('subject_id', $subject->id)
            ->first();

        if ($placement === null) {
            return;
        }

        $blank = static fn (string $value): ?string => $value === '' ? null : $value;

        $placement->update([
            'reference_day' => $blank($row['day']),
            'reference_start_time' => $this->normalizeTime($row['start_time']),
            'reference_end_time' => $this->normalizeTime($row['end_time']),
            'reference_room' => $blank($row['room']),
            'reference_modality' => $blank($row['modality']),
            'reference_professor_name' => $blank($row['professor_name']),
            'reference_sched_id' => $blank($row['sched_id']),
            'reference_notes' => $blank($row['notes']),
        ]);
    }

    /**
     * The source spreadsheets write times in a dozen inconsistent ways --
     * "07:30", "07:30 AM", "07:30A.M", "3:00PM", a stray "=3:00" Excel
     * artifact, a "9\"00" typo for "9:00", even a handful of composite cells
     * that cram two time ranges into one field. `reference_start_time`/
     * `reference_end_time` are real `TIME` columns (not strings), so this
     * normalizes what it safely can into 24-hour `H:i:s` and returns null
     * for anything genuinely ambiguous or malformed -- this is reference/
     * display data only (see the column migration's docblock), so losing a
     * handful of edge-case values to null is preferable to guessing wrong or
     * throwing mid-seed.
     */
    private function normalizeTime(string $raw): ?string
    {
        $value = trim($raw);

        if ($value === '') {
            return null;
        }

        // Excel-artifact leading "=" / "-" seen in the source spreadsheets.
        $value = preg_replace('/^[=\-]+/', '', $value);
        // A stray double/curly quote or doubled colon standing in for ':'.
        $value = preg_replace('/(?<=\d)["\x{201d}\x{201c}](?=\d)/u', ':', $value);
        $value = preg_replace('/:{2,}/', ':', $value);
        // "A.M"/"P.M"/"am"/"pm" (with or without periods/space) -> "AM"/"PM".
        $value = preg_replace('/([AaPp])\.?\s*[Mm]\.?/', '$1M', $value);
        $value = strtoupper(preg_replace('/\s+/', '', $value));

        // Composite/garbled cells (multiple ranges crammed into one, stray
        // punctuation) are not a single parseable time -- bail rather than
        // guess at which fragment is meant.
        if ($value === '' || preg_match('/[^0-9:AMP]/', $value) === 1) {
            return null;
        }

        foreach (['g:iA', 'H:i', 'G:i', 'gA'] as $format) {
            $parsed = DateTime::createFromFormat('!'.$format, $value);

            if ($parsed !== false) {
                return $parsed->format('H:i:s');
            }
        }

        return null;
    }

    /**
     * Real institutional data must never reach a production-like environment
     * through a seeder -- the same guard every other seeder in this project
     * carries.
     */
    private function guardEnvironment(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException(
                'GrcCurriculumScheduleReferenceSeeder may only run in the local or testing environment. '
                .'Refusing to seed schedule reference data into "'.app()->environment().'".',
            );
        }
    }
}
