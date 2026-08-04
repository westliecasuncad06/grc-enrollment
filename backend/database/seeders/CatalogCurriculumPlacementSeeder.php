<?php

namespace Database\Seeders;

use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Organization\CatalogSectionMetadata;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Subject;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use SplFileObject;

/**
 * Applies the supplied all-organizations catalog to every active local
 * curriculum. The existing synthetic curriculum records remain available for
 * tests, but their subject placements now carry the catalog's units, year
 * levels, and semester coverage so Program Chair release is not limited to
 * first-year placeholder rows.
 */
final class CatalogCurriculumPlacementSeeder extends Seeder
{
    private const CSV_PATH = __DIR__.'/data/organizations-subjects-prerequisites.csv';

    public function run(): void
    {
        $this->guardEnvironment();

        $rows = $this->readCsv();

        DB::transaction(function () use ($rows): void {
            $curricula = Curriculum::query()
                ->where('status', CurriculumStatus::Active)
                ->whereHas('program', fn ($programs) => $programs->whereNotNull('college'))
                ->with('program')
                ->get();

            foreach ($curricula as $curriculum) {
                $college = $curriculum->program->college?->value;

                if ($college === null) {
                    continue;
                }

                foreach ($rows as $row) {
                    if (strtolower(trim($row['organization'] ?? '')) !== $college) {
                        continue;
                    }

                    $subject = Subject::query()
                        ->where('college', $college)
                        ->where('code', trim($row['subject_code'] ?? ''))
                        ->first();

                    if ($subject === null) {
                        continue;
                    }

                    CurriculumSubject::updateOrCreate(
                        ['curriculum_id' => $curriculum->id, 'subject_id' => $subject->id],
                        [
                            'year_level' => CatalogSectionMetadata::yearLevel($row['sections'] ?? ''),
                            'semester' => CatalogSectionMetadata::semester($row['offered_semesters'] ?? '1st Semester'),
                            'is_required' => true,
                        ],
                    );
                }
            }
        });
    }

    /** @return list<array<string, string>> */
    private function readCsv(): array
    {
        if (! is_file(self::CSV_PATH)) {
            throw new RuntimeException('Catalog CSV not found at '.self::CSV_PATH);
        }

        $file = new SplFileObject(self::CSV_PATH);
        $file->setFlags(SplFileObject::READ_CSV | SplFileObject::SKIP_EMPTY | SplFileObject::DROP_NEW_LINE);
        $header = null;
        $rows = [];

        foreach ($file as $line) {
            if (! is_array($line) || $line === [null]) {
                continue;
            }

            if ($header === null) {
                $header = array_map(static fn (?string $value): string => trim((string) $value), $line);
                if (isset($header[0]) && str_starts_with($header[0], "\xEF\xBB\xBF")) {
                    $header[0] = substr($header[0], 3);
                }

                continue;
            }

            if (count($line) === count($header)) {
                /** @var array<string, string> $row */
                $row = array_combine($header, $line);
                $rows[] = $row;
            }
        }

        return $rows;
    }

    private function guardEnvironment(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException(
                'CatalogCurriculumPlacementSeeder may only run in local or testing environments.',
            );
        }
    }
}
