<?php

namespace Tests\Unit\Domain\Enrollment;

use App\Domain\Enrollment\CorDisplay;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class CorDisplayTest extends TestCase
{
    /**
     * @return array<string, array{int|string|null, string}>
     */
    public static function yearLevels(): array
    {
        return [
            'legacy snapshot wording' => ['Year 1', '1st Year'],
            'second' => ['Year 2', '2nd Year'],
            'third' => ['Year 3', '3rd Year'],
            'fourth' => ['Year 4', '4th Year'],
            'plain number' => [3, '3rd Year'],
            'numeric string' => ['2', '2nd Year'],
            'already ordinal' => ['1st Year', '1st Year'],
            'teens use th' => [11, '11th Year'],
            'empty string' => ['', '—'],
            'null' => [null, '—'],
            'zero' => [0, '—'],
            'no digits is returned unchanged' => ['Irregular', 'Irregular'],
        ];
    }

    #[DataProvider('yearLevels')]
    public function test_year_level_uses_the_approved_ordinal_wording(int|string|null $input, string $expected): void
    {
        $this->assertSame($expected, CorDisplay::yearLevel($input));
    }

    public function test_sentence_rewrites_only_the_year_level_phrase(): void
    {
        $this->assertSame(
            'This is to certify that Ana Cruz is cleared and enrolled for SY 2026-2027, 1st for BS Information Technology, 3rd Year.',
            CorDisplay::sentence('This is to certify that Ana Cruz is cleared and enrolled for SY 2026-2027, 1st for BS Information Technology, Year 3.'),
        );
    }

    public function test_sentence_without_a_year_level_is_unchanged(): void
    {
        $text = 'This is to certify that Test Student is cleared and enrolled.';

        $this->assertSame($text, CorDisplay::sentence($text));
    }
}
