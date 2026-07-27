<?php

namespace App\Models;

use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property string $password
 * @property UserRole $role
 * @property UserStatus $status
 * @property ?CarbonImmutable $last_login_at
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 */
final class User extends Authenticatable
{
    use HasApiTokens;

    /** @var list<string> */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'status',
        'last_login_at',
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
            'status' => UserStatus::class,
            'last_login_at' => 'immutable_datetime',
        ];
    }
}
