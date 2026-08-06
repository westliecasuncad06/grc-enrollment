<?php

namespace App\Actions\Organization;

use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Scheduling\SectionModality;
use App\Models\AcademicTerm;
use App\Models\AcademicTermSectionPlan;
use App\Models\CurriculumSubject;
use App\Models\Section;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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
 */
final class AutoAssignSectionScheduleReferences
{
    /**
     * @return Collection<int, Section> the sections this call actually touched
     */
    public function execute(AcademicTerm $term, int $curriculumId, ?int $yearLevel = null): Collection
    {
        return DB::transaction(function () use ($term, $curriculumId, $yearLevel): Collection {
            $planIds = AcademicTermSectionPlan::query()
                ->where('academic_term_id', $term->id)
                ->where('curriculum_id', $curriculumId)
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
                }
            }

            return $touched;
        });
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
