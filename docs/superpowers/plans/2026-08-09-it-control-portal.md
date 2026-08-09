# IT Control Portal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Design spec:** `docs/superpowers/specs/2026-08-09-grc-dataset-and-it-control-design.md`
**Plan 5 of 5.** Depends on Plan 3 (students to browse and enroll) and Plan 4 (the preference scorer used by the auto-enroll step).

**Goal:** A new `it_admin` role and portal with three modules — Student Information, Professor Information, and Enrollment Override — where the override module fast-forwards the entire enrollment workflow with six buttons.

**Architecture:** The browsers are ordinary paginated listing endpoints following the `ListAuditLogs` shape. The automation calls the **real audited Actions** for every step rather than writing statuses directly, so a fast-forwarded run is indistinguishable from a hand-driven one — unlike `EnrollmentOpenDemoSeeder`, which deliberately skips the approval chain and documents itself as not a substitute for it. Each button creates an `it_control_automation_runs` row that the UI polls, because 3,210 students will not finish inside one HTTP request.

**Tech Stack:** Laravel 12, Sanctum, MariaDB, Jobs, API Resources / Form Requests / Policies / Actions, Next.js React TypeScript, TanStack Query, Tailwind/shadcn, PHPUnit, Vitest + Testing Library + vitest-axe, Playwright.

## Global Constraints

- Every `it-control/*` **write** endpoint applies the seeder-style guard `app()->environment(['local','testing'])` and returns 403 otherwise. Read-only browsers require only `role:it_admin`.
- Automation steps call existing Actions — `SubmitEnrollment`, `TransitionEnrollment`, `ConfirmPayment`, `SaveSectionPlan`, the schedule-proposal transitions — never raw status writes.
- `UserRole::label()` and `UserRole::isLearnerScoped()` are exhaustive `match` expressions; a missing arm throws `UnhandledMatchError` at runtime, not a warning.
- `RoleUserSeeder::IDENTITIES` is keyed by role slug and fatals on a missing key.
- `frontend/src/features/auth/roles.ts` feeds a `z.enum()` inside a `.strict()` `userSchema`. An unknown role from `/auth/me` is a hard contract violation that blanks the whole portal — update it in the same commit as the backend enum.
- `ApiSurfaceTest` asserts the exact sorted route list; `module-registry.test.tsx` asserts `connectedModuleIds` length; `role-capabilities.test.ts` asserts the exact ordered module IDs per role. All three must move together.
- `users.role` is a plain `string` column — no migration is needed for the new role.

---

### Task 1: Introduce the `it_admin` role end to end

**Files:**
- Modify: `backend/app/Domain/Identity/UserRole.php`
- Modify: `backend/database/seeders/RoleUserSeeder.php`
- Modify: `backend/tests/Unit/Domain/Identity/UserRoleTest.php`, `backend/tests/Feature/Database/RoleUserSeederTest.php`
- Modify: `frontend/src/features/auth/roles.ts`
- Modify: `e2e/fixtures/seed-identities.ts`
- Modify: `docs/testing/SEEDED_IDENTITIES.md`

**Interfaces:**
- `UserRole::ItAdmin = 'it_admin'`, label `IT Control`, `isLearnerScoped()` false.
- Seeded identity `it.control@grc.test` / `password`.

- [ ] **Step 1: Write the failing tests**

```php
public function test_the_role_catalog_includes_it_admin(): void
{
    $this->assertContains('it_admin', array_column(UserRole::cases(), 'value'));
    $this->assertSame('IT Control', UserRole::ItAdmin->label());
    $this->assertFalse(UserRole::ItAdmin->isLearnerScoped());
    $this->assertCount(10, UserRole::cases());
}
```

Update `RoleUserSeederTest`'s `assertCount(9, $emails)` to 10.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/phpunit --testdox --filter 'UserRole|RoleUserSeeder'`

Expected: FAIL — the case does not exist.

- [ ] **Step 3: Add the case, both match arms, and the seed identity**

Note the role-matrix data providers across nine test files iterate `UserRole::cases()`, so `it_admin` is automatically asserted as forbidden on every existing endpoint. That is the correct default — do not weaken those.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/phpunit --testdox`

Expected: PASS across the whole backend suite.

- [ ] **Step 5: Mirror the role on the frontend and in e2e**

Add `"it_admin"` to `roles.ts`, `SeedRole` / `SEED_IDENTITIES` in `e2e/fixtures/seed-identities.ts`, and the credentials table in `docs/testing/SEEDED_IDENTITIES.md`.

Run: `cd frontend && npx tsc --noEmit`

Expected: type errors in `role-capabilities.ts` and `module-registry.tsx` — those `Record<UserRole, …>` maps are exhaustive and are filled in Task 3.

---

### Task 2: Account browser endpoints

No student-list endpoint exists — `registrar-grades-workspace.tsx` makes the Registrar type a numeric ID into a text input because there is nothing to browse. `GET /faculty-members` exists but is chair-only, hard-filtered to the actor's college, and unpaginated, so it cannot be reused.

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/ItControl/StudentAccountController.php`, `FacultyAccountController.php`
- Create: `backend/app/Http/Requests/Api/V1/ItControl/IndexStudentAccountRequest.php`, `IndexFacultyAccountRequest.php`
- Create: `backend/app/Actions/ItControl/ListStudentAccounts.php`, `ListFacultyAccounts.php`
- Create: `backend/app/Http/Resources/Api/V1/ItControl/StudentAccountResource.php`, `FacultyAccountResource.php`
- Create: `backend/app/Policies/ItControlPolicy.php` (+ Gate registration in `AppServiceProvider::boot()`)
- Create: `backend/tests/Feature/Api/V1/ItControl/StudentAccountsEndpointTest.php`, `FacultyAccountsEndpointTest.php`
- Modify: `backend/routes/api.php`, `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`

**Interfaces:**
- `GET /api/v1/it-control/students` — filters `q`, `college`, `program_id`, `year_level`, `enrollment_category`, `status`, `per_page`, `page`.
- `GET /api/v1/it-control/faculty` — filters `q`, `college`, `employment_type`, `status`, `per_page`, `page`.

- [ ] **Step 1: Write the failing tests**

```php
public function test_it_lists_and_filters_student_accounts(): void
{
    $response = $this->withToken($this->tokenFor($itAdmin))
        ->getJson('/api/v1/it-control/students?college=ccs&year_level=3&enrollment_category=irregular&per_page=20');

    $response->assertOk()
        ->assertJsonPath('meta.per_page', 20)
        ->assertJsonPath('data.0.type', 'it-control-student-account');
    $this->assertNotEmpty($response->json('data.0.email'));
}

public function test_it_searches_by_student_number_name_and_email(): void { /* q= */ }

#[DataProvider('otherRoles')]
public function test_every_other_role_is_forbidden(UserRole $role): void
{
    $this->withToken($this->tokenFor($this->makeUser('x', $role)))
        ->getJson('/api/v1/it-control/students')->assertForbidden();
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Api/V1/ItControl --testdox`

Expected: FAIL — routes do not exist.

- [ ] **Step 3: Implement both listings**

Copy the `ListAuditLogs` shape exactly: `IndexRequest` with `sometimes` rules and `per_page` capped at 100, an Action with a `->when()` chain inside `DB::transaction`, `orderBy` with a deterministic tiebreak on `id`, `->paginate($perPage, ['*'], 'page', $page)->withQueryString()`, then `Resource::collection($paginator)->response($request)` with `Cache-Control: no-store, private`.

`StudentAccountResource` fields: `type`, `id` (student profile id), `user_id`, `student_number`, `name`, `email`, `program_code`, `college`, `year_level`, `enrollment_category`, `academic_standing`, `status`, `current_term_enrollment_status` (nullable). `FacultyAccountResource` fields: `type`, `id`, `name`, `email`, `college`, `employment_type`, `status`, `availability_window_count`, `subject_preference_count`, `specialization_count`.

Both include a constant `password_hint` of `password`, since every seeded account shares it and the whole point of the screen is picking a test login.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Api/V1/ItControl tests/Feature/Api/V1/ApiSurfaceTest.php --testdox`

Expected: PASS.

---

### Task 3: Portal shell, navigation, and the two browser workspaces

**Files:**
- Modify: `frontend/src/features/portal/role-capabilities.ts` + `.test.ts`
- Modify: `frontend/src/features/portal/module-registry.tsx` + `.test.tsx`
- Create: `frontend/src/features/schemas/it-control-schema.ts`
- Create: `frontend/src/features/services/it-control-service.ts`
- Create: `frontend/src/features/hooks/use-it-control-accounts.ts`
- Create: `frontend/src/features/components/portal/it-control-students-workspace.tsx` + `.test.tsx`
- Create: `frontend/src/features/components/portal/it-control-faculty-workspace.tsx` + `.test.tsx`

**Interfaces:**
- Module IDs `it-control-students`, `it-control-faculty`, `it-control-enrollment-override`, in that nav order.

- [ ] **Step 1: Write the failing tests**

```tsx
it("exposes the three IT control modules in order", () => {
  expect(rolePortalDefinitions.it_admin.modules.map((m) => m.id)).toEqual([
    "it-control-students", "it-control-faculty", "it-control-enrollment-override",
  ])
})
```

Plus the three-test template for each workspace: happy path asserting the filter values land in the fetch URL, unauthorized role rendering the guard with zero fetches, and an axe pass. `audit-logs-workspace.test.tsx` is the canonical example.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/portal src/features/components/portal/it-control-students-workspace.test.tsx`

Expected: FAIL — no `it_admin` entry, no workspaces.

- [ ] **Step 3: Implement navigation and the workspaces**

`role-capabilities.ts` gains the `it_admin` entry; `module-registry.tsx` gains three `ConnectedModuleId` values and registry entries; bump `expect(connectedModuleIds).toHaveLength(35)` to 38 and add the three `migratedRegionNames` entries.

Model both workspaces on `audit-logs-workspace.tsx` (240 lines — the closest existing browse-and-filter screen): a filter form, `AsyncBoundary`, `DataTable`, `Paginator`, `ALL_FILTER_VALUE = "all"` for cleared selects. Each row shows the email and a copy button so a test login is one click away.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/portal src/features/components/portal --reporter=verbose`

Expected: PASS.

---

### Task 4: Automation run tracking

**Files:**
- Create: `backend/database/migrations/2026_08_12_000001_create_it_control_automation_runs_table.php`
- Create: `backend/app/Models/ItControlAutomationRun.php`
- Create: `backend/app/Domain/ItControl/AutomationStep.php`, `AutomationRunStatus.php`
- Create: `backend/app/Http/Controllers/Api/V1/ItControl/AutomationRunController.php`
- Create: `backend/app/Http/Requests/Api/V1/ItControl/StoreAutomationRunRequest.php`
- Create: `backend/app/Http/Resources/Api/V1/ItControl/AutomationRunResource.php`
- Create: `backend/app/Jobs/RunItControlAutomationStep.php`
- Create: `backend/tests/Feature/Api/V1/ItControl/AutomationRunsEndpointTest.php`
- Modify: `backend/routes/api.php`, `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`

**Interfaces:**
- `POST /api/v1/it-control/automation-runs` with `step`; `GET /api/v1/it-control/automation-runs/{run}` for polling; `GET /api/v1/it-control/automation-runs` for history.
- `AutomationStep` = `chair_generate_sections | dean_approve_all | executive_publish_all | students_auto_enroll | registrar_approve_all | cashier_confirm_all`.
- `AutomationRunStatus` = `queued | running | succeeded | partial | failed` — matching `ScheduleGenerationStatus`.

- [ ] **Step 1: Write the failing test**

```php
public function test_it_queues_a_run_and_reports_progress(): void
{
    $response = $this->withToken($this->tokenFor($itAdmin))
        ->postJson('/api/v1/it-control/automation-runs', ['step' => 'dean_approve_all']);

    $response->assertCreated()->assertJsonPath('data.step', 'dean_approve_all');

    $this->withToken($this->tokenFor($itAdmin))
        ->getJson('/api/v1/it-control/automation-runs/'.$response->json('data.id'))
        ->assertOk()->assertJsonStructure(['data' => ['status', 'processed_count', 'failed_count', 'warnings']]);
}

public function test_it_refuses_to_run_outside_local_and_testing(): void
{
    app()->detectEnvironment(fn () => 'production');
    $this->withToken($this->tokenFor($itAdmin))
        ->postJson('/api/v1/it-control/automation-runs', ['step' => 'dean_approve_all'])
        ->assertForbidden();
}

public function test_it_rejects_a_second_run_of_the_same_step_while_one_is_active(): void { /* 409 */ }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Api/V1/ItControl/AutomationRunsEndpointTest.php --testdox`

Expected: FAIL — the route does not exist.

- [ ] **Step 3: Implement the table, model, and endpoints**

```php
Schema::create('it_control_automation_runs', function (Blueprint $table): void {
    $table->id();
    $table->string('step', 48);
    $table->foreignId('academic_term_id')->constrained()->cascadeOnDelete();
    $table->string('status', 16)->default('queued');
    $table->unsignedInteger('processed_count')->default(0);
    $table->unsignedInteger('failed_count')->default(0);
    $table->json('warnings')->nullable();
    $table->text('error_summary')->nullable();
    $table->foreignId('initiated_by')->constrained('users')->restrictOnDelete();
    $table->timestamp('started_at')->nullable();
    $table->timestamp('completed_at')->nullable();
    $table->timestamps();
    $table->index(['step', 'status'], 'it_control_run_step_status_idx');
});
```

Resolve the target term from `academic_term_current_slots`, dedupe queued/running runs per `(step, term)`, and dispatch `RunItControlAutomationStep`. With `QUEUE_CONNECTION=sync` the job executes inline and the POST returns an already-terminal run — the resource shape is identical either way, and the frontend must handle both.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Api/V1/ItControl --testdox`

Expected: PASS.

---

### Task 5: The six automation steps

**Files:**
- Create: `backend/app/Actions/ItControl/RunChairGenerateSections.php`, `RunDeanApproveAll.php`, `RunExecutivePublishAll.php`, `RunStudentsAutoEnroll.php`, `RunRegistrarApproveAll.php`, `RunCashierConfirmAll.php`
- Create: `backend/tests/Feature/Actions/ItControl/AutomationStepsTest.php`
- Modify: `backend/app/Jobs/RunItControlAutomationStep.php`

**Interfaces:**
- Each action exposes `execute(ItControlAutomationRun $run): void`, updating counters and warnings as it goes.

| # | Step | Mechanism |
|---|---|---|
| 1 | `chair_generate_sections` | Per college (ccs, coe, coa, cbae): create a `ScheduleGenerationRun` → `GenerateSectionDemandForecasts` → `ApplyDemandForecastToDraft` → `GenerateFacultyAssignmentRecommendations`; wait for terminal status; then `SaveSectionPlan::submit()` acting as that college's Program Chair, which creates a `draft` `ScheduleProposal` and moves the college workflow to `for_dean_approval` |
| 2 | `dean_approve_all` | `dean_approve` on every `draft` proposal for the term |
| 3 | `executive_publish_all` | `publish` on every `dean_approved` proposal → sections become `published` and enrollment-visible. There is **no** `executive_approve` — it was removed from `ScheduleProposalTransitionRules` |
| 4 | `students_auto_enroll` | Reclassify first, then for every student without an active enrollment: regular → `SubmitEnrollment` with the highest-scoring block from `SchedulePreferenceScorer`; irregular → eligible subjects ranked by prerequisite backlog, capped at the overload threshold |
| 5 | `registrar_approve_all` | `TransitionEnrollment` `registrar_approve` on every `pending_registrar_approval` → issues the queue ticket and runs `AssessEnrollment` |
| 6 | `cashier_confirm_all` | `ConfirmPayment` on every `pending_payment` → `enrolled` plus the COM document `COM%06d` |

- [ ] **Step 1: Write the failing test**

```php
public function test_the_six_steps_carry_the_whole_cohort_from_planning_to_enrolled(): void
{
    $this->openEnrollmentTerm();

    foreach (AutomationStep::cases() as $step) {
        $run = $this->runStep($step);
        $this->assertContains($run->fresh()->status, [AutomationRunStatus::Succeeded, AutomationRunStatus::Partial]);
    }

    $this->assertSame(0, Enrollment::where('academic_term_id', $this->term->id)
        ->whereIn('status', ['draft', 'pending_registrar_approval', 'pending_payment'])->count());
    $this->assertGreaterThan(0, EnrollmentDocument::where('document_type', 'com')->count());
    $this->assertSame(
        StudentProfile::count(),
        Enrollment::where('academic_term_id', $this->term->id)->where('status', 'enrolled')->count(),
    );
}

public function test_a_step_records_a_warning_instead_of_failing_the_whole_run(): void
{
    // one student with an unsatisfiable prerequisite → failed_count 1, status partial, run still completes
}

public function test_step_one_fails_cleanly_when_the_prediction_service_is_unreachable(): void
{
    Http::fake(fn () => Http::response(null, 503));
    $run = $this->runStep(AutomationStep::ChairGenerateSections);
    $this->assertSame(AutomationRunStatus::Failed, $run->fresh()->status);
    $this->assertStringContainsString('prediction service', $run->fresh()->error_summary);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Actions/ItControl/AutomationStepsTest.php --testdox`

Expected: FAIL — the actions do not exist.

- [ ] **Step 3: Implement the six actions**

Every step:

- Resolves a real actor for the role it impersonates (the seeded Program Chair for that college, the Dean, the Executive Director, the Registrar Staff, the Accounting Staff) so audit trails and notifications name a real user.
- Calls the existing Action, never a raw status write.
- Processes in chunks of 200 with per-record try/catch. A record-level failure increments `failed_count` and appends a warning; only a step-level failure (unreachable ML service, no open term, no published sections) marks the run `failed`.
- Sets `status` to `succeeded` when `failed_count === 0`, otherwise `partial`.

Step 4 is the expensive one — 3,210 `SubmitEnrollment` calls, each locking sections with `lockForUpdate()`. Order students by section so the lock set stays hot, and log throughput every 500 records.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Actions/ItControl --testdox`

Expected: PASS.

---

### Task 6: The Enrollment Override workspace

**Files:**
- Create: `frontend/src/features/components/portal/it-control-enrollment-override-workspace.tsx` + `.test.tsx`
- Modify: `frontend/src/features/schemas/it-control-schema.ts`, `services/it-control-service.ts`, `hooks/use-it-control-accounts.ts` (add `use-it-control-automation.ts`)

**Interfaces:**
- Six buttons in workflow order, each showing idle / running / succeeded / partial / failed with processed and failed counts.
- Polls the active run every 2s via TanStack `refetchInterval`, stopping on a terminal status.

- [ ] **Step 1: Write the failing test**

```tsx
it("runs a step and reports progress until it completes", async () => {
  const user = userEvent.setup()
  renderWithSession(<ItControlEnrollmentOverrideWorkspace />, { session: itAdminSession })

  await user.click(await screen.findByRole("button", { name: /Generate all sections/i }))

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("/api/v1/it-control/automation-runs"),
    expect.objectContaining({ method: "POST" }),
  )
  expect(await screen.findByText(/3,210 processed/)).toBeInTheDocument()
})

it("disables later steps until the prerequisite step has succeeded", async () => { /* … */ })
```

Plus the unauthorized-role and axe tests.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/components/portal/it-control-enrollment-override-workspace.test.tsx`

Expected: FAIL — the file does not exist.

- [ ] **Step 3: Implement the workspace**

Reuse `status-stepper.tsx` to render the six steps as a sequence. Each card carries a description of exactly what it does and which role it impersonates. Later steps stay disabled until their prerequisite reaches a terminal success — but expose an "Override order" escape hatch, since re-running a single step is the common debugging case.

Show the last completed run per step (timestamp, processed, failed, warnings) so the panel is useful after a page reload. Warnings render in a collapsible list.

**No `confirm()`, `alert()`, or `prompt()`** — use the shadcn `AlertDialog` for the confirmation on every destructive-looking button.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/components/portal --reporter=verbose`

Expected: PASS.

- [ ] **Step 5: Full gates**

Run:
```
cd backend  && vendor/bin/pint --test && vendor/bin/phpstan analyse && vendor/bin/phpunit --testdox
cd frontend && npm run lint && npx tsc --noEmit && npm run test
cd e2e      && node scripts/reset-db.mjs && npx playwright test
```

Expected: all green. Extend `e2e/tests/authorization.spec.ts` with the `it_admin` row of the access matrix.

---

## Manual verification

Start the ML service first: `cd ml-service && uvicorn app.main:app --port 8100`.

1. `cd backend && php artisan migrate:fresh --seed`, then `php artisan serve`; `cd frontend && npm run dev`.
2. Sign in as `it.control@grc.test` / `password`. The sidebar shows exactly three modules.
3. **Student Information** — filter to CCS, 3rd year, irregular. Rows appear with student number, name, email, and program. Copy an email.
4. **Professor Information** — filter to CBAE, part-time. Rows show availability, preference, and specialization counts, all non-zero after Plan 1.
5. Sign in as Registrar Head, archive 2026-2027 1st, and open 2026-2027 2nd.
6. Back as `it_admin`, open **Enrollment Override** and press the buttons in order:
   - Generate all sections → four colleges' plans submitted, proposals in `draft`.
   - Dean approves all → proposals `dean_approved`.
   - Executive publishes all → sections `published`.
   - Students auto-enroll → ~3,210 processed; irregular students get subject-level enrollments.
   - Registrar approves all → every enrollment `pending_payment` with a queue ticket.
   - Cashier confirms all → every enrollment `enrolled` with a COM.
7. Return to **Student Information** — `current_term_enrollment_status` reads `enrolled` across the board.
8. Sign in as one of those students and confirm the Digital COM renders.
9. Confirm 403 behaviour: set `APP_ENV=production` in a scratch `.env`, restart, and verify the automation POST is refused while the browsers still work.
