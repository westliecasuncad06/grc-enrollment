<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Enrollment\EnrollmentDocumentType;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\ProgramStatus;
use App\Models\AcademicTerm;
use App\Models\Curriculum;
use App\Models\Enrollment;
use App\Models\EnrollmentDocument;
use App\Models\Payment;
use App\Models\Program;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

final class EnrollmentDocumentsEndpointTest extends TestCase
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

    private function makeStudent(Curriculum $curriculum, string $email, string $studentNumber, string $name = 'Test Student'): StudentProfile
    {
        $user = User::create([
            'name' => $name, 'email' => $email,
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

    private function makeDocument(StudentProfile $student, AcademicTerm $term): EnrollmentDocument
    {
        $enrollment = Enrollment::create([
            'student_id' => $student->id,
            'academic_term_id' => $term->id,
            'status' => EnrollmentStatus::Enrolled,
            'total_units' => 3,
            'submitted_at' => now(),
        ]);

        return EnrollmentDocument::create([
            'enrollment_id' => $enrollment->id,
            'document_type' => EnrollmentDocumentType::Cor,
            'document_number' => sprintf('COR%06d', $enrollment->id),
            'generated_at' => now(),
        ]);
    }

    public function test_anonymous_request_is_unauthenticated(): void
    {
        $this->getJson('/api/v1/enrollment-documents')->assertUnauthorized();
    }

    public function test_a_non_listed_role_cannot_view_enrollment_documents(): void
    {
        $token = $this->tokenForNewUser(UserRole::Faculty, 'faculty.docforbidden@grc.test');

        $this->withToken($token)->getJson('/api/v1/enrollment-documents')->assertForbidden();
    }

    public function test_a_student_sees_only_their_own_enrollment_documents(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum, 'student.owndoc@grc.test', '2026-0001');
        $ownDocument = $this->makeDocument($student, $term);

        $otherStudent = $this->makeStudent($curriculum, 'other.student.doc@grc.test', '2026-0002');
        $this->makeDocument($otherStudent, $term);

        $token = $this->tokenFor($student->user);

        $response = $this->withToken($token)->getJson('/api/v1/enrollment-documents');

        $response->assertOk()->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.id', $ownDocument->id);
        $response->assertJsonPath('data.0.student_number', $student->student_number);
        $response->assertJsonPath('data.0.student_name', null);
    }

    public function test_a_student_cannot_open_another_students_cor_detail(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum, 'student.owncordetail@grc.test', '2026-0011');
        $otherStudent = $this->makeStudent($curriculum, 'student.othercordetail@grc.test', '2026-0012');
        $otherDocument = $this->makeDocument($otherStudent, $term);

        $this->withToken($this->tokenFor($student->user))
            ->getJson("/api/v1/enrollment-documents/{$otherDocument->id}")
            ->assertForbidden();
    }

    public function test_a_legacy_com_row_is_presented_to_its_student_as_a_cor(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum, 'student.legacycor@grc.test', '2026-0013');
        $enrollment = Enrollment::create([
            'student_id' => $student->id,
            'academic_term_id' => $term->id,
            'status' => EnrollmentStatus::Enrolled,
            'total_units' => 3,
            'submitted_at' => now(),
        ]);
        DB::table('enrollment_documents')->insert([
            'enrollment_id' => $enrollment->id,
            'document_type' => 'com',
            'document_number' => 'COM000013',
            'generated_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->withToken($this->tokenFor($student->user))
            ->getJson('/api/v1/enrollment-documents')
            ->assertOk()
            ->assertJsonPath('data.0.document_type', 'cor')
            ->assertJsonPath('data.0.document_type_label', 'Certificate of Registration')
            ->assertJsonPath('data.0.document_number', 'COR000013');
    }

    public function test_a_paid_legacy_com_row_opens_as_a_printable_cor_snapshot(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum, 'student.legacysnapshot@grc.test', '2026-0014');
        $cashier = User::create([
            'name' => 'Test Cashier',
            'email' => 'cashier.legacysnapshot@grc.test',
            'password' => self::PASSWORD,
            'role' => UserRole::AccountingStaff,
            'status' => UserStatus::Active,
        ]);
        $enrollment = Enrollment::create([
            'student_id' => $student->id,
            'academic_term_id' => $term->id,
            'status' => EnrollmentStatus::Enrolled,
            'total_units' => 3,
            'submitted_at' => now(),
        ]);
        $payment = Payment::create([
            'enrollment_id' => $enrollment->id,
            'confirmed_by' => $cashier->id,
            'amount' => '1500.00',
            'confirmed_at' => now(),
        ]);
        DB::table('enrollment_documents')->insert([
            'enrollment_id' => $enrollment->id,
            'document_type' => 'com',
            'document_number' => 'COM000014',
            'generated_at' => $payment->confirmed_at,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $document = EnrollmentDocument::query()->where('document_number', 'COM000014')->sole();

        $this->withToken($this->tokenFor($student->user))
            ->getJson("/api/v1/enrollment-documents/{$document->id}")
            ->assertOk()
            ->assertJsonPath('data.type', 'certificate_of_registration')
            ->assertJsonPath('data.document_number', 'COR000014')
            ->assertJsonPath('data.snapshot.document_title', 'Certificate of Registration')
            ->assertJsonPath('data.snapshot.student.student_number', '2026-0014')
            ->assertJsonPath('data.snapshot.signatories.cashier', 'Test Cashier');
    }

    public function test_an_enrolled_legacy_record_without_an_imported_payment_still_opens_as_a_cor(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum, 'student.importedcor@grc.test', '2026-0015');
        $enrollment = Enrollment::create([
            'student_id' => $student->id,
            'academic_term_id' => $term->id,
            'status' => EnrollmentStatus::Enrolled,
            'total_units' => 3,
            'submitted_at' => now(),
            'enrolled_at' => now(),
        ]);
        DB::table('enrollment_documents')->insert([
            'enrollment_id' => $enrollment->id,
            'document_type' => 'com',
            'document_number' => 'COM000015',
            'generated_at' => $enrollment->enrolled_at,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $document = EnrollmentDocument::query()->where('document_number', 'COM000015')->sole();

        $this->withToken($this->tokenFor($student->user))
            ->getJson("/api/v1/enrollment-documents/{$document->id}")
            ->assertOk()
            ->assertJsonPath('data.document_number', 'COR000015')
            ->assertJsonPath('data.snapshot.document_title', 'Certificate of Registration')
            ->assertJsonPath('data.snapshot.fees.payment_amount', '0.00')
            ->assertJsonPath('data.snapshot.signatories.cashier', 'Not provided');
    }

    public function test_a_registrar_head_sees_every_enrollment_document(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $studentA = $this->makeStudent($curriculum, 'student.a.doc@grc.test', '2026-0003');
        $this->makeDocument($studentA, $term);
        $studentB = $this->makeStudent($curriculum, 'student.b.doc@grc.test', '2026-0004');
        $this->makeDocument($studentB, $term);

        $registrarToken = $this->tokenForNewUser(UserRole::RegistrarHead, 'registrar.docview@grc.test');

        $response = $this->withToken($registrarToken)->getJson('/api/v1/enrollment-documents');

        $response->assertOk()->assertJsonCount(2, 'data');
    }

    /**
     * Phase 7b Task 3: Registrar Staff gets the same broad read access the
     * Registrar Head already has (PRD §3.8 "view permitted ... enrollment
     * documents") — mirrors the test directly above.
     */
    public function test_a_registrar_staff_sees_every_enrollment_document(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $studentA = $this->makeStudent($curriculum, 'student.a.staffdoc@grc.test', '2026-0005');
        $this->makeDocument($studentA, $term);
        $studentB = $this->makeStudent($curriculum, 'student.b.staffdoc@grc.test', '2026-0006');
        $this->makeDocument($studentB, $term);

        $registrarStaffToken = $this->tokenForNewUser(UserRole::RegistrarStaff, 'registrar-staff.docview@grc.test');

        $response = $this->withToken($registrarStaffToken)->getJson('/api/v1/enrollment-documents');

        $response->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_accounting_staff_sees_prior_certificates_of_registration(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum, 'student.cashiercor@grc.test', '2026-0007');
        $document = $this->makeDocument($student, $term);
        $token = $this->tokenForNewUser(UserRole::AccountingStaff, 'cashier.cor@grc.test');

        $response = $this->withToken($token)->getJson('/api/v1/enrollment-documents');

        $response->assertOk()->assertJsonPath('data.0.id', $document->id);
        $response->assertJsonPath('data.0.document_type', 'cor');

        $this->withToken($token)
            ->getJson("/api/v1/enrollment-documents/{$document->id}")
            ->assertOk()
            ->assertJsonPath('data.type', 'certificate_of_registration')
            ->assertJsonPath('data.document_number', $document->document_number);
    }

    public function test_accounting_staff_can_find_a_students_prior_cor_by_student_number(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $matchingStudent = $this->makeStudent($curriculum, 'student.matchingcor@grc.test', '2026-0101');
        $matchingDocument = $this->makeDocument($matchingStudent, $term);
        $otherStudent = $this->makeStudent($curriculum, 'student.othercor@grc.test', '2026-0102');
        $this->makeDocument($otherStudent, $term);
        $token = $this->tokenForNewUser(UserRole::AccountingStaff, 'cashier.searchcor@grc.test');

        $this->withToken($token)
            ->getJson('/api/v1/enrollment-documents?student_number=2026-0101')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $matchingDocument->id)
            ->assertJsonPath('data.0.student_number', '2026-0101');
    }

    public function test_accounting_staff_and_registrar_head_can_find_cors_by_student_name(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $matchingStudent = $this->makeStudent(
            $curriculum,
            'student.aurora.cor@grc.test',
            '2026-0103',
            'Aurora S. Lopez',
        );
        $matchingDocument = $this->makeDocument($matchingStudent, $term);
        $otherStudent = $this->makeStudent(
            $curriculum,
            'student.other-name.cor@grc.test',
            '2026-0104',
            'Ramon Santos',
        );
        $this->makeDocument($otherStudent, $term);

        foreach ([
            [UserRole::AccountingStaff, 'cashier.name-search@grc.test'],
            [UserRole::RegistrarHead, 'registrar.name-search@grc.test'],
        ] as [$role, $email]) {
            $this->withToken($this->tokenForNewUser($role, $email))
                ->getJson('/api/v1/enrollment-documents?student_name=aurora')
                ->assertOk()
                ->assertJsonCount(1, 'data')
                ->assertJsonPath('data.0.id', $matchingDocument->id)
                ->assertJsonPath('data.0.student_number', '2026-0103')
                ->assertJsonPath('data.0.student_name', 'Aurora S. Lopez');
        }
    }
}
