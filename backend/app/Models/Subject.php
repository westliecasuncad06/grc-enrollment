<?php

namespace App\Models;

use App\Domain\Curriculum\SubjectStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $code
 * @property string $title
 * @property int $units
 * @property SubjectStatus $status
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read Collection<int, CurriculumSubject> $placements
 */
final class Subject extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'code',
        'title',
        'units',
        'status',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'units' => 'integer',
            'status' => SubjectStatus::class,
        ];
    }

    /**
     * @return HasMany<CurriculumSubject, $this>
     */
    public function placements(): HasMany
    {
        return $this->hasMany(CurriculumSubject::class);
    }

    /**
     * Restricts the result set for learner-scoped roles to learner-visible
     * subjects. Planning roles (see UserRole::isLearnerScoped()) are passed
     * through unfiltered — they see the full catalog.
     *
     * @param  Builder<Subject>  $query
     * @return Builder<Subject>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if (! $user->role->isLearnerScoped()) {
            return $query;
        }

        $visibleValues = array_values(array_map(
            fn (SubjectStatus $status): string => $status->value,
            array_filter(
                SubjectStatus::cases(),
                fn (SubjectStatus $status): bool => $status->isVisibleToLearners(),
            ),
        ));

        return $query->whereIn('status', $visibleValues);
    }
}
