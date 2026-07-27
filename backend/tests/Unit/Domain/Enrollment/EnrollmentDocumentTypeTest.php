<?php

namespace Tests\Unit\Domain\Enrollment;

use App\Domain\Enrollment\EnrollmentDocumentType;
use PHPUnit\Framework\TestCase;

final class EnrollmentDocumentTypeTest extends TestCase
{
    public function test_the_enum_is_deliberately_single_valued(): void
    {
        self::assertSame(['com'], array_column(EnrollmentDocumentType::cases(), 'value'));
    }

    public function test_label_is_stable_and_human_readable(): void
    {
        self::assertSame(
            'Certificate of Matriculation',
            EnrollmentDocumentType::Com->label(),
        );
    }
}
