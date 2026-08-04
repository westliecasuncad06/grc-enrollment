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
            // Additive: the real GRC CCS catalog, alongside (not replacing)
            // the synthetic subjects above. See CcsSubjectSeeder's docblock.
            CcsSubjectSeeder::class,
            // Additive: the real four-college (CCS/COE/COA/CBAE) catalog,
            // via placeholder per-college Program/Curriculum scaffolds. See
            // AllOrganizationsSubjectsPrerequisitesSeeder's docblock.
            AllOrganizationsSubjectsPrerequisitesSeeder::class,
            CurriculumSeeder::class,
            CatalogCurriculumPlacementSeeder::class,
            RoomCatalogSeeder::class,
            CatalogFacultySeeder::class,
            SectionSeeder::class,
            DemoEnrollmentSeeder::class,
            ProgramChairScheduleSampleSeeder::class,
        ]);
    }
}
