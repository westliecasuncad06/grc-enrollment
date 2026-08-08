<?php

namespace App\Jobs;

use App\Actions\Analytics\GenerateSectionDemandForecasts;
use App\Models\ScheduleGenerationRun;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class GenerateScheduleRecommendations implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(public readonly int $scheduleGenerationRunId) {}

    public function handle(GenerateSectionDemandForecasts $action): void
    {
        $run = ScheduleGenerationRun::query()->find($this->scheduleGenerationRunId);
        if ($run !== null) {
            $action->execute($run);
        }
    }
}
