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
            'DELETE api/v1/faculty-curriculum-subject-preferences/{facultyCurriculumPreference}',
            'DELETE api/v1/faculty-specializations/{facultySpecialization}',
            'DELETE api/v1/faculty-subject-preferences/{facultySubjectPreference}',
            'GET|HEAD api/v1/academic-grades',
            'GET|HEAD api/v1/academic-record',
            'GET|HEAD api/v1/academic-term-section-plans',
            'GET|HEAD api/v1/academic-term-workflows',
            'GET|HEAD api/v1/academic-terms',
            'GET|HEAD api/v1/academic-terms/{academicTerm}/enrollment-windows',
            'GET|HEAD api/v1/academic-terms/{academicTerm}/faculty-load-report',
            'GET|HEAD api/v1/academic-terms/{academicTerm}/schedule-generation-runs/latest',
            'GET|HEAD api/v1/audit-logs',
            'GET|HEAD api/v1/auth/me',
            'GET|HEAD api/v1/class-rosters',
            'GET|HEAD api/v1/curricula',
            'GET|HEAD api/v1/dashboards/enrollment-summary',
            'GET|HEAD api/v1/dashboards/institution-summary',
            'GET|HEAD api/v1/dashboards/policy-settings',
            'GET|HEAD api/v1/eligible-subjects',
            'GET|HEAD api/v1/enrollment-blocks',
            'GET|HEAD api/v1/enrollment-change-requests',
            'GET|HEAD api/v1/enrollment-documents',
            'GET|HEAD api/v1/enrollments',
            'GET|HEAD api/v1/faculty-availabilities',
            'GET|HEAD api/v1/faculty-curriculum-subject-preferences',
            'GET|HEAD api/v1/faculty-members',
            'GET|HEAD api/v1/faculty-preference-catalog',
            'GET|HEAD api/v1/faculty-specializations',
            'GET|HEAD api/v1/faculty-subject-preferences',
            'GET|HEAD api/v1/faculty-teaching-history',
            'GET|HEAD api/v1/grade-slip',
            'GET|HEAD api/v1/health',
            'GET|HEAD api/v1/notifications',
            'GET|HEAD api/v1/payments',
            'GET|HEAD api/v1/programs',
            'GET|HEAD api/v1/programs/{program}/current-curriculum-subjects',
            'GET|HEAD api/v1/prospectus',
            'GET|HEAD api/v1/queue-tickets',
            'GET|HEAD api/v1/room-options',
            'GET|HEAD api/v1/schedule-generation-runs/{scheduleGenerationRun}',
            'GET|HEAD api/v1/schedule-proposals',
            'GET|HEAD api/v1/schedule-proposals/{scheduleProposal}/sections',
            'GET|HEAD api/v1/sections',
            'GET|HEAD api/v1/stuck-enrollments',
            'GET|HEAD api/v1/student-profile',
            'GET|HEAD api/v1/student-schedule-preferences',
            'GET|HEAD api/v1/subject-offerings',
            'GET|HEAD api/v1/subjects',
            'GET|HEAD api/v1/transferee-credits',
            'GET|HEAD api/v1/withdrawal-requests',
            'PATCH api/v1/academic-grades/{academicGrade}',
            'PATCH api/v1/academic-term-workflows/{workflow}',
            'PATCH api/v1/academic-terms/{academicTerm}',
            'PATCH api/v1/academic-terms/{academicTerm}/enrollment-schedule',
            'PATCH api/v1/academic-terms/{academicTerm}/section-plan',
            'PATCH api/v1/curricula/{curriculum}',
            'PATCH api/v1/curricula/{curriculum}/transition',
            'PATCH api/v1/enrollment-change-requests/{enrollmentChangeRequest}',
            'PATCH api/v1/enrollments/{enrollment}',
            'PATCH api/v1/faculty-availabilities/{facultyAvailability}',
            'PATCH api/v1/faculty-curriculum-subject-preferences/{facultyCurriculumPreference}',
            'PATCH api/v1/faculty-members/{facultyMember}/workforce-profile',
            'PATCH api/v1/faculty-subject-preferences/{facultySubjectPreference}',
            'PATCH api/v1/notifications/{notification}/read',
            'PATCH api/v1/queue-tickets/{queueTicket}',
            'PATCH api/v1/schedule-proposals/{scheduleProposal}',
            'PATCH api/v1/sections/{section}',
            'PATCH api/v1/transferee-credits/{transfereeCredit}',
            'PATCH api/v1/withdrawal-requests/{withdrawalRequest}',
            'POST api/v1/academic-grades',
            'POST api/v1/academic-terms',
            'POST api/v1/academic-terms/{academicTerm}/archive-and-create-next',
            'POST api/v1/academic-terms/{academicTerm}/schedule-generation-runs',
            'POST api/v1/academic-terms/{academicTerm}/section-plan/auto-assign',
            'POST api/v1/academic-terms/{academicTerm}/section-plan/release',
            'POST api/v1/academic-terms/{academicTerm}/section-plan/submit',
            'POST api/v1/auth/login',
            'POST api/v1/auth/logout',
            'POST api/v1/curricula',
            'POST api/v1/curricula/{curriculum}/subject-placements',
            'POST api/v1/enrollments',
            'POST api/v1/enrollments/{enrollment}/change-requests',
            'POST api/v1/enrollments/{enrollment}/payment',
            'POST api/v1/enrollments/{enrollment}/withdraw',
            'POST api/v1/faculty-availabilities',
            'POST api/v1/faculty-curriculum-subject-preferences',
            'POST api/v1/faculty-specializations',
            'POST api/v1/faculty-subject-preferences',
            'POST api/v1/schedule-proposals',
            'POST api/v1/sections',
            'POST api/v1/student-profiles',
            'POST api/v1/subject-offerings',
            'POST api/v1/transferee-credits',
            'PUT api/v1/academic-terms/{academicTerm}/faculty-load-threshold',
            'PUT api/v1/student-schedule-preferences',
        ], $routes);
    }

    public function test_the_authenticated_routes_are_guarded(): void
    {
        $guarded = [
            'api.v1.auth.logout',
            'api.v1.auth.me',
            'api.v1.audit-logs.index',
            'api.v1.class-rosters.index',
            'api.v1.notifications.index',
            'api.v1.notifications.read',
            'api.v1.programs',
            'api.v1.academic-terms.index',
            'api.v1.academic-terms.update',
            'api.v1.academic-term-workflows.index',
            'api.v1.academic-term-workflows.update',
            'api.v1.academic-terms.store',
            'api.v1.subjects',
            'api.v1.curricula.index',
            'api.v1.curricula.store',
            'api.v1.curricula.update',
            'api.v1.subject-offerings.index',
            'api.v1.subject-offerings.store',
            'api.v1.eligible-subjects.index',
            'api.v1.enrollment-blocks.index',
            'api.v1.academic-terms.archive-and-create-next',
            'api.v1.enrollments.index',
            'api.v1.enrollments.store',
            'api.v1.enrollments.update',
            'api.v1.enrollments.payment',
            'api.v1.enrollments.withdraw',
            'api.v1.withdrawal-requests.index',
            'api.v1.withdrawal-requests.update',
            'api.v1.enrollments.change-requests.store',
            'api.v1.enrollment-change-requests.index',
            'api.v1.enrollment-change-requests.update',
            'api.v1.transferee-credits.index',
            'api.v1.transferee-credits.store',
            'api.v1.transferee-credits.update',
            'api.v1.enrollment-documents.index',
            'api.v1.payments.index',
            'api.v1.academic-grades.index',
            'api.v1.academic-grades.store',
            'api.v1.academic-grades.update',
            'api.v1.prospectus.show',
            'api.v1.grade-slip.show',
            'api.v1.queue-tickets.index',
            'api.v1.queue-tickets.update',
            'api.v1.faculty-availabilities.index',
            'api.v1.faculty-members.index',
            'api.v1.faculty-availabilities.store',
            'api.v1.faculty-availabilities.update',
            'api.v1.faculty-availabilities.destroy',
            'api.v1.faculty-specializations.index',
            'api.v1.faculty-specializations.store',
            'api.v1.faculty-specializations.destroy',
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
            'api.v1.student-schedule-preferences.show',
            'api.v1.student-schedule-preferences.update',
            'api.v1.dashboards.enrollment-summary',
            'api.v1.dashboards.institution-summary',
            'api.v1.dashboards.policy-settings',
            'api.v1.stuck-enrollments.index',
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

    public function test_subject_offering_writes_are_gated_to_the_program_chair_role(): void
    {
        $route = Route::getRoutes()->getByName('api.v1.subject-offerings.store');

        $this->assertNotNull($route);
        $this->assertContains('role:program_chair', $route->gatherMiddleware());

        $readRoute = Route::getRoutes()->getByName('api.v1.subject-offerings.index');
        $this->assertNotNull($readRoute);
        $this->assertNotContains('role:program_chair', $readRoute->gatherMiddleware());
    }

    public function test_academic_term_creation_is_gated_to_the_registrar_head_role(): void
    {
        $route = Route::getRoutes()->getByName('api.v1.academic-terms.store');

        $this->assertNotNull($route);
        $this->assertContains('role:registrar_head', $route->gatherMiddleware());

        $archiveAndCreateNextRoute = Route::getRoutes()->getByName('api.v1.academic-terms.archive-and-create-next');
        $this->assertNotNull($archiveAndCreateNextRoute);
        $this->assertContains('role:registrar_head', $archiveAndCreateNextRoute->gatherMiddleware());

        $readRoute = Route::getRoutes()->getByName('api.v1.academic-terms.index');
        $this->assertNotNull($readRoute);
        $this->assertNotContains('role:registrar_head', $readRoute->gatherMiddleware());
    }

    public function test_faculty_input_writes_are_gated_to_the_faculty_role(): void
    {
        $gated = [
            'api.v1.faculty-availabilities.store',
            'api.v1.faculty-availabilities.update',
            'api.v1.faculty-availabilities.destroy',
            'api.v1.faculty-specializations.store',
            'api.v1.faculty-specializations.destroy',
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

        $specializationsReadRoute = Route::getRoutes()->getByName('api.v1.faculty-specializations.index');
        $this->assertNotNull($specializationsReadRoute);
        $this->assertNotContains('role:faculty', $specializationsReadRoute->gatherMiddleware());
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

        foreach (['api.v1.queue-tickets.index', 'api.v1.queue-tickets.update'] as $name) {
            $route = Route::getRoutes()->getByName($name);

            $this->assertNotNull($route, "Missing route {$name}.");
            $this->assertContains('role:accounting_staff', $route->gatherMiddleware());
        }

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
     * Same shape as eligible-subjects: own computed view, student-only via
     * EligibleSubjectPolicy, not a `role:` middleware.
     */
    public function test_enrollment_blocks_carries_no_role_middleware(): void
    {
        $route = Route::getRoutes()->getByName('api.v1.enrollment-blocks.index');

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
        $names = [
            'api.v1.enrollments.index',
            'api.v1.enrollments.store',
            'api.v1.enrollments.update',
            'api.v1.enrollments.payment',
            'api.v1.enrollment-documents.index',
        ];

        foreach ($names as $name) {
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

    /**
     * Own-record only for the create side, role-resolved per-request for
     * the decide side — no `role:` middleware on any of the three routes.
     * EnrollmentPolicy::withdraw and WithdrawalRequestPolicy resolve the
     * boundaries instead.
     */
    public function test_withdrawal_routes_carry_no_role_middleware(): void
    {
        $names = [
            'api.v1.enrollments.withdraw',
            'api.v1.withdrawal-requests.index',
            'api.v1.withdrawal-requests.update',
        ];

        foreach ($names as $name) {
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
     * Two roles (Accounting Staff, Registrar Head), neither exclusive — no
     * `role:` middleware. `PaymentPolicy::viewAny` resolves the boundary.
     */
    public function test_payments_carries_no_role_middleware(): void
    {
        $route = Route::getRoutes()->getByName('api.v1.payments.index');

        $this->assertNotNull($route);

        $roleMiddleware = array_filter(
            $route->gatherMiddleware(),
            static fn ($middleware): bool => is_string($middleware) && str_starts_with($middleware, 'role:'),
        );

        $this->assertSame([], array_values($roleMiddleware));
    }

    /**
     * No ownership dimension — Registrar Staff manages every transferee
     * credit — so, like the withdrawal routes, none of the three carry
     * `role:` middleware. `TransfereeCreditPolicy` resolves each ability.
     */
    public function test_transferee_credit_routes_carry_no_role_middleware(): void
    {
        $names = [
            'api.v1.transferee-credits.index',
            'api.v1.transferee-credits.store',
            'api.v1.transferee-credits.update',
        ];

        foreach ($names as $name) {
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
     * Faculty/Registrar Staff/Registrar Head, resolved by
     * `EnrollmentSubjectPolicy` — no `role:` middleware, the same shape as
     * the withdrawal and transferee-credit routes.
     */
    public function test_class_rosters_carry_no_role_middleware(): void
    {
        $route = Route::getRoutes()->getByName('api.v1.class-rosters.index');

        $this->assertNotNull($route);

        $roleMiddleware = array_filter(
            $route->gatherMiddleware(),
            static fn ($middleware): bool => is_string($middleware) && str_starts_with($middleware, 'role:'),
        );

        $this->assertSame([], array_values($roleMiddleware));
    }

    /**
     * enrollment-summary is shared between two roles (`role:dean,
     * executive_director`); institution-summary, policy-settings, and
     * stuck-enrollments are each single-role. See DashboardPolicy/
     * StuckEnrollmentPolicy for the record-level re-check.
     */
    public function test_dashboard_routes_have_the_exact_role_boundaries(): void
    {
        $enrollmentSummary = Route::getRoutes()->getByName('api.v1.dashboards.enrollment-summary');
        $this->assertNotNull($enrollmentSummary);
        $this->assertContains('role:dean,executive_director', $enrollmentSummary->gatherMiddleware());

        $institutionSummary = Route::getRoutes()->getByName('api.v1.dashboards.institution-summary');
        $this->assertNotNull($institutionSummary);
        $this->assertContains('role:executive_director', $institutionSummary->gatherMiddleware());

        $policySettings = Route::getRoutes()->getByName('api.v1.dashboards.policy-settings');
        $this->assertNotNull($policySettings);
        $this->assertContains('role:registrar_head', $policySettings->gatherMiddleware());

        $stuckEnrollments = Route::getRoutes()->getByName('api.v1.stuck-enrollments.index');
        $this->assertNotNull($stuckEnrollments);
        $this->assertContains('role:dean', $stuckEnrollments->gatherMiddleware());
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
