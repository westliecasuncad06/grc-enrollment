<?php

namespace App\Actions\ItControl;

use App\Models\ItControlAutomationRun;

interface RunsItControlAutomationStep
{
    public function execute(ItControlAutomationRun $run): void;
}
