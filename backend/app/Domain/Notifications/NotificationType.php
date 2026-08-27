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
    case ScheduleSubmittedForDean = 'schedule_submitted_for_dean';
    case ScheduleDeanApproved = 'schedule_dean_approved';
    case ScheduleExecutiveApproved = 'schedule_executive_approved';
    case ScheduleReturned = 'schedule_returned';
    case EnrollmentCategoryReclassified = 'enrollment_category_reclassified';
    case EnrollmentChangeRequestSubmitted = 'enrollment_change_request_submitted';
    case EnrollmentChangeRequestApproved = 'enrollment_change_request_approved';
    case EnrollmentChangeRequestRejected = 'enrollment_change_request_rejected';
    case CurriculumSubmittedForDean = 'curriculum_submitted_for_dean';
    case CurriculumDeanApproved = 'curriculum_dean_approved';
    case CurriculumExecutiveApproved = 'curriculum_executive_approved';
    case CurriculumReturned = 'curriculum_returned';
    case QueueTicketClaimed = 'queue_ticket_claimed';
    case QueueCycleCutOff = 'queue_cycle_cut_off';
    case StudentProfileChangeApproved = 'student_profile_change_approved';
    case StudentProfileChangeRejected = 'student_profile_change_rejected';
}
