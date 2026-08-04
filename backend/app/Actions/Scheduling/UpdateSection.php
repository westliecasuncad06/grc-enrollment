<?php

namespace App\Actions\Scheduling;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Organization\CapacitySource;
use App\Models\Section;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class UpdateSection
{
    public function __construct(private readonly AuditRecorder $auditRecorder) {}

    /**
     * @param  array{
     *     academic_term_id: int,
     *     subject_id: int,
     *     section_code: string,
     *     professor_id: ?int,
     *     schedule_days: ?string,
     *     starts_at_time: ?string,
     *     ends_at_time: ?string,
     *     room: ?string,
     *     modality: ?string,
     *     capacity: int,
     *     viability_threshold: ?int,
     *     status: string
     * }  $validatedData
     */
    public function execute(
        User $actor,
        array $validatedData,
        Section $section,
        AuditRequestContext $context,
    ): Section {
        return DB::transaction(function () use ($actor, $validatedData, $section, $context): Section {
            $beforeValues = self::snapshot($section);
            $capacity = (int) $validatedData['capacity'];

            // A section can never seat fewer students than are already
            // enrolled in it — that would make `remainingSeats()` lie and
            // strand students the pool would then treat as over capacity.
            if ($capacity < $section->enrolled_count) {
                throw ValidationException::withMessages([
                    'capacity' => "Capacity cannot be below the {$section->enrolled_count} students already enrolled in this section.",
                ]);
            }

            // Typing a different capacity claims this section from its
            // year-level plan, so a later `SaveSectionPlan::release()` will
            // not overwrite the Chair's deliberate figure.
            $capacitySource = $capacity === $section->capacity
                ? $section->capacity_source
                : CapacitySource::Manual;

            $section->update([
                'academic_term_id' => $validatedData['academic_term_id'],
                'subject_id' => $validatedData['subject_id'],
                'section_code' => $validatedData['section_code'],
                'professor_id' => $validatedData['professor_id'],
                'schedule_days' => $validatedData['schedule_days'],
                'starts_at_time' => $validatedData['starts_at_time'],
                'ends_at_time' => $validatedData['ends_at_time'],
                'room' => $validatedData['room'],
                'modality' => $validatedData['modality'] ?? null,
                'capacity' => $capacity,
                'capacity_source' => $capacitySource,
                'viability_threshold' => $validatedData['viability_threshold'],
                'status' => $validatedData['status'],
            ]);
            $section->refresh();

            $this->auditRecorder->record(
                $actor,
                AuditAction::SECTION_UPDATED,
                AuditableType::SECTION,
                $section->id,
                $beforeValues,
                self::snapshot($section),
                null,
                $context,
            );

            return $section;
        });
    }

    /** @return array{academic_term_id: int, subject_id: int, section_code: string, professor_id: ?int, schedule_days: ?string, starts_at_time: ?string, ends_at_time: ?string, room: ?string, modality: ?string, capacity: int, capacity_source: string, viability_threshold: ?int, enrolled_count: int, status: string} */
    private static function snapshot(Section $section): array
    {
        return [
            'academic_term_id' => $section->academic_term_id,
            'subject_id' => $section->subject_id,
            'section_code' => $section->section_code,
            'professor_id' => $section->professor_id,
            'schedule_days' => $section->schedule_days,
            'starts_at_time' => $section->starts_at_time,
            'ends_at_time' => $section->ends_at_time,
            'room' => $section->room,
            'modality' => $section->modality?->value,
            'capacity' => $section->capacity,
            'capacity_source' => $section->capacity_source->value,
            'viability_threshold' => $section->viability_threshold,
            'enrolled_count' => $section->enrolled_count,
            'status' => $section->status->value,
        ];
    }
}
