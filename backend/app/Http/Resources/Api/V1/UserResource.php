<?php

namespace App\Http\Resources\Api\V1;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read User $resource
 */
final class UserResource extends JsonResource
{
    /**
     * Exact key set. The password hash and token relationship are never
     * exposed, and no attribute is passed through implicitly.
     *
     * @return array{
     *     type: string,
     *     id: int,
     *     name: string,
     *     email: string,
     *     role: string,
     *     role_label: string,
     *     status: string
     * }
     */
    public function toArray(Request $request): array
    {
        return [
            'type' => 'user',
            'id' => $this->resource->id,
            'name' => $this->resource->name,
            'email' => $this->resource->email,
            'role' => $this->resource->role->value,
            'role_label' => $this->resource->role->label(),
            'status' => $this->resource->status->value,
        ];
    }

    public function withResponse(Request $request, JsonResponse $response): void
    {
        $response->headers->set('Cache-Control', 'no-store, private');
    }
}
