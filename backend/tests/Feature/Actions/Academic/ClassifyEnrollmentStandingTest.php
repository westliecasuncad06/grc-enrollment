<?php

namespace Tests\Feature\Actions\Academic;

use App\Actions\Academic\ClassifyEnrollmentStanding;
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
use App\Models\AcademicTermSectionPlan;
use App\Models\Curriculum;
use App\Models\CurriculumMigration;
use App\Models\CurriculumMigrationCredit;
use App\Models\CurriculumSubject;
use App\Models\CurriculumSubjectEquivalency;
use App\Models\Program;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\SubjectPrerequisite;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class ClassifyEnrollmentStandingTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    private function makeTerm(string $semester = '2nd'): AcademicTerm
    {
        return AcademicTerm::create([
            'school_year' => '2026-2027', 'semester' => $semester,
            'status' => AcademicTermStatus::SemesterOngoing,
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

    private function placeSubject(Curriculum $curriculum, Subject $subject, int $yearLevel, string $semester = '2nd'): CurriculumSubject
    {
        return CurriculumSubject::create([
            'curriculum_id' => $curriculum->id, 'subject_id' => $subject->id,
            'year_level' => $yearLevel, 'semester' => $semester, 'is_required' => true,
        ]);
    }

    private function makeStudent(Curriculum $curriculum, string $email, int $yearLevel = 2): StudentProfile
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

    private function makePlan(AcademicTerm $term, Curriculum $curriculum, int $yearLevel): AcademicTermSectionPlan
    {
        return AcademicTermSectionPlan::create([
            'academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id,
            'college' => 'ccs', 'year_level' => $yearLevel, 'section_count' => 1,
            'students_per_block' => 40, 'status' => 'submitted',
        ]);
    }

    private function makeBlockSection(AcademicTerm $term, AcademicTermSectionPlan $plan, Subject $subject, string $blockCode = 'IT201'): Section
    {
        return Section::create([
            'academic_term_id' => $term->id, 'section_plan_id' => $plan->id, 'subject_id' => $subject->id,
            'section_code' => $blockCode, 'schedule_days' => 'MWF', 'starts_at_time' => '08:00:00',
            'ends_at_time' => '09:00:00', 'capacity' => 40, 'is_block_exclusive' => true,
            'status' => SectionStatus::Published,
        ]);
    }

    private function makePlainSection(AcademicTerm $term, Subject $subject, array $overrides = []): Section
    {
        return Section::create(array_merge([
            'academic_term_id' => $term->id, 'subject_id' => $subject->id, 'section_code' => 'A',
            'capacity' => 40, 'is_block_exclusive' => false, 'status' => SectionStatus::Published,
        ], $overrides));
    }

    private function lockGrade(StudentProfile $student, Subject $subject, AcademicTerm $term, string $mark): AcademicGrade
    {
        $encoder = User::create([
            'name' => 'Encoder', 'email' => 'encoder.'.uniqid().'@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::RegistrarHead, 'status' => UserStatus::Active,
        ]);

        return AcademicGrade::create([
            'student_id' => $student->id, 'subject_id' => $subject->id, 'academic_term_id' => $term->id,
            'mark' => $mark, 'status' => GradeStatus::Locked, 'encoded_by' => $encoder->id,
        ]);
    }

    public function test_a_student_who_fits_the_standard_block_exactly_is_regular(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum, 2);
        $subject = $this->makeSubject('CS201');
        $this->placeSubject($curriculum, $subject, 2);
        $this->makeBlockSection($term, $plan, $subject);
        $student = $this->makeStudent($curriculum, 'fits@grc.test');

        $verdict = app(ClassifyEnrollmentStanding::class)->classify($student, $term);

        self::assertNotNull($verdict);
        self::assertTrue($verdict->isRegular());
    }

    public function test_a_backlog_subject_with_an_open_section_this_term_makes_the_student_irregular(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum, 2);
        $standard = $this->makeSubject('CS201');
        $this->placeSubject($curriculum, $standard, 2);
        $this->makeBlockSection($term, $plan, $standard);
        $backlog = $this->makeSubject('ITC');
        $this->placeSubject($curriculum, $backlog, 1, '1st');
        $this->makePlainSection($term, $backlog);
        $student = $this->makeStudent($curriculum, 'backlog-open@grc.test');

        $verdict = app(ClassifyEnrollmentStanding::class)->classify($student, $term);

        self::assertNotNull($verdict);
        self::assertFalse($verdict->isRegular());
        self::assertSame('needs_adding_backlog', $verdict->reasons[0]['code']);
        self::assertStringContainsString('ITC', $verdict->reasons[0]['message']);
    }

    public function test_a_future_subject_with_an_open_section_this_term_does_not_affect_standing(): void
    {
        // The inverse of the "open backlog subject" case above: SPI is
        // placed at year 4, well ahead of this year-2 student's own
        // current position. Even though it has an open, non-block-exclusive
        // section this term and no unmet prerequisite blocks it, a subject
        // the student hasn't reached yet must never be flagged as
        // needs_adding_backlog.
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum, 2);
        $standard = $this->makeSubject('CS201');
        $this->placeSubject($curriculum, $standard, 2);
        $this->makeBlockSection($term, $plan, $standard);
        $future = $this->makeSubject('SPI');
        $this->placeSubject($curriculum, $future, 4, '2nd');
        $this->makePlainSection($term, $future);
        $student = $this->makeStudent($curriculum, 'future-subject@grc.test');

        $verdict = app(ClassifyEnrollmentStanding::class)->classify($student, $term);

        self::assertNotNull($verdict);
        self::assertTrue($verdict->isRegular());
    }

    public function test_a_backlog_subject_with_no_section_this_term_does_not_affect_standing(): void
    {
        // The exact Socorro Y. Amurao case: a backlog subject exists, but
        // it isn't offered this (2nd semester) term, so there is nothing
        // actionable for it right now.
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum, 2);
        $standard = $this->makeSubject('CS201');
        $this->placeSubject($curriculum, $standard, 2);
        $this->makeBlockSection($term, $plan, $standard);
        $backlog = $this->makeSubject('ITC');
        $this->placeSubject($curriculum, $backlog, 1, '1st');
        // No section created for ITC this term at all.
        $student = $this->makeStudent($curriculum, 'backlog-closed@grc.test');

        $verdict = app(ClassifyEnrollmentStanding::class)->classify($student, $term);

        self::assertNotNull($verdict);
        self::assertTrue($verdict->isRegular());
    }

    public function test_a_standard_subject_already_passed_early_makes_the_student_irregular(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum, 2);
        $subject = $this->makeSubject('CS201');
        $this->placeSubject($curriculum, $subject, 2);
        $this->makeBlockSection($term, $plan, $subject);
        $student = $this->makeStudent($curriculum, 'early-pass@grc.test');
        $this->lockGrade($student, $subject, $term, '2.00');

        $verdict = app(ClassifyEnrollmentStanding::class)->classify($student, $term);

        self::assertNotNull($verdict);
        self::assertFalse($verdict->isRegular());
        self::assertSame('needs_removing_completed', $verdict->reasons[0]['code']);
    }

    public function test_a_standard_subject_blocked_by_an_unmet_prerequisite_makes_the_student_irregular(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum, 2);
        $prereq = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $prereq, 1, '1st');
        $advanced = $this->makeSubject('CS201');
        $placement = $this->placeSubject($curriculum, $advanced, 2);
        SubjectPrerequisite::create([
            'curriculum_subject_id' => $placement->id, 'prerequisite_subject_id' => $prereq->id, 'minimum_grade' => '3.00',
        ]);
        $this->makeBlockSection($term, $plan, $advanced);
        $student = $this->makeStudent($curriculum, 'unmet-prereq@grc.test');
        // CS101 never taken.

        $verdict = app(ClassifyEnrollmentStanding::class)->classify($student, $term);

        self::assertNotNull($verdict);
        self::assertFalse($verdict->isRegular());
        self::assertSame('needs_removing_prerequisite', $verdict->reasons[0]['code']);
    }

    public function test_no_block_published_yet_for_the_year_level_is_undetermined(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        // No plan, no block section at all for year level 2 this term.
        $student = $this->makeStudent($curriculum, 'no-block@grc.test');

        $verdict = app(ClassifyEnrollmentStanding::class)->classify($student, $term);

        self::assertNull($verdict);
    }

    public function test_a_migration_credit_on_a_backlog_subject_is_not_counted_as_needing_addition(): void
    {
        $term = $this->makeTerm();
        $target = $this->makeCurriculum();
        $source = Curriculum::create([
            'program_id' => $target->program_id, 'name' => 'BSCS Previous Curriculum',
            'effective_school_year' => '2023-2024', 'status' => CurriculumStatus::Archived,
        ]);
        $plan = $this->makePlan($term, $target, 2);
        $standard = $this->makeSubject('CS201');
        $this->placeSubject($target, $standard, 2);
        $this->makeBlockSection($term, $plan, $standard);
        $oldSubject = $this->makeSubject('CS-OLD');
        $newSubject = $this->makeSubject('CS-NEW');
        $this->placeSubject($source, $oldSubject, 1, '1st');
        $this->placeSubject($target, $newSubject, 1, '1st');
        $this->makePlainSection($term, $newSubject);
        $student = $this->makeStudent($target, 'credited-backlog@grc.test');
        $registrar = User::create([
            'name' => 'Registrar', 'email' => 'registrar.credit@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::RegistrarHead, 'status' => UserStatus::Active,
        ]);
        $grade = $this->lockGrade($student, $oldSubject, $term, '2.00');
        $equivalency = CurriculumSubjectEquivalency::create([
            'source_curriculum_id' => $source->id, 'target_curriculum_id' => $target->id,
            'source_subject_id' => $oldSubject->id, 'target_subject_id' => $newSubject->id,
        ]);
        $migration = CurriculumMigration::create([
            'student_id' => $student->id, 'source_curriculum_id' => $source->id,
            'target_curriculum_id' => $target->id, 'processed_by' => $registrar->id, 'migrated_at' => now(),
        ]);
        CurriculumMigrationCredit::create([
            'curriculum_migration_id' => $migration->id, 'curriculum_subject_equivalency_id' => $equivalency->id,
            'source_academic_grade_id' => $grade->id, 'target_subject_id' => $newSubject->id,
        ]);

        $verdict = app(ClassifyEnrollmentStanding::class)->classify($student, $term);

        self::assertNotNull($verdict);
        self::assertTrue($verdict->isRegular());
    }

    public function test_classify_many_batches_across_students_sharing_curriculum_and_year_level(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum, 2);
        $subject = $this->makeSubject('CS201');
        $this->placeSubject($curriculum, $subject, 2);
        $this->makeBlockSection($term, $plan, $subject);
        $fits = $this->makeStudent($curriculum, 'many-fits@grc.test');
        $early = $this->makeStudent($curriculum, 'many-early@grc.test');
        $this->lockGrade($early, $subject, $term, '2.00');

        $verdicts = app(ClassifyEnrollmentStanding::class)->classifyMany(
            new Collection([$fits, $early]),
            $term,
        );

        self::assertTrue($verdicts[$fits->id]->isRegular());
        self::assertFalse($verdicts[$early->id]->isRegular());
    }
}
