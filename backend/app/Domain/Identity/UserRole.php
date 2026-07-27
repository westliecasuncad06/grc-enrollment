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
        };
    }
}
