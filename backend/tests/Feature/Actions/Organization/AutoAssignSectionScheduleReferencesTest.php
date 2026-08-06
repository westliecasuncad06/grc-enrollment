<?php

namespace Tests\Feature\Actions\Organization;

use App\Actions\Organization\AutoAssignSectionScheduleReferences;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\CapacitySource;
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

final class AutoAssignSectionScheduleReferencesTest extends TestCase
{
    use RefreshDatabase;

    private function makeTerm(): AcademicTerm
    {
        return AcademicTerm::create(['school_year' => '2026-2027', 'semester' => '1st', 'status' => AcademicTermStatus::SemesterOngoing]);
    }

    private function makeCurriculum(): Curriculum
    {
        $program = Program::create(['code' => 'BSIT', 'name' => 'BS IT', 'status' => ProgramStatus::Active, 'college' => CollegeCode::Ccs]);

        return Curriculum::create([
            'program_id' => $program->id, 'name' => 'BSIT Curriculum',
            'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Active,
        ]);
    }

    private function makePlacement(Curriculum $curriculum, string $code, array $reference): CurriculumSubject
    {
        $subject = Subject::create(['code' => $code, 'college' => CollegeCode::Ccs, 'title' => "{$code} Title", 'units' => 3, 'status' => SubjectStatus::Active]);

        return CurriculumSubject::create(array_merge([
            'curriculum_id' => $curriculum->id, 'subject_id' => $subject->id,
            'year_level' => 1, 'semester' => '1st', 'is_required' => true,
        ], $reference));
    }

    private function makeSection(AcademicTerm $term, AcademicTermSectionPlan $plan, int $subjectId, array $overrides = []): Section
    {
        return Section::create(array_merge([
            'academic_term_id' => $term->id, 'section_plan_id' => $plan->id, 'subject_id' => $subjectId,
            'section_code' => 'IT101', 'capacity' => 40, 'capacity_source' => CapacitySource::Plan,
            'is_block_exclusive' => true, 'status' => SectionStatus::Planned,
        ], $overrides));
    }

    public function test_it_fills_null_fields_from_the_matching_reference_and_creates_a_faculty_account(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $placement = $this->makePlacement($curriculum, 'ITC', [
            'reference_day' => 'Tue', 'reference_start_time' => '07:30:00', 'reference_end_time' => '09:30:00',
            'reference_room' => 'ONLINE', 'reference_modality' => 'online', 'reference_professor_name' => 'MR. MACINAS',
        ]);
        $plan = AcademicTermSectionPlan::create(['academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id, 'college' => 'ccs', 'year_level' => 1, 'section_count' => 1, 'students_per_block' => 40, 'status' => SectionPlanStatus::Draft]);
        $section = $this->makeSection($term, $plan, $placement->subject_id);

        app(AutoAssignSectionScheduleReferences::class)->execute($term, $curriculum->id);

        $section->refresh();
        $this->assertSame('Tue', $section->schedule_days);
        $this->assertSame('07:30:00', $section->starts_at_time);
        $this->assertSame('09:30:00', $section->ends_at_time);
        $this->assertSame('ONLINE', $section->room);
        // NOTE: Section::modality is cast to the SectionModality backed enum, so
        // comparing it directly to the string 'online' would fail assertSame's
        // strict === check. Compare against the enum case instead.
        $this->assertSame(SectionModality::Online, $section->modality);
        $professor = User::where('name', 'MR. MACINAS')->where('role', UserRole::Faculty)->sole();
        $this->assertSame($professor->id, $section->professor_id);
    }

    public function test_it_never_overwrites_a_field_already_set(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $placement = $this->makePlacement($curriculum, 'ITC', [
            'reference_day' => 'Tue', 'reference_room' => 'ONLINE', 'reference_professor_name' => 'MR. MACINAS',
        ]);
        $existingProfessor = User::create(['name' => 'Existing Prof', 'email' => 'existing@grc.test', 'password' => 'x', 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $plan = AcademicTermSectionPlan::create(['academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id, 'college' => 'ccs', 'year_level' => 1, 'section_count' => 1, 'students_per_block' => 40, 'status' => SectionPlanStatus::Draft]);
        $section = $this->makeSection($term, $plan, $placement->subject_id, [
            'schedule_days' => 'Wed', 'room' => 'LAB-9', 'professor_id' => $existingProfessor->id,
        ]);

        app(AutoAssignSectionScheduleReferences::class)->execute($term, $curriculum->id);

        $section->refresh();
        $this->assertSame('Wed', $section->schedule_days);
        $this->assertSame('LAB-9', $section->room);
        $this->assertSame($existingProfessor->id, $section->professor_id);
    }

    public function test_a_subject_with_no_reference_professor_name_stays_unassigned(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $placement = $this->makePlacement($curriculum, 'MATHWRLD', ['reference_day' => 'Fri']);
        $plan = AcademicTermSectionPlan::create(['academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id, 'college' => 'ccs', 'year_level' => 1, 'section_count' => 1, 'students_per_block' => 40, 'status' => SectionPlanStatus::Draft]);
        $section = $this->makeSection($term, $plan, $placement->subject_id);

        app(AutoAssignSectionScheduleReferences::class)->execute($term, $curriculum->id);

        $section->refresh();
        $this->assertSame('Fri', $section->schedule_days);
        $this->assertNull($section->professor_id);
    }

    public function test_it_can_be_scoped_to_a_single_year_level(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = Subject::create(['code' => 'CS101', 'college' => CollegeCode::Ccs, 'title' => 'CS101', 'units' => 3, 'status' => SubjectStatus::Active]);
        CurriculumSubject::create(['curriculum_id' => $curriculum->id, 'subject_id' => $subject->id, 'year_level' => 2, 'semester' => '1st', 'is_required' => true, 'reference_day' => 'Thu']);
        $plan = AcademicTermSectionPlan::create(['academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id, 'college' => 'ccs', 'year_level' => 2, 'section_count' => 1, 'students_per_block' => 40, 'status' => SectionPlanStatus::Draft]);
        $section = $this->makeSection($term, $plan, $subject->id, ['section_code' => 'IT201']);

        app(AutoAssignSectionScheduleReferences::class)->execute($term, $curriculum->id, 1);

        $this->assertNull($section->refresh()->schedule_days);
    }

    /**
     * Regression coverage for the real-data bug found before this Action shipped:
     * the seeded reference_modality values are uppercase/spaced (e.g. 'HYFLEX A',
     * from `curriculum-2024-2029-schedule-references.csv`), not the enum's
     * lowercase/underscored backing values. Without normalizing, assigning
     * 'HYFLEX A' straight to the enum-cast `modality` attribute throws a
     * ValueError at runtime.
     */
    public function test_it_normalizes_a_real_shaped_reference_modality_value(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $placement = $this->makePlacement($curriculum, 'ITELECT', ['reference_modality' => 'HYFLEX A']);
        $plan = AcademicTermSectionPlan::create(['academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id, 'college' => 'ccs', 'year_level' => 1, 'section_count' => 1, 'students_per_block' => 40, 'status' => SectionPlanStatus::Draft]);
        $section = $this->makeSection($term, $plan, $placement->subject_id);

        app(AutoAssignSectionScheduleReferences::class)->execute($term, $curriculum->id);

        $this->assertSame(SectionModality::HyflexA, $section->refresh()->modality);
    }

    /**
     * If a future reference_modality value doesn't normalize to a valid
     * SectionModality backing value, the Action must never invent/guess one —
     * it should leave the field null rather than crash or fabricate data.
     */
    public function test_an_unrecognized_reference_modality_value_is_left_null(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $placement = $this->makePlacement($curriculum, 'ITNET', ['reference_modality' => 'SOMETHING UNEXPECTED']);
        $plan = AcademicTermSectionPlan::create(['academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id, 'college' => 'ccs', 'year_level' => 1, 'section_count' => 1, 'students_per_block' => 40, 'status' => SectionPlanStatus::Draft]);
        $section = $this->makeSection($term, $plan, $placement->subject_id);

        app(AutoAssignSectionScheduleReferences::class)->execute($term, $curriculum->id);

        $this->assertNull($section->refresh()->modality);
    }
}
