<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Runs the full synthetic development dataset.
 *
 * Order is a genuine dependency chain, not a preference: curricula need
 * programs and subjects, sections need subjects/terms/faculty, and the demo
 * enrollments need all of the above. Every seeder is individually idempotent,
 * so re-running this is safe.
 */
final class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RoleUserSeeder::class,
            ProgramSeeder::class,
            AcademicTermSeeder::class,
            SubjectSeeder::class,
            CurriculumSeeder::class,
            SectionSeeder::class,
            DemoEnrollmentSeeder::class,
        ]);
    }
}
