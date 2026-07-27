<?php

namespace Tests\Unit\Models;

use App\Domain\Enrollment\EnrollmentDocumentType;
use App\Models\EnrollmentDocument;
use Carbon\CarbonImmutable;
use Tests\TestCase;

final class EnrollmentDocumentTest extends TestCase
{
    public function test_document_type_and_generated_at_use_their_canonical_casts(): void
    {
        $document = new EnrollmentDocument;
        $document->forceFill([
            'enrollment_id' => 1,
            'document_type' => 'com',
            'document_number' => 'COM-2026-000001',
            'generated_at' => '2026-08-05 09:00:00',
        ]);

        self::assertSame(EnrollmentDocumentType::Com, $document->document_type);
        self::assertInstanceOf(CarbonImmutable::class, $document->generated_at);
    }
}
