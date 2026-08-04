# Manual Enrollment Startup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Registrar-controlled, per-semester enrollment lifecycle with a friendly four-segment Registrar stepper, a hard-gated manual Program Chair workflow for 1.1–1.3, and non-destructive direct Archive behavior (which closes an ongoing term in the same transaction).

**Architecture:** Keep the Laravel `/api/v1` bearer-token boundary authoritative. Store institution-wide term lifecycle on `academic_terms`, store independent COE/CCS/COA/CBAE planning progress in `academic_term_college_workflows`, and expose transitions through Form Requests, Policies, Actions, Resources, transactions, and audit records. Keep Next.js client-rendered; TanStack Query services/hooks own server state, while reusable shadcn-based workspaces render the Registrar stepper and Program Chair gates.

**Tech Stack:** Laravel 12/PHP 8.2, Sanctum, MySQL-compatible InnoDB schema, PHPUnit, Next.js 16 App Router, React 19 strict TypeScript, TanStack Query, React Hook Form, Zod, Tailwind CSS, shadcn/ui, Vitest/RTL, Playwright.

## Global Constraints

- Keep `frontend/`, `backend/`, and `ml-service/` independently runnable.
- Every public API remains versioned under `/api/v1` and uses Sanctum bearer tokens; do not add session-cookie or CSRF-cookie authentication.
- Authorization is enforced in Laravel Policies and the frontend; hiding a control is never authorization.
- Use Form Requests, Actions/Services, API Resources, database transactions, row locks, and audit records for every lifecycle write.
- There is at most one non-archived academic term; archive applies to one school-year-and-semester row, never both semesters in one action.
- Close and archive are non-destructive; curricula, offerings, schedules, enrollments, grades, payments, COM records, and audit history stay attached to the term.
- Predictive analytics and `ml-service/` remain paused; manual recommended section counts are never overwritten by forecast output.
- Preserve the existing uncommitted WIP and unrelated user edits. Do not commit, merge, or push unless the user separately requests it.
- Run the narrowest relevant check after each task, update `PROGRESS.md` at each milestone/failure, and run the full applicable suites before handoff.

---

## File Map

Backend lifecycle and organization files:

- Modify `backend/app/Domain/Organization/AcademicTermStatus.php`, `backend/app/Models/AcademicTerm.php`, `backend/app/Actions/Organization/CreateAcademicTerm.php`, `backend/app/Http/Controllers/Api/V1/AcademicTermController.php`, `backend/app/Http/Requests/Api/V1/AcademicTerm/StoreAcademicTermRequest.php`, `backend/app/Http/Resources/Api/V1/AcademicTermResource.php`, `backend/app/Policies/AcademicTermPolicy.php`, and `backend/routes/api.php` for the reduced lifecycle, current-term selection, create/transition routes, and write gates.
- Create `backend/app/Domain/Organization/AcademicTermCollegeWorkflowStage.php`, `backend/app/Models/AcademicTermCollegeWorkflow.php`, `backend/app/Actions/Organization/TransitionAcademicTerm.php`, `backend/app/Actions/Organization/TransitionCollegeWorkflow.php`, `backend/app/Http/Controllers/Api/V1/AcademicTermWorkflowController.php`, `backend/app/Http/Requests/Api/V1/AcademicTerm/IndexAcademicTermWorkflowRequest.php`, `backend/app/Http/Requests/Api/V1/AcademicTerm/UpdateAcademicTermRequest.php`, `backend/app/Http/Requests/Api/V1/AcademicTerm/UpdateAcademicTermWorkflowRequest.php`, `backend/app/Http/Resources/Api/V1/AcademicTermWorkflowResource.php`, and the workflow Policy.
- Create forward migrations for `closed_at`/`archived_at`, a singleton `academic_term_current_slots` pointer used as the database-backed single-current slot, and `academic_term_college_workflows`; do not rewrite the already-applied `2026_08_02_000001_expand_academic_term_lifecycle.php`.
- Modify `backend/database/seeders/AcademicTermSeeder.php`, `backend/database/seeders/DemoEnrollmentSeeder.php`, `backend/database/seeders/DatabaseSeeder.php`, and their tests so history is exactly six archived terms (2020–2023, both semesters) and the clean manual-test seed has no accidental current term.
- Modify `backend/app/Domain/Audit/AuditAction.php`, `backend/app/Domain/Audit/AuditableType.php`, audit tests, and `docs/adr/0018-manual-enrollment-startup.md` for create/close/archive/workflow vocabulary.

Backend planning and scheduling files:

- Modify `backend/app/Models/Program.php`, `Subject.php`, `ScheduleProposal.php`, `Section.php`, `FacultyAvailability.php`, `FacultySubjectPreference.php`, their Policies/Actions/Requests/Resources, and `backend/routes/api.php` to scope reads/writes by the authenticated Chair's college and workflow stage.
- Modify `backend/database/migrations/2026_08_02_000002_create_subject_offerings_table.php` only while still pending; create forward migrations for applied schema changes; keep `subject_offerings` manual and term-scoped.
- Extend `backend/tests/Feature/Api/V1/AcademicTermsEndpointTest.php`, `SubjectOfferingsEndpointTest.php`, `ScheduleProposalsEndpointTest.php`, relevant migration/policy/action tests, and `ApiSurfaceTest.php`.

Frontend files:

- Modify `frontend/src/features/schemas/academic-term-schema.ts`, `frontend/src/features/services/reference-data-service.ts`, `frontend/src/features/hooks/use-reference-data.ts`, and create/update workflow service/schema/hook modules for typed term and workflow transitions.
- Replace the long form in `frontend/src/features/components/portal/academic-term-workspace.tsx` with a responsive four-segment stepper, current-term summary, archive confirmation state, and archived history; update its Vitest test.
- Replace `frontend/src/features/components/portal/program-chair-enrollment-workspace.tsx` with the waiting/current/closed states and 1.1–1.3 panels; update supporting `sections-workspace.tsx`, `faculty-assignment-workspace.tsx`, `schedule-proposals-workspace.tsx`, and their tests so locked pages link back to Enrollment.
- Modify `frontend/src/features/portal/module-registry.tsx`, `role-capabilities.ts`, and their tests only to preserve one Enrollment item per role and the approved supporting links.

Verification/documentation files:

- Update `docs/api/openapi.yaml`, `docs/data-dictionary/identity-foundation.md`, `docs/data-dictionary/curriculum-catalog.md`, `docs/data-dictionary/section-planning.md`, `docs/testing/SEEDED_IDENTITIES.md`, and `PROGRESS.md`.
- Add or update `e2e/tests/enrollment-startup.spec.ts` and `e2e/fixtures/seed-identities.ts` for Registrar → four Chairs → archive → waiting-state coverage.

---

### Task 1: Normalize Academic Term Lifecycle and Seed History

**Files:**

- Modify: `backend/app/Domain/Organization/AcademicTermStatus.php`, `backend/app/Models/AcademicTerm.php`, `backend/database/seeders/AcademicTermSeeder.php`, `backend/database/seeders/DemoEnrollmentSeeder.php`, `backend/database/seeders/DatabaseSeeder.php`
- Create: `backend/database/migrations/2026_08_02_000003_add_academic_term_archive_metadata.php`
- Test: `backend/tests/Unit/Domain/Organization/AcademicTermStatusTest.php`, `backend/tests/Unit/Models/AcademicTermTest.php`, `backend/tests/Feature/Database/ReferenceDataSeederTest.php`, `backend/tests/Feature/Database/DemoEnrollmentSeederTest.php`, `backend/tests/Feature/Database/AcademicTermArchiveMigrationTest.php`

**Interfaces:**

- Produces `AcademicTermStatus::{Draft,ForDeanApproval,SemesterOngoing,SemesterClosed,Archived}`, `AcademicTerm::isActionableCurrent()`, and nullable `closed_at`/`archived_at` casts for later Actions and UI resources.

- [ ] **Step 1: Write failing status, migration, and seed tests.** Assert the exact five enum values/labels, archived seed rows `2020–2021/1st`, `2020–2021/2nd`, `2021–2022/1st`, `2021–2022/2nd`, `2022–2023/1st`, `2022–2023/2nd`, no non-archived rows from `AcademicTermSeeder`, reversible `closed_at`/`archived_at` columns, and a singleton `academic_term_current_slots` row with a nullable `academic_term_id`.**
- [ ] **Step 2: Run the focused backend tests and verify RED.** Run `php artisan test --filter='AcademicTermStatusTest|AcademicTermTest|ReferenceDataSeederTest|DemoEnrollmentSeederTest|AcademicTermArchiveMigrationTest'`; expected failures identify the old 13-status enum, missing columns, and current seed rows.
- [ ] **Step 3: Implement the minimum lifecycle/schema changes.** Add `closed_at` and `archived_at` plus the singleton current-slot table, preserve UTC immutable casts, reduce the enum, make `AcademicTermSeeder` deterministic six-row history, and make `DemoEnrollmentSeeder` skip gracefully when no ongoing fixture exists instead of creating an unrequested current term.
- [ ] **Step 4: Run the focused tests and verify GREEN.** Re-run the same command and confirm all lifecycle/seed assertions pass; run `php artisan migrate:rollback --step=1` and `php artisan migrate` to prove the new migration is reversible.
- [ ] **Step 5: Record the milestone.** Update `PROGRESS.md` with the exact test command/result and note that no commit was made.

### Task 2: Add College Workflow Storage, Creation, and Transitions

**Files:**

- Create: `backend/database/migrations/2026_08_02_000004_create_academic_term_college_workflows.php`, `backend/app/Domain/Organization/AcademicTermCollegeWorkflowStage.php`, `backend/app/Models/AcademicTermCollegeWorkflow.php`, `backend/app/Policies/AcademicTermCollegeWorkflowPolicy.php`, `backend/app/Actions/Organization/TransitionCollegeWorkflow.php`, `backend/app/Http/Controllers/Api/V1/AcademicTermWorkflowController.php`, `backend/app/Http/Requests/Api/V1/AcademicTerm/UpdateAcademicTermWorkflowRequest.php`, `backend/app/Http/Resources/Api/V1/AcademicTermWorkflowResource.php`
- Modify: `backend/app/Actions/Organization/CreateAcademicTerm.php`, `backend/app/Models/AcademicTerm.php`, `backend/routes/api.php`
- Test: `backend/tests/Feature/Database/AcademicTermCollegeWorkflowMigrationTest.php`, `backend/tests/Feature/Policies/AcademicTermCollegeWorkflowPolicyTest.php`, `backend/tests/Feature/Api/V1/AcademicTermWorkflowsEndpointTest.php`, `backend/tests/Feature/Actions/Organization/TransitionCollegeWorkflowAuditTest.php`

**Interfaces:**

- `CreateAcademicTerm::execute()` creates exactly one workflow row for each `CollegeCode::{COE,CCS,COA,CBAE}` in the same transaction.
- `PATCH /api/v1/academic-term-workflows/{workflow}` accepts `{ "action": "start_curriculum_preparation" | "complete_curriculum_preparation" | "complete_faculty_input" }` and returns `AcademicTermWorkflowResource`.

- [ ] **Step 1: Write failing migration, role-boundary, and transition tests.** Assert the unique `(academic_term_id, college)` key, atomic four-row creation, Chair-own-college visibility, Registrar-all-college visibility, legal stage transitions, illegal `422`, and audit rows.
- [ ] **Step 2: Run `php artisan test --filter='AcademicTermCollegeWorkflowMigrationTest|AcademicTermWorkflowsEndpointTest|TransitionCollegeWorkflowAuditTest'` and verify RED.** The expected failure is missing table/routes/action.
- [ ] **Step 3: Implement the enum, model, Policy, Resource, Form Request, controller, and row-locked transaction Action.** Use `CollegeCode` for the four supported values; never infer college from a request body when the authenticated Chair has a stored college.
- [ ] **Step 4: Update `CreateAcademicTerm` to insert four workflows inside its existing transaction and re-run the focused tests until GREEN.** Confirm a thrown exception rolls back both the term and every workflow row.
- [ ] **Step 5: Update `PROGRESS.md` with the exact green command and API surface added.**

### Task 3: Enforce One Current Term and Registrar Archive

**Files:**

- Create: `backend/app/Actions/Organization/TransitionAcademicTerm.php`, `backend/app/Http/Requests/Api/V1/AcademicTerm/UpdateAcademicTermRequest.php`
- Modify: `backend/app/Actions/Organization/CreateAcademicTerm.php`, `backend/app/Http/Controllers/Api/V1/AcademicTermController.php`, `backend/app/Policies/AcademicTermPolicy.php`, `backend/app/Http/Resources/Api/V1/AcademicTermResource.php`, `backend/app/Domain/Audit/AuditAction.php`, `backend/app/Domain/Audit/AuditableType.php`, `backend/routes/api.php`
- Test: `backend/tests/Feature/Api/V1/AcademicTermsEndpointTest.php`, `backend/tests/Feature/Actions/Organization/CreateAcademicTermAuditTest.php`, `backend/tests/Feature/Actions/Organization/TransitionAcademicTermAuditTest.php`, `backend/tests/Feature/Policies/AcademicTermPolicyTest.php`, `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`

**Interfaces:**

- `PATCH /api/v1/academic-terms/{academicTerm}` accepts `{ "action": "close" }` or `{ "action": "archive" }` and returns the updated `AcademicTermResource`.
- `TransitionAcademicTerm::execute(User $actor, AcademicTerm $term, string $action, AuditRequestContext $context): AcademicTerm` performs the row-locked legal transition and is idempotent only when the requested final state already holds.

- [ ] **Step 1: Write failing tests for current-term creation, legal close/archive, invalid order, non-Registrar `403`, idempotency, `closed_at`/`archived_at`, audit vocabulary, and planning-write freeze.** Assert a new POST is rejected whenever any term is non-archived and that archived history remains queryable.
- [ ] **Step 2: Run `php artisan test --filter='AcademicTermsEndpointTest|CreateAcademicTermAuditTest|TransitionAcademicTermAuditTest|AcademicTermPolicyTest|ApiSurfaceTest'` and verify RED.** The missing PATCH route and old create behavior must be the failure cause.
- [ ] **Step 3: Implement the database-backed single-current slot plus the transaction Actions.** Lock the singleton slot row before create; set its `academic_term_id` on creation and clear it only on archive; let Archive set `closed_at` and `archived_at` together for an ongoing term (or preserve an existing `closed_at`), record actor in immutable audit entries, and reject invalid transitions with field-mapped `422`.
- [ ] **Step 4: Add the Registrar-only route/request/controller call and resource fields (`status`, `status_label`, `closed_at`, `archived_at`, `is_actionable_current`).** Re-run focused tests until GREEN, then run `php artisan route:list --path=api/v1/academic-terms` and update the golden API surface.
- [ ] **Step 5: Update `PROGRESS.md` with transition and concurrency test evidence.**

### Task 4: Complete College-Scoped Manual Curriculum and Schedule Gates

**Files:**

- Modify: `backend/app/Models/Program.php`, `backend/app/Models/Subject.php`, `backend/app/Models/SubjectOffering.php`, `backend/app/Models/ScheduleProposal.php`, `backend/app/Models/Section.php`, `backend/app/Models/FacultyAvailability.php`, `backend/app/Models/FacultySubjectPreference.php`, their Policies/Actions/Requests/Resources, and `backend/routes/api.php`
- Modify/Create: pending `backend/database/migrations/2026_08_02_000002_create_subject_offerings_table.php` and forward migrations for applied schedule-proposal/organization columns
- Test: `backend/tests/Feature/Api/V1/SubjectOfferingsEndpointTest.php`, `backend/tests/Feature/Api/V1/ScheduleProposalsEndpointTest.php`, `backend/tests/Feature/Policies/SubjectOfferingPolicyTest.php`, `backend/tests/Feature/Models/SectionVisibilityTest.php`, `backend/tests/Feature/Database/SubjectOfferingMigrationTest.php`, `backend/tests/Feature/Actions/Curriculum/ReplaceSubjectOfferingsAuditTest.php`

**Interfaces:**

- Subject offering writes are allowed only for the Chair's college during `curriculum_preparation`; reads include only the Chair's college/current or completed workflow.
- Schedule proposals have college-scoped uniqueness and submission requires complete manual section/faculty/time assignments with existing conflict validation.

- [ ] **Step 1: Add failing tests for college leakage, term/workflow stage gates, complete 1.1 matrices, min/max capacity validation, proposal college uniqueness, and write freeze after close/archive.**
- [ ] **Step 2: Run `php artisan test --filter='SubjectOfferingsEndpointTest|ScheduleProposalsEndpointTest|SubjectOfferingPolicyTest|SectionVisibilityTest|SubjectOfferingMigrationTest|ReplaceSubjectOfferingsAuditTest'` and verify RED.**
- [ ] **Step 3: Implement scoped queries and stage checks through existing Policies and Actions; keep manual `recommended_section_count` authoritative and treat any forecast field as display-only.**
- [ ] **Step 4: Re-run the focused tests plus `php artisan test --filter='FacultyInput|SectionsEndpoint|ScheduleProposal'` until GREEN; verify an unrelated college receives `403` or an empty scoped collection as appropriate.**
- [ ] **Step 5: Update `PROGRESS.md` with the manual 1.1–1.3 gate evidence.**

### Task 5: Build the Registrar Four-Segment Enrollment Workspace

**Files:**

- Modify: `frontend/src/features/schemas/academic-term-schema.ts`, `frontend/src/features/services/reference-data-service.ts`, `frontend/src/features/hooks/use-reference-data.ts`, `frontend/src/features/components/portal/academic-term-workspace.tsx`, `frontend/src/features/components/portal/academic-term-workspace.test.tsx`
- Create/Modify: `frontend/src/features/schemas/academic-term-workflow-schema.ts`, `frontend/src/features/services/academic-term-workflow-service.ts`, `frontend/src/features/hooks/use-academic-term-workflows.ts`, shared confirmation/stepper components only if existing shadcn primitives cannot express the states

**Interfaces:**

- `useAcademicTermsQuery()` returns strict Zod-parsed `AcademicTerm` resources including lifecycle timestamps and `is_actionable_current`.
- `useTransitionAcademicTermMutation()` calls `PATCH /api/v1/academic-terms/{id}` with `{action}` and invalidates `academic-terms`.

- [ ] **Step 1: Write failing RTL/Vitest tests for no-term setup, current term setup, four segments, college-progress counts, archive confirmation, historical table, API field errors, loading/error/offline states, keyboard operation, and `vitest-axe`.**
- [ ] **Step 2: Run `npm test -- --run frontend/src/features/components/portal/academic-term-workspace.test.tsx` and verify RED.**
- [ ] **Step 3: Implement the responsive stepper and context card with existing `Card`, `Badge`, `Alert`, `AlertDialog`, `Button`, and `DataTable` primitives. Keep copy explicit: “Create school year” and “Archive semester”; never show archive as a destructive delete.**
- [ ] **Step 4: Implement service/schema/hook transitions and re-run the focused test until GREEN; then run `npm run typecheck` and `npm run lint -- --quiet` for touched frontend code.**
- [ ] **Step 5: Update `PROGRESS.md` with the exact frontend test/type/lint results.**

### Task 6: Build the Program Chair Waiting and Manual 1.1–1.3 Workspace

**Files:**

- Modify: `frontend/src/features/components/portal/program-chair-enrollment-workspace.tsx`, `frontend/src/features/components/portal/program-chair-enrollment-workspace.test.tsx`, `frontend/src/features/components/portal/sections-workspace.tsx`, `frontend/src/features/components/portal/faculty-assignment-workspace.tsx`, `frontend/src/features/components/portal/schedule-proposals-workspace.tsx`, their tests, `frontend/src/features/portal/module-registry.tsx`, `frontend/src/features/portal/role-capabilities.ts`, and related hooks/services
- Create/Modify: workflow query/mutation hooks and strict schemas under `frontend/src/features/hooks/` and `frontend/src/features/schemas/`

**Interfaces:**

- The workspace selects the authenticated Chair's college workflow; it renders no planning controls when there is no actionable current term.
- Supporting modules render locked-state explanations and link to `program-chair-enrollment`; 1.1 completion unlocks Subjects & Prerequisites, and 1.2 sign-off unlocks Sections & Schedules and Faculty Assignment.

- [ ] **Step 1: Write failing tests for the exact waiting copy, closed-term copy, current/completed/locked step states, college scoping, 1.1 field grouping by program/year/semester, 1.2 faculty review/sign-off, 1.3 manual section/schedule/professor assignment, supporting nav gates, keyboard behavior, and `vitest-axe`.**
- [ ] **Step 2: Run `npm test -- --run frontend/src/features/components/portal/program-chair-enrollment-workspace.test.tsx frontend/src/features/portal/module-registry.test.tsx frontend/src/features/portal/role-capabilities.test.ts` and verify RED.**
- [ ] **Step 3: Implement the three panels with existing service modules; keep raw API calls out of rendering components, retain selected values on `422`, and label section counts as “Manual plan” rather than forecast output.**
- [ ] **Step 4: Re-run the focused tests until GREEN; run the existing related workspace tests to ensure no supporting module regresses.**
- [ ] **Step 5: Update `PROGRESS.md` with the exact frontend test result and any intentionally locked state.**

### Task 7: Update Contracts, E2E Journey, and Quality Gates

**Files:**

- Modify: `docs/api/openapi.yaml`, `docs/data-dictionary/identity-foundation.md`, `docs/data-dictionary/curriculum-catalog.md`, `docs/data-dictionary/section-planning.md`, `docs/testing/SEEDED_IDENTITIES.md`, `e2e/fixtures/seed-identities.ts`, `PROGRESS.md`
- Create/Modify: `docs/adr/0018-manual-enrollment-startup.md`, `e2e/tests/enrollment-startup.spec.ts`

**Interfaces:**

- OpenAPI documents `POST /academic-terms`, `PATCH /academic-terms/{id}`, workflow routes, status/timestamp fields, `403`/`422` envelopes, and idempotent responses.
- The E2E flow creates one new semester as Registrar Head, verifies all four Chair accounts see it, progresses the manual workflow, archives it, and verifies each Chair returns to the waiting state; it does not call or assert ML output.

- [ ] **Step 1: Write the failing contract/E2E assertions for the new route golden list, schema fields, Registrar → Chair transition, close/archive, and waiting state.**
- [ ] **Step 2: Run `npm --prefix e2e test -- --grep 'manual enrollment startup'` and `npx --yes @redocly/cli@latest lint docs/api/openapi.yaml`; verify RED until routes/contracts/UI exist.**
- [ ] **Step 3: Implement the OpenAPI/data-dictionary/ADR updates and Playwright fixtures using the seeded emails documented in `docs/testing/SEEDED_IDENTITIES.md`; keep test credentials local-only.**
- [ ] **Step 4: Run the focused E2E and OpenAPI checks until GREEN, then run the full applicable gates: `backend/vendor/bin/phpunit`, `backend/vendor/bin/pint --test`, `backend/vendor/bin/phpstan analyse --memory-limit=1G`, `npm --prefix frontend test`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run lint`, and the full Playwright suite with the documented database reset.**
- [ ] **Step 5: Update `PROGRESS.md` with only checks that actually ran, record any environment-only failure separately, and leave the worktree uncommitted unless the user requests integration.**

## Self-Review Checklist

- The plan covers every spec requirement: term creation, one current term, per-semester close/archive, six archived seed rows, per-college 1.1–1.3 state, manual subject/section/schedule/faculty work, navigation gates, audit/idempotency, non-destructive history, accessibility, OpenAPI, and E2E.
- No task rewrites the already-applied lifecycle migration; forward migrations are used for archive metadata and workflow storage.
- The single-current slot, `closed_at`/`archived_at`, enum names, route payloads, and frontend resource fields are consistent across tasks.
- No ML-service change, institutional policy value, automatic forecast overwrite, deletion, session auth, commit, merge, or push is introduced.
- Placeholder scan targets were checked against the completed plan; each step names its test command and expected behavior.
