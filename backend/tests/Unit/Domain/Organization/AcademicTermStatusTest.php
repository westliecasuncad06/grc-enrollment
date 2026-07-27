<?php

namespace Tests\Unit\Domain\Organization;

use App\Domain\Organization\AcademicTermStatus;
use PHPUnit\Framework\TestCase;

final class AcademicTermStatusTest extends TestCase
{
    public function test_status_values_are_the_three_provisional_cases(): void
    {
        self::assertSame(
            ['planning', 'active', 'closed'],
            array_column(AcademicTermStatus::cases(), 'value'),
        );
    }

    public function test_labels_are_stable_and_human_readable(): void
    {
        self::assertSame('Planning', AcademicTermStatus::Planning->label());
        self::assertSame('Active', AcademicTermStatus::Active->label());
        self::assertSame('Closed', AcademicTermStatus::Closed->label());
    }

    public function test_planning_is_not_visible_to_learners_but_active_and_closed_are(): void
    {
        self::assertFalse(AcademicTermStatus::Planning->isVisibleToLearners());
        self::assertTrue(AcademicTermStatus::Active->isVisibleToLearners());
        self::assertTrue(AcademicTermStatus::Closed->isVisibleToLearners());
    }
}
