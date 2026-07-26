<?php

namespace Tests\Feature\Api\V1;

use Illuminate\Support\Facades\Route;
use Tests\TestCase;

final class ApiSurfaceTest extends TestCase
{
    public function test_phase_zero_exposes_only_the_versioned_health_route(): void
    {
        $routes = collect(Route::getRoutes()->getRoutes())
            ->map(
                static fn ($route): string => implode('|', $route->methods())
                    .' '.$route->uri(),
            )
            ->sort()
            ->values()
            ->all();

        $this->assertSame(['GET|HEAD api/v1/health'], $routes);
    }
}
