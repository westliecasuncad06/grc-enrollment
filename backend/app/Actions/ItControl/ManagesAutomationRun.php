<?php

namespace App\Actions\ItControl;

use App\Domain\Audit\AuditRequestContext;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\CollegeCode;
use App\Models\ItControlAutomationRun;
use App\Models\User;
use RuntimeException;

trait ManagesAutomationRun
{
    private function actor(UserRole $role, ?CollegeCode $college = null): User
    {
        $actor = User::query()
            ->where('role', $role)
            ->where('status', UserStatus::Active)
            ->when($college !== null, fn ($query) => $query->where('college', $college->value))
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
    }

    private function warning(ItControlAutomationRun $run, string $message): void
    {
        $warnings = $run->fresh()->warnings ?? [];
        $warnings[] = $message;

        $run->update([
            'failed_count' => $run->fresh()->failed_count + 1,
            'warnings' => $warnings,
        ]);
    }
}
