<?php

namespace App\Providers;

use App\Domain\Academic\PrerequisiteEvaluator;
use App\Policies\AcademicRecordPolicy;
use App\Policies\DashboardPolicy;
use App\Policies\EligibleSubjectPolicy;
use App\Policies\FacultyMemberPolicy;
use App\Policies\ItControlPolicy;
use App\Policies\StuckEnrollmentPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // PrerequisiteEvaluator takes primitives, not a config array, so its
        // "policy unconfigured -> needs_verification" behavior is exercised
        // identically in unit tests and in the resolved application service.
        $this->app->bind(PrerequisiteEvaluator::class, fn (): PrerequisiteEvaluator => new PrerequisiteEvaluator(
            config('enrollment.grading.comparison'),
            config('enrollment.grading.special_marks', []),
        ));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::define('view-faculty-directory', [FacultyMemberPolicy::class, 'viewAny']);
        Gate::define('view-it-control-account-browser', [ItControlPolicy::class, 'viewAccountBrowser']);
        Gate::define('view-it-control-automation-runs', [ItControlPolicy::class, 'viewAutomationRuns']);
        Gate::define('create-it-control-automation-runs', [ItControlPolicy::class, 'createAutomationRuns']);
        Gate::define('update-faculty-workforce-profile', [FacultyMemberPolicy::class, 'updateWorkforceProfile']);
        Gate::define('view-eligible-subjects', [EligibleSubjectPolicy::class, 'viewAny']);
        Gate::define('view-enrollment-summary', [DashboardPolicy::class, 'viewEnrollmentSummary']);
        Gate::define('view-institution-summary', [DashboardPolicy::class, 'viewInstitutionSummary']);
        Gate::define('view-policy-settings', [DashboardPolicy::class, 'viewPolicySettings']);
        Gate::define('view-analytics', [DashboardPolicy::class, 'viewAnalytics']);
        Gate::define('view-stuck-enrollments', [StuckEnrollmentPolicy::class, 'viewAny']);
        Gate::define('view-academic-record', [AcademicRecordPolicy::class, 'view']);
    }
}
