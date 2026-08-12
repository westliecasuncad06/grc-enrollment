<?php

namespace App\Jobs;

use App\Actions\ItControl\RunCashierConfirmAll;
use App\Actions\ItControl\RunChairGenerateSections;
use App\Actions\ItControl\RunDeanApproveAll;
use App\Actions\ItControl\RunExecutivePublishAll;
use App\Actions\ItControl\RunRegistrarApproveAll;
use App\Actions\ItControl\RunsItControlAutomationStep;
use App\Actions\ItControl\RunStudentsAutoEnroll;
use App\Domain\ItControl\AutomationRunStatus;
use App\Domain\ItControl\AutomationStep;
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
        if (! app()->environment(['local', 'testing'])) {
            throw new \LogicException('IT-control automation writes are restricted to local and testing environments.');
        }

        // This step processes every section/curriculum in a college
        // synchronously (QUEUE_CONNECTION=sync runs it inline within the
        // request), so the interactive web SAPI's default execution limit
        // is routinely too short for the institution-wide cohort. Safe only
        // because the environment guard above already confines this job to
        // local/testing.
        set_time_limit(0);

        $run = ItControlAutomationRun::query()->find($this->automationRunId);

        if ($run === null || $run->status !== AutomationRunStatus::Queued) {
            return;
        }

        $run->update([
            'status' => AutomationRunStatus::Running,
            'started_at' => now(),
        ]);

        try {
            $this->actionFor($run->step)->execute($run);
            $run->refresh();
            $run->update([
                'status' => $run->failed_count === 0 ? AutomationRunStatus::Succeeded : AutomationRunStatus::Partial,
                'completed_at' => now(),
            ]);
        } catch (Throwable $exception) {
            $this->persistFailure($exception);

            throw $exception;
        }
    }

    public function failed(Throwable $exception): void
    {
        $this->persistFailure($exception);
    }

    private function persistFailure(?Throwable $exception = null): void
    {
        $run = ItControlAutomationRun::query()->find($this->automationRunId);

        if ($run === null) {
            return;
        }

        $run->update([
            'status' => AutomationRunStatus::Failed,
            'error_summary' => $exception !== null && str_contains(strtolower($exception->getMessage()), 'prediction service')
                ? 'prediction service is unavailable. Review the service connection and retry.'
                : 'IT-control automation run failed. Review the run details and retry.',
            'completed_at' => now(),
        ]);
    }

    private function actionFor(AutomationStep $step): RunsItControlAutomationStep
    {
        return match ($step) {
            AutomationStep::ChairGenerateSections => app(RunChairGenerateSections::class),
            AutomationStep::DeanApproveAll => app(RunDeanApproveAll::class),
            AutomationStep::ExecutivePublishAll => app(RunExecutivePublishAll::class),
            AutomationStep::StudentsAutoEnroll => app(RunStudentsAutoEnroll::class),
            AutomationStep::RegistrarApproveAll => app(RunRegistrarApproveAll::class),
            AutomationStep::CashierConfirmAll => app(RunCashierConfirmAll::class),
        };
    }
}
