<?php

namespace Tests\Unit\Domain\Identity;

use App\Domain\Identity\PersonName;
use Tests\TestCase;

final class PersonNameTest extends TestCase
{
    public function test_composes_first_and_last_only(): void
    {
        self::assertSame('Aurora Lopez', PersonName::compose('Aurora', null, 'Lopez', null));
    }

    public function test_composes_with_a_middle_initial(): void
    {
        self::assertSame('Aurora S. Lopez', PersonName::compose('Aurora', 'S', 'Lopez', null));
    }

    public function test_does_not_double_the_period_on_an_already_punctuated_initial(): void
    {
        self::assertSame('Aurora S. Lopez', PersonName::compose('Aurora', 'S.', 'Lopez', null));
    }

    public function test_composes_with_a_suffix(): void
    {
        self::assertSame('Juan Dela Cruz Jr.', PersonName::compose('Juan', null, 'Dela Cruz', 'Jr.'));
    }

    public function test_composes_with_every_part(): void
    {
        self::assertSame('Juan M. Dela Cruz III', PersonName::compose('Juan', 'M', 'Dela Cruz', 'III'));
    }

    public function test_trims_and_ignores_blank_optional_parts(): void
    {
        self::assertSame('Aurora Lopez', PersonName::compose(' Aurora ', '  ', ' Lopez ', ''));
    }
}
