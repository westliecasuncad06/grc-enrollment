<?php

namespace Tests\Feature\Actions\Enrollment;

use App\Actions\Enrollment\BuildEnrollmentAccessContext;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Enrollment\EnrollmentAudience;
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

final class BuildEnrollmentAccessContextTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    private function makeCurriculum(): Curriculum
    {
        $program = Program::create(['code' => 'BSCS', 'name' => 'BS Computer Science', 'status' => ProgramStatus::Active]);

        return Curriculum::create([
            'program_id' => $program->id, 'name' => 'BSCS Curriculum',
            'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Active,
        ]);
    }

    private function makeStudent(Curriculum $curriculum, string $email, ?string $category): StudentProfile
    {
        $user = User::create([
            'name' => 'Test Student', 'email' => $email,
            'password' => self::PASSWORD, 'role' => UserRole::Student, 'status' => UserStatus::Active,
        ]);

        return StudentProfile::create([
            'user_id' => $user->id, 'student_number' => 'STU-'.$user->id,
            'program_id' => $curriculum->program_id, 'curriculum_id' => $curriculum->id,
            'year_level' => 2, 'enrollment_category' => $category,
            'admission_status' => AdmissionStatus::Admitted, 'academic_standing' => AcademicStanding::Good,
        ]);
    }

    private function makeBlock(AcademicTerm $term, Curriculum $curriculum): void
    {
        $plan = AcademicTermSectionPlan::create([
            'academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id,
            'college' => 'ccs', 'year_level' => 2, 'section_count' => 1,
            'students_per_block' => 40, 'status' => 'submitted',
        ]);
        $subject = Subject::create(['code' => 'CS201', 'title' => 'CS201 Title', 'units' => 3, 'status' => SubjectStatus::Active]);
        CurriculumSubject::create([
            'curriculum_id' => $curriculum->id, 'subject_id' => $subject->id,
            'year_level' => 2, 'semester' => '2nd', 'is_required' => true,
        ]);
        Section::create([
            'academic_term_id' => $term->id, 'section_plan_id' => $plan->id, 'subject_id' => $subject->id,
            'section_code' => 'IT201', 'schedule_days' => 'MWF', 'starts_at_time' => '08:00:00',
            'ends_at_time' => '09:00:00', 'capacity' => 40, 'is_block_exclusive' => true,
            'status' => SectionStatus::Published,
        ]);
    }

    public function test_a_stale_stored_category_self_heals_to_the_live_verdict_on_the_ongoing_term(): void
    {
        $term = AcademicTerm::create([
            'school_year' => '2026-2027', 'semester' => '2nd', 'status' => AcademicTermStatus::SemesterOngoing,
        ]);
        $curriculum = $this->makeCurriculum();
        $this->makeBlock($term, $curriculum);
        // Stored as irregular from a stale prior computation; she fits the
        // block exactly now (no backlog, nothing failed early).
        $student = $this->makeStudent($curriculum, 'stale@grc.test', 'irregular');
        User::create([
            'name' => 'Registrar', 'email' => 'registrar.selfheal@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::RegistrarHead, 'status' => UserStatus::Active,
        ]);

        $context = app(BuildEnrollmentAccessContext::class)->execute($term, $student);

        self::assertNotSame(EnrollmentAudience::Irregular, $context->viewerAudience);
        self::assertSame('regular', $student->fresh()->enrollment_category);
    }

    public function test_no_registrar_head_user_skips_the_persist_without_throwing(): void
    {
        $term = AcademicTerm::create([
            'school_year' => '2026-2027', 'semester' => '2nd', 'status' => AcademicTermStatus::SemesterOngoing,
        ]);
        $curriculum = $this->makeCurriculum();
        $this->makeBlock($term, $curriculum);
        // Stored as irregular from a stale prior computation; she fits the
        // block exactly now, so the live verdict is Regular and a persist
        // will be attempted — but deliberately no RegistrarHead user exists
        // to attribute the audit to, so the persist must silently no-op
        // rather than throw. This is the highest-stakes guarantee here:
        // an ordinary student loading their own enrollment page must never
        // hit an exception because no registrar exists yet.
        $student = $this->makeStudent($curriculum, 'no-registrar@grc.test', 'irregular');

        $context = app(BuildEnrollmentAccessContext::class)->execute($term, $student);

        self::assertNotSame(EnrollmentAudience::Irregular, $context->viewerAudience);
        self::assertSame('irregular', $student->fresh()->enrollment_category);
    }

    public function test_browsing_an_archived_term_never_mutates_stored_standing(): void
    {
        $term = AcademicTerm::create([
            'school_year' => '2025-2026', 'semester' => '2nd', 'status' => AcademicTermStatus::Archived,
        ]);
        $curriculum = $this->makeCurriculum();
        $this->makeBlock($term, $curriculum);
        $student = $this->makeStudent($curriculum, 'archived@grc.test', 'irregular');

        $context = app(BuildEnrollmentAccessContext::class)->execute($term, $student);

        self::assertSame(EnrollmentAudience::Irregular, $context->viewerAudience);
        self::assertSame('irregular', $student->fresh()->enrollment_category);
    }

    public function test_no_block_published_yet_falls_back_to_the_stored_category_without_writing(): void
    {
        $term = AcademicTerm::create([
            'school_year' => '2026-2027', 'semester' => '2nd', 'status' => AcademicTermStatus::SemesterOngoing,
        ]);
        $curriculum = $this->makeCurriculum();
        // No block published for year level 2 this term.
        $student = $this->makeStudent($curriculum, 'undetermined@grc.test', 'regular');

        $context = app(BuildEnrollmentAccessContext::class)->execute($term, $student);

        self::assertNotSame(EnrollmentAudience::Irregular, $context->viewerAudience);
        self::assertSame('regular', $student->fresh()->enrollment_category);
    }
}
