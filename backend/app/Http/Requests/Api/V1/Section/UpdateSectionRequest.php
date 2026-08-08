<?php

namespace App\Http\Requests\Api\V1\Section;

use App\Domain\Identity\UserRole;
use App\Domain\Scheduling\RoomConflictDetector;
use App\Domain\Scheduling\SectionConflictDetector;
use App\Domain\Scheduling\SectionModality;
use App\Domain\Scheduling\SectionStatus;
use App\Models\Section;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateSectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'academic_term_id' => ['required', 'integer', 'exists:academic_terms,id'],
            'subject_id' => ['required', 'integer', 'exists:subjects,id'],
            'section_code' => [
                'required',
                'string',
                'max:255',
                Rule::unique('sections')->where(
                    fn ($query) => $query
                        ->where('academic_term_id', $this->input('academic_term_id'))
                        ->where('subject_id', $this->input('subject_id')),
                )->ignore($this->route('section')),
            ],
            'professor_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('role', UserRole::Faculty->value)],
            'schedule_days' => ['nullable', 'string', 'max:255'],
            'starts_at_time' => ['nullable', 'date_format:H:i:s', 'required_with:ends_at_time'],
            'ends_at_time' => ['nullable', 'date_format:H:i:s', 'after:starts_at_time', 'required_with:starts_at_time'],
            'room' => ['nullable', 'string', 'max:255'],
            'modality' => ['nullable', Rule::enum(SectionModality::class)],
            'capacity' => ['required', 'integer', 'min:1'],
            'viability_threshold' => ['nullable', 'integer', 'min:1'],
            'status' => ['required', Rule::enum(SectionStatus::class)],
            'override_reason' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($this->hasProfessorConflict()) {
                $validator->errors()->add(
                    'schedule_days',
                    'This professor is already assigned to another section that conflicts with this schedule.',
                );
            }
            if ($this->hasRoomConflict()) {
                $validator->errors()->add(
                    'room',
                    'This room is already physically occupied by another section at the proposed time.',
                );
            }
            /** @var ?Section $section */
            $section = $this->route('section');
            if ($section instanceof Section && $section->recommendation_prediction_run_id !== null && $this->changesGeneratedAssignment($section) && ! filled($this->input('override_reason'))) {
                $validator->errors()->add('override_reason', 'Explain why this generated assignment is being overridden.');
            }
        });
    }

    private function changesGeneratedAssignment(Section $section): bool
    {
        foreach (['professor_id', 'schedule_days', 'starts_at_time', 'ends_at_time', 'room', 'modality'] as $field) {
            $current = $section->{$field};
            if ($current instanceof SectionModality) {
                $current = $current->value;
            }
            if ($this->input($field) != $current) {
                return true;
            }
        }

        return false;
    }

    private function hasProfessorConflict(): bool
    {
        $professorId = $this->input('professor_id');

        if (! is_numeric($professorId)) {
            return false;
        }

        $existing = array_values(
            Section::query()
                ->where('professor_id', $professorId)
                ->where('academic_term_id', $this->input('academic_term_id'))
                ->whereKeyNot($this->route('section'))
                ->get(['schedule_days', 'starts_at_time', 'ends_at_time'])
                ->map(fn (Section $section): array => [
                    'schedule_days' => $section->schedule_days,
                    'starts_at_time' => $section->starts_at_time,
                    'ends_at_time' => $section->ends_at_time,
                ])
                ->all(),
        );

        return app(SectionConflictDetector::class)->hasConflict([
            'schedule_days' => $this->input('schedule_days'),
            'starts_at_time' => $this->input('starts_at_time'),
            'ends_at_time' => $this->input('ends_at_time'),
        ], $existing);
    }

    private function hasRoomConflict(): bool
    {
        $room = $this->input('room');
        if (! is_string($room) || trim($room) === '') {
            return false;
        }

        $existing = array_values(
            Section::query()
                ->where('room', $room)
                ->where('academic_term_id', $this->input('academic_term_id'))
                ->whereKeyNot($this->route('section'))
                ->get(['schedule_days', 'starts_at_time', 'ends_at_time', 'modality'])
                ->map(fn (Section $section): array => [
                    'schedule_days' => $section->schedule_days,
                    'starts_at_time' => $section->starts_at_time,
                    'ends_at_time' => $section->ends_at_time,
                    'modality' => $section->modality?->value,
                ])
                ->all(),
        );

        return app(RoomConflictDetector::class)->hasConflict([
            'schedule_days' => $this->input('schedule_days'),
            'starts_at_time' => $this->input('starts_at_time'),
            'ends_at_time' => $this->input('ends_at_time'),
            'modality' => $this->input('modality'),
        ], $existing);
    }
}
