<?php

namespace App\Http\Requests\Api\V1\Enrollment;

use App\Actions\Enrollment\BuildEligibleSubjectPool;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Scheduling\SectionConflictDetector;
use App\Models\AcademicTerm;
use App\Models\Enrollment;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The client's eligible-subject pool view is advisory only — every submitted
 * section is re-validated here against a freshly built pool (FR-ENR-002,
 * FR-ENR-003, FR-ENR-011), the same authoritative-server pattern already
 * used throughout this codebase (e.g. Faculty section scoping, Executive
 * Director published-only visibility in Phase 5).
 */
final class StoreEnrollmentRequest extends FormRequest
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
            'sections' => ['required', 'array', 'min:1'],
            'sections.*.section_id' => ['required', 'integer', 'distinct', 'exists:sections,id'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $student = $this->resolveStudent();
            $term = $this->resolveTerm();
            $sectionIds = $this->submittedSectionIds();

            if ($student === null || $term === null || $sectionIds === []) {
                return;
            }

            if ($this->hasActiveEnrollmentThisTerm($student->id, $term->id)) {
                $validator->errors()->add('academic_term_id', 'You already have an active enrollment for this term.');

                return;
            }

            $sections = Section::query()->whereIn('id', $sectionIds)->with('subject')->get()->keyBy('id');

            $this->rejectDuplicateSubjects($validator, $sectionIds, $sections);
            $this->rejectScheduleConflicts($validator, $sectionIds, $sections);
            $this->rejectIneligibleSections($validator, $student, $term, $sectionIds);
            $this->rejectOverload($validator, $sections);
        });
    }

    private function resolveStudent(): ?StudentProfile
    {
        $user = $this->user();

        if (! $user instanceof User) {
            return null;
        }

        return StudentProfile::query()->where('user_id', $user->id)->first();
    }

    private function resolveTerm(): ?AcademicTerm
    {
        $termId = $this->input('academic_term_id');

        if (! is_numeric($termId)) {
            return null;
        }

        return AcademicTerm::query()->find((int) $termId);
    }

    /**
     * @return list<int>
     */
    private function submittedSectionIds(): array
    {
        $sectionInputs = $this->input('sections');

        if (! is_array($sectionInputs)) {
            return [];
        }

        $sectionIds = [];

        foreach ($sectionInputs as $input) {
            if (is_array($input) && isset($input['section_id']) && is_numeric($input['section_id'])) {
                $sectionIds[] = (int) $input['section_id'];
            }
        }

        return $sectionIds;
    }

    private function hasActiveEnrollmentThisTerm(int $studentId, int $academicTermId): bool
    {
        return Enrollment::query()
            ->where('student_id', $studentId)
            ->where('academic_term_id', $academicTermId)
            ->whereNotIn('status', EnrollmentStatus::terminalValues())
            ->exists();
    }

    /**
     * @param  list<int>  $sectionIds
     * @param  Collection<int, Section>  $sections
     */
    private function rejectDuplicateSubjects(Validator $validator, array $sectionIds, Collection $sections): void
    {
        $seenSubjectIds = [];

        foreach ($sectionIds as $index => $sectionId) {
            $section = $sections->get($sectionId);

            if ($section === null) {
                continue;
            }

            if (in_array($section->subject_id, $seenSubjectIds, true)) {
                $validator->errors()->add("sections.{$index}.section_id", 'Only one section per subject may be submitted.');
            }

            $seenSubjectIds[] = $section->subject_id;
        }
    }

    /**
     * @param  list<int>  $sectionIds
     * @param  Collection<int, Section>  $sections
     */
    private function rejectScheduleConflicts(Validator $validator, array $sectionIds, Collection $sections): void
    {
        $detector = app(SectionConflictDetector::class);

        foreach ($sectionIds as $index => $sectionId) {
            $section = $sections->get($sectionId);

            if ($section === null) {
                continue;
            }

            $others = array_values(
                $sections->except([$sectionId])->map(fn (Section $other): array => [
                    'schedule_days' => $other->schedule_days,
                    'starts_at_time' => $other->starts_at_time,
                    'ends_at_time' => $other->ends_at_time,
                ])->all(),
            );

            $proposed = [
                'schedule_days' => $section->schedule_days,
                'starts_at_time' => $section->starts_at_time,
                'ends_at_time' => $section->ends_at_time,
            ];

            if ($detector->hasConflict($proposed, $others)) {
                $validator->errors()->add("sections.{$index}.section_id", 'This section conflicts with another section in this submission.');
            }
        }
    }

    /**
     * @param  list<int>  $sectionIds
     */
    private function rejectIneligibleSections(Validator $validator, StudentProfile $student, AcademicTerm $term, array $sectionIds): void
    {
        $pool = app(BuildEligibleSubjectPool::class)->execute($student, $term);

        $eligibleSectionIds = [];
        foreach ($pool as $entry) {
            foreach ($entry->availableSections as $availableSection) {
                $eligibleSectionIds[$availableSection->id] = true;
            }
        }

        foreach ($sectionIds as $index => $sectionId) {
            if (! isset($eligibleSectionIds[$sectionId])) {
                $validator->errors()->add("sections.{$index}.section_id", 'This section is not currently eligible for selection.');
            }
        }
    }

    /**
     * @param  Collection<int, Section>  $sections
     */
    private function rejectOverload(Validator $validator, Collection $sections): void
    {
        $maxRegularUnits = config('enrollment.max_regular_units');

        if ($maxRegularUnits === null || ! is_numeric($maxRegularUnits)) {
            return;
        }

        $totalUnits = (float) $sections->sum(fn (Section $section): float => $section->subject->units);

        if ($totalUnits > (float) $maxRegularUnits) {
            $validator->errors()->add(
                'sections',
                sprintf('This selection totals %s units, exceeding the maximum regular load of %s units.', $totalUnits, $maxRegularUnits),
            );
        }
    }
}
