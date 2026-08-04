<?php

namespace App\Http\Requests\Api\V1\Section;

use App\Domain\Identity\UserRole;
use App\Domain\Scheduling\SectionConflictDetector;
use App\Domain\Scheduling\SectionModality;
use App\Domain\Scheduling\SectionStatus;
use App\Models\Section;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * `enrolled_count` is deliberately not a validated/writable field — it is a
 * maintained counter derived from `enrollment_subjects`, not an input (see
 * the sections migration's own docblock).
 */
final class StoreSectionRequest extends FormRequest
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
                ),
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
        });
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
}
