<?php

namespace App\Actions\ItControl;

use App\Actions\Analytics\GenerateSectionDemandForecasts;
use App\Actions\Organization\AutoAssignSectionScheduleReferences;
use App\Actions\Organization\SaveSectionPlan;
use App\Actions\Scheduling\GenerateFacultyAssignmentRecommendations;
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

final class RunChairGenerateSections implements RunsItControlAutomationStep
{
    use ManagesAutomationRun;

    public function __construct(
        private readonly GenerateSectionDemandForecasts $generateForecasts,
        private readonly AutoAssignSectionScheduleReferences $autoAssignSchedule,
        private readonly GenerateFacultyAssignmentRecommendations $facultyRecommendations,
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

        // A freshly created term is always `draft` (`ArchiveAndCreateNextTerm`),
        // and `open_enrollment` itself requires an already-published schedule
        // for that same term — so generation must be allowed to run before
        // enrollment opens, or a new term could never produce its first
        // schedule. Only a term that has already finished its cycle
        // (`semester_closed`/`archived`) is rejected.
        $generableStatuses = [
            AcademicTermStatus::Draft,
            AcademicTermStatus::ForDeanApproval,
            AcademicTermStatus::SemesterOngoing,
        ];
        if (! in_array($term->status, $generableStatuses, true)) {
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
            $this->advisoryWarnings($run, array_map(fn (array $w): string => $w['message'], $generationRun->warnings ?? []));

            if ($generationRun->status === ScheduleGenerationStatus::Failed) {
                throw new RuntimeException('Prediction service is unavailable.');
            }

            // Freshly drafted sections carry no day/time/room/professor —
            // that normally waits on a Program Chair's manual review.
            // Unattended automation instead fills whatever the curriculum's
            // seeded schedule reference already answers (day/time/room, and
            // a professor when the reference names one), the same one-click
            // action a Chair would use, before asking the recommender again
            // now that a real day/time exists to check availability against.
            AcademicTermSectionPlan::query()
                ->where('academic_term_id', $term->id)
                ->where('college', $college->value)
                ->select(['curriculum_id'])
                ->distinct()
                ->pluck('curriculum_id')
                ->each(function (int $curriculumId) use ($term, $chair, $run, $college): void {
                    try {
                        $this->autoAssignSchedule->execute($term, $curriculumId, $chair, $this->context($run));
                    } catch (Throwable $exception) {
                        $this->warning($run, "{$college->label()} curriculum {$curriculumId}: {$exception->getMessage()}");
                    }
                });
            $this->advisoryWarnings($run, array_map(fn (array $w): string => $w['message'], $this->facultyRecommendations->execute($generationRun)));

            $hasSectionPlans = false;
            $submittedCurricula = [];
            AcademicTermSectionPlan::query()
                ->where('academic_term_id', $term->id)
                ->where('college', $college->value)
                ->select(['id', 'curriculum_id'])
                ->orderBy('id')
                ->chunkById(200, function ($plans) use (&$hasSectionPlans, &$submittedCurricula, $term, $chair, $run, $college): void {
                    $hasSectionPlans = true;

                    foreach ($plans->pluck('curriculum_id')->unique() as $curriculumId) {
                        if (isset($submittedCurricula[$curriculumId])) {
                            continue;
                        }
                        $submittedCurricula[$curriculumId] = true;

                        try {
                            $this->saveSectionPlan->submit($term, $curriculumId, $chair, $this->context($run));
                            $this->processed($run);
                        } catch (Throwable $exception) {
                            $this->warning($run, "{$college->label()} curriculum {$curriculumId}: {$exception->getMessage()}");
                        }
                    }
                });
            if (! $hasSectionPlans) {
                $this->warning($run, "{$college->label()} produced no section plans.");
            }
        }
    }
}
