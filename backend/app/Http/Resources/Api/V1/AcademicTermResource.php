<?php

namespace App\Http\Resources\Api\V1;

use App\Models\AcademicTerm;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read AcademicTerm $resource
 */
final class AcademicTermResource extends JsonResource
{
    /**
     * Exact key set. No attribute is passed through implicitly.
     *
     * @return array{
     *     type: string,
     *     id: int,
     *     school_year: string,
     *     semester: string,
     *     starts_at: ?string,
     *     ends_at: ?string,
     *     enrollment_opens_at: ?string,
     *     enrollment_closes_at: ?string,
     *     status: string,
     *     status_label: string
     * }
     */
    public function toArray(Request $request): array
    {
        return [
            'type' => 'academic-term',
            'id' => $this->resource->id,
            'school_year' => $this->resource->school_year,
            'semester' => $this->resource->semester,
            'starts_at' => $this->resource->starts_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'ends_at' => $this->resource->ends_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'enrollment_opens_at' => $this->resource->enrollment_opens_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'enrollment_closes_at' => $this->resource->enrollment_closes_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'status' => $this->resource->status->value,
            'status_label' => $this->resource->status->label(),
        ];
    }
}
