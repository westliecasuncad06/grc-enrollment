<?php

namespace Tests\Feature\Actions\Organization;

use App\Actions\Organization\SaveSectionPlan;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\CollegeCode;
use App\Domain\Organization\ProgramStatus;
use App\Domain\Organization\SectionPlanStatus;
use App\Domain\Scheduling\SectionModality;
use App\Domain\Scheduling\SectionStatus;
use App\Models\AcademicTerm;
use App\Models\AcademicTermSectionPlan;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Program;
use App\Models\Section;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Per product direction, a Program Chair must be able to submit a schedule
 * for Dean/Executive Director approval while assignments are still being
 * completed. The review queue must show those incomplete details instead of
 * preventing the Chair from submitting the proposal.
 */
final class SaveSectionPlanSubmitTest extends TestCase
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
        $program = Program::create([
            'code' => 'BSIT', 'name' => 'BS Information Technology',
            'status' => ProgramStatus::Active, 'college' => CollegeCode::Ccs,
        ]);

        return Curriculum::create([
            'program_id' => $program->id, 'name' => 'BSIT Curriculum',
            'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Active,
        ]);
    }

    private function makeChair(): User
    {
        return User::create([
            'name' => 'Chair', 'email' => 'chair.submit@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::ProgramChair,
            'college' => CollegeCode::Ccs, 'status' => UserStatus::Active,
        ]);
    }

    private function placeSubject(Curriculum $curriculum, string $code): Subject
    {
        $subject = Subject::create(['code' => $code, 'title' => "{$code} Title", 'units' => 3, 'status' => SubjectStatus::Active]);
        CurriculumSubject::create([
            'curriculum_id' => $curriculum->id, 'subject_id' => $subject->id,
            'year_level' => 1, 'semester' => '1st', 'is_required' => true,
        ]);

        return $subject;
    }

    private function releaseOneSection(AcademicTerm $term, Curriculum $curriculum, User $chair, string $code): Section
    {
        $subject = $this->placeSubject($curriculum, $code);
        AcademicTermSectionPlan::create([
            'academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id,
            'college' => 'ccs', 'year_level' => 1, 'section_count' => 1,
            'students_per_block' => 40, 'status' => SectionPlanStatus::Draft,
        ]);

        app(SaveSectionPlan::class)->release(
            $term, $curriculum->id, $chair, new AuditRequestContext('submit-test', null), 1,
        );

        return Section::query()->where('subject_id', $subject->id)->sole();
    }

    public function test_submitting_succeeds_when_a_section_has_no_assigned_professor(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $chair = $this->makeChair();
        $section = $this->releaseOneSection($term, $curriculum, $chair, 'ITC');
        $section->update([
            'professor_id' => null,
            'schedule_days' => 'M',
            'starts_at_time' => '08:00:00',
            'ends_at_time' => '10:00:00',
            'room' => 'Room 101',
            'modality' => SectionModality::FaceToFace,
            'status' => SectionStatus::Planned,
        ]);

        $proposal = app(SaveSectionPlan::class)->submit(
            $term, $curriculum->id, $chair, new AuditRequestContext('submit-test', null),
        );

        self::assertSame('draft', $proposal->status->value);
        self::assertSame(
            SectionPlanStatus::Submitted,
            AcademicTermSectionPlan::query()->where('curriculum_id', $curriculum->id)->where('year_level', 1)->sole()->status,
        );
    }

    public function test_submitting_succeeds_when_a_section_has_incomplete_schedule_details(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $chair = $this->makeChair();
        $section = $this->releaseOneSection($term, $curriculum, $chair, 'ITC');
        $section->update([
            'professor_id' => null,
            'schedule_days' => null,
            'starts_at_time' => null,
            'ends_at_time' => null,
            'room' => null,
            'modality' => null,
        ]);

        $proposal = app(SaveSectionPlan::class)->submit(
            $term, $curriculum->id, $chair, new AuditRequestContext('submit-test', null),
        );

        self::assertSame('draft', $proposal->status->value);
        self::assertSame(
            SectionPlanStatus::Submitted,
            AcademicTermSectionPlan::query()->where('curriculum_id', $curriculum->id)->where('year_level', 1)->sole()->status,
        );
    }
}
