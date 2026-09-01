<?php

namespace App\Models;

use App\Domain\Identity\FacultyEmploymentType;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\CollegeCode;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Passwords\CanResetPassword;
use Illuminate\Contracts\Auth\CanResetPassword as CanResetPasswordContract;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

/**
 * @property int $id
 * @property string $name
 * @property ?string $first_name
 * @property ?string $middle_initial
 * @property ?string $last_name
 * @property ?string $suffix
 * @property string $email
 * @property string $password
 * @property UserRole $role
 * @property ?CollegeCode $college
 * @property ?FacultyEmploymentType $employment_type
 * @property UserStatus $status
 * @property ?string $deactivation_reason
 * @property ?CarbonImmutable $last_login_at
 * @property ?CarbonImmutable $account_setup_completed_at
 * @property ?CarbonImmutable $account_setup_invitation_sent_at
 * @property ?CarbonImmutable $account_setup_invitation_failed_at
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read Collection<int, AuditLog> $auditLogs
 * @property-read Collection<int, Notification> $notifications
 * @property-read ?QueueKioskCredential $queueKioskCredential
 * @property-read ?StudentProfile $studentProfile
 */
final class User extends Authenticatable implements CanResetPasswordContract
{
    use CanResetPassword;
    use HasApiTokens;

    /** @var list<string> */
    protected $fillable = [
        'name',
        'first_name',
        'middle_initial',
        'last_name',
        'suffix',
        'email',
        'password',
        'role',
        'college',
        'employment_type',
        'status',
        'deactivation_reason',
        'last_login_at',
        'account_setup_completed_at',
        'account_setup_invitation_sent_at',
        'account_setup_invitation_failed_at',
    ];

    /** @var list<string> */
    protected $hidden = [
        'password',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'role' => UserRole::class,
            'college' => CollegeCode::class,
            'employment_type' => FacultyEmploymentType::class,
            'status' => UserStatus::class,
            'last_login_at' => 'immutable_datetime',
            'account_setup_completed_at' => 'immutable_datetime',
            'account_setup_invitation_sent_at' => 'immutable_datetime',
            'account_setup_invitation_failed_at' => 'immutable_datetime',
        ];
    }

    /**
     * @return HasMany<AuditLog, $this>
     */
    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class, 'actor_user_id');
    }

    /**
     * @return HasMany<Notification, $this>
     */
    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    /**
     * @return HasOne<QueueKioskCredential, $this>
     */
    public function queueKioskCredential(): HasOne
    {
        return $this->hasOne(QueueKioskCredential::class);
    }

    /** @return HasOne<StudentProfile, $this> */
    public function studentProfile(): HasOne
    {
        return $this->hasOne(StudentProfile::class);
    }
}
