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
    case EnrollmentPaymentConfirmed = 'enrollment_payment_confirmed';
    case WithdrawalRequestApproved = 'withdrawal_request_approved';
    case WithdrawalRequestRejected = 'withdrawal_request_rejected';
    case TransfereeCreditApproved = 'transferee_credit_approved';
    case TransfereeCreditRejected = 'transferee_credit_rejected';
}
