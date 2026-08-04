<?php

namespace Tests\Unit\Domain\Organization;

use App\Domain\Organization\CollegeCode;
use App\Domain\Organization\SectionBlockCode;
use PHPUnit\Framework\TestCase;

final class SectionBlockCodeTest extends TestCase
{
    public function test_it_formats_ccs_coe_and_coa_blocks_by_year_and_ordinal(): void
    {
        self::assertSame('IT101', SectionBlockCode::fromProgram('BSIT', CollegeCode::Ccs, 1, 1));
        self::assertSame('IT203', SectionBlockCode::fromProgram('BSCS', CollegeCode::Ccs, 2, 3));
        self::assertSame('EDUC102', SectionBlockCode::fromProgram('BEED', CollegeCode::Coe, 1, 2));
        self::assertSame('ACC401', SectionBlockCode::fromProgram('BSA', CollegeCode::Coa, 4, 1));
    }

    public function test_it_uses_the_cbae_major_prefix(): void
    {
        self::assertSame('FM101', SectionBlockCode::fromProgram('BSBA-FM', CollegeCode::Cbae, 1, 1));
        self::assertSame('EN102', SectionBlockCode::fromProgram('BSENTREP', CollegeCode::Cbae, 1, 2));
        self::assertSame('MM201', SectionBlockCode::fromProgram('BSBA-MM', CollegeCode::Cbae, 2, 1));
        self::assertSame('HR301', SectionBlockCode::fromProgram('BSBA-HRM', CollegeCode::Cbae, 3, 1));
    }
}
