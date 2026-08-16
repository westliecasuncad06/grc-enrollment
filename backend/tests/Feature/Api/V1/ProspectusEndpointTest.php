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
use App\Models\AcademicGrade;
use App\Models\AcademicTerm;
use App\Models\Curriculum;
use App\Models\CurriculumMigration;
use App\Models\CurriculumMigrationCredit;
use App\Models\CurriculumSubject;
use App\Models\CurriculumSubjectEquivalency;
use App\Models\Program;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\SubjectPrerequisite;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class ProspectusEndpointTest extends TestCase
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

    private function makeSubject(string $code): Subject
    {
        return Subject::create(['code' => $code, 'title' => $code.' Title', 'units' => 3.0, 'status' => SubjectStatus::Active]);
    }

    private function placeSubject(Curriculum $curriculum, Subject $subject, int $yearLevel, string $semester = '1st'): CurriculumSubject
    {
        return CurriculumSubject::create([
            'curriculum_id' => $curriculum->id, 'subject_id' => $subject->id,
            'year_level' => $yearLevel, 'semester' => $semester, 'is_required' => true,
        ]);
    }

    private function makeStudent(Curriculum $curriculum, string $email = 'student.prospectus@grc.test', int $yearLevel = 2): StudentProfile
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

    public function test_anonymous_request_is_unauthenticated(): void
    {
        $this->getJson('/api/v1/prospectus')->assertUnauthorized();
    }

    public function test_a_faculty_role_is_forbidden(): void
    {
        $token = $this->tokenForNewUser(UserRole::Faculty, 'faculty.prospectus@grc.test');

        $this->withToken($token)->getJson('/api/v1/prospectus')->assertForbidden();
    }

    public function test_a_student_sees_their_own_prospectus_with_blank_and_filled_entries(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $taken = $this->makeSubject('CS101');
        $untaken = $this->makeSubject('CS102');
        $this->placeSubject($curriculum, $taken, 1, '1st');
        $this->placeSubject($curriculum, $untaken, 1, '2nd');
        $student = $this->makeStudent($curriculum);
        $professor = User::create(['name' => 'Prof', 'email' => 'prof.prospectus@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        AcademicGrade::create([
            'student_id' => $student->id, 'subject_id' => $taken->id, 'academic_term_id' => $term->id,
            'mark' => '1.75', 'status' => GradeStatus::Locked, 'encoded_by' => $professor->id,
        ]);
        $token = $this->tokenFor($student->user);

        $response = $this->withToken($token)->getJson('/api/v1/prospectus');

        $response->assertOk();
        $semesters = $response->json('data.semesters');
        self::assertCount(2, $semesters);

        $firstSemEntries = collect($semesters)->firstWhere('semester', '1st')['entries'];
        $takenEntry = collect($firstSemEntries)->firstWhere('code', 'CS101');
        self::assertSame('1.75', $takenEntry['mark']);
        self::assertSame('Very Good', $takenEntry['mark_label']);
        self::assertSame(1, $takenEntry['attempt_count']);

        $secondSemEntries = collect($semesters)->firstWhere('semester', '2nd')['entries'];
        $untakenEntry = collect($secondSemEntries)->firstWhere('code', 'CS102');
        self::assertNull($untakenEntry['mark']);
        self::assertSame(0, $untakenEntry['attempt_count']);
    }

    public function test_a_subjects_prerequisites_are_included_on_its_prospectus_entry(): void
    {
        $curriculum = $this->makeCurriculum();
        $prerequisite = $this->makeSubject('CS100');
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $prerequisite, 1, '1st');
        $placement = $this->placeSubject($curriculum, $subject, 1, '2nd');
        SubjectPrerequisite::create([
            'curriculum_subject_id' => $placement->id,
            'prerequisite_subject_id' => $prerequisite->id,
            'minimum_grade' => '75',
        ]);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student->user);

        $response = $this->withToken($token)->getJson('/api/v1/prospectus');

        $response->assertOk();
        $semesters = $response->json('data.semesters');

        $secondSemEntries = collect($semesters)->firstWhere('semester', '2nd')['entries'];
        $entry = collect($secondSemEntries)->firstWhere('code', 'CS101');
        self::assertSame([
            [
                'subject_id' => $prerequisite->id,
                'code' => 'CS100',
                'title' => 'CS100 Title',
                'minimum_grade' => '75',
            ],
        ], $entry['prerequisites']);

        $firstSemEntries = collect($semesters)->firstWhere('semester', '1st')['entries'];
        $prerequisiteEntry = collect($firstSemEntries)->firstWhere('code', 'CS100');
        self::assertSame([], $prerequisiteEntry['prerequisites']);
    }

    public function test_a_migrated_student_sees_read_only_old_to_new_credited_subjects(): void
    {
        $term = $this->makeTerm();
        $target = $this->makeCurriculum();
        $source = Curriculum::create([
            'program_id' => $target->program_id,
            'name' => 'BSCS 2021 Curriculum',
            'effective_school_year' => '2021-2022',
            'status' => CurriculumStatus::Archived,
        ]);
        $oldSubject = $this->makeSubject('CS-OLD');
        $newSubject = $this->makeSubject('CS-NEW');
        $this->placeSubject($source, $oldSubject, 1);
        $this->placeSubject($target, $newSubject, 1);
        $student = $this->makeStudent($target, 'migrated.prospectus@grc.test');
        $chair = User::create([
            'name' => 'Chair', 'email' => 'chair.migrated.prospectus@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::ProgramChair, 'status' => UserStatus::Active,
        ]);
        $grade = AcademicGrade::create([
            'student_id' => $student->id, 'subject_id' => $oldSubject->id, 'academic_term_id' => $term->id,
            'mark' => '1.75', 'status' => GradeStatus::Locked, 'encoded_by' => $chair->id,
        ]);
        $equivalency = CurriculumSubjectEquivalency::create([
            'source_curriculum_id' => $source->id, 'target_curriculum_id' => $target->id,
            'source_subject_id' => $oldSubject->id, 'target_subject_id' => $newSubject->id,
        ]);
        $migration = CurriculumMigration::create([
            'student_id' => $student->id, 'source_curriculum_id' => $source->id,
            'target_curriculum_id' => $target->id, 'processed_by' => $chair->id,
            'migrated_at' => now(),
        ]);
        CurriculumMigrationCredit::create([
            'curriculum_migration_id' => $migration->id,
            'curriculum_subject_equivalency_id' => $equivalency->id,
            'source_academic_grade_id' => $grade->id,
            'target_subject_id' => $newSubject->id,
        ]);

        $response = $this->withToken($this->tokenFor($student->user))
            ->getJson('/api/v1/prospectus');

        $response
            ->assertOk()
            ->assertJsonPath('data.curriculum_transition.source_curriculum_name', 'BSCS 2021 Curriculum')
            ->assertJsonPath('data.curriculum_transition.target_curriculum_name', 'BSCS Curriculum')
            ->assertJsonPath('data.curriculum_transition.credits.0.source_code', 'CS-OLD')
            ->assertJsonPath('data.curriculum_transition.credits.0.target_code', 'CS-NEW');
    }

    public function test_a_student_cannot_view_another_students_prospectus(): void
    {
        $curriculum = $this->makeCurriculum();
        $owner = $this->makeStudent($curriculum, 'owner.prospectus@grc.test');
        $other = $this->makeStudent($curriculum, 'other.prospectus@grc.test');
        $token = $this->tokenFor($other->user);

        $this->withToken($token)
            ->getJson('/api/v1/prospectus?student_id='.$owner->id)
            ->assertForbidden();
    }

    public function test_a_registrar_head_can_view_any_students_prospectus(): void
    {
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $registrarToken = $this->tokenForNewUser(UserRole::RegistrarHead, 'registrar.prospectus@grc.test');

        $this->withToken($registrarToken)
            ->getJson('/api/v1/prospectus?student_id='.$student->id)
            ->assertOk()
            ->assertJsonPath('data.student_id', $student->id);
    }

    public function test_a_registrar_staff_can_view_any_students_prospectus(): void
    {
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $registrarToken = $this->tokenForNewUser(UserRole::RegistrarStaff, 'registrar-staff.prospectus@grc.test');

        $this->withToken($registrarToken)
            ->getJson('/api/v1/prospectus?student_id='.$student->id)
            ->assertOk();
    }

    public function test_a_grade_for_a_subject_outside_the_curriculum_is_surfaced_as_unplaced(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $unplacedSubject = $this->makeSubject('TRANSFER101');
        $student = $this->makeStudent($curriculum);
        $professor = User::create(['name' => 'Prof', 'email' => 'prof.unplaced@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        AcademicGrade::create([
            'student_id' => $student->id, 'subject_id' => $unplacedSubject->id, 'academic_term_id' => $term->id,
            'mark' => '2.00', 'status' => GradeStatus::Locked, 'encoded_by' => $professor->id,
        ]);
        $token = $this->tokenFor($student->user);

        $response = $this->withToken($token)->getJson('/api/v1/prospectus');

        $response->assertOk();
        self::assertSame([], $response->json('data.semesters'));
        $unplaced = $response->json('data.unplaced_entries');
        self::assertCount(1, $unplaced);
        self::assertSame('TRANSFER101', $unplaced[0]['code']);
    }
}
