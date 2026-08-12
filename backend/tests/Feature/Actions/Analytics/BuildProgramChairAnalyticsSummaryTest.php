<?php

namespace Tests\Feature\Actions\Analytics;

use App\Actions\Analytics\BuildProgramChairAnalyticsSummary;
use App\Domain\Academic\GradeStatus;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\CollegeCode;
use App\Domain\Organization\ProgramStatus;
use App\Models\AcademicGrade;
use App\Models\AcademicTerm;
use App\Models\Curriculum;
use App\Models\Enrollment;
use App\Models\Program;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class BuildProgramChairAnalyticsSummaryTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    private static int $counter = 0;

    private function makeProgram(CollegeCode $college, string $code): Program
    {
        return Program::create(['code' => $code, 'name' => $code, 'status' => ProgramStatus::Active, 'college' => $college]);
    }

    private function makeCurriculum(Program $program): Curriculum
    {
        self::$counter++;

        return Curriculum::create([
            'program_id' => $program->id,
            'name' => $program->code.' Curriculum '.self::$counter,
            'effective_school_year' => '2024-2025',
            'status' => CurriculumStatus::Active,
        ]);
    }

    private function makeStudent(Curriculum $curriculum): StudentProfile
    {
        self::$counter++;
        $number = 'STU-'.self::$counter;

        $user = User::create([
            'name' => 'Student '.$number,
            'email' => strtolower($number).'@grc.test',
            'password' => self::PASSWORD,
            'role' => UserRole::Student,
            'status' => UserStatus::Active,
        ]);

        return StudentProfile::create([
            'user_id' => $user->id,
            'student_number' => $number,
            'program_id' => $curriculum->program_id,
            'curriculum_id' => $curriculum->id,
            'year_level' => 1,
            'admission_status' => AdmissionStatus::Admitted,
            'academic_standing' => AcademicStanding::Good,
        ]);
    }

    private function makeEnrollment(StudentProfile $student, AcademicTerm $term, EnrollmentStatus $status): Enrollment
    {
        return Enrollment::create([
            'student_id' => $student->id,
            'academic_term_id' => $term->id,
            'status' => $status,
            'submitted_at' => now(),
        ]);
    }

    private function makeGrade(StudentProfile $student, AcademicTerm $term, Subject $subject, GradeStatus $status): AcademicGrade
    {
        return AcademicGrade::create([
            'student_id' => $student->id,
            'subject_id' => $subject->id,
            'academic_term_id' => $term->id,
            'status' => $status,
            'encoded_by' => $student->user_id,
        ]);
    }

    private function makeSubject(string $code): Subject
    {
        return Subject::create(['code' => $code, 'title' => $code, 'units' => 3, 'status' => SubjectStatus::Active]);
    }

    private function makeChair(CollegeCode $college, string $emailPrefix): User
    {
        return User::create([
            'name' => 'Chair '.$emailPrefix,
            'email' => $emailPrefix.'.chair@grc.test',
            'password' => self::PASSWORD,
            'role' => UserRole::ProgramChair,
            'college' => $college,
            'status' => UserStatus::Active,
        ]);
    }

    private function tokenFor(User $user): string
    {
        return (string) $this->postJson('/api/v1/auth/login', [
            'email' => $user->email, 'password' => self::PASSWORD,
        ])->json('data.token');
    }

    // --- Descriptive: zero-filled, college-scoped, term-scoped ---

    public function test_descriptive_counts_are_zero_filled_and_college_and_term_scoped(): void
    {
        $termA = AcademicTerm::create(['school_year' => '2026-2027', 'semester' => '1st', 'status' => AcademicTermStatus::SemesterOngoing]);
        $termB = AcademicTerm::create(['school_year' => '2025-2026', 'semester' => '2nd', 'status' => AcademicTermStatus::SemesterClosed]);

        $ccsProgram = $this->makeProgram(CollegeCode::Ccs, 'BSCS');
        $ccsCurriculum = $this->makeCurriculum($ccsProgram);
        $coeProgram = $this->makeProgram(CollegeCode::Coe, 'BEED');
        $coeCurriculum = $this->makeCurriculum($coeProgram);

        $ccsEnrolled = $this->makeStudent($ccsCurriculum);
        $ccsPending = $this->makeStudent($ccsCurriculum);
        $ccsOtherTerm = $this->makeStudent($ccsCurriculum);
        $coeStudent = $this->makeStudent($coeCurriculum);

        $this->makeEnrollment($ccsEnrolled, $termA, EnrollmentStatus::Enrolled);
        $this->makeEnrollment($ccsPending, $termA, EnrollmentStatus::PendingPayment);
        $this->makeEnrollment($ccsOtherTerm, $termB, EnrollmentStatus::Enrolled);
        $this->makeEnrollment($coeStudent, $termA, EnrollmentStatus::Enrolled);

        $summary = app(BuildProgramChairAnalyticsSummary::class)->execute($termA, CollegeCode::Ccs);

        self::assertSame($termA->id, $summary->academicTermId);
        self::assertSame('ccs', $summary->college);

        // Zero-filled across every EnrollmentStatus case.
        self::assertSame(
            array_map(fn (EnrollmentStatus $s): string => $s->value, EnrollmentStatus::cases()),
            array_keys($summary->enrollmentStatusCounts),
        );

        self::assertSame(1, $summary->enrollmentStatusCounts['enrolled']);
        self::assertSame(1, $summary->enrollmentStatusCounts['pending_payment']);
        self::assertSame(0, $summary->enrollmentStatusCounts['draft']);
        self::assertSame(0, $summary->enrollmentStatusCounts['withdrawn']);
        self::assertSame(0, $summary->enrollmentStatusCounts['rejected']);
        self::assertSame(0, $summary->enrollmentStatusCounts['cancelled']);
        self::assertSame(0, $summary->enrollmentStatusCounts['pending_registrar_approval']);

        // Total is 2 (CCS/termA only): COE's enrollment and CCS's other-term
        // enrollment must not leak in.
        self::assertSame(2, array_sum($summary->enrollmentStatusCounts));
    }

    // --- Diagnostic: full GradeStatus x EnrollmentStatus matrix, zero-filled ---

    public function test_diagnostic_crosstab_is_zero_filled_across_the_full_matrix_and_college_scoped(): void
    {
        $term = AcademicTerm::create(['school_year' => '2026-2027', 'semester' => '1st', 'status' => AcademicTermStatus::SemesterOngoing]);

        $ccsProgram = $this->makeProgram(CollegeCode::Ccs, 'BSIT');
        $ccsCurriculum = $this->makeCurriculum($ccsProgram);
        $coeProgram = $this->makeProgram(CollegeCode::Coe, 'BSED');
        $coeCurriculum = $this->makeCurriculum($coeProgram);

        $subject = $this->makeSubject('CS101');

        $ccsStudent = $this->makeStudent($ccsCurriculum);
        $coeStudent = $this->makeStudent($coeCurriculum);

        $this->makeEnrollment($ccsStudent, $term, EnrollmentStatus::Enrolled);
        $this->makeGrade($ccsStudent, $term, $subject, GradeStatus::Locked);

        $this->makeEnrollment($coeStudent, $term, EnrollmentStatus::Enrolled);
        $this->makeGrade($coeStudent, $term, $subject, GradeStatus::Locked);

        $summary = app(BuildProgramChairAnalyticsSummary::class)->execute($term, CollegeCode::Ccs);

        // Full matrix: every (GradeStatus, EnrollmentStatus) pair present.
        self::assertCount(count(GradeStatus::cases()) * count(EnrollmentStatus::cases()), $summary->retentionBreakdown);

        $cells = collect($summary->retentionBreakdown)->keyBy(fn ($row) => $row->gradeStatus.'|'.$row->enrollmentStatus);

        foreach (GradeStatus::cases() as $gradeStatus) {
            foreach (EnrollmentStatus::cases() as $enrollmentStatus) {
                $key = $gradeStatus->value.'|'.$enrollmentStatus->value;
                self::assertTrue($cells->has($key), "Missing crosstab cell for {$key}");
            }
        }

        self::assertSame(1, $cells['locked|enrolled']->count);
        self::assertSame(0, $cells['draft|enrolled']->count);
        self::assertSame(0, $cells['submitted|enrolled']->count);
        self::assertSame(0, $cells['locked|pending_payment']->count);

        // gradeStatusCounts is zero-filled across every GradeStatus and
        // derived from the same crosstab (COE's grade must not leak in).
        self::assertSame(
            array_map(fn (GradeStatus $s): string => $s->value, GradeStatus::cases()),
            array_keys($summary->gradeStatusCounts),
        );
        self::assertSame(1, $summary->gradeStatusCounts['locked']);
        self::assertSame(0, $summary->gradeStatusCounts['draft']);
        self::assertSame(0, $summary->gradeStatusCounts['submitted']);
    }

    // --- Year-over-year: not term-filtered, college-scoped, chronological ---

    public function test_year_over_year_is_not_term_filtered_but_is_college_scoped_and_chronological(): void
    {
        $termOldest = AcademicTerm::create(['school_year' => '2024-2025', 'semester' => '1st', 'status' => AcademicTermStatus::SemesterClosed]);
        $termMiddle = AcademicTerm::create(['school_year' => '2024-2025', 'semester' => '2nd', 'status' => AcademicTermStatus::SemesterClosed]);
        $termCurrent = AcademicTerm::create(['school_year' => '2026-2027', 'semester' => '1st', 'status' => AcademicTermStatus::SemesterOngoing]);

        $ccsProgram = $this->makeProgram(CollegeCode::Ccs, 'BSCS');
        $ccsCurriculum = $this->makeCurriculum($ccsProgram);
        $coeProgram = $this->makeProgram(CollegeCode::Coe, 'BEED');
        $coeCurriculum = $this->makeCurriculum($coeProgram);

        $this->makeEnrollment($this->makeStudent($ccsCurriculum), $termOldest, EnrollmentStatus::Enrolled);
        $this->makeEnrollment($this->makeStudent($ccsCurriculum), $termMiddle, EnrollmentStatus::Enrolled);
        $this->makeEnrollment($this->makeStudent($ccsCurriculum), $termMiddle, EnrollmentStatus::Enrolled);
        $this->makeEnrollment($this->makeStudent($ccsCurriculum), $termCurrent, EnrollmentStatus::Draft);
        // COE enrollment must not leak into CCS's year-over-year series.
        $this->makeEnrollment($this->makeStudent($coeCurriculum), $termMiddle, EnrollmentStatus::Enrolled);

        $summary = app(BuildProgramChairAnalyticsSummary::class)->execute($termCurrent, CollegeCode::Ccs);

        self::assertCount(3, $summary->yearOverYear);

        self::assertSame('2024-2025', $summary->yearOverYear[0]->schoolYear);
        self::assertSame('1st', $summary->yearOverYear[0]->semester);
        self::assertSame(1, $summary->yearOverYear[0]->enrolleeCount);

        self::assertSame('2024-2025', $summary->yearOverYear[1]->schoolYear);
        self::assertSame('2nd', $summary->yearOverYear[1]->semester);
        self::assertSame(2, $summary->yearOverYear[1]->enrolleeCount);

        self::assertSame('2026-2027', $summary->yearOverYear[2]->schoolYear);
        self::assertSame('1st', $summary->yearOverYear[2]->semester);
        self::assertSame(1, $summary->yearOverYear[2]->enrolleeCount);
    }

    // --- Route + policy: only program_chair, 403 with no college ---

    public function test_anonymous_request_is_unauthenticated(): void
    {
        $this->getJson('/api/v1/dashboards/program-chair-analytics-summary')->assertUnauthorized();
    }

    public function test_a_non_program_chair_role_is_forbidden_from_the_route(): void
    {
        AcademicTerm::create(['school_year' => '2026-2027', 'semester' => '1st', 'status' => AcademicTermStatus::SemesterOngoing]);

        $dean = User::create([
            'name' => 'Dean', 'email' => 'dean.analytics@grc.test', 'password' => self::PASSWORD,
            'role' => UserRole::Dean, 'status' => UserStatus::Active,
        ]);
        $this->withToken($this->tokenFor($dean))
            ->getJson('/api/v1/dashboards/program-chair-analytics-summary')
            ->assertForbidden();
    }

    public function test_a_program_chair_with_a_college_may_hit_the_route(): void
    {
        AcademicTerm::create(['school_year' => '2026-2027', 'semester' => '1st', 'status' => AcademicTermStatus::SemesterOngoing]);

        $chair = $this->makeChair(CollegeCode::Ccs, 'route-ok');
        $this->withToken($this->tokenFor($chair))
            ->getJson('/api/v1/dashboards/program-chair-analytics-summary')
            ->assertOk();
    }

    public function test_a_program_chair_with_no_college_gets_forbidden(): void
    {
        AcademicTerm::create(['school_year' => '2026-2027', 'semester' => '1st', 'status' => AcademicTermStatus::SemesterOngoing]);

        $chair = User::create([
            'name' => 'No College Chair', 'email' => 'no-college.chair@grc.test', 'password' => self::PASSWORD,
            'role' => UserRole::ProgramChair, 'college' => null, 'status' => UserStatus::Active,
        ]);

        $this->withToken($this->tokenFor($chair))
            ->getJson('/api/v1/dashboards/program-chair-analytics-summary')
            ->assertForbidden();
    }

    public function test_route_returns_the_expected_resource_shape(): void
    {
        $term = AcademicTerm::create(['school_year' => '2026-2027', 'semester' => '1st', 'status' => AcademicTermStatus::SemesterOngoing]);
        $program = $this->makeProgram(CollegeCode::Ccs, 'BSCS');
        $curriculum = $this->makeCurriculum($program);
        $student = $this->makeStudent($curriculum);
        $this->makeEnrollment($student, $term, EnrollmentStatus::Enrolled);
        $subject = $this->makeSubject('CS101');
        $this->makeGrade($student, $term, $subject, GradeStatus::Locked);

        $chair = $this->makeChair(CollegeCode::Ccs, 'shape-ok');
        $response = $this->withToken($this->tokenFor($chair))
            ->getJson('/api/v1/dashboards/program-chair-analytics-summary');

        $response->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $response->assertJsonPath('data.type', 'program_chair_analytics_summary');
        $response->assertJsonPath('data.academic_term_id', $term->id);
        $response->assertJsonPath('data.college', 'ccs');
        $response->assertJsonPath('data.enrollment_status_counts.enrolled', 1);
        $response->assertJsonPath('data.grade_status_counts.locked', 1);
        self::assertCount(
            count(GradeStatus::cases()) * count(EnrollmentStatus::cases()),
            $response->json('data.retention_breakdown'),
        );
        self::assertSame(
            ['grade_status', 'enrollment_status', 'count'],
            array_keys($response->json('data.retention_breakdown.0')),
        );
        self::assertSame(
            ['school_year', 'semester', 'enrollee_count'],
            array_keys($response->json('data.year_over_year.0')),
        );

        $raw = (string) $response->getContent();
        self::assertStringNotContainsString('email', strtolower($raw));
        self::assertStringNotContainsString('"name"', strtolower($raw));
        self::assertStringNotContainsString('student_number', strtolower($raw));
    }
}
