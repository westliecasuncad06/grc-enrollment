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

final class ActivateStaffAccount
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
            || ! in_array($candidate->role, UserRole::registrarInvitableCases(), true)
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
                    ! in_array($locked->role, UserRole::registrarInvitableCases(), true)
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
            AuditAction::STAFF_ACCOUNT_ACTIVATED,
            AuditableType::STAFF_ACCOUNT,
            $activated->id,
            ['account_setup_status' => 'pending'],
            ['account_setup_status' => 'active', 'role' => $activated->role->value],
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
