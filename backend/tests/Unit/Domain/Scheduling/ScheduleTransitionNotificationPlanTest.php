<?php

namespace Tests\Unit\Domain\Scheduling;

use App\Domain\Identity\UserRole;
use App\Domain\Notifications\NotificationType;
use App\Domain\Scheduling\ScheduleTransitionNotificationPlan;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ScheduleTransitionNotificationPlanTest extends TestCase
{
    public function test_submission_notifies_every_dean_and_no_one_else(): void
    {
        $plan = ScheduleTransitionNotificationPlan::forAction(
            ScheduleTransitionNotificationPlan::SUBMITTED_FOR_DEAN,
            'CCS schedule for 2026-2027 1st',
            null,
        );

        self::assertCount(1, $plan);
        self::assertSame(UserRole::Dean, $plan[0]['audience']);
        self::assertSame(NotificationType::ScheduleSubmittedForDean, $plan[0]['type']);
        self::assertStringContainsString('CCS schedule for 2026-2027 1st', $plan[0]['message']);
        self::assertStringContainsString('your review', $plan[0]['message']);
    }

    public function test_dean_approval_notifies_the_submitter_and_every_executive_director(): void
    {
        $plan = ScheduleTransitionNotificationPlan::forAction(
            'dean_approve',
            'CCS schedule for 2026-2027 1st',
            null,
        );

        self::assertCount(2, $plan);
        self::assertSame('submitter', $plan[0]['audience']);
        self::assertSame(NotificationType::ScheduleDeanApproved, $plan[0]['type']);
        self::assertSame(UserRole::ExecutiveDirector, $plan[1]['audience']);
        self::assertSame(NotificationType::ScheduleDeanApproved, $plan[1]['type']);
        // The two audiences read different messages: the submitter is told
        // what happened, the Executive Director is told what to do next.
        self::assertStringContainsString('approved by the Dean.', $plan[0]['message']);
        self::assertStringContainsString('waiting for your final approval', $plan[1]['message']);
    }

    public function test_executive_approval_notifies_the_submitter_and_every_dean(): void
    {
        $plan = ScheduleTransitionNotificationPlan::forAction(
            'executive_approve',
            'CCS schedule for 2026-2027 1st',
            null,
        );

        self::assertCount(2, $plan);
        self::assertSame('submitter', $plan[0]['audience']);
        self::assertSame(UserRole::Dean, $plan[1]['audience']);
        self::assertSame(NotificationType::ScheduleExecutiveApproved, $plan[0]['type']);
        self::assertSame(NotificationType::ScheduleExecutiveApproved, $plan[1]['type']);
    }

    #[DataProvider('returnActions')]
    public function test_return_notifies_only_the_submitter_and_carries_the_reason(string $action): void
    {
        $plan = ScheduleTransitionNotificationPlan::forAction(
            $action,
            'CCS schedule for 2026-2027 1st',
            'Room conflict on Monday 8am.',
        );

        self::assertCount(1, $plan);
        self::assertSame('submitter', $plan[0]['audience']);
        self::assertSame(NotificationType::ScheduleReturned, $plan[0]['type']);
        self::assertStringContainsString('CCS schedule for 2026-2027 1st', $plan[0]['message']);
        self::assertStringContainsString('Room conflict on Monday 8am.', $plan[0]['message']);
    }

    /** @return array<string, array{string}> */
    public static function returnActions(): array
    {
        return [
            'Dean return' => ['dean_return'],
            'Executive Director return' => ['executive_return'],
        ];
    }

    public function test_dean_return_and_executive_return_name_the_correct_reviewer(): void
    {
        $deanReturn = ScheduleTransitionNotificationPlan::forAction('dean_return', 'X', 'reason')[0]['message'];
        $executiveReturn = ScheduleTransitionNotificationPlan::forAction('executive_return', 'X', 'reason')[0]['message'];

        self::assertStringStartsWith('Dean returned', $deanReturn);
        self::assertStringStartsWith('Executive Director returned', $executiveReturn);
    }

    public function test_unknown_action_is_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);

        ScheduleTransitionNotificationPlan::forAction('unknown_action', 'X', null);
    }
}
