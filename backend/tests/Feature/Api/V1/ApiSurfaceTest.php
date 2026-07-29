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
            'GET|HEAD api/v1/academic-grades',
            'GET|HEAD api/v1/academic-terms',
            'GET|HEAD api/v1/audit-logs',
            'GET|HEAD api/v1/auth/me',
            'GET|HEAD api/v1/curricula',
            'GET|HEAD api/v1/eligible-subjects',
            'GET|HEAD api/v1/enrollments',
            'GET|HEAD api/v1/faculty-availabilities',
            'GET|HEAD api/v1/faculty-members',
            'GET|HEAD api/v1/faculty-subject-preferences',
            'GET|HEAD api/v1/health',
            'GET|HEAD api/v1/notifications',
            'GET|HEAD api/v1/programs',
            'GET|HEAD api/v1/schedule-proposals',
            'GET|HEAD api/v1/sections',
            'GET|HEAD api/v1/student-profile',
            'GET|HEAD api/v1/subjects',
            'PATCH api/v1/academic-grades/{academicGrade}',
            'PATCH api/v1/curricula/{curriculum}',
            'PATCH api/v1/enrollments/{enrollment}',
            'PATCH api/v1/faculty-availabilities/{facultyAvailability}',
            'PATCH api/v1/faculty-subject-preferences/{facultySubjectPreference}',
            'PATCH api/v1/notifications/{notification}/read',
            'PATCH api/v1/schedule-proposals/{scheduleProposal}',
            'PATCH api/v1/sections/{section}',
            'POST api/v1/academic-grades',
            'POST api/v1/auth/login',
            'POST api/v1/auth/logout',
            'POST api/v1/curricula',
            'POST api/v1/enrollments',
            'POST api/v1/faculty-availabilities',
            'POST api/v1/faculty-subject-preferences',
            'POST api/v1/schedule-proposals',
            'POST api/v1/sections',
            'POST api/v1/student-profiles',
        ], $routes);
    }

    public function test_the_authenticated_routes_are_guarded(): void
    {
        $guarded = [
            'api.v1.auth.logout',
            'api.v1.auth.me',
            'api.v1.audit-logs.index',
            'api.v1.notifications.index',
            'api.v1.notifications.read',
            'api.v1.programs',
            'api.v1.academic-terms',
            'api.v1.subjects',
            'api.v1.curricula.index',
            'api.v1.curricula.store',
            'api.v1.curricula.update',
            'api.v1.eligible-subjects.index',
            'api.v1.enrollments.index',
            'api.v1.enrollments.store',
            'api.v1.enrollments.update',
            'api.v1.academic-grades.index',
            'api.v1.academic-grades.store',
            'api.v1.academic-grades.update',
            'api.v1.faculty-availabilities.index',
            'api.v1.faculty-members.index',
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
            'api.v1.student-profile.show',
            'api.v1.student-profiles.store',
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

    public function test_student_profile_provisioning_is_gated_to_the_admission_staff_role(): void
    {
        $route = Route::getRoutes()->getByName('api.v1.student-profiles.store');

        $this->assertNotNull($route);
        $this->assertContains('role:admission_staff', $route->gatherMiddleware());
    }

    public function test_cross_cutting_read_routes_have_the_exact_role_boundaries(): void
    {
        $auditRoute = Route::getRoutes()->getByName('api.v1.audit-logs.index');

        $this->assertNotNull($auditRoute);
        $this->assertContains('role:registrar_head', $auditRoute->gatherMiddleware());

        foreach (['api.v1.notifications.index', 'api.v1.notifications.read'] as $name) {
            $route = Route::getRoutes()->getByName($name);

            $this->assertNotNull($route, "Missing route {$name}.");

            $roleMiddleware = array_filter(
                $route->gatherMiddleware(),
                static fn ($middleware): bool => is_string($middleware)
                    && str_starts_with($middleware, 'role:'),
            );

            $this->assertSame([], array_values($roleMiddleware));
        }
    }

    public function test_faculty_directory_is_gated_to_the_program_chair_role(): void
    {
        $route = Route::getRoutes()->getByName('api.v1.faculty-members.index');

        $this->assertNotNull($route);
        $this->assertContains('role:program_chair', $route->gatherMiddleware());
    }

    /**
     * Own computed view, not a role-exclusive resource — no `role:`
     * middleware, matching `student-profile.show`. EligibleSubjectPolicy
     * resolves the student-only boundary instead.
     */
    public function test_eligible_subjects_carries_no_role_middleware(): void
    {
        $route = Route::getRoutes()->getByName('api.v1.eligible-subjects.index');

        $this->assertNotNull($route);

        $roleMiddleware = array_filter(
            $route->gatherMiddleware(),
            static fn ($middleware): bool => is_string($middleware) && str_starts_with($middleware, 'role:'),
        );

        $this->assertSame([], array_values($roleMiddleware));
    }

    /**
     * Own-record only, no role-exclusive resource — no `role:` middleware
     * on either route. EnrollmentPolicy resolves the student-only boundary.
     */
    public function test_enrollments_carry_no_role_middleware(): void
    {
        foreach (['api.v1.enrollments.index', 'api.v1.enrollments.store', 'api.v1.enrollments.update'] as $name) {
            $route = Route::getRoutes()->getByName($name);

            $this->assertNotNull($route, "Missing route {$name}.");

            $roleMiddleware = array_filter(
                $route->gatherMiddleware(),
                static fn ($middleware): bool => is_string($middleware) && str_starts_with($middleware, 'role:'),
            );

            $this->assertSame([], array_values($roleMiddleware));
        }
    }

    /**
     * Same shape as `test_enrollments_carry_no_role_middleware`: create is
     * Faculty-only and the PATCH route serves a content edit plus two
     * further checkpoints, all resolved by AcademicGradePolicy per request,
     * never by a blanket `role:` middleware on either route.
     */
    public function test_academic_grades_carry_no_role_middleware(): void
    {
        foreach (['api.v1.academic-grades.index', 'api.v1.academic-grades.store', 'api.v1.academic-grades.update'] as $name) {
            $route = Route::getRoutes()->getByName($name);

            $this->assertNotNull($route, "Missing route {$name}.");

            $roleMiddleware = array_filter(
                $route->gatherMiddleware(),
                static fn ($middleware): bool => is_string($middleware) && str_starts_with($middleware, 'role:'),
            );

            $this->assertSame([], array_values($roleMiddleware));
        }
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
