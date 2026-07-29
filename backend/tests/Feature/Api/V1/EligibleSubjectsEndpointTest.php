<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Academic\GradeStatus;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Enrollment\EnrollmentSubjectStatus;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\ProgramStatus;
use App\Domain\Scheduling\SectionStatus;
use App\Models\AcademicGrade;
use App\Models\AcademicTerm;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Enrollment;
use App\Models\EnrollmentSubject;
use App\Models\Program;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\SubjectPrerequisite;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class EligibleSubjectsEndpointTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    private function makeTerm(): AcademicTerm
    {
        return AcademicTerm::create([
            'school_year' => '2026-2027', 'semester' => '1st', 'status' => AcademicTermStatus::Active,
        ]);
    }

    private function makeSubject(string $code, float $units = 3.0): Subject
    {
        return Subject::create(['code' => $code, 'title' => $code.' Title', 'units' => $units, 'status' => SubjectStatus::Active]);
    }

    private function makeStudent(Curriculum $curriculum): StudentProfile
    {
        $user = User::create([
            'name' => 'Test Student', 'email' => 'student.eligible@grc.test',
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

    private function makeCurriculum(): Curriculum
    {
        $program = Program::create(['code' => 'BSCS', 'name' => 'BS Computer Science', 'status' => ProgramStatus::Active]);

        return Curriculum::create([
            'program_id' => $program->id, 'name' => 'BSCS Curriculum',
            'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Active,
        ]);
    }

    private function placeSubject(Curriculum $curriculum, Subject $subject, int $yearLevel = 1): CurriculumSubject
    {
        return CurriculumSubject::create([
            'curriculum_id' => $curriculum->id, 'subject_id' => $subject->id,
            'year_level' => $yearLevel, 'semester' => '1st', 'is_required' => true,
        ]);
    }

    private function tokenFor(StudentProfile $student): string
    {
        return (string) $this->postJson('/api/v1/auth/login', [
            'email' => $student->user->email, 'password' => self::PASSWORD,
        ])->json('data.token');
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

    public function test_anonymous_request_is_unauthenticated(): void
    {
        $this->getJson('/api/v1/eligible-subjects?academic_term_id=1')->assertUnauthorized();
    }

    public function test_a_non_student_role_is_forbidden(): void
    {
        $term = $this->makeTerm();
        User::create([
            'name' => 'Faculty', 'email' => 'faculty.eligible@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active,
        ]);
        $token = (string) $this->postJson('/api/v1/auth/login', [
            'email' => 'faculty.eligible@grc.test', 'password' => self::PASSWORD,
        ])->json('data.token');

        $this->withToken($token)
            ->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id)
            ->assertForbidden();
    }

    public function test_academic_term_id_is_required_and_validated(): void
    {
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $this->withToken($token)->getJson('/api/v1/eligible-subjects')->assertStatus(422);
        $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id=999999')->assertStatus(422);
    }

    public function test_a_subject_with_an_open_published_section_is_eligible(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        $section = $this->makeSection($term, $subject);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.code', 'CS101');
        $response->assertJsonPath('data.0.is_eligible', true);
        $response->assertJsonPath('data.0.reasons.0.code', 'eligible');
        $response->assertJsonCount(1, 'data.0.available_sections');
        $response->assertJsonPath('data.0.available_sections.0.id', $section->id);
        self::assertSame(
            ['type', 'subject_id', 'code', 'title', 'units', 'year_level', 'semester', 'is_required', 'is_eligible', 'reasons', 'available_sections'],
            array_keys($response->json('data.0')),
        );
    }

    public function test_a_subject_already_passed_is_excluded_as_completed(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        $this->makeSection($term, $subject);
        $student = $this->makeStudent($curriculum);

        AcademicGrade::create([
            'student_id' => $student->id, 'subject_id' => $subject->id, 'academic_term_id' => $term->id,
            'final_grade' => '1.75', 'status' => GradeStatus::Locked, 'encoded_by' => $student->user_id,
        ]);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_eligible', false);
        $response->assertJsonPath('data.0.reasons.0.code', 'completed');
    }

    public function test_an_unmet_prerequisite_excludes_the_subject(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $intro = $this->makeSubject('CS101');
        $advanced = $this->makeSubject('CS201');
        $this->placeSubject($curriculum, $intro);
        $placement = $this->placeSubject($curriculum, $advanced, 2);
        SubjectPrerequisite::create([
            'curriculum_subject_id' => $placement->id, 'prerequisite_subject_id' => $intro->id, 'minimum_grade' => '3.00',
        ]);
        $this->makeSection($term, $advanced);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $advancedEntry = collect($response->json('data'))->firstWhere('code', 'CS201');
        self::assertFalse($advancedEntry['is_eligible']);
        self::assertSame('prerequisite', $advancedEntry['reasons'][0]['code']);
    }

    public function test_a_satisfied_prerequisite_allows_eligibility(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $intro = $this->makeSubject('CS101');
        $advanced = $this->makeSubject('CS201');
        $this->placeSubject($curriculum, $intro);
        $placement = $this->placeSubject($curriculum, $advanced, 2);
        SubjectPrerequisite::create([
            'curriculum_subject_id' => $placement->id, 'prerequisite_subject_id' => $intro->id, 'minimum_grade' => '3.00',
        ]);
        $this->makeSection($term, $advanced);
        $student = $this->makeStudent($curriculum);
        AcademicGrade::create([
            'student_id' => $student->id, 'subject_id' => $intro->id, 'academic_term_id' => $term->id,
            'final_grade' => '2.00', 'status' => GradeStatus::Locked, 'encoded_by' => $student->user_id,
        ]);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $advancedEntry = collect($response->json('data'))->firstWhere('code', 'CS201');
        self::assertTrue($advancedEntry['is_eligible']);
    }

    public function test_an_unconfigured_grading_policy_flags_an_advisory_instead_of_excluding(): void
    {
        config(['enrollment.grading.comparison' => null]);

        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $intro = $this->makeSubject('CS101');
        $advanced = $this->makeSubject('CS201');
        $this->placeSubject($curriculum, $intro);
        $placement = $this->placeSubject($curriculum, $advanced, 2);
        SubjectPrerequisite::create([
            'curriculum_subject_id' => $placement->id, 'prerequisite_subject_id' => $intro->id, 'minimum_grade' => '3.00',
        ]);
        $this->makeSection($term, $advanced);
        $student = $this->makeStudent($curriculum);
        AcademicGrade::create([
            'student_id' => $student->id, 'subject_id' => $intro->id, 'academic_term_id' => $term->id,
            'final_grade' => '2.00', 'status' => GradeStatus::Locked, 'encoded_by' => $student->user_id,
        ]);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $advancedEntry = collect($response->json('data'))->firstWhere('code', 'CS201');
        self::assertTrue($advancedEntry['is_eligible']);
        self::assertSame('prerequisite_advisory', $advancedEntry['reasons'][0]['code']);
    }

    public function test_a_subject_with_no_offered_section_is_excluded(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_eligible', false);
        $response->assertJsonPath('data.0.reasons.0.code', 'no_sections_available');
    }

    public function test_an_unpublished_section_does_not_count_as_available(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        $this->makeSection($term, $subject, ['status' => SectionStatus::Planned]);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_eligible', false);
        $response->assertJsonPath('data.0.reasons.0.code', 'no_sections_available');
    }

    public function test_a_full_section_does_not_count_as_available(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        $this->makeSection($term, $subject, ['capacity' => 1, 'enrolled_count' => 1]);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_eligible', false);
        $response->assertJsonPath('data.0.reasons.0.code', 'no_sections_available');
    }

    public function test_a_block_exclusive_section_excludes_an_irregular_student(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        $this->makeSection($term, $subject, ['is_block_exclusive' => true]);
        $student = $this->makeStudent($curriculum);
        $student->forceFill(['enrollment_category' => 'irregular'])->save();
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_eligible', false);
        $response->assertJsonPath('data.0.reasons.0.code', 'block_restricted');
    }

    public function test_a_block_exclusive_section_is_available_to_an_unclassified_student(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        $this->makeSection($term, $subject, ['is_block_exclusive' => true]);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_eligible', true);
    }

    public function test_a_subject_already_selected_this_term_is_excluded(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        $section = $this->makeSection($term, $subject);
        $student = $this->makeStudent($curriculum);

        $enrollment = Enrollment::create([
            'student_id' => $student->id, 'academic_term_id' => $term->id, 'status' => EnrollmentStatus::Draft,
        ]);
        EnrollmentSubject::create([
            'enrollment_id' => $enrollment->id, 'section_id' => $section->id, 'status' => EnrollmentSubjectStatus::Selected,
        ]);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_eligible', false);
        $response->assertJsonPath('data.0.reasons.0.code', 'already_selected');
    }
}
