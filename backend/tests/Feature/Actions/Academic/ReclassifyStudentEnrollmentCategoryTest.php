<?php

namespace Tests\Feature\Actions\Academic;

use App\Actions\Academic\ReclassifyStudentEnrollmentCategory;
use App\Domain\Academic\GradeStatus;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Enrollment\EnrollmentCategory;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Notifications\NotificationType;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\ProgramStatus;
use App\Models\AcademicGrade;
use App\Models\AcademicTerm;
use App\Models\AuditLog;
use App\Models\Curriculum;
use App\Models\CurriculumMigration;
use App\Models\CurriculumMigrationCredit;
use App\Models\CurriculumSubject;
use App\Models\CurriculumSubjectEquivalency;
use App\Models\Notification;
use App\Models\Program;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

final class ReclassifyStudentEnrollmentCategoryTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    private function makeTerm(string $semester = '2nd'): AcademicTerm
    {
        return AcademicTerm::create([
            'school_year' => '2026-2027', 'semester' => $semester, 'status' => AcademicTermStatus::SemesterOngoing,
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

    private function makeStudent(Curriculum $curriculum, string $email, int $yearLevel = 2, string $category = 'regular'): StudentProfile
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
            'enrollment_category' => $category,
            'admission_status' => AdmissionStatus::Admitted,
            'academic_standing' => AcademicStanding::Good,
        ]);
    }

    private function makeRegistrarHead(): User
    {
        return User::create([
            'name' => 'Registrar', 'email' => 'registrar.reclassify@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::RegistrarHead, 'status' => UserStatus::Active,
        ]);
    }

    private function lockGrade(StudentProfile $student, Subject $subject, AcademicTerm $term, string $mark, User $encoder): AcademicGrade
    {
        return AcademicGrade::create([
            'student_id' => $student->id, 'subject_id' => $subject->id, 'academic_term_id' => $term->id,
            'mark' => $mark, 'status' => GradeStatus::Locked, 'encoded_by' => $encoder->id,
        ]);
    }

    public function test_a_clean_record_stays_regular_and_writes_nothing(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject, 1);
        $student = $this->makeStudent($curriculum, 'clean@grc.test', yearLevel: 2, category: 'regular');
        $registrar = $this->makeRegistrarHead();
        $this->lockGrade($student, $subject, $term, '2.00', $registrar);

        $verdict = app(ReclassifyStudentEnrollmentCategory::class)->execute(
            $student,
            $term,
            $registrar,
            new AuditRequestContext('test-reclassify', null),
        );

        self::assertTrue($verdict->isRegular());
        self::assertSame('regular', $student->fresh()->enrollment_category);
        self::assertSame(0, AuditLog::query()->where('action', AuditAction::STUDENT_ENROLLMENT_CATEGORY_RECLASSIFIED)->count());
        self::assertSame(0, Notification::query()->where('type', NotificationType::EnrollmentCategoryReclassified)->count());
    }

    public function test_a_failing_grade_flips_the_student_to_irregular_and_audits_and_notifies(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject, 1);
        $student = $this->makeStudent($curriculum, 'failing@grc.test', yearLevel: 2, category: 'regular');
        $registrar = $this->makeRegistrarHead();
        $this->lockGrade($student, $subject, $term, '5.00', $registrar);

        $verdict = app(ReclassifyStudentEnrollmentCategory::class)->execute(
            $student,
            $term,
            $registrar,
            new AuditRequestContext('test-reclassify', null),
        );

        self::assertFalse($verdict->isRegular());
        self::assertSame(EnrollmentCategory::Irregular, $verdict->category);

        $fresh = $student->fresh();
        self::assertSame('irregular', $fresh->enrollment_category);
        self::assertNotNull($fresh->enrollment_category_derived_at);

        $audit = AuditLog::query()->where('action', AuditAction::STUDENT_ENROLLMENT_CATEGORY_RECLASSIFIED)->sole();
        self::assertSame('regular', $audit->before_values['enrollment_category']);
        self::assertSame('irregular', $audit->after_values['enrollment_category']);

        $notification = Notification::query()->where('type', NotificationType::EnrollmentCategoryReclassified)->sole();
        self::assertSame($student->user_id, $notification->user_id);
        self::assertStringContainsString('CS101', $notification->message);
    }

    public function test_a_previously_irregular_student_who_now_has_a_clean_record_returns_to_regular(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject, 1);
        $student = $this->makeStudent($curriculum, 'retake@grc.test', yearLevel: 2, category: 'irregular');
        $registrar = $this->makeRegistrarHead();
        // Passed on retake -- only the latest locked mark should count.
        $this->lockGrade($student, $subject, $term, '2.00', $registrar);

        $verdict = app(ReclassifyStudentEnrollmentCategory::class)->execute(
            $student,
            $term,
            $registrar,
            new AuditRequestContext('test-reclassify', null),
        );

        self::assertTrue($verdict->isRegular());
        self::assertSame('regular', $student->fresh()->enrollment_category);
    }

    public function test_a_migration_credit_counts_as_a_completed_target_subject_for_standing(): void
    {
        $term = $this->makeTerm();
        $target = $this->makeCurriculum();
        $source = Curriculum::create([
            'program_id' => $target->program_id,
            'name' => 'BSCS Previous Curriculum',
            'effective_school_year' => '2023-2024',
            'status' => CurriculumStatus::Archived,
        ]);
        $oldSubject = $this->makeSubject('CS-OLD');
        $newSubject = $this->makeSubject('CS-NEW');
        $this->placeSubject($source, $oldSubject, 1);
        $this->placeSubject($target, $newSubject, 1);
        $student = $this->makeStudent($target, 'credited@grc.test', yearLevel: 2, category: 'irregular');
        $registrar = $this->makeRegistrarHead();
        $grade = $this->lockGrade($student, $oldSubject, $term, '2.00', $registrar);
        $equivalency = CurriculumSubjectEquivalency::create([
            'source_curriculum_id' => $source->id,
            'target_curriculum_id' => $target->id,
            'source_subject_id' => $oldSubject->id,
            'target_subject_id' => $newSubject->id,
        ]);
        $migration = CurriculumMigration::create([
            'student_id' => $student->id,
            'source_curriculum_id' => $source->id,
            'target_curriculum_id' => $target->id,
            'processed_by' => $registrar->id,
            'migrated_at' => now(),
        ]);
        CurriculumMigrationCredit::create([
            'curriculum_migration_id' => $migration->id,
            'curriculum_subject_equivalency_id' => $equivalency->id,
            'source_academic_grade_id' => $grade->id,
            'target_subject_id' => $newSubject->id,
        ]);

        $verdict = app(ReclassifyStudentEnrollmentCategory::class)->execute(
            $student,
            $term,
            $registrar,
            new AuditRequestContext('test-reclassify-credit', null),
        );

        self::assertTrue($verdict->isRegular());
        self::assertSame('regular', $student->fresh()->enrollment_category);
    }

    public function test_locking_a_grade_through_the_endpoint_triggers_reclassification(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject, 1);
        $student = $this->makeStudent($curriculum, 'endpoint@grc.test', yearLevel: 2, category: 'regular');
        $professor = User::create(['name' => 'Prof', 'email' => 'prof.reclassify@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $registrar = $this->makeRegistrarHead();
        $grade = AcademicGrade::create([
            'student_id' => $student->id, 'subject_id' => $subject->id, 'academic_term_id' => $term->id,
            'mark' => '5.00', 'status' => GradeStatus::Submitted, 'encoded_by' => $professor->id,
        ]);
        $token = (string) $this->postJson('/api/v1/auth/login', [
            'email' => $registrar->email, 'password' => self::PASSWORD,
        ])->json('data.token');

        $this->withToken($token)->patchJson("/api/v1/academic-grades/{$grade->id}", ['action' => 'lock'])
            ->assertOk();

        self::assertSame('irregular', $student->fresh()->enrollment_category);
    }

    public function test_batch_reclassification_of_many_students_does_not_scale_reads_with_student_count(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $subject, 1);
        $registrar = $this->makeRegistrarHead();

        // 5 students, all starting "regular"; exactly 2 (i=2,4) fail and
        // will flip to irregular -- the other 3 stay regular and trigger no
        // write/audit/notification at all.
        $students = collect(range(1, 5))->map(function (int $i) use ($curriculum, $term, $registrar, $subject) {
            $student = $this->makeStudent($curriculum, "batch{$i}@grc.test", yearLevel: 2, category: 'regular');
            $this->lockGrade($student, $subject, $term, $i % 2 === 0 ? '5.00' : '2.00', $registrar);

            return $student;
        });

        $queryCount = 0;
        DB::listen(function () use (&$queryCount) {
            $queryCount++;
        });

        $verdicts = app(ReclassifyStudentEnrollmentCategory::class)->executeMany(
            Collection::make($students->all()),
            $term,
            $registrar,
            new AuditRequestContext('test-batch-reclassify', null),
        );

        self::assertCount(5, $verdicts);
        $irregularCount = collect($verdicts)->filter(fn ($verdict) => ! $verdict->isRegular())->count();
        self::assertSame(2, $irregularCount);

        // The read side (locked grades + curriculum placements) is exactly
        // 2 queries regardless of student count; a per-student N+1 would
        // instead cost roughly 2 queries PER student here (10+). The write
        // side legitimately scales with the 2 actual changes (1 bulk UPDATE
        // + 1 audit INSERT + 1 notification INSERT each), plus the
        // transaction's own BEGIN/COMMIT -- so a generous upper bound of 10
        // still clearly distinguishes "constant reads" from "N+1 reads."
        self::assertLessThan(10, $queryCount);
    }
}
