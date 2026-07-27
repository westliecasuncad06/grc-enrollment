<?php

namespace App\Models;

use App\Domain\Scheduling\SectionStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $academic_term_id
 * @property int $subject_id
 * @property string $section_code
 * @property ?int $professor_id
 * @property ?string $schedule_days
 * @property ?string $starts_at_time
 * @property ?string $ends_at_time
 * @property ?string $room
 * @property int $capacity
 * @property ?int $viability_threshold
 * @property int $enrolled_count
 * @property SectionStatus $status
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read AcademicTerm $academicTerm
 * @property-read Subject $subject
 * @property-read ?User $professor
 * @property-read Collection<int, EnrollmentSubject> $enrollmentSubjects
 */
final class Section extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'academic_term_id',
        'subject_id',
        'section_code',
        'professor_id',
        'schedule_days',
        'starts_at_time',
        'ends_at_time',
        'room',
        'capacity',
        'viability_threshold',
        'enrolled_count',
        'status',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => SectionStatus::class,
            'capacity' => 'integer',
            'viability_threshold' => 'integer',
            'enrolled_count' => 'integer',
        ];
    }

    /**
     * Remaining seats, floored at zero so an over-filled section never reports
     * negative availability. This is a convenience for display only — it does
     * NOT authorize enrollment, because the reservation timeout and seat-release
     * rules that would make it authoritative are open PRD §17 decisions.
     */
    public function remainingSeats(): int
    {
        return max(0, $this->capacity - $this->enrolled_count);
    }

    /**
     * @return BelongsTo<AcademicTerm, $this>
     */
    public function academicTerm(): BelongsTo
    {
        return $this->belongsTo(AcademicTerm::class);
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
    public function professor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'professor_id');
    }

    /**
     * @return HasMany<EnrollmentSubject, $this>
     */
    public function enrollmentSubjects(): HasMany
    {
        return $this->hasMany(EnrollmentSubject::class);
    }
}
