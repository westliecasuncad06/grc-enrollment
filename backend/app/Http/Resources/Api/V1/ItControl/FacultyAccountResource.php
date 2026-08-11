<?php

namespace App\Http\Resources\Api\V1\ItControl;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @property-read User $resource */
final class FacultyAccountResource extends JsonResource
{
    /** @return array<string, int|string|null> */
    public function toArray(Request $request): array
    {
        return [
            'type' => 'it-control-faculty-account',
            'id' => $this->resource->id,
            'name' => $this->resource->name,
            'email' => $this->resource->email,
            'college' => $this->resource->college?->value,
            'employment_type' => $this->resource->employment_type?->value,
            'status' => $this->resource->status->value,
            'availability_window_count' => (int) $this->resource->getAttribute('availability_window_count'),
            'subject_preference_count' => (int) $this->resource->getAttribute('subject_preference_count'),
            'specialization_count' => (int) $this->resource->getAttribute('specialization_count'),
            'password_hint' => 'password',
        ];
    }
}
