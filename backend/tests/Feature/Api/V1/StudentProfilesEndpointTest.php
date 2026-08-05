<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Audit\AuditAction;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\ProgramStatus;
use App\Models\AuditLog;
use App\Models\Curriculum;
use App\Models\Program;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class StudentProfilesEndpointTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

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

    /** @return array{0: Program, 1: Curriculum} */
    private function makeProgramAndCurriculum(): array
    {
        $program = Program::create(['code' => 'BSCS', 'name' => 'BS Computer Science', 'status' => ProgramStatus::Active]);
        $curriculum = Curriculum::create([
            'program_id' => $program->id, 'name' => 'BSCS Curriculum',
            'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Active,
        ]);

        return [$program, $curriculum];
    }

    public function test_anonymous_request_is_unauthenticated(): void
    {
        $this->getJson('/api/v1/student-profile')->assertUnauthorized();
        $this->postJson('/api/v1/student-profiles', [])->assertUnauthorized();
    }

    public function test_admission_staff_can_provision_a_student(): void
    {
        [$program, $curriculum] = $this->makeProgramAndCurriculum();
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.provision@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'name' => 'New Student',
            'email' => 'new.student@grc.test',
            'password' => 'a-temporary-password',
            'student_number' => '2027-08-10001',
            'program_id' => $program->id,
            'curriculum_id' => $curriculum->id,
            'year_level' => 1,
        ]);

        $response->assertCreated()->assertHeader('Cache-Control', 'no-store, private');
        $response->assertJsonPath('data.student_number', '2027-08-10001');
        $response->assertJsonPath('data.admission_status', 'admitted');
        $response->assertJsonMissingPath('data.password');

        $this->assertDatabaseHas('users', ['email' => 'new.student@grc.test', 'role' => 'student']);
        $this->assertDatabaseHas('student_profiles', ['student_number' => '2027-08-10001']);
        self::assertSame(AuditAction::STUDENT_PROFILE_PROVISIONED, AuditLog::query()->sole()->action);
    }

    public function test_student_number_must_match_the_yyyy_mm_nnnnn_format(): void
    {
        [$program, $curriculum] = $this->makeProgramAndCurriculum();
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.badformat@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'name' => 'New Student',
            'email' => 'badformat.student@grc.test',
            'password' => 'a-temporary-password',
            'student_number' => 'STU-2027-0001',
            'program_id' => $program->id,
            'curriculum_id' => $curriculum->id,
            'year_level' => 1,
        ]);

        $response->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
        $this->assertDatabaseMissing('users', ['email' => 'badformat.student@grc.test']);
    }

    public function test_financial_status_is_accepted_and_defaults_to_null(): void
    {
        [$program, $curriculum] = $this->makeProgramAndCurriculum();
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.financial@grc.test');

        $scholar = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'name' => 'Scholar Student',
            'email' => 'scholar.student@grc.test',
            'password' => 'a-temporary-password',
            'student_number' => '2027-08-10002',
            'program_id' => $program->id,
            'curriculum_id' => $curriculum->id,
            'year_level' => 1,
            'financial_status' => 'scholar',
        ]);
        $scholar->assertCreated();
        $scholar->assertJsonPath('data.financial_status', 'scholar');
        $scholar->assertJsonPath('data.financial_status_label', 'Scholar');

        $unset = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'name' => 'Unset Student',
            'email' => 'unset.student@grc.test',
            'password' => 'a-temporary-password',
            'student_number' => '2027-08-10003',
            'program_id' => $program->id,
            'curriculum_id' => $curriculum->id,
            'year_level' => 1,
        ]);
        $unset->assertCreated();
        $unset->assertJsonPath('data.financial_status', null);
        $unset->assertJsonPath('data.financial_status_label', null);
    }

    public function test_a_non_admission_staff_role_cannot_provision_a_student(): void
    {
        [$program, $curriculum] = $this->makeProgramAndCurriculum();
        $token = $this->tokenFor(UserRole::RegistrarStaff, 'registrar.provision@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'name' => 'New Student',
            'email' => 'blocked.student@grc.test',
            'password' => 'a-temporary-password',
            'student_number' => '2027-08-10004',
            'program_id' => $program->id,
            'curriculum_id' => $curriculum->id,
            'year_level' => 1,
        ]);

        $response->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
        $this->assertDatabaseMissing('users', ['email' => 'blocked.student@grc.test']);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_a_curriculum_from_a_different_program_is_rejected(): void
    {
        [$program] = $this->makeProgramAndCurriculum();
        $otherProgram = Program::create(['code' => 'BSIT', 'name' => 'BS IT', 'status' => ProgramStatus::Active]);
        $otherCurriculum = Curriculum::create([
            'program_id' => $otherProgram->id, 'name' => 'BSIT Curriculum',
            'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Active,
        ]);
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.mismatch@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'name' => 'New Student',
            'email' => 'mismatch.student@grc.test',
            'password' => 'a-temporary-password',
            'student_number' => '2027-08-10005',
            'program_id' => $program->id,
            'curriculum_id' => $otherCurriculum->id,
            'year_level' => 1,
        ]);

        $response->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_duplicate_email_is_rejected(): void
    {
        [$program, $curriculum] = $this->makeProgramAndCurriculum();
        User::create(['name' => 'Existing', 'email' => 'existing@grc.test', 'password' => 'irrelevant', 'role' => UserRole::Student, 'status' => UserStatus::Active]);
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.dup@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'name' => 'New Student',
            'email' => 'existing@grc.test',
            'password' => 'a-temporary-password',
            'student_number' => '2027-08-10006',
            'program_id' => $program->id,
            'curriculum_id' => $curriculum->id,
            'year_level' => 1,
        ]);

        $response->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
        $this->assertDatabaseCount('audit_logs', 0);
    }

    /**
     * Provisions the profile directly (not through the Admission Staff HTTP
     * endpoint) so this test authenticates as exactly one user — chaining a
     * second, different authenticated user in the same test method hits a
     * Sanctum guard-caching quirk documented in PROGRESS.md.
     */
    public function test_a_student_can_read_their_own_profile(): void
    {
        [$program, $curriculum] = $this->makeProgramAndCurriculum();

        $student = User::create([
            'name' => 'Reader Student', 'email' => 'reader.student@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::Student, 'status' => UserStatus::Active,
        ]);
        StudentProfile::create([
            'user_id' => $student->id, 'student_number' => 'STU-2027-0005',
            'program_id' => $program->id, 'curriculum_id' => $curriculum->id, 'year_level' => 2,
            'admission_status' => 'admitted', 'academic_standing' => 'good',
        ]);

        $studentToken = (string) $this->postJson('/api/v1/auth/login', [
            'email' => 'reader.student@grc.test',
            'password' => self::PASSWORD,
        ])->json('data.token');

        $response = $this->withToken($studentToken)->getJson('/api/v1/student-profile');

        $response->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $response->assertJsonPath('data.student_number', 'STU-2027-0005');
        $response->assertJsonPath('data.year_level', 2);
    }

    public function test_a_student_never_sees_another_students_profile(): void
    {
        [$program, $curriculum] = $this->makeProgramAndCurriculum();

        $studentA = User::create(['name' => 'A', 'email' => 'student.a@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Student, 'status' => UserStatus::Active]);
        StudentProfile::create([
            'user_id' => $studentA->id, 'student_number' => 'STU-A', 'program_id' => $program->id,
            'curriculum_id' => $curriculum->id, 'year_level' => 1,
            'admission_status' => 'admitted', 'academic_standing' => 'good',
        ]);

        $studentB = User::create(['name' => 'B', 'email' => 'student.b@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Student, 'status' => UserStatus::Active]);
        StudentProfile::create([
            'user_id' => $studentB->id, 'student_number' => 'STU-B', 'program_id' => $program->id,
            'curriculum_id' => $curriculum->id, 'year_level' => 3,
            'admission_status' => 'admitted', 'academic_standing' => 'good',
        ]);

        $tokenB = (string) $this->postJson('/api/v1/auth/login', [
            'email' => 'student.b@grc.test', 'password' => self::PASSWORD,
        ])->json('data.token');

        $response = $this->withToken($tokenB)->getJson('/api/v1/student-profile');

        $response->assertOk()->assertJsonPath('data.student_number', 'STU-B');
    }

    public function test_a_user_with_no_profile_gets_a_clean_404_not_a_500(): void
    {
        $token = $this->tokenFor(UserRole::Student, 'no.profile@grc.test');

        $response = $this->withToken($token)->getJson('/api/v1/student-profile');

        $response->assertNotFound();
    }
}
