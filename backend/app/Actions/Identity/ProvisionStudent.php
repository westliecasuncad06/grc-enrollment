<?php

namespace App\Actions\Identity;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Enrollment\EnrollmentCategory;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Models\StudentProfile;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\DB;

/**
 * Creates the User account and StudentProfile together (PRD §3.2: "Create
 * new student accounts and initial profiles") — a StudentProfile must never
 * exist without its User, or vice versa, so both rows are written in one
 * transaction.
 */
final class ProvisionStudent
{
    public function __construct(private readonly AuditRecorder $auditRecorder) {}

    /**
     * @param  array{name: string, email: string, password: string, student_number: string, program_id: int, curriculum_id: int, year_level: int, enrollment_category?: ?string}  $data
     */
    public function handle(
        array $data,
        User $actor,
        AuditRequestContext $context,
    ): StudentProfile {
        return DB::transaction(function () use ($data, $actor, $context): StudentProfile {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
                'role' => UserRole::Student,
                'status' => UserStatus::Active,
            ]);

            $profile = StudentProfile::create([
                'user_id' => $user->id,
                'student_number' => $data['student_number'],
                'program_id' => $data['program_id'],
                'curriculum_id' => $data['curriculum_id'],
                'year_level' => $data['year_level'],
                // Defaults to regular so a provisioned student always has an
                // explicit category; only an irregular one takes the
                // per-subject enrollment path.
                'enrollment_category' => $data['enrollment_category'] ?? EnrollmentCategory::Regular->value,
                'admission_status' => AdmissionStatus::Admitted,
                'academic_standing' => AcademicStanding::Good,
            ]);
            $profile->refresh();

            $this->auditRecorder->record(
                $actor,
                AuditAction::STUDENT_PROFILE_PROVISIONED,
                AuditableType::STUDENT_PROFILE,
                $profile->id,
                null,
                [
                    'user_id' => $profile->user_id,
                    'student_profile_id' => $profile->id,
                    'role' => $user->role->value,
                    'program_id' => $profile->program_id,
                    'curriculum_id' => $profile->curriculum_id,
                    'year_level' => $profile->year_level,
                    'enrollment_category' => $profile->enrollment_category,
                    'admission_status' => $profile->admission_status->value,
                    'academic_standing' => $profile->academic_standing->value,
                ],
                null,
                $context,
            );

            return $profile;
        });
    }
}
