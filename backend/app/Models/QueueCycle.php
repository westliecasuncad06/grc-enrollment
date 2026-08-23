<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One continuous Cashier queue line. Opens on first claim, stays open
 * across a cut-off, and closes only once drained and a Manila day has
 * passed since its last claim — see App\Actions\Enrollment\ClaimQueueTicket
 * and docs/superpowers/specs/2026-08-23-queue-kiosk-claim-carryover-cutoff-design.md.
 * `open_marker` (a stored generated column, see the creating migration)
 * backs the database-enforced "at most one open cycle" invariant.
 *
 * @property int $id
 * @property CarbonImmutable $opened_on
 * @property ?CarbonImmutable $last_claimed_on
 * @property int $last_ticket_sequence
 * @property ?CarbonImmutable $cut_off_at
 * @property ?CarbonImmutable $cut_off_service_date
 * @property ?int $cut_off_by
 * @property ?CarbonImmutable $closed_at
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read list<QueueTicket> $tickets
 */
final class QueueCycle extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'opened_on',
        'last_claimed_on',
        'last_ticket_sequence',
        'cut_off_at',
        'cut_off_service_date',
        'cut_off_by',
        'closed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'opened_on' => 'immutable_date',
            'last_claimed_on' => 'immutable_date',
            'cut_off_at' => 'immutable_datetime',
            'cut_off_service_date' => 'immutable_date',
            'closed_at' => 'immutable_datetime',
        ];
    }

    /**
     * @return HasMany<QueueTicket, $this>
     */
    public function tickets(): HasMany
    {
        return $this->hasMany(QueueTicket::class);
    }
}
