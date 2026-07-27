<?php

namespace Tests\Unit\Models;

use App\Domain\Organization\AcademicTermStatus;
use App\Models\AcademicTerm;
use Carbon\CarbonImmutable;
use Tests\TestCase;

final class AcademicTermTest extends TestCase
{
    public function test_status_attribute_uses_the_canonical_enum_cast(): void
    {
        $term = new AcademicTerm;
        $term->forceFill([
            'school_year' => '2026-2027',
            'semester' => '1st',
            'status' => 'planning',
        ]);

        self::assertSame(AcademicTermStatus::Planning, $term->status);
    }

    public function test_datetime_fields_are_cast_to_carbon_immutable(): void
    {
        $term = new AcademicTerm;
        $term->forceFill([
            'school_year' => '2026-2027',
            'semester' => '1st',
            'status' => 'planning',
            'starts_at' => '2026-08-01 00:00:00',
        ]);

        self::assertInstanceOf(CarbonImmutable::class, $term->starts_at);
    }
}
