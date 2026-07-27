<?php

namespace App\Models;

use App\Domain\Curriculum\CurriculumStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $program_id
 * @property string $name
 * @property string $effective_school_year
 * @property CurriculumStatus $status
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read Program $program
 * @property-read Collection<int, CurriculumSubject> $subjectPlacements
 */
final class Curriculum extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'program_id',
        'name',
        'effective_school_year',
        'status',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => CurriculumStatus::class,
        ];
    }

    /**
     * @return BelongsTo<Program, $this>
     */
    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    /**
     * @return HasMany<CurriculumSubject, $this>
     */
    public function subjectPlacements(): HasMany
    {
        return $this->hasMany(CurriculumSubject::class);
    }

    /**
     * Restricts the result set for learner-scoped roles to learner-visible
     * curricula. Planning roles (see UserRole::isLearnerScoped()) are passed
     * through unfiltered — they see every curriculum regardless of status.
     *
     * @param  Builder<Curriculum>  $query
     * @return Builder<Curriculum>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if (! $user->role->isLearnerScoped()) {
            return $query;
        }

        $visibleValues = array_values(array_map(
            fn (CurriculumStatus $status): string => $status->value,
            array_filter(
                CurriculumStatus::cases(),
                fn (CurriculumStatus $status): bool => $status->isVisibleToLearners(),
            ),
        ));

        return $query->whereIn('status', $visibleValues);
    }
}
