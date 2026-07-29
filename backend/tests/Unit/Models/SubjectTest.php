<?php

namespace Tests\Unit\Models;

use App\Domain\Curriculum\SubjectStatus;
use App\Models\Subject;
use PHPUnit\Framework\TestCase;

final class SubjectTest extends TestCase
{
    public function test_status_attribute_uses_the_canonical_enum_cast(): void
    {
        $subject = new Subject;
        $subject->forceFill([
            'code' => 'CS101',
            'title' => 'Intro to Programming',
            'units' => 3,
            'status' => 'active',
        ]);

        self::assertSame(SubjectStatus::Active, $subject->status);
        self::assertSame(3.0, $subject->units);
    }
}
