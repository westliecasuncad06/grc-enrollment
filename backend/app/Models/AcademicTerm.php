<?php

namespace App\Models;

use App\Domain\Organization\AcademicTermStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $school_year
 * @property string $semester
 * @property ?CarbonImmutable $starts_at
 * @property ?CarbonImmutable $ends_at
 * @property ?CarbonImmutable $enrollment_opens_at
 * @property ?CarbonImmutable $enrollment_closes_at
 * @property AcademicTermStatus $status
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 */
final class AcademicTerm extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'school_year',
        'semester',
        'starts_at',
        'ends_at',
        'enrollment_opens_at',
        'enrollment_closes_at',
        'status',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'starts_at' => 'immutable_datetime',
            'ends_at' => 'immutable_datetime',
            'enrollment_opens_at' => 'immutable_datetime',
            'enrollment_closes_at' => 'immutable_datetime',
            'status' => AcademicTermStatus::class,
        ];
    }

    /**
     * Restricts the result set for learner-scoped roles to learner-visible
     * terms. Planning roles (see UserRole::isLearnerScoped()) are passed
     * through unfiltered — they see every term regardless of status.
     *
     * @param  Builder<AcademicTerm>  $query
     * @return Builder<AcademicTerm>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if (! $user->role->isLearnerScoped()) {
            return $query;
        }

        $visibleValues = array_values(array_map(
            fn (AcademicTermStatus $status): string => $status->value,
            array_filter(
                AcademicTermStatus::cases(),
                fn (AcademicTermStatus $status): bool => $status->isVisibleToLearners(),
            ),
        ));

        return $query->whereIn('status', $visibleValues);
    }
}
