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
use App\Models\Program;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class EnrollmentDocumentsEndpointTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    private function makeTerm(): AcademicTerm
    {
        return AcademicTerm::create([
            'school_year' => '2026-2027', 'semester' => '1st', 'status' => AcademicTermStatus::Active,
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

    private function makeStudent(Curriculum $curriculum, string $email, string $studentNumber): StudentProfile
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
            'document_type' => EnrollmentDocumentType::Com,
            'document_number' => sprintf('COM%06d', $enrollment->id),
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
}
