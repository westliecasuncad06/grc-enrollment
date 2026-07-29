<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/**
 * @property int $id
 * @property int $actor_user_id
 * @property string $action
 * @property string $auditable_type
 * @property ?int $auditable_id
 * @property ?array<string, mixed> $before_values
 * @property ?array<string, mixed> $after_values
 * @property ?string $reason
 * @property string $request_id
 * @property ?string $ip_address
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read User $actor
 */
final class AuditLog extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'actor_user_id',
        'action',
        'auditable_type',
        'auditable_id',
        'before_values',
        'after_values',
        'reason',
        'request_id',
        'ip_address',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'before_values' => 'array',
            'after_values' => 'array',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }

    protected static function booted(): void
    {
        self::updating(static function (): never {
            throw new LogicException('Audit logs are immutable.');
        });

        self::deleting(static function (): never {
            throw new LogicException('Audit logs are immutable.');
        });
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
