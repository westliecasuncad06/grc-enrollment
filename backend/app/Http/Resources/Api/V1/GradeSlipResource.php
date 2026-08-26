<?php

namespace App\Http\Resources\Api\V1;

use App\Domain\Academic\GradeSlip;
use App\Domain\Academic\SubjectGwaExclusionRule;
use App\Models\AcademicGrade;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

/**
 * @property-read GradeSlip $resource
 */
final class GradeSlipResource extends JsonResource
{
    /**
     * Exact key set. `section_code`/`professor_name` are nullable —
     * `section_id` is a nullable column and the demo seed data includes
     * locked grades recorded without one; the printed slip renders `—`
     * for those, never crashes. `gpa` is a string (or null), matching
     * `final_grade`'s precedent of never coercing a grade value to float.
     *
     * @return array{
     *     type: string,
     *     student_id: int,
     *     student_number: string,
     *     program_code: string,
     *     program_name: string,
     *     year_level: int,
     *     enrollment_category: ?string,
     *     enrollment_category_label: ?string,
     *     academic_term_id: int,
     *     school_year: string,
     *     semester: string,
     *     term_label: string,
     *     rows: list<mixed>,
     *     total_academic_units: float,
     *     gpa_units: float,
     *     gpa: ?string,
     *     excluded_from_gpa_count: int,
     *     generated_at: string
     * }
     */
    public function toArray(Request $request): array
    {
        $student = $this->resource->student;
        $term = $this->resource->term;

        return [
            'type' => 'grade_slip',
            'student_id' => $student->id,
            'student_number' => $student->student_number,
            'program_code' => $student->program->code,
            'program_name' => $student->program->name,
            'year_level' => $student->year_level,
            'enrollment_category' => $student->enrollment_category,
            'enrollment_category_label' => $student->enrollment_category !== null
                ? ucfirst($student->enrollment_category)
                : null,
            'academic_term_id' => $term->id,
            'school_year' => $term->school_year,
            'semester' => $term->semester,
            'term_label' => "{$term->school_year} · {$term->semester}",
            'rows' => array_map(
                fn (AcademicGrade $grade): array => self::rowToArray($grade),
                $this->resource->grades,
            ),
            'total_academic_units' => $this->resource->totalAcademicUnits,
            'gpa_units' => $this->resource->gpaUnits,
            'gpa' => $this->resource->gpa,
            'excluded_from_gpa_count' => $this->resource->excludedFromGpaCount,
            'generated_at' => Carbon::now()->utc()->format('Y-m-d\TH:i:s\Z'),
        ];
    }

    /**
     * Shared with `AcademicRecordResource`, which reuses this exact row
     * shape per term rather than duplicating it.
     *
     * @return array{
     *     academic_grade_id: int,
     *     code: string,
     *     title: string,
     *     units: float,
     *     mark: ?string,
     *     mark_label: ?string,
     *     final_grade: ?string,
     *     section_code: ?string,
     *     professor_name: ?string,
     *     status: string,
     *     status_label: string,
     *     counts_toward_gpa: bool
     * }
     */
    public static function rowToArray(AcademicGrade $grade): array
    {
        $section = $grade->section;

        return [
            'academic_grade_id' => $grade->id,
            'code' => $grade->subject->code,
            'title' => $grade->subject->title,
            'units' => $grade->subject->units,
            'mark' => $grade->mark?->value,
            'mark_label' => $grade->mark?->label(),
            'final_grade' => $grade->final_grade,
            'section_code' => $section?->section_code,
            'professor_name' => $section?->professor?->name,
            'status' => $grade->status->value,
            'status_label' => $grade->status->label(),
            'counts_toward_gpa' => ($grade->mark?->countsTowardGpa() ?? false)
                && SubjectGwaExclusionRule::countsTowardGwa($grade->subject->code),
        ];
    }
}
