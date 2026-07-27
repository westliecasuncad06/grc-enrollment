<?php

namespace Tests\Unit\Models;

use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Models\StudentProfile;
use PHPUnit\Framework\TestCase;

final class StudentProfileTest extends TestCase
{
    public function test_admission_status_and_academic_standing_use_their_canonical_enum_casts(): void
    {
        $profile = new StudentProfile;
        $profile->forceFill([
            'user_id' => 1,
            'student_number' => 'STU-0001',
            'program_id' => 1,
            'curriculum_id' => 1,
            'year_level' => '1',
            'admission_status' => 'admitted',
            'academic_standing' => 'good',
        ]);

        self::assertSame(AdmissionStatus::Admitted, $profile->admission_status);
        self::assertSame(AcademicStanding::Good, $profile->academic_standing);
        self::assertSame(1, $profile->year_level);
    }
}
