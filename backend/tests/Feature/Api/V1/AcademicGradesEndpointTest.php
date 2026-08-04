<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Academic\GradeStatus;
use App\Domain\Audit\AuditAction;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Notifications\NotificationType;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\ProgramStatus;
use App\Domain\Scheduling\SectionStatus;
use App\Models\AcademicGrade;
use App\Models\AcademicTerm;
use App\Models\AuditLog;
use App\Models\Curriculum;
use App\Models\Notification;
use App\Models\Program;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class AcademicGradesEndpointTest extends TestCase
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

    private function makeSubject(string $code = 'CS101'): Subject
    {
        return Subject::create(['code' => $code, 'title' => $code.' Title', 'units' => 3.0, 'status' => SubjectStatus::Active]);
    }

    private function makeStudent(Curriculum $curriculum, string $email = 'student.grade@grc.test', string $studentNumber = '2026-0001'): StudentProfile
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

    private function makeSection(AcademicTerm $term, Subject $subject, ?User $professor): Section
    {
        return Section::create([
            'academic_term_id' => $term->id,
            'subject_id' => $subject->id,
            'section_code' => 'A',
            'professor_id' => $professor?->id,
            'capacity' => 40,
            'status' => SectionStatus::Published,
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

    private function tokenFor(User $user): string
    {
        return (string) $this->postJson('/api/v1/auth/login', [
            'email' => $user->email, 'password' => self::PASSWORD,
        ])->json('data.token');
    }

    private function makeGrade(StudentProfile $student, Subject $subject, Section $section, AcademicTerm $term, User $encoder, GradeStatus $status = GradeStatus::Draft): AcademicGrade
    {
        return AcademicGrade::create([
            'student_id' => $student->id,
            'subject_id' => $subject->id,
            'section_id' => $section->id,
            'academic_term_id' => $term->id,
            'status' => $status,
            'encoded_by' => $encoder->id,
        ]);
    }

    public function test_anonymous_request_is_unauthenticated(): void
    {
        $this->getJson('/api/v1/academic-grades')->assertUnauthorized();
        $this->postJson('/api/v1/academic-grades', [])->assertUnauthorized();
    }

    public function test_a_non_listed_role_cannot_view_any(): void
    {
        $token = $this->tokenForNewUser(UserRole::AccountingStaff, 'accounting.grade@grc.test');

        $this->withToken($token)->getJson('/api/v1/academic-grades')->assertForbidden();
    }

    public function test_a_faculty_member_can_create_a_draft_grade_for_their_own_section(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject();
        $professor = User::create(['name' => 'Prof', 'email' => 'prof.create@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $section = $this->makeSection($term, $subject, $professor);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($professor);

        $response = $this->withToken($token)->postJson('/api/v1/academic-grades', [
            'student_id' => $student->id,
            'subject_id' => $subject->id,
            'section_id' => $section->id,
            'academic_term_id' => $term->id,
            'mark' => '1.50',
            'remarks' => null,
        ]);

        $response->assertCreated()->assertJsonPath('data.status', 'draft')->assertJsonPath('data.mark', '1.50')
            ->assertJsonPath('data.mark_label', 'with Distinction');
        self::assertSame('1.50', AcademicGrade::query()->sole()->final_grade);
        self::assertSame(AuditAction::ACADEMIC_GRADE_CREATED, AuditLog::query()->sole()->action);
    }

    public function test_a_leadership_subject_rejects_a_numeric_mark(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('LEAD 1');
        $professor = User::create(['name' => 'Prof', 'email' => 'prof.lead@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $section = $this->makeSection($term, $subject, $professor);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($professor);

        $response = $this->withToken($token)->postJson('/api/v1/academic-grades', [
            'student_id' => $student->id,
            'subject_id' => $subject->id,
            'section_id' => $section->id,
            'academic_term_id' => $term->id,
            'mark' => '1.50',
        ]);

        $response->assertUnprocessable();
        self::assertArrayHasKey('mark', $response->json('error.errors'));
    }

    public function test_a_leadership_subject_accepts_complete(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('LEAD 1');
        $professor = User::create(['name' => 'Prof', 'email' => 'prof.leadok@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $section = $this->makeSection($term, $subject, $professor);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($professor);

        $response = $this->withToken($token)->postJson('/api/v1/academic-grades', [
            'student_id' => $student->id,
            'subject_id' => $subject->id,
            'section_id' => $section->id,
            'academic_term_id' => $term->id,
            'mark' => 'C',
        ]);

        $response->assertCreated()->assertJsonPath('data.mark', 'C')->assertJsonPath('data.mark_label', 'Complete');
        self::assertNull(AcademicGrade::query()->sole()->final_grade);
    }

    public function test_an_ordinary_subject_rejects_complete(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject();
        $professor = User::create(['name' => 'Prof', 'email' => 'prof.nonlead@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $section = $this->makeSection($term, $subject, $professor);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($professor);

        $response = $this->withToken($token)->postJson('/api/v1/academic-grades', [
            'student_id' => $student->id,
            'subject_id' => $subject->id,
            'section_id' => $section->id,
            'academic_term_id' => $term->id,
            'mark' => 'C',
        ]);

        $response->assertUnprocessable();
        self::assertArrayHasKey('mark', $response->json('error.errors'));
    }

    public function test_a_faculty_member_cannot_create_a_grade_for_someone_elses_section(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject();
        $owningProfessor = User::create(['name' => 'Owner', 'email' => 'prof.owner@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $section = $this->makeSection($term, $subject, $owningProfessor);
        $student = $this->makeStudent($curriculum);
        $otherToken = $this->tokenForNewUser(UserRole::Faculty, 'prof.other@grc.test');

        $response = $this->withToken($otherToken)->postJson('/api/v1/academic-grades', [
            'student_id' => $student->id,
            'subject_id' => $subject->id,
            'section_id' => $section->id,
            'academic_term_id' => $term->id,
        ]);

        $response->assertUnprocessable();
        self::assertArrayHasKey('section_id', $response->json('error.errors'));
        $this->assertDatabaseCount('academic_grades', 0);
    }

    public function test_a_duplicate_grade_for_the_same_student_subject_term_is_rejected(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject();
        $professor = User::create(['name' => 'Prof', 'email' => 'prof.dup@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $section = $this->makeSection($term, $subject, $professor);
        $student = $this->makeStudent($curriculum);
        $this->makeGrade($student, $subject, $section, $term, $professor);
        $token = $this->tokenFor($professor);

        $response = $this->withToken($token)->postJson('/api/v1/academic-grades', [
            'student_id' => $student->id,
            'subject_id' => $subject->id,
            'section_id' => $section->id,
            'academic_term_id' => $term->id,
        ]);

        $response->assertUnprocessable();
        $this->assertDatabaseCount('academic_grades', 1);
    }

    public function test_a_faculty_member_can_edit_their_own_draft_grade(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject();
        $professor = User::create(['name' => 'Prof', 'email' => 'prof.edit@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $section = $this->makeSection($term, $subject, $professor);
        $student = $this->makeStudent($curriculum);
        $grade = $this->makeGrade($student, $subject, $section, $term, $professor);
        $token = $this->tokenFor($professor);

        $response = $this->withToken($token)->patchJson("/api/v1/academic-grades/{$grade->id}", [
            'mark' => '3.00',
            'remarks' => null,
        ]);

        $response->assertOk();
        self::assertSame('3.00', $grade->refresh()->final_grade);
        self::assertSame('3.00', $grade->mark->value);
        self::assertSame(AuditAction::ACADEMIC_GRADE_UPDATED, AuditLog::query()->sole()->action);
    }

    public function test_a_faculty_member_cannot_edit_a_grade_once_submitted(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject();
        $professor = User::create(['name' => 'Prof', 'email' => 'prof.locked@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $section = $this->makeSection($term, $subject, $professor);
        $student = $this->makeStudent($curriculum);
        $grade = $this->makeGrade($student, $subject, $section, $term, $professor, GradeStatus::Submitted);
        $token = $this->tokenFor($professor);

        $response = $this->withToken($token)->patchJson("/api/v1/academic-grades/{$grade->id}", [
            'mark' => '3.00',
        ]);

        $response->assertUnprocessable();
    }

    public function test_a_faculty_member_cannot_edit_another_professors_grade(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject();
        $owningProfessor = User::create(['name' => 'Owner', 'email' => 'prof.owns@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $section = $this->makeSection($term, $subject, $owningProfessor);
        $student = $this->makeStudent($curriculum);
        $grade = $this->makeGrade($student, $subject, $section, $term, $owningProfessor);
        $otherToken = $this->tokenForNewUser(UserRole::Faculty, 'prof.notowner@grc.test');

        $response = $this->withToken($otherToken)->patchJson("/api/v1/academic-grades/{$grade->id}", [
            'mark' => '3.00',
        ]);

        $response->assertForbidden();
    }

    public function test_submit_transitions_a_draft_grade_to_submitted(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject();
        $professor = User::create(['name' => 'Prof', 'email' => 'prof.submit@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $section = $this->makeSection($term, $subject, $professor);
        $student = $this->makeStudent($curriculum);
        $grade = $this->makeGrade($student, $subject, $section, $term, $professor);
        $token = $this->tokenFor($professor);

        $response = $this->withToken($token)->patchJson("/api/v1/academic-grades/{$grade->id}", ['action' => 'submit']);

        $response->assertOk()->assertJsonPath('data.status', 'submitted');
        self::assertNotNull($grade->refresh()->submitted_at);
        self::assertSame(AuditAction::ACADEMIC_GRADE_SUBMITTED, AuditLog::query()->sole()->action);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_submit_cannot_be_performed_by_a_non_owning_faculty_member(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject();
        $owningProfessor = User::create(['name' => 'Owner', 'email' => 'prof.submitowner@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $section = $this->makeSection($term, $subject, $owningProfessor);
        $student = $this->makeStudent($curriculum);
        $grade = $this->makeGrade($student, $subject, $section, $term, $owningProfessor);
        $otherToken = $this->tokenForNewUser(UserRole::Faculty, 'prof.submitother@grc.test');

        $response = $this->withToken($otherToken)->patchJson("/api/v1/academic-grades/{$grade->id}", ['action' => 'submit']);

        $response->assertForbidden();
        self::assertSame('draft', $grade->refresh()->status->value);
    }

    public function test_lock_transitions_a_submitted_grade_to_locked_and_notifies_the_student(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject();
        $professor = User::create(['name' => 'Prof', 'email' => 'prof.lock@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $section = $this->makeSection($term, $subject, $professor);
        $student = $this->makeStudent($curriculum);
        $grade = $this->makeGrade($student, $subject, $section, $term, $professor, GradeStatus::Submitted);
        $registrarToken = $this->tokenForNewUser(UserRole::RegistrarHead, 'registrar.lock@grc.test');

        $response = $this->withToken($registrarToken)->patchJson("/api/v1/academic-grades/{$grade->id}", ['action' => 'lock']);

        $response->assertOk()->assertJsonPath('data.status', 'locked');
        self::assertNotNull($grade->refresh()->locked_at);
        self::assertSame(
            AuditAction::ACADEMIC_GRADE_LOCKED,
            AuditLog::query()->where('action', AuditAction::ACADEMIC_GRADE_LOCKED)->sole()->action,
        );

        // Locking also reclassifies the student's enrollment_category (this
        // student starts unclassified, so this is its first-ever derivation
        // to "regular") — see ReclassifyStudentEnrollmentCategoryTest for
        // that behavior in isolation. Both notifications land on the same
        // student; assert the grade-locked one specifically by type.
        $gradeLockedNotification = Notification::query()
            ->where('type', NotificationType::AcademicGradeLocked)
            ->sole();
        self::assertSame($student->user_id, $gradeLockedNotification->user_id);
    }

    public function test_lock_cannot_be_performed_by_faculty(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject();
        $professor = User::create(['name' => 'Prof', 'email' => 'prof.nolock@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $section = $this->makeSection($term, $subject, $professor);
        $student = $this->makeStudent($curriculum);
        $grade = $this->makeGrade($student, $subject, $section, $term, $professor, GradeStatus::Submitted);
        $token = $this->tokenFor($professor);

        $response = $this->withToken($token)->patchJson("/api/v1/academic-grades/{$grade->id}", ['action' => 'lock']);

        $response->assertForbidden();
        self::assertSame('submitted', $grade->refresh()->status->value);
    }

    public function test_a_student_sees_only_their_own_grades(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject();
        $professor = User::create(['name' => 'Prof', 'email' => 'prof.studentview@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $section = $this->makeSection($term, $subject, $professor);
        $student = $this->makeStudent($curriculum);
        $this->makeGrade($student, $subject, $section, $term, $professor);

        $otherStudent = $this->makeStudent($curriculum, 'other.student.grade@grc.test', '2026-0002');
        $this->makeGrade($otherStudent, $subject, $section, $term, $professor);

        $token = $this->tokenFor($student->user);

        $response = $this->withToken($token)->getJson('/api/v1/academic-grades');

        $response->assertOk()->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.student_number', $student->student_number);
    }

    public function test_a_faculty_member_sees_only_grades_for_their_own_sections(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject();
        $ownProfessor = User::create(['name' => 'Owner', 'email' => 'prof.ownview@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $ownSection = $this->makeSection($term, $subject, $ownProfessor);
        $student = $this->makeStudent($curriculum);
        $this->makeGrade($student, $subject, $ownSection, $term, $ownProfessor);

        $otherProfessor = User::create(['name' => 'Other', 'email' => 'prof.otherview@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $otherSection = $this->makeSection($term, $this->makeSubject('CS102'), $otherProfessor);
        $otherStudent = $this->makeStudent($curriculum, 'other.faculty.grade@grc.test', '2026-0003');
        $this->makeGrade($otherStudent, $otherSection->subject, $otherSection, $term, $otherProfessor);

        $token = $this->tokenFor($ownProfessor);

        $response = $this->withToken($token)->getJson('/api/v1/academic-grades');

        $response->assertOk()->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.student_number', $student->student_number);
    }

    public function test_a_registrar_head_sees_every_grade_with_filters_and_pagination(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject();
        $professor = User::create(['name' => 'Prof', 'email' => 'prof.registrarview@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $section = $this->makeSection($term, $subject, $professor);
        $studentA = $this->makeStudent($curriculum);
        $this->makeGrade($studentA, $subject, $section, $term, $professor);

        $studentB = $this->makeStudent($curriculum, 'second.student.grade@grc.test', '2026-0004');
        $this->makeGrade($studentB, $subject, $section, $term, $professor);

        $registrarToken = $this->tokenForNewUser(UserRole::RegistrarHead, 'registrar.gradeview@grc.test');

        $all = $this->withToken($registrarToken)->getJson('/api/v1/academic-grades');
        $all->assertOk()->assertJsonCount(2, 'data');

        $paged = $this->withToken($registrarToken)->getJson('/api/v1/academic-grades?per_page=1&page=1');
        $paged->assertOk()->assertJsonCount(1, 'data');
        $paged->assertJsonPath('meta.total', 2);
    }

    /**
     * Phase 7b Task 3: Registrar Staff gets the same broad read access the
     * Registrar Head already has (PRD §3.8 "view permitted academic
     * records") — mirrors the test directly above.
     */
    public function test_a_registrar_staff_sees_every_grade(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject();
        $professor = User::create(['name' => 'Prof', 'email' => 'prof.staffview@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $section = $this->makeSection($term, $subject, $professor);
        $studentA = $this->makeStudent($curriculum);
        $this->makeGrade($studentA, $subject, $section, $term, $professor);

        $studentB = $this->makeStudent($curriculum, 'second.student.staffview@grc.test', '2026-0005');
        $this->makeGrade($studentB, $subject, $section, $term, $professor);

        $registrarStaffToken = $this->tokenForNewUser(UserRole::RegistrarStaff, 'registrar-staff.gradeview@grc.test');

        $response = $this->withToken($registrarStaffToken)->getJson('/api/v1/academic-grades');
        $response->assertOk()->assertJsonCount(2, 'data');
    }
}
