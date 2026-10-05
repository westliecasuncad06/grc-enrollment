<?php

namespace App\Http\Resources\Api\V1;

use App\Domain\Enrollment\EnrollmentStatus;
use App\Models\StudentProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One row of the Registrar's read-only list of freshmen who pay first (ADR 0043).
 * Needs the profile loaded by `ListFreshmanEnrollees` (user, program, queue ticket,
 * non-terminal enrollments with their subjects' sections, and the two paid sums).
 *
 * @property-read StudentProfile $resource
 */
final class FreshmanEnrolleeResource extends JsonResource
{
    private const LABELS = [
        'enrolled' => 'Enrolled',
        'enrolling' => 'Awaiting approval',
        'awaiting_section' => 'Awaiting a section',
        'awaiting_payment' => 'Awaiting payment',
    ];

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $profile = $this->resource;
        $enrollment = $profile->enrollments->first();
        $status = match (true) {
            $profile->freshman_payment_confirmed_at === null => 'awaiting_payment',
            $enrollment === null => 'awaiting_section',
            $enrollment->status === EnrollmentStatus::Enrolled => 'enrolled',
            default => 'enrolling',
        };
        $paid = bcadd(self::decimal($profile->getAttribute('enrollment_paid')), self::decimal($profile->getAttribute('account_paid')), 2);

        return [
            'type' => 'freshman_enrollee',
            'id' => $profile->id,
            'student_number' => $profile->student_number,
            'name' => $profile->user->name,
            'program_code' => $profile->program->code,
            'year_level' => $profile->year_level,
            'status' => $status,
            'status_label' => self::LABELS[$status],
            'block_code' => $enrollment?->enrollmentSubjects->first()?->section->section_code,
            'amount_paid' => $status === 'awaiting_payment' ? null : $paid,
            'ticket_number' => $profile->queueTicket?->ticket_number,
            'payment_confirmed_at' => $profile->freshman_payment_confirmed_at?->utc()->format('Y-m-d\TH:i:s\Z'),
        ];
    }

    /**
     * A sum from the list's aggregate sub-selects: a decimal string, or null when the freshman has none.
     *
     * @return numeric-string
     */
    private static function decimal(mixed $value): string
    {
        return is_numeric($value) ? (string) $value : '0';
    }
}
