<?php

namespace App\Models;

use App\Domain\Enrollment\QueueTicketStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $enrollment_id
 * @property string $ticket_number
 * @property CarbonImmutable $queue_date
 * @property QueueTicketStatus $status
 * @property ?CarbonImmutable $served_at
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read Enrollment $enrollment
 */
final class QueueTicket extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'enrollment_id',
        'ticket_number',
        'queue_date',
        'status',
        'served_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => QueueTicketStatus::class,
            'queue_date' => 'immutable_date',
            'served_at' => 'immutable_datetime',
        ];
    }

    /**
     * @return BelongsTo<Enrollment, $this>
     */
    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }
}
