<?php

namespace App\Http\Resources\Api\V1;

use App\Models\ScheduleProposal;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read ScheduleProposal $resource
 */
final class ScheduleProposalResource extends JsonResource
{
    /**
     * Exact key set. No attribute is passed through implicitly.
     *
     * @return array{
     *     type: string,
     *     id: int,
     *     academic_term_id: int,
     *     submitted_by: int,
     *     status: string,
     *     status_label: string,
     *     decided_by: ?int,
     *     decided_at: ?string,
     *     decision_reason: ?string
     * }
     */
    public function toArray(Request $request): array
    {
        return [
            'type' => 'schedule_proposal',
            'id' => $this->resource->id,
            'academic_term_id' => $this->resource->academic_term_id,
            'submitted_by' => $this->resource->submitted_by,
            'status' => $this->resource->status->value,
            'status_label' => $this->resource->status->label(),
            'decided_by' => $this->resource->decided_by,
            'decided_at' => $this->resource->decided_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'decision_reason' => $this->resource->decision_reason,
        ];
    }
}
