<?php

namespace App\Actions\ItControl;

use App\Actions\Scheduling\TransitionScheduleProposal;
use App\Domain\Identity\UserRole;
use App\Domain\Scheduling\ScheduleProposalStatus;
use App\Models\ItControlAutomationRun;
use App\Models\ScheduleProposal;
use Throwable;

final class RunExecutivePublishAll
{
    use ManagesAutomationRun;

    public function __construct(private readonly TransitionScheduleProposal $transition) {}

    public function execute(ItControlAutomationRun $run): void
    {
        $executive = $this->actor(UserRole::ExecutiveDirector);
        ScheduleProposal::query()->where('academic_term_id', $run->academic_term_id)
            ->where('status', ScheduleProposalStatus::DeanApproved)->orderBy('id')->chunkById(200, function ($proposals) use ($run, $executive): void {
                foreach ($proposals as $proposal) {
                    try {
                        $this->transition->execute($proposal, 'publish', $executive, null, $this->context($run));
                        $this->processed($run);
                    } catch (Throwable $exception) {
                        $this->warning($run, "Proposal {$proposal->id}: {$exception->getMessage()}");
                    }
                }
            });
    }
}
