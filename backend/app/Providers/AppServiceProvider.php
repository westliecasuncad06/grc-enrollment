<?php

namespace App\Providers;

use App\Domain\Academic\PrerequisiteEvaluator;
use App\Policies\EligibleSubjectPolicy;
use App\Policies\FacultyMemberPolicy;
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
        Gate::define('view-eligible-subjects', [EligibleSubjectPolicy::class, 'viewAny']);
    }
}
