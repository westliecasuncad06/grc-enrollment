<?php

namespace Tests\Unit\Domain\Notifications;

use App\Domain\Notifications\NotificationType;
use PHPUnit\Framework\TestCase;

final class NotificationTypeTest extends TestCase
{
    public function test_values_are_the_approved_notification_types(): void
    {
        self::assertSame(
            [
                'schedule_published',
                'enrollment_submitted',
                'enrollment_registrar_approved',
                'enrollment_registrar_rejected',
                'enrollment_voided',
                'academic_grade_locked',
            ],
            array_column(NotificationType::cases(), 'value'),
        );
    }
}
