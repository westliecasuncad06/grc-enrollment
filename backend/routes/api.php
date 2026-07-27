<?php

use App\Http\Controllers\Api\V1\Auth\LoginController;
use App\Http\Controllers\Api\V1\Auth\LogoutController;
use App\Http\Controllers\Api\V1\Auth\MeController;
use App\Http\Controllers\Api\V1\HealthController;
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
});
