<?php

namespace App\Http\Resources\Api\V1;

use App\Models\Section;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read Section $resource
 */
final class SectionResource extends JsonResource
{
    /**
     * Exact key set. No attribute is passed through implicitly.
     * `remaining_seats` is a display convenience only — see
     * Section::remainingSeats()'s docblock for why it is not authoritative.
     *
     * @return array{
     *     type: string,
     *     id: int,
     *     academic_term_id: int,
     *     subject_id: int,
     *     section_code: string,
     *     professor_id: ?int,
     *     schedule_days: ?string,
     *     starts_at_time: ?string,
     *     ends_at_time: ?string,
     *     room: ?string,
     *     capacity: int,
     *     viability_threshold: ?int,
     *     enrolled_count: int,
     *     remaining_seats: int,
     *     status: string,
     *     status_label: string
     * }
     */
    public function toArray(Request $request): array
    {
        return [
            'type' => 'section',
            'id' => $this->resource->id,
            'academic_term_id' => $this->resource->academic_term_id,
            'subject_id' => $this->resource->subject_id,
            'section_code' => $this->resource->section_code,
            'professor_id' => $this->resource->professor_id,
            'schedule_days' => $this->resource->schedule_days,
            'starts_at_time' => $this->resource->starts_at_time,
            'ends_at_time' => $this->resource->ends_at_time,
            'room' => $this->resource->room,
            'capacity' => $this->resource->capacity,
            'viability_threshold' => $this->resource->viability_threshold,
            'enrolled_count' => $this->resource->enrolled_count,
            'remaining_seats' => $this->resource->remainingSeats(),
            'status' => $this->resource->status->value,
            'status_label' => $this->resource->status->label(),
        ];
    }
}
