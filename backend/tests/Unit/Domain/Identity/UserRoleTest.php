<?php

namespace Tests\Unit\Domain\Identity;

use App\Domain\Identity\UserRole;
use PHPUnit\Framework\TestCase;

final class UserRoleTest extends TestCase
{
    public function test_role_values_match_the_nine_prd_actors(): void
    {
        self::assertSame([
            'student',
            'admission_staff',
            'faculty',
            'program_chair',
            'dean',
            'executive_director',
            'registrar_head',
            'registrar_staff',
            'accounting_staff',
        ], array_column(UserRole::cases(), 'value'));
    }

    public function test_role_labels_are_stable_and_human_readable(): void
    {
        self::assertSame('Program Chair', UserRole::ProgramChair->label());
        self::assertSame('Accounting Staff', UserRole::AccountingStaff->label());
    }

    public function test_exactly_three_roles_are_learner_scoped(): void
    {
        self::assertSame(
            ['student', 'faculty', 'accounting_staff'],
            array_column(
                array_filter(UserRole::cases(), fn (UserRole $role): bool => $role->isLearnerScoped()),
                'value',
            ),
        );
    }

    public function test_planning_roles_are_not_learner_scoped(): void
    {
        self::assertFalse(UserRole::ProgramChair->isLearnerScoped());
        self::assertFalse(UserRole::Dean->isLearnerScoped());
        self::assertFalse(UserRole::ExecutiveDirector->isLearnerScoped());
        self::assertFalse(UserRole::RegistrarHead->isLearnerScoped());
        self::assertFalse(UserRole::RegistrarStaff->isLearnerScoped());
        self::assertFalse(UserRole::AdmissionStaff->isLearnerScoped());
    }
}
