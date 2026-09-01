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
 * @property ?int $equivalency_source_curriculum_id
 * @property string $name
 * @property string $effective_school_year
 * @property ?int $effective_start_year
 * @property ?int $effective_end_year
 * @property CurriculumStatus $status
 * @property ?int $decided_by
 * @property ?CarbonImmutable $decided_at
 * @property ?string $last_decision_reason
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read Program $program
 * @property-read ?Curriculum $equivalencySourceCurriculum
 * @property-read Collection<int, CurriculumSubject> $subjectPlacements
 * @property-read Collection<int, CurriculumSubjectEquivalency> $targetEquivalencies
 */
final class Curriculum extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'program_id',
        'equivalency_source_curriculum_id',
        'name',
        'effective_school_year',
        'effective_start_year',
        'effective_end_year',
        'status',
        'decided_by',
        'decided_at',
        'last_decision_reason',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => CurriculumStatus::class,
            'decided_at' => 'immutable_datetime',
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
     * The single approved/archived curriculum whose subjects can be mapped
     * as equivalents while this newer curriculum is authored.
     *
     * @return BelongsTo<Curriculum, $this>
     */
    public function equivalencySourceCurriculum(): BelongsTo
    {
        return $this->belongsTo(self::class, 'equivalency_source_curriculum_id');
    }

    /**
     * @return HasMany<CurriculumSubject, $this>
     */
    public function subjectPlacements(): HasMany
    {
        return $this->hasMany(CurriculumSubject::class);
    }

    /**
     * @return HasMany<CurriculumSubject, $this>
     */
    public function curriculumSubjects(): HasMany
    {
        return $this->hasMany(CurriculumSubject::class);
    }

    /**
     * @return HasMany<CurriculumSubjectEquivalency, $this>
     */
    public function targetEquivalencies(): HasMany
    {
        return $this->hasMany(CurriculumSubjectEquivalency::class, 'target_curriculum_id');
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

    /**
     * Query-side equivalent of `App\Domain\Curriculum\CurriculumVersion::
     * resolveForEntryYear()` — orders a program's versions so the one
     * effective for `$entryYear` sorts first. Ranges are contiguous and
     * non-overlapping by construction (see `GrcCurriculumSeeder`), so the
     * version with the highest `effective_start_year` at or before
     * `$entryYear` is always either the containing version or, if none
     * contains it, the correct fallback to the latest version already
     * started — the same rule the domain class applies to an in-memory
     * collection. Callers still combine this with `first()` (and typically
     * `where('program_id', ...)`) to get a single result.
     *
     * @param  Builder<Curriculum>  $query
     * @return Builder<Curriculum>
     */
    public function scopeEffectiveForYear(Builder $query, int $entryYear): Builder
    {
        return $query
            ->where('effective_start_year', '<=', $entryYear)
            ->orderByDesc('effective_start_year');
    }
}
