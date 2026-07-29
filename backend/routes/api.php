<?php

use App\Http\Controllers\Api\V1\AcademicTermController;
use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\Auth\LoginController;
use App\Http\Controllers\Api\V1\Auth\LogoutController;
use App\Http\Controllers\Api\V1\Auth\MeController;
use App\Http\Controllers\Api\V1\CurriculumController;
use App\Http\Controllers\Api\V1\EligibleSubjectController;
use App\Http\Controllers\Api\V1\FacultyAvailabilityController;
use App\Http\Controllers\Api\V1\FacultyMemberController;
use App\Http\Controllers\Api\V1\FacultySubjectPreferenceController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\ProgramController;
use App\Http\Controllers\Api\V1\ScheduleProposalController;
use App\Http\Controllers\Api\V1\SectionController;
use App\Http\Controllers\Api\V1\StudentProfileController;
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
        Route::get('/faculty-availabilities', [FacultyAvailabilityController::class, 'index'])->name('faculty-availabilities.index');
        Route::get('/faculty-subject-preferences', [FacultySubjectPreferenceController::class, 'index'])->name('faculty-subject-preferences.index');
        Route::get('/sections', [SectionController::class, 'index'])->name('sections.index');
        Route::get('/schedule-proposals', [ScheduleProposalController::class, 'index'])->name('schedule-proposals.index');
        Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
        Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markRead'])->name('notifications.read');

        // Every transition (dean_approve, dean_return, executive_approve,
        // executive_return, publish, close) needs a *different* role, so a
        // single blanket `role:` middleware doesn't fit this one route —
        // ScheduleProposalPolicy resolves the right ability per request. See
        // ADR 0011.
        Route::patch('/schedule-proposals/{scheduleProposal}', [ScheduleProposalController::class, 'update'])->name('schedule-proposals.update');

        // Own-record only — no role gate beyond authentication, since the
        // Policy resolves "whose profile is this" the same way auth/me does.
        Route::get('/student-profile', [StudentProfileController::class, 'show'])->name('student-profile.show');

        // Own computed view, not a stored resource — EligibleSubjectPolicy
        // resolves "student role only" the same way FacultyMemberPolicy
        // resolves "program chair only" for the faculty directory.
        Route::get('/eligible-subjects', EligibleSubjectController::class)->name('eligible-subjects.index');

        // First production consumer of the `role` middleware (ADR 0008):
        // only the Program Chair authors curricula, matching the frontend's
        // existing "curriculum"/"subjects-prerequisites" module ownership.
        // CurriculumPolicy re-checks the role as defense in depth.
        Route::middleware('role:program_chair')->group(function (): void {
            Route::get('/faculty-members', FacultyMemberController::class)->name('faculty-members.index');

            Route::post('/curricula', [CurriculumController::class, 'store'])->name('curricula.store');
            Route::patch('/curricula/{curriculum}', [CurriculumController::class, 'update'])->name('curricula.update');

            // Sections are the chair's schedule plan, same ownership as
            // curriculum authorship.
            Route::post('/sections', [SectionController::class, 'store'])->name('sections.store');
            Route::patch('/sections/{section}', [SectionController::class, 'update'])->name('sections.update');

            // Submitting (creating) a proposal is single-role, unlike its
            // transitions.
            Route::post('/schedule-proposals', [ScheduleProposalController::class, 'store'])->name('schedule-proposals.store');
        });

        // A Faculty member writes only their own availability/preferences —
        // an own-record scope, not a role-exclusive resource like curricula.
        // The Policy re-checks professor_id === auth()->id() as defense in
        // depth (ADR 0008's pattern, applied to a new authorization shape).
        Route::middleware('role:faculty')->group(function (): void {
            Route::post('/faculty-availabilities', [FacultyAvailabilityController::class, 'store'])->name('faculty-availabilities.store');
            Route::patch('/faculty-availabilities/{facultyAvailability}', [FacultyAvailabilityController::class, 'update'])->name('faculty-availabilities.update');
            Route::delete('/faculty-availabilities/{facultyAvailability}', [FacultyAvailabilityController::class, 'destroy'])->name('faculty-availabilities.destroy');

            Route::post('/faculty-subject-preferences', [FacultySubjectPreferenceController::class, 'store'])->name('faculty-subject-preferences.store');
            Route::patch('/faculty-subject-preferences/{facultySubjectPreference}', [FacultySubjectPreferenceController::class, 'update'])->name('faculty-subject-preferences.update');
            Route::delete('/faculty-subject-preferences/{facultySubjectPreference}', [FacultySubjectPreferenceController::class, 'destroy'])->name('faculty-subject-preferences.destroy');
        });

        // PRD §3.2: "Create new student accounts and initial profiles" —
        // first production consumer of the admission_staff role.
        Route::middleware('role:admission_staff')->group(function (): void {
            Route::post('/student-profiles', [StudentProfileController::class, 'store'])->name('student-profiles.store');
        });

        Route::middleware('role:registrar_head')->group(function (): void {
            Route::get('/audit-logs', AuditLogController::class)
                ->name('audit-logs.index');
        });
    });
});
