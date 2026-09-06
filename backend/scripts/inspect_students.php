<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\StudentProfile;
use App\Models\ProfileChangeRequest;

$sample = StudentProfile::with(['user', 'program'])->first();
if ($sample) {
    echo "Sample Student: Number={$sample->student_number}, Name={$sample->user?->name}, Email={$sample->user?->email}, Program={$sample->program?->code}, Year={$sample->year_level}" . PHP_EOL;
}

$changeReqCount = ProfileChangeRequest::count();
echo "Change Requests count: {$changeReqCount}" . PHP_EOL;
if ($changeReqCount > 0) {
    $req = ProfileChangeRequest::first();
    echo "Sample Request: ID={$req->id}, Status={$req->status}" . PHP_EOL;
}

