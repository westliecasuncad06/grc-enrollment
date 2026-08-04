<?php

namespace App\Domain\Scheduling;

use InvalidArgumentException;

final class ScheduleProposalTransitionRules
{
    /** @var array<string, ScheduleProposalStatus> */
    private const REQUIRED_STATUS = [
        'dean_approve' => ScheduleProposalStatus::Draft,
        'dean_return' => ScheduleProposalStatus::Draft,
        'executive_approve' => ScheduleProposalStatus::DeanApproved,
        'executive_return' => ScheduleProposalStatus::DeanApproved,
        'publish' => ScheduleProposalStatus::ExecutiveApproved,
        'close' => ScheduleProposalStatus::Published,
    ];

    /** @var array<string, ScheduleProposalStatus> */
    private const TARGET_STATUS = [
        'dean_approve' => ScheduleProposalStatus::DeanApproved,
        'dean_return' => ScheduleProposalStatus::Draft,
        'executive_approve' => ScheduleProposalStatus::ExecutiveApproved,
        'executive_return' => ScheduleProposalStatus::Draft,
        'publish' => ScheduleProposalStatus::Published,
        'close' => ScheduleProposalStatus::Closed,
    ];

    /** @return list<string> */
    public static function actions(): array
    {
        return array_keys(self::REQUIRED_STATUS);
    }

    public static function requiredStatus(string $action): ScheduleProposalStatus
    {
        return self::REQUIRED_STATUS[$action]
            ?? throw new InvalidArgumentException('Unknown schedule proposal transition.');
    }

    public static function targetStatus(string $action): ScheduleProposalStatus
    {
        return self::TARGET_STATUS[$action]
            ?? throw new InvalidArgumentException('Unknown schedule proposal transition.');
    }

    public static function isReturn(string $action): bool
    {
        return in_array($action, ['dean_return', 'executive_return'], true);
    }
}
