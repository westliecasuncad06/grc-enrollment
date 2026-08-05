<?php

namespace Database\Seeders;

use App\Domain\Curriculum\CurriculumStatus;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Program;
use App\Models\Subject;
use App\Models\SubjectPrerequisite;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Seeds synthetic curricula, their subject placements, and a genuine
 * multi-step prerequisite chain for local development and automated tests.
 *
 * This is NOT the real GRC curriculum. Subject placements, year levels, and
 * the prerequisite graph are invented placeholders.
 *
 * IMPORTANT — `minimum_grade` is a PLACEHOLDER, not an approved policy value.
 * PRD §17 lists the official passing-grade rule, special marks, and equivalent
 * grades as open decisions requiring GRC approval. The column is NOT NULL, so
 * a value must be supplied; '3.00' is used only because it is the conventional
 * Philippine passing mark. Nothing in this system interprets it yet.
 *
 * Depends on ProgramSeeder and SubjectSeeder having run first.
 */
final class CurriculumSeeder extends Seeder
{
    private const PLACEHOLDER_MINIMUM_GRADE = '3.00';

    /**
     * Curriculum definitions keyed by the owning program code.
     *
     * `placements` maps a subject code to its year level, semester, and whether
     * it is required. `prerequisites` maps a target subject code to the subject
     * codes that must be completed first — deliberately a chain
     * (CS102 → CS201 → CS202 → CS301) so the prerequisite cycle detector and
     * eligibility logic have something non-trivial to work against.
     *
     * @var list<array{
     *     program_code: string,
     *     name: string,
     *     effective_school_year: string,
     *     status: CurriculumStatus,
     *     placements: list<array{subject: string, year_level: int, semester: string, is_required: bool}>,
     *     prerequisites: array<string, list<string>>
     * }>
     */
    private const CURRICULA = [
        [
            'program_code' => 'BSCS',
            'name' => 'BSCS Curriculum 2026',
            'effective_school_year' => '2022-2023',
            'status' => CurriculumStatus::Active,
            'placements' => [
                ['subject' => 'CS101', 'year_level' => 1, 'semester' => '1st', 'is_required' => true],
                ['subject' => 'CS102', 'year_level' => 1, 'semester' => '1st', 'is_required' => true],
                ['subject' => 'MATH101', 'year_level' => 1, 'semester' => '1st', 'is_required' => true],
                ['subject' => 'GE101', 'year_level' => 1, 'semester' => '1st', 'is_required' => true],
                ['subject' => 'PE101', 'year_level' => 1, 'semester' => '1st', 'is_required' => true],
                ['subject' => 'CS201', 'year_level' => 1, 'semester' => '2nd', 'is_required' => true],
                ['subject' => 'MATH102', 'year_level' => 1, 'semester' => '2nd', 'is_required' => true],
                ['subject' => 'GE102', 'year_level' => 1, 'semester' => '2nd', 'is_required' => true],
                ['subject' => 'CS202', 'year_level' => 2, 'semester' => '1st', 'is_required' => true],
                ['subject' => 'CS301', 'year_level' => 2, 'semester' => '2nd', 'is_required' => true],
            ],
            'prerequisites' => [
                'CS201' => ['CS102'],
                'CS202' => ['CS201'],
                'CS301' => ['CS202'],
                'MATH102' => ['MATH101'],
            ],
        ],
        // Deliberately on the collegeless 'BSIT-DEMO' program (see
        // ProgramSeeder), not "BSCS Curriculum 2026" above: any curriculum
        // under a college-bearing program gets the entire real catalog
        // dumped onto it by CatalogCurriculumPlacementSeeder, which would
        // silently add ~100 unrelated required subjects on top of these 22.
        // Leadership (completion-only, C/NC — see App\Domain\Academic\
        // GradeMark/CompletionOnlySubjectRule) plus a core subject every
        // semester, spanning every ordinal from year 1 semester 1 through
        // year 4 semester 2 — DemoEnrollmentSeeder's grade-history roster
        // needs a real placement at every one of those 8 positions.
        [
            'program_code' => 'BSIT-DEMO',
            'name' => 'BSIT Grade History Demo 2026',
            'effective_school_year' => '2022-2023',
            'status' => CurriculumStatus::Active,
            'placements' => [
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
            ],
            'prerequisites' => [
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
            ],
        ],
        [
            'program_code' => 'BSIT',
            'name' => 'BSIT Curriculum 2026',
            'effective_school_year' => '2022-2023',
            'status' => CurriculumStatus::Active,
            'placements' => [
                ['subject' => 'CS101', 'year_level' => 1, 'semester' => '1st', 'is_required' => true],
                ['subject' => 'CS102', 'year_level' => 1, 'semester' => '1st', 'is_required' => true],
                ['subject' => 'GE101', 'year_level' => 1, 'semester' => '1st', 'is_required' => true],
                ['subject' => 'IT101', 'year_level' => 1, 'semester' => '2nd', 'is_required' => true],
                ['subject' => 'IT201', 'year_level' => 2, 'semester' => '1st', 'is_required' => false],
            ],
            'prerequisites' => [
                'IT101' => ['CS102'],
            ],
        ],
        // Deliberately still draft: proves learner-scoped roles cannot see a
        // curriculum that is still being authored (Curriculum::scopeVisibleTo).
        [
            'program_code' => 'BSCS',
            'name' => 'BSCS Curriculum 2027 (Proposed)',
            'effective_school_year' => '2023-2024',
            'status' => CurriculumStatus::Draft,
            'placements' => [
                ['subject' => 'CS101', 'year_level' => 1, 'semester' => '1st', 'is_required' => true],
            ],
            'prerequisites' => [],
        ],
    ];

    public function run(): void
    {
        $this->guardEnvironment();

        DB::transaction(function (): void {
            foreach (self::CURRICULA as $definition) {
                $this->seedCurriculum($definition);
            }
        });
    }

    /**
     * @param  array{
     *     program_code: string,
     *     name: string,
     *     effective_school_year: string,
     *     status: CurriculumStatus,
     *     placements: list<array{subject: string, year_level: int, semester: string, is_required: bool}>,
     *     prerequisites: array<string, list<string>>
     * }  $definition
     */
    private function seedCurriculum(array $definition): void
    {
        $program = Program::query()
            ->where('code', $definition['program_code'])
            ->firstOrFail();

        $curriculum = Curriculum::updateOrCreate(
            ['program_id' => $program->id, 'name' => $definition['name']],
            [
                'effective_school_year' => $definition['effective_school_year'],
                'status' => $definition['status'],
            ],
        );

        /** @var array<string, CurriculumSubject> $placements */
        $placements = [];

        foreach ($definition['placements'] as $placement) {
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

        foreach ($definition['prerequisites'] as $targetCode => $requiredCodes) {
            if (! isset($placements[$targetCode])) {
                throw new RuntimeException(
                    "Prerequisite target '{$targetCode}' is not placed in curriculum "
                    ."'{$definition['name']}'. Fix the seeder definition.",
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
    }

    private function subject(string $code): Subject
    {
        return Subject::query()->where('code', $code)->firstOrFail();
    }

    /**
     * Synthetic reference data must never reach a production-like environment.
     */
    private function guardEnvironment(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException(
                'CurriculumSeeder may only run in the local or testing environment. '
                .'Refusing to seed synthetic curriculum data into "'.app()->environment().'".',
            );
        }
    }
}
