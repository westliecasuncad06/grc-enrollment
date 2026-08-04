<?php

namespace Database\Seeders;

use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Organization\CatalogSectionMetadata;
use App\Domain\Organization\CollegeCode;
use App\Domain\Organization\ProgramStatus;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Program;
use App\Models\Subject;
use App\Models\SubjectPrerequisite;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use SplFileObject;

/**
 * Seeds the real four-college subject/prerequisite catalog (CCS, COE, COA,
 * CBAE — the only colleges currently supported) from
 * `database/seeders/data/organizations-subjects-prerequisites.csv`, a
 * 409-row fixture reverse-engineered from real GRC block-section schedules.
 *
 * Unlike CcsSubjectSeeder, this seeder parses the CSV at runtime instead of
 * hand-transcribing it into a PHP array: the source has 409 rows (vs. 88)
 * and genuine embedded-comma quoted fields (e.g. `"Science, Technology and
 * Society"`) that a naive `explode(',', ...)` would corrupt.
 *
 * The source CSV has no curriculum/program/year-level concept at all — it is
 * a flat organization -> subject -> prerequisite list. To satisfy the
 * existing schema (subject_prerequisites hangs off curriculum_subject_id,
 * not subject_id directly — see ADR 0009), this seeder creates ONE
 * placeholder Program (`{COLLEGE}-CATALOG`) and ONE placeholder Curriculum
 * per college, purely as a scaffold to anchor CurriculumSubject/
 * SubjectPrerequisite rows. This is deliberately temporary: the Curriculum
 * Capacities sub-project will define real per-program curricula and is
 * expected to re-point or retire these placeholders. Every placement
 * derives year_level from the numeric block labels in the CSV's `sections`
 * column (for example `IT 301` => year 3), and preserves both semesters when
 * the source lists a subject in both terms.
 *
 * Only the CSV's `prerequisite_codes`/`prerequisite_logic` columns are
 * treated as confirmed prerequisites. `possible_prerequisite_codes` /
 * `possible_prerequisite_logic` are the source analysis's own
 * lower-confidence guesses (see e.g. the THESIS row's "Possible review:"
 * note) and are deliberately NOT seeded as enforced prerequisites — they
 * need human/Program-Chair confirmation first.
 *
 * `prerequisite_logic` ALL/ANY is simplified to a flat AND-list: the
 * existing subject_prerequisites schema has no OR-grouping concept, and
 * redesigning the eligibility engine is out of scope here. Sampling shows
 * most ANY rows are alternate code spellings for the same real prerequisite
 * (e.g. `SYSARC1|SYSARCH1`), not genuinely distinct alternative courses —
 * each pipe-delimited candidate is resolved against that college's own
 * seeded catalog, and whichever one(s) actually exist are linked.
 */
final class AllOrganizationsSubjectsPrerequisitesSeeder extends Seeder
{
    private const CSV_PATH = __DIR__.'/data/organizations-subjects-prerequisites.csv';

    private const PLACEHOLDER_MINIMUM_GRADE = '3.00';

    private const NONE_MARKER = 'NONE';

    /** @var array<string, array<string, Subject>> college value => subject_code_key => Subject */
    private array $subjectIndex = [];

    /** @var array<string, CurriculumSubject> "{college}:{subject_code_key}" => CurriculumSubject */
    private array $placementIndex = [];

    /** @var list<string> */
    private array $warnings = [];

    /**
     * `$csvPathOverride` exists only so tests can point this seeder at a
     * small fixture CSV to exercise the self-reference / unresolved-
     * prerequisite warning paths deterministically, without depending on
     * whether the real 409-row catalog happens to contain such a case.
     * Laravel's container resolves this with no arguments during normal
     * seeding, so the default keeps that path unaffected.
     */
    public function __construct(private readonly ?string $csvPathOverride = null) {}

    public function run(): void
    {
        $this->guardEnvironment();

        $rows = $this->readCsv($this->csvPathOverride ?? self::CSV_PATH);

        DB::transaction(function () use ($rows): void {
            $curricula = $this->seedScaffold();

            foreach ($rows as $row) {
                $this->seedSubjectAndPlacement($row, $curricula);
            }

            foreach ($rows as $row) {
                $this->seedPrerequisites($row);
            }
        });

        $this->reportWarnings();
    }

    /**
     * @return list<array<string, string>>
     */
    private function readCsv(string $path): array
    {
        if (! is_file($path)) {
            throw new RuntimeException(
                "AllOrganizationsSubjectsPrerequisitesSeeder could not find its CSV fixture at {$path}",
            );
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
                $header = array_map(static fn (?string $value): string => trim((string) $value), $line);

                // The source file carries a UTF-8 BOM, which otherwise
                // prepends invisible bytes to the first column name
                // ("organization"), silently breaking every `$row['organization']`
                // lookup below.
                if (isset($header[0]) && str_starts_with($header[0], "\xEF\xBB\xBF")) {
                    $header[0] = substr($header[0], 3);
                }

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
     * @return array<string, Curriculum> college value => Curriculum
     */
    private function seedScaffold(): array
    {
        $curricula = [];

        foreach (CollegeCode::cases() as $college) {
            $program = Program::updateOrCreate(
                ['code' => strtoupper($college->value).'-CATALOG'],
                [
                    'name' => $college->label().' — Subject Catalog Import (placeholder)',
                    'status' => ProgramStatus::Active,
                    'college' => $college,
                ],
            );

            $curricula[$college->value] = Curriculum::updateOrCreate(
                ['program_id' => $program->id, 'name' => $college->label().' — Subject Catalog Import'],
                [
                    'effective_school_year' => '2022-2023',
                    'status' => CurriculumStatus::Active,
                ],
            );
        }

        return $curricula;
    }

    /**
     * @param  array<string, string>  $row
     * @param  array<string, Curriculum>  $curricula
     */
    private function seedSubjectAndPlacement(array $row, array $curricula): void
    {
        $college = CollegeCode::tryFrom(strtolower(trim($row['organization'] ?? '')));

        if ($college === null) {
            $this->warnings[] = "Row for subject '{$row['subject_code']}' has unrecognised organization '{$row['organization']}' — skipped.";

            return;
        }

        $subject = Subject::updateOrCreate(
            ['college' => $college, 'code' => trim($row['subject_code'])],
            [
                'title' => trim($row['description']),
                'units' => (float) $row['units'],
                'status' => SubjectStatus::Active,
            ],
        );

        $placement = CurriculumSubject::updateOrCreate(
            ['curriculum_id' => $curricula[$college->value]->id, 'subject_id' => $subject->id],
            [
                'year_level' => CatalogSectionMetadata::yearLevel($row['sections'] ?? ''),
                'semester' => CatalogSectionMetadata::semester($row['offered_semesters'] ?? '1st Semester'),
                'is_required' => true,
            ],
        );

        $key = strtoupper(trim($row['subject_code_key']));
        $this->subjectIndex[$college->value][$key] = $subject;
        $this->placementIndex[$college->value.':'.$key] = $placement;
    }

    /**
     * @param  array<string, string>  $row
     */
    private function seedPrerequisites(array $row): void
    {
        $college = CollegeCode::tryFrom(strtolower(trim($row['organization'] ?? '')));

        if ($college === null) {
            return;
        }

        $prerequisiteCodes = trim($row['prerequisite_codes'] ?? self::NONE_MARKER);

        if ($prerequisiteCodes === '' || strtoupper($prerequisiteCodes) === self::NONE_MARKER) {
            return;
        }

        $ownKey = strtoupper(trim($row['subject_code_key']));
        $placement = $this->placementIndex[$college->value.':'.$ownKey] ?? null;

        if ($placement === null) {
            $this->warnings[] = "Prerequisite skipped: subject '{$row['subject_code']}' ({$college->value}) has no recorded placement.";

            return;
        }

        $candidates = array_map('trim', explode('|', $prerequisiteCodes));
        $resolvedAny = false;

        foreach ($candidates as $candidate) {
            $candidateKey = strtoupper($candidate);

            if ($candidateKey === $ownKey) {
                $this->warnings[] = "Self-referencing prerequisite ignored: '{$row['subject_code']}' ({$college->value}) lists itself as its own prerequisite.";

                continue;
            }

            $prerequisiteSubject = $this->subjectIndex[$college->value][$candidateKey] ?? null;

            if ($prerequisiteSubject === null) {
                $this->warnings[] = "Unresolved prerequisite: '{$row['subject_code']}' ({$college->value}) references unknown code '{$candidate}'.";

                continue;
            }

            SubjectPrerequisite::updateOrCreate(
                [
                    'curriculum_subject_id' => $placement->id,
                    'prerequisite_subject_id' => $prerequisiteSubject->id,
                ],
                ['minimum_grade' => self::PLACEHOLDER_MINIMUM_GRADE],
            );

            $resolvedAny = true;
        }

        if (! $resolvedAny) {
            $this->warnings[] = "No prerequisite candidate resolved for '{$row['subject_code']}' ({$college->value}) out of [{$prerequisiteCodes}].";
        }
    }

    /**
     * Logged rather than written to `$this->command` — this seeder is
     * exercised both through `db:seed` (where `$command` is set) and by
     * instantiating it directly in tests (where it never is), and the log
     * channel works identically either way.
     */
    private function reportWarnings(): void
    {
        foreach ($this->warnings as $warning) {
            Log::warning('[AllOrganizationsSubjectsPrerequisitesSeeder] '.$warning);
        }
    }

    /**
     * @return list<string>
     */
    public function warnings(): array
    {
        return $this->warnings;
    }

    /**
     * Real institutional data must never reach a production-like environment
     * through a seeder — the same guard every other seeder in this project
     * carries.
     */
    private function guardEnvironment(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException(
                'AllOrganizationsSubjectsPrerequisitesSeeder may only run in the local or testing environment. '
                .'Refusing to seed organization subject data into "'.app()->environment().'".',
            );
        }
    }
}
