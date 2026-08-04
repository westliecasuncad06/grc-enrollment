<?php

namespace App\Http\Resources\Api\V1;

use App\Models\StudentProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read StudentProfile $resource
 */
final class StudentProfileResource extends JsonResource
{
    /**
     * Exact key set. No attribute is passed through implicitly — in
     * particular, no password or credential ever appears here.
     *
     * @return array{
     *     type: string,
     *     id: int,
     *     user_id: int,
     *     student_number: string,
     *     program_id: int,
     *     curriculum_id: int,
     *     year_level: int,
     *     enrollment_category: ?string,
     *     admission_status: string,
     *     admission_status_label: string,
     *     academic_standing: string,
     *     academic_standing_label: string
     * }
     */
    public function toArray(Request $request): array
    {
        return [
            'type' => 'student_profile',
            'id' => $this->resource->id,
            'user_id' => $this->resource->user_id,
            'student_number' => $this->resource->student_number,
            'program_id' => $this->resource->program_id,
            'curriculum_id' => $this->resource->curriculum_id,
            'year_level' => $this->resource->year_level,
            'enrollment_category' => $this->resource->enrollment_category,
            'admission_status' => $this->resource->admission_status->value,
            'admission_status_label' => $this->resource->admission_status->label(),
            'academic_standing' => $this->resource->academic_standing->value,
            'academic_standing_label' => $this->resource->academic_standing->label(),
        ];
    }
}
