<?php

namespace Tests\Feature\Database;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

final class CurriculumScheduleReferenceMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_curriculum_subjects_gains_the_reference_columns(): void
    {
        $this->assertTrue(Schema::hasColumns('curriculum_subjects', [
            'reference_day', 'reference_start_time', 'reference_end_time',
            'reference_room', 'reference_modality', 'reference_professor_name',
            'reference_sched_id', 'reference_notes',
        ]));
    }

    public function test_migrations_are_fully_reversible(): void
    {
        $this->artisan('migrate:rollback', ['--step' => 1])->assertExitCode(0);

        $this->assertFalse(Schema::hasColumn('curriculum_subjects', 'reference_day'));

        $this->artisan('migrate')->assertExitCode(0);

        $this->assertTrue(Schema::hasColumn('curriculum_subjects', 'reference_day'));
    }
}
