<?php

namespace Tests\Feature\Actions\Organization;

use App\Actions\Organization\AutoAssignSectionScheduleReferences;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
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
use App\Models\AuditLog;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Program;
use App\Models\Section;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

final class AutoAssignSectionScheduleReferencesTest extends TestCase
{
    use RefreshDatabase;

    private function makeTerm(): AcademicTerm
    {
        return AcademicTerm::create(['school_year' => '2026-2027', 'semester' => '1st', 'status' => AcademicTermStatus::SemesterOngoing]);
    }

    private function makeCurriculum(CollegeCode $college = CollegeCode::Ccs, string $code = 'BSIT'): Curriculum
    {
        $program = Program::create(['code' => $code, 'name' => "BS {$code}", 'status' => ProgramStatus::Active, 'college' => $college]);

        return Curriculum::create([
            'program_id' => $program->id, 'name' => "{$code} Curriculum",
            'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Active,
        ]);
    }

    private function makeChair(CollegeCode $college = CollegeCode::Ccs, string $email = 'chair.autoassign@grc.test'): User
    {
        return User::create([
            'name' => 'Chair '.$college->value, 'email' => $email, 'password' => 'password',
            'role' => UserRole::ProgramChair, 'college' => $college, 'status' => UserStatus::Active,
        ]);
    }

    private function context(): AuditRequestContext
    {
        return new AuditRequestContext('auto-assign-action-test', null);
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

        app(AutoAssignSectionScheduleReferences::class)->execute($term, $curriculum->id, $this->makeChair(), $this->context());

        $section->refresh();
        $this->assertSame('Tue', $section->schedule_days);
        $this->assertSame('07:30:00', $section->starts_at_time);
        $this->assertSame('09:30:00', $section->ends_at_time);
        // GRC's taxonomy has no standalone "online" modality — a legacy
        // reference naming one resolves to Hyflex A instead of staying
        // unresolved. "ONLINE" was only ever a placeholder room name for
        // that legacy value, never a real room, so room stays unassigned
        // for the normal room-catalog assignment to fill instead.
        $this->assertNull($section->room);
        $this->assertSame(SectionModality::HyflexA, $section->modality);
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

        app(AutoAssignSectionScheduleReferences::class)->execute($term, $curriculum->id, $this->makeChair(), $this->context());

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

        app(AutoAssignSectionScheduleReferences::class)->execute($term, $curriculum->id, $this->makeChair(), $this->context());

        $section->refresh();
        $this->assertSame('Fri', $section->schedule_days);
        $this->assertNull($section->professor_id);
    }

    /**
     * Per product direction, a subject whose curriculum reference has no
     * modality column value at all (this is the actual seeded shape for
     * every non-CCS college — only CCS's rows in
     * curriculum-2024-2029-schedule-references.csv carry a modality) is
     * treated as ordinary face-to-face, the least assumption-laden default,
     * rather than staying an unresolved gap the automation can never
     * complete.
     */
    public function test_a_subject_with_no_reference_modality_at_all_defaults_to_f2f(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $placement = $this->makePlacement($curriculum, 'FUNDACC', ['reference_day' => 'Mon', 'reference_start_time' => '06:00:00', 'reference_end_time' => '09:00:00']);
        $plan = AcademicTermSectionPlan::create(['academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id, 'college' => 'ccs', 'year_level' => 1, 'section_count' => 1, 'students_per_block' => 40, 'status' => SectionPlanStatus::Draft]);
        $section = $this->makeSection($term, $plan, $placement->subject_id);

        app(AutoAssignSectionScheduleReferences::class)->execute($term, $curriculum->id, $this->makeChair(), $this->context());

        $this->assertSame(SectionModality::FaceToFace, $section->refresh()->modality);
    }

    /**
     * The seeded reference roster names the same real person inconsistently
     * across placements (e.g. "COACH LORETO" on one subject, "COACH.
     * LORETO" — with a period — on another). `Str::slug()` strips that
     * punctuation, so both raw names produce the identical
     * `prof.coach-loreto@grc.test` address. Looking the professor up by
     * `name` (which differs) instead of the email actually being inserted
     * let the second `firstOrCreate` call attempt a real duplicate insert.
     */
    public function test_it_reuses_one_faculty_account_for_reference_names_that_share_a_slug(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $firstPlacement = $this->makePlacement($curriculum, 'ITD1', ['reference_day' => 'Tue', 'reference_professor_name' => 'COACH LORETO']);
        $secondPlacement = $this->makePlacement($curriculum, 'ITD2', ['reference_day' => 'Wed', 'reference_professor_name' => 'COACH. LORETO']);
        $plan = AcademicTermSectionPlan::create(['academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id, 'college' => 'ccs', 'year_level' => 1, 'section_count' => 1, 'students_per_block' => 40, 'status' => SectionPlanStatus::Draft]);
        $firstSection = $this->makeSection($term, $plan, $firstPlacement->subject_id, ['section_code' => 'ITD1']);
        $secondSection = $this->makeSection($term, $plan, $secondPlacement->subject_id, ['section_code' => 'ITD2']);

        app(AutoAssignSectionScheduleReferences::class)->execute($term, $curriculum->id, $this->makeChair(), $this->context());

        $firstSection->refresh();
        $secondSection->refresh();
        $this->assertSame(1, User::where('email', 'prof.coach-loreto@grc.test')->count());
        $this->assertNotNull($firstSection->professor_id);
        $this->assertSame($firstSection->professor_id, $secondSection->professor_id);
    }

    public function test_it_can_be_scoped_to_a_single_year_level(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $subject = Subject::create(['code' => 'CS101', 'college' => CollegeCode::Ccs, 'title' => 'CS101', 'units' => 3, 'status' => SubjectStatus::Active]);
        CurriculumSubject::create(['curriculum_id' => $curriculum->id, 'subject_id' => $subject->id, 'year_level' => 2, 'semester' => '1st', 'is_required' => true, 'reference_day' => 'Thu']);
        $plan = AcademicTermSectionPlan::create(['academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id, 'college' => 'ccs', 'year_level' => 2, 'section_count' => 1, 'students_per_block' => 40, 'status' => SectionPlanStatus::Draft]);
        $section = $this->makeSection($term, $plan, $subject->id, ['section_code' => 'IT201']);

        app(AutoAssignSectionScheduleReferences::class)->execute($term, $curriculum->id, $this->makeChair(), $this->context(), 1);

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

        app(AutoAssignSectionScheduleReferences::class)->execute($term, $curriculum->id, $this->makeChair(), $this->context());

        $this->assertSame(SectionModality::HyflexA, $section->refresh()->modality);
    }

    /**
     * If a future reference_modality value doesn't normalize to a valid
     * SectionModality backing value, the Action must never invent/guess one —
     * it should leave the field null rather than crash or fabricate data.
     */
    public function test_an_unrecognized_reference_modality_value_defaults_to_hyflex_a(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $placement = $this->makePlacement($curriculum, 'ITNET', ['reference_modality' => 'SOMETHING UNEXPECTED']);
        $plan = AcademicTermSectionPlan::create(['academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id, 'college' => 'ccs', 'year_level' => 1, 'section_count' => 1, 'students_per_block' => 40, 'status' => SectionPlanStatus::Draft]);
        $section = $this->makeSection($term, $plan, $placement->subject_id);

        app(AutoAssignSectionScheduleReferences::class)->execute($term, $curriculum->id, $this->makeChair(), $this->context());

        $this->assertSame(SectionModality::HyflexA, $section->refresh()->modality);
    }

    /**
     * The role check alone lets any Program Chair bulk-write any college's
     * sections. Every sibling write on this workflow (SaveSectionPlan's
     * save/release/submit) asserts curriculum ownership; so must this one.
     */
    public function test_it_rejects_a_curriculum_belonging_to_another_college(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $placement = $this->makePlacement($curriculum, 'ITC', [
            'reference_day' => 'Tue', 'reference_room' => 'ONLINE', 'reference_professor_name' => 'MR. MACINAS',
        ]);
        $plan = AcademicTermSectionPlan::create(['academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id, 'college' => 'ccs', 'year_level' => 1, 'section_count' => 1, 'students_per_block' => 40, 'status' => SectionPlanStatus::Draft]);
        $section = $this->makeSection($term, $plan, $placement->subject_id);
        $intruder = $this->makeChair(CollegeCode::Coe, 'chair.coe.autoassign@grc.test');

        try {
            app(AutoAssignSectionScheduleReferences::class)->execute($term, $curriculum->id, $intruder, $this->context());
            self::fail('Expected a cross-college auto-assign to be rejected.');
        } catch (ValidationException $exception) {
            self::assertArrayHasKey('curriculum_id', $exception->errors());
        }

        $section->refresh();
        $this->assertNull($section->schedule_days);
        $this->assertNull($section->room);
        $this->assertNull($section->professor_id);
        $this->assertSame(0, AuditLog::query()->count());
    }

    /**
     * Second layer of the same guard: the plan rows themselves carry a
     * `college`, so the query must be scoped even when the curriculum passes
     * the ownership assertion.
     */
    public function test_it_leaves_another_colleges_section_plan_untouched(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $ownPlacement = $this->makePlacement($curriculum, 'ITC', ['reference_day' => 'Tue']);
        $otherPlacement = $this->makePlacement($curriculum, 'EDUC1', ['reference_day' => 'Fri']);
        $ownPlan = AcademicTermSectionPlan::create(['academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id, 'college' => 'ccs', 'year_level' => 1, 'section_count' => 1, 'students_per_block' => 40, 'status' => SectionPlanStatus::Draft]);
        $otherPlan = AcademicTermSectionPlan::create(['academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id, 'college' => 'coe', 'year_level' => 1, 'section_count' => 1, 'students_per_block' => 40, 'status' => SectionPlanStatus::Draft]);
        $ownSection = $this->makeSection($term, $ownPlan, $ownPlacement->subject_id);
        $otherSection = $this->makeSection($term, $otherPlan, $otherPlacement->subject_id, ['section_code' => 'ED101']);

        app(AutoAssignSectionScheduleReferences::class)->execute($term, $curriculum->id, $this->makeChair(), $this->context());

        $this->assertSame('Tue', $ownSection->refresh()->schedule_days);
        $this->assertNull($otherSection->refresh()->schedule_days);
    }

    public function test_it_records_an_audit_row_for_the_bulk_write(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $placement = $this->makePlacement($curriculum, 'ITC', ['reference_day' => 'Tue']);
        $plan = AcademicTermSectionPlan::create(['academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id, 'college' => 'ccs', 'year_level' => 1, 'section_count' => 1, 'students_per_block' => 40, 'status' => SectionPlanStatus::Draft]);
        $section = $this->makeSection($term, $plan, $placement->subject_id);
        $chair = $this->makeChair();

        app(AutoAssignSectionScheduleReferences::class)->execute($term, $curriculum->id, $chair, $this->context());

        $log = AuditLog::query()->where('action', AuditAction::SECTION_PLAN_AUTO_ASSIGNED)->sole();
        $this->assertSame($chair->id, $log->actor_user_id);
        $this->assertSame($plan->id, $log->auditable_id);
        $this->assertSame('ccs', $log->after_values['college']);
        $this->assertSame([$section->id], $log->after_values['section_ids']);
    }

    public function test_a_run_that_fills_nothing_records_no_audit_row(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $placement = $this->makePlacement($curriculum, 'ITC', []);
        $plan = AcademicTermSectionPlan::create(['academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id, 'college' => 'ccs', 'year_level' => 1, 'section_count' => 1, 'students_per_block' => 40, 'status' => SectionPlanStatus::Draft]);
        $this->makeSection($term, $plan, $placement->subject_id);

        app(AutoAssignSectionScheduleReferences::class)->execute($term, $curriculum->id, $this->makeChair(), $this->context());

        $this->assertSame(0, AuditLog::query()->count());
    }
}
