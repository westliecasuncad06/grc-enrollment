<?php

namespace App\Http\Resources\Api\V1;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read User $resource
 */
final class FacultyMemberResource extends JsonResource
{
    /**
     * @return array{type: string, id: int, name: string, status: string, status_label: string}
     */
    public function toArray(Request $request): array
    {
        return [
            'type' => 'faculty_member',
            'id' => $this->resource->id,
            'name' => $this->resource->name,
            'status' => $this->resource->status->value,
            'status_label' => ucfirst($this->resource->status->value),
        ];
    }
}
