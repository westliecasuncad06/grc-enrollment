<?php

namespace Tests\Feature\Api\V1;

use App\Actions\Scheduling\GenerateFacultyAssignmentRecommendations;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Faculty\SpecializationProficiency;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\CapacitySource;
use App\Domain\Organization\CollegeCode;
use App\Domain\Organization\ProgramStatus;
use App\Domain\Organization\SectionPlanStatus;
use App\Domain\Scheduling\ScheduleGenerationStatus;
use App\Domain\Scheduling\SectionModality;
use App\Domain\Scheduling\SectionStatus;
use App\Http\Resources\Api\V1\FacultyAssignmentRecommendationResource;
use App\Models\AcademicTerm;
use App\Models\AcademicTermSectionPlan;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\FacultyAssignmentRecommendation;
use App\Models\FacultyAvailability;
use App\Models\FacultyCurriculumSubjectPreference;
use App\Models\FacultySpecialization;
use App\Models\Program;
use App\Models\ScheduleGenerationRun;
use App\Models\Section;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

final class FacultyAssignmentRecommendationsEndpointTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_primary_specialization_outranks_a_bare_preference(): void
    {
        [$section, $run, $barePreferenceProfessor, $primarySpecialist] = $this->recommendationContext();

        app(GenerateFacultyAssignmentRecommendations::class)->execute($run);

        $recommendation = FacultyAssignmentRecommendation::query()
            ->where('schedule_generation_run_id', $run->id)
            ->where('section_id', $section->id)
            ->sole();

        self::assertSame($primarySpecialist->id, $recommendation->recommended_professor_id);
        self::assertSame(SpecializationProficiency::Primary, $recommendation->specialization_match);
        self::assertSame('primary', (new FacultyAssignmentRecommendationResource($recommendation))
            ->resolve(Request::create('/'))['specialization_match']);
        self::assertNotSame($barePreferenceProfessor->id, $recommendation->recommended_professor_id);
    }

    /**
     * When no active faculty member in the section's college has declared
     * any preference for its subject, `$candidates` stays empty and the
     * planner recommends `professor_id: null` — proving `$selected` (looked
     * up from that empty list) can legitimately be `null` on a real,
     * unremarkable roster, not just a contrived edge case.
     */
    public function test_a_section_with_no_qualifying_candidate_is_recorded_without_a_recommendation(): void
    {
        $term = AcademicTerm::create([
            'school_year' => '2027-2028',
            'semester' => '1st',
            'status' => AcademicTermStatus::SemesterOngoing,
        ]);
        $program = Program::create([
            'code' => 'BSIT', 'name' => 'Bachelor of Science in Information Technology',
            'college' => CollegeCode::Ccs, 'status' => ProgramStatus::Active,
        ]);
        $curriculum = Curriculum::create([
            'program_id' => $program->id, 'name' => 'BSIT Curriculum',
            'effective_school_year' => '2024-2025', 'status' => CurriculumStatus::Active,
        ]);
        $subject = Subject::create([
            'code' => 'IT202', 'college' => CollegeCode::Ccs, 'title' => 'Algorithms',
            'units' => 3, 'status' => 'active',
        ]);
        CurriculumSubject::create([
            'curriculum_id' => $curriculum->id, 'subject_id' => $subject->id,
            'year_level' => 2, 'semester' => '1st', 'is_required' => true,
        ]);
        $chair = $this->faculty('chair.unqualified@grc.test', UserRole::ProgramChair);
        // An active CCS faculty member exists but has declared no preference
        // for IT202 at all — the exact shape that leaves $candidates empty.
        $this->faculty('uninterested@grc.test');
        $plan = AcademicTermSectionPlan::create([
            'academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id,
            'college' => CollegeCode::Ccs, 'year_level' => 2, 'section_count' => 1,
            'students_per_block' => 40, 'status' => SectionPlanStatus::Draft,
        ]);
        $section = Section::create([
            'academic_term_id' => $term->id, 'section_plan_id' => $plan->id, 'subject_id' => $subject->id,
            'section_code' => 'IT202-A', 'schedule_days' => 'M', 'starts_at_time' => '08:00:00',
            'ends_at_time' => '11:00:00', 'capacity' => 40, 'capacity_source' => CapacitySource::Plan,
            'status' => SectionStatus::Planned,
        ]);
        $run = ScheduleGenerationRun::create([
            'academic_term_id' => $term->id, 'college' => CollegeCode::Ccs,
            'initiated_by' => $chair->id, 'status' => ScheduleGenerationStatus::Succeeded,
        ]);

        $warnings = app(GenerateFacultyAssignmentRecommendations::class)->execute($run);

        $recommendation = FacultyAssignmentRecommendation::query()
            ->where('schedule_generation_run_id', $run->id)
            ->where('section_id', $section->id)
            ->sole();
        self::assertNull($recommendation->recommended_professor_id);
        self::assertNull($recommendation->specialization_match);
        self::assertContains("No available preferred faculty could be recommended for section {$section->id}.", $warnings);
    }

    /**
     * GRC's schedule taxonomy only has three modalities (F2F, Hyflex A,
     * Hyflex B) — a legacy "ONLINE" curriculum reference (from before the
     * current Hyflex split) has no direct equivalent, so filling a
     * section's schedule from it should resolve to Hyflex A rather than
     * leaving the field unresolved, and should not copy "ONLINE" itself in
     * as if it were a real room name.
     */
    public function test_a_legacy_online_reference_resolves_to_hyflex_a_without_a_placeholder_room(): void
    {
        [$section, $run] = $this->recommendationContext();
        $subject = $section->subject;
        CurriculumSubject::query()
            ->where('subject_id', $subject->id)
            ->update(['reference_room' => 'ONLINE', 'reference_modality' => 'ONLINE']);

        app(GenerateFacultyAssignmentRecommendations::class)->execute($run);

        $section->refresh();
        self::assertSame(SectionModality::HyflexA, $section->modality);
        self::assertNull($section->room);
    }

    /**
     * Per product direction, a real day/time reference with no modality
     * value at all — the actual seeded shape for every non-CCS college's
     * rows in curriculum-2024-2029-schedule-references.csv, which only
     * CCS's rows carry a modality for — defaults to ordinary face-to-face
     * rather than staying an unresolved gap.
     */
    public function test_a_reference_with_no_modality_value_at_all_defaults_to_f2f(): void
    {
        [$section, $run] = $this->recommendationContext();
        CurriculumSubject::query()
            ->where('subject_id', $section->subject_id)
            ->update(['reference_day' => 'M']);

        app(GenerateFacultyAssignmentRecommendations::class)->execute($run);

        self::assertSame(SectionModality::FaceToFace, $section->refresh()->modality);
    }

    /**
     * A small number of placements have a real reference_day but no
     * recorded start/end time at all — genuinely missing source data. Per
     * product direction, this defaults to the most common real time block
     * already present in the seeded roster (07:30-10:30) rather than
     * staying unresolved.
     */
    public function test_a_reference_with_no_time_value_at_all_defaults_to_the_common_morning_block(): void
    {
        [$section, $run] = $this->recommendationContext();
        $section->update(['starts_at_time' => null, 'ends_at_time' => null]);
        CurriculumSubject::query()
            ->where('subject_id', $section->subject_id)
            ->update(['reference_day' => 'M']);

        app(GenerateFacultyAssignmentRecommendations::class)->execute($run);

        $section->refresh();
        self::assertSame('07:30:00', $section->starts_at_time);
        self::assertSame('10:30:00', $section->ends_at_time);
    }

    /** @return array{Section, ScheduleGenerationRun, User, User} */
    private function recommendationContext(): array
    {
        $term = AcademicTerm::create([
            'school_year' => '2027-2028',
            'semester' => '1st',
            'status' => AcademicTermStatus::SemesterOngoing,
        ]);
        $program = Program::create([
            'code' => 'BSIT',
            'name' => 'Bachelor of Science in Information Technology',
            'college' => CollegeCode::Ccs,
            'status' => ProgramStatus::Active,
        ]);
        $curriculum = Curriculum::create([
            'program_id' => $program->id,
            'name' => 'BSIT Curriculum',
            'effective_school_year' => '2024-2025',
            'status' => CurriculumStatus::Active,
        ]);
        $subject = Subject::create([
            'code' => 'IT201',
            'college' => CollegeCode::Ccs,
            'title' => 'Data Structures',
            'units' => 3,
            'status' => 'active',
        ]);
        CurriculumSubject::create([
            'curriculum_id' => $curriculum->id,
            'subject_id' => $subject->id,
            'year_level' => 2,
            'semester' => '1st',
            'is_required' => true,
        ]);
        $chair = $this->faculty('chair.recommendations@grc.test', UserRole::ProgramChair);
        $barePreferenceProfessor = $this->faculty('bare.preference@grc.test');
        $primarySpecialist = $this->faculty('primary.specialist@grc.test');
        $plan = AcademicTermSectionPlan::create([
            'academic_term_id' => $term->id,
            'curriculum_id' => $curriculum->id,
            'college' => CollegeCode::Ccs,
            'year_level' => 2,
            'section_count' => 1,
            'students_per_block' => 40,
            'status' => SectionPlanStatus::Draft,
        ]);
        $section = Section::create([
            'academic_term_id' => $term->id,
            'section_plan_id' => $plan->id,
            'subject_id' => $subject->id,
            'section_code' => 'IT201-A',
            'schedule_days' => 'M',
            'starts_at_time' => '08:00:00',
            'ends_at_time' => '11:00:00',
            'capacity' => 40,
            'capacity_source' => CapacitySource::Plan,
            'status' => SectionStatus::Planned,
        ]);
        $run = ScheduleGenerationRun::create([
            'academic_term_id' => $term->id,
            'college' => CollegeCode::Ccs,
            'initiated_by' => $chair->id,
            'status' => ScheduleGenerationStatus::Succeeded,
        ]);

        foreach ([$barePreferenceProfessor, $primarySpecialist] as $professor) {
            FacultyAvailability::create([
                'professor_id' => $professor->id,
                'day_of_week' => 1,
                'starts_at_time' => '08:00:00',
                'ends_at_time' => '17:00:00',
                'origin' => 'declared',
            ]);
        }
        FacultyCurriculumSubjectPreference::create([
            'professor_id' => $barePreferenceProfessor->id,
            'curriculum_id' => $curriculum->id,
            'subject_id' => $subject->id,
            'semester' => '1st',
            'rank' => 1,
            'origin' => 'declared',
        ]);
        FacultyCurriculumSubjectPreference::create([
            'professor_id' => $primarySpecialist->id,
            'curriculum_id' => $curriculum->id,
            'subject_id' => $subject->id,
            'semester' => '1st',
            'rank' => 3,
            'origin' => 'declared',
        ]);
        FacultySpecialization::create([
            'professor_id' => $primarySpecialist->id,
            'subject_id' => $subject->id,
            'proficiency' => SpecializationProficiency::Primary,
            'source' => 'declared',
        ]);

        return [$section, $run, $barePreferenceProfessor, $primarySpecialist];
    }

    private function faculty(string $email, UserRole $role = UserRole::Faculty): User
    {
        return User::create([
            'name' => 'Recommendation Test User',
            'email' => $email,
            'password' => 'correct-horse-battery-staple',
            'role' => $role,
            'college' => CollegeCode::Ccs,
            'status' => UserStatus::Active,
        ]);
    }
}
