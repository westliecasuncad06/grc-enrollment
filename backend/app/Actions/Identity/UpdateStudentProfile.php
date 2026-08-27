<?php

namespace App\Actions\Identity;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Curriculum\CurriculumVersion;
use App\Domain\Identity\PersonName;
use App\Models\Curriculum;
use App\Models\StudentProfile;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class UpdateStudentProfile
{
    private const PERSONAL_FIELDS = ['first_name', 'middle_initial', 'last_name', 'suffix', 'email', 'address'];

    private const NAME_PART_FIELDS = ['first_name', 'middle_initial', 'last_name', 'suffix'];

    private const ACADEMIC_SETUP_FIELDS = [
        'student_number',
        'program_id',
        'entry_year',
        'year_level',
        'enrollment_category',
        'student_type',
        'financial_status',
        'admission_status',
    ];

    public function __construct(private readonly AuditRecorder $auditRecorder) {}

    /** @param array<string, mixed> $data */
    public function handle(
        StudentProfile $profile,
        array $data,
        User $actor,
        AuditRequestContext $context,
    ): StudentProfile {
        return DB::transaction(function () use ($profile, $data, $actor, $context): StudentProfile {
            $locked = StudentProfile::query()->whereKey($profile->id)->lockForUpdate()->firstOrFail();
            $user = User::query()->whereKey($locked->user_id)->lockForUpdate()->firstOrFail();
            $requestedFields = array_values(array_intersect(
                array_keys($data),
                [...self::PERSONAL_FIELDS, ...self::ACADEMIC_SETUP_FIELDS],
            ));

            if ($requestedFields === []) {
                throw ValidationException::withMessages([
                    'profile' => 'At least one student information field must be changed.',
                ]);
            }

            $academicFields = array_values(array_intersect($requestedFields, self::ACADEMIC_SETUP_FIELDS));
            if ($academicFields !== [] && $locked->enrollments()->exists()) {
                throw ValidationException::withMessages([
                    'profile' => 'Academic setup fields cannot be changed after the student has an enrollment record.',
                ]);
            }

            $userData = Arr::only($data, [...self::NAME_PART_FIELDS, 'email']);
            foreach (['first_name', 'middle_initial', 'last_name'] as $namePart) {
                if (array_key_exists($namePart, $userData)) {
                    $userData[$namePart] = PersonName::normalizeNamePart($userData[$namePart]);
                }
            }
            if (array_key_exists('suffix', $userData)) {
                $userData['suffix'] = PersonName::normalizeSuffix($userData['suffix']);
            }
            if (array_intersect(array_keys($userData), self::NAME_PART_FIELDS) !== []) {
                $userData['name'] = PersonName::compose(
                    $userData['first_name'] ?? $user->first_name ?? '',
                    array_key_exists('middle_initial', $userData) ? $userData['middle_initial'] : $user->middle_initial,
                    $userData['last_name'] ?? $user->last_name ?? '',
                    array_key_exists('suffix', $userData) ? $userData['suffix'] : $user->suffix,
                );
            }
            if ($userData !== []) {
                $user->fill($userData)->save();
            }

            $profileData = Arr::only($data, [
                'address',
                'student_number',
                'program_id',
                'entry_year',
                'year_level',
                'enrollment_category',
                'student_type',
                'financial_status',
                'admission_status',
            ]);

            if (array_key_exists('program_id', $profileData) || array_key_exists('entry_year', $profileData)) {
                $programId = (int) ($profileData['program_id'] ?? $locked->program_id);
                $entryYear = (int) ($profileData['entry_year'] ?? $locked->entry_year);
                $curriculum = CurriculumVersion::resolveForEntryYear(
                    Curriculum::query()
                        ->where('program_id', $programId)
                        ->orderByDesc('effective_start_year')
                        ->get(),
                    $entryYear,
                );

                if ($curriculum === null) {
                    throw ValidationException::withMessages([
                        'entry_year' => 'No curriculum version is configured for this program and entry year.',
                    ]);
                }

                $profileData['curriculum_id'] = $curriculum->id;
            }

            $locked->fill($profileData)->save();

            $this->auditRecorder->record(
                $actor,
                AuditAction::STUDENT_PROFILE_UPDATED,
                AuditableType::STUDENT_PROFILE,
                $locked->id,
                ['field_count' => count($requestedFields)],
                ['changed_fields' => $requestedFields, 'reason_provided' => true],
                null,
                $context,
            );

            return $locked->refresh()->load(['user', 'program', 'curriculum']);
        });
    }
}
