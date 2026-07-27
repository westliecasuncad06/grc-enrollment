<?php

namespace Tests\Feature\Api\V1;

use Illuminate\Support\Facades\Route;
use Tests\TestCase;

final class ApiSurfaceTest extends TestCase
{
    public function test_the_api_exposes_only_the_documented_routes(): void
    {
        $routes = collect(Route::getRoutes()->getRoutes())
            ->map(
                static fn ($route): string => implode('|', $route->methods())
                    .' '.$route->uri(),
            )
            ->sort()
            ->values()
            ->all();

        $this->assertSame([
            'DELETE api/v1/faculty-availabilities/{facultyAvailability}',
            'DELETE api/v1/faculty-subject-preferences/{facultySubjectPreference}',
            'GET|HEAD api/v1/academic-terms',
            'GET|HEAD api/v1/auth/me',
            'GET|HEAD api/v1/curricula',
            'GET|HEAD api/v1/faculty-availabilities',
            'GET|HEAD api/v1/faculty-subject-preferences',
            'GET|HEAD api/v1/health',
            'GET|HEAD api/v1/programs',
            'GET|HEAD api/v1/schedule-proposals',
            'GET|HEAD api/v1/sections',
            'GET|HEAD api/v1/subjects',
            'PATCH api/v1/curricula/{curriculum}',
            'PATCH api/v1/faculty-availabilities/{facultyAvailability}',
            'PATCH api/v1/faculty-subject-preferences/{facultySubjectPreference}',
            'PATCH api/v1/schedule-proposals/{scheduleProposal}',
            'PATCH api/v1/sections/{section}',
            'POST api/v1/auth/login',
            'POST api/v1/auth/logout',
            'POST api/v1/curricula',
            'POST api/v1/faculty-availabilities',
            'POST api/v1/faculty-subject-preferences',
            'POST api/v1/schedule-proposals',
            'POST api/v1/sections',
        ], $routes);
    }

    public function test_the_authenticated_routes_are_guarded(): void
    {
        $guarded = [
            'api.v1.auth.logout',
            'api.v1.auth.me',
            'api.v1.programs',
            'api.v1.academic-terms',
            'api.v1.subjects',
            'api.v1.curricula.index',
            'api.v1.curricula.store',
            'api.v1.curricula.update',
            'api.v1.faculty-availabilities.index',
            'api.v1.faculty-availabilities.store',
            'api.v1.faculty-availabilities.update',
            'api.v1.faculty-availabilities.destroy',
            'api.v1.faculty-subject-preferences.index',
            'api.v1.faculty-subject-preferences.store',
            'api.v1.faculty-subject-preferences.update',
            'api.v1.faculty-subject-preferences.destroy',
            'api.v1.sections.index',
            'api.v1.sections.store',
            'api.v1.sections.update',
            'api.v1.schedule-proposals.index',
            'api.v1.schedule-proposals.store',
            'api.v1.schedule-proposals.update',
        ];

        foreach ($guarded as $name) {
            $route = Route::getRoutes()->getByName($name);

            $this->assertNotNull($route, "Missing route {$name}.");
            $this->assertContains('auth:sanctum', $route->gatherMiddleware());
        }
    }

    public function test_curriculum_writes_are_gated_to_the_program_chair_role(): void
    {
        $gated = ['api.v1.curricula.store', 'api.v1.curricula.update'];

        foreach ($gated as $name) {
            $route = Route::getRoutes()->getByName($name);

            $this->assertNotNull($route, "Missing route {$name}.");
            $this->assertContains('role:program_chair', $route->gatherMiddleware());
        }

        $readRoute = Route::getRoutes()->getByName('api.v1.curricula.index');
        $this->assertNotNull($readRoute);
        $this->assertNotContains('role:program_chair', $readRoute->gatherMiddleware());
    }

    public function test_faculty_input_writes_are_gated_to_the_faculty_role(): void
    {
        $gated = [
            'api.v1.faculty-availabilities.store',
            'api.v1.faculty-availabilities.update',
            'api.v1.faculty-availabilities.destroy',
            'api.v1.faculty-subject-preferences.store',
            'api.v1.faculty-subject-preferences.update',
            'api.v1.faculty-subject-preferences.destroy',
        ];

        foreach ($gated as $name) {
            $route = Route::getRoutes()->getByName($name);

            $this->assertNotNull($route, "Missing route {$name}.");
            $this->assertContains('role:faculty', $route->gatherMiddleware());
        }

        $readRoute = Route::getRoutes()->getByName('api.v1.faculty-availabilities.index');
        $this->assertNotNull($readRoute);
        $this->assertNotContains('role:faculty', $readRoute->gatherMiddleware());
    }

    public function test_section_writes_are_gated_to_the_program_chair_role(): void
    {
        $gated = ['api.v1.sections.store', 'api.v1.sections.update'];

        foreach ($gated as $name) {
            $route = Route::getRoutes()->getByName($name);

            $this->assertNotNull($route, "Missing route {$name}.");
            $this->assertContains('role:program_chair', $route->gatherMiddleware());
        }

        $readRoute = Route::getRoutes()->getByName('api.v1.sections.index');
        $this->assertNotNull($readRoute);
        $this->assertNotContains('role:program_chair', $readRoute->gatherMiddleware());
    }

    public function test_schedule_proposal_submission_is_gated_to_the_program_chair_role(): void
    {
        $route = Route::getRoutes()->getByName('api.v1.schedule-proposals.store');

        $this->assertNotNull($route);
        $this->assertContains('role:program_chair', $route->gatherMiddleware());
    }

    /**
     * Unlike every other write route, a single PATCH here serves six
     * different transitions needing six different roles — so it carries no
     * `role:` middleware at all. ScheduleProposalPolicy resolves the right
     * ability per request instead. See ADR 0011.
     */
    public function test_schedule_proposal_transitions_carry_no_role_middleware(): void
    {
        $route = Route::getRoutes()->getByName('api.v1.schedule-proposals.update');

        $this->assertNotNull($route);

        $roleMiddleware = array_filter(
            $route->gatherMiddleware(),
            static fn ($middleware): bool => is_string($middleware) && str_starts_with($middleware, 'role:'),
        );

        $this->assertSame([], array_values($roleMiddleware));
    }

    public function test_the_login_route_is_throttled(): void
    {
        $route = Route::getRoutes()->getByName('api.v1.auth.login');

        $this->assertNotNull($route);
        $this->assertNotEmpty(
            array_filter(
                $route->gatherMiddleware(),
                static fn ($middleware): bool => is_string($middleware)
                    && str_contains($middleware, 'throttle'),
            ),
        );
    }
}
