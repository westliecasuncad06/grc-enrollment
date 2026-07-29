<?php

namespace App\Domain\Notifications;

enum NotificationType: string
{
    case SchedulePublished = 'schedule_published';
}
