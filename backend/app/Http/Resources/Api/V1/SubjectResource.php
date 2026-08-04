<?php

namespace App\Http\Resources\Api\V1;

use App\Models\Subject;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read Subject $resource
 */
final class SubjectResource extends JsonResource
{
    /**
     * Exact key set. No attribute is passed through implicitly.
     * `is_completion_only` marks subjects graded Complete/Not-Complete only
     * (Leadership) — see `Subject::isCompletionOnly()`.
     *
     * @return array{
     *     type: string,
     *     id: int,
     *     code: string,
     *     title: string,
     *     units: float,
     *     status: string,
     *     status_label: string,
     *     is_completion_only: bool
     * }
     */
    public function toArray(Request $request): array
    {
        return [
            'type' => 'subject',
            'id' => $this->resource->id,
            'code' => $this->resource->code,
            'title' => $this->resource->title,
            'units' => $this->resource->units,
            'status' => $this->resource->status->value,
            'status_label' => $this->resource->status->label(),
            'is_completion_only' => $this->resource->isCompletionOnly(),
        ];
    }
}
