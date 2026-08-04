<?php

namespace Tests\Feature\Database;

use App\Domain\Curriculum\SubjectStatus;
use App\Models\Subject;
use Database\Seeders\CcsSubjectSeeder;
use Database\Seeders\SubjectSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

final class CcsSubjectSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_creates_the_real_ccs_catalog(): void
    {
        $this->seed(CcsSubjectSeeder::class);

        $this->assertDatabaseCount('subjects', 88);
        $this->assertSame(
            1.5,
            Subject::where('code', 'LEAD 1')->sole()->units,
        );
        $this->assertSame(
            SubjectStatus::Active,
            Subject::where('code', 'LEAD8')->sole()->status,
        );
    }

    public function test_seeder_does_not_collide_with_the_synthetic_catalog(): void
    {
        $this->seed(SubjectSeeder::class);
        $this->seed(CcsSubjectSeeder::class);

        $this->assertDatabaseCount('subjects', 17 + 88);
        $this->assertDatabaseHas('subjects', ['code' => 'CS101']);
        $this->assertDatabaseHas('subjects', ['code' => 'LEAD 1']);
    }

    public function test_reseeding_updates_in_place_without_duplicates(): void
    {
        $this->seed(CcsSubjectSeeder::class);
        $originalIds = Subject::orderBy('id')->pluck('id')->all();

        $this->seed(CcsSubjectSeeder::class);

        $this->assertSame(88, Subject::count());
        $this->assertSame($originalIds, Subject::orderBy('id')->pluck('id')->all());
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

        app(CcsSubjectSeeder::class)->run();
    }
}
