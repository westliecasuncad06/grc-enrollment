<?php

namespace App\Models;

use App\Domain\Academic\TransfereeCreditStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $student_id
 * @property string $source_institution
 * @property string $source_subject_code
 * @property string $source_subject_title
 * @property ?string $source_grade
 * @property int $credited_units
 * @property ?int $subject_id
 * @property TransfereeCreditStatus $status
 * @property ?int $processed_by
 * @property ?CarbonImmutable $processed_at
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read StudentProfile $student
 * @property-read ?Subject $subject
 * @property-read ?User $processor
 */
final class TransfereeCredit extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'student_id',
        'source_institution',
        'source_subject_code',
        'source_subject_title',
        'source_grade',
        'credited_units',
        'subject_id',
        'status',
        'processed_by',
        'processed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => TransfereeCreditStatus::class,
            'credited_units' => 'integer',
            'processed_at' => 'immutable_datetime',
        ];
    }

    /**
     * @return BelongsTo<StudentProfile, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(StudentProfile::class, 'student_id');
    }

    /**
     * @return BelongsTo<Subject, $this>
     */
    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function processor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by');
    }
}
