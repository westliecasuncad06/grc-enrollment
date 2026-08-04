<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Academic\GradeStatus;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
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
use App\Models\Program;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Covers `GET /academic-record` — the student Grades screen's read model,
 * every term the student has a grade in, grouped and totalled, latest term
 * first. See `App\Actions\Academic\BuildAcademicRecord`.
 */
final class AcademicRecordEndpointTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    private function makeCurriculum(): Curriculum
    {
        $program = Program::create(['code' => 'BSCS', 'name' => 'BS Computer Science', 'status' => ProgramStatus::Active]);

        return Curriculum::create([
            'program_id' => $program->id, 'name' => 'BSCS Curriculum',
            'effective_school_year' => '2024-2025', 'status' => CurriculumStatus::Active,
        ]);
    }

    private function makeSubject(string $code, float $units = 3.0): Subject
    {
        return Subject::create(['code' => $code, 'title' => $code.' Title', 'units' => $units, 'status' => SubjectStatus::Active]);
    }

    private function makeStudent(Curriculum $curriculum, string $email = 'student.academicrecord@grc.test'): StudentProfile
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
            'year_level' => 2,
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
        $user = User::create([
            'name' => 'Test '.$role->value, 'email' => $email,
            'password' => self::PASSWORD, 'role' => $role, 'status' => UserStatus::Active,
        ]);

        return $this->tokenFor($user);
    }

    private function gradeIn(StudentProfile $student, AcademicTerm $term, Subject $subject, string $mark): void
    {
        $professor = User::firstOrCreate(
            ['email' => 'prof.academicrecord@grc.test'],
            ['name' => 'Prof', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active],
        );
        $section = Section::create([
            'academic_term_id' => $term->id, 'subject_id' => $subject->id, 'section_code' => 'A',
            'professor_id' => $professor->id, 'capacity' => 40, 'status' => SectionStatus::Published,
        ]);

        AcademicGrade::create([
            'student_id' => $student->id, 'subject_id' => $subject->id, 'section_id' => $section->id,
            'academic_term_id' => $term->id, 'mark' => $mark, 'status' => GradeStatus::Locked, 'encoded_by' => $professor->id,
        ]);
    }

    public function test_anonymous_request_is_unauthenticated(): void
    {
        $this->getJson('/api/v1/academic-record')->assertUnauthorized();
    }

    public function test_a_student_sees_their_own_record_grouped_by_term_latest_first(): void
    {
        $olderTerm = AcademicTerm::create([
            'school_year' => '2024-2025', 'semester' => '1st', 'status' => AcademicTermStatus::Archived,
        ]);
        $laterTerm = AcademicTerm::create([
            'school_year' => '2024-2025', 'semester' => '2nd', 'status' => AcademicTermStatus::Archived,
        ]);
        $latestYearTerm = AcademicTerm::create([
            'school_year' => '2025-2026', 'semester' => '1st', 'status' => AcademicTermStatus::SemesterOngoing,
        ]);
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);

        $this->gradeIn($student, $olderTerm, $this->makeSubject('CS101'), '1.75');
        $this->gradeIn($student, $laterTerm, $this->makeSubject('CS102'), '2.00');
        $this->gradeIn($student, $latestYearTerm, $this->makeSubject('CS201'), '1.25');

        $token = $this->tokenFor($student->user);

        $response = $this->withToken($token)->getJson('/api/v1/academic-record');

        $response->assertOk();
        self::assertSame($student->id, $response->json('data.student_id'));
        $terms = $response->json('data.terms');
        self::assertCount(3, $terms);
        // Latest school year first, then latest semester first within a year.
        self::assertSame('2025-2026', $terms[0]['school_year']);
        self::assertSame('1st', $terms[0]['semester']);
        self::assertSame('2024-2025', $terms[1]['school_year']);
        self::assertSame('2nd', $terms[1]['semester']);
        self::assertSame('2024-2025', $terms[2]['school_year']);
        self::assertSame('1st', $terms[2]['semester']);

        self::assertSame('CS201', $terms[0]['rows'][0]['code']);
        self::assertSame('1.25', $terms[0]['gpa']);
    }

    public function test_a_student_with_no_grades_sees_an_empty_terms_list(): void
    {
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student->user);

        $response = $this->withToken($token)->getJson('/api/v1/academic-record');

        $response->assertOk();
        self::assertSame([], $response->json('data.terms'));
    }

    public function test_a_student_cannot_view_another_students_academic_record(): void
    {
        $curriculum = $this->makeCurriculum();
        $owner = $this->makeStudent($curriculum, 'owner.academicrecord@grc.test');
        $other = $this->makeStudent($curriculum, 'other.academicrecord@grc.test');
        $token = $this->tokenFor($other->user);

        $this->withToken($token)
            ->getJson('/api/v1/academic-record?student_id='.$owner->id)
            ->assertForbidden();
    }

    public function test_a_registrar_head_can_view_any_students_academic_record(): void
    {
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $registrarToken = $this->tokenForNewUser(UserRole::RegistrarHead, 'registrar.academicrecord@grc.test');

        $this->withToken($registrarToken)
            ->getJson('/api/v1/academic-record?student_id='.$student->id)
            ->assertOk();
    }

    public function test_a_faculty_role_is_forbidden(): void
    {
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenForNewUser(UserRole::Faculty, 'faculty.academicrecord@grc.test');

        $this->withToken($token)
            ->getJson('/api/v1/academic-record?student_id='.$student->id)
            ->assertForbidden();
    }
}
