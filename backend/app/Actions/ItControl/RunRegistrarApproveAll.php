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

        // An irregular enrollment now waits for its Program Head before it reaches the Registrar
        // (ADR 0030). This automation plays every role, so it forwards those first, as the Program
        // Head of the student's own college, and the loop below then approves them like any other.
        Enrollment::query()
            ->where('academic_term_id', $run->academic_term_id)
            ->where('status', EnrollmentStatus::PendingProgramHeadApproval)
            ->with('student.program')
            ->orderBy('id')
            ->chunkById(200, function ($enrollments) use ($run): void {
                foreach ($enrollments as $enrollment) {
                    try {
                        $programHead = $this->actor(UserRole::ProgramChair, $enrollment->student->program->college);
                        $this->transition->execute($enrollment, 'program_head_approve', $programHead, null, $this->context($run));
                    } catch (Throwable $exception) {
                        $this->warning($run, "Enrollment {$enrollment->id}: {$exception->getMessage()}");
                    }
                }
            });

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
