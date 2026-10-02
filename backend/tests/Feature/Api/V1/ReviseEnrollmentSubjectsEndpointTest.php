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
use App\Domain\Organization\CollegeCode;
use App\Domain\Organization\ProgramStatus;
use App\Domain\Scheduling\SectionStatus;
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

/**
 * A Program Head adding/removing whole subjects from a student's proposed
 * schedule while it sits at their own review stage (owner-requested,
 * 2026-09-28), plus the optional comment a Program Head may leave alongside
 * their approve/reject decision on the same route these tests exercise via
 * `PATCH /enrollments/{enrollment}`.
 */
final class ReviseEnrollmentSubjectsEndpointTest extends TestCase
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
        $program = Program::create(['code' => 'BSCS', 'name' => 'BSCS Program', 'status' => ProgramStatus::Active, 'college' => CollegeCode::Ccs]);

        return Curriculum::create([
            'program_id' => $program->id, 'name' => 'BSCS Curriculum',
            'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Active,
        ]);
    }

    private function makeSubject(string $code, float $units = 3.0): Subject
    {
        return Subject::create(['code' => $code, 'title' => $code.' Title', 'units' => $units, 'status' => SubjectStatus::Active]);
    }

    private function makeSection(AcademicTerm $term, Subject $subject, array $overrides = []): Section
    {
        return Section::create(array_merge([
            'academic_term_id' => $term->id,
            'subject_id' => $subject->id,
            'section_code' => 'A',
            'capacity' => 40,
            'status' => SectionStatus::Published,
        ], $overrides));
    }

    private function makeStudent(Curriculum $curriculum): StudentProfile
    {
        $user = User::create([
            'name' => 'Test Student', 'email' => 'student.revise@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::Student, 'status' => UserStatus::Active, 'last_otp_verified_at' => now(),
        ]);

        return StudentProfile::create([
            'user_id' => $user->id,
            'student_number' => '2026-0099',
            'program_id' => $curriculum->program_id,
            'curriculum_id' => $curriculum->id,
            'year_level' => 1,
            'admission_status' => AdmissionStatus::Admitted,
            'academic_standing' => AcademicStanding::Good,
        ]);
    }

    /**
     * @param  list<Section>  $sections
     */
    private function makeEnrollment(StudentProfile $student, AcademicTerm $term, array $sections): Enrollment
    {
        $enrollment = Enrollment::create([
            'student_id' => $student->id,
            'academic_term_id' => $term->id,
            'status' => EnrollmentStatus::PendingProgramHeadApproval,
            'total_units' => array_sum(array_map(fn (Section $s): float => (float) $s->subject->units, $sections)),
            'submitted_at' => now(),
        ]);

        foreach ($sections as $section) {
            EnrollmentSubject::create([
                'enrollment_id' => $enrollment->id,
                'section_id' => $section->id,
                'status' => EnrollmentSubjectStatus::Selected,
            ]);
            $section->increment('enrolled_count');
        }

        return $enrollment;
    }

    private function tokenForProgramHead(string $email, ?CollegeCode $college = CollegeCode::Ccs): string
    {
        User::create([
            'name' => 'Program Head', 'email' => $email, 'college' => $college,
            'password' => self::PASSWORD, 'role' => UserRole::ProgramChair, 'status' => UserStatus::Active, 'last_otp_verified_at' => now(),
        ]);

        return (string) $this->postJson('/api/v1/auth/login', [
            'email' => $email, 'password' => self::PASSWORD,
        ])->json('data.token');
    }

    public function test_a_program_head_can_swap_a_subject_for_another_and_the_seats_move(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $cs101 = $this->makeSubject('CS101');
        $cs102 = $this->makeSubject('CS102');
        $sectionA = $this->makeSection($term, $cs101);
        $sectionB = $this->makeSection($term, $cs102);
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term, [$sectionA]);
        $token = $this->tokenForProgramHead('head.swap@grc.test');

        $response = $this->withToken($token)->patchJson("/api/v1/enrollments/{$enrollment->id}/subjects", [
            'section_ids' => [$sectionB->id],
            'note' => 'The original section clashes with your other classes.',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.status', 'pending_student_review')
            ->assertJsonCount(1, 'data.revisions')
            ->assertJsonPath('data.revisions.0.note', 'The original section clashes with your other classes.')
            ->assertJsonPath('data.revisions.0.status', 'pending')
            ->assertJsonPath('data.revisions.0.removed_subjects.0.subject_code', 'CS101')
            ->assertJsonPath('data.revisions.0.added_subjects.0.subject_code', 'CS102');
        $enrollment->refresh();
        self::assertSame(EnrollmentStatus::PendingStudentReview, $enrollment->status);
        self::assertSame(3.0, $enrollment->total_units);
        self::assertSame([$sectionB->id], $enrollment->enrollmentSubjects()->where('status', EnrollmentSubjectStatus::Selected)->pluck('section_id')->all());
        self::assertSame(0, $sectionA->refresh()->enrolled_count);
        self::assertSame(1, $sectionB->refresh()->enrolled_count);
        self::assertSame(
            1,
            AuditLog::query()->where('action', AuditAction::ENROLLMENT_PROGRAM_HEAD_SUBJECTS_REVISED)->count(),
        );
    }

    public function test_a_program_head_can_add_a_subject_recomputing_total_units(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $cs101 = $this->makeSubject('CS101', 3.0);
        $cs102 = $this->makeSubject('CS102', 2.0);
        $sectionA = $this->makeSection($term, $cs101);
        $sectionB = $this->makeSection($term, $cs102);
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term, [$sectionA]);
        $token = $this->tokenForProgramHead('head.add@grc.test');

        $this->withToken($token)->patchJson("/api/v1/enrollments/{$enrollment->id}/subjects", [
            'section_ids' => [$sectionA->id, $sectionB->id],
            'note' => 'The original section clashes with your other classes.',
        ])->assertOk();

        self::assertSame(5.0, $enrollment->refresh()->total_units);
        self::assertSame(2, $enrollment->enrollmentSubjects()->where('status', EnrollmentSubjectStatus::Selected)->count());
    }

    public function test_a_full_section_cannot_be_added(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $cs101 = $this->makeSubject('CS101');
        $cs102 = $this->makeSubject('CS102');
        $sectionA = $this->makeSection($term, $cs101);
        $sectionB = $this->makeSection($term, $cs102, ['capacity' => 1, 'enrolled_count' => 1]);
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term, [$sectionA]);
        $token = $this->tokenForProgramHead('head.full@grc.test');

        $response = $this->withToken($token)->patchJson("/api/v1/enrollments/{$enrollment->id}/subjects", [
            'section_ids' => [$sectionA->id, $sectionB->id],
            'note' => 'The original section clashes with your other classes.',
        ]);

        $response->assertUnprocessable();
        self::assertArrayHasKey('section_ids', $response->json('error.errors'));
        self::assertSame(3.0, $enrollment->refresh()->total_units);
    }

    public function test_a_revision_cannot_push_the_student_past_the_hard_overload_ceiling(): void
    {
        config(['enrollment.max_regular_units' => 15, 'enrollment.overload_max_units' => 18]);
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $cs101 = $this->makeSubject('CS101', 3.0);
        $tooMuch = $this->makeSubject('CS999', 20.0);
        $sectionA = $this->makeSection($term, $cs101);
        $sectionHuge = $this->makeSection($term, $tooMuch);
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term, [$sectionA]);
        $token = $this->tokenForProgramHead('head.overload@grc.test');

        $response = $this->withToken($token)->patchJson("/api/v1/enrollments/{$enrollment->id}/subjects", [
            'section_ids' => [$sectionA->id, $sectionHuge->id],
            'note' => 'The original section clashes with your other classes.',
        ]);

        $response->assertUnprocessable();
        self::assertSame(3.0, $enrollment->refresh()->total_units);
    }

    public function test_a_program_head_cannot_revise_another_colleges_enrollment(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $cs101 = $this->makeSubject('CS101');
        $sectionA = $this->makeSection($term, $cs101);
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term, [$sectionA]);
        $token = $this->tokenForProgramHead('head.otherswap@grc.test', CollegeCode::Coe);

        $this->withToken($token)->patchJson("/api/v1/enrollments/{$enrollment->id}/subjects", [
            'section_ids' => [$sectionA->id],
            'note' => 'The original section clashes with your other classes.',
        ])->assertForbidden();
    }

    public function test_revision_is_rejected_once_the_registrar_stage_has_started(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $cs101 = $this->makeSubject('CS101');
        $sectionA = $this->makeSection($term, $cs101);
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term, [$sectionA]);
        $enrollment->update(['status' => EnrollmentStatus::PendingRegistrarApproval]);
        $token = $this->tokenForProgramHead('head.toolate@grc.test');

        $this->withToken($token)->patchJson("/api/v1/enrollments/{$enrollment->id}/subjects", [
            'section_ids' => [$sectionA->id],
            'note' => 'The original section clashes with your other classes.',
        ])->assertUnprocessable();
    }

    public function test_approving_with_a_comment_notifies_the_student_with_it(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $cs101 = $this->makeSubject('CS101');
        $sectionA = $this->makeSection($term, $cs101);
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term, [$sectionA]);
        $token = $this->tokenForProgramHead('head.comment@grc.test');

        $this->withToken($token)->patchJson("/api/v1/enrollments/{$enrollment->id}", [
            'action' => 'program_head_approve',
            'program_head_comment' => 'Swapped CS102 for CS101 since the former is full.',
        ])->assertOk()->assertJsonPath('data.program_head_comment', 'Swapped CS102 for CS101 since the former is full.');

        $notification = Notification::query()->where('user_id', $student->user_id)->sole();
        self::assertSame(NotificationType::EnrollmentProgramHeadApproved, $notification->type);
        self::assertStringContainsString('Swapped CS102 for CS101', $notification->message);
    }

    public function test_a_decision_without_a_comment_leaves_it_null(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $cs101 = $this->makeSubject('CS101');
        $sectionA = $this->makeSection($term, $cs101);
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term, [$sectionA]);
        $token = $this->tokenForProgramHead('head.nocomment@grc.test');

        $this->withToken($token)->patchJson("/api/v1/enrollments/{$enrollment->id}", [
            'action' => 'program_head_approve',
        ])->assertOk()->assertJsonPath('data.program_head_comment', null);
    }
}
