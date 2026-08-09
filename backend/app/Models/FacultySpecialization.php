<?php

namespace App\Models;

use App\Domain\Faculty\SpecializationProficiency;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $professor_id
 * @property int $subject_id
 * @property SpecializationProficiency $proficiency
 * @property string $source
 * @property ?string $notes
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read User $professor
 * @property-read Subject $subject
 */
final class FacultySpecialization extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'professor_id',
        'subject_id',
        'proficiency',
        'source',
        'notes',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'proficiency' => SpecializationProficiency::class,
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function professor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'professor_id');
    }

    /** @return BelongsTo<Subject, $this> */
    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    /**
     * Faculty members see only their own profile. Planning roles need the
     * full teaching-capability picture when preparing assignments.
     *
     * @param  Builder<FacultySpecialization>  $query
     * @return Builder<FacultySpecialization>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if (! $user->role->isLearnerScoped()) {
            return $query;
        }

        return $query->where('professor_id', $user->id);
    }
}
