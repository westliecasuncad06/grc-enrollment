<?php

namespace App\Actions\Scheduling;

use App\Domain\Scheduling\ScheduleProposalStatus;
use App\Domain\Scheduling\SectionStatus;
use App\Models\ScheduleProposal;
use App\Models\Section;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Applies one transition in the PRD §4.1 lifecycle
 * (draft → dean_approved → executive_approved → published → closed) and
 * records who decided it and when. `StoreScheduleProposalRequest`/
 * `UpdateScheduleProposalRequest` already validated the action against the
 * proposal's current status and the acting user's role before this class is
 * invoked, so no further validation happens here.
 *
 * `publish` is the only action with a side effect beyond the proposal row
 * itself: it bulk-transitions every `planned` section in the proposal's term
 * to `published`, in the same transaction — this is what actually exposes
 * the term's schedule to students and professors, since there is no direct
 * foreign key between `schedule_proposals` and `sections` (see ADR 0011).
 */
final class TransitionScheduleProposal
{
    /**
     * @var array<string, ScheduleProposalStatus>
     */
    private const TARGET_STATUS = [
        'dean_approve' => ScheduleProposalStatus::DeanApproved,
        'dean_return' => ScheduleProposalStatus::Draft,
        'executive_approve' => ScheduleProposalStatus::ExecutiveApproved,
        'executive_return' => ScheduleProposalStatus::Draft,
        'publish' => ScheduleProposalStatus::Published,
        'close' => ScheduleProposalStatus::Closed,
    ];

    public function execute(ScheduleProposal $proposal, string $action, User $actingUser, ?string $reason): void
    {
        DB::transaction(function () use ($proposal, $action, $actingUser, $reason): void {
            $proposal->update([
                'status' => self::TARGET_STATUS[$action],
                'decided_by' => $actingUser->id,
                'decided_at' => now(),
                'decision_reason' => $reason,
            ]);

            if ($action === 'publish') {
                Section::query()
                    ->where('academic_term_id', $proposal->academic_term_id)
                    ->where('status', SectionStatus::Planned->value)
                    ->update(['status' => SectionStatus::Published->value]);
            }
        });
    }
}
