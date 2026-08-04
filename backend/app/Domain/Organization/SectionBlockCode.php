<?php

namespace App\Domain\Organization;

/**
 * Human-readable identifier for a generated regular block section.
 *
 * The code is distinct from a subject code: `IT101` means the first IT
 * first-year block, while every subject contained in that block keeps its own
 * catalog code. The ordinal is intentionally two digits to mirror GRC's
 * existing schedule sheets.
 */
final class SectionBlockCode
{
    public static function fromProgram(
        string $programCode,
        CollegeCode $college,
        int $yearLevel,
        int $blockOrdinal,
    ): string {
        $prefix = match ($college) {
            CollegeCode::Ccs => 'IT',
            CollegeCode::Coe => 'EDUC',
            CollegeCode::Coa => 'ACC',
            CollegeCode::Cbae => self::cbaePrefix($programCode),
        };

        return sprintf('%s%d%02d', $prefix, $yearLevel, $blockOrdinal);
    }

    private static function cbaePrefix(string $programCode): string
    {
        $normalized = strtoupper(str_replace([' ', '_'], '', $programCode));

        return match (true) {
            str_contains($normalized, 'FINANCE') || str_contains($normalized, 'FM') => 'FM',
            str_contains($normalized, 'ENTREP') => 'EN',
            str_contains($normalized, 'MARKETING') || str_contains($normalized, 'MM') => 'MM',
            str_contains($normalized, 'HUMANRESOURCE') || str_contains($normalized, 'HRM') || str_contains($normalized, 'HR') => 'HR',
            default => 'CBAE',
        };
    }
}
