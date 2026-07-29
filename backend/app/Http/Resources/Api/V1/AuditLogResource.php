<?php

namespace App\Http\Resources\Api\V1;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read AuditLog $resource
 */
final class AuditLogResource extends JsonResource
{
    /**
     * Exact safe key set. Actor names and email addresses are deliberately
     * excluded from this privileged-read response.
     *
     * @return array{
     *     type: string,
     *     id: int,
     *     actor_user_id: int,
     *     actor_role: string,
     *     actor_role_label: string,
     *     action: string,
     *     auditable_type: string,
     *     auditable_id: ?int,
     *     before_values: ?array<string, mixed>,
     *     after_values: ?array<string, mixed>,
     *     reason: ?string,
     *     request_id: string,
     *     ip_address: ?string,
     *     created_at: ?string
     * }
     */
    public function toArray(Request $request): array
    {
        return [
            'type' => 'audit_log',
            'id' => $this->resource->id,
            'actor_user_id' => $this->resource->actor_user_id,
            'actor_role' => $this->resource->actor->role->value,
            'actor_role_label' => $this->resource->actor->role->label(),
            'action' => $this->resource->action,
            'auditable_type' => $this->resource->auditable_type,
            'auditable_id' => $this->resource->auditable_id,
            'before_values' => $this->resource->before_values,
            'after_values' => $this->resource->after_values,
            'reason' => $this->resource->reason,
            'request_id' => $this->resource->request_id,
            'ip_address' => $this->resource->ip_address,
            'created_at' => $this->resource->created_at?->utc()->format('Y-m-d\TH:i:s\Z'),
        ];
    }
}
