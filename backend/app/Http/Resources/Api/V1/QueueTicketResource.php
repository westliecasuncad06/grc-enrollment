<?php

namespace App\Http\Resources\Api\V1;

use App\Models\QueueTicket;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read QueueTicket $resource
 */
final class QueueTicketResource extends JsonResource
{
    /**
     * Exact key set. `student_number` (never email or name) lets Accounting
     * identify whose ticket this is, matching `EnrollmentResource`'s
     * precedent.
     *
     * @return array{
     *     type: string,
     *     id: int,
     *     enrollment_id: int,
     *     student_number: string,
     *     ticket_number: string,
     *     queue_date: string,
     *     status: string,
     *     status_label: string,
     *     served_at: ?string
     * }
     */
    public function toArray(Request $request): array
    {
        return [
            'type' => 'queue_ticket',
            'id' => $this->resource->id,
            'enrollment_id' => $this->resource->enrollment_id,
            'student_number' => $this->resource->enrollment->student->student_number,
            'ticket_number' => $this->resource->ticket_number,
            'queue_date' => $this->resource->queue_date->toDateString(),
            'status' => $this->resource->status->value,
            'status_label' => $this->resource->status->label(),
            'served_at' => $this->resource->served_at?->toIso8601String(),
        ];
    }
}
