<?php

namespace App\Actions\Identity;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Curriculum\CurriculumVersion;
use App\Domain\Enrollment\EnrollmentCategory;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\PersonName;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Models\Curriculum;
use App\Models\StudentProfile;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

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
     * @param  array{first_name: string, middle_initial?: ?string, last_name: string, suffix?: ?string, email: string, address: string, student_number: string, program_id: int, entry_year: int, year_level: int, enrollment_category?: ?string, student_type: string, financial_status?: ?string}  $data
     */
    public function handle(
        array $data,
        User $actor,
        AuditRequestContext $context,
    ): StudentProfile {
        return DB::transaction(function () use ($data, $actor, $context): StudentProfile {
            $curriculum = CurriculumVersion::resolveForEntryYear(
                Curriculum::query()
                    ->where('program_id', $data['program_id'])
                    ->orderByDesc('effective_start_year')
                    ->get(),
                $data['entry_year'],
            );
            if ($curriculum === null) {
                throw ValidationException::withMessages([
                    'entry_year' => 'No curriculum version is configured for this program and entry year.',
                ]);
            }

            $firstName = (string) PersonName::normalizeNamePart($data['first_name']);
            $middleInitial = PersonName::normalizeNamePart($data['middle_initial'] ?? null);
            $lastName = (string) PersonName::normalizeNamePart($data['last_name']);
            $suffix = PersonName::normalizeSuffix($data['suffix'] ?? null);

            $user = User::create([
                'name' => PersonName::compose($firstName, $middleInitial, $lastName, $suffix),
                'first_name' => $firstName,
                'middle_initial' => $middleInitial,
                'last_name' => $lastName,
                'suffix' => $suffix,
                'email' => $data['email'],
                'password' => Str::random(64),
                'role' => UserRole::Student,
                'status' => UserStatus::Disabled,
                'account_setup_completed_at' => null,
            ]);

            $profile = StudentProfile::create([
                'user_id' => $user->id,
                'student_number' => $data['student_number'],
                'program_id' => $data['program_id'],
                'curriculum_id' => $curriculum->id,
                'entry_year' => $data['entry_year'],
                'year_level' => $data['year_level'],
                // Defaults to regular so a provisioned student always has an
                // explicit category; only an irregular one takes the
                // per-subject enrollment path.
                'enrollment_category' => $data['enrollment_category'] ?? EnrollmentCategory::Regular->value,
                'student_type' => $data['student_type'],
                'admission_status' => AdmissionStatus::Admitted,
                'academic_standing' => AcademicStanding::Good,
                'financial_status' => $data['financial_status'] ?? null,
                'address' => $data['address'],
                'requirements_verified_at' => now(),
                'requirements_verified_by' => $actor->id,
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
                    'entry_year' => $profile->entry_year,
                    'year_level' => $profile->year_level,
                    'enrollment_category' => $profile->enrollment_category,
                    'student_type' => $profile->student_type?->value,
                    'admission_status' => $profile->admission_status->value,
                    'academic_standing' => $profile->academic_standing->value,
                    'financial_status' => $profile->financial_status?->value,
                ],
                null,
                $context,
            );

            return $profile;
        });
    }
}
