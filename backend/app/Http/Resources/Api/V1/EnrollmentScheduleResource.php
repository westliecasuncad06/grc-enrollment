<?php

namespace App\Http\Resources\Api\V1;

use App\Domain\Enrollment\AudienceAvailability;
use App\Domain\Enrollment\EnrollmentScheduleSummary;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read EnrollmentScheduleSummary $resource
 */
final class EnrollmentScheduleResource extends JsonResource
{
    /**
     * @return array{
     *     type: string,
     *     academic_term_id: int,
     *     status: string,
     *     enrollment_opens_at: ?string,
     *     enrollment_closes_at: ?string,
     *     audiences: list<array{
     *         audience: string,
     *         label: string,
     *         opens_at: ?string,
     *         closes_at: ?string,
     *         is_open: bool,
     *         reason: string
     *     }>,
     *     viewer: ?array{
     *         audience: string,
     *         label: string,
     *         opens_at: ?string,
     *         closes_at: ?string,
     *         is_open: bool,
     *         reason: string
     *     }
     * }
     */
    public function toArray(Request $request): array
    {
        return [
            'type' => 'enrollment_schedule',
            'academic_term_id' => $this->resource->academicTermId,
            'status' => $this->resource->status->value,
            'enrollment_opens_at' => $this->resource->termOpensAt?->utc()->format('Y-m-d\TH:i:s\Z'),
            'enrollment_closes_at' => $this->resource->termClosesAt?->utc()->format('Y-m-d\TH:i:s\Z'),
            'audiences' => array_map(
                fn (AudienceAvailability $audience): array => self::availabilityArray($audience),
                $this->resource->audiences,
            ),
            'viewer' => $this->resource->viewer !== null
                ? self::availabilityArray($this->resource->viewer)
                : null,
        ];
    }

    /**
     * @return array{
     *     audience: string,
     *     label: string,
     *     opens_at: ?string,
     *     closes_at: ?string,
     *     is_open: bool,
     *     reason: string
     * }
     */
    private static function availabilityArray(AudienceAvailability $audienceAvailability): array
    {
        return [
            'audience' => $audienceAvailability->audience->value,
            'label' => $audienceAvailability->audience->label(),
            'opens_at' => $audienceAvailability->availability->opensAt?->utc()->format('Y-m-d\TH:i:s\Z'),
            'closes_at' => $audienceAvailability->availability->closesAt?->utc()->format('Y-m-d\TH:i:s\Z'),
            'is_open' => $audienceAvailability->availability->isOpen,
            'reason' => $audienceAvailability->availability->reason->value,
        ];
    }
}
