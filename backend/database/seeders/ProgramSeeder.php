<?php

namespace Database\Seeders;

use App\Domain\Organization\CollegeCode;
use App\Domain\Organization\ProgramStatus;
use App\Models\Program;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Seeds a small synthetic program catalog for local development and
 * automated tests. This is NOT the real GRC program catalog — the
 * institutional catalog and status vocabulary remain unconfirmed under
 * PRD §17 (see App\Domain\Organization\ProgramStatus).
 */
final class ProgramSeeder extends Seeder
{
    /**
     * @var list<array{code: string, name: string, status: ProgramStatus, college: ?CollegeCode}>
     */
    private const PROGRAMS = [
        ['code' => 'BSIT', 'name' => 'BS Information Technology', 'status' => ProgramStatus::Active, 'college' => CollegeCode::Ccs],
        ['code' => 'BSCS', 'name' => 'BS Computer Science', 'status' => ProgramStatus::Active, 'college' => CollegeCode::Ccs],
        // Deliberately inactive: proves learner-scoped and planning roles
        // receive different GET /api/v1/programs results. Left collegeless —
        // Criminology is outside the four currently supported colleges.
        ['code' => 'BSCRIM', 'name' => 'BS Criminology', 'status' => ProgramStatus::Inactive, 'college' => null],
        // Deliberately collegeless: DemoEnrollmentSeeder's grade-history
        // roster needs a curriculum CatalogCurriculumPlacementSeeder will
        // never touch — that seeder targets every active curriculum whose
        // program has a college, which would otherwise dump the entire real
        // CCS catalog (~100 subjects) onto whatever curriculum these
        // students are placed on. See CurriculumSeeder's matching entry.
        ['code' => 'BSCS-DEMO', 'name' => 'BS Computer Science (Grade History Demo)', 'status' => ProgramStatus::Active, 'college' => null],
    ];

    public function run(): void
    {
        $this->guardEnvironment();

        DB::transaction(function (): void {
            foreach (self::PROGRAMS as $program) {
                Program::updateOrCreate(
                    ['code' => $program['code']],
                    ['name' => $program['name'], 'status' => $program['status'], 'college' => $program['college']],
                );
            }
        });
    }

    /**
     * Synthetic reference data must never reach a production-like environment.
     */
    private function guardEnvironment(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException(
                'ProgramSeeder may only run in the local or testing environment. '
                .'Refusing to seed synthetic program data into "'.app()->environment().'".',
            );
        }
    }
}
