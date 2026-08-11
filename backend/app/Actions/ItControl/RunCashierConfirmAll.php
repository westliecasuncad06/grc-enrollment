<?php

namespace App\Actions\ItControl;

use App\Actions\Enrollment\ConfirmPayment;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Identity\UserRole;
use App\Models\Enrollment;
use App\Models\ItControlAutomationRun;
use Throwable;

final class RunCashierConfirmAll
{
    use ManagesAutomationRun;

    public function __construct(private readonly ConfirmPayment $confirmPayment) {}

    public function execute(ItControlAutomationRun $run): void
    {
        $cashier = $this->actor(UserRole::AccountingStaff);
        Enrollment::query()->where('academic_term_id', $run->academic_term_id)->where('status', EnrollmentStatus::PendingPayment)->orderBy('id')->chunkById(200, function ($enrollments) use ($run, $cashier): void {
            foreach ($enrollments as $enrollment) {
                try {
                    $this->confirmPayment->execute($enrollment, [], $cashier, $this->context($run));
                    $this->processed($run);
                } catch (Throwable $exception) {
                    $this->warning($run, "Enrollment {$enrollment->id}: {$exception->getMessage()}");
                }
            }
        });
    }
}
