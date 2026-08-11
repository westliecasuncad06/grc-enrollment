<?php

namespace App\Domain\Audit;

final class AuditAction
{
    public const CURRICULUM_CREATED = 'curriculum.created';

    public const CURRICULUM_UPDATED = 'curriculum.updated';

    public const SUBJECT_CREATED = 'subject.created';

    public const CURRICULUM_SUBMITTED = 'curriculum.submitted';

    public const CURRICULUM_DEAN_APPROVED = 'curriculum.dean_approved';

    public const CURRICULUM_DEAN_RETURNED = 'curriculum.dean_returned';

    public const CURRICULUM_EXECUTIVE_APPROVED = 'curriculum.executive_approved';

    public const CURRICULUM_EXECUTIVE_RETURNED = 'curriculum.executive_returned';

    public const FACULTY_AVAILABILITY_CREATED = 'faculty_availability.created';

    public const FACULTY_AVAILABILITY_UPDATED = 'faculty_availability.updated';

    public const FACULTY_AVAILABILITY_DELETED = 'faculty_availability.deleted';

    public const FACULTY_SUBJECT_PREFERENCE_CREATED = 'faculty_subject_preference.created';

    public const FACULTY_SUBJECT_PREFERENCE_UPDATED = 'faculty_subject_preference.updated';

    public const FACULTY_SUBJECT_PREFERENCE_DELETED = 'faculty_subject_preference.deleted';

    public const FACULTY_CURRICULUM_SUBJECT_PREFERENCE_CREATED = 'faculty_curriculum_subject_preference.created';

    public const FACULTY_CURRICULUM_SUBJECT_PREFERENCE_UPDATED = 'faculty_curriculum_subject_preference.updated';

    public const FACULTY_CURRICULUM_SUBJECT_PREFERENCE_DELETED = 'faculty_curriculum_subject_preference.deleted';

    public const FACULTY_SPECIALIZATION_CREATED = 'faculty_specialization.created';

    public const FACULTY_SPECIALIZATION_DELETED = 'faculty_specialization.deleted';

    public const SECTION_CREATED = 'section.created';

    public const SECTION_UPDATED = 'section.updated';

    public const FACULTY_LOAD_THRESHOLD_UPDATED = 'faculty_load_threshold.updated';

    public const SCHEDULE_PROPOSAL_CREATED = 'schedule_proposal.created';

    public const SCHEDULE_PROPOSAL_DEAN_APPROVED = 'schedule_proposal.dean_approved';

    public const SCHEDULE_PROPOSAL_DEAN_RETURNED = 'schedule_proposal.dean_returned';

    public const SCHEDULE_PROPOSAL_EXECUTIVE_APPROVED = 'schedule_proposal.executive_approved';

    public const SCHEDULE_PROPOSAL_EXECUTIVE_RETURNED = 'schedule_proposal.executive_returned';

    public const SCHEDULE_PROPOSAL_PUBLISHED = 'schedule_proposal.published';

    public const SECTION_PUBLISHED = 'section.published';

    public const SCHEDULE_PROPOSAL_CLOSED = 'schedule_proposal.closed';

    public const STUDENT_PROFILE_PROVISIONED = 'student_profile.provisioned';

    public const STUDENT_ENROLLMENT_CATEGORY_RECLASSIFIED = 'student_profile.enrollment_category_reclassified';

    public const AUDIT_LOG_LIST_VIEWED = 'audit_log.list_viewed';

    public const FACULTY_DIRECTORY_LIST_VIEWED = 'faculty_directory.list_viewed';

    public const FACULTY_WORKFORCE_PROFILE_UPDATED = 'faculty_workforce_profile.updated';

    public const ENROLLMENT_SUBMITTED = 'enrollment.submitted';

    public const ENROLLMENT_REGISTRAR_APPROVED = 'enrollment.registrar_approved';

    public const ENROLLMENT_REGISTRAR_REJECTED = 'enrollment.registrar_rejected';

    public const ENROLLMENT_VOIDED = 'enrollment.voided';

    public const ACADEMIC_GRADE_CREATED = 'academic_grade.created';

    public const ACADEMIC_GRADE_UPDATED = 'academic_grade.updated';

    public const ACADEMIC_GRADE_SUBMITTED = 'academic_grade.submitted';

    public const ACADEMIC_GRADE_LOCKED = 'academic_grade.locked';

    public const QUEUE_TICKET_SERVING_STARTED = 'queue_ticket.serving_started';

    public const QUEUE_TICKET_SERVED = 'queue_ticket.served';

    public const QUEUE_TICKET_SKIPPED = 'queue_ticket.skipped';

    public const QUEUE_TICKET_MARKED_PRIORITY = 'queue_ticket.marked_priority';

    public const ENROLLMENT_PAYMENT_CONFIRMED = 'enrollment.payment_confirmed';

    public const WITHDRAWAL_REQUEST_CREATED = 'withdrawal_request.created';

    public const WITHDRAWAL_REQUEST_APPROVED = 'withdrawal_request.approved';

    public const WITHDRAWAL_REQUEST_REJECTED = 'withdrawal_request.rejected';

    public const TRANSFEREE_CREDIT_CREATED = 'transferee_credit.created';

    public const TRANSFEREE_CREDIT_UPDATED = 'transferee_credit.updated';

    public const TRANSFEREE_CREDIT_APPROVED = 'transferee_credit.approved';

    public const TRANSFEREE_CREDIT_REJECTED = 'transferee_credit.rejected';

    public const ACADEMIC_TERM_CREATED = 'academic_term.created';

    public const SUBJECT_OFFERINGS_REPLACED = 'subject_offerings.replaced';

    public const SECTION_PLAN_SUBMITTED = 'section_plan.submitted';

    public const SECTION_PLAN_AUTO_ASSIGNED = 'section_plan.auto_assigned';

    public const ACADEMIC_TERM_WORKFLOW_CURRICULUM_STARTED = 'academic_term_workflow.curriculum_started';

    public const ACADEMIC_TERM_WORKFLOW_CURRICULUM_COMPLETED = 'academic_term_workflow.curriculum_completed';

    public const ACADEMIC_TERM_WORKFLOW_FACULTY_REVIEWED = 'academic_term_workflow.faculty_reviewed';

    public const ACADEMIC_TERM_CLOSED = 'academic_term.closed';

    public const ACADEMIC_TERM_ARCHIVED = 'academic_term.archived';

    public const ACADEMIC_TERM_ENROLLMENT_OPENED = 'academic_term.enrollment_opened';

    public const ACADEMIC_TERM_ENROLLMENT_SCHEDULE_UPDATED = 'academic_term.enrollment_schedule_updated';

    public const ENROLLMENT_CHANGE_REQUEST_CREATED = 'enrollment_change_request.created';

    public const ENROLLMENT_CHANGE_REQUEST_APPROVED = 'enrollment_change_request.approved';

    public const ENROLLMENT_CHANGE_REQUEST_REJECTED = 'enrollment_change_request.rejected';

    public const STUDENT_SCHEDULE_PREFERENCE_SAVED = 'student_schedule_preference.saved';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return [
            self::CURRICULUM_CREATED,
            self::CURRICULUM_UPDATED,
            self::SUBJECT_CREATED,
            self::CURRICULUM_SUBMITTED,
            self::CURRICULUM_DEAN_APPROVED,
            self::CURRICULUM_DEAN_RETURNED,
            self::CURRICULUM_EXECUTIVE_APPROVED,
            self::CURRICULUM_EXECUTIVE_RETURNED,
            self::FACULTY_AVAILABILITY_CREATED,
            self::FACULTY_AVAILABILITY_UPDATED,
            self::FACULTY_AVAILABILITY_DELETED,
            self::FACULTY_SUBJECT_PREFERENCE_CREATED,
            self::FACULTY_SUBJECT_PREFERENCE_UPDATED,
            self::FACULTY_SUBJECT_PREFERENCE_DELETED,
            self::FACULTY_CURRICULUM_SUBJECT_PREFERENCE_CREATED,
            self::FACULTY_CURRICULUM_SUBJECT_PREFERENCE_UPDATED,
            self::FACULTY_CURRICULUM_SUBJECT_PREFERENCE_DELETED,
            self::FACULTY_SPECIALIZATION_CREATED,
            self::FACULTY_SPECIALIZATION_DELETED,
            self::SECTION_CREATED,
            self::SECTION_UPDATED,
            self::FACULTY_LOAD_THRESHOLD_UPDATED,
            self::SCHEDULE_PROPOSAL_CREATED,
            self::SCHEDULE_PROPOSAL_DEAN_APPROVED,
            self::SCHEDULE_PROPOSAL_DEAN_RETURNED,
            self::SCHEDULE_PROPOSAL_EXECUTIVE_APPROVED,
            self::SCHEDULE_PROPOSAL_EXECUTIVE_RETURNED,
            self::SCHEDULE_PROPOSAL_PUBLISHED,
            self::SECTION_PUBLISHED,
            self::SCHEDULE_PROPOSAL_CLOSED,
            self::STUDENT_PROFILE_PROVISIONED,
            self::STUDENT_ENROLLMENT_CATEGORY_RECLASSIFIED,
            self::AUDIT_LOG_LIST_VIEWED,
            self::FACULTY_DIRECTORY_LIST_VIEWED,
            self::FACULTY_WORKFORCE_PROFILE_UPDATED,
            self::ENROLLMENT_SUBMITTED,
            self::ENROLLMENT_REGISTRAR_APPROVED,
            self::ENROLLMENT_REGISTRAR_REJECTED,
            self::ENROLLMENT_VOIDED,
            self::ACADEMIC_GRADE_CREATED,
            self::ACADEMIC_GRADE_UPDATED,
            self::ACADEMIC_GRADE_SUBMITTED,
            self::ACADEMIC_GRADE_LOCKED,
            self::QUEUE_TICKET_SERVING_STARTED,
            self::QUEUE_TICKET_SERVED,
            self::QUEUE_TICKET_SKIPPED,
            self::QUEUE_TICKET_MARKED_PRIORITY,
            self::ENROLLMENT_PAYMENT_CONFIRMED,
            self::WITHDRAWAL_REQUEST_CREATED,
            self::WITHDRAWAL_REQUEST_APPROVED,
            self::WITHDRAWAL_REQUEST_REJECTED,
            self::TRANSFEREE_CREDIT_CREATED,
            self::TRANSFEREE_CREDIT_UPDATED,
            self::TRANSFEREE_CREDIT_APPROVED,
            self::TRANSFEREE_CREDIT_REJECTED,
            self::ACADEMIC_TERM_CREATED,
            self::SUBJECT_OFFERINGS_REPLACED,
            self::SECTION_PLAN_SUBMITTED,
            self::SECTION_PLAN_AUTO_ASSIGNED,
            self::ACADEMIC_TERM_WORKFLOW_CURRICULUM_STARTED,
            self::ACADEMIC_TERM_WORKFLOW_CURRICULUM_COMPLETED,
            self::ACADEMIC_TERM_WORKFLOW_FACULTY_REVIEWED,
            self::ACADEMIC_TERM_CLOSED,
            self::ACADEMIC_TERM_ARCHIVED,
            self::ACADEMIC_TERM_ENROLLMENT_OPENED,
            self::ACADEMIC_TERM_ENROLLMENT_SCHEDULE_UPDATED,
            self::ENROLLMENT_CHANGE_REQUEST_CREATED,
            self::ENROLLMENT_CHANGE_REQUEST_APPROVED,
            self::ENROLLMENT_CHANGE_REQUEST_REJECTED,
            self::STUDENT_SCHEDULE_PREFERENCE_SAVED,
        ];
    }
}
