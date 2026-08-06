<?php

namespace App\Actions\Organization;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Scheduling\SectionModality;
use App\Models\AcademicTerm;
use App\Models\AcademicTermSectionPlan;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Section;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Bulk-fills a term's generated Sections from the matching curriculum
 * placement's `reference_*` schedule/faculty data (see
 * `GrcCurriculumScheduleReferenceSeeder`) — a one-click convenience for
 * manual testing, satisfying `SaveSectionPlan::submit()`'s requirement that
 * every section have a professor/day/times/room/modality before it can go
 * to the Dean.
 *
 * Never overwrites a field a Program Chair already set by hand — only
 * fills currently-null fields, the same "don't clobber manual work"
 * precedent `capacity_source` already established for capacity. A subject
 * whose placement has no `reference_professor_name` stays unassigned; no
 * name is ever invented.
 *
 * Like every sibling write on this workflow (`SaveSectionPlan::save()` /
 * `release()` / `submit()`), this is scoped to the acting Program Chair's
 * own college: the role check alone does not stop one college's Chair from
 * bulk-writing another college's sections.
 */
final class AutoAssignSectionScheduleReferences
{
    public function __construct(private readonly AuditRecorder $auditRecorder) {}

    /**
     * @return Collection<int, Section> the sections this call actually touched
     */
    public function execute(
        AcademicTerm $term,
        int $curriculumId,
        User $actor,
        AuditRequestContext $context,
        ?int $yearLevel = null,
    ): Collection {
        $college = $actor->college?->value;
        if ($college === null) {
            throw ValidationException::withMessages(['college' => 'A college-scoped Program Chair is required.']);
        }
        $this->assertCurriculumBelongsToCollege($curriculumId, $actor, $college);

        return DB::transaction(function () use ($term, $curriculumId, $actor, $context, $college, $yearLevel): Collection {
            $planIds = AcademicTermSectionPlan::query()
                ->where('academic_term_id', $term->id)
                ->where('curriculum_id', $curriculumId)
                ->where('college', $college)
                ->when($yearLevel !== null, fn ($query) => $query->where('year_level', $yearLevel))
                ->pluck('id');

            $sections = Section::query()
                ->whereIn('section_plan_id', $planIds)
                ->where(function ($query): void {
                    $query->whereNull('professor_id')
                        ->orWhereNull('schedule_days')
                        ->orWhereNull('starts_at_time')
                        ->orWhereNull('ends_at_time')
                        ->orWhereNull('room')
                        ->orWhereNull('modality');
                })
                ->get();

            $touched = new Collection;
            // Kept alongside `$touched` purely for the audit payload: PHPStan
            // cannot infer an element type for a Collection filled by push(),
            // so reading the ids back off it is not statically checkable.
            $touchedSectionIds = [];

            foreach ($sections as $section) {
                $placement = CurriculumSubject::query()
                    ->where('curriculum_id', $curriculumId)
                    ->where('subject_id', $section->subject_id)
                    ->first();

                if ($placement === null) {
                    continue;
                }

                $changes = [];

                if ($section->professor_id === null && $placement->reference_professor_name !== null) {
                    $changes['professor_id'] = $this->findOrCreateFaculty($placement->reference_professor_name)->id;
                }
                if ($section->schedule_days === null && $placement->reference_day !== null) {
                    $changes['schedule_days'] = $placement->reference_day;
                }
                if ($section->starts_at_time === null && $placement->reference_start_time !== null) {
                    $changes['starts_at_time'] = $placement->reference_start_time;
                }
                if ($section->ends_at_time === null && $placement->reference_end_time !== null) {
                    $changes['ends_at_time'] = $placement->reference_end_time;
                }
                if ($section->room === null && $placement->reference_room !== null) {
                    $changes['room'] = $placement->reference_room;
                }
                if ($section->modality === null && $placement->reference_modality !== null) {
                    // The seeded reference_modality values are uppercase/spaced
                    // (e.g. 'ONLINE', 'HYFLEX A', 'HYFLEX B', 'F2F' — see
                    // curriculum-2024-2029-schedule-references.csv), but
                    // Section::modality is cast to the SectionModality backed
                    // enum, whose backing values are lowercase/underscored
                    // ('online', 'hyflex_a', 'hyflex_b', 'f2f'). Normalize
                    // before assigning, or the enum cast throws a ValueError.
                    $normalized = strtolower(str_replace(' ', '_', $placement->reference_modality));
                    $modality = SectionModality::tryFrom($normalized);

                    // If a future reference value doesn't map cleanly, never
                    // invent/guess a modality — leave the field null.
                    if ($modality !== null) {
                        $changes['modality'] = $modality;
                    }
                }

                if ($changes !== []) {
                    $section->update($changes);
                    $touched->push($section);
                    $touchedSectionIds[] = $section->id;
                }
            }

            // A run that filled nothing wrote nothing, so it leaves no audit
            // row — only the actual bulk write is recorded, the same way the
            // sibling transitions record theirs.
            if ($touchedSectionIds !== []) {
                $this->auditRecorder->record(
                    $actor,
                    AuditAction::SECTION_PLAN_AUTO_ASSIGNED,
                    AuditableType::SECTION_PLAN,
                    $planIds->first(),
                    null,
                    ['academic_term_id' => $term->id, 'curriculum_id' => $curriculumId, 'college' => $college, 'year_level' => $yearLevel, 'section_ids' => $touchedSectionIds],
                    null,
                    $context,
                );
            }

            return $touched;
        });
    }

    /**
     * Deliberately duplicates `SaveSectionPlan`'s identically-named private
     * guard rather than hoisting it into a shared trait: it is a handful of
     * lines, and each action on this workflow owns its ownership check.
     */
    private function assertCurriculumBelongsToCollege(int $curriculumId, User $actor, string $college): void
    {
        if ($actor->role !== UserRole::ProgramChair) {
            return;
        }

        $belongsToCollege = Curriculum::query()
            ->whereKey($curriculumId)
            ->whereHas('program', fn ($programs) => $programs->where('college', $college))
            ->exists();

        if (! $belongsToCollege) {
            throw ValidationException::withMessages(['curriculum_id' => 'This curriculum is not available for your college.']);
        }
    }

    private function findOrCreateFaculty(string $name): User
    {
        return User::firstOrCreate(
            ['name' => $name, 'role' => UserRole::Faculty],
            [
                'email' => 'prof.'.Str::slug($name).'@grc.test',
                'password' => 'password',
                'status' => UserStatus::Active,
            ],
        );
    }
}
