<?php

namespace App\Models;

use App\Domain\Enrollment\EnrollmentDocumentType;
use App\Domain\Identity\UserRole;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
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

    /**
     * FR-FIN-010: a Student sees only their own generated documents; the
     * Registrar Head, as keeper of the official record, sees every one.
     * Registrar Staff gets the same broad read access per PRD §3.8 ("view
     * permitted ... enrollment documents"), widened in Phase 7b Task 3. No
     * other role reads this endpoint — `EnrollmentDocumentPolicy::viewAny`
     * restricts every other role to zero rows before this scope ever runs.
     *
     * @param  Builder<EnrollmentDocument>  $query
     * @return Builder<EnrollmentDocument>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if (in_array($user->role, [UserRole::RegistrarHead, UserRole::RegistrarStaff], true)) {
            return $query;
        }

        return $query->whereHas('enrollment.student', fn ($studentQuery) => $studentQuery->where('user_id', $user->id));
    }
}
