<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Enrollment\EnrollmentAudience;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Models\AcademicTerm;
use App\Models\AcademicTermEnrollmentWindow;
use App\Models\Curriculum;
use App\Models\Program;
use App\Models\StudentProfile;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Covers `GET/PATCH /academic-terms/{academicTerm}/enrollment-*` — the
 * Registrar Head's per-audience (year_1..4, irregular) enrollment
 * scheduling and its student-facing read view. See
 * `App\Actions\Organization\BuildEnrollmentScheduleSummary` and
 * `SaveEnrollmentSchedule`.
 */
final class EnrollmentScheduleEndpointTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    /** @return list<array{audience: string, opens_at: ?string, closes_at: ?string}> */
    private function blankWindows(): array
    {
        return array_map(
            static fn (EnrollmentAudience $audience): array => [
                'audience' => $audience->value,
                'opens_at' => null,
                'closes_at' => null,
            ],
            EnrollmentAudience::cases(),
        );
    }

    private function tokenFor(UserRole $role, string $email): string
    {
        User::create([
            'name' => 'Test '.$role->value,
            'email' => $email,
            'password' => self::PASSWORD,
            'role' => $role,
            'status' => UserStatus::Active,
        ]);

        return (string) $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => self::PASSWORD,
        ])->json('data.token');
    }

    private function makeStudent(string $email, int $yearLevel, ?string $enrollmentCategory = null): User
    {
        $studentUser = User::create([
            'name' => 'Test Student',
            'email' => $email,
            'password' => self::PASSWORD,
            'role' => UserRole::Student,
            'status' => UserStatus::Active,
        ]);
        $program = Program::query()->firstOrCreate(
            ['code' => 'BSCS'],
            ['name' => 'BS Computer Science', 'college' => 'ccs', 'status' => 'active'],
        );
        // `student_profiles.curriculum_id` is NOT NULL with a restricting
        // foreign key, so a real curriculum is required even though this
        // suite never reads it.
        $curriculum = Curriculum::query()->firstOrCreate(
            ['program_id' => $program->id, 'effective_school_year' => '2028-2029'],
            ['name' => 'BSCS 2028 Curriculum', 'status' => 'active'],
        );
        StudentProfile::create([
            'user_id' => $studentUser->id,
            'student_number' => 'STU-'.$studentUser->id,
            'program_id' => $program->id,
            'curriculum_id' => $curriculum->id,
            'year_level' => $yearLevel,
            'enrollment_category' => $enrollmentCategory,
            'admission_status' => 'admitted',
            // `academic_standing` is good/probation/warning — the
            // regular/irregular distinction lives in `enrollment_category`
            // above, which is what drives the audience window.
            'academic_standing' => 'good',
        ]);

        return $studentUser;
    }

    public function test_a_term_with_no_saved_windows_falls_back_to_the_term_wide_dates(): void
    {
        // Relative to now, so the window is genuinely open when the
        // resolver runs; fixed future dates would report `before_window`
        // and say nothing about the fallback this test is about.
        $opensAt = CarbonImmutable::now()->subDay()->startOfSecond();
        $closesAt = CarbonImmutable::now()->addDay()->startOfSecond();
        $term = AcademicTerm::create([
            'school_year' => '2028-2029',
            'semester' => '1st',
            'status' => AcademicTermStatus::SemesterOngoing,
            'enrollment_opens_at' => $opensAt,
            'enrollment_closes_at' => $closesAt,
        ]);
        $token = $this->tokenFor(UserRole::RegistrarHead, 'registrar-head.schedule-fallback@grc.test');

        $response = $this->withToken($token)->getJson("/api/v1/academic-terms/{$term->id}/enrollment-windows");

        $response->assertOk();
        self::assertCount(5, $response->json('data.audiences'));
        foreach ($response->json('data.audiences') as $audience) {
            // No `academic_term_enrollment_windows` row exists for any
            // audience, so every one falls back to the term-wide dates.
            self::assertSame($opensAt->utc()->format('Y-m-d\TH:i:s\Z'), $audience['opens_at']);
            self::assertSame($closesAt->utc()->format('Y-m-d\TH:i:s\Z'), $audience['closes_at']);
            self::assertTrue($audience['is_open']);
            self::assertSame('open', $audience['reason']);
        }
        self::assertSame(
            ['year_1', 'year_2', 'year_3', 'year_4', 'irregular'],
            array_column($response->json('data.audiences'), 'audience'),
        );
    }

    public function test_a_regular_student_receives_a_viewer_block_for_their_own_year_level(): void
    {
        $term = AcademicTerm::create([
            'school_year' => '2028-2029',
            'semester' => '1st',
            'status' => AcademicTermStatus::SemesterOngoing,
            'enrollment_opens_at' => '2028-07-01 00:00:00',
            'enrollment_closes_at' => '2028-07-15 00:00:00',
        ]);
        AcademicTermEnrollmentWindow::create([
            'academic_term_id' => $term->id,
            'audience' => EnrollmentAudience::Year4,
            'opens_at' => '2099-01-01 00:00:00',
            'closes_at' => '2099-01-15 00:00:00',
        ]);
        $studentUser = $this->makeStudent('student.viewer@grc.test', 4);
        $token = (string) $this->postJson('/api/v1/auth/login', [
            'email' => $studentUser->email,
            'password' => self::PASSWORD,
        ])->json('data.token');

        $response = $this->withToken($token)->getJson("/api/v1/academic-terms/{$term->id}/enrollment-windows");

        $response->assertOk();
        self::assertSame('year_4', $response->json('data.viewer.audience'));
        self::assertSame('4th Year', $response->json('data.viewer.label'));
        self::assertFalse($response->json('data.viewer.is_open'));
        self::assertSame('before_window', $response->json('data.viewer.reason'));
    }

    public function test_an_irregular_student_receives_the_irregular_viewer_block_regardless_of_year_level(): void
    {
        $term = AcademicTerm::create([
            'school_year' => '2028-2029',
            'semester' => '1st',
            'status' => AcademicTermStatus::SemesterOngoing,
            'enrollment_opens_at' => '2028-07-01 00:00:00',
            'enrollment_closes_at' => '2028-07-15 00:00:00',
        ]);
        AcademicTermEnrollmentWindow::create([
            'academic_term_id' => $term->id,
            'audience' => EnrollmentAudience::Irregular,
            'opens_at' => '2028-08-01 00:00:00',
            'closes_at' => '2028-08-15 00:00:00',
        ]);
        // A 2nd-year student whose enrollment_category is irregular is
        // governed by the irregular window, not the year_2 window.
        $studentUser = $this->makeStudent('student.irregular.viewer@grc.test', 2, 'irregular');
        $token = (string) $this->postJson('/api/v1/auth/login', [
            'email' => $studentUser->email,
            'password' => self::PASSWORD,
        ])->json('data.token');

        $response = $this->withToken($token)->getJson("/api/v1/academic-terms/{$term->id}/enrollment-windows");

        $response->assertOk();
        self::assertSame('irregular', $response->json('data.viewer.audience'));
        self::assertSame('Irregular Students', $response->json('data.viewer.label'));
        self::assertFalse($response->json('data.viewer.is_open'));
        self::assertSame('before_window', $response->json('data.viewer.reason'));
    }

    public function test_registrar_head_can_save_a_full_schedule(): void
    {
        $term = AcademicTerm::create([
            'school_year' => '2028-2029',
            'semester' => '1st',
            'status' => AcademicTermStatus::Draft,
            'enrollment_opens_at' => '2028-07-01 00:00:00',
            'enrollment_closes_at' => '2028-07-31 00:00:00',
        ]);
        $token = $this->tokenFor(UserRole::RegistrarHead, 'registrar-head.schedule-save@grc.test');

        $payload = [
            'enrollment_opens_at' => '2028-07-01T00:00:00Z',
            'enrollment_closes_at' => '2028-07-31T00:00:00Z',
            'windows' => [
                ['audience' => 'year_4', 'opens_at' => '2028-07-01T00:00:00Z', 'closes_at' => '2028-07-10T00:00:00Z'],
                ['audience' => 'year_3', 'opens_at' => '2028-07-05T00:00:00Z', 'closes_at' => '2028-07-15T00:00:00Z'],
                ['audience' => 'year_2', 'opens_at' => '2028-07-10T00:00:00Z', 'closes_at' => '2028-07-20T00:00:00Z'],
                ['audience' => 'year_1', 'opens_at' => '2028-07-15T00:00:00Z', 'closes_at' => '2028-07-31T00:00:00Z'],
                ['audience' => 'irregular', 'opens_at' => '2028-07-20T00:00:00Z', 'closes_at' => '2028-07-31T00:00:00Z'],
            ],
        ];

        $response = $this->withToken($token)->patchJson("/api/v1/academic-terms/{$term->id}/enrollment-schedule", $payload);

        $response->assertOk();
        $this->assertDatabaseHas('academic_term_enrollment_windows', [
            'academic_term_id' => $term->id,
            'audience' => 'year_4',
            'opens_at' => '2028-07-01 00:00:00',
            'closes_at' => '2028-07-10 00:00:00',
        ]);
        $this->assertDatabaseHas('academic_term_enrollment_windows', [
            'academic_term_id' => $term->id,
            'audience' => 'irregular',
            'opens_at' => '2028-07-20 00:00:00',
            'closes_at' => '2028-07-31 00:00:00',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'academic_term.enrollment_schedule_updated',
            'auditable_type' => 'academic_term',
            'auditable_id' => $term->id,
        ]);
    }

    public function test_a_window_outside_the_term_wide_window_is_rejected(): void
    {
        $term = AcademicTerm::create([
            'school_year' => '2028-2029',
            'semester' => '1st',
            'status' => AcademicTermStatus::Draft,
            'enrollment_opens_at' => '2028-07-01 00:00:00',
            'enrollment_closes_at' => '2028-07-15 00:00:00',
        ]);
        $token = $this->tokenFor(UserRole::RegistrarHead, 'registrar-head.schedule-outside@grc.test');

        $windows = $this->blankWindows();
        $windows[0] = ['audience' => 'year_1', 'opens_at' => '2028-06-01T00:00:00Z', 'closes_at' => '2028-07-15T00:00:00Z'];

        $response = $this->withToken($token)->patchJson("/api/v1/academic-terms/{$term->id}/enrollment-schedule", [
            'enrollment_opens_at' => '2028-07-01T00:00:00Z',
            'enrollment_closes_at' => '2028-07-15T00:00:00Z',
            'windows' => $windows,
        ]);

        $response->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
        self::assertArrayHasKey('windows.0.opens_at', $response->json('error.errors'));
    }

    public function test_a_close_date_before_its_own_open_date_is_rejected(): void
    {
        $term = AcademicTerm::create([
            'school_year' => '2028-2029',
            'semester' => '1st',
            'status' => AcademicTermStatus::Draft,
            'enrollment_opens_at' => '2028-07-01 00:00:00',
            'enrollment_closes_at' => '2028-07-15 00:00:00',
        ]);
        $token = $this->tokenFor(UserRole::RegistrarHead, 'registrar-head.schedule-inverted@grc.test');

        $windows = $this->blankWindows();
        $windows[0] = ['audience' => 'year_1', 'opens_at' => '2028-07-10T00:00:00Z', 'closes_at' => '2028-07-05T00:00:00Z'];

        $response = $this->withToken($token)->patchJson("/api/v1/academic-terms/{$term->id}/enrollment-schedule", [
            'enrollment_opens_at' => '2028-07-01T00:00:00Z',
            'enrollment_closes_at' => '2028-07-15T00:00:00Z',
            'windows' => $windows,
        ]);

        $response->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
        self::assertArrayHasKey('windows.0.closes_at', $response->json('error.errors'));
    }

    public function test_a_duplicate_audience_is_rejected(): void
    {
        $term = AcademicTerm::create(['school_year' => '2028-2029', 'semester' => '1st', 'status' => AcademicTermStatus::Draft]);
        $token = $this->tokenFor(UserRole::RegistrarHead, 'registrar-head.schedule-duplicate@grc.test');

        $windows = $this->blankWindows();
        $windows[4]['audience'] = 'year_1';

        $response = $this->withToken($token)->patchJson("/api/v1/academic-terms/{$term->id}/enrollment-schedule", [
            'enrollment_opens_at' => '2028-07-01T00:00:00Z',
            'enrollment_closes_at' => '2028-07-15T00:00:00Z',
            'windows' => $windows,
        ]);

        $response->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    /**
     * @dataProvider nonRegistrarHeadRoleProvider
     */
    public function test_a_non_registrar_head_role_cannot_save_a_schedule(UserRole $role): void
    {
        $term = AcademicTerm::create(['school_year' => '2028-2029', 'semester' => '1st', 'status' => AcademicTermStatus::Draft]);
        $token = $this->tokenFor($role, $role->value.'.schedule-forbidden@grc.test');

        $this->withToken($token)->patchJson("/api/v1/academic-terms/{$term->id}/enrollment-schedule", [
            'enrollment_opens_at' => '2028-07-01T00:00:00Z',
            'enrollment_closes_at' => '2028-07-15T00:00:00Z',
            'windows' => $this->blankWindows(),
        ])->assertForbidden();
    }

    /** @return array<string, array{UserRole}> */
    public static function nonRegistrarHeadRoleProvider(): array
    {
        $roles = [];

        foreach (UserRole::cases() as $role) {
            if ($role === UserRole::RegistrarHead) {
                continue;
            }

            $roles[$role->value] = [$role];
        }

        return $roles;
    }
}
