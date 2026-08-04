<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\ProgramStatus;
use App\Domain\Scheduling\SectionStatus;
use App\Models\AcademicTerm;
use App\Models\AcademicTermSectionPlan;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Program;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Covers `GET /enrollment-blocks` — the blocks a regular student may enrol
 * into as a unit. See `App\Actions\Enrollment\BuildEnrollmentBlockPool`.
 */
final class EnrollmentBlocksEndpointTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    private function makeTerm(AcademicTermStatus $status = AcademicTermStatus::SemesterOngoing): AcademicTerm
    {
        return AcademicTerm::create([
            'school_year' => '2026-2027', 'semester' => '1st', 'status' => $status,
            'enrollment_opens_at' => now()->subDay(), 'enrollment_closes_at' => now()->addWeek(),
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

    private function makeStudent(Curriculum $curriculum, int $yearLevel = 1, ?string $enrollmentCategory = null, string $email = 'student.block@grc.test'): StudentProfile
    {
        $user = User::create([
            'name' => 'Test Student', 'email' => $email,
            'password' => self::PASSWORD, 'role' => UserRole::Student, 'status' => UserStatus::Active,
        ]);

        return StudentProfile::create([
            'user_id' => $user->id,
            'student_number' => 'STU-'.$user->id,
            'program_id' => $curriculum->program_id,
            'curriculum_id' => $curriculum->id,
            'year_level' => $yearLevel,
            'enrollment_category' => $enrollmentCategory,
            'admission_status' => AdmissionStatus::Admitted,
            'academic_standing' => AcademicStanding::Good,
        ]);
    }

    private function makePlan(AcademicTerm $term, Curriculum $curriculum, int $yearLevel = 1): AcademicTermSectionPlan
    {
        return AcademicTermSectionPlan::create([
            'academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id,
            'college' => 'ccs', 'year_level' => $yearLevel, 'section_count' => 1,
            'students_per_block' => 40, 'status' => 'submitted',
        ]);
    }

    /**
     * @return array{0: Subject, 1: Section}
     */
    private function makeBlockSection(AcademicTerm $term, AcademicTermSectionPlan $plan, string $blockCode, string $subjectCode, array $overrides = []): array
    {
        $subject = Subject::create(['code' => $subjectCode, 'title' => $subjectCode.' Title', 'units' => 3, 'status' => SubjectStatus::Active]);
        CurriculumSubject::create([
            'curriculum_id' => $plan->curriculum_id, 'subject_id' => $subject->id,
            'year_level' => $plan->year_level, 'semester' => '1st', 'is_required' => true,
        ]);
        $faculty = User::create([
            'name' => 'Prof '.$subjectCode, 'email' => strtolower($subjectCode).'.prof@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active,
        ]);

        $section = Section::create(array_merge([
            'academic_term_id' => $term->id,
            'section_plan_id' => $plan->id,
            'subject_id' => $subject->id,
            'section_code' => $blockCode,
            'professor_id' => $faculty->id,
            'schedule_days' => 'MWF',
            'starts_at_time' => '08:00:00',
            'ends_at_time' => '09:00:00',
            'room' => 'LAB-1',
            'capacity' => 40,
            'is_block_exclusive' => true,
            'status' => SectionStatus::Published,
        ], $overrides));

        return [$subject, $section];
    }

    private function tokenFor(StudentProfile $student): string
    {
        return (string) $this->postJson('/api/v1/auth/login', [
            'email' => $student->user->email, 'password' => self::PASSWORD,
        ])->json('data.token');
    }

    public function test_a_regular_student_sees_their_own_year_blocks_with_every_subject(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum);
        $this->makeBlockSection($term, $plan, 'IT101', 'CS101');
        $this->makeBlockSection($term, $plan, 'IT101', 'GE101');
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/enrollment-blocks?academic_term_id='.$term->id);

        $response->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.block_code', 'IT101');
        $response->assertJsonPath('data.0.is_selectable', true);
        $response->assertJsonPath('data.0.seats_remaining', 40);
        self::assertSame(6.0, (float) $response->json('data.0.total_units'));
        self::assertCount(2, $response->json('data.0.subjects'));
    }

    public function test_seats_remaining_is_the_minimum_across_every_section_in_the_block(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum);
        $this->makeBlockSection($term, $plan, 'IT101', 'CS101', ['capacity' => 1, 'enrolled_count' => 1]);
        $this->makeBlockSection($term, $plan, 'IT101', 'GE101', ['capacity' => 40]);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/enrollment-blocks?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.seats_remaining', 0);
        $response->assertJsonPath('data.0.is_selectable', false);
        $response->assertJsonPath('data.0.reasons.0.code', 'block_full');
    }

    public function test_an_irregular_student_receives_an_empty_pool(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum);
        $this->makeBlockSection($term, $plan, 'IT101', 'CS101');
        $student = $this->makeStudent($curriculum, enrollmentCategory: 'irregular');
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/enrollment-blocks?academic_term_id='.$term->id);

        $response->assertOk();
        $response->assertJsonCount(0, 'data');
    }

    public function test_a_block_from_another_year_level_is_not_returned(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $secondYearPlan = $this->makePlan($term, $curriculum, yearLevel: 2);
        $this->makeBlockSection($term, $secondYearPlan, 'IT201', 'CS201');
        $student = $this->makeStudent($curriculum, yearLevel: 1);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/enrollment-blocks?academic_term_id='.$term->id);

        $response->assertJsonCount(0, 'data');
    }

    public function test_a_closed_window_marks_the_block_unselectable_but_still_visible(): void
    {
        $term = $this->makeTerm(AcademicTermStatus::Draft);
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum);
        $this->makeBlockSection($term, $plan, 'IT101', 'CS101');
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/enrollment-blocks?academic_term_id='.$term->id);

        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.is_selectable', false);
        self::assertContains(
            'window_closed',
            array_column($response->json('data.0.reasons'), 'code'),
        );
    }

    public function test_an_incomplete_schedule_marks_the_block_unselectable(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum);
        $this->makeBlockSection($term, $plan, 'IT101', 'CS101', ['room' => null]);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/enrollment-blocks?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_selectable', false);
        self::assertContains(
            'incomplete_schedule',
            array_column($response->json('data.0.reasons'), 'code'),
        );
    }

    public function test_a_section_without_an_assigned_professor_remains_selectable(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum);
        $this->makeBlockSection($term, $plan, 'IT101', 'CS101', ['professor_id' => null]);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/enrollment-blocks?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_selectable', true);
        $response->assertJsonPath('data.0.subjects.0.professor_name', null);
    }

    public function test_a_non_block_exclusive_section_does_not_appear_as_a_block(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum);
        $this->makeBlockSection($term, $plan, 'A', 'CS101', ['is_block_exclusive' => false]);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/enrollment-blocks?academic_term_id='.$term->id);

        $response->assertJsonCount(0, 'data');
    }

    public function test_anonymous_request_is_unauthenticated(): void
    {
        $this->getJson('/api/v1/enrollment-blocks?academic_term_id=1')->assertUnauthorized();
    }

    public function test_a_non_student_role_is_forbidden(): void
    {
        $term = $this->makeTerm();
        $registrar = User::create([
            'name' => 'Registrar', 'email' => 'registrar.blocks@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::RegistrarHead, 'status' => UserStatus::Active,
        ]);
        $token = (string) $this->postJson('/api/v1/auth/login', [
            'email' => $registrar->email, 'password' => self::PASSWORD,
        ])->json('data.token');

        $this->withToken($token)->getJson('/api/v1/enrollment-blocks?academic_term_id='.$term->id)->assertForbidden();
    }
}
