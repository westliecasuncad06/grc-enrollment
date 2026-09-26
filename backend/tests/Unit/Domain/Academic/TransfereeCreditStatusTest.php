<?php

namespace Tests\Unit\Domain\Academic;

use App\Domain\Academic\TransfereeCreditStatus;
use PHPUnit\Framework\TestCase;

final class TransfereeCreditStatusTest extends TestCase
{
    public function test_status_values_are_the_four_provisional_cases_in_route_order(): void
    {
        // pending -> endorsed (by the Program Chair) -> approved | rejected (ADR 0026).
        self::assertSame(
            ['pending', 'endorsed', 'approved', 'rejected'],
            array_column(TransfereeCreditStatus::cases(), 'value'),
        );
    }

    public function test_labels_are_stable_and_human_readable(): void
    {
        self::assertSame('Pending', TransfereeCreditStatus::Pending->label());
        self::assertSame('Endorsed', TransfereeCreditStatus::Endorsed->label());
        self::assertSame('Approved', TransfereeCreditStatus::Approved->label());
        self::assertSame('Rejected', TransfereeCreditStatus::Rejected->label());
    }

    public function test_only_pending_and_endorsed_are_still_moving_through_the_workflow(): void
    {
        self::assertTrue(TransfereeCreditStatus::Pending->isOpen());
        self::assertTrue(TransfereeCreditStatus::Endorsed->isOpen());
        self::assertFalse(TransfereeCreditStatus::Approved->isOpen());
        self::assertFalse(TransfereeCreditStatus::Rejected->isOpen());
    }
}
