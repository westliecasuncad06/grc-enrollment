<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class FacultyAssignmentRecommendation extends Model
{
    protected $fillable = [
        'schedule_generation_run_id', 'section_id', 'recommended_professor_id',
        'preference_rank', 'availability_match', 'conflict_free', 'rationale',
    ];

    protected function casts(): array
    {
        return [
            'preference_rank' => 'integer',
            'availability_match' => 'boolean',
            'conflict_free' => 'boolean',
            'rationale' => 'array',
        ];
    }

    /** @return BelongsTo<ScheduleGenerationRun, $this> */
    public function scheduleGenerationRun(): BelongsTo
    {
        return $this->belongsTo(ScheduleGenerationRun::class);
    }

    /** @return BelongsTo<Section, $this> */
    public function section(): BelongsTo
    {
        return $this->belongsTo(Section::class);
    }

    /** @return BelongsTo<User, $this> */
    public function recommendedProfessor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recommended_professor_id');
    }
}
