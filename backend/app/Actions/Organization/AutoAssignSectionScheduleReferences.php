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
                // A handful of placements have a real reference_day but no
                // recorded time at all — genuinely missing source data, not
                // a parsing gap. Per product direction, default to the
                // most common real time block already present in the
                // seeded roster rather than staying unresolved.
                if ($section->starts_at_time === null && $placement->reference_day !== null) {
                    $changes['starts_at_time'] = $placement->reference_start_time ?? '07:30:00';
                }
                if ($section->ends_at_time === null && $placement->reference_day !== null) {
                    $changes['ends_at_time'] = $placement->reference_end_time ?? '10:30:00';
                }
                if ($section->modality === null) {
                    if ($placement->reference_modality !== null) {
                        // The seeded reference_modality values are uppercase/spaced
                        // (e.g. 'HYFLEX A', 'HYFLEX B', 'F2F' — see
                        // curriculum-2024-2029-schedule-references.csv), but
                        // Section::modality is cast to the SectionModality backed
                        // enum, whose backing values are lowercase/underscored
                        // ('hyflex_a', 'hyflex_b', 'f2f'). Normalize
                        // before assigning, or the enum cast throws a ValueError.
                        $normalized = strtolower(str_replace(' ', '_', $placement->reference_modality));

                        // GRC's schedule taxonomy only has three modalities.
                        // The legacy roster's "ONLINE" designation (from before
                        // the current Hyflex A/B split) has no direct
                        // equivalent, so it falls back to Hyflex A — week 1
                        // face-to-face, alternating — rather than staying an
                        // unresolved gap. A Program Chair can still change it
                        // to Hyflex B or F2F like any other section field.
                        $changes['modality'] = SectionModality::tryFrom($normalized) ?? SectionModality::HyflexA;
                    } elseif ($placement->reference_day !== null) {
                        // Only CCS's rows in the reference CSV carry a
                        // modality at all — COE/COA/CBAE's rows have a real
                        // day/time but leave the modality column blank
                        // outright. Per product direction, that absence
                        // defaults to ordinary face-to-face, the least
                        // assumption-laden option, rather than staying
                        // unresolved. A placement with no reference data at
                        // all (no day either) has nothing to default from.
                        $changes['modality'] = SectionModality::FaceToFace;
                    }
                }
                // The legacy "ONLINE" reference names a placeholder room,
                // never a real one — skip it so the room stays open for the
                // normal room-catalog assignment to fill instead.
                if ($section->room === null && $placement->reference_room !== null
                    && strtolower($placement->reference_room) !== 'online') {
                    $changes['room'] = $placement->reference_room;
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
        // The email is derived from a slug of $name, which strips
        // punctuation — two raw reference names that differ only in
        // punctuation/spacing (e.g. "COACH LORETO" vs "COACH. LORETO", the
        // same person named inconsistently across placements) collide on
        // the same slug. Looking up by that email, the actual unique
        // constraint, keeps this idempotent; looking up by the differing
        // $name would not.
        return User::firstOrCreate(
            ['email' => 'prof.'.Str::slug($name).'@grc.test'],
            [
                'name' => $name,
                'role' => UserRole::Faculty,
                'password' => 'password',
                'status' => UserStatus::Active,
            ],
        );
    }
}
