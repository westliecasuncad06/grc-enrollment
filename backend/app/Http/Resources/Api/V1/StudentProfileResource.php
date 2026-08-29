<?php

namespace App\Http\Resources\Api\V1;

use App\Models\StudentProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read StudentProfile $resource
 */
final class StudentProfileResource extends JsonResource
{
    /**
     * Exact key set. No attribute is passed through implicitly — in
     * particular, no password or credential ever appears here.
     *
     * @return array{
     *     type: string,
     *     id: int,
     *     user_id: int,
     *     student_number: string,
     *     name: string,
     *     first_name: string,
     *     middle_initial: ?string,
     *     last_name: string,
     *     suffix: ?string,
     *     email: string,
     *     address: ?string,
     *     program_id: int,
     *     program_code: string,
     *     program_name: string,
     *     curriculum_id: int,
     *     entry_year: ?int,
     *     curriculum_name: string,
     *     curriculum_effective_school_year: string,
     *     year_level: int,
     *     enrollment_category: ?string,
     *     student_type: ?string,
     *     student_type_label: ?string,
     *     admission_status: string,
     *     admission_status_label: string,
     *     academic_standing: string,
     *     academic_standing_label: string,
     *     financial_status: ?string,
     *     financial_status_label: ?string,
     *     requirements_verified_at: ?string,
     *     academic_setup_editable: bool,
     *     account_setup_status: 'pending'|'active',
     *     invitation_delivery_status: 'not_sent'|'sent'|'failed'
     * }
     */
    public function toArray(Request $request): array
    {
        $curriculum = $this->resource->curriculum;
        $user = $this->resource->user;
        $program = $this->resource->program;

        return [
            'type' => 'student_profile',
            'id' => $this->resource->id,
            'user_id' => $this->resource->user_id,
            'student_number' => $this->resource->student_number,
            'name' => $user->name,
            'first_name' => $user->first_name ?? '',
            'middle_initial' => $user->middle_initial,
            'last_name' => $user->last_name ?? '',
            'suffix' => $user->suffix,
            'email' => $user->email,
            'address' => $this->resource->address,
            'program_id' => $this->resource->program_id,
            'program_code' => $program->code,
            'program_name' => $program->name,
            'curriculum_id' => $this->resource->curriculum_id,
            'entry_year' => $this->resource->entry_year,
            'curriculum_name' => $curriculum->name,
            'curriculum_effective_school_year' => $curriculum->effective_school_year,
            'year_level' => $this->resource->year_level,
            'enrollment_category' => $this->resource->enrollment_category,
            'student_type' => $this->resource->student_type?->value,
            'student_type_label' => $this->resource->student_type?->label(),
            'admission_status' => $this->resource->admission_status->value,
            'admission_status_label' => $this->resource->admission_status->label(),
            'academic_standing' => $this->resource->academic_standing->value,
            'academic_standing_label' => $this->resource->academic_standing->label(),
            'financial_status' => $this->resource->financial_status?->value,
            'financial_status_label' => $this->resource->financial_status?->label(),
            'requirements_verified_at' => $this->resource->requirements_verified_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'academic_setup_editable' => ! ((bool) ($this->resource->enrollments_exists ?? false)),
            'account_setup_status' => $user->account_setup_completed_at === null ? 'pending' : 'active',
            'invitation_delivery_status' => match (true) {
                $user->account_setup_invitation_failed_at !== null
                    && ($user->account_setup_invitation_sent_at === null
                        || $user->account_setup_invitation_failed_at->greaterThan($user->account_setup_invitation_sent_at)) => 'failed',
                $user->account_setup_invitation_sent_at !== null => 'sent',
                default => 'not_sent',
            },
        ];
    }
}
