<?php

namespace App\Models;

use App\Domain\Academic\GradeStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $student_id
 * @property int $subject_id
 * @property ?int $section_id
 * @property int $academic_term_id
 * @property ?string $final_grade
 * @property ?string $remarks
 * @property GradeStatus $status
 * @property int $encoded_by
 * @property ?CarbonImmutable $submitted_at
 * @property ?CarbonImmutable $locked_at
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read StudentProfile $student
 * @property-read Subject $subject
 * @property-read ?Section $section
 * @property-read AcademicTerm $academicTerm
 * @property-read User $encoder
 */
final class AcademicGrade extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'student_id',
        'subject_id',
        'section_id',
        'academic_term_id',
        'final_grade',
        'remarks',
        'status',
        'encoded_by',
        'submitted_at',
        'locked_at',
    ];

    /**
     * `final_grade` is intentionally NOT cast to float. The official grading
     * scale, special marks, and equivalent grades are open PRD §17 decisions,
     * so the value is carried as the exact decimal string MySQL returns rather
     * than being coerced into a numeric type this system would then be
     * implicitly interpreting.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => GradeStatus::class,
            'submitted_at' => 'immutable_datetime',
            'locked_at' => 'immutable_datetime',
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
     * @return BelongsTo<Section, $this>
     */
    public function section(): BelongsTo
    {
        return $this->belongsTo(Section::class);
    }

    /**
     * @return BelongsTo<AcademicTerm, $this>
     */
    public function academicTerm(): BelongsTo
    {
        return $this->belongsTo(AcademicTerm::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function encoder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'encoded_by');
    }
}
