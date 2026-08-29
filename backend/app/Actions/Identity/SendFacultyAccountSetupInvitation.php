<?php

namespace App\Actions\Identity;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Mail\FacultyAccountSetupMail;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;
use Throwable;

final class SendFacultyAccountSetupInvitation
{
    public function __construct(private readonly AuditRecorder $auditRecorder) {}

    public function handle(
        User $faculty,
        User $actor,
        AuditRequestContext $context,
    ): string {
        if (
            $faculty->role !== UserRole::Faculty
            || $faculty->status !== UserStatus::Disabled
            || $faculty->account_setup_completed_at !== null
        ) {
            throw ValidationException::withMessages([
                'faculty' => 'Only a pending faculty account can receive a setup invitation.',
            ]);
        }

        $setupCode = Password::broker()->createToken($faculty);

        try {
            Mail::to($faculty->email)->send(new FacultyAccountSetupMail(
                rtrim((string) config('app.frontend_url'), '/').'/faculty-account-setup',
                $setupCode,
            ));

            $faculty->forceFill([
                'account_setup_invitation_sent_at' => now(),
                'account_setup_invitation_failed_at' => null,
            ])->save();

            $this->auditRecorder->record(
                $actor,
                AuditAction::FACULTY_ACCOUNT_SETUP_INVITATION_SENT,
                AuditableType::FACULTY_ACCOUNT,
                $faculty->id,
                null,
                ['delivery_status' => 'sent'],
                null,
                $context,
            );

            return 'sent';
        } catch (Throwable $exception) {
            report($exception);

            $faculty->forceFill([
                'account_setup_invitation_failed_at' => now(),
            ])->save();

            $this->auditRecorder->record(
                $actor,
                AuditAction::FACULTY_ACCOUNT_SETUP_INVITATION_FAILED,
                AuditableType::FACULTY_ACCOUNT,
                $faculty->id,
                null,
                ['delivery_status' => 'failed'],
                null,
                $context,
            );

            return 'failed';
        }
    }
}
