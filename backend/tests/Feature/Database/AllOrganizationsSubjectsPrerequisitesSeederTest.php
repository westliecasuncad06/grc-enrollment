<?php

namespace Tests\Feature\Database;

use App\Domain\Organization\CollegeCode;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Program;
use App\Models\Subject;
use App\Models\SubjectPrerequisite;
use Database\Seeders\AllOrganizationsSubjectsPrerequisitesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

final class AllOrganizationsSubjectsPrerequisitesSeederTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Small, deliberately malformed fixture exercising the guard paths the
     * real 409-row catalog may or may not happen to contain: a clean
     * prerequisite chain (TEST2 -> TEST1), a self-referencing row (TEST3),
     * and an unresolvable prerequisite reference (TEST4 -> NOPE).
     */
    private const FIXTURE_CSV = <<<'CSV'
        organization,subject_code,subject_code_key,description,description_variants,units,offered_semesters,source_academic_years,prerequisite_codes,prerequisite_logic,prerequisite_confidence,possible_prerequisite_codes,possible_prerequisite_logic,professor_surnames,sections,prerequisite_notes
        CCS,TEST1,TEST1,Test Subject One,Test Subject One,3,1st Semester,AY 2026-2027,NONE,NONE,NONE_IDENTIFIED,NONE,NONE,SURNAME,SEC 101,No prerequisite.
        CCS,TEST2,TEST2,Test Subject Two,Test Subject Two,3,1st Semester,AY 2026-2027,TEST1,ALL,INFERRED_SEQUENCE,NONE,NONE,SURNAME,SEC 101,Follows Test Subject One.
        CCS,TEST3,TEST3,Test Subject Three,Test Subject Three,3,1st Semester,AY 2026-2027,TEST3,ALL,INFERRED_SEQUENCE,NONE,NONE,SURNAME,SEC 101,Self-referencing test row.
        CCS,TEST4,TEST4,Test Subject Four,Test Subject Four,3,1st Semester,AY 2026-2027,NOPE,ALL,INFERRED_SEQUENCE,NONE,NONE,SURNAME,SEC 101,Unresolvable prerequisite test row.

        CSV;

    public function test_seeder_creates_the_real_four_college_catalog(): void
    {
        $this->seed(AllOrganizationsSubjectsPrerequisitesSeeder::class);

        $this->assertDatabaseCount('subjects', 409);
        $this->assertSame(103, Subject::where('college', CollegeCode::Ccs)->count());
        $this->assertSame(142, Subject::where('college', CollegeCode::Coe)->count());
        $this->assertSame(70, Subject::where('college', CollegeCode::Coa)->count());
        $this->assertSame(94, Subject::where('college', CollegeCode::Cbae)->count());

        $this->assertDatabaseCount('programs', 4);
        $this->assertDatabaseCount('curricula', 4);
        $this->assertDatabaseHas('programs', ['code' => 'CCS-CATALOG', 'college' => 'ccs']);
    }

    public function test_seeder_creates_no_college_outside_the_supported_four(): void
    {
        $this->seed(AllOrganizationsSubjectsPrerequisitesSeeder::class);

        $this->assertSame(
            0,
            Subject::whereNotIn('college', ['ccs', 'coe', 'coa', 'cbae'])->count(),
        );
        $this->assertSame(
            0,
            Subject::whereRaw('LOWER(title) LIKE ?', ['%criminology%'])->count(),
        );
    }

    public function test_a_known_prerequisite_chain_resolves(): void
    {
        $this->seed(AllOrganizationsSubjectsPrerequisitesSeeder::class);

        $implementation = Subject::where('college', CollegeCode::Cbae)->where('code', 'BP IMPLE1')->sole();
        $preparation = Subject::where('college', CollegeCode::Cbae)->where('code', 'BP-PRE')->sole();
        $placement = CurriculumSubject::where('subject_id', $implementation->id)->sole();

        $this->assertDatabaseHas('subject_prerequisites', [
            'curriculum_subject_id' => $placement->id,
            'prerequisite_subject_id' => $preparation->id,
        ]);
    }

    public function test_reseeding_updates_in_place_without_duplicates(): void
    {
        $this->seed(AllOrganizationsSubjectsPrerequisitesSeeder::class);

        $subjectIds = Subject::orderBy('id')->pluck('id')->all();
        $programIds = Program::orderBy('id')->pluck('id')->all();
        $curriculumIds = Curriculum::orderBy('id')->pluck('id')->all();
        $prerequisiteIds = SubjectPrerequisite::orderBy('id')->pluck('id')->all();

        $this->seed(AllOrganizationsSubjectsPrerequisitesSeeder::class);

        $this->assertSame(409, Subject::count());
        $this->assertSame($subjectIds, Subject::orderBy('id')->pluck('id')->all());
        $this->assertSame($programIds, Program::orderBy('id')->pluck('id')->all());
        $this->assertSame($curriculumIds, Curriculum::orderBy('id')->pluck('id')->all());
        $this->assertSame($prerequisiteIds, SubjectPrerequisite::orderBy('id')->pluck('id')->all());
    }

    public function test_self_referencing_prerequisite_is_skipped_with_a_warning(): void
    {
        $fixturePath = $this->writeFixture();

        try {
            $seeder = $this->seederForFixture($fixturePath);
            $seeder->run();

            $test3 = Subject::where('college', CollegeCode::Ccs)->where('code', 'TEST3')->sole();
            $placement = CurriculumSubject::where('subject_id', $test3->id)->sole();

            $this->assertDatabaseMissing('subject_prerequisites', [
                'curriculum_subject_id' => $placement->id,
                'prerequisite_subject_id' => $test3->id,
            ]);
            $this->assertTrue(
                collect($seeder->warnings())->contains(fn (string $warning): bool => str_contains($warning, 'Self-referencing prerequisite ignored')),
                'Expected a self-referencing-prerequisite warning.',
            );
        } finally {
            unlink($fixturePath);
        }
    }

    public function test_unresolved_prerequisite_is_skipped_with_a_warning_not_an_exception(): void
    {
        $fixturePath = $this->writeFixture();

        try {
            $seeder = $this->seederForFixture($fixturePath);
            $seeder->run();

            $this->assertDatabaseCount('subject_prerequisites', 1); // only TEST2 -> TEST1 resolves
            $this->assertTrue(
                collect($seeder->warnings())->contains(fn (string $warning): bool => str_contains($warning, 'Unresolved prerequisite') && str_contains($warning, 'NOPE')),
                'Expected an unresolved-prerequisite warning mentioning NOPE.',
            );
        } finally {
            unlink($fixturePath);
        }
    }

    public function test_valid_prerequisite_chain_in_fixture_still_resolves(): void
    {
        $fixturePath = $this->writeFixture();

        try {
            $seeder = $this->seederForFixture($fixturePath);
            $seeder->run();

            $test1 = Subject::where('college', CollegeCode::Ccs)->where('code', 'TEST1')->sole();
            $test2 = Subject::where('college', CollegeCode::Ccs)->where('code', 'TEST2')->sole();
            $placement = CurriculumSubject::where('subject_id', $test2->id)->sole();

            $this->assertDatabaseHas('subject_prerequisites', [
                'curriculum_subject_id' => $placement->id,
                'prerequisite_subject_id' => $test1->id,
            ]);
        } finally {
            unlink($fixturePath);
        }
    }

    /**
     * Invoked directly rather than through `db:seed`, because the artisan
     * command's own production confirmation prompt would intercept the call
     * before the seeder runs — see RoleUserSeederTest for the same pattern.
     */
    public function test_seeder_refuses_to_run_outside_local_and_testing(): void
    {
        app()->detectEnvironment(static fn (): string => 'production');

        $this->expectException(RuntimeException::class);

        app(AllOrganizationsSubjectsPrerequisitesSeeder::class)->run();
    }

    private function writeFixture(): string
    {
        $path = tempnam(sys_get_temp_dir(), 'aosps_test_').'.csv';
        file_put_contents($path, self::FIXTURE_CSV);

        return $path;
    }

    private function seederForFixture(string $path): AllOrganizationsSubjectsPrerequisitesSeeder
    {
        return new AllOrganizationsSubjectsPrerequisitesSeeder($path);
    }
}
