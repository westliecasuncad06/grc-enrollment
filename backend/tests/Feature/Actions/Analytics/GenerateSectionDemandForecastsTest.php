<?php

namespace Tests\Feature\Actions\Analytics;

use App\Actions\Analytics\GenerateSectionDemandForecasts;
use App\Domain\Analytics\PredictionRunStatus;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\CollegeCode;
use App\Domain\Organization\ProgramStatus;
use App\Domain\Scheduling\ScheduleGenerationStatus;
use App\Models\AcademicTerm;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Program;
use App\Models\ScheduleGenerationRun;
use App\Models\SectionDemandObservation;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

final class GenerateSectionDemandForecastsTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_uses_the_cohort_history_and_persists_an_advisory_forecast(): void
    {
        $targetTerm = AcademicTerm::create(['school_year' => '2027-2028', 'semester' => '2nd', 'status' => AcademicTermStatus::SemesterOngoing]);
        $historyTerm = AcademicTerm::create(['school_year' => '2027-2028', 'semester' => '1st', 'status' => AcademicTermStatus::SemesterOngoing]);
        $program = Program::create(['code' => 'BSIT', 'name' => 'BS IT', 'status' => ProgramStatus::Active, 'college' => CollegeCode::Ccs]);
        $curriculum = Curriculum::create(['program_id' => $program->id, 'name' => 'BSIT Curriculum', 'effective_school_year' => '2024-2025', 'status' => CurriculumStatus::Active]);
        $subject = Subject::create(['code' => 'IT301', 'college' => CollegeCode::Ccs, 'title' => 'Systems Analysis', 'units' => 3, 'status' => 'active']);
        CurriculumSubject::create(['curriculum_id' => $curriculum->id, 'subject_id' => $subject->id, 'year_level' => 3, 'semester' => '2nd', 'is_required' => true]);
        SectionDemandObservation::create(['academic_term_id' => $historyTerm->id, 'program_id' => $program->id, 'curriculum_id' => $curriculum->id, 'subject_id' => $subject->id, 'college' => CollegeCode::Ccs, 'year_level' => 3, 'cohort_size' => 45, 'enrolled_count' => 42, 'section_count' => 2, 'offered_capacity' => 80, 'source' => 'local_seed']);
        $chair = User::create(['name' => 'Chair', 'email' => 'chair.forecast@grc.test', 'password' => 'password', 'role' => UserRole::ProgramChair, 'college' => CollegeCode::Ccs, 'status' => UserStatus::Active]);
        $run = ScheduleGenerationRun::create(['academic_term_id' => $targetTerm->id, 'college' => 'ccs', 'initiated_by' => $chair->id, 'status' => ScheduleGenerationStatus::Queued]);

        Http::fake([
            'http://127.0.0.1:8100/internal/v1/section-demand/predict' => Http::response(['data' => [
                'feature_schema_version' => 'v1',
                'model_version' => 'section-demand-rf-v1',
                'forecasts' => [[
                    'target_key' => "{$curriculum->id}:{$subject->id}:3",
                    'predicted_demand' => 48.0,
                    'confidence_lower' => 40.0,
                    'confidence_upper' => 54.0,
                    'suggested_section_count' => 2,
                    'strategy' => 'historical_baseline',
                ]],
            ]]),
        ]);

        app(GenerateSectionDemandForecasts::class)->execute($run);

        $run->refresh();
        $this->assertSame(ScheduleGenerationStatus::Succeeded, $run->status);
        $this->assertNotNull($run->prediction_run_id);
        $this->assertDatabaseHas('section_demand_forecasts', ['prediction_run_id' => $run->prediction_run_id, 'academic_term_id' => $targetTerm->id, 'subject_id' => $subject->id, 'suggested_section_count' => 2]);
        $this->assertSame(PredictionRunStatus::Succeeded, $run->predictionRun->status);
        Http::assertSent(fn ($request) => str_contains($request->body(), '"enrolled_count":42'));
    }
}
