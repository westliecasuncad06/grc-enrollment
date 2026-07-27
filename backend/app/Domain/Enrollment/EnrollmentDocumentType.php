<?php

namespace App\Domain\Enrollment;

/**
 * Generated enrollment artifacts.
 *
 * DELIBERATELY SINGLE-VALUED. PRD §10.3 says to support "at minimum `com`; add
 * `cor` only if GRC confirms it is a distinct artifact", and PRD §17 lists the
 * COR-versus-COM question as an open decision. Adding a `Cor` case here before
 * that confirmation would encode an unapproved institutional assumption, so
 * the enum stays at one value and the column stays a plain string.
 */
enum EnrollmentDocumentType: string
{
    case Com = 'com';

    public function label(): string
    {
        return match ($this) {
            self::Com => 'Certificate of Matriculation',
        };
    }
}
