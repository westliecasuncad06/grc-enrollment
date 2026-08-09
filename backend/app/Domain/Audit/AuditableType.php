<?php

namespace App\Domain\Audit;

final class AuditableType
{
    public const CURRICULUM = 'curriculum';

    public const SUBJECT = 'subject';

    public const FACULTY_AVAILABILITY = 'faculty_availability';

    public const FACULTY_SUBJECT_PREFERENCE = 'faculty_subject_preference';

    public const FACULTY_CURRICULUM_SUBJECT_PREFERENCE = 'faculty_curriculum_subject_preference';

    public const SECTION = 'section';

    public const FACULTY_LOAD_THRESHOLD = 'faculty_load_threshold';

    public const SCHEDULE_PROPOSAL = 'schedule_proposal';

    public const STUDENT_PROFILE = 'student_profile';

    public const AUDIT_LOG = 'audit_log';

    public const FACULTY_DIRECTORY = 'faculty_directory';

    public const ENROLLMENT = 'enrollment';

    public const ACADEMIC_GRADE = 'academic_grade';

    public const QUEUE_TICKET = 'queue_ticket';

    public const WITHDRAWAL_REQUEST = 'withdrawal_request';

    public const TRANSFEREE_CREDIT = 'transferee_credit';

    public const ACADEMIC_TERM = 'academic_term';

    public const SUBJECT_OFFERING = 'subject_offering';

    public const ACADEMIC_TERM_WORKFLOW = 'academic_term_workflow';

    public const SECTION_PLAN = 'section_plan';

    public const ACADEMIC_TERM_YEAR_LEVEL_WINDOW = 'academic_term_year_level_window';

    public const ENROLLMENT_CHANGE_REQUEST = 'enrollment_change_request';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return [
            self::CURRICULUM,
            self::SUBJECT,
            self::FACULTY_AVAILABILITY,
            self::FACULTY_SUBJECT_PREFERENCE,
            self::FACULTY_CURRICULUM_SUBJECT_PREFERENCE,
            self::SECTION,
            self::FACULTY_LOAD_THRESHOLD,
            self::SCHEDULE_PROPOSAL,
            self::STUDENT_PROFILE,
            self::AUDIT_LOG,
            self::FACULTY_DIRECTORY,
            self::ENROLLMENT,
            self::ACADEMIC_GRADE,
            self::QUEUE_TICKET,
            self::WITHDRAWAL_REQUEST,
            self::TRANSFEREE_CREDIT,
            self::ACADEMIC_TERM,
            self::SUBJECT_OFFERING,
            self::ACADEMIC_TERM_WORKFLOW,
            self::SECTION_PLAN,
            self::ACADEMIC_TERM_YEAR_LEVEL_WINDOW,
            self::ENROLLMENT_CHANGE_REQUEST,
        ];
    }
}
