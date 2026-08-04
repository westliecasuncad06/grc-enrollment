<?php

namespace App\Models;

use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $user_id
 * @property string $student_number
 * @property int $program_id
 * @property int $curriculum_id
 * @property int $year_level
 * @property ?string $enrollment_category
 * @property ?CarbonImmutable $enrollment_category_derived_at
 * @property AdmissionStatus $admission_status
 * @property AcademicStanding $academic_standing
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read User $user
 * @property-read Program $program
 * @property-read Curriculum $curriculum
 * @property-read Collection<int, Enrollment> $enrollments
 * @property-read Collection<int, AcademicGrade> $grades
 */
final class StudentProfile extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'user_id',
        'student_number',
        'program_id',
        'curriculum_id',
        'year_level',
        'enrollment_category',
        'enrollment_category_derived_at',
        'admission_status',
        'academic_standing',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'year_level' => 'integer',
            'enrollment_category_derived_at' => 'immutable_datetime',
            'admission_status' => AdmissionStatus::class,
            'academic_standing' => AcademicStanding::class,
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Program, $this>
     */
    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    /**
     * @return BelongsTo<Curriculum, $this>
     */
    public function curriculum(): BelongsTo
    {
        return $this->belongsTo(Curriculum::class);
    }

    /**
     * @return HasMany<Enrollment, $this>
     */
    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class, 'student_id');
    }

    /**
     * @return HasMany<AcademicGrade, $this>
     */
    public function grades(): HasMany
    {
        return $this->hasMany(AcademicGrade::class, 'student_id');
    }
}
