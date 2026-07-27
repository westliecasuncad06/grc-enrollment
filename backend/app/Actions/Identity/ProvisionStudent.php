<?php

namespace App\Actions\Identity;

use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Creates the User account and StudentProfile together (PRD §3.2: "Create
 * new student accounts and initial profiles") — a StudentProfile must never
 * exist without its User, or vice versa, so both rows are written in one
 * transaction.
 */
final class ProvisionStudent
{
    /**
     * @param  array{name: string, email: string, password: string, student_number: string, program_id: int, curriculum_id: int, year_level: int}  $data
     */
    public function handle(array $data): StudentProfile
    {
        return DB::transaction(function () use ($data): StudentProfile {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
                'role' => UserRole::Student,
                'status' => UserStatus::Active,
            ]);

            return StudentProfile::create([
                'user_id' => $user->id,
                'student_number' => $data['student_number'],
                'program_id' => $data['program_id'],
                'curriculum_id' => $data['curriculum_id'],
                'year_level' => $data['year_level'],
                'admission_status' => AdmissionStatus::Admitted,
                'academic_standing' => AcademicStanding::Good,
            ]);
        });
    }
}
