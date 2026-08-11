<?php

namespace App\Domain\Identity;

enum UserRole: string
{
    case Student = 'student';
    case AdmissionStaff = 'admission_staff';
    case Faculty = 'faculty';
    case ProgramChair = 'program_chair';
    case Dean = 'dean';
    case ExecutiveDirector = 'executive_director';
    case RegistrarHead = 'registrar_head';
    case RegistrarStaff = 'registrar_staff';
    case AccountingStaff = 'accounting_staff';
    case ItAdmin = 'it_admin';

    public function label(): string
    {
        return match ($this) {
            self::Student => 'Student',
            self::AdmissionStaff => 'Admission Staff',
            self::Faculty => 'Professor / Faculty',
            self::ProgramChair => 'Program Chair',
            self::Dean => 'Dean',
            self::ExecutiveDirector => 'Executive Director',
            self::RegistrarHead => 'Registrar Head',
            self::RegistrarStaff => 'Registrar Staff',
            self::AccountingStaff => 'Accounting Staff',
            self::ItAdmin => 'IT Control',
        };
    }

    /**
     * Learner-scoped roles see only learner-visible organization records
     * (e.g. active programs, non-planning terms). Every other role plans
     * that data and sees the full catalog regardless of visibility status.
     * See Program::scopeVisibleTo() and AcademicTerm::scopeVisibleTo().
     */
    public function isLearnerScoped(): bool
    {
        return match ($this) {
            self::Student, self::Faculty, self::AccountingStaff => true,
            self::AdmissionStaff,
            self::ProgramChair,
            self::Dean,
            self::ExecutiveDirector,
            self::RegistrarHead,
            self::RegistrarStaff,
            self::ItAdmin => false,
        };
    }
}
