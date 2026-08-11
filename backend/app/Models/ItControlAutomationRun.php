<?php

namespace App\Models;

use App\Domain\ItControl\AutomationRunStatus;
use App\Domain\ItControl\AutomationStep;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property AutomationStep $step
 * @property int $academic_term_id
 * @property AutomationRunStatus $status
 * @property int $processed_count
 * @property int $failed_count
 * @property ?array<int, string> $warnings
 * @property ?string $error_summary
 * @property int $initiated_by
 * @property ?CarbonImmutable $started_at
 * @property ?CarbonImmutable $completed_at
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 */
final class ItControlAutomationRun extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'step',
        'academic_term_id',
        'status',
        'processed_count',
        'failed_count',
        'warnings',
        'error_summary',
        'initiated_by',
        'started_at',
        'completed_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'step' => AutomationStep::class,
            'status' => AutomationRunStatus::class,
            'warnings' => 'array',
            'started_at' => 'immutable_datetime',
            'completed_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<AcademicTerm, $this> */
    public function academicTerm(): BelongsTo
    {
        return $this->belongsTo(AcademicTerm::class);
    }

    /** @return BelongsTo<User, $this> */
    public function initiatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiated_by');
    }
}
