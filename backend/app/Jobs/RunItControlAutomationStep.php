<?php

namespace App\Jobs;

use App\Domain\ItControl\AutomationRunStatus;
use App\Models\ItControlAutomationRun;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

final class RunItControlAutomationStep implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(public readonly int $automationRunId) {}

    public function handle(): void
    {
        $run = ItControlAutomationRun::query()->find($this->automationRunId);

        if ($run === null || $run->status !== AutomationRunStatus::Queued) {
            return;
        }

        $run->update([
            'status' => AutomationRunStatus::Running,
            'started_at' => now(),
        ]);

        try {
            // Task 4 deliberately tracks the lifecycle only. Task 5 supplies
            // the business action selected by the persisted step.
            $run->update([
                'status' => AutomationRunStatus::Succeeded,
                'completed_at' => now(),
            ]);
        } catch (Throwable $exception) {
            $this->persistFailure();

            throw $exception;
        }
    }

    public function failed(Throwable $exception): void
    {
        $this->persistFailure();
    }

    private function persistFailure(): void
    {
        $run = ItControlAutomationRun::query()->find($this->automationRunId);

        if ($run === null) {
            return;
        }

        $run->update([
            'status' => AutomationRunStatus::Failed,
            'error_summary' => 'IT-control automation run failed. Review the run details and retry.',
            'completed_at' => now(),
        ]);
    }
}
