<?php

namespace Tests\Feature\Database;

use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\ProgramStatus;
use App\Models\AcademicTerm;
use App\Models\Program;
use Database\Seeders\AcademicTermSeeder;
use Database\Seeders\ProgramSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

final class ReferenceDataSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_program_seeder_creates_the_expected_synthetic_catalog(): void
    {
        $this->seed(ProgramSeeder::class);

        $this->assertDatabaseCount('programs', 3);
        $this->assertSame(
            ProgramStatus::Inactive,
            Program::where('code', 'BSCRIM')->sole()->status,
        );
    }

    public function test_academic_term_seeder_creates_the_expected_synthetic_calendar(): void
    {
        $this->seed(AcademicTermSeeder::class);

        $this->assertDatabaseCount('academic_terms', 3);
        $this->assertSame(
            AcademicTermStatus::Planning,
            AcademicTerm::where('school_year', '2027-2028')->sole()->status,
        );
    }

    public function test_reseeding_programs_updates_in_place_without_duplicates(): void
    {
        $this->seed(ProgramSeeder::class);
        $originalIds = Program::orderBy('id')->pluck('id')->all();

        $this->seed(ProgramSeeder::class);

        $this->assertSame(3, Program::count());
        $this->assertSame($originalIds, Program::orderBy('id')->pluck('id')->all());
    }

    public function test_reseeding_academic_terms_updates_in_place_without_duplicates(): void
    {
        $this->seed(AcademicTermSeeder::class);
        $originalIds = AcademicTerm::orderBy('id')->pluck('id')->all();

        $this->seed(AcademicTermSeeder::class);

        $this->assertSame(3, AcademicTerm::count());
        $this->assertSame($originalIds, AcademicTerm::orderBy('id')->pluck('id')->all());
    }

    /**
     * Invoked directly rather than through `db:seed`, because the artisan
     * command's own production confirmation prompt would intercept the call
     * before the seeder runs — see RoleUserSeederTest for the same pattern.
     */
    public function test_program_seeder_refuses_to_run_outside_local_and_testing(): void
    {
        app()->detectEnvironment(static fn (): string => 'production');

        $this->expectException(RuntimeException::class);

        app(ProgramSeeder::class)->run();
    }

    public function test_academic_term_seeder_refuses_to_run_outside_local_and_testing(): void
    {
        app()->detectEnvironment(static fn (): string => 'production');

        $this->expectException(RuntimeException::class);

        app(AcademicTermSeeder::class)->run();
    }
}
