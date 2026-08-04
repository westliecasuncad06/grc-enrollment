<?php

namespace Tests\Feature\Database;

use App\Domain\Academic\GradeStatus;
use App\Models\AcademicGrade;
use App\Models\AuditLog;
use App\Models\Curriculum;
use App\Models\Enrollment;
use App\Models\FacultyAvailability;
use App\Models\FacultySubjectPreference;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoEnrollmentSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

final class DemoEnrollmentSeederTest extends TestCase
{
    use RefreshDatabase;

    private const SEED_PASSWORD = 'password';

    /**
     * Eight student profiles, all with real locked grade history, but no
     * Enrollment row of their own yet — every one is left free to submit a
     * fresh enrollment against the current `semester_ongoing` term through
     * the real UI/API, which is the entire point of this seed.
     */
    public function test_a_clean_seed_creates_eight_student_profiles_but_no_enrollments(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(8, StudentProfile::count());
        $this->assertSame(0, Enrollment::count());
    }

    /**
     * @return array<string, array{string, int, string}>
     */
    public static function studentRosterProvider(): array
    {
        return [
            '0001 year 1 regular' => ['STU-2026-0001', 1, 'regular'],
            '0002 year 2 regular' => ['STU-2026-0002', 2, 'regular'],
            '0003 year 3 regular' => ['STU-2026-0003', 3, 'regular'],
            '0004 year 4 regular' => ['STU-2026-0004', 4, 'regular'],
            '0005 year 2 irregular (failed subject)' => ['STU-2026-0005', 2, 'irregular'],
            '0006 year 2 irregular (incomplete)' => ['STU-2026-0006', 2, 'irregular'],
            '0007 year 3 irregular (NC on Leadership)' => ['STU-2026-0007', 3, 'irregular'],
            '0008 year 4 irregular (missing required subject)' => ['STU-2026-0008', 4, 'irregular'],
        ];
    }

    #[DataProvider('studentRosterProvider')]
    public function test_each_seeded_student_has_the_expected_year_level_and_derived_category(
        string $studentNumber,
        int $yearLevel,
        string $category,
    ): void {
        $this->seed(DatabaseSeeder::class);

        $profile = StudentProfile::query()->where('student_number', $studentNumber)->firstOrFail();

        $this->assertSame($yearLevel, $profile->year_level);
        // Never hard-coded: this is the real EnrollmentCategoryClassifier's
        // verdict against the grade history seeded just above it, proving
        // the seeder's own correctness.
        $this->assertSame($category, $profile->enrollment_category);
        $this->assertNotNull($profile->enrollment_category_derived_at);
    }

    /**
     * @return array<string, array{string, int}>
     */
    public static function gradeHistoryCountProvider(): array
    {
        return [
            '0001 — 1 completed semester' => ['STU-2026-0001', 6],
            '0002 — 3 completed semesters' => ['STU-2026-0002', 12],
            '0003 — 5 completed semesters' => ['STU-2026-0003', 16],
            '0004 — 7 completed semesters' => ['STU-2026-0004', 20],
            '0005 — 3 completed semesters' => ['STU-2026-0005', 12],
            '0006 — 3 completed semesters' => ['STU-2026-0006', 12],
            '0007 — 5 completed semesters' => ['STU-2026-0007', 16],
            // 7 completed semesters, minus the one deliberately omitted
            // required subject that makes this student Irregular.
            '0008 — 7 completed semesters, one omitted' => ['STU-2026-0008', 19],
        ];
    }

    #[DataProvider('gradeHistoryCountProvider')]
    public function test_each_seeded_student_has_the_expected_locked_grade_count(string $studentNumber, int $expectedCount): void
    {
        $this->seed(DatabaseSeeder::class);

        $profile = StudentProfile::query()->where('student_number', $studentNumber)->firstOrFail();
        $grades = AcademicGrade::query()->where('student_id', $profile->id)->get();

        $this->assertCount($expectedCount, $grades);
        $this->assertTrue($grades->every(fn (AcademicGrade $grade): bool => $grade->status === GradeStatus::Locked));
    }

    public function test_the_missing_subject_irregular_student_carries_the_expected_classification_reason(): void
    {
        $this->seed(DatabaseSeeder::class);

        $profile = StudentProfile::query()->where('student_number', 'STU-2026-0008')->firstOrFail();
        $log = AuditLog::query()
            ->where('auditable_type', 'student_profile')
            ->where('auditable_id', $profile->id)
            ->sole();

        $reasons = $log->after_values['reasons'] ?? [];
        $this->assertNotEmpty($reasons);
        $this->assertSame('missing_required_subject', $reasons[0]['code'] ?? null);
    }

    public function test_reseeding_creates_no_duplicates(): void
    {
        $this->seed(DatabaseSeeder::class);

        $profileIds = StudentProfile::orderBy('id')->pluck('id')->all();
        $gradeCount = AcademicGrade::count();

        $this->seed(DatabaseSeeder::class);

        $this->assertSame($profileIds, StudentProfile::orderBy('id')->pluck('id')->all());
        $this->assertSame($gradeCount, AcademicGrade::count());
    }

    public function test_seeded_student_emails_use_the_reserved_test_domain(): void
    {
        $this->seed(DatabaseSeeder::class);

        foreach (StudentProfile::with('user')->get() as $profile) {
            $this->assertStringEndsWith('@grc.test', $profile->user->email);
        }
    }

    public function test_every_seeded_student_account_uses_the_shared_development_password(): void
    {
        putenv('GRC_SEED_PASSWORD');

        $this->seed(DatabaseSeeder::class);

        $students = User::query()->where('role', 'student')->get();

        foreach ($students as $student) {
            $this->assertTrue(
                Hash::check(self::SEED_PASSWORD, $student->password),
                "Seeded student {$student->email} does not use the shared development password.",
            );
        }
    }

    /**
     * @return array<string, array{string, string, string}>
     */
    public static function connectedProfessorProvider(): array
    {
        return [
            'CS201' => ['CS201', 'Ramon Bautista', 'prof.bautista@grc.test'],
            'MATH102' => ['MATH102', 'Teresa Villanueva', 'prof.villanueva@grc.test'],
            'GE102' => ['GE102', 'Christian Dela Cruz', 'prof.dela-cruz@grc.test'],
            'LEAD 2' => ['LEAD 2', 'Angelica Reyes', 'prof.reyes@grc.test'],
            'CS301' => ['CS301', 'Michael Santos', 'prof.santos@grc.test'],
            'LEAD 4' => ['LEAD 4', 'Josephine Mendoza', 'prof.mendoza@grc.test'],
            'CS303' => ['CS303', 'Ferdinand Aquino', 'prof.aquino@grc.test'],
            'LEAD 6' => ['LEAD 6', 'Grace Manalo', 'prof.manalo@grc.test'],
            'CS402' => ['CS402', 'Rafael Torres', 'prof.torres@grc.test'],
            'LEAD8' => ['LEAD8', 'Cecilia Fernandez', 'prof.fernandez@grc.test'],
        ];
    }

    /**
     * Every block section of a subject, within the dedicated `BSCS-DEMO`
     * curriculum's own blocks (`BSCS101`..`BSCS401`) — across every block
     * code, in every year level that offers it — must be owned by that
     * subject's one real professor, not the old shared
     * `faculty.seed@grc.test` placeholder.
     *
     * Deliberately scoped to `BSCS-DEMO`, not "every `is_block_exclusive`
     * section of this subject code platform-wide": `LEAD8` (and other
     * Leadership codes) also appears in the synthetic BSIT curriculum that
     * `ProgramChairScheduleSampleSeeder` generates its own block sections
     * for (e.g. `IT401`), owned by that seeder's own "Sample Faculty" — an
     * unrelated fixture for a different testing purpose.
     */
    #[DataProvider('connectedProfessorProvider')]
    public function test_each_connected_professor_owns_every_block_section_of_their_subject(
        string $subjectCode,
        string $expectedName,
        string $expectedEmail,
    ): void {
        $this->seed(DatabaseSeeder::class);

        $professor = User::query()->where('email', $expectedEmail)->firstOrFail();
        $this->assertSame($expectedName, $professor->name);
        $this->assertSame('faculty', $professor->role->value);
        $this->assertSame('ccs', $professor->college?->value);

        $curriculum = Curriculum::query()->where('name', 'BSCS Grade History Demo 2026')->firstOrFail();
        $subject = Subject::query()->where('code', $subjectCode)->firstOrFail();
        $sections = Section::query()
            ->where('subject_id', $subject->id)
            ->where('is_block_exclusive', true)
            ->whereHas('sectionPlan', fn ($query) => $query->where('curriculum_id', $curriculum->id))
            ->get();

        $this->assertNotEmpty($sections);
        foreach ($sections as $section) {
            $this->assertSame(
                $professor->id,
                $section->professor_id,
                "Section {$section->section_code} of {$subjectCode} is not owned by {$expectedEmail}.",
            );
        }
    }

    #[DataProvider('connectedProfessorProvider')]
    public function test_each_connected_professor_has_declared_availability_and_a_subject_preference(
        string $subjectCode,
        string $expectedName,
        string $expectedEmail,
    ): void {
        $this->seed(DatabaseSeeder::class);

        $professor = User::query()->where('email', $expectedEmail)->firstOrFail();
        $subject = Subject::query()->where('code', $subjectCode)->firstOrFail();

        $this->assertSame(
            5,
            FacultyAvailability::query()->where('professor_id', $professor->id)->count(),
            "{$expectedName} should have one declared availability window per weekday.",
        );

        $preference = FacultySubjectPreference::query()
            ->where('professor_id', $professor->id)
            ->where('subject_id', $subject->id)
            ->sole();
        $this->assertSame(1, $preference->rank);
    }

    public function test_reseeding_ten_connected_professors_creates_no_duplicates(): void
    {
        $this->seed(DatabaseSeeder::class);
        $professorCount = User::query()->where('email', 'like', 'prof.%@grc.test')->count();

        $this->seed(DatabaseSeeder::class);

        $this->assertSame(10, $professorCount);
        $this->assertSame(10, User::query()->where('email', 'like', 'prof.%@grc.test')->count());
    }

    /**
     * Invoked directly rather than through `db:seed`, matching RoleUserSeederTest:
     * the artisan command's production confirmation prompt would otherwise
     * intercept the call before the seeder runs.
     */
    public function test_it_refuses_to_run_outside_local_and_testing_environments(): void
    {
        app()->detectEnvironment(static fn (): string => 'production');

        $this->expectException(RuntimeException::class);

        app(DemoEnrollmentSeeder::class)->run();
    }

    public function test_it_seeds_nothing_when_it_refuses_to_run(): void
    {
        app()->detectEnvironment(static fn (): string => 'production');

        try {
            app(DemoEnrollmentSeeder::class)->run();
        } catch (RuntimeException) {
            // Expected; asserted in the preceding test.
        }

        $this->assertDatabaseCount('enrollments', 0);
        $this->assertDatabaseCount('student_profiles', 0);
    }
}
