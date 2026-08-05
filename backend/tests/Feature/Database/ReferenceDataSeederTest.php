<?php

namespace Tests\Feature\Database;

use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\ProgramStatus;
use App\Models\AcademicTerm;
use App\Models\Program;
use Database\Seeders\AcademicTermSeeder;
use Database\Seeders\ProgramSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

final class ReferenceDataSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_program_seeder_creates_the_expected_synthetic_catalog(): void
    {
        $this->seed(ProgramSeeder::class);

        $this->assertDatabaseCount('programs', 4);
        $this->assertSame(
            ProgramStatus::Inactive,
            Program::where('code', 'BSCRIM')->sole()->status,
        );
        $this->assertNull(Program::where('code', 'BSIT-DEMO')->sole()->college);
    }

    /**
     * Six archived historical semesters (2023-2024 through 2025-2026), one
     * closed term (2026-2027 1st — so DemoEnrollmentSeeder has somewhere to
     * attach its most recent locked grades), and exactly one SemesterOngoing
     * current term (2026-2027 2nd) — the one actionable, immediately
     * enrollable term a clean seed leaves behind.
     */
    public function test_academic_term_seeder_creates_the_expected_eight_terms(): void
    {
        $this->seed(AcademicTermSeeder::class);

        $this->assertDatabaseCount('academic_terms', 8);
        $this->assertSame(6, AcademicTerm::where('status', AcademicTermStatus::Archived)->count());
        $this->assertSame(1, AcademicTerm::where('status', AcademicTermStatus::SemesterClosed)->count());
        $this->assertSame(1, AcademicTerm::where('status', AcademicTermStatus::SemesterOngoing)->count());
        $this->assertSame(
            [
                '2023-2024|1st', '2023-2024|2nd',
                '2024-2025|1st', '2024-2025|2nd',
                '2025-2026|1st', '2025-2026|2nd',
                '2026-2027|1st', '2026-2027|2nd',
            ],
            AcademicTerm::query()->orderBy('school_year')->orderBy('semester')->get()
                ->map(fn (AcademicTerm $term): string => "{$term->school_year}|{$term->semester}")
                ->all(),
        );

        $ongoing = AcademicTerm::where('status', AcademicTermStatus::SemesterOngoing)->sole();
        $this->assertSame(5, $ongoing->enrollmentWindows()->count());
        $this->assertNotNull($ongoing->enrollment_opens_at);
        $this->assertNotNull($ongoing->enrollment_closes_at);
        $this->assertTrue($ongoing->enrollment_opens_at->isPast());
        $this->assertTrue($ongoing->enrollment_closes_at->isFuture());
        $slot = DB::table('academic_term_current_slots')->where('id', 1)->first();
        $this->assertSame($ongoing->id, $slot->academic_term_id);
    }

    public function test_reseeding_programs_updates_in_place_without_duplicates(): void
    {
        $this->seed(ProgramSeeder::class);
        $originalIds = Program::orderBy('id')->pluck('id')->all();

        $this->seed(ProgramSeeder::class);

        $this->assertSame(4, Program::count());
        $this->assertSame($originalIds, Program::orderBy('id')->pluck('id')->all());
    }

    public function test_reseeding_academic_terms_updates_in_place_without_duplicates(): void
    {
        $this->seed(AcademicTermSeeder::class);
        $originalIds = AcademicTerm::orderBy('id')->pluck('id')->all();

        $this->seed(AcademicTermSeeder::class);

        $this->assertSame(8, AcademicTerm::count());
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
