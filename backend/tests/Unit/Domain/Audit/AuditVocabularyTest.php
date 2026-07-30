<?php

namespace Tests\Unit\Domain\Audit;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use PHPUnit\Framework\TestCase;

final class AuditVocabularyTest extends TestCase
{
    public function test_action_values_are_the_thirty_two_approved_actions(): void
    {
        self::assertSame(
            [
                'curriculum.created',
                'curriculum.updated',
                'faculty_availability.created',
                'faculty_availability.updated',
                'faculty_availability.deleted',
                'faculty_subject_preference.created',
                'faculty_subject_preference.updated',
                'faculty_subject_preference.deleted',
                'section.created',
                'section.updated',
                'schedule_proposal.created',
                'schedule_proposal.dean_approved',
                'schedule_proposal.dean_returned',
                'schedule_proposal.executive_approved',
                'schedule_proposal.executive_returned',
                'schedule_proposal.published',
                'section.published',
                'schedule_proposal.closed',
                'student_profile.provisioned',
                'audit_log.list_viewed',
                'faculty_directory.list_viewed',
                'enrollment.submitted',
                'enrollment.registrar_approved',
                'enrollment.registrar_rejected',
                'enrollment.voided',
                'academic_grade.created',
                'academic_grade.updated',
                'academic_grade.submitted',
                'academic_grade.locked',
                'queue_ticket.serving_started',
                'queue_ticket.served',
                'enrollment.payment_confirmed',
            ],
            AuditAction::values(),
        );
    }

    public function test_auditable_type_values_are_the_approved_subjects(): void
    {
        self::assertSame(
            [
                'curriculum',
                'faculty_availability',
                'faculty_subject_preference',
                'section',
                'schedule_proposal',
                'student_profile',
                'audit_log',
                'faculty_directory',
                'enrollment',
                'academic_grade',
                'queue_ticket',
            ],
            AuditableType::values(),
        );
    }
}
