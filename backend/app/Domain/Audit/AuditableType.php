<?php

namespace App\Domain\Audit;

final class AuditableType
{
    public const CURRICULUM = 'curriculum';

    public const FACULTY_AVAILABILITY = 'faculty_availability';

    public const FACULTY_SUBJECT_PREFERENCE = 'faculty_subject_preference';

    public const SECTION = 'section';

    public const SCHEDULE_PROPOSAL = 'schedule_proposal';

    public const STUDENT_PROFILE = 'student_profile';

    public const AUDIT_LOG = 'audit_log';

    public const FACULTY_DIRECTORY = 'faculty_directory';

    public const ENROLLMENT = 'enrollment';

    public const ACADEMIC_GRADE = 'academic_grade';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return [
            self::CURRICULUM,
            self::FACULTY_AVAILABILITY,
            self::FACULTY_SUBJECT_PREFERENCE,
            self::SECTION,
            self::SCHEDULE_PROPOSAL,
            self::STUDENT_PROFILE,
            self::AUDIT_LOG,
            self::FACULTY_DIRECTORY,
            self::ENROLLMENT,
            self::ACADEMIC_GRADE,
        ];
    }
}
