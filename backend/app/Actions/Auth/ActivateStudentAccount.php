<?php

namespace App\Actions\Auth;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

final class ActivateStudentAccount
{
    public function __construct(private readonly AuditRecorder $auditRecorder) {}

    public function handle(
        string $email,
        string $code,
        string $password,
        AuditRequestContext $context,
    ): User {
        $candidate = User::query()->where('email', $email)->first();

        if (
            ! $candidate instanceof User
            || $candidate->role !== UserRole::Student
            || $candidate->status !== UserStatus::Disabled
            || $candidate->account_setup_completed_at !== null
        ) {
            $this->invalidCode();
        }

        $activated = null;
        $status = Password::broker()->reset([
            'email' => $email,
            'password' => $password,
            'password_confirmation' => $password,
            'token' => $code,
        ], function (User $user, string $newPassword) use (&$activated): void {
            $activated = DB::transaction(function () use ($user, $newPassword): User {
                $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

                if (
                    $locked->role !== UserRole::Student
                    || $locked->status !== UserStatus::Disabled
                    || $locked->account_setup_completed_at !== null
                ) {
                    $this->invalidCode();
                }

                $locked->forceFill([
                    'password' => Hash::make($newPassword),
                    'status' => UserStatus::Active,
                    'account_setup_completed_at' => now(),
                ])->save();
                $locked->tokens()->delete();

                return $locked->refresh();
            });
        });

        if ($status !== Password::PASSWORD_RESET || ! $activated instanceof User) {
            $this->invalidCode();
        }

        $profileId = $activated->studentProfile()->value('id');
        $this->auditRecorder->record(
            $activated,
            AuditAction::STUDENT_ACCOUNT_ACTIVATED,
            AuditableType::STUDENT_PROFILE,
            is_numeric($profileId) ? (int) $profileId : null,
            ['account_setup_status' => 'pending'],
            ['account_setup_status' => 'active'],
            null,
            $context,
        );

        return $activated;
    }

    private function invalidCode(): never
    {
        throw ValidationException::withMessages([
            'code' => 'The setup code is invalid or expired.',
        ]);
    }
}
