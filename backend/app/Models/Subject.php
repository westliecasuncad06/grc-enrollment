<?php

namespace App\Models;

use App\Domain\Academic\CompletionOnlySubjectRule;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Organization\CollegeCode;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $code
 * @property ?CollegeCode $college
 * @property string $title
 * @property float $units
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
        'college',
        'title',
        'units',
        'status',
    ];

    /**
     * `units` is a `float`, not the raw decimal string: unlike
     * `academic_grades.final_grade`, a unit count carries no §17
     * policy ambiguity, so it is safe to coerce to a numeric type.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'college' => CollegeCode::class,
            'units' => 'float',
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
     * True for subjects graded Complete/Not-Complete only — Leadership
     * (LEAD 1-8) per `config('enrollment.grading.completion_only_code_prefixes')`.
     */
    public function isCompletionOnly(): bool
    {
        /** @var list<string> $prefixes */
        $prefixes = (array) config('enrollment.grading.completion_only_code_prefixes', []);

        return CompletionOnlySubjectRule::matches($this->code, $prefixes);
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
