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
                'enrollment_payment_confirmed',
                'withdrawal_request_approved',
                'withdrawal_request_rejected',
                'transferee_credit_approved',
                'transferee_credit_rejected',
                'schedule_submitted_for_dean',
                'schedule_dean_approved',
                'schedule_executive_approved',
                'schedule_returned',
                'enrollment_category_reclassified',
                'enrollment_change_request_submitted',
                'enrollment_change_request_approved',
                'enrollment_change_request_rejected',
                'curriculum_submitted_for_dean',
                'curriculum_dean_approved',
                'curriculum_executive_approved',
                'curriculum_returned',
            ],
            array_column(NotificationType::cases(), 'value'),
        );
    }
}
