<?php

namespace App\Domain\Notifications;

enum NotificationType: string
{
    case SchedulePublished = 'schedule_published';
    case EnrollmentSubmitted = 'enrollment_submitted';
    case EnrollmentRegistrarApproved = 'enrollment_registrar_approved';
    case EnrollmentRegistrarRejected = 'enrollment_registrar_rejected';
    case EnrollmentVoided = 'enrollment_voided';
    case AcademicGradeLocked = 'academic_grade_locked';
}
