<?php

namespace App\Actions\ItControl;

use App\Domain\Audit\AuditRequestContext;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\CollegeCode;
use App\Models\ItControlAutomationRun;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use RuntimeException;

trait ManagesAutomationRun
{
    private const MAX_WARNING_LENGTH = 500;

    private function actor(UserRole $role, ?CollegeCode $college = null): User
    {
        $collegeValue = $college?->value;
        $actor = User::query()
            ->where('role', $role)
            ->where('status', UserStatus::Active)
            ->when($collegeValue !== null, fn ($query) => $query->where('college', $collegeValue))
            ->orderBy('id')
            ->first();

        if ($actor === null) {
            throw new RuntimeException("No active {$role->label()} is available for IT-control automation.");
        }

        return $actor;
    }

    private function context(ItControlAutomationRun $run): AuditRequestContext
    {
        return new AuditRequestContext("it-control-automation-{$run->id}", '127.0.0.1');
    }

    private function processed(ItControlAutomationRun $run): void
    {
        $run->increment('processed_count');
        $run->refresh();
        $processedCount = $run->processed_count;

        if ($processedCount % 500 === 0) {
            Log::info('IT-control automation throughput', [
                'automation_run_id' => $run->id,
                'step' => $run->step->value,
                'processed_count' => $processedCount,
            ]);
        }
    }

    /** @param array<int, string> $messages */
    private function advisoryWarnings(ItControlAutomationRun $run, array $messages): void
    {
        if ($messages === []) {
            return;
        }

        $run->refresh();
        $warnings = $run->warnings ?? [];
        $messages = array_map($this->boundedWarning(...), $messages);
        $run->update(['warnings' => array_values(array_unique([...$warnings, ...$messages]))]);
    }

    private function warning(ItControlAutomationRun $run, string $message): void
    {
        $run->refresh();
        $warnings = $run->warnings ?? [];
        $warnings[] = $this->boundedWarning($message);

        $run->update([
            'failed_count' => $run->failed_count + 1,
            'warnings' => $warnings,
        ]);
    }

    private function boundedWarning(string $message): string
    {
        return mb_strimwidth($message, 0, self::MAX_WARNING_LENGTH, '…');
    }
}
