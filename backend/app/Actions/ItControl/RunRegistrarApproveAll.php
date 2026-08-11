<?php

namespace App\Actions\ItControl;

use App\Actions\Enrollment\TransitionEnrollment;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Identity\UserRole;
use App\Models\Enrollment;
use App\Models\ItControlAutomationRun;
use Throwable;

final class RunRegistrarApproveAll implements RunsItControlAutomationStep
{
    use ManagesAutomationRun;

    public function __construct(private readonly TransitionEnrollment $transition) {}

    public function execute(ItControlAutomationRun $run): void
    {
        $registrar = $this->actor(UserRole::RegistrarStaff);
        Enrollment::query()->where('academic_term_id', $run->academic_term_id)->where('status', EnrollmentStatus::PendingRegistrarApproval)->orderBy('id')->chunkById(200, function ($enrollments) use ($run, $registrar): void {
            foreach ($enrollments as $enrollment) {
                try {
                    $this->transition->execute($enrollment, 'registrar_approve', $registrar, null, $this->context($run));
                    $this->processed($run);
                } catch (Throwable $exception) {
                    $this->warning($run, "Enrollment {$enrollment->id}: {$exception->getMessage()}");
                }
            }
        });
    }
}
