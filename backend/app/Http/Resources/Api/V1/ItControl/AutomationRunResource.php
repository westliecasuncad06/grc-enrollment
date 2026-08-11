<?php

namespace App\Http\Resources\Api\V1\ItControl;

use App\Models\ItControlAutomationRun;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @property-read ItControlAutomationRun $resource */
final class AutomationRunResource extends JsonResource
{
    /** @return array<string, int|string|array<int, string>|null> */
    public function toArray(Request $request): array
    {
        return [
            'type' => 'it-control-automation-run',
            'id' => $this->resource->id,
            'step' => $this->resource->step->value,
            'academic_term_id' => $this->resource->academic_term_id,
            'status' => $this->resource->status->value,
            'processed_count' => $this->resource->processed_count,
            'failed_count' => $this->resource->failed_count,
            'warnings' => $this->resource->warnings ?? [],
            'error_summary' => $this->resource->error_summary,
            'started_at' => $this->resource->started_at?->toAtomString(),
            'completed_at' => $this->resource->completed_at?->toAtomString(),
            'created_at' => $this->resource->created_at?->toAtomString(),
        ];
    }
}
