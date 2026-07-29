<?php

namespace App\Models;

use App\Domain\Enrollment\EnrollmentStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property int $id
 * @property int $student_id
 * @property int $academic_term_id
 * @property EnrollmentStatus $status
 * @property float $total_units
 * @property ?CarbonImmutable $submitted_at
 * @property ?CarbonImmutable $registrar_decided_at
 * @property ?CarbonImmutable $payment_confirmed_at
 * @property ?CarbonImmutable $enrolled_at
 * @property ?int $active_academic_term_id
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read StudentProfile $student
 * @property-read AcademicTerm $academicTerm
 * @property-read Collection<int, EnrollmentSubject> $enrollmentSubjects
 * @property-read ?QueueTicket $queueTicket
 * @property-read ?Payment $payment
 * @property-read Collection<int, EnrollmentDocument> $documents
 */
final class Enrollment extends Model
{
    /**
     * `active_academic_term_id` is deliberately absent: it is a STORED
     * generated column maintained by the database (see the enrollments
     * migration), and attempting to write it would raise a SQL error.
     *
     * @var list<string>
     */
    protected $fillable = [
        'student_id',
        'academic_term_id',
        'status',
        'total_units',
        'submitted_at',
        'registrar_decided_at',
        'payment_confirmed_at',
        'enrolled_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => EnrollmentStatus::class,
            'total_units' => 'float',
            'submitted_at' => 'immutable_datetime',
            'registrar_decided_at' => 'immutable_datetime',
            'payment_confirmed_at' => 'immutable_datetime',
            'enrolled_at' => 'immutable_datetime',
        ];
    }

    /**
     * Enrollments that still hold the student's seat for their term. Mirrors
     * the database's generated-column definition; see EnrollmentStatus.
     *
     * @param  Builder<Enrollment>  $query
     * @return Builder<Enrollment>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNotIn('status', EnrollmentStatus::terminalValues());
    }

    /**
     * @return BelongsTo<StudentProfile, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(StudentProfile::class, 'student_id');
    }

    /**
     * @return BelongsTo<AcademicTerm, $this>
     */
    public function academicTerm(): BelongsTo
    {
        return $this->belongsTo(AcademicTerm::class);
    }

    /**
     * @return HasMany<EnrollmentSubject, $this>
     */
    public function enrollmentSubjects(): HasMany
    {
        return $this->hasMany(EnrollmentSubject::class);
    }

    /**
     * @return HasOne<QueueTicket, $this>
     */
    public function queueTicket(): HasOne
    {
        return $this->hasOne(QueueTicket::class);
    }

    /**
     * @return HasOne<Payment, $this>
     */
    public function payment(): HasOne
    {
        return $this->hasOne(Payment::class);
    }

    /**
     * @return HasMany<EnrollmentDocument, $this>
     */
    public function documents(): HasMany
    {
        return $this->hasMany(EnrollmentDocument::class);
    }
}
