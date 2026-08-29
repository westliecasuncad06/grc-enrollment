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

final class ActivateFacultyAccount
{
    public function __construct(private readonly AuditRecorder $auditRecorder) {}

    public function handle(
        string $email,
        string $code,
        string $password,
        string $name,
        AuditRequestContext $context,
    ): User {
        $candidate = User::query()->where('email', $email)->first();

        if (
            ! $candidate instanceof User
            || $candidate->role !== UserRole::Faculty
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
        ], function (User $user, string $newPassword) use ($name, &$activated): void {
            $activated = DB::transaction(function () use ($user, $newPassword, $name): User {
                $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

                if (
                    $locked->role !== UserRole::Faculty
                    || $locked->status !== UserStatus::Disabled
                    || $locked->account_setup_completed_at !== null
                ) {
                    $this->invalidCode();
                }

                $locked->forceFill([
                    'name' => $name,
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

        $this->auditRecorder->record(
            $activated,
            AuditAction::FACULTY_ACCOUNT_ACTIVATED,
            AuditableType::FACULTY_ACCOUNT,
            $activated->id,
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
