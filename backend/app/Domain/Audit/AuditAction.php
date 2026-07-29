<?php

namespace App\Domain\Audit;

final class AuditAction
{
    public const CURRICULUM_CREATED = 'curriculum.created';

    public const CURRICULUM_UPDATED = 'curriculum.updated';

    public const FACULTY_AVAILABILITY_CREATED = 'faculty_availability.created';

    public const FACULTY_AVAILABILITY_UPDATED = 'faculty_availability.updated';

    public const FACULTY_AVAILABILITY_DELETED = 'faculty_availability.deleted';

    public const FACULTY_SUBJECT_PREFERENCE_CREATED = 'faculty_subject_preference.created';

    public const FACULTY_SUBJECT_PREFERENCE_UPDATED = 'faculty_subject_preference.updated';

    public const FACULTY_SUBJECT_PREFERENCE_DELETED = 'faculty_subject_preference.deleted';

    public const SECTION_CREATED = 'section.created';

    public const SECTION_UPDATED = 'section.updated';

    public const SCHEDULE_PROPOSAL_CREATED = 'schedule_proposal.created';

    public const SCHEDULE_PROPOSAL_DEAN_APPROVED = 'schedule_proposal.dean_approved';

    public const SCHEDULE_PROPOSAL_DEAN_RETURNED = 'schedule_proposal.dean_returned';

    public const SCHEDULE_PROPOSAL_EXECUTIVE_APPROVED = 'schedule_proposal.executive_approved';

    public const SCHEDULE_PROPOSAL_EXECUTIVE_RETURNED = 'schedule_proposal.executive_returned';

    public const SCHEDULE_PROPOSAL_PUBLISHED = 'schedule_proposal.published';

    public const SECTION_PUBLISHED = 'section.published';

    public const SCHEDULE_PROPOSAL_CLOSED = 'schedule_proposal.closed';

    public const STUDENT_PROFILE_PROVISIONED = 'student_profile.provisioned';

    public const AUDIT_LOG_LIST_VIEWED = 'audit_log.list_viewed';

    public const FACULTY_DIRECTORY_LIST_VIEWED = 'faculty_directory.list_viewed';

    public const ENROLLMENT_SUBMITTED = 'enrollment.submitted';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return [
            self::CURRICULUM_CREATED,
            self::CURRICULUM_UPDATED,
            self::FACULTY_AVAILABILITY_CREATED,
            self::FACULTY_AVAILABILITY_UPDATED,
            self::FACULTY_AVAILABILITY_DELETED,
            self::FACULTY_SUBJECT_PREFERENCE_CREATED,
            self::FACULTY_SUBJECT_PREFERENCE_UPDATED,
            self::FACULTY_SUBJECT_PREFERENCE_DELETED,
            self::SECTION_CREATED,
            self::SECTION_UPDATED,
            self::SCHEDULE_PROPOSAL_CREATED,
            self::SCHEDULE_PROPOSAL_DEAN_APPROVED,
            self::SCHEDULE_PROPOSAL_DEAN_RETURNED,
            self::SCHEDULE_PROPOSAL_EXECUTIVE_APPROVED,
            self::SCHEDULE_PROPOSAL_EXECUTIVE_RETURNED,
            self::SCHEDULE_PROPOSAL_PUBLISHED,
            self::SECTION_PUBLISHED,
            self::SCHEDULE_PROPOSAL_CLOSED,
            self::STUDENT_PROFILE_PROVISIONED,
            self::AUDIT_LOG_LIST_VIEWED,
            self::FACULTY_DIRECTORY_LIST_VIEWED,
            self::ENROLLMENT_SUBMITTED,
        ];
    }
}
