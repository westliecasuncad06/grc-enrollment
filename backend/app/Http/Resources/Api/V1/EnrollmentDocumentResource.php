<?php

namespace App\Http\Resources\Api\V1;

use App\Models\EnrollmentDocument;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read EnrollmentDocument $resource
 */
final class EnrollmentDocumentResource extends JsonResource
{
    /**
     * Exact key set. `student_number` (never email or name) lets the
     * Registrar Head identify whose document this is, matching
     * `EnrollmentResource`'s precedent. No `storage_path` is exposed — it
     * stays null in this slice (see `EnrollmentDocument`'s own docblock);
     * FR-FIN-010's print/download is served from this structured data, not
     * a generated file.
     *
     * @return array{
     *     type: string,
     *     id: int,
     *     enrollment_id: int,
     *     student_number: string,
     *     document_type: string,
     *     document_type_label: string,
     *     document_number: string,
     *     generated_at: string
     * }
     */
    public function toArray(Request $request): array
    {
        return [
            'type' => 'enrollment_document',
            'id' => $this->resource->id,
            'enrollment_id' => $this->resource->enrollment_id,
            'student_number' => $this->resource->enrollment->student->student_number,
            'document_type' => $this->resource->document_type->value,
            'document_type_label' => $this->resource->document_type->label(),
            'document_number' => $this->resource->document_number,
            'generated_at' => $this->resource->generated_at->utc()->format('Y-m-d\TH:i:s\Z'),
        ];
    }
}
