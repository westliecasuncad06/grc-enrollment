<?php

namespace App\Models;

use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\FinancialStatus;
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
 * @property ?int $entry_year
 * @property int $year_level
 * @property ?string $enrollment_category
 * @property ?CarbonImmutable $enrollment_category_derived_at
 * @property AdmissionStatus $admission_status
 * @property AcademicStanding $academic_standing
 * @property ?FinancialStatus $financial_status
 * @property ?string $address
 * @property ?CarbonImmutable $requirements_verified_at
 * @property ?int $requirements_verified_by
 * @property bool $is_demo_account
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read User $user
 * @property-read Program $program
 * @property-read Curriculum $curriculum
 * @property-read Collection<int, Enrollment> $enrollments
 * @property-read Collection<int, AcademicGrade> $grades
 * @property-read Collection<int, AccountPayment> $accountPayments
 */
final class StudentProfile extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'user_id',
        'student_number',
        'program_id',
        'curriculum_id',
        'entry_year',
        'year_level',
        'enrollment_category',
        'enrollment_category_derived_at',
        'admission_status',
        'academic_standing',
        'financial_status',
        'address',
        'requirements_verified_at',
        'requirements_verified_by',
        'is_demo_account',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'entry_year' => 'integer',
            'year_level' => 'integer',
            'enrollment_category_derived_at' => 'immutable_datetime',
            'admission_status' => AdmissionStatus::class,
            'academic_standing' => AcademicStanding::class,
            'financial_status' => FinancialStatus::class,
            'requirements_verified_at' => 'immutable_datetime',
            'is_demo_account' => 'boolean',
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

    /**
     * @return HasMany<AccountPayment, $this>
     */
    public function accountPayments(): HasMany
    {
        return $this->hasMany(AccountPayment::class, 'student_id');
    }

    /** @return HasMany<StudentProfileChangeRequest, $this> */
    public function profileChangeRequests(): HasMany
    {
        return $this->hasMany(StudentProfileChangeRequest::class, 'student_id');
    }
}
