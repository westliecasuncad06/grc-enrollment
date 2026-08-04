<?php

namespace App\Http\Resources\Api\V1;

use App\Models\AcademicGrade;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read AcademicGrade $resource
 */
final class AcademicGradeResource extends JsonResource
{
    /**
     * Exact key set. `student_number` (never email or name) is exposed so
     * Faculty and the Registrar Head can identify whose record this is,
     * matching `EnrollmentResource`'s precedent. `mark` is the authoritative
     * value the API now accepts (see `App\Domain\Academic\GradeMark`);
     * `final_grade` survives as a derived numeric mirror, kept for readers
     * that predate the mark vocabulary — never cast to float (see
     * `AcademicGrade::casts()`), since PRD §17 leaves the grading scale
     * unconfirmed. `mark_label` is a pure function of `mark`
     * (`GradeMark::label()`) and is never stored.
     *
     * @return array{
     *     type: string,
     *     id: int,
     *     student_id: int,
     *     student_number: string,
     *     subject_id: int,
     *     subject_code: string,
     *     section_id: ?int,
     *     academic_term_id: int,
     *     mark: ?string,
     *     mark_label: ?string,
     *     final_grade: ?string,
     *     remarks: ?string,
     *     status: string,
     *     status_label: string,
     *     submitted_at: ?string,
     *     locked_at: ?string
     * }
     */
    public function toArray(Request $request): array
    {
        return [
            'type' => 'academic_grade',
            'id' => $this->resource->id,
            'student_id' => $this->resource->student_id,
            'student_number' => $this->resource->student->student_number,
            'subject_id' => $this->resource->subject_id,
            'subject_code' => $this->resource->subject->code,
            'section_id' => $this->resource->section_id,
            'academic_term_id' => $this->resource->academic_term_id,
            'mark' => $this->resource->mark?->value,
            'mark_label' => $this->resource->mark?->label(),
            'final_grade' => $this->resource->final_grade,
            'remarks' => $this->resource->remarks,
            'status' => $this->resource->status->value,
            'status_label' => $this->resource->status->label(),
            'submitted_at' => $this->resource->submitted_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'locked_at' => $this->resource->locked_at?->utc()->format('Y-m-d\TH:i:s\Z'),
        ];
    }
}
