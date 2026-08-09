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
