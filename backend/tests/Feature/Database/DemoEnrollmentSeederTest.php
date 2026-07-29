<?php

namespace Tests\Feature\Database;

use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Enrollment\EnrollmentSubjectStatus;
use App\Models\Enrollment;
use App\Models\EnrollmentSubject;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoEnrollmentSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Tests\TestCase;

final class DemoEnrollmentSeederTest extends TestCase
{
    use RefreshDatabase;

    private const SEED_PASSWORD = 'password';

    public function test_it_seeds_one_enrollment_per_demonstrated_lifecycle_state(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(4, StudentProfile::count());
        $this->assertSame(4, Enrollment::count());

        foreach ([
            EnrollmentStatus::Enrolled,
            EnrollmentStatus::PendingRegistrarApproval,
            EnrollmentStatus::PendingPayment,
            EnrollmentStatus::Withdrawn,
        ] as $status) {
            $this->assertSame(
                1,
                Enrollment::where('status', $status->value)->count(),
                "Expected exactly one {$status->value} enrollment.",
            );
        }
    }

    /**
     * The withdrawn student must not occupy a seat slot, while the three
     * non-terminal enrollments must each hold one. This is the seeded
     * expression of the unique-active-enrollment rule.
     */
    public function test_only_non_terminal_enrollments_hold_a_seat_slot(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(3, Enrollment::query()->active()->count());
        $this->assertSame(
            3,
            Enrollment::whereNotNull('active_academic_term_id')->count(),
        );
        $this->assertSame(
            1,
            Enrollment::whereNull('active_academic_term_id')->count(),
        );
    }

    public function test_section_seat_counts_exclude_dropped_rows(): void
    {
        $this->seed(DatabaseSeeder::class);

        foreach (Section::all() as $section) {
            $expected = EnrollmentSubject::where('section_id', $section->id)
                ->where('status', '!=', EnrollmentSubjectStatus::Dropped->value)
                ->count();

            $this->assertSame(
                $expected,
                $section->enrolled_count,
                "Section {$section->id} seat counter disagrees with its occupying rows.",
            );
        }
    }

    public function test_reseeding_creates_no_duplicates(): void
    {
        $this->seed(DatabaseSeeder::class);

        $enrollmentIds = Enrollment::orderBy('id')->pluck('id')->all();
        $profileIds = StudentProfile::orderBy('id')->pluck('id')->all();
        $subjectRowCount = EnrollmentSubject::count();

        $this->seed(DatabaseSeeder::class);

        $this->assertSame($enrollmentIds, Enrollment::orderBy('id')->pluck('id')->all());
        $this->assertSame($profileIds, StudentProfile::orderBy('id')->pluck('id')->all());
        $this->assertSame($subjectRowCount, EnrollmentSubject::count());
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

        $this->assertCount(4, $students);

        foreach ($students as $student) {
            $this->assertTrue(
                Hash::check(self::SEED_PASSWORD, $student->password),
                "Seeded student {$student->email} does not use the shared development password.",
            );
        }
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
