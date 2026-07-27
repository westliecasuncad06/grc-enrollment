<?php

namespace App\Models;

use App\Domain\Enrollment\EnrollmentDocumentType;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $enrollment_id
 * @property EnrollmentDocumentType $document_type
 * @property string $document_number
 * @property ?string $storage_path
 * @property ?string $content_hash
 * @property CarbonImmutable $generated_at
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read Enrollment $enrollment
 */
final class EnrollmentDocument extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'enrollment_id',
        'document_type',
        'document_number',
        'storage_path',
        'content_hash',
        'generated_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'document_type' => EnrollmentDocumentType::class,
            'generated_at' => 'immutable_datetime',
        ];
    }

    /**
     * @return BelongsTo<Enrollment, $this>
     */
    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }
}
