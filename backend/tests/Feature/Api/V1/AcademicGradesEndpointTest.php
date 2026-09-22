<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Academic\GradeMark;
use App\Domain\Academic\GradeStatus;
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
use App\Domain\Organization\CollegeCode;
use App\Domain\Organization\ProgramStatus;
use App\Domain\Scheduling\SectionStatus;
use App\Models\AcademicGrade;
use App\Models\AcademicTerm;
use App\Models\AuditLog;
use App\Models\Curriculum;
use App\Models\Enrollment;
use App\Models\EnrollmentSubject;
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

    private function enroll(StudentProfile $student, AcademicTerm $term, Section $section): void
    {
        $enrollment = Enrollment::create([
            'student_id' => $student->id,
            'academic_term_id' => $term->id,
            'status' => EnrollmentStatus::Enrolled,
            'total_units' => $section->subject->units,
            'enrolled_at' => now(),
        ]);

        EnrollmentSubject::create([
            'enrollment_id' => $enrollment->id,
            'section_id' => $section->id,
            'status' => EnrollmentSubjectStatus::Enrolled,
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
        $this->enroll($student, $term, $section);
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
        $this->enroll($student, $term, $section);
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
        $this->enroll($student, $term, $section);
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
        $this->enroll($student, $term, $section);
        $grade = $this->makeGrade($student, $subject, $section, $term, $professor);
        $grade->update(['mark' => '1.50', 'final_grade' => '1.50']);
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
        $this->enroll($student, $term, $section);
        $grade = $this->makeGrade($student, $subject, $section, $term, $professor);
        $grade->update(['mark' => '1.50', 'final_grade' => '1.50']);
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

    public function test_a_registrar_head_can_filter_academic_grades_by_college(): void
    {
        $term = $this->makeTerm();

        $programCcs = Program::create(['code' => 'BSCS', 'name' => 'BS Computer Science', 'college' => CollegeCode::Ccs, 'status' => ProgramStatus::Active]);
        $curriculumCcs = Curriculum::create(['program_id' => $programCcs->id, 'name' => 'BSCS Curriculum', 'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Active]);
        $subjectCcs = Subject::create(['code' => 'CS101', 'title' => 'CS101 Title', 'college' => CollegeCode::Ccs, 'units' => 3.0, 'status' => SubjectStatus::Active]);

        $programCbae = Program::create(['code' => 'BSBA', 'name' => 'BS Business Admin', 'college' => CollegeCode::Cbae, 'status' => ProgramStatus::Active]);
        $curriculumCbae = Curriculum::create(['program_id' => $programCbae->id, 'name' => 'BSBA Curriculum', 'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Active]);
        $subjectCbae = Subject::create(['code' => 'BA101', 'title' => 'BA101 Title', 'college' => CollegeCode::Cbae, 'units' => 3.0, 'status' => SubjectStatus::Active]);

        $professor = User::create(['name' => 'Prof Multi', 'email' => 'prof.multi@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $sectionCcs = $this->makeSection($term, $subjectCcs, $professor);
        $sectionCbae = $this->makeSection($term, $subjectCbae, $professor);

        $studentCcs = $this->makeStudent($curriculumCcs, 'student.ccs@grc.test', '2026-0006');
        $studentCbae = $this->makeStudent($curriculumCbae, 'student.cbae@grc.test', '2026-0007');

        $this->makeGrade($studentCcs, $subjectCcs, $sectionCcs, $term, $professor);
        $this->makeGrade($studentCbae, $subjectCbae, $sectionCbae, $term, $professor);

        $registrarToken = $this->tokenForNewUser(UserRole::RegistrarHead, 'registrar.deptview@grc.test');

        // Filter by CCS
        $ccsResponse = $this->withToken($registrarToken)->getJson('/api/v1/academic-grades?college=ccs');
        $ccsResponse->assertOk()->assertJsonCount(1, 'data');
        $ccsResponse->assertJsonPath('data.0.student_number', $studentCcs->student_number);
        $ccsResponse->assertJsonPath('data.0.college', 'ccs');

        // Filter by CBAE
        $cbaeResponse = $this->withToken($registrarToken)->getJson('/api/v1/academic-grades?college=cbae');
        $cbaeResponse->assertOk()->assertJsonCount(1, 'data');
        $cbaeResponse->assertJsonPath('data.0.student_number', $studentCbae->student_number);
        $cbaeResponse->assertJsonPath('data.0.college', 'cbae');

        // Filter by COE (empty)
        $coeResponse = $this->withToken($registrarToken)->getJson('/api/v1/academic-grades?college=coe');
        $coeResponse->assertOk()->assertJsonCount(0, 'data');

        // Filter by all
        $allResponse = $this->withToken($registrarToken)->getJson('/api/v1/academic-grades?college=all');
        $allResponse->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_a_faculty_member_can_complete_an_inc_grade_within_three_semesters(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject();
        $professor = User::create(['name' => 'Prof INC', 'email' => 'prof.inc@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $section = $this->makeSection($term, $subject, $professor);
        $student = $this->makeStudent($curriculum, 'student.inc@grc.test', '2026-9001');

        // Create a locked grade with mark INC
        $grade = AcademicGrade::create([
            'student_id' => $student->id,
            'subject_id' => $subject->id,
            'section_id' => $section->id,
            'academic_term_id' => $term->id,
            'mark' => GradeMark::Incomplete,
            'final_grade' => null,
            'status' => GradeStatus::Locked,
            'encoded_by' => $professor->id,
            'submitted_at' => now(),
            'locked_at' => now(),
        ]);

        $token = $this->tokenFor($professor);

        // Professor completes the INC with a final mark of 2.00
        $response = $this->withToken($token)->patchJson("/api/v1/academic-grades/{$grade->id}", [
            'mark' => '2.00',
            'remarks' => 'Completed requirements',
        ]);

        $response->assertOk();
        $this->assertEquals(GradeMark::Good, $grade->fresh()->mark);
        $this->assertEquals(GradeStatus::Locked, $grade->fresh()->status);
        $this->assertEquals('Completed requirements', $grade->fresh()->remarks);
    }

    public function test_an_inc_grade_older_than_three_semesters_cannot_be_edited(): void
    {
        // Current ongoing term is 2026-2027 1st
        $this->makeTerm();

        // Old term from 4 semesters ago: 2024-2025 1st
        $oldTerm = AcademicTerm::create([
            'school_year' => '2024-2025',
            'semester' => '1st',
            'status' => AcademicTermStatus::Archived,
        ]);

        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject();
        $professor = User::create(['name' => 'Prof Expired', 'email' => 'prof.expired@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $section = $this->makeSection($oldTerm, $subject, $professor);
        $student = $this->makeStudent($curriculum, 'student.expired@grc.test', '2024-9001');

        $grade = AcademicGrade::create([
            'student_id' => $student->id,
            'subject_id' => $subject->id,
            'section_id' => $section->id,
            'academic_term_id' => $oldTerm->id,
            'mark' => GradeMark::Incomplete,
            'final_grade' => null,
            'status' => GradeStatus::Locked,
            'encoded_by' => $professor->id,
            'submitted_at' => now(),
            'locked_at' => now(),
        ]);

        $token = $this->tokenFor($professor);

        // Attempting to edit an expired INC grade is rejected
        $response = $this->withToken($token)->patchJson("/api/v1/academic-grades/{$grade->id}", [
            'mark' => '1.75',
        ]);

        $response->assertUnprocessable();
        self::assertArrayHasKey('mark', $response->json('error.errors'));
    }
}
