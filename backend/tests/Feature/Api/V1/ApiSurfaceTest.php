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
            'GET|HEAD api/v1/academic-terms',
            'GET|HEAD api/v1/auth/me',
            'GET|HEAD api/v1/curricula',
            'GET|HEAD api/v1/health',
            'GET|HEAD api/v1/programs',
            'GET|HEAD api/v1/subjects',
            'PATCH api/v1/curricula/{curriculum}',
            'POST api/v1/auth/login',
            'POST api/v1/auth/logout',
            'POST api/v1/curricula',
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
