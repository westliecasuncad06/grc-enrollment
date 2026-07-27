<?php

use App\Http\Controllers\Api\V1\AcademicTermController;
use App\Http\Controllers\Api\V1\Auth\LoginController;
use App\Http\Controllers\Api\V1\Auth\LogoutController;
use App\Http\Controllers\Api\V1\Auth\MeController;
use App\Http\Controllers\Api\V1\CurriculumController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\ProgramController;
use App\Http\Controllers\Api\V1\SubjectController;
use App\Http\Middleware\EnsureUserIsActive;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('api.v1.')->group(function (): void {
    Route::get('/health', HealthController::class)
        ->middleware('throttle:60,1')
        ->name('health');

    Route::prefix('auth')->name('auth.')->group(function (): void {
        // Public. Per-account+IP throttling is applied inside the controller;
        // this coarse limiter is an additional flood guard.
        Route::post('/login', LoginController::class)
            ->middleware('throttle:30,1')
            ->name('login');

        Route::middleware(['auth:sanctum', EnsureUserIsActive::class])->group(function (): void {
            Route::post('/logout', LogoutController::class)->name('logout');
            Route::get('/me', MeController::class)->name('me');
        });
    });

    // Readable by every role; ProgramPolicy/AcademicTermPolicy plus each
    // model's visibleTo() scope decide which rows a given role receives.
    Route::middleware(['auth:sanctum', EnsureUserIsActive::class, 'throttle:60,1'])->group(function (): void {
        Route::get('/programs', ProgramController::class)->name('programs');
        Route::get('/academic-terms', AcademicTermController::class)->name('academic-terms');
        Route::get('/subjects', SubjectController::class)->name('subjects');
        Route::get('/curricula', [CurriculumController::class, 'index'])->name('curricula.index');

        // First production consumer of the `role` middleware (ADR 0008):
        // only the Program Chair authors curricula, matching the frontend's
        // existing "curriculum"/"subjects-prerequisites" module ownership.
        // CurriculumPolicy re-checks the role as defense in depth.
        Route::middleware('role:program_chair')->group(function (): void {
            Route::post('/curricula', [CurriculumController::class, 'store'])->name('curricula.store');
            Route::patch('/curricula/{curriculum}', [CurriculumController::class, 'update'])->name('curricula.update');
        });
    });
});
