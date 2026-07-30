<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Academic\TransfereeCreditStatus;
use App\Domain\Audit\AuditAction;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Notifications\NotificationType;
use App\Domain\Organization\ProgramStatus;
use App\Models\AuditLog;
use App\Models\Curriculum;
use App\Models\Notification;
use App\Models\Program;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\TransfereeCredit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class TransfereeCreditsEndpointTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    private function makeCurriculum(): Curriculum
    {
        $program = Program::create(['code' => 'BSCS', 'name' => 'BS Computer Science', 'status' => ProgramStatus::Active]);

        return Curriculum::create([
            'program_id' => $program->id, 'name' => 'BSCS Curriculum',
            'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Active,
        ]);
    }

    private function makeStudent(Curriculum $curriculum, string $email = 'student.transfer@grc.test', string $studentNumber = '2026-0001'): StudentProfile
    {
        $user = User::create([
            'name' => 'Test Student', 'email' => $email,
            'password' => self::PASSWORD, 'role' => UserRole::Student, 'status' => UserStatus::Active,
        ]);

        return StudentProfile::create([
            'user_id' => $user->id,
            'student_number' => $studentNumber,
            'program_id' => $curriculum->program_id,
            'curriculum_id' => $curriculum->id,
            'year_level' => 1,
            'admission_status' => AdmissionStatus::Admitted,
            'academic_standing' => AcademicStanding::Good,
        ]);
    }

    private function tokenFor(User $user): string
    {
        return (string) $this->postJson('/api/v1/auth/login', [
            'email' => $user->email, 'password' => self::PASSWORD,
        ])->json('data.token');
    }

    private function tokenForNewUser(UserRole $role, string $email): string
    {
        User::create([
            'name' => 'Test '.$role->value, 'email' => $email,
            'password' => self::PASSWORD, 'role' => $role, 'status' => UserStatus::Active,
        ]);

        return (string) $this->postJson('/api/v1/auth/login', [
            'email' => $email, 'password' => self::PASSWORD,
        ])->json('data.token');
    }

    /**
     * Seeds a pending transferee credit directly via Eloquent. Chaining
     * `withToken()` for two *different* users within one test method
     * silently reuses the first user's cached guard resolution (the
     * documented Sanctum test gotcha noted in `EnrollmentsEndpointTest`/
     * `WithdrawalRequestsEndpointTest`) — so every test below authenticates
     * as exactly one actor.
     */
    private function makeTransfereeCredit(StudentProfile $student, ?int $subjectId = null): TransfereeCredit
    {
        return TransfereeCredit::create([
            'student_id' => $student->id,
            'source_institution' => 'Other University',
            'source_subject_code' => 'EXT101',
            'source_subject_title' => 'Introduction to Programming',
            'source_grade' => '1.75',
            'credited_units' => 3,
            'subject_id' => $subjectId,
            'status' => TransfereeCreditStatus::Pending,
        ]);
    }

    public function test_anonymous_request_is_unauthenticated(): void
    {
        $this->getJson('/api/v1/transferee-credits')->assertUnauthorized();
        $this->postJson('/api/v1/transferee-credits', [])->assertUnauthorized();
    }

    public function test_registrar_staff_can_create_a_transferee_credit(): void
    {
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenForNewUser(UserRole::RegistrarStaff, 'registrar-staff.create@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/transferee-credits', [
            'student_id' => $student->id,
            'source_institution' => 'Other University',
            'source_subject_code' => 'EXT101',
            'source_subject_title' => 'Introduction to Programming',
            'source_grade' => '1.75',
            'credited_units' => 3,
        ]);

        $response->assertCreated()->assertJsonPath('data.status', 'pending');
        $response->assertJsonPath('data.student_number', $student->student_number);
        self::assertSame(AuditAction::TRANSFEREE_CREDIT_CREATED, AuditLog::query()->sole()->action);
    }

    public function test_a_student_cannot_create_a_transferee_credit(): void
    {
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student->user);

        $response = $this->withToken($token)->postJson('/api/v1/transferee-credits', [
            'student_id' => $student->id,
            'source_institution' => 'Other University',
            'source_subject_code' => 'EXT101',
            'source_subject_title' => 'Introduction to Programming',
            'credited_units' => 3,
        ]);

        $response->assertForbidden();
        $this->assertDatabaseCount('transferee_credits', 0);
    }

    public function test_subject_id_is_optional_and_credited_units_is_required(): void
    {
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenForNewUser(UserRole::RegistrarStaff, 'registrar-staff.optional@grc.test');

        $this->withToken($token)->postJson('/api/v1/transferee-credits', [
            'student_id' => $student->id,
            'source_institution' => 'Other University',
            'source_subject_code' => 'EXT101',
            'source_subject_title' => 'Introduction to Programming',
        ])->assertUnprocessable();

        $response = $this->withToken($token)->postJson('/api/v1/transferee-credits', [
            'student_id' => $student->id,
            'source_institution' => 'Other University',
            'source_subject_code' => 'EXT101',
            'source_subject_title' => 'Introduction to Programming',
            'credited_units' => 3,
        ]);

        $response->assertCreated();
        self::assertNull(TransfereeCredit::query()->sole()->subject_id);
    }

    public function test_registrar_staff_can_edit_a_pending_credits_content(): void
    {
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $credit = $this->makeTransfereeCredit($student);
        $token = $this->tokenForNewUser(UserRole::RegistrarStaff, 'registrar-staff.edit@grc.test');

        $response = $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", [
            'credited_units' => 4,
        ]);

        $response->assertOk()->assertJsonPath('data.credited_units', 4);
        self::assertSame(4, $credit->refresh()->credited_units);
        self::assertSame(AuditAction::TRANSFEREE_CREDIT_UPDATED, AuditLog::query()->sole()->action);
    }

    public function test_registrar_staff_approves_a_pending_credit(): void
    {
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $subject = Subject::create(['code' => 'CS101', 'title' => 'Programming 1', 'units' => 3.0, 'status' => SubjectStatus::Active]);
        $credit = $this->makeTransfereeCredit($student, $subject->id);
        $token = $this->tokenForNewUser(UserRole::RegistrarStaff, 'registrar-staff.approve@grc.test');

        $response = $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", [
            'action' => 'approve',
        ]);

        $response->assertOk()->assertJsonPath('data.status', 'approved');
        self::assertSame('approved', $credit->refresh()->status->value);
        self::assertNotNull($credit->processed_at);
        self::assertSame(
            AuditAction::TRANSFEREE_CREDIT_APPROVED,
            AuditLog::query()->where('auditable_type', 'transferee_credit')->sole()->action,
        );
        self::assertSame(NotificationType::TransfereeCreditApproved, Notification::query()->sole()->type);
    }

    public function test_registrar_staff_rejects_a_credit_requiring_a_reason(): void
    {
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $credit = $this->makeTransfereeCredit($student);
        $token = $this->tokenForNewUser(UserRole::RegistrarStaff, 'registrar-staff.reject@grc.test');

        $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", [
            'action' => 'reject',
        ])->assertUnprocessable();

        $response = $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", [
            'action' => 'reject', 'reason' => 'No official transcript on file.',
        ]);

        $response->assertOk()->assertJsonPath('data.status', 'rejected');
        self::assertSame(
            'No official transcript on file.',
            AuditLog::query()->where('auditable_type', 'transferee_credit')->sole()->reason,
        );
    }

    public function test_content_edits_are_rejected_once_decided(): void
    {
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $credit = $this->makeTransfereeCredit($student);
        $token = $this->tokenForNewUser(UserRole::RegistrarStaff, 'registrar-staff.locked@grc.test');

        $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", [
            'action' => 'approve',
        ])->assertOk();

        $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", [
            'credited_units' => 5,
        ])->assertUnprocessable();
    }

    public function test_a_registrar_head_cannot_decide_a_transferee_credit(): void
    {
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $credit = $this->makeTransfereeCredit($student);
        $token = $this->tokenForNewUser(UserRole::RegistrarHead, 'registrar-head.forbidden@grc.test');

        $response = $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", [
            'action' => 'approve',
        ]);

        $response->assertForbidden();
    }

    public function test_a_student_sees_only_their_own_transferee_credit(): void
    {
        $curriculum = $this->makeCurriculum();
        $studentA = $this->makeStudent($curriculum);
        $this->makeTransfereeCredit($studentA);

        $studentB = $this->makeStudent($curriculum, 'student.b.transfer@grc.test', '2026-0002');
        $this->makeTransfereeCredit($studentB);

        $tokenA = $this->tokenFor($studentA->user);
        $response = $this->withToken($tokenA)->getJson('/api/v1/transferee-credits');

        $response->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_registrar_staff_sees_every_transferee_credit(): void
    {
        $curriculum = $this->makeCurriculum();
        $studentA = $this->makeStudent($curriculum);
        $this->makeTransfereeCredit($studentA);

        $studentB = $this->makeStudent($curriculum, 'student.b.transfer@grc.test', '2026-0002');
        $this->makeTransfereeCredit($studentB);

        $token = $this->tokenForNewUser(UserRole::RegistrarStaff, 'registrar-staff.viewall@grc.test');
        $response = $this->withToken($token)->getJson('/api/v1/transferee-credits');

        $response->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_registrar_head_sees_every_transferee_credit(): void
    {
        $curriculum = $this->makeCurriculum();
        $studentA = $this->makeStudent($curriculum);
        $this->makeTransfereeCredit($studentA);

        $studentB = $this->makeStudent($curriculum, 'student.b.transfer@grc.test', '2026-0002');
        $this->makeTransfereeCredit($studentB);

        $token = $this->tokenForNewUser(UserRole::RegistrarHead, 'registrar-head.viewall@grc.test');
        $response = $this->withToken($token)->getJson('/api/v1/transferee-credits');

        $response->assertOk()->assertJsonCount(2, 'data');
    }
}
