<?php

namespace Tests\Unit\Models;

use App\Domain\Scheduling\ScheduleGenerationStatus;
use App\Models\ScheduleGenerationRun;
use Carbon\CarbonImmutable;
use Tests\TestCase;

final class ScheduleGenerationRunTest extends TestCase
{
    public function test_status_warnings_and_timestamps_use_their_canonical_casts(): void
    {
        $run = new ScheduleGenerationRun;
        $run->status = ScheduleGenerationStatus::Queued;
        $run->warnings = ['No room matched the historical Lab 1 reference.'];
        $run->started_at = '2026-08-09 09:00:00';

        self::assertSame(ScheduleGenerationStatus::Queued, $run->status);
        self::assertSame(['No room matched the historical Lab 1 reference.'], $run->warnings);
        self::assertInstanceOf(CarbonImmutable::class, $run->started_at);
    }
}
