<?php

namespace Tests\Unit\Models;

use App\Domain\Academic\TransfereeCreditStatus;
use App\Models\TransfereeCredit;
use Carbon\CarbonImmutable;
use Tests\TestCase;

final class TransfereeCreditTest extends TestCase
{
    public function test_status_and_credited_units_use_their_canonical_casts(): void
    {
        $credit = new TransfereeCredit;
        $credit->forceFill([
            'student_id' => 1,
            'source_institution' => 'Synthetic Partner College',
            'source_subject_code' => 'ITE-101',
            'source_subject_title' => 'Introduction to Information Technology',
            'credited_units' => '3',
            'status' => 'approved',
            'processed_at' => '2026-08-05 09:00:00',
        ]);

        self::assertSame(TransfereeCreditStatus::Approved, $credit->status);
        self::assertSame(3, $credit->credited_units);
        self::assertInstanceOf(CarbonImmutable::class, $credit->processed_at);
    }
}
