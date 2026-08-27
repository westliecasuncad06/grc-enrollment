<?php

namespace App\Actions\Identity;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Mail\StudentAccountSetupMail;
use App\Models\StudentProfile;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;
use Throwable;

final class SendStudentAccountSetupInvitation
{
    public function __construct(private readonly AuditRecorder $auditRecorder) {}

    public function handle(
        StudentProfile $profile,
        User $actor,
        AuditRequestContext $context,
    ): string {
        $student = $profile->user;
        if (
            $student->role !== UserRole::Student
            || $student->status !== UserStatus::Disabled
            || $student->account_setup_completed_at !== null
        ) {
            throw ValidationException::withMessages([
                'student' => 'Only a pending student account can receive a setup invitation.',
            ]);
        }

        $setupCode = Password::broker()->createToken($student);

        try {
            Mail::to($student->email)->send(new StudentAccountSetupMail(
                $student->name,
                rtrim((string) config('app.frontend_url'), '/').'/account-setup',
                $setupCode,
            ));

            $student->forceFill([
                'account_setup_invitation_sent_at' => now(),
                'account_setup_invitation_failed_at' => null,
            ])->save();

            $this->auditRecorder->record(
                $actor,
                AuditAction::STUDENT_ACCOUNT_SETUP_INVITATION_SENT,
                AuditableType::STUDENT_PROFILE,
                $profile->id,
                null,
                ['delivery_status' => 'sent'],
                null,
                $context,
            );

            return 'sent';
        } catch (Throwable $exception) {
            report($exception);

            $student->forceFill([
                'account_setup_invitation_failed_at' => now(),
            ])->save();

            $this->auditRecorder->record(
                $actor,
                AuditAction::STUDENT_ACCOUNT_SETUP_INVITATION_FAILED,
                AuditableType::STUDENT_PROFILE,
                $profile->id,
                null,
                ['delivery_status' => 'failed'],
                null,
                $context,
            );

            return 'failed';
        }
    }
}
