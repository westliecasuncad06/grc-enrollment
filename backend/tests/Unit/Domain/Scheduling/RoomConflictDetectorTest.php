<?php

namespace Tests\Unit\Domain\Scheduling;

use App\Domain\Scheduling\RoomConflictDetector;
use App\Domain\Scheduling\ScheduleDayParser;
use PHPUnit\Framework\TestCase;

final class RoomConflictDetectorTest extends TestCase
{
    public function test_complementary_hyflex_patterns_can_share_a_room_and_time(): void
    {
        $detector = new RoomConflictDetector(new ScheduleDayParser);

        self::assertFalse($detector->hasConflict([
            'schedule_days' => 'Monday',
            'starts_at_time' => '08:00:00',
            'ends_at_time' => '10:00:00',
            'modality' => 'hyflex_a',
        ], [[
            'schedule_days' => 'Monday',
            'starts_at_time' => '08:00:00',
            'ends_at_time' => '10:00:00',
            'modality' => 'hyflex_b',
        ]]));
    }

    public function test_f2f_or_the_same_hyflex_pattern_cannot_double_book_a_room(): void
    {
        $detector = new RoomConflictDetector(new ScheduleDayParser);
        $slot = [
            'schedule_days' => 'Monday',
            'starts_at_time' => '08:00:00',
            'ends_at_time' => '10:00:00',
        ];

        self::assertTrue($detector->hasConflict([...$slot, 'modality' => 'f2f'], [[...$slot, 'modality' => 'hyflex_a']]));
        self::assertTrue($detector->hasConflict([...$slot, 'modality' => 'hyflex_b'], [[...$slot, 'modality' => 'hyflex_b']]));
    }
}
