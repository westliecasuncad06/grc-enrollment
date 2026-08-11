<?php

namespace App\Actions\ItControl;

use App\Actions\Scheduling\TransitionScheduleProposal;
use App\Domain\Identity\UserRole;
use App\Domain\Scheduling\ScheduleProposalStatus;
use App\Models\ItControlAutomationRun;
use App\Models\ScheduleProposal;
use Throwable;

final class RunDeanApproveAll implements RunsItControlAutomationStep
{
    use ManagesAutomationRun;

    public function __construct(private readonly TransitionScheduleProposal $transition) {}

    public function execute(ItControlAutomationRun $run): void
    {
        $dean = $this->actor(UserRole::Dean);
        ScheduleProposal::query()->where('academic_term_id', $run->academic_term_id)
            ->where('status', ScheduleProposalStatus::Draft)->orderBy('id')->chunkById(200, function ($proposals) use ($run, $dean): void {
                foreach ($proposals as $proposal) {
                    try {
                        $this->transition->execute($proposal, 'dean_approve', $dean, null, $this->context($run));
                        $this->processed($run);
                    } catch (Throwable $exception) {
                        $this->warning($run, "Proposal {$proposal->id}: {$exception->getMessage()}");
                    }
                }
            });
    }
}
