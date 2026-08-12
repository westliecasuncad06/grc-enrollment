<?php

namespace App\Actions\Scheduling;

use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Scheduling\FacultyLoadPlanner;
use App\Domain\Scheduling\RoomConflictDetector;
use App\Domain\Scheduling\ScheduleDayParser;
use App\Domain\Scheduling\SectionConflictDetector;
use App\Domain\Scheduling\SectionModality;
use App\Models\CurriculumSubject;
use App\Models\FacultyAssignmentRecommendation;
use App\Models\FacultyAvailability;
use App\Models\FacultyCurriculumSubjectPreference;
use App\Models\FacultySpecialization;
use App\Models\FacultySubjectPreference;
use App\Models\FacultyTeachingHistory;
use App\Models\RoomCatalogEntry;
use App\Models\ScheduleGenerationRun;
use App\Models\Section;
use App\Models\User;
use Illuminate\Support\Collection;

/** Builds editable, persisted faculty recommendations from declared inputs. */
final class GenerateFacultyAssignmentRecommendations
{
    public function __construct(
        private readonly FacultyLoadPlanner $planner,
        private readonly ScheduleDayParser $dayParser,
        private readonly SectionConflictDetector $conflictDetector,
        private readonly RoomConflictDetector $roomConflictDetector,
    ) {}

    /** @return list<string> */
    public function execute(ScheduleGenerationRun $run): array
    {
        $sections = Section::query()
            ->with(['sectionPlan', 'subject'])
            ->where('academic_term_id', $run->academic_term_id)
            ->whereHas('sectionPlan', fn ($plans) => $plans->where('college', $run->college)->where('status', 'draft'))
            ->orderBy('id')
            ->get();
        if ($sections->isEmpty()) {
            return ['No draft sections are available for faculty loading.'];
        }
        $warnings = [];
        foreach ($sections as $section) {
            $this->fillReferenceSchedule($section);
            $roomWarning = $this->assignConfiguredRoom($run, $section, $sections);
            if ($roomWarning !== null) {
                $warnings[] = $roomWarning;
            }
        }

        $faculty = User::query()
            ->where('role', UserRole::Faculty->value)
            ->where('status', UserStatus::Active->value)
            ->where('college', $run->college)
            ->orderBy('id')
            ->get(['id']);
        $legacyPreferences = FacultySubjectPreference::query()
            ->where('academic_term_id', $run->academic_term_id)
            ->whereIn('professor_id', $faculty->pluck('id'))
            ->get()
            ->keyBy(fn (FacultySubjectPreference $preference): string => $preference->professor_id.':'.$preference->subject_id);
        $semester = $run->academicTerm->semester;
        $reusablePreferences = FacultyCurriculumSubjectPreference::query()
            ->where('semester', $semester)
            ->whereIn('professor_id', $faculty->pluck('id'))
            ->get()
            ->keyBy(fn (FacultyCurriculumSubjectPreference $preference): string => $preference->professor_id.':'.$preference->curriculum_id.':'.$preference->subject_id);
        $teachingHistory = FacultyTeachingHistory::query()
            ->where('semester', $semester)
            ->whereIn('professor_id', $faculty->pluck('id'))
            ->get()
            ->keyBy(fn (FacultyTeachingHistory $history): string => $history->professor_id.':'.$history->curriculum_id.':'.$history->subject_id);
        $availabilities = FacultyAvailability::query()
            ->whereIn('professor_id', $faculty->pluck('id'))
            ->get()
            ->groupBy('professor_id');
        $specializations = FacultySpecialization::query()
            ->whereIn('professor_id', $faculty->pluck('id'))
            ->whereIn('subject_id', $sections->pluck('subject_id')->unique())
            ->get()
            ->keyBy(fn (FacultySpecialization $specialization): string => $specialization->professor_id.':'.$specialization->subject_id);

        $assignedUnits = [];
        $assignedSlots = [];
        foreach ($sections->whereNotNull('professor_id') as $section) {
            $assignedUnits[$section->professor_id] = ($assignedUnits[$section->professor_id] ?? 0) + (float) $section->subject->units;
            $assignedSlots[$section->professor_id][] = $this->slot($section);
        }

        foreach ($sections as $section) {
            if ($section->professor_id !== null) {
                FacultyAssignmentRecommendation::updateOrCreate(
                    ['schedule_generation_run_id' => $run->id, 'section_id' => $section->id],
                    [
                        'recommended_professor_id' => $section->professor_id,
                        'preference_rank' => null,
                        'specialization_match' => null,
                        'availability_match' => false,
                        'conflict_free' => true,
                        'rationale' => ['existing_draft_assignment'],
                    ],
                );

                continue;
            }
            $candidates = [];
            $curriculumId = $section->sectionPlan?->curriculum_id;
            foreach ($faculty as $member) {
                $preference = $curriculumId === null
                    ? null
                    : $reusablePreferences->get($member->id.':'.$curriculumId.':'.$section->subject_id);
                $preference ??= $legacyPreferences->get($member->id.':'.$section->subject_id);
                if (! $preference instanceof FacultyCurriculumSubjectPreference && ! $preference instanceof FacultySubjectPreference) {
                    continue;
                }
                $history = $curriculumId === null
                    ? null
                    : $teachingHistory->get($member->id.':'.$curriculumId.':'.$section->subject_id);
                $specializationMatch = $specializations->get($member->id.':'.$section->subject_id)?->proficiency;
                $availabilityMatch = $this->isAvailable(
                    $section,
                    $availabilities->get($member->id)?->all() ?? [],
                );
                $conflictFree = ! $this->conflictDetector->hasConflict(
                    $this->slot($section),
                    $assignedSlots[$member->id] ?? [],
                );
                $candidates[] = [
                    'id' => $member->id,
                    'preference_rank' => $preference->rank,
                    'specialization_match' => $specializationMatch,
                    'teaching_history_evidence' => $history instanceof FacultyTeachingHistory ? $history->evidence_count : 0,
                    'availability_match' => $availabilityMatch,
                    'conflict_free' => $conflictFree,
                    'assigned_units' => $assignedUnits[$member->id] ?? 0,
                ];
            }
            $choice = $this->planner->choose($candidates);
            $selectedId = $choice['professor_id'];
            $selected = collect($candidates)->firstWhere('id', $selectedId);

            FacultyAssignmentRecommendation::updateOrCreate(
                ['schedule_generation_run_id' => $run->id, 'section_id' => $section->id],
                [
                    'recommended_professor_id' => $selectedId,
                    'preference_rank' => $selected['preference_rank'] ?? null,
                    'specialization_match' => ($selected['specialization_match'] ?? null)?->value,
                    'availability_match' => $selected['availability_match'] ?? false,
                    'conflict_free' => $selected['conflict_free'] ?? false,
                    'rationale' => $choice['rationale'],
                ],
            );

            if ($selectedId === null) {
                $warnings[] = "No available preferred faculty could be recommended for section {$section->id}.";

                continue;
            }
            if ($section->professor_id === null) {
                $section->update(['professor_id' => $selectedId]);
                $assignedUnits[$selectedId] = ($assignedUnits[$selectedId] ?? 0) + (float) $section->subject->units;
                $assignedSlots[$selectedId][] = $this->slot($section);
            }
        }

        return array_values(array_unique($warnings));
    }

    private function fillReferenceSchedule(Section $section): void
    {
        if ($section->sectionPlan === null) {
            return;
        }
        $placement = CurriculumSubject::query()
            ->where('curriculum_id', $section->sectionPlan->curriculum_id)
            ->where('subject_id', $section->subject_id)
            ->first();
        if ($placement === null) {
            return;
        }
        $changes = [];
        foreach ([
            'schedule_days' => $placement->reference_day,
            'starts_at_time' => $placement->reference_start_time,
            'ends_at_time' => $placement->reference_end_time,
            'room' => $placement->reference_room,
        ] as $key => $value) {
            if ($section->{$key} === null && $value !== null) {
                $changes[$key] = $value;
            }
        }
        if ($section->modality === null && $placement->reference_modality !== null) {
            $modality = SectionModality::tryFrom(strtolower(str_replace(' ', '_', $placement->reference_modality)));
            if ($modality !== null) {
                $changes['modality'] = $modality;
            }
        }
        if ($changes !== []) {
            $section->update($changes);
            $section->refresh();
        }
    }

    /**
     * Choose only from fully configured local room metadata. Missing capacity,
     * type, or subject requirements intentionally leave the room editable and
     * unassigned rather than inventing a physical placement.
     *
     * @param  Collection<int, Section>  $sections
     */
    private function assignConfiguredRoom(ScheduleGenerationRun $run, Section $section, Collection $sections): ?string
    {
        if ($section->room !== null) {
            $configured = RoomCatalogEntry::query()
                ->where('college', $run->college)
                ->where('name', $section->room)
                ->whereNotNull('capacity')
                ->whereNotNull('room_type')
                ->exists();

            return $configured ? null : "Room metadata is incomplete for section {$section->id}; review its room manually.";
        }
        if ($section->subject->room_requirement === null) {
            return "Subject room requirement is not configured for section {$section->id}; room assignment remains manual.";
        }
        if ($section->schedule_days === null || $section->starts_at_time === null || $section->ends_at_time === null || $section->modality === null) {
            return "Schedule metadata is incomplete for section {$section->id}; room assignment remains manual.";
        }

        $proposed = [
            'schedule_days' => $section->schedule_days,
            'starts_at_time' => $section->starts_at_time,
            'ends_at_time' => $section->ends_at_time,
            'modality' => $section->modality->value,
        ];
        $rooms = RoomCatalogEntry::query()
            ->where('college', $run->college)
            ->where('room_type', $section->subject->room_requirement)
            ->whereNotNull('capacity')
            ->orderBy('name')
            ->get();
        foreach ($rooms as $room) {
            if ($room->capacity < $section->capacity) {
                continue;
            }
            $existing = $sections
                ->reject(fn (Section $other): bool => $other->id === $section->id)
                ->where('room', $room->name)
                ->map(fn (Section $other): array => [
                    'schedule_days' => $other->schedule_days,
                    'starts_at_time' => $other->starts_at_time,
                    'ends_at_time' => $other->ends_at_time,
                    'modality' => $other->modality?->value,
                ])->values()->all();
            if (! $this->roomConflictDetector->hasConflict($proposed, $existing)) {
                $section->update(['room' => $room->name]);
                $section->refresh();

                return null;
            }
        }

        return "No configured {$section->subject->room_requirement} room can accommodate section {$section->id}; assign a room manually.";
    }

    /** @param list<FacultyAvailability> $availability */
    private function isAvailable(Section $section, array $availability): bool
    {
        if ($section->schedule_days === null || $section->starts_at_time === null || $section->ends_at_time === null) {
            return false;
        }
        $neededDays = $this->dayParser->parse($section->schedule_days);
        if ($neededDays === []) {
            return false;
        }
        foreach ($neededDays as $day) {
            $covered = collect($availability)->contains(fn (FacultyAvailability $window): bool => $window->day_of_week === $day &&
                $window->starts_at_time <= $section->starts_at_time &&
                $window->ends_at_time >= $section->ends_at_time,
            );
            if (! $covered) {
                return false;
            }
        }

        return true;
    }

    /** @return array{schedule_days: ?string, starts_at_time: ?string, ends_at_time: ?string} */
    private function slot(Section $section): array
    {
        return [
            'schedule_days' => $section->schedule_days,
            'starts_at_time' => $section->starts_at_time,
            'ends_at_time' => $section->ends_at_time,
        ];
    }
}
