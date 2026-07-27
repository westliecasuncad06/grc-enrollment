<?php

namespace Tests\Unit\Domain\Academic;

use App\Domain\Academic\TransfereeCreditStatus;
use PHPUnit\Framework\TestCase;

final class TransfereeCreditStatusTest extends TestCase
{
    public function test_status_values_are_the_three_provisional_cases(): void
    {
        self::assertSame(
            ['pending', 'approved', 'rejected'],
            array_column(TransfereeCreditStatus::cases(), 'value'),
        );
    }

    public function test_labels_are_stable_and_human_readable(): void
    {
        self::assertSame('Pending', TransfereeCreditStatus::Pending->label());
        self::assertSame('Approved', TransfereeCreditStatus::Approved->label());
        self::assertSame('Rejected', TransfereeCreditStatus::Rejected->label());
    }
}
