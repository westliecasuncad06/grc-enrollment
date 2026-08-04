<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Audit\AuditAction;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Enrollment\EnrollmentSubjectStatus;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Notifications\NotificationType;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\ProgramStatus;
use App\Domain\Scheduling\SectionStatus;
use App\Models\AcademicTerm;
use App\Models\Assessment;
use App\Models\AuditLog;
use App\Models\Curriculum;
use App\Models\Enrollment;
use App\Models\EnrollmentDocument;
use App\Models\EnrollmentSubject;
use App\Models\Notification;
use App\Models\Payment;
use App\Models\Program;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class PaymentConfirmationEndpointTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    private function makeTerm(): AcademicTerm
    {
        return AcademicTerm::create([
            'school_year' => '2026-2027', 'semester' => '1st', 'status' => AcademicTermStatus::SemesterOngoing,
        ]);
    }

    private function makeCurriculum(): Curriculum
    {
        $program = Program::create(['code' => 'BSCS', 'name' => 'BS Computer Science', 'status' => ProgramStatus::Active]);

        return Curriculum::create([
            'program_id' => $program->id, 'name' => 'BSCS Curriculum',
            'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Active,
        ]);
    }

    private function makeStudent(Curriculum $curriculum): StudentProfile
    {
        $user = User::create([
            'name' => 'Test Student', 'email' => 'student.payment@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::Student, 'status' => UserStatus::Active,
        ]);

        return StudentProfile::create([
            'user_id' => $user->id,
            'student_number' => '2026-0001',
            'program_id' => $curriculum->program_id,
            'curriculum_id' => $curriculum->id,
            'year_level' => 1,
            'admission_status' => AdmissionStatus::Admitted,
            'academic_standing' => AcademicStanding::Good,
        ]);
    }

    private function makeEnrollment(StudentProfile $student, AcademicTerm $term, EnrollmentStatus $status = EnrollmentStatus::PendingPayment): Enrollment
    {
        return Enrollment::create([
            'student_id' => $student->id,
            'academic_term_id' => $term->id,
            'status' => $status,
            'total_units' => 3,
            'submitted_at' => now(),
        ]);
    }

    private function makeAssessment(Enrollment $enrollment, string $totalAmount): Assessment
    {
        return Assessment::create([
            'enrollment_id' => $enrollment->id,
            'total_amount' => $totalAmount,
            'currency' => 'PHP',
            'assessed_at' => now(),
        ]);
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

    public function test_anonymous_request_is_unauthenticated(): void
    {
        $this->postJson('/api/v1/enrollments/1/payment', [])->assertUnauthorized();
    }

    public function test_a_non_accounting_role_cannot_confirm_payment(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term);
        $token = $this->tokenForNewUser(UserRole::RegistrarHead, 'registrar.paymentforbidden@grc.test');

        $response = $this->withToken($token)->postJson("/api/v1/enrollments/{$enrollment->id}/payment", []);

        $response->assertForbidden();
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_confirming_payment_transitions_enrollment_and_generates_com(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term);
        $token = $this->tokenForNewUser(UserRole::AccountingStaff, 'accounting.confirm@grc.test');

        $response = $this->withToken($token)->postJson("/api/v1/enrollments/{$enrollment->id}/payment", [
            'external_reference' => 'OR-000123',
            'amount' => 1500.00,
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.enrollment.status', 'enrolled');
        $response->assertJsonPath('data.payment.external_reference', 'OR-000123');
        $response->assertJsonPath('data.document.document_number', sprintf('COM%06d', $enrollment->id));

        self::assertSame('enrolled', $enrollment->refresh()->status->value);
        self::assertNotNull($enrollment->payment_confirmed_at);
        self::assertNotNull($enrollment->enrolled_at);
        $this->assertDatabaseCount('payments', 1);
        $this->assertDatabaseCount('enrollment_documents', 1);
        self::assertSame(AuditAction::ENROLLMENT_PAYMENT_CONFIRMED, AuditLog::query()->sole()->action);
        self::assertSame(NotificationType::EnrollmentPaymentConfirmed, Notification::query()->sole()->type);
    }

    public function test_confirming_payment_moves_selected_subjects_to_enrolled_but_leaves_dropped_ones_alone(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term);
        $subject = Subject::create(['code' => 'CS101', 'title' => 'CS101 Title', 'units' => 3.0, 'status' => SubjectStatus::Active]);
        $otherSubject = Subject::create(['code' => 'CS102', 'title' => 'CS102 Title', 'units' => 3.0, 'status' => SubjectStatus::Active]);
        $section = Section::create([
            'academic_term_id' => $term->id, 'subject_id' => $subject->id, 'section_code' => 'A',
            'capacity' => 40, 'status' => SectionStatus::Published,
        ]);
        $droppedSection = Section::create([
            'academic_term_id' => $term->id, 'subject_id' => $otherSubject->id, 'section_code' => 'A',
            'capacity' => 40, 'status' => SectionStatus::Published,
        ]);
        $selectedSubject = EnrollmentSubject::create([
            'enrollment_id' => $enrollment->id, 'section_id' => $section->id, 'status' => EnrollmentSubjectStatus::Selected,
        ]);
        $droppedSubject = EnrollmentSubject::create([
            'enrollment_id' => $enrollment->id, 'section_id' => $droppedSection->id, 'status' => EnrollmentSubjectStatus::Dropped,
        ]);
        $token = $this->tokenForNewUser(UserRole::AccountingStaff, 'accounting.rostertransition@grc.test');

        $this->withToken($token)->postJson("/api/v1/enrollments/{$enrollment->id}/payment", [])->assertCreated();

        self::assertSame(EnrollmentSubjectStatus::Enrolled, $selectedSubject->refresh()->status);
        self::assertSame(EnrollmentSubjectStatus::Dropped, $droppedSubject->refresh()->status);
    }

    public function test_confirming_payment_is_idempotent_and_creates_no_duplicate(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term);
        $token = $this->tokenForNewUser(UserRole::AccountingStaff, 'accounting.idempotent@grc.test');

        $first = $this->withToken($token)->postJson("/api/v1/enrollments/{$enrollment->id}/payment", [
            'external_reference' => 'OR-000123',
        ]);
        $first->assertCreated();

        $second = $this->withToken($token)->postJson("/api/v1/enrollments/{$enrollment->id}/payment", [
            'external_reference' => 'OR-999999',
        ]);

        $second->assertOk();
        $second->assertJsonPath('data.payment.external_reference', 'OR-000123');
        $this->assertDatabaseCount('payments', 1);
        $this->assertDatabaseCount('enrollment_documents', 1);
        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertDatabaseCount('notifications', 1);
        self::assertSame(Payment::query()->sole()->external_reference, 'OR-000123');
        self::assertSame(EnrollmentDocument::query()->count(), 1);
    }

    public function test_an_omitted_amount_defaults_to_the_assessed_total(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term);
        $this->makeAssessment($enrollment, '2400.00');
        $token = $this->tokenForNewUser(UserRole::AccountingStaff, 'accounting.defaultamount@grc.test');

        $response = $this->withToken($token)->postJson("/api/v1/enrollments/{$enrollment->id}/payment", [
            'external_reference' => 'OR-000456',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.payment.amount', '2400.00');
        self::assertSame('2400.00', Payment::query()->sole()->amount);
    }

    public function test_an_explicit_amount_is_recorded_as_is_even_when_it_differs_from_the_assessment(): void
    {
        // §17 has no partial-payment or mismatch policy — an amount the
        // cashier actually typed is trusted, never rejected against the
        // assessment.
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term);
        $this->makeAssessment($enrollment, '2400.00');
        $token = $this->tokenForNewUser(UserRole::AccountingStaff, 'accounting.explicitamount@grc.test');

        $response = $this->withToken($token)->postJson("/api/v1/enrollments/{$enrollment->id}/payment", [
            'amount' => 2000.00,
        ]);

        $response->assertCreated();
        self::assertSame('2000.00', Payment::query()->sole()->amount);
    }

    public function test_an_omitted_amount_with_no_assessment_stays_null(): void
    {
        // The legacy path: an enrollment created directly (not through
        // registrar_approve, as every fixture in this suite still does) has
        // no assessment to default from.
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term);
        $token = $this->tokenForNewUser(UserRole::AccountingStaff, 'accounting.noassessment@grc.test');

        $response = $this->withToken($token)->postJson("/api/v1/enrollments/{$enrollment->id}/payment", []);

        $response->assertCreated();
        self::assertNull(Payment::query()->sole()->amount);
    }

    public function test_payment_cannot_be_confirmed_from_a_non_pending_payment_status(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term, EnrollmentStatus::PendingRegistrarApproval);
        $token = $this->tokenForNewUser(UserRole::AccountingStaff, 'accounting.wrongstate@grc.test');

        $response = $this->withToken($token)->postJson("/api/v1/enrollments/{$enrollment->id}/payment", []);

        $response->assertUnprocessable();
        $this->assertDatabaseCount('payments', 0);
    }
}
