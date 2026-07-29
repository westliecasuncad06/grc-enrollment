<?php

namespace Tests\Unit\Domain\Notifications;

use App\Domain\Notifications\NotificationType;
use PHPUnit\Framework\TestCase;

final class NotificationTypeTest extends TestCase
{
    public function test_values_are_the_approved_notification_types(): void
    {
        self::assertSame(
            ['schedule_published'],
            array_column(NotificationType::cases(), 'value'),
        );
    }
}
