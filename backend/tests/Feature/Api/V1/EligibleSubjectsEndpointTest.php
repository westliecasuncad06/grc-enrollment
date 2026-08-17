<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Academic\GradeStatus;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Enrollment\EnrollmentAudience;
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
use App\Models\AcademicTermEnrollmentWindow;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\CurriculumMigration;
use App\Models\CurriculumMigrationCredit;
use App\Models\CurriculumSubjectEquivalency;
use App\Models\Enrollment;
use App\Models\EnrollmentSubject;
use App\Models\Program;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\StudentSchedulePreference;
use App\Models\Subject;
use App\Models\SubjectPrerequisite;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class EligibleSubjectsEndpointTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    private function makeTerm(): AcademicTerm
    {
        return AcademicTerm::create([
            'school_year' => '2026-2027', 'semester' => '1st', 'status' => AcademicTermStatus::SemesterOngoing,
        ]);
    }

    private function makeSubject(string $code, float $units = 3.0, ?string $college = null): Subject
    {
        return Subject::create(['code' => $code, 'college' => $college, 'title' => $code.' Title', 'units' => $units, 'status' => SubjectStatus::Active]);
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
            ['type', 'subject_id', 'code', 'title', 'units', 'year_level', 'semester', 'is_required', 'is_eligible', 'reasons', 'preference_score', 'preference_reasons', 'available_sections'],
            array_keys($response->json('data.0')),
        );
    }

    public function test_a_student_without_a_saved_preference_still_receives_every_entry_with_a_null_score(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        $this->makeSection($term, $subject);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.preference_score', null);
        $response->assertJsonPath('data.0.preference_reasons', []);
    }

    public function test_a_saved_preference_scores_matching_sections_higher(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        $this->makeSection($term, $subject, [
            'schedule_days' => 'MWF', 'starts_at_time' => '09:00:00', 'ends_at_time' => '10:00:00',
        ]);
        $student = $this->makeStudent($curriculum);
        StudentSchedulePreference::create([
            'student_id' => $student->id,
            'preferred_days' => [1, 3, 5],
            'preferred_time_block' => 'morning',
            'max_days_on_campus' => 3,
            'avoid_early_first_class' => true,
        ]);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonCount(1, 'data');
        self::assertGreaterThan(0, $response->json('data.0.preference_score'));
        self::assertContains('No class before 8:00 AM', $response->json('data.0.preference_reasons'));
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

    public function test_a_subject_credited_during_a_curriculum_migration_is_excluded_as_completed(): void
    {
        $term = $this->makeTerm();
        $target = $this->makeCurriculum();
        $source = Curriculum::create([
            'program_id' => $target->program_id, 'name' => 'BSCS Old Curriculum',
            'effective_school_year' => '2021-2022', 'status' => CurriculumStatus::Archived,
        ]);
        $oldSubject = $this->makeSubject('CS-OLD');
        $targetSubject = $this->makeSubject('CS-NEW');
        $this->placeSubject($source, $oldSubject);
        $this->placeSubject($target, $targetSubject);
        $this->makeSection($term, $targetSubject);
        $student = $this->makeStudent($target);
        $oldGrade = AcademicGrade::create([
            'student_id' => $student->id, 'subject_id' => $oldSubject->id,
            'academic_term_id' => $term->id, 'final_grade' => '1.75',
            'status' => GradeStatus::Locked, 'encoded_by' => $student->user_id,
        ]);
        $equivalency = CurriculumSubjectEquivalency::create([
            'source_curriculum_id' => $source->id, 'target_curriculum_id' => $target->id,
            'source_subject_id' => $oldSubject->id, 'target_subject_id' => $targetSubject->id,
        ]);
        $migration = CurriculumMigration::create([
            'student_id' => $student->id, 'source_curriculum_id' => $source->id,
            'target_curriculum_id' => $target->id, 'processed_by' => $student->user_id,
            'migrated_at' => now(),
        ]);
        CurriculumMigrationCredit::create([
            'curriculum_migration_id' => $migration->id,
            'curriculum_subject_equivalency_id' => $equivalency->id,
            'source_academic_grade_id' => $oldGrade->id,
            'target_subject_id' => $targetSubject->id,
        ]);

        $response = $this->withToken($this->tokenFor($student))
            ->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertOk()
            ->assertJsonPath('data.0.is_eligible', false)
            ->assertJsonPath('data.0.reasons.0.code', 'completed');
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

    public function test_a_complete_mark_satisfies_a_leadership_prerequisite(): void
    {
        // LEAD1 -> LEAD2, the exact real-catalog chain this short-circuit
        // exists for: LEAD1 is only ever graded C/NC, never numeric, so
        // PrerequisiteEvaluator alone (which treats every non-numeric value
        // as a special mark) would permanently block LEAD2.
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $lead1 = $this->makeSubject('LEAD 1', 1.5);
        $lead2 = $this->makeSubject('LEAD2', 1.5);
        $this->placeSubject($curriculum, $lead1);
        $placement = $this->placeSubject($curriculum, $lead2, 2);
        SubjectPrerequisite::create([
            'curriculum_subject_id' => $placement->id, 'prerequisite_subject_id' => $lead1->id, 'minimum_grade' => '3.00',
        ]);
        $this->makeSection($term, $lead2);
        $student = $this->makeStudent($curriculum);
        AcademicGrade::create([
            'student_id' => $student->id, 'subject_id' => $lead1->id, 'academic_term_id' => $term->id,
            'mark' => 'C', 'status' => GradeStatus::Locked, 'encoded_by' => $student->user_id,
        ]);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $lead2Entry = collect($response->json('data'))->firstWhere('code', 'LEAD2');
        self::assertTrue($lead2Entry['is_eligible']);
    }

    public function test_a_not_complete_mark_on_a_leadership_prerequisite_excludes_the_subject(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $lead1 = $this->makeSubject('LEAD 1', 1.5);
        $lead2 = $this->makeSubject('LEAD2', 1.5);
        $this->placeSubject($curriculum, $lead1);
        $placement = $this->placeSubject($curriculum, $lead2, 2);
        SubjectPrerequisite::create([
            'curriculum_subject_id' => $placement->id, 'prerequisite_subject_id' => $lead1->id, 'minimum_grade' => '3.00',
        ]);
        $this->makeSection($term, $lead2);
        $student = $this->makeStudent($curriculum);
        AcademicGrade::create([
            'student_id' => $student->id, 'subject_id' => $lead1->id, 'academic_term_id' => $term->id,
            'mark' => 'NC', 'status' => GradeStatus::Locked, 'encoded_by' => $student->user_id,
        ]);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $lead2Entry = collect($response->json('data'))->firstWhere('code', 'LEAD2');
        self::assertFalse($lead2Entry['is_eligible']);
        self::assertSame('prerequisite', $lead2Entry['reasons'][0]['code']);
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

    public function test_a_block_exclusive_section_is_withheld_from_an_irregular_student_before_their_window_opens(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        $this->makeSection($term, $subject, ['is_block_exclusive' => true]);
        $student = $this->makeStudent($curriculum);
        $student->forceFill(['enrollment_category' => 'irregular'])->save();
        // Block seats stay reserved for regular block students until the
        // irregular window starts.
        AcademicTermEnrollmentWindow::create([
            'academic_term_id' => $term->id,
            'audience' => EnrollmentAudience::Irregular,
            'opens_at' => CarbonImmutable::now()->addWeek(),
            'closes_at' => CarbonImmutable::now()->addWeeks(2),
        ]);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_eligible', false);
        $response->assertJsonPath('data.0.reasons.0.code', 'block_restricted');
    }

    public function test_a_block_exclusive_section_opens_to_an_irregular_student_during_their_window(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        $this->makeSection($term, $subject, ['is_block_exclusive' => true]);
        $student = $this->makeStudent($curriculum);
        $student->forceFill(['enrollment_category' => 'irregular'])->save();
        // Once the irregular window is open they may take any section that
        // still has seats — otherwise irregular students, who are excluded
        // from every block, would have nothing to enrol in at all.
        AcademicTermEnrollmentWindow::create([
            'academic_term_id' => $term->id,
            'audience' => EnrollmentAudience::Irregular,
            'opens_at' => CarbonImmutable::now()->subDay(),
            'closes_at' => CarbonImmutable::now()->addWeek(),
        ]);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_eligible', true);
    }

    public function test_a_regular_student_cannot_reach_another_year_levels_block(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        // `IT301` is a 3rd-year block; the student below is 1st year.
        $this->makeSection($term, $subject, ['is_block_exclusive' => true, 'section_code' => 'IT301']);
        $token = $this->tokenFor($this->makeStudent($curriculum));

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_eligible', false);
        $response->assertJsonPath('data.0.reasons.0.code', 'block_other_year');
    }

    public function test_a_regular_student_reaches_their_own_year_levels_block(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject);
        $this->makeSection($term, $subject, ['is_block_exclusive' => true, 'section_code' => 'IT101']);
        $token = $this->tokenFor($this->makeStudent($curriculum));

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_eligible', true);
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

    public function test_a_shared_subject_pulls_in_another_colleges_open_section(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $ownSubject = $this->makeSubject('RIZAL', 3.0, 'ccs');
        $this->placeSubject($curriculum, $ownSubject);
        // The student's own college has no open section for RIZAL, but
        // another college's identical (same code + units) RIZAL row does.
        $otherSubject = $this->makeSubject('RIZAL', 3.0, 'coe');
        $otherSection = $this->makeSection($term, $otherSubject);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_eligible', true);
        $response->assertJsonCount(1, 'data.0.available_sections');
        $response->assertJsonPath('data.0.available_sections.0.id', $otherSection->id);
        $response->assertJsonPath('data.0.available_sections.0.is_own_department', false);
        $response->assertJsonPath('data.0.available_sections.0.college', 'coe');
    }

    public function test_a_subject_with_a_different_code_in_another_college_is_not_pulled_in(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $ownSubject = $this->makeSubject('CS101', 3.0, 'ccs');
        $this->placeSubject($curriculum, $ownSubject);
        // A different code entirely -- never a sibling, no matter the units.
        $unrelatedSubject = $this->makeSubject('CS999', 3.0, 'coe');
        $this->makeSection($term, $unrelatedSubject);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_eligible', false);
        $response->assertJsonPath('data.0.reasons.0.code', 'no_sections_available');
    }

    public function test_a_same_code_subject_with_different_units_is_not_treated_as_the_same_subject(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $ownSubject = $this->makeSubject('RIZAL', 3.0, 'ccs');
        $this->placeSubject($curriculum, $ownSubject);
        // Same code, but a different unit count -- a coincidence, not the
        // same course, so it must not be pulled in.
        $mismatchedSubject = $this->makeSubject('RIZAL', 5.0, 'coe');
        $this->makeSection($term, $mismatchedSubject);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_eligible', false);
        $response->assertJsonPath('data.0.reasons.0.code', 'no_sections_available');
    }

    public function test_already_selected_via_a_sibling_departments_section_excludes_the_subject(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $ownSubject = $this->makeSubject('RIZAL', 3.0, 'ccs');
        $this->placeSubject($curriculum, $ownSubject);
        $otherSubject = $this->makeSubject('RIZAL', 3.0, 'coe');
        $otherSection = $this->makeSection($term, $otherSubject);
        $student = $this->makeStudent($curriculum);

        $enrollment = Enrollment::create([
            'student_id' => $student->id, 'academic_term_id' => $term->id, 'status' => EnrollmentStatus::Draft,
        ]);
        EnrollmentSubject::create([
            'enrollment_id' => $enrollment->id, 'section_id' => $otherSection->id, 'status' => EnrollmentSubjectStatus::Selected,
        ]);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_eligible', false);
        $response->assertJsonPath('data.0.reasons.0.code', 'already_selected');
    }

    public function test_a_subject_completed_via_a_sibling_departments_section_is_excluded_as_completed(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $ownSubject = $this->makeSubject('RIZAL', 3.0, 'ccs');
        $this->placeSubject($curriculum, $ownSubject);
        // The student sat the course in another college's identical RIZAL
        // section last term, so the locked grade is filed against THAT
        // subject row -- it must still count as completing their own.
        $otherSubject = $this->makeSubject('RIZAL', 3.0, 'coe');
        $this->makeSection($term, $otherSubject);
        $student = $this->makeStudent($curriculum);
        AcademicGrade::create([
            'student_id' => $student->id, 'subject_id' => $otherSubject->id, 'academic_term_id' => $term->id,
            'final_grade' => '1.75', 'status' => GradeStatus::Locked, 'encoded_by' => $student->user_id,
        ]);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_eligible', false);
        $response->assertJsonPath('data.0.reasons.0.code', 'completed');
    }

    public function test_a_prerequisite_satisfied_via_a_sibling_departments_sections_grade_satisfies_the_edge(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $intro = $this->makeSubject('RIZAL', 3.0, 'ccs');
        $advanced = $this->makeSubject('CS201');
        $this->placeSubject($curriculum, $intro);
        $placement = $this->placeSubject($curriculum, $advanced, 2);
        SubjectPrerequisite::create([
            'curriculum_subject_id' => $placement->id, 'prerequisite_subject_id' => $intro->id, 'minimum_grade' => '3.00',
        ]);
        $this->makeSection($term, $advanced);
        $student = $this->makeStudent($curriculum);
        // The satisfying grade is filed against another college's identical
        // RIZAL row, not the curriculum's own prerequisite subject.
        $siblingIntro = $this->makeSubject('RIZAL', 3.0, 'coe');
        AcademicGrade::create([
            'student_id' => $student->id, 'subject_id' => $siblingIntro->id, 'academic_term_id' => $term->id,
            'final_grade' => '2.00', 'status' => GradeStatus::Locked, 'encoded_by' => $student->user_id,
        ]);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $advancedEntry = collect($response->json('data'))->firstWhere('code', 'CS201');
        self::assertTrue($advancedEntry['is_eligible']);
        self::assertSame(
            [],
            array_values(array_filter(
                $advancedEntry['reasons'],
                static fn (array $reason): bool => in_array($reason['code'], ['prerequisite', 'prerequisite_advisory'], true),
            )),
        );
    }

    public function test_a_cross_department_section_carries_its_own_subject_code_and_title(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $ownSubject = $this->makeSubject('RIZAL', 3.0, 'ccs');
        $this->placeSubject($curriculum, $ownSubject);
        $otherSubject = $this->makeSubject('RIZAL', 3.0, 'coe');
        $this->makeSection($term, $otherSubject);
        $token = $this->tokenFor($this->makeStudent($curriculum));

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.available_sections.0.subject_code', 'RIZAL');
        $response->assertJsonPath('data.0.available_sections.0.subject_title', $otherSubject->title);
    }
}
