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
            // Additive: one Program Chair per supported college, alongside
            // (not replacing) RoleUserSeeder's single generic chair.
            CollegeProgramChairSeeder::class,
            ProgramSeeder::class,
            AcademicTermSeeder::class,
            SubjectSeeder::class,
            // The real GRC catalog: 409 subjects across the 12 real
            // programs (see ProgramSeeder), 3 curriculum versions each,
            // the 74 confirmed prerequisites, and the active version's real
            // per-subject schedule/faculty reference data. See each
            // seeder's docblock.
            GrcSubjectCatalogSeeder::class,
            GrcCurriculumSeeder::class,
            GrcPrerequisiteSeeder::class,
            GrcCurriculumScheduleReferenceSeeder::class,
            RoomCatalogSeeder::class,
            CatalogFacultySeeder::class,
            SectionSeeder::class,
            DemoEnrollmentSeeder::class,
            ProgramChairScheduleSampleSeeder::class,
            SectionDemandObservationSeeder::class,
        ]);

        // Keep normal test fixtures lean. PredictivePlanningInputSeeder is
        // still test-safe when invoked explicitly, while local development
        // receives the synthetic planning inputs needed for a live smoke run.
        if (app()->environment('local')) {
            $this->call(PredictivePlanningInputSeeder::class);
        }
    }
}
