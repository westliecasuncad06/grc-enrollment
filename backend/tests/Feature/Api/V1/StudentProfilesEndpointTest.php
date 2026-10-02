<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Audit\AuditAction;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\ProgramStatus;
use App\Mail\StudentAccountSetupMail;
use App\Models\AcademicTerm;
use App\Models\AuditLog;
use App\Models\Curriculum;
use App\Models\Program;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
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
            'last_otp_verified_at' => now(),
        ]);

        return (string) $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => self::PASSWORD,
        ])->json('data.token');
    }

    /**
     * `ProvisionStudent`/`UpdateStudentProfile` derive `entry_year` from the
     * current ongoing academic term (Stakeholder Doc 17) instead of trusting
     * the client — every test that expects provisioning to actually succeed
     * needs one of these set up first.
     */
    private function setCurrentTerm(string $schoolYear): AcademicTerm
    {
        return AcademicTerm::create([
            'school_year' => $schoolYear,
            'semester' => '1st',
            'status' => AcademicTermStatus::SemesterOngoing,
        ]);
    }

    /** @return array{0: Program, 1: Curriculum} */
    private function makeProgramAndCurriculum(): array
    {
        $program = Program::create(['code' => 'BSCS', 'name' => 'BS Computer Science', 'status' => ProgramStatus::Active]);
        $curriculum = Curriculum::create([
            'program_id' => $program->id, 'name' => 'BSCS Curriculum',
            'effective_school_year' => '2026-2027', 'effective_start_year' => 2026,
            'effective_end_year' => 2030, 'status' => CurriculumStatus::Active,
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
        $this->setCurrentTerm('2027-2028');
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.provision@grc.test');
        Mail::fake();

        $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'first_name' => 'New',
            'last_name' => 'Student',
            'email' => 'new.student@grc.test',
            'address' => '123 Test Street, Caloocan City',
            'student_number' => '2027-08-10001',
            'program_id' => $program->id,
            'year_level' => 1,
            'requirements_verified' => true,
        ]);

        $response->assertCreated()->assertHeader('Cache-Control', 'no-store, private');
        $response->assertJsonPath('data.student_number', '2027-08-10001');
        $response->assertJsonPath('data.address', '123 Test Street, Caloocan City');
        $response->assertJsonPath('data.entry_year', 2027);
        $response->assertJsonPath('data.enrollment_category', 'regular');
        $response->assertJsonPath('data.student_type', 'freshman');
        $response->assertJsonPath('data.admission_status', 'admitted');
        $response->assertJsonPath('data.account_setup_status', 'pending');
        $response->assertJsonPath('data.invitation_delivery_status', 'sent');
        $response->assertJsonMissingPath('data.password');
        $response->assertJsonMissingPath('data.setup_code');

        $this->assertDatabaseHas('users', [
            'email' => 'new.student@grc.test',
            'role' => 'student',
            'status' => 'disabled',
            'account_setup_completed_at' => null,
        ]);
        $this->assertDatabaseHas('student_profiles', [
            'student_number' => '2027-08-10001',
            'address' => '123 Test Street, Caloocan City',
            'requirements_verified_by' => User::query()->where('email', 'admission.provision@grc.test')->value('id'),
        ]);
        Mail::assertSentCount(1);
        $provisioningAudit = AuditLog::query()->where('action', AuditAction::STUDENT_PROFILE_PROVISIONED)->sole();
        $provisioningPayload = json_encode([$provisioningAudit->before_values, $provisioningAudit->after_values], JSON_THROW_ON_ERROR);
        self::assertStringNotContainsString('New Student', $provisioningPayload);
        self::assertStringNotContainsString('new.student@grc.test', $provisioningPayload);
        self::assertStringNotContainsString('123 Test Street', $provisioningPayload);
        $invitationAudit = AuditLog::query()->where('action', AuditAction::STUDENT_ACCOUNT_SETUP_INVITATION_SENT)->sole();
        $invitationPayload = json_encode([$invitationAudit->before_values, $invitationAudit->after_values], JSON_THROW_ON_ERROR);
        self::assertStringNotContainsString('new.student@grc.test', $invitationPayload);
    }

    public function test_provisioning_normalizes_name_casing_regardless_of_how_admission_typed_it(): void
    {
        [$program, $curriculum] = $this->makeProgramAndCurriculum();
        $this->setCurrentTerm('2027-2028');
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.casing@grc.test');
        Mail::fake();

        $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'first_name' => 'juan',
            'middle_initial' => 'm',
            'last_name' => 'DELA CRUZ',
            'suffix' => 'iii',
            'email' => 'casing.student@grc.test',
            'address' => '1 Casing Street, Caloocan City',
            'student_number' => '2027-08-10009',
            'program_id' => $program->id,
            'year_level' => 1,
            'requirements_verified' => true,
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.name', 'Juan M. Dela Cruz III');
        $response->assertJsonPath('data.first_name', 'Juan');
        $response->assertJsonPath('data.middle_initial', 'M');
        $response->assertJsonPath('data.last_name', 'Dela Cruz');
        $response->assertJsonPath('data.suffix', 'III');

        $this->assertDatabaseHas('users', [
            'email' => 'casing.student@grc.test',
            'name' => 'Juan M. Dela Cruz III',
            'first_name' => 'Juan',
            'middle_initial' => 'M',
            'last_name' => 'Dela Cruz',
            'suffix' => 'III',
        ]);
    }

    public function test_provisioning_requires_verified_requirements_and_an_address(): void
    {
        [$program] = $this->makeProgramAndCurriculum();
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.requirements@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'first_name' => 'Incomplete',
            'last_name' => 'Applicant',
            'email' => 'incomplete.applicant@grc.test',
            'student_number' => '2027-08-10009',
            'program_id' => $program->id,
            'year_level' => 1,
            'requirements_verified' => false,
        ]);

        $response->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonStructure([
                'error' => ['errors' => ['address', 'requirements_verified']],
            ]);
        $this->assertDatabaseMissing('users', ['email' => 'incomplete.applicant@grc.test']);
    }

    public function test_provisioning_rejects_client_overrides_of_server_controlled_fields(): void
    {
        [$program, $curriculum] = $this->makeProgramAndCurriculum();
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.contract@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'first_name' => 'Unsafe',
            'last_name' => 'Contract Student',
            'email' => 'unsafe.contract@grc.test',
            'address' => '789 Contract Road, Caloocan City',
            'password' => 'client-chosen-password',
            'student_number' => '2027-08-10011',
            'program_id' => $program->id,
            'curriculum_id' => $curriculum->id,
            'entry_year' => 2027,
            'year_level' => 1,
            'enrollment_category' => 'irregular',
            'student_type' => 'freshman',
            'requirements_verified' => true,
        ]);

        $response->assertUnprocessable()
            ->assertJsonStructure([
                'error' => ['errors' => ['password', 'curriculum_id', 'entry_year', 'enrollment_category', 'student_type']],
            ]);
        $this->assertDatabaseMissing('users', ['email' => 'unsafe.contract@grc.test']);
    }

    public function test_student_activates_the_pending_account_with_the_emailed_one_time_code(): void
    {
        config(['app.frontend_url' => 'http://localhost:3000']);
        [$program] = $this->makeProgramAndCurriculum();
        $this->setCurrentTerm('2027-2028');
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.activation@grc.test');
        Mail::fake();

        $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'first_name' => 'Pending',
            'last_name' => 'Student',
            'email' => 'pending.student@grc.test',
            'address' => '456 Setup Avenue, Caloocan City',
            'student_number' => '2027-08-10010',
            'program_id' => $program->id,
            'year_level' => 1,
            'requirements_verified' => true,
        ])->assertCreated();

        $setupCode = null;
        Mail::assertSent(StudentAccountSetupMail::class, function (StudentAccountSetupMail $mail) use (&$setupCode): bool {
            $setupCode = $mail->setupCode;

            return $mail->setupUrl === 'http://localhost:3000'
                && ! str_contains($mail->setupUrl, 'token=');
        });
        self::assertIsString($setupCode);
        self::assertNotSame('', $setupCode);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'pending.student@grc.test',
            'password' => 'New-Secure-Password1!',
        ])->assertUnauthorized();

        $this->postJson('/api/v1/auth/account-setup', [
            'email' => 'pending.student@grc.test',
            'code' => $setupCode,
            'password' => 'New-Secure-Password1!',
            'password_confirmation' => 'New-Secure-Password1!',
        ])->assertOk()
            ->assertJsonPath('data.type', 'account-setup')
            ->assertJsonPath('data.status', 'active')
            ->assertJsonMissingPath('data.token');

        $this->assertDatabaseHas('users', [
            'email' => 'pending.student@grc.test',
            'status' => 'active',
        ]);
        self::assertNotNull(User::query()->where('email', 'pending.student@grc.test')->value('account_setup_completed_at'));
        $this->assertDatabaseCount('account_setup_codes', 0);
        self::assertSame(1, AuditLog::query()->where('action', AuditAction::STUDENT_ACCOUNT_ACTIVATED)->count());

        $this->postJson('/api/v1/auth/login', [
            'email' => 'pending.student@grc.test',
            'password' => 'New-Secure-Password1!',
        ])->assertOk();

        $this->postJson('/api/v1/auth/account-setup', [
            'email' => 'pending.student@grc.test',
            'code' => $setupCode,
            'password' => 'Another-Secure-Password1!',
            'password_confirmation' => 'Another-Secure-Password1!',
        ])->assertUnprocessable();
    }

    public function test_an_expired_or_invalid_setup_code_cannot_activate_the_account(): void
    {
        [$program] = $this->makeProgramAndCurriculum();
        $this->setCurrentTerm('2027-2028');
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.expiry@grc.test');
        Mail::fake();

        $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'first_name' => 'Expiring',
            'last_name' => 'Student',
            'email' => 'expiring.student@grc.test',
            'address' => '60 Minute Avenue, Caloocan City',
            'student_number' => '2027-08-10012',
            'program_id' => $program->id,
            'year_level' => 1,
            'requirements_verified' => true,
        ])->assertCreated();

        $setupCode = null;
        Mail::assertSent(StudentAccountSetupMail::class, function (StudentAccountSetupMail $mail) use (&$setupCode): bool {
            $setupCode = $mail->setupCode;

            return true;
        });
        DB::table('account_setup_codes')
            ->whereIn('user_id', User::query()->where('email', 'expiring.student@grc.test')->pluck('id'))
            ->update(['expires_at' => now()->subMinute()]);

        foreach ([$setupCode, '123456'] as $code) {
            $this->postJson('/api/v1/auth/account-setup', [
                'email' => 'expiring.student@grc.test',
                'code' => $code,
                'password' => 'New-Secure-Password1!',
                'password_confirmation' => 'New-Secure-Password1!',
            ])->assertUnprocessable()
                ->assertJsonPath('error.errors.code.0', 'The setup code is invalid or expired.');
        }

        $this->assertDatabaseHas('users', [
            'email' => 'expiring.student@grc.test',
            'status' => 'disabled',
            'account_setup_completed_at' => null,
        ]);
    }

    public function test_mail_failure_keeps_one_pending_account_and_exposes_a_resendable_delivery_state(): void
    {
        [$program] = $this->makeProgramAndCurriculum();
        $this->setCurrentTerm('2027-2028');
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.mail-failure@grc.test');
        Mail::shouldReceive('to')->once()->andReturnSelf();
        Mail::shouldReceive('send')->once()->andThrow(new RuntimeException('Simulated mail transport failure.'));

        $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'first_name' => 'Mail Failure',
            'last_name' => 'Student',
            'email' => 'mail.failure.student@grc.test',
            'address' => 'Retry Street, Caloocan City',
            'student_number' => '2027-08-10013',
            'program_id' => $program->id,
            'year_level' => 1,
            'requirements_verified' => true,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.account_setup_status', 'pending')
            ->assertJsonPath('data.invitation_delivery_status', 'failed');
        $this->assertDatabaseCount('users', 2);
        $this->assertDatabaseHas('users', [
            'email' => 'mail.failure.student@grc.test',
            'status' => 'disabled',
        ]);
        $this->assertDatabaseCount('account_setup_codes', 1);
        self::assertSame(1, AuditLog::query()->where('action', AuditAction::STUDENT_ACCOUNT_SETUP_INVITATION_FAILED)->count());
    }

    public function test_student_number_must_match_the_yyyy_mm_nnnnn_format(): void
    {
        [$program] = $this->makeProgramAndCurriculum();
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.badformat@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'first_name' => 'New',
            'last_name' => 'Student',
            'email' => 'badformat.student@grc.test',
            'address' => '100 Invalid Format Road, Caloocan City',
            'student_number' => 'STU-2027-0001',
            'program_id' => $program->id,
            'year_level' => 1,
            'requirements_verified' => true,
        ]);

        $response->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
        $this->assertDatabaseMissing('users', ['email' => 'badformat.student@grc.test']);
    }

    public function test_financial_status_is_accepted_and_defaults_to_null(): void
    {
        [$program] = $this->makeProgramAndCurriculum();
        $this->setCurrentTerm('2027-2028');
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.financial@grc.test');
        Mail::fake();

        $scholar = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'first_name' => 'Scholar',
            'last_name' => 'Student',
            'email' => 'scholar.student@grc.test',
            'address' => '101 Scholar Avenue, Caloocan City',
            'student_number' => '2027-08-10002',
            'program_id' => $program->id,
            'year_level' => 1,
            'financial_status' => 'scholar',
            'requirements_verified' => true,
        ]);
        $scholar->assertCreated();
        $scholar->assertJsonPath('data.financial_status', 'scholar');
        $scholar->assertJsonPath('data.financial_status_label', 'Scholar');

        $unset = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'first_name' => 'Unset',
            'last_name' => 'Student',
            'email' => 'unset.student@grc.test',
            'address' => '102 Default Avenue, Caloocan City',
            'student_number' => '2027-08-10003',
            'program_id' => $program->id,
            'year_level' => 1,
            'requirements_verified' => true,
        ]);
        $unset->assertCreated();
        $unset->assertJsonPath('data.financial_status', null);
        $unset->assertJsonPath('data.financial_status_label', null);
    }

    /**
     * Stakeholder Doc 17: Admission no longer picks Enrollment Category or
     * Student Type directly — both are derived from Year Level at intake
     * (1 => Regular/Freshman, 2-4 => Irregular/Transferee) and the client
     * can't override them (see test_provisioning_rejects_client_overrides_of_server_controlled_fields).
     * `enrollment_category_derived_at` must stay NULL: this is a
     * provisioning default, not ADR 0021's grade-based re-derivation.
     */
    public function test_enrollment_category_and_student_type_are_derived_from_year_level(): void
    {
        $program = Program::create(['code' => 'BSUNI', 'name' => 'BS Universal', 'status' => ProgramStatus::Active]);
        Curriculum::create([
            'program_id' => $program->id, 'name' => 'BSUNI Curriculum',
            'effective_school_year' => '2000-2001', 'effective_start_year' => 2000,
            'effective_end_year' => null, 'status' => CurriculumStatus::Active,
        ]);
        $this->setCurrentTerm('2027-2028');
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.yearlevel@grc.test');
        Mail::fake();

        $expectations = [
            1 => ['regular', 'freshman'],
            2 => ['irregular', 'transferee'],
            3 => ['irregular', 'transferee'],
            4 => ['irregular', 'transferee'],
        ];

        foreach ($expectations as $yearLevel => [$expectedCategory, $expectedType]) {
            $email = "year-level-{$yearLevel}@grc.test";
            $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
                'first_name' => 'Year',
                'last_name' => "Level {$yearLevel}",
                'email' => $email,
                'address' => "{$yearLevel} Derivation Road, Caloocan City",
                'student_number' => "2027-08-200{$yearLevel}0",
                'program_id' => $program->id,
                'year_level' => $yearLevel,
                'requirements_verified' => true,
            ]);

            $response->assertCreated();
            $response->assertJsonPath('data.enrollment_category', $expectedCategory);
            $response->assertJsonPath('data.student_type', $expectedType);
            $response->assertJsonPath('data.student_type_label', ucfirst($expectedType));
            $this->assertDatabaseHas('student_profiles', [
                'user_id' => User::query()->where('email', $email)->value('id'),
                'enrollment_category' => $expectedCategory,
                'student_type' => $expectedType,
                'enrollment_category_derived_at' => null,
            ]);
        }
    }

    public function test_a_non_admission_staff_role_cannot_provision_a_student(): void
    {
        [$program] = $this->makeProgramAndCurriculum();
        $token = $this->tokenFor(UserRole::RegistrarStaff, 'registrar.provision@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'first_name' => 'New',
            'last_name' => 'Student',
            'email' => 'blocked.student@grc.test',
            'address' => '103 Blocked Avenue, Caloocan City',
            'student_number' => '2027-08-10004',
            'program_id' => $program->id,
            'entry_year' => 2027,
            'year_level' => 1,
            'student_type' => 'freshman',
            'requirements_verified' => true,
        ]);

        $response->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
        $this->assertDatabaseMissing('users', ['email' => 'blocked.student@grc.test']);
        self::assertSame(0, AuditLog::query()->where('action', '!=', AuditAction::LOGIN_SUCCEEDED)->count());
    }

    public function test_provisioning_fails_cleanly_when_no_curriculum_covers_the_entry_year(): void
    {
        $program = Program::create([
            'code' => 'BSEMPTY',
            'name' => 'Program Without Curriculum',
            'status' => ProgramStatus::Active,
        ]);
        $this->setCurrentTerm('2035-2036');
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.mismatch@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'first_name' => 'New',
            'last_name' => 'Student',
            'email' => 'mismatch.student@grc.test',
            'address' => '104 Missing Curriculum Road, Caloocan City',
            'student_number' => '2035-08-10005',
            'program_id' => $program->id,
            'year_level' => 1,
            'requirements_verified' => true,
        ]);

        $response->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
        $this->assertDatabaseMissing('users', ['email' => 'mismatch.student@grc.test']);
    }

    public function test_provisioning_resolves_the_curriculum_from_the_current_terms_entry_year(): void
    {
        $program = Program::create(['code' => 'BSIT', 'name' => 'BS Information Technology', 'status' => ProgramStatus::Active]);
        $oldCurriculum = Curriculum::create([
            'program_id' => $program->id,
            'name' => 'BSIT 2018 Curriculum',
            'effective_school_year' => '2018-2019',
            'effective_start_year' => 2018,
            'effective_end_year' => 2023,
            'status' => CurriculumStatus::Archived,
        ]);
        Curriculum::create([
            'program_id' => $program->id,
            'name' => 'BSIT 2024 Curriculum',
            'effective_school_year' => '2024-2025',
            'effective_start_year' => 2024,
            'effective_end_year' => 2029,
            'status' => CurriculumStatus::Active,
        ]);
        $this->setCurrentTerm('2023-2024');
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.automatic-curriculum@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'first_name' => 'Fourth Year',
            'last_name' => 'Student',
            'email' => 'automatic.curriculum@grc.test',
            'address' => '105 Automatic Curriculum Road, Caloocan City',
            'student_number' => '2023-08-10007',
            'program_id' => $program->id,
            'year_level' => 4,
            'requirements_verified' => true,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.curriculum_id', $oldCurriculum->id)
            ->assertJsonPath('data.entry_year', 2023)
            ->assertJsonPath('data.curriculum_name', 'BSIT 2018 Curriculum')
            ->assertJsonPath('data.curriculum_effective_school_year', '2018-2019');
    }

    public function test_provisioning_fails_cleanly_when_no_academic_term_is_ongoing(): void
    {
        [$program] = $this->makeProgramAndCurriculum();
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.noterm@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'first_name' => 'No',
            'last_name' => 'Term',
            'email' => 'no.term.student@grc.test',
            'address' => '110 No Term Road, Caloocan City',
            'student_number' => '2027-08-10016',
            'program_id' => $program->id,
            'year_level' => 1,
            'requirements_verified' => true,
        ]);

        $response->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
        $this->assertDatabaseMissing('users', ['email' => 'no.term.student@grc.test']);
    }

    public function test_duplicate_email_is_rejected(): void
    {
        [$program] = $this->makeProgramAndCurriculum();
        User::create(['name' => 'Existing', 'email' => 'existing@grc.test', 'password' => 'irrelevant', 'role' => UserRole::Student, 'status' => UserStatus::Active, 'last_otp_verified_at' => now()]);
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.dup@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            'first_name' => 'New',
            'last_name' => 'Student',
            'email' => 'existing@grc.test',
            'address' => '106 Duplicate Road, Caloocan City',
            'student_number' => '2027-08-10006',
            'program_id' => $program->id,
            'year_level' => 1,
            'requirements_verified' => true,
        ]);

        $response->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
        self::assertSame(0, AuditLog::query()->where('action', '!=', AuditAction::LOGIN_SUCCEEDED)->count());
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
            'password' => self::PASSWORD, 'role' => UserRole::Student, 'status' => UserStatus::Active, 'last_otp_verified_at' => now(),
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

        $studentA = User::create(['name' => 'A', 'email' => 'student.a@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Student, 'status' => UserStatus::Active, 'last_otp_verified_at' => now()]);
        StudentProfile::create([
            'user_id' => $studentA->id, 'student_number' => 'STU-A', 'program_id' => $program->id,
            'curriculum_id' => $curriculum->id, 'year_level' => 1,
            'admission_status' => 'admitted', 'academic_standing' => 'good',
        ]);

        $studentB = User::create(['name' => 'B', 'email' => 'student.b@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Student, 'status' => UserStatus::Active, 'last_otp_verified_at' => now()]);
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

    public function test_account_setup_attempts_are_rate_limited(): void
    {
        for ($attempt = 0; $attempt < 10; $attempt++) {
            $this->postJson('/api/v1/auth/account-setup', [
                'email' => 'throttle.target@grc.test',
                'code' => 'not-a-real-code',
                'password' => 'irrelevant-password',
                'password_confirmation' => 'irrelevant-password',
            ])->assertUnprocessable();
        }

        $response = $this->postJson('/api/v1/auth/account-setup', [
            'email' => 'throttle.target@grc.test',
            'code' => 'not-a-real-code',
            'password' => 'irrelevant-password',
            'password_confirmation' => 'irrelevant-password',
        ]);

        $response->assertStatus(429);
        $response->assertHeader('Retry-After');
    }
}
