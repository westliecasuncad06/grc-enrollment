<?php

namespace Tests\Unit\Jobs;

use App\Actions\ItControl\RunsItControlAutomationStep;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\ItControl\AutomationRunStatus;
use App\Domain\ItControl\AutomationStep;
use App\Domain\Organization\AcademicTermStatus;
use App\Jobs\RunItControlAutomationStep;
use App\Models\AcademicTerm;
use App\Models\ItControlAutomationRun;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

final class RunItControlAutomationStepTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_automation_step_resolves_an_executable_action_contract(): void
    {
        $job = new RunItControlAutomationStep(1);
        $actionFor = new \ReflectionMethod($job, 'actionFor');

        foreach (AutomationStep::cases() as $step) {
            $this->assertInstanceOf(
                RunsItControlAutomationStep::class,
                $actionFor->invoke($job, $step),
            );
        }
    }

    public function test_it_finalizes_a_running_run_when_the_queue_execution_fails(): void
    {
        $run = ItControlAutomationRun::create([
            'step' => AutomationStep::DeanApproveAll,
            'academic_term_id' => AcademicTerm::create([
                'school_year' => '2026-2027',
                'semester' => '1st',
                'status' => AcademicTermStatus::SemesterOngoing,
            ])->id,
            'status' => AutomationRunStatus::Running,
            'initiated_by' => $this->makeUser()->id,
            'started_at' => now(),
        ]);

        (new RunItControlAutomationStep($run->id))->failed(new RuntimeException('Queue worker unavailable.'));

        $run->refresh();

        $this->assertSame(AutomationRunStatus::Failed, $run->status);
        $this->assertSame('IT-control automation run failed. Review the run details and retry.', $run->error_summary);
        $this->assertNotNull($run->completed_at);
    }

    public function test_it_persists_failure_before_a_retry_can_observe_a_running_run(): void
    {
        $run = ItControlAutomationRun::create([
            'step' => AutomationStep::DeanApproveAll,
            'academic_term_id' => AcademicTerm::create([
                'school_year' => '2026-2027',
                'semester' => '1st',
                'status' => AcademicTermStatus::SemesterOngoing,
            ])->id,
            'status' => AutomationRunStatus::Queued,
            'initiated_by' => $this->makeUser()->id,
        ]);
        $job = new RunItControlAutomationStep($run->id);
        User::create([
            'name' => 'Dean',
            'email' => 'dean@grc.test',
            'password' => 'password',
            'role' => UserRole::Dean,
            'status' => UserStatus::Active,
        ]);

        ItControlAutomationRun::updating(static function (ItControlAutomationRun $updatingRun): void {
            if ($updatingRun->status === AutomationRunStatus::Succeeded) {
                throw new RuntimeException('The post-running work failed.');
            }
        });

        try {
            $job->handle();
            $this->fail('The simulated post-running failure was not rethrown.');
        } catch (RuntimeException $exception) {
            $this->assertSame('The post-running work failed.', $exception->getMessage());
        }

        $run->refresh();
        $this->assertSame(AutomationRunStatus::Failed, $run->status);
        $this->assertSame('IT-control automation run failed. Review the run details and retry.', $run->error_summary);
        $this->assertNotNull($run->completed_at);

        $job->handle();

        $run->refresh();
        $this->assertSame(AutomationRunStatus::Failed, $run->status);
    }

    private function makeUser(): User
    {
        return User::create([
            'name' => 'IT Admin',
            'email' => 'it-admin@grc.test',
            'password' => 'password',
            'role' => UserRole::ItAdmin,
            'status' => UserStatus::Active,
        ]);
    }
}
