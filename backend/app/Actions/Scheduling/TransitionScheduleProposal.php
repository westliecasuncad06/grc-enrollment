<?php

namespace App\Actions\Scheduling;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Notifications\NotificationType;
use App\Domain\Scheduling\ScheduleProposalStatus;
use App\Domain\Scheduling\SectionStatus;
use App\Models\AcademicTerm;
use App\Models\Notification;
use App\Models\ScheduleProposal;
use App\Models\Section;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * Applies one transition in the PRD §4.1 lifecycle
 * (draft → dean_approved → executive_approved → published → closed) and
 * records who decided it and when.
 *
 * `publish` is the only action with a side effect beyond the proposal row
 * itself: it transitions every `planned` section in the proposal's term
 * individually to `published`, in the same transaction — this is what exposes
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

    /**
     * @var array<string, ScheduleProposalStatus>
     */
    private const REQUIRED_CURRENT_STATUS = [
        'dean_approve' => ScheduleProposalStatus::Draft,
        'dean_return' => ScheduleProposalStatus::DeanApproved,
        'executive_approve' => ScheduleProposalStatus::DeanApproved,
        'executive_return' => ScheduleProposalStatus::ExecutiveApproved,
        'publish' => ScheduleProposalStatus::ExecutiveApproved,
        'close' => ScheduleProposalStatus::Published,
    ];

    /**
     * @var array<string, string>
     */
    private const AUDIT_ACTION = [
        'dean_approve' => AuditAction::SCHEDULE_PROPOSAL_DEAN_APPROVED,
        'dean_return' => AuditAction::SCHEDULE_PROPOSAL_DEAN_RETURNED,
        'executive_approve' => AuditAction::SCHEDULE_PROPOSAL_EXECUTIVE_APPROVED,
        'executive_return' => AuditAction::SCHEDULE_PROPOSAL_EXECUTIVE_RETURNED,
        'publish' => AuditAction::SCHEDULE_PROPOSAL_PUBLISHED,
        'close' => AuditAction::SCHEDULE_PROPOSAL_CLOSED,
    ];

    private const RETURN_ACTIONS = ['dean_return', 'executive_return'];

    public function __construct(private readonly AuditRecorder $auditRecorder) {}

    public function execute(
        ScheduleProposal $proposal,
        string $action,
        User $actingUser,
        ?string $reason,
        AuditRequestContext $context,
    ): ScheduleProposal {
        if (! isset(self::TARGET_STATUS[$action])) {
            throw new InvalidArgumentException('Unknown schedule proposal transition.');
        }

        if (
            in_array($action, self::RETURN_ACTIONS, true)
            && ($reason === null || trim($reason) === '')
        ) {
            throw ValidationException::withMessages([
                'decision_reason' => 'A decision reason is required when returning a proposal to draft.',
            ]);
        }

        return DB::transaction(function () use ($proposal, $action, $actingUser, $reason, $context): ScheduleProposal {
            $lockedProposal = ScheduleProposal::query()
                ->whereKey($proposal->id)
                ->lockForUpdate()
                ->firstOrFail();
            $requiredStatus = self::REQUIRED_CURRENT_STATUS[$action];

            if ($lockedProposal->status !== $requiredStatus) {
                throw ValidationException::withMessages([
                    'action' => "This action requires the proposal to currently be '{$requiredStatus->value}'; ".
                        "it is currently '{$lockedProposal->status->value}'.",
                ]);
            }

            $beforeValues = self::snapshot($lockedProposal);
            $decisionReason = in_array($action, self::RETURN_ACTIONS, true) ? $reason : null;

            $lockedProposal->update([
                'status' => self::TARGET_STATUS[$action],
                'decided_by' => $actingUser->id,
                'decided_at' => now(),
                'decision_reason' => $decisionReason,
            ]);
            $lockedProposal->refresh();

            $publishedSectionIds = [];
            $publicationRecipientIds = [$lockedProposal->submitted_by];

            if ($action === 'publish') {
                $sections = Section::query()
                    ->where('academic_term_id', $lockedProposal->academic_term_id)
                    ->where('status', SectionStatus::Planned->value)
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get();

                foreach ($sections as $section) {
                    $section->update(['status' => SectionStatus::Published]);
                    $section->refresh();
                    $publishedSectionIds[] = $section->id;

                    if ($section->professor_id !== null) {
                        $publicationRecipientIds[] = $section->professor_id;
                    }

                    $this->auditRecorder->record(
                        $actingUser,
                        AuditAction::SECTION_PUBLISHED,
                        AuditableType::SECTION,
                        $section->id,
                        ['status' => SectionStatus::Planned->value],
                        ['status' => SectionStatus::Published->value],
                        null,
                        $context,
                    );
                }
            }

            $afterValues = self::snapshot($lockedProposal);

            if ($action === 'publish') {
                $afterValues['published_section_ids'] = $publishedSectionIds;
            }

            $this->auditRecorder->record(
                $actingUser,
                self::AUDIT_ACTION[$action],
                AuditableType::SCHEDULE_PROPOSAL,
                $lockedProposal->id,
                $beforeValues,
                $afterValues,
                $decisionReason,
                $context,
            );

            if ($action === 'publish') {
                $term = AcademicTerm::query()->findOrFail($lockedProposal->academic_term_id);
                $message = "Schedule for {$term->school_year} {$term->semester} has been published.";
                $publicationRecipientIds = array_values(array_unique($publicationRecipientIds));
                sort($publicationRecipientIds);

                foreach ($publicationRecipientIds as $recipientId) {
                    Notification::create([
                        'user_id' => $recipientId,
                        'type' => NotificationType::SchedulePublished,
                        'message' => $message,
                    ]);
                }
            }

            return $lockedProposal->refresh();
        });
    }

    /**
     * @return array{
     *     academic_term_id: int,
     *     submitted_by: int,
     *     status: string,
     *     decided_by: ?int,
     *     decided_at: ?string,
     *     decision_reason: ?string
     * }
     */
    private static function snapshot(ScheduleProposal $proposal): array
    {
        return [
            'academic_term_id' => $proposal->academic_term_id,
            'submitted_by' => $proposal->submitted_by,
            'status' => $proposal->status->value,
            'decided_by' => $proposal->decided_by,
            'decided_at' => $proposal->decided_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'decision_reason' => $proposal->decision_reason,
        ];
    }
}
