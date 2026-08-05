<?php

namespace Database\Seeders;

use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Program;
use App\Models\Subject;
use App\Models\SubjectPrerequisite;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Seeds "BSIT Grade History Demo 2026" — the single synthetic curriculum
 * `DemoEnrollmentSeeder`'s 8 seeded students and their locked grade history
 * are placed on. Deliberately isolated on the collegeless `BSIT-DEMO`
 * program (see `ProgramSeeder`) so `GrcCurriculumSeeder` never touches it —
 * that seeder places the real catalog onto every one of the 12 real
 * programs, which would otherwise dump dozens of unrelated required
 * subjects onto this roster (see docs/testing/SEEDED_IDENTITIES.md, "Why a
 * dedicated curriculum").
 *
 * This is NOT the real GRC curriculum. Subject placements, year levels, and
 * the prerequisite chain are invented placeholders using `SubjectSeeder`'s
 * synthetic catalog (`CS101`, `MATH101`, …), not the real GRC subjects
 * `GrcSubjectCatalogSeeder` seeds.
 *
 * IMPORTANT — `minimum_grade` is a PLACEHOLDER, not an approved policy value.
 * PRD §17 lists the official passing-grade rule, special marks, and equivalent
 * grades as open decisions requiring GRC approval. The column is NOT NULL, so
 * a value must be supplied; '3.00' is used only because it is the conventional
 * Philippine passing mark. Nothing in this system interprets it yet.
 *
 * Depends on ProgramSeeder and SubjectSeeder having run first.
 */
final class DemoGradeHistoryCurriculumSeeder extends Seeder
{
    private const PLACEHOLDER_MINIMUM_GRADE = '3.00';

    private const PROGRAM_CODE = 'BSIT-DEMO';

    private const CURRICULUM_NAME = 'BSIT Grade History Demo 2026';

    /**
     * `SubjectSeeder` seeds every other synthetic code this curriculum
     * places (`CS101`, `MATH101`, …), but not Leadership — this seeder owns
     * `LEAD 1`–`LEAD8` itself, collegeless, the same isolation the whole
     * `BSIT-DEMO` fixture uses. The real GRC catalog (`GrcSubjectCatalogSeeder`)
     * also has rows spelled `LEAD 1`/`LEAD8` under real colleges, but this
     * fixture must never resolve to one of those — a collegeless code here
     * can never collide with a `(college, code)`-unique real-catalog row.
     *
     * @var list<string>
     */
    private const LEADERSHIP_SUBJECTS = ['LEAD 1', 'LEAD 2', 'LEAD 3', 'LEAD 4', 'LEAD 5', 'LEAD 6', 'LEAD 7', 'LEAD8'];

    /**
     * Maps a subject code to its year level, semester, and whether it is
     * required. Leadership (completion-only, C/NC — see App\Domain\Academic\
     * GradeMark/CompletionOnlySubjectRule) plus a core subject every
     * semester, spanning every ordinal from year 1 semester 1 through year 4
     * semester 2 — DemoEnrollmentSeeder's grade-history roster needs a real
     * placement at every one of those 8 positions.
     *
     * @var list<array{subject: string, year_level: int, semester: string, is_required: bool}>
     */
    private const PLACEMENTS = [
        ['subject' => 'CS101', 'year_level' => 1, 'semester' => '1st', 'is_required' => true],
        ['subject' => 'CS102', 'year_level' => 1, 'semester' => '1st', 'is_required' => true],
        ['subject' => 'MATH101', 'year_level' => 1, 'semester' => '1st', 'is_required' => true],
        ['subject' => 'GE101', 'year_level' => 1, 'semester' => '1st', 'is_required' => true],
        ['subject' => 'PE101', 'year_level' => 1, 'semester' => '1st', 'is_required' => true],
        ['subject' => 'LEAD 1', 'year_level' => 1, 'semester' => '1st', 'is_required' => true],
        ['subject' => 'CS201', 'year_level' => 1, 'semester' => '2nd', 'is_required' => true],
        ['subject' => 'MATH102', 'year_level' => 1, 'semester' => '2nd', 'is_required' => true],
        ['subject' => 'GE102', 'year_level' => 1, 'semester' => '2nd', 'is_required' => true],
        ['subject' => 'LEAD 2', 'year_level' => 1, 'semester' => '2nd', 'is_required' => true],
        ['subject' => 'CS202', 'year_level' => 2, 'semester' => '1st', 'is_required' => true],
        ['subject' => 'LEAD 3', 'year_level' => 2, 'semester' => '1st', 'is_required' => true],
        ['subject' => 'CS301', 'year_level' => 2, 'semester' => '2nd', 'is_required' => true],
        ['subject' => 'LEAD 4', 'year_level' => 2, 'semester' => '2nd', 'is_required' => true],
        ['subject' => 'CS302', 'year_level' => 3, 'semester' => '1st', 'is_required' => true],
        ['subject' => 'LEAD 5', 'year_level' => 3, 'semester' => '1st', 'is_required' => true],
        ['subject' => 'CS303', 'year_level' => 3, 'semester' => '2nd', 'is_required' => true],
        ['subject' => 'LEAD 6', 'year_level' => 3, 'semester' => '2nd', 'is_required' => true],
        ['subject' => 'CS401', 'year_level' => 4, 'semester' => '1st', 'is_required' => true],
        ['subject' => 'LEAD 7', 'year_level' => 4, 'semester' => '1st', 'is_required' => true],
        ['subject' => 'CS402', 'year_level' => 4, 'semester' => '2nd', 'is_required' => true],
        ['subject' => 'LEAD8', 'year_level' => 4, 'semester' => '2nd', 'is_required' => true],
    ];

    /**
     * Maps a target subject code to the subject codes that must be completed
     * first — deliberately a chain (CS102 → CS201 → CS202 → CS301) so the
     * prerequisite cycle detector and eligibility logic have something
     * non-trivial to work against.
     *
     * @var array<string, list<string>>
     */
    private const PREREQUISITES = [
        'CS201' => ['CS102'],
        'CS202' => ['CS201'],
        'CS301' => ['CS202'],
        'MATH102' => ['MATH101'],
        'LEAD 2' => ['LEAD 1'],
        'LEAD 3' => ['LEAD 2'],
        'LEAD 4' => ['LEAD 3'],
        'LEAD 5' => ['LEAD 4'],
        'LEAD 6' => ['LEAD 5'],
        'LEAD 7' => ['LEAD 6'],
        'LEAD8' => ['LEAD 7'],
        'CS302' => ['CS301'],
        'CS303' => ['CS302'],
        'CS401' => ['CS303'],
        'CS402' => ['CS401'],
    ];

    public function run(): void
    {
        $this->guardEnvironment();

        DB::transaction(function (): void {
            $program = Program::query()->where('code', self::PROGRAM_CODE)->firstOrFail();

            foreach (self::LEADERSHIP_SUBJECTS as $index => $code) {
                Subject::updateOrCreate(
                    ['college' => null, 'code' => $code],
                    ['title' => 'Leadership '.($index + 1), 'units' => 1.5, 'status' => SubjectStatus::Active],
                );
            }

            $curriculum = Curriculum::updateOrCreate(
                ['program_id' => $program->id, 'name' => self::CURRICULUM_NAME],
                ['effective_school_year' => '2022-2023', 'status' => CurriculumStatus::Active],
            );

            /** @var array<string, CurriculumSubject> $placements */
            $placements = [];

            foreach (self::PLACEMENTS as $placement) {
                $subject = $this->subject($placement['subject']);

                $placements[$placement['subject']] = CurriculumSubject::updateOrCreate(
                    ['curriculum_id' => $curriculum->id, 'subject_id' => $subject->id],
                    [
                        'year_level' => $placement['year_level'],
                        'semester' => $placement['semester'],
                        'is_required' => $placement['is_required'],
                    ],
                );
            }

            foreach (self::PREREQUISITES as $targetCode => $requiredCodes) {
                if (! isset($placements[$targetCode])) {
                    throw new RuntimeException(
                        "Prerequisite target '{$targetCode}' is not placed in curriculum "
                        ."'".self::CURRICULUM_NAME."'. Fix the seeder definition.",
                    );
                }

                foreach ($requiredCodes as $requiredCode) {
                    SubjectPrerequisite::updateOrCreate(
                        [
                            'curriculum_subject_id' => $placements[$targetCode]->id,
                            'prerequisite_subject_id' => $this->subject($requiredCode)->id,
                        ],
                        ['minimum_grade' => self::PLACEHOLDER_MINIMUM_GRADE],
                    );
                }
            }
        });
    }

    /**
     * `LEAD 1`–`LEAD8` are seeded collegeless above precisely because the
     * real GRC catalog (`GrcSubjectCatalogSeeder`) also has rows spelled
     * identically under real colleges — an unscoped `where('code', ...)`
     * lookup could silently resolve to one of those instead, and worse,
     * `updateOrCreate` on that ambiguous match would corrupt a real
     * subject's title with this fixture's placeholder text. Every other
     * code this curriculum places is collision-free with the real catalog
     * (see `SubjectSeeder`'s docblock), so only Leadership needs the
     * explicit `college => null` scope.
     */
    private function subject(string $code): Subject
    {
        $query = Subject::query()->where('code', $code);

        if (in_array($code, self::LEADERSHIP_SUBJECTS, true)) {
            $query->whereNull('college');
        }

        return $query->firstOrFail();
    }

    /**
     * Synthetic reference data must never reach a production-like environment.
     */
    private function guardEnvironment(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException(
                'DemoGradeHistoryCurriculumSeeder may only run in the local or testing environment. '
                .'Refusing to seed synthetic curriculum data into "'.app()->environment().'".',
            );
        }
    }
}
