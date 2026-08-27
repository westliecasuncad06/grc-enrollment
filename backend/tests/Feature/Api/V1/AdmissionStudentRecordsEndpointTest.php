<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Audit\AuditAction;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\ProgramStatus;
use App\Models\AcademicTerm;
use App\Models\AuditLog;
use App\Models\Curriculum;
use App\Models\Enrollment;
use App\Models\Program;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class AdmissionStudentRecordsEndpointTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{Program, Curriculum} */
    private function catalog(): array
    {
        $program = Program::firstOrCreate(['code' => 'BSIT'], [
            'code' => 'BSIT',
            'name' => 'Bachelor of Science in Information Technology',
            'status' => ProgramStatus::Active,
        ]);
        $curriculum = Curriculum::firstOrCreate([
            'program_id' => $program->id,
            'effective_start_year' => 2026,
        ], [
            'name' => 'BSIT 2026 Curriculum',
            'effective_school_year' => '2026-2027',
            'effective_start_year' => 2026,
            'effective_end_year' => 2030,
            'status' => CurriculumStatus::Active,
        ]);

        return [$program, $curriculum];
    }

    private function user(UserRole $role, string $name, string $email): User
    {
        return User::create([
            'name' => $name,
            'email' => $email,
            'password' => 'correct-horse-battery-staple',
            'role' => $role,
            'status' => UserStatus::Active,
        ]);
    }

    private function student(string $name, string $email, string $studentNumber): StudentProfile
    {
        [$program, $curriculum] = $this->catalog();
        $user = $this->user(UserRole::Student, $name, $email);

        return StudentProfile::create([
            'user_id' => $user->id,
            'student_number' => $studentNumber,
            'program_id' => $program->id,
            'curriculum_id' => $curriculum->id,
            'entry_year' => 2026,
            'year_level' => 1,
            'enrollment_category' => 'regular',
            'admission_status' => 'admitted',
            'academic_standing' => 'good',
            'address' => 'Original Address, Caloocan City',
        ]);
    }

    public function test_admission_can_search_students_by_name_number_or_email_and_view_the_record(): void
    {
        $admission = $this->user(UserRole::AdmissionStaff, 'Admission Staff', 'admission.records@grc.test');
        $aurora = $this->student('Aurora S. Lopez', 'aurora.lopez@grc.test', '2026-08-01085');
        $this->student('Another Student', 'another.student@grc.test', '2026-08-01086');
        Sanctum::actingAs($admission);

        foreach (['Aurora', '2026-08-01085', 'aurora.lopez@grc.test'] as $search) {
            $this->getJson('/api/v1/student-profiles?search='.urlencode($search))
                ->assertOk()
                ->assertHeader('Cache-Control', 'no-store, private')
                ->assertJsonCount(1, 'data')
                ->assertJsonPath('data.0.id', $aurora->id)
                ->assertJsonPath('data.0.name', 'Aurora S. Lopez')
                ->assertJsonPath('data.0.address', 'Original Address, Caloocan City')
                ->assertJsonPath('data.0.academic_setup_editable', true);
        }

        $this->getJson('/api/v1/student-profiles/'.$aurora->id)
            ->assertOk()
            ->assertJsonPath('data.student_number', '2026-08-01085')
            ->assertJsonPath('data.program_code', 'BSIT');
    }

    public function test_non_admission_roles_cannot_browse_or_view_student_records(): void
    {
        $student = $this->student('Private Student', 'private.student@grc.test', '2026-08-01087');
        Sanctum::actingAs($student->user);

        $this->getJson('/api/v1/student-profiles')->assertForbidden();
        $this->getJson('/api/v1/student-profiles/'.$student->id)->assertForbidden();
    }

    public function test_admission_can_correct_a_pre_enrollment_record_with_a_reason_and_in_person_verification(): void
    {
        $admission = $this->user(UserRole::AdmissionStaff, 'Admission Editor', 'admission.editor@grc.test');
        $student = $this->student('Original Student', 'original.student@grc.test', '2026-08-01088');
        $newProgram = Program::create([
            'code' => 'BSCS',
            'name' => 'Bachelor of Science in Computer Science',
            'status' => ProgramStatus::Active,
        ]);
        $newCurriculum = Curriculum::create([
            'program_id' => $newProgram->id,
            'name' => 'BSCS 2027 Curriculum',
            'effective_school_year' => '2027-2028',
            'effective_start_year' => 2027,
            'effective_end_year' => 2031,
            'status' => CurriculumStatus::Active,
        ]);
        Sanctum::actingAs($admission);

        $this->patchJson('/api/v1/student-profiles/'.$student->id, [
            'first_name' => 'Corrected',
            'last_name' => 'Student',
            'email' => 'corrected.student@grc.test',
            'address' => 'Corrected Complete Address, Caloocan City',
            'student_number' => '2027-08-01088',
            'program_id' => $newProgram->id,
            'entry_year' => 2027,
            'year_level' => 2,
            'enrollment_category' => 'irregular',
            'financial_status' => 'payee',
            'admission_status' => 'admitted',
            'reason' => 'Corrected after reviewing the submitted admission documents.',
            'identity_verified_in_person' => true,
        ])->assertOk()
            ->assertJsonPath('data.name', 'Corrected Student')
            ->assertJsonPath('data.program_id', $newProgram->id)
            ->assertJsonPath('data.curriculum_id', $newCurriculum->id);

        $this->assertDatabaseHas('users', [
            'id' => $student->user_id,
            'name' => 'Corrected Student',
            'email' => 'corrected.student@grc.test',
        ]);
        $this->assertDatabaseHas('student_profiles', [
            'id' => $student->id,
            'student_number' => '2027-08-01088',
            'address' => 'Corrected Complete Address, Caloocan City',
            'program_id' => $newProgram->id,
            'curriculum_id' => $newCurriculum->id,
            'entry_year' => 2027,
            'year_level' => 2,
            'enrollment_category' => 'irregular',
        ]);

        $audit = AuditLog::query()->where('action', AuditAction::STUDENT_PROFILE_UPDATED)->sole();
        $auditPayload = json_encode([$audit->before_values, $audit->after_values], JSON_THROW_ON_ERROR);
        self::assertStringNotContainsString('Corrected Student', $auditPayload);
        self::assertStringNotContainsString('corrected.student@grc.test', $auditPayload);
        self::assertStringNotContainsString('Corrected Complete Address', $auditPayload);
        self::assertStringNotContainsString('Corrected after reviewing the submitted admission documents.', $auditPayload);
    }

    public function test_admission_update_requires_a_reason_and_in_person_verification(): void
    {
        $admission = $this->user(UserRole::AdmissionStaff, 'Admission Editor', 'admission.validation@grc.test');
        $student = $this->student('Validation Student', 'validation.student@grc.test', '2026-08-01089');
        Sanctum::actingAs($admission);

        $this->patchJson('/api/v1/student-profiles/'.$student->id, [
            'first_name' => 'Changed',
            'last_name' => 'Verification',
            'identity_verified_in_person' => false,
        ])->assertUnprocessable()
            ->assertJsonStructure([
                'error' => ['errors' => ['reason', 'identity_verified_in_person']],
            ]);
    }

    public function test_admission_can_correct_personal_fields_but_not_academic_setup_after_the_first_enrollment(): void
    {
        $admission = $this->user(UserRole::AdmissionStaff, 'Admission Editor', 'admission.enrolled@grc.test');
        $student = $this->student('Enrolled Student', 'enrolled.student@grc.test', '2026-08-01092');
        $term = AcademicTerm::create([
            'school_year' => '2026-2027',
            'semester' => '1st',
            'status' => AcademicTermStatus::SemesterOngoing,
        ]);
        Enrollment::create([
            'student_id' => $student->id,
            'academic_term_id' => $term->id,
            'status' => EnrollmentStatus::Enrolled,
            'enrolled_at' => now(),
        ]);
        Sanctum::actingAs($admission);

        $this->patchJson('/api/v1/student-profiles/'.$student->id, [
            'first_name' => 'Corrected',
            'last_name' => 'Enrolled Student',
            'address' => 'Updated Personal Address, Caloocan City',
            'reason' => 'The student presented updated identity and address records.',
            'identity_verified_in_person' => true,
        ])->assertOk()
            ->assertJsonPath('data.name', 'Corrected Enrolled Student')
            ->assertJsonPath('data.address', 'Updated Personal Address, Caloocan City')
            ->assertJsonPath('data.academic_setup_editable', false);

        $this->patchJson('/api/v1/student-profiles/'.$student->id, [
            'student_number' => '2026-08-01999',
            'reason' => 'Requested academic-record correction.',
            'identity_verified_in_person' => true,
        ])->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');

        $this->assertDatabaseHas('student_profiles', [
            'id' => $student->id,
            'student_number' => '2026-08-01092',
        ]);
    }

    public function test_admission_can_resend_setup_for_a_pending_account_but_not_an_active_account(): void
    {
        $admission = $this->user(UserRole::AdmissionStaff, 'Admission Inviter', 'admission.inviter@grc.test');
        $pending = $this->student('Pending Invite', 'pending.invite@grc.test', '2026-08-01090');
        $pending->user->forceFill([
            'status' => UserStatus::Disabled,
            'account_setup_completed_at' => null,
        ])->save();
        $active = $this->student('Active Student', 'active.student@grc.test', '2026-08-01091');
        $active->user->forceFill(['account_setup_completed_at' => now()])->save();
        Mail::fake();
        $oldCode = Password::broker()->createToken($pending->user);
        Sanctum::actingAs($admission);

        $this->postJson('/api/v1/student-profiles/'.$pending->id.'/account-setup-invitations')
            ->assertOk()
            ->assertJsonPath('data.account_setup_status', 'pending')
            ->assertJsonPath('data.invitation_delivery_status', 'sent')
            ->assertJsonMissingPath('data.setup_code');

        Mail::assertSentCount(1);
        self::assertFalse(Password::broker()->tokenExists($pending->user->fresh(), $oldCode));

        $this->postJson('/api/v1/student-profiles/'.$active->id.'/account-setup-invitations')
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }
}
