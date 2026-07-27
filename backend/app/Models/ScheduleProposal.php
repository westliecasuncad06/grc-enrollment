<?php

namespace App\Models;

use App\Domain\Scheduling\ScheduleProposalStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $academic_term_id
 * @property int $submitted_by
 * @property ScheduleProposalStatus $status
 * @property ?int $decided_by
 * @property ?CarbonImmutable $decided_at
 * @property ?string $decision_reason
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read AcademicTerm $academicTerm
 * @property-read User $submitter
 * @property-read ?User $decider
 */
final class ScheduleProposal extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'academic_term_id',
        'submitted_by',
        'status',
        'decided_by',
        'decided_at',
        'decision_reason',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => ScheduleProposalStatus::class,
            'decided_at' => 'immutable_datetime',
        ];
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
    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    /**
     * Restricts the result set for learner-scoped roles to
     * published/closed proposals. Planning roles see every proposal
     * regardless of status. Same pattern as Curriculum/Section::scopeVisibleTo().
     *
     * @param  Builder<ScheduleProposal>  $query
     * @return Builder<ScheduleProposal>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if (! $user->role->isLearnerScoped()) {
            return $query;
        }

        $visibleValues = array_values(array_map(
            fn (ScheduleProposalStatus $status): string => $status->value,
            array_filter(
                ScheduleProposalStatus::cases(),
                fn (ScheduleProposalStatus $status): bool => $status->isVisibleToLearners(),
            ),
        ));

        return $query->whereIn('status', $visibleValues);
    }
}
