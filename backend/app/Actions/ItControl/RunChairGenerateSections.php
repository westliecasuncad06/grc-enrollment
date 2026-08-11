<?php

namespace App\Actions\ItControl;

use App\Actions\Analytics\GenerateSectionDemandForecasts;
use App\Actions\Organization\SaveSectionPlan;
use App\Domain\Identity\UserRole;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\CollegeCode;
use App\Domain\Scheduling\ScheduleGenerationStatus;
use App\Models\AcademicTermSectionPlan;
use App\Models\ItControlAutomationRun;
use App\Models\ScheduleGenerationRun;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Throwable;

final class RunChairGenerateSections
{
    use ManagesAutomationRun;

    public function __construct(
        private readonly GenerateSectionDemandForecasts $generateForecasts,
        private readonly SaveSectionPlan $saveSectionPlan,
    ) {}

    public function execute(ItControlAutomationRun $run): void
    {
        try {
            Http::baseUrl((string) config('services.prediction.base_url'))
                ->acceptJson()
                ->timeout((int) config('services.prediction.timeout'))
                ->get('/internal/v1/health')
                ->throw();
        } catch (Throwable) {
            throw new RuntimeException('Prediction service is unavailable.');
        }

        $term = $run->academicTerm()->firstOrFail();
        if ($term->status !== AcademicTermStatus::SemesterOngoing) {
            throw new RuntimeException('No open term is available for section generation.');
        }

        foreach (CollegeCode::cases() as $college) {
            $chair = $this->actor(UserRole::ProgramChair, $college);
            $generationRun = ScheduleGenerationRun::create([
                'academic_term_id' => $term->id,
                'college' => $college->value,
                'initiated_by' => $chair->id,
                'status' => ScheduleGenerationStatus::Queued,
            ]);
            $this->generateForecasts->execute($generationRun);
            $generationRun->refresh();
            $this->advisoryWarnings($run, $generationRun->warnings ?? []);

            if ($generationRun->status === ScheduleGenerationStatus::Failed) {
                throw new RuntimeException('Prediction service is unavailable.');
            }

            $curriculumIds = AcademicTermSectionPlan::query()
                ->where('academic_term_id', $term->id)
                ->where('college', $college->value)
                ->pluck('curriculum_id')
                ->unique();
            if ($curriculumIds->isEmpty()) {
                $this->warning($run, "{$college->label()} produced no section plans.");

                continue;
            }

            foreach ($curriculumIds as $curriculumId) {
                try {
                    $this->saveSectionPlan->submit($term, $curriculumId, $chair, $this->context($run));
                    $this->processed($run);
                } catch (Throwable $exception) {
                    $this->warning($run, "{$college->label()} curriculum {$curriculumId}: {$exception->getMessage()}");
                }
            }
        }
    }
}
