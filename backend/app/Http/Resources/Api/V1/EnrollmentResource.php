<?php

namespace App\Http\Resources\Api\V1;

use App\Models\Enrollment;
use App\Models\EnrollmentSubject;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read Enrollment $resource
 */
final class EnrollmentResource extends JsonResource
{
    /**
     * Exact key set. No attribute is passed through implicitly.
     * `student_number` (never email or name) is exposed so the Registrar
     * Head and Accounting Staff can identify whose enrollment they are
     * processing — the same non-sensitive identifier `StudentProfileResource`
     * already exposes.
     *
     * @return array{
     *     type: string,
     *     id: int,
     *     student_id: int,
     *     student_number: string,
     *     academic_term_id: int,
     *     status: string,
     *     status_label: string,
     *     total_units: float,
     *     submitted_at: ?string,
     *     registrar_decided_at: ?string,
     *     payment_confirmed_at: ?string,
     *     enrolled_at: ?string,
     *     subjects: list<array{section_id: int, subject_code: string, subject_title: string, status: string, status_label: string}>,
     *     queue_ticket: ?array{ticket_number: string, queue_date: string, status: string, status_label: string}
     * }
     */
    public function toArray(Request $request): array
    {
        $queueTicket = $this->resource->queueTicket;

        return [
            'type' => 'enrollment',
            'id' => $this->resource->id,
            'student_id' => $this->resource->student_id,
            'student_number' => $this->resource->student->student_number,
            'academic_term_id' => $this->resource->academic_term_id,
            'status' => $this->resource->status->value,
            'status_label' => $this->resource->status->label(),
            'total_units' => $this->resource->total_units,
            'submitted_at' => $this->resource->submitted_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'registrar_decided_at' => $this->resource->registrar_decided_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'payment_confirmed_at' => $this->resource->payment_confirmed_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'enrolled_at' => $this->resource->enrolled_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'subjects' => array_values(
                $this->resource->enrollmentSubjects
                    ->map(fn (EnrollmentSubject $enrollmentSubject): array => [
                        'section_id' => $enrollmentSubject->section_id,
                        'subject_code' => $enrollmentSubject->section->subject->code,
                        'subject_title' => $enrollmentSubject->section->subject->title,
                        'status' => $enrollmentSubject->status->value,
                        'status_label' => $enrollmentSubject->status->label(),
                    ])
                    ->all(),
            ),
            'queue_ticket' => $queueTicket === null ? null : [
                'ticket_number' => $queueTicket->ticket_number,
                'queue_date' => $queueTicket->queue_date->toDateString(),
                'status' => $queueTicket->status->value,
                'status_label' => $queueTicket->status->label(),
            ],
        ];
    }
}
