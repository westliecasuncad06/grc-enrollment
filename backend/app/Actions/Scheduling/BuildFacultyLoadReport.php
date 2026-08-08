<?php

namespace App\Actions\Scheduling;

use App\Models\AcademicTerm;
use App\Models\FacultyAssignmentRecommendation;
use App\Models\FacultyLoadThreshold;
use App\Models\ScheduleGenerationRun;
use App\Models\Section;

final class BuildFacultyLoadReport
{
    /** @return array<string, mixed> */
    public function execute(AcademicTerm $term, string $college): array
    {
        $threshold = FacultyLoadThreshold::query()
            ->where('academic_term_id', $term->id)
            ->where('college', $college)
            ->value('max_units');
        $latestRun = ScheduleGenerationRun::query()
            ->where('academic_term_id', $term->id)
            ->where('college', $college)
            ->latest('id')
            ->first();
        $recommendations = $latestRun === null
            ? collect()
            : FacultyAssignmentRecommendation::query()
                ->where('schedule_generation_run_id', $latestRun->id)
                ->get()
                ->keyBy('section_id');
        $sections = Section::query()
            ->with(['subject', 'professor'])
            ->where('academic_term_id', $term->id)
            ->whereHas('sectionPlan', fn ($plans) => $plans->where('college', $college))
            ->orderBy('id')
            ->get();

        $rows = $sections->map(function (Section $section) use ($recommendations): array {
            $recommendation = $recommendations->get($section->id);
            $manual = $recommendation !== null && $section->professor_id !== $recommendation->recommended_professor_id;

            return [
                'section_id' => $section->id,
                'section_code' => $section->section_code,
                'subject_id' => $section->subject_id,
                'subject_code' => $section->subject->code,
                'subject_title' => $section->subject->title,
                'units' => (float) $section->subject->units,
                'professor_id' => $section->professor_id,
                'professor_name' => $section->professor?->name,
                'recommended_professor_id' => $recommendation?->recommended_professor_id,
                'rationale' => $manual
                    ? ['manual_override']
                    : ($recommendation?->rationale ?? ['manual_assignment_pending']),
                'override_reason' => $section->manual_override_reason,
                'schedule_days' => $section->schedule_days,
                'starts_at_time' => $section->starts_at_time,
                'ends_at_time' => $section->ends_at_time,
                'room' => $section->room,
                'modality' => $section->modality?->value,
            ];
        });
        $faculty = $rows->filter(fn (array $row): bool => $row['professor_id'] !== null)
            ->groupBy('professor_id')
            ->map(function ($assignments) use ($threshold): array {
                $first = $assignments->first();
                $totalUnits = (float) $assignments->sum('units');

                return [
                    'professor_id' => $first['professor_id'],
                    'professor_name' => $first['professor_name'],
                    'total_units' => $totalUnits,
                    'overloaded' => $threshold !== null && $totalUnits > (float) $threshold,
                    'assignments' => $assignments->values()->all(),
                ];
            })->values();
        $totalUnits = (float) $rows->sum('units');
        $numericThreshold = $threshold === null ? null : (float) $threshold;

        return [
            'academic_term_id' => $term->id,
            'college' => $college,
            'threshold_units' => $numericThreshold,
            'required_teaching_units' => $totalUnits,
            'required_assignments' => $rows->count(),
            'equivalent_faculty_loads' => $numericThreshold === null || $numericThreshold <= 0
                ? null
                : (int) ceil($totalUnits / $numericThreshold),
            'assigned_count' => $rows->whereNotNull('professor_id')->count(),
            'unassigned_count' => $rows->whereNull('professor_id')->count(),
            'overloaded_count' => $faculty->where('overloaded', true)->count(),
            'faculty' => $faculty->all(),
            'unassigned' => $rows->whereNull('professor_id')->values()->all(),
        ];
    }
}
