<?php

namespace App\Models;

use App\Domain\Organization\ProgramStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $code
 * @property string $name
 * @property ProgramStatus $status
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 */
final class Program extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'code',
        'name',
        'status',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => ProgramStatus::class,
        ];
    }

    /**
     * Restricts the result set for learner-scoped roles to learner-visible
     * programs. Planning roles (see UserRole::isLearnerScoped()) are passed
     * through unfiltered — they see the full catalog.
     *
     * @param  Builder<Program>  $query
     * @return Builder<Program>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if (! $user->role->isLearnerScoped()) {
            return $query;
        }

        $visibleValues = array_values(array_map(
            fn (ProgramStatus $status): string => $status->value,
            array_filter(
                ProgramStatus::cases(),
                fn (ProgramStatus $status): bool => $status->isVisibleToLearners(),
            ),
        ));

        return $query->whereIn('status', $visibleValues);
    }
}
