<?php

namespace App\Http\Resources\Api\V1;

use App\Models\TransfereeCredit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read TransfereeCredit $resource
 */
final class TransfereeCreditResource extends JsonResource
{
    /**
     * Exact key set. `student_number` (never email or name) matches
     * `EnrollmentResource`'s precedent. The processor's identity stays
     * private to the audit log — never exposed here, matching
     * `WithdrawalRequestResource`.
     *
     * @return array{
     *     type: string,
     *     id: int,
     *     student_id: int,
     *     student_number: string,
     *     source_institution: string,
     *     source_subject_code: string,
     *     source_subject_title: string,
     *     source_grade: ?string,
     *     credited_units: int,
     *     subject_id: ?int,
     *     subject_code: ?string,
     *     status: string,
     *     status_label: string,
     *     processed_at: ?string,
     *     created_at: ?string
     * }
     */
    public function toArray(Request $request): array
    {
        return [
            'type' => 'transferee_credit',
            'id' => $this->resource->id,
            'student_id' => $this->resource->student_id,
            'student_number' => $this->resource->student->student_number,
            'source_institution' => $this->resource->source_institution,
            'source_subject_code' => $this->resource->source_subject_code,
            'source_subject_title' => $this->resource->source_subject_title,
            'source_grade' => $this->resource->source_grade,
            'credited_units' => $this->resource->credited_units,
            'subject_id' => $this->resource->subject_id,
            'subject_code' => $this->resource->subject?->code,
            'status' => $this->resource->status->value,
            'status_label' => $this->resource->status->label(),
            'processed_at' => $this->resource->processed_at?->toIso8601String(),
            'created_at' => $this->resource->created_at?->toIso8601String(),
        ];
    }
}
