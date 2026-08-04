<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Academic\GradeStatus;
use App\Domain\Audit\AuditAction;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Enrollment\EnrollmentAudience;
use App\Domain\Enrollment\EnrollmentStatus;
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
use App\Models\AcademicTermEnrollmentWindow;
use App\Models\AcademicTermSectionPlan;
use App\Models\AuditLog;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Enrollment;
use App\Models\Notification;
use App\Models\Program;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class EnrollmentsEndpointTest extends TestCase
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

    private function makeSubject(string $code, float $units = 3.0): Subject
    {
        return Subject::create(['code' => $code, 'title' => $code.' Title', 'units' => $units, 'status' => SubjectStatus::Active]);
    }

    private function placeSubject(Curriculum $curriculum, Subject $subject): CurriculumSubject
    {
        return CurriculumSubject::create([
            'curriculum_id' => $curriculum->id, 'subject_id' => $subject->id,
            'year_level' => 1, 'semester' => '1st', 'is_required' => true,
        ]);
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
            'name' => 'Test Student', 'email' => 'student.enroll@grc.test',
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

    /**
     * @return array{0: AcademicTermSectionPlan, 1: list<Section>}
     */
    private function makeBlock(AcademicTerm $term, Curriculum $curriculum, string $blockCode, array $subjectCodes): array
    {
        $plan = AcademicTermSectionPlan::create([
            'academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id,
            'college' => 'ccs', 'year_level' => 1, 'section_count' => 1,
            'students_per_block' => 40, 'status' => 'submitted',
        ]);

        $sections = [];
        // Real block schedules never overlap; staggering the start hour per
        // subject keeps this fixture conflict-free the same way.
        foreach (array_values($subjectCodes) as $index => $subjectCode) {
            $subject = $this->makeSubject($subjectCode);
            $this->placeSubject($curriculum, $subject);
            $startHour = 8 + $index;
            $sections[] = Section::create([
                'academic_term_id' => $term->id,
                'section_plan_id' => $plan->id,
                'subject_id' => $subject->id,
                'section_code' => $blockCode,
                'schedule_days' => 'MWF',
                'starts_at_time' => sprintf('%02d:00:00', $startHour),
                'ends_at_time' => sprintf('%02d:00:00', $startHour + 1),
                'room' => 'LAB-1',
                'professor_id' => User::create([
                    'name' => 'Prof '.$subjectCode, 'email' => strtolower($subjectCode).'.prof@grc.test',
                    'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active,
                ])->id,
                'capacity' => 40,
                'is_block_exclusive' => true,
                'status' => SectionStatus::Published,
            ]);
        }

        return [$plan, $sections];
    }

    private function tokenFor(StudentProfile $student): string
    {
        return (string) $this->postJson('/api/v1/auth/login', [
            'email' => $student->user->email, 'password' => self::PASSWORD,
        ])->json('data.token');
    }

    private function makeStudentWithEmail(Curriculum $curriculum, string $email, string $studentNumber): StudentProfile
    {
        $user = User::create([
            'name' => 'Another Student', 'email' => $email,
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

    private function tokenForNewStaff(UserRole $role, string $email): string
    {
        User::create([
            'name' => $role->value, 'email' => $email,
            'password' => self::PASSWORD, 'role' => $role, 'status' => UserStatus::Active,
        ]);

        return (string) $this->postJson('/api/v1/auth/login', [
            'email' => $email, 'password' => self::PASSWORD,
        ])->json('data.token');
    }

    /**
     * Creates an enrollment directly via Eloquent rather than through the
     * submission endpoint. Chaining `withToken()` for two *different* users
     * within one test method silently reuses the first user's cached guard
     * resolution (a documented Sanctum test gotcha) — so every visibility
     * test below authenticates as exactly one actor and seeds every other
     * student's data directly instead of via a second login+submit.
     */
    private function makeEnrollment(StudentProfile $student, AcademicTerm $term, EnrollmentStatus $status = EnrollmentStatus::PendingRegistrarApproval): Enrollment
    {
        return Enrollment::create([
            'student_id' => $student->id,
            'academic_term_id' => $term->id,
            'status' => $status,
            'total_units' => 3.0,
            'submitted_at' => now(),
        ]);
    }

    public function test_anonymous_request_is_unauthenticated(): void
    {
        $this->getJson('/api/v1/enrollments')->assertUnauthorized();
        $this->postJson('/api/v1/enrollments', [])->assertUnauthorized();
    }

    public function test_a_non_student_role_is_forbidden(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        $section = $this->makeSection($term, $subject);
        User::create([
            'name' => 'Faculty', 'email' => 'faculty.enroll@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active,
        ]);
        $token = (string) $this->postJson('/api/v1/auth/login', [
            'email' => 'faculty.enroll@grc.test', 'password' => self::PASSWORD,
        ])->json('data.token');

        $this->withToken($token)->getJson('/api/v1/enrollments')->assertForbidden();
        $this->withToken($token)->postJson('/api/v1/enrollments', [
            'academic_term_id' => $term->id,
            'sections' => [['section_id' => $section->id]],
        ])->assertForbidden();
    }

    public function test_a_valid_submission_atomically_creates_everything_exactly_once(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101', 3.0);
        $this->placeSubject($curriculum, $subject);
        $section = $this->makeSection($term, $subject);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->postJson('/api/v1/enrollments', [
            'academic_term_id' => $term->id,
            'sections' => [['section_id' => $section->id]],
        ]);

        $response->assertCreated()->assertHeader('Cache-Control', 'no-store, private');
        $response->assertJsonPath('data.status', 'pending_registrar_approval');
        $response->assertJsonPath('data.total_units', 3);
        $response->assertJsonCount(1, 'data.subjects');
        $response->assertJsonPath('data.subjects.0.subject_code', 'CS101');
        // No queue ticket yet — it is issued only once Registrar Staff
        // approves (Phase 6), not at submission.
        $response->assertJsonPath('data.queue_ticket', null);

        $this->assertDatabaseCount('enrollments', 1);
        $this->assertDatabaseCount('enrollment_subjects', 1);
        $this->assertDatabaseCount('queue_tickets', 0);
        self::assertSame(AuditAction::ENROLLMENT_SUBMITTED, AuditLog::query()->sole()->action);
        self::assertSame(
            NotificationType::EnrollmentSubmitted,
            Notification::query()->sole()->type,
        );

        $section->refresh();
        self::assertSame(1, $section->enrolled_count);
    }

    public function test_a_block_submission_enrolls_every_subject_in_the_block_atomically(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        [, $sections] = $this->makeBlock($term, $curriculum, 'IT101', ['CS101', 'GE101']);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->postJson('/api/v1/enrollments', [
            'academic_term_id' => $term->id,
            'block_code' => 'IT101',
        ]);

        $response->assertCreated();
        $response->assertJsonCount(2, 'data.subjects');
        $this->assertDatabaseCount('enrollment_subjects', 2);
        self::assertSame(AuditAction::ENROLLMENT_SUBMITTED, AuditLog::query()->sole()->action);
        self::assertSame('IT101', AuditLog::query()->sole()->after_values['block_code'] ?? null);

        foreach ($sections as $section) {
            self::assertSame(1, $section->refresh()->enrolled_count);
        }
    }

    public function test_sections_and_block_code_together_are_rejected(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        [, $sections] = $this->makeBlock($term, $curriculum, 'IT101', ['CS101']);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->postJson('/api/v1/enrollments', [
            'academic_term_id' => $term->id,
            'block_code' => 'IT101',
            'sections' => [['section_id' => $sections[0]->id]],
        ]);

        $response->assertUnprocessable();
        $this->assertDatabaseCount('enrollments', 0);
    }

    /**
     * A block submission deliberately skips the per-subject
     * `rejectIneligibleSections()` check — running the per-subject pool
     * would reject any subject the student already completed, which is a
     * different rule than the one that actually governs a block.
     * `BuildEnrollmentBlockPool` is what's authoritative for a block
     * instead, and it withholds the whole block once any subject in it is
     * already passed: a repeater no longer advances in lockstep with a
     * single block, so they need the Registrar to reclassify them as
     * irregular before they can pick subjects individually.
     */
    public function test_a_previously_completed_subject_blocks_the_whole_block_submission(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        [, $sections] = $this->makeBlock($term, $curriculum, 'IT101', ['CS101', 'GE101']);
        $student = $this->makeStudent($curriculum);
        $faculty = User::create([
            'name' => 'Grade Encoder', 'email' => 'encoder.repeat@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active,
        ]);
        AcademicGrade::create([
            'student_id' => $student->id,
            'subject_id' => $sections[0]->subject_id,
            'academic_term_id' => $term->id,
            'final_grade' => '1.00',
            'status' => GradeStatus::Locked,
            'encoded_by' => $faculty->id,
        ]);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->postJson('/api/v1/enrollments', [
            'academic_term_id' => $term->id,
            'block_code' => 'IT101',
        ]);

        $response->assertUnprocessable();
        $this->assertDatabaseCount('enrollments', 0);
        foreach ($sections as $section) {
            self::assertSame(0, $section->refresh()->enrolled_count);
        }
    }

    public function test_an_unavailable_block_code_is_rejected(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->postJson('/api/v1/enrollments', [
            'academic_term_id' => $term->id,
            'block_code' => 'DOES-NOT-EXIST',
        ]);

        $response->assertUnprocessable();
        $response->assertJsonPath('error.errors.block_code.0', 'This block is not available for your year level and curriculum.');
    }

    public function test_submission_against_a_term_that_is_not_semester_ongoing_is_rejected(): void
    {
        $term = AcademicTerm::create([
            'school_year' => '2026-2027', 'semester' => '1st', 'status' => AcademicTermStatus::Draft,
        ]);
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        $section = $this->makeSection($term, $subject);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->postJson('/api/v1/enrollments', [
            'academic_term_id' => $term->id,
            'sections' => [['section_id' => $section->id]],
        ]);

        $response->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
        self::assertArrayHasKey('academic_term_id', $response->json('error.errors'));
        $this->assertDatabaseCount('enrollments', 0);
    }

    public function test_submission_before_the_students_year_level_window_opens_is_rejected(): void
    {
        $term = $this->makeTerm();
        $term->update([
            'enrollment_opens_at' => now()->subDay(),
            'enrollment_closes_at' => now()->addMonth(),
        ]);
        AcademicTermEnrollmentWindow::create([
            'academic_term_id' => $term->id,
            'audience' => EnrollmentAudience::Year1,
            'opens_at' => now()->addWeek(),
            'closes_at' => now()->addMonth(),
        ]);
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        $section = $this->makeSection($term, $subject);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->postJson('/api/v1/enrollments', [
            'academic_term_id' => $term->id,
            'sections' => [['section_id' => $section->id]],
        ]);

        $response->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
        self::assertArrayHasKey('academic_term_id', $response->json('error.errors'));
        $this->assertDatabaseCount('enrollments', 0);
    }

    public function test_submission_inside_the_students_year_level_window_succeeds(): void
    {
        $term = $this->makeTerm();
        $term->update([
            'enrollment_opens_at' => now()->subDay(),
            'enrollment_closes_at' => now()->addMonth(),
        ]);
        AcademicTermEnrollmentWindow::create([
            'academic_term_id' => $term->id,
            'audience' => EnrollmentAudience::Year1,
            'opens_at' => now()->subDay(),
            'closes_at' => now()->addMonth(),
        ]);
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        $section = $this->makeSection($term, $subject);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->postJson('/api/v1/enrollments', [
            'academic_term_id' => $term->id,
            'sections' => [['section_id' => $section->id]],
        ]);

        $response->assertCreated();
    }

    public function test_a_submission_totals_fractional_units_correctly(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $lecture = $this->makeSubject('CS101', 3.0);
        $leadership = $this->makeSubject('LEAD 1', 1.5);
        $this->placeSubject($curriculum, $lecture);
        $this->placeSubject($curriculum, $leadership);
        $sectionA = $this->makeSection($term, $lecture, ['section_code' => 'A']);
        $sectionB = $this->makeSection($term, $leadership, [
            'section_code' => 'B', 'schedule_days' => 'Th', 'starts_at_time' => '10:00:00', 'ends_at_time' => '11:00:00',
        ]);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->postJson('/api/v1/enrollments', [
            'academic_term_id' => $term->id,
            'sections' => [['section_id' => $sectionA->id], ['section_id' => $sectionB->id]],
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.total_units', 4.5);
        self::assertSame(4.5, Enrollment::query()->sole()->total_units);
    }

    public function test_a_duplicate_active_enrollment_is_rejected(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        $section = $this->makeSection($term, $subject);
        $student = $this->makeStudent($curriculum);
        Enrollment::create([
            'student_id' => $student->id, 'academic_term_id' => $term->id, 'status' => EnrollmentStatus::Draft,
        ]);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->postJson('/api/v1/enrollments', [
            'academic_term_id' => $term->id,
            'sections' => [['section_id' => $section->id]],
        ]);

        $response->assertUnprocessable();
        self::assertArrayHasKey('academic_term_id', $response->json('error.errors'));
        $this->assertDatabaseCount('enrollments', 1);
    }

    public function test_an_ineligible_section_is_rejected(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        // Planned, not published -> not eligible.
        $section = $this->makeSection($term, $subject, ['status' => SectionStatus::Planned]);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->postJson('/api/v1/enrollments', [
            'academic_term_id' => $term->id,
            'sections' => [['section_id' => $section->id]],
        ]);

        $response->assertUnprocessable();
        self::assertArrayHasKey('sections.0.section_id', $response->json('error.errors'));
        $this->assertDatabaseCount('enrollments', 0);
    }

    public function test_two_sections_for_the_same_subject_are_rejected(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        $sectionA = $this->makeSection($term, $subject, ['section_code' => 'A']);
        $sectionB = $this->makeSection($term, $subject, ['section_code' => 'B']);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->postJson('/api/v1/enrollments', [
            'academic_term_id' => $term->id,
            'sections' => [['section_id' => $sectionA->id], ['section_id' => $sectionB->id]],
        ]);

        $response->assertUnprocessable();
        self::assertArrayHasKey('sections.1.section_id', $response->json('error.errors'));
    }

    public function test_conflicting_sections_cannot_be_submitted_together(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subjectA = $this->makeSubject('CS101');
        $subjectB = $this->makeSubject('CS102');
        $this->placeSubject($curriculum, $subjectA);
        $this->placeSubject($curriculum, $subjectB);
        $sectionA = $this->makeSection($term, $subjectA, [
            'schedule_days' => 'MWF', 'starts_at_time' => '08:00:00', 'ends_at_time' => '09:00:00',
        ]);
        $sectionB = $this->makeSection($term, $subjectB, [
            'schedule_days' => 'MWF', 'starts_at_time' => '08:30:00', 'ends_at_time' => '09:30:00',
        ]);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->postJson('/api/v1/enrollments', [
            'academic_term_id' => $term->id,
            'sections' => [['section_id' => $sectionA->id], ['section_id' => $sectionB->id]],
        ]);

        $response->assertUnprocessable();
        $errors = $response->json('error.errors');
        self::assertArrayHasKey('sections.0.section_id', $errors);
        self::assertArrayHasKey('sections.1.section_id', $errors);
        $this->assertDatabaseCount('enrollments', 0);
    }

    public function test_a_duplicate_submission_does_not_double_reserve_seats(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        $section = $this->makeSection($term, $subject);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $first = $this->withToken($token)->postJson('/api/v1/enrollments', [
            'academic_term_id' => $term->id,
            'sections' => [['section_id' => $section->id]],
        ]);
        $first->assertCreated();

        $second = $this->withToken($token)->postJson('/api/v1/enrollments', [
            'academic_term_id' => $term->id,
            'sections' => [['section_id' => $section->id]],
        ]);
        $second->assertStatus(422);

        $section->refresh();
        self::assertSame(1, $section->enrolled_count);
        $this->assertDatabaseCount('enrollments', 1);
    }

    public function test_the_academic_term_id_and_sections_are_required(): void
    {
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->postJson('/api/v1/enrollments', []);

        $response->assertUnprocessable();
        $errors = $response->json('error.errors');
        self::assertArrayHasKey('academic_term_id', $errors);
        self::assertArrayHasKey('sections', $errors);
    }

    public function test_an_overload_is_rejected_only_when_a_unit_cap_is_configured(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101', 3.0);
        $this->placeSubject($curriculum, $subject);
        $section = $this->makeSection($term, $subject);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        config(['enrollment.max_regular_units' => 2]);

        $overLimit = $this->withToken($token)->postJson('/api/v1/enrollments', [
            'academic_term_id' => $term->id,
            'sections' => [['section_id' => $section->id]],
        ]);
        $overLimit->assertUnprocessable();
        self::assertArrayHasKey('sections', $overLimit->json('error.errors'));
        $this->assertDatabaseCount('enrollments', 0);

        config(['enrollment.max_regular_units' => null]);

        $unconfigured = $this->withToken($token)->postJson('/api/v1/enrollments', [
            'academic_term_id' => $term->id,
            'sections' => [['section_id' => $section->id]],
        ]);
        $unconfigured->assertCreated();
    }

    public function test_index_returns_only_the_authenticated_students_own_enrollments(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        $section = $this->makeSection($term, $subject);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $this->withToken($token)->postJson('/api/v1/enrollments', [
            'academic_term_id' => $term->id,
            'sections' => [['section_id' => $section->id]],
        ])->assertCreated();

        $response = $this->withToken($token)->getJson('/api/v1/enrollments');

        $response->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.status', 'pending_registrar_approval');
    }

    public function test_a_second_students_enrollment_is_not_visible_to_the_first_student(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();

        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);
        $this->makeEnrollment($student, $term);

        $otherStudent = $this->makeStudentWithEmail($curriculum, 'other.student@grc.test', '2026-0002');
        $this->makeEnrollment($otherStudent, $term);

        $response = $this->withToken($token)->getJson('/api/v1/enrollments');
        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.student_number', $student->student_number);
    }

    public function test_registrar_head_sees_every_enrollment_with_filters_and_pagination(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();

        $studentA = $this->makeStudent($curriculum);
        $this->makeEnrollment($studentA, $term);

        $studentB = $this->makeStudentWithEmail($curriculum, 'second.student@grc.test', '2026-0003');
        $this->makeEnrollment($studentB, $term);

        $registrarToken = $this->tokenForNewStaff(UserRole::RegistrarHead, 'registrar.enroll@grc.test');

        $all = $this->withToken($registrarToken)->getJson('/api/v1/enrollments');
        $all->assertOk()->assertJsonCount(2, 'data');

        $filtered = $this->withToken($registrarToken)->getJson('/api/v1/enrollments?status=pending_registrar_approval');
        $filtered->assertOk()->assertJsonCount(2, 'data');

        $paged = $this->withToken($registrarToken)->getJson('/api/v1/enrollments?per_page=1&page=1');
        $paged->assertOk()->assertJsonCount(1, 'data');
        $paged->assertJsonPath('meta.total', 2);
        $paged->assertJsonPath('meta.per_page', 1);
    }

    public function test_registrar_staff_sees_every_enrollment_with_filters_and_pagination(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();

        $studentA = $this->makeStudent($curriculum);
        $this->makeEnrollment($studentA, $term);

        $studentB = $this->makeStudentWithEmail($curriculum, 'second.staff@grc.test', '2026-0003');
        $this->makeEnrollment($studentB, $term);

        $staffToken = $this->tokenForNewStaff(UserRole::RegistrarStaff, 'registrar.staff.enroll@grc.test');

        $all = $this->withToken($staffToken)->getJson('/api/v1/enrollments');
        $all->assertOk()->assertJsonCount(2, 'data');

        $filtered = $this->withToken($staffToken)->getJson('/api/v1/enrollments?status=pending_registrar_approval');
        $filtered->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_accounting_staff_sees_only_pending_payment_enrollments_regardless_of_status_filter(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();

        $student = $this->makeStudent($curriculum);
        $this->makeEnrollment($student, $term, EnrollmentStatus::PendingRegistrarApproval);

        $paidStudent = $this->makeStudentWithEmail($curriculum, 'paid.student@grc.test', '2026-0004');
        $this->makeEnrollment($paidStudent, $term, EnrollmentStatus::PendingPayment);

        $accountingToken = $this->tokenForNewStaff(UserRole::AccountingStaff, 'accounting.enroll@grc.test');

        $response = $this->withToken($accountingToken)->getJson('/api/v1/enrollments');
        $response->assertOk()->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.student_number', $paidStudent->student_number);

        $stillFiltered = $this->withToken($accountingToken)
            ->getJson('/api/v1/enrollments?status=pending_registrar_approval');
        $stillFiltered->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_registrar_approve_transitions_a_pending_approval_enrollment_to_pending_payment(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term, EnrollmentStatus::PendingRegistrarApproval);
        $staffToken = $this->tokenForNewStaff(UserRole::RegistrarStaff, 'registrar.staff.approve@grc.test');

        $response = $this->withToken($staffToken)
            ->patchJson("/api/v1/enrollments/{$enrollment->id}", ['action' => 'registrar_approve']);

        $response->assertOk()->assertJsonPath('data.status', 'pending_payment');
        self::assertNotNull($enrollment->refresh()->registrar_decided_at);
        self::assertSame(
            AuditAction::ENROLLMENT_REGISTRAR_APPROVED,
            AuditLog::query()->sole()->action,
        );
        self::assertSame(
            NotificationType::EnrollmentRegistrarApproved,
            Notification::query()->sole()->type,
        );

        // The Cashier queue ticket is issued exactly at this checkpoint —
        // not at submission (Phase 6).
        $response->assertJsonPath('data.queue_ticket.status', 'waiting');
        $this->assertDatabaseCount('queue_tickets', 1);
    }

    public function test_a_registrar_head_role_cannot_perform_registrar_approve(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term, EnrollmentStatus::PendingRegistrarApproval);
        $registrarToken = $this->tokenForNewStaff(UserRole::RegistrarHead, 'registrar.head.approve@grc.test');

        $response = $this->withToken($registrarToken)
            ->patchJson("/api/v1/enrollments/{$enrollment->id}", ['action' => 'registrar_approve']);

        $response->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
        self::assertSame('pending_registrar_approval', $enrollment->refresh()->status->value);
        $this->assertDatabaseCount('queue_tickets', 0);
    }

    public function test_registrar_reject_requires_a_reason_and_transitions_to_rejected(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term, EnrollmentStatus::PendingRegistrarApproval);
        $registrarToken = $this->tokenForNewStaff(UserRole::RegistrarStaff, 'registrar.staff.reject@grc.test');

        $withoutReason = $this->withToken($registrarToken)
            ->patchJson("/api/v1/enrollments/{$enrollment->id}", ['action' => 'registrar_reject']);
        $withoutReason->assertUnprocessable();
        self::assertArrayHasKey('reason', $withoutReason->json('error.errors'));

        $withReason = $this->withToken($registrarToken)->patchJson("/api/v1/enrollments/{$enrollment->id}", [
            'action' => 'registrar_reject',
            'reason' => 'Missing prerequisite documentation.',
        ]);
        $withReason->assertOk()->assertJsonPath('data.status', 'rejected');
        self::assertSame(
            'Missing prerequisite documentation.',
            AuditLog::query()->sole()->reason,
        );
    }

    public function test_void_transitions_a_pending_payment_enrollment_to_cancelled_and_requires_a_reason(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term, EnrollmentStatus::PendingPayment);
        $registrarToken = $this->tokenForNewStaff(UserRole::RegistrarHead, 'registrar.void@grc.test');

        $withoutReason = $this->withToken($registrarToken)
            ->patchJson("/api/v1/enrollments/{$enrollment->id}", ['action' => 'void']);
        $withoutReason->assertUnprocessable();

        $response = $this->withToken($registrarToken)->patchJson("/api/v1/enrollments/{$enrollment->id}", [
            'action' => 'void',
            'reason' => 'Duplicate submission created in error.',
        ]);
        $response->assertOk()->assertJsonPath('data.status', 'cancelled');
        self::assertSame(AuditAction::ENROLLMENT_VOIDED, AuditLog::query()->sole()->action);
    }

    public function test_void_cannot_be_performed_from_pending_registrar_approval(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term, EnrollmentStatus::PendingRegistrarApproval);
        $registrarToken = $this->tokenForNewStaff(UserRole::RegistrarHead, 'registrar.voidwrongstate@grc.test');

        $response = $this->withToken($registrarToken)->patchJson("/api/v1/enrollments/{$enrollment->id}", [
            'action' => 'void',
            'reason' => 'Attempted too early.',
        ]);

        $response->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
        self::assertSame('pending_registrar_approval', $enrollment->refresh()->status->value);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_a_non_registrar_staff_role_cannot_perform_registrar_approve(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term, EnrollmentStatus::PendingRegistrarApproval);
        $studentToken = $this->tokenFor($student);

        $response = $this->withToken($studentToken)
            ->patchJson("/api/v1/enrollments/{$enrollment->id}", ['action' => 'registrar_approve']);

        $response->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
        self::assertSame('pending_registrar_approval', $enrollment->refresh()->status->value);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_an_accounting_staff_role_cannot_void_an_enrollment(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $enrollment = $this->makeEnrollment($student, $term, EnrollmentStatus::PendingPayment);
        $accountingToken = $this->tokenForNewStaff(UserRole::AccountingStaff, 'accounting.void@grc.test');

        $response = $this->withToken($accountingToken)->patchJson("/api/v1/enrollments/{$enrollment->id}", [
            'action' => 'void',
            'reason' => 'Not accounting\'s call.',
        ]);

        $response->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
        self::assertSame('pending_payment', $enrollment->refresh()->status->value);
    }
}
