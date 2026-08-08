# Room Sync and Editable Predictive Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair and complete college-scoped predictive schedule generation, then provide editable drafts, faculty-load support, and a Registrar Head-managed Rooms Operations Board.

**Architecture:** Laravel owns authorization, validation, persistence, conflict enforcement, and the public `/api/v1` contract. FastAPI remains private and executes a deterministic Random Forest forecast over aggregate observations. React consumes typed service modules with TanStack Query; the Program Chair edits draft recommendations, while the Registrar Head manages canonical rooms.

**Tech Stack:** Laravel 12/PHP, MariaDB, Sanctum, FastAPI/Pydantic/scikit-learn, Next.js/React/TypeScript, TanStack Query, Zod, React Hook Form, Tailwind/shadcn.

## Global Constraints

- Work directly on `main`, as explicitly requested; never stage pre-existing user work.
- Keep frontend, backend, and ML service independently runnable; browser calls only Laravel `/api/v1` with bearer authentication.
- Run pending reversible migrations before local manual verification; predictive outputs are advisory and must never deny enrollment or publish schedules.
- Supported new modalities are `f2f`, `hyflex_a`, `hyflex_b`; legacy `online` is marked incomplete for reassignment.
- Registrar Head owns room inventory; Program Chair reads authorized rooms and writes only own-college schedule assignments.
- HyFlex A/B share a slot only through an explicit pair and complementary physical-week occupancy.

---

### Task 1: Repair and observe the predictive generation boundary

**Files:**
- Modify: `backend/app/Actions/Analytics/GenerateSectionDemandForecasts.php`
- Modify: `backend/app/Services/Analytics/SectionDemandPredictionClient.php`
- Modify: `backend/app/Models/ScheduleGenerationRun.php`, `backend/database/migrations/2026_08_09_000002_create_schedule_generation_runs_table.php`
- Modify: `ml-service/app/schemas/section_demand.py`, `ml-service/app/services/section_demand.py`
- Test: `backend/tests/Feature/Actions/Analytics/GenerateSectionDemandForecastsTest.php`, `ml-service/tests/test_section_demand.py`

**Interfaces:**
- Consumes: `SectionDemandObservation` aggregates and `HistoricalCohortResolver`.
- Produces: `SectionDemandPredictionClient::predict(list $observations, list $targets): array{model_version:string,strategy:string,forecast_count:int,forecasts:list<array{key:string,...}>}` and persisted run strategy/observation/metrics fields.

- [ ] **Step 1: Write failing contract tests** that submit FastAPI’s exact `key`, `cohort_size`, `section_count`, `recommended_capacity`, `year_level`, and `semester` target shape from Laravel, assert successful forecast persistence, and assert empty history completes with `insufficient_history` warning without an HTTP prediction call.
- [ ] **Step 2: Run focused Laravel and pytest tests** and confirm the current Laravel payload fails FastAPI validation because it uses `target_key`/`subject_id` and observation `subject_id`.
- [ ] **Step 3: Align the contracts**: build valid targets using the selected historical aggregate’s cohort and section count; remove forbidden observation fields; key responses by `key`; persist `model_strategy`, `observation_count`, and returned metrics on the run/prediction record; return an explicit no-data result before calling FastAPI.
- [ ] **Step 4: Add ML metrics**: train/test split only when data has enough rows, compute MAE and RMSE for Random Forest validation, expose them in response metrics, and retain `historical_baseline` for sparse inputs.
- [ ] **Step 5: Run focused tests green**, then run migrations locally and start FastAPI with `uvicorn app.main:app --port 8100` to verify `/internal/v1/health` and a real COE run.
- [ ] **Step 6: Commit only this task’s backend/ML files and tests.**

### Task 2: Generate editable section recommendations from demand

**Files:**
- Modify: `backend/app/Actions/Analytics/GenerateSectionDemandForecasts.php`
- Create: `backend/app/Actions/Scheduling/ApplyDemandForecastToDraft.php`
- Modify: `backend/app/Models/AcademicTermSectionPlan.php`, `backend/app/Models/Section.php`
- Create: migration for forecast recommendation metadata and generated-section provenance
- Test: `backend/tests/Feature/Actions/Scheduling/ApplyDemandForecastToDraftTest.php`

**Interfaces:**
- Consumes: successful `SectionDemandForecast` rows.
- Produces: draft plans plus sections with `recommendation_source = predictive`, `is_block_exclusive = true` for base blocks and `false` for excess subject-only sections.

- [ ] **Step 1: Write failing tests** for base block count as the maximum forecasted section count per curriculum/year, excess subject-only section creation, and no overwrite of manual `capacity`, teacher, time, room, modality, or section count.
- [ ] **Step 2: Run the tests** and confirm no draft-generation action exists.
- [ ] **Step 3: Implement `ApplyDemandForecastToDraft::execute()`** inside a transaction: auto-resolve effective curricula by cohort, create/update predictive draft plans, materialize base and surplus subject sections with deterministic codes, and record recommendation metadata; never modify submitted/published records.
- [ ] **Step 4: Add reset operations** for one generated field and the entire draft so a Program Chair can explicitly apply the latest recommendation after manual edits.
- [ ] **Step 5: Run focused action/API tests green and commit only Task 2 files.**

### Task 3: Faculty recommendation and load report

**Files:**
- Create: `backend/app/Services/Scheduling/FacultyAssignmentRecommender.php`
- Create: `backend/app/Http/Controllers/Api/V1/FacultyLoadReportController.php`, `backend/app/Http/Resources/Api/V1/FacultyLoadReportResource.php`
- Create: migration/model for term-specific faculty maximum units
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Unit/Services/Scheduling/FacultyAssignmentRecommenderTest.php`, `backend/tests/Feature/Api/V1/FacultyLoadReportEndpointTest.php`

**Interfaces:**
- Consumes: term, draft sections, faculty subject preferences, availability windows, subject units, and max-unit limits.
- Produces: recommendation `{professor_id|null, rationale, availability_match, projected_units, conflict_reasons}` and GET report `{teachers, unassigned_sections, load_need}`.

- [ ] **Step 1: Write failing unit tests** for preference-rank priority, availability coverage, term maximum units, stable ID tie-break, and a null recommendation when no candidate qualifies.
- [ ] **Step 2: Run the tests** and confirm the recommender does not exist.
- [ ] **Step 3: Implement the pure recommender** with the priority order from the design, then call it only for blank predictive section faculty fields; persist the rationale without treating it as a final assignment.
- [ ] **Step 4: Write and pass endpoint tests** proving Program Chairs only see their college report and Registrar Head cannot mutate faculty recommendations through the read endpoint.
- [ ] **Step 5: Commit Task 3 files.**

### Task 4: Canonical Rooms and protected inventory management

**Files:**
- Create: room/college-access migrations and models; migration/backfill from `room_catalog_entries`
- Create: `RoomController`, `RoomAvailabilityController`, Form Requests, Policy, API Resources
- Modify: `backend/routes/api.php`, `backend/app/Models/Section.php`
- Test: `backend/tests/Feature/Api/V1/RoomsEndpointTest.php`, `backend/tests/Feature/Database/RoomMigrationTest.php`

**Interfaces:**
- `GET /api/v1/rooms` scopes Program Chair to authorized rooms and Registrar Head to all rooms.
- Registrar Head only: `POST/PATCH /api/v1/rooms` with name/code, capacity, type, equipment, active flag, and college access IDs.
- `GET /api/v1/rooms/availability?academic_term_id=&day=&starts_at_time=&ends_at_time=&capacity=&type=` returns rooms and conflict reasons.

- [ ] **Step 1: Write failing migration and authorization tests** for canonical multi-college rooms, Head-only room writes, and Chair read/assignment access.
- [ ] **Step 2: Run the tests** and confirm the current name/college-only catalog cannot represent capacity/type/access or Registrar Head authorization.
- [ ] **Step 3: Implement canonical room schema and backfill**: normalize old room labels, preserve unmatched values for review, add `room_id` to sections, and keep the old text value only while migration compatibility requires it.
- [ ] **Step 4: Implement policies, Form Requests, Resources, CRUD, and availability endpoint** with database transactions and audit logs.
- [ ] **Step 5: Run focused endpoint/migration tests green and commit Task 4 files.**

### Task 5: Enforce room, capacity, modality, and HyFlex conflicts

**Files:**
- Create: `RoomOccupancyConflictDetector`, `HyflexPair` model/migration
- Modify: `SectionModality`, section store/update requests, section actions, conflict tests
- Test: `backend/tests/Unit/Domain/Scheduling/RoomOccupancyConflictDetectorTest.php`, `backend/tests/Feature/Api/V1/SectionsEndpointTest.php`

**Interfaces:**
- Section writes accept `room_id` and optional `hyflex_pair_section_id`.
- A valid pair requires same term/day/time/room, one A and one B, and no existing pair on either section.
- `RoomOccupancyConflictDetector::hasConflict(SectionSlot $proposed, iterable<SectionSlot> $existing): bool` applies day/time and physical-week overlap.

- [ ] **Step 1: Write failing tests** for F2F room collision, capacity mismatch, incompatible lab/lecture room, inactive room, allowed explicit A/B pair, rejected unpaired A/B overlap, and teacher collision even when one class is online that week.
- [ ] **Step 2: Run the tests** and confirm the current conflict detector checks only professors.
- [ ] **Step 3: Implement physical-week occupancy**, exact A/B pair validation, room compatibility rules, and request-level server validation.
- [ ] **Step 4: Remove Online from the enum/form options**, migrate local legacy online sections to incomplete reassignment drafts, and update source-reference import behavior to flag—not invent—unsupported Online data.
- [ ] **Step 5: Run focused conflict and existing scheduling suites green; commit Task 5 files.**

### Task 6: Connect Rooms navigation and Operations Board UI

**Files:**
- Modify: `frontend/src/features/portal/role-capabilities.ts`, `frontend/src/features/portal/module-registry.tsx`
- Create: `frontend/src/features/components/portal/rooms-operations-workspace.tsx`
- Create: typed room schemas/services/hooks and component tests
- Test: `frontend/src/features/components/layouts/portal-shell.test.tsx`, `frontend/src/features/components/portal/rooms-operations-workspace.test.tsx`

**Interfaces:**
- Add `rooms` connected module for Program Chair and Registrar Head only.
- Program Chair sees college-scoped availability and assignment actions; Head sees inventory editor plus all-college filters.

- [ ] **Step 1: Write failing role-navigation tests**: Rooms appears for Program Chair and Registrar Head, never Registrar Staff, and route resolves to a workspace.
- [ ] **Step 2: Run tests** and confirm no connected module exists.
- [ ] **Step 3: Implement typed service/query layer** for rooms, availability and Head-only mutations; build the Operations Board with summary counters, filters, availability grid, scheduled list, HyFlex badges, and needs-attention panel.
- [ ] **Step 4: Add accessible inventory dialog** for the Head and read-only/assign mode for Chairs; run component tests and keyboard/empty/error states.
- [ ] **Step 5: Commit Task 6 files.**

### Task 7: Replace manual entry with editable generated results

**Files:**
- Modify: `frontend/src/features/components/portal/program-chair-enrollment-workspace.tsx`
- Modify/Create: schedule-generation schemas, services, hooks, result components, tests
- Test: `frontend/src/features/components/portal/program-chair-enrollment-workspace.test.tsx`

**Interfaces:**
- `useScheduleGeneration()` starts/polls runs, loads latest result, regenerates, and resets recommendation fields.
- UI tabs: Demand & Sections, Schedule, Faculty Load, Review & Approval.

- [ ] **Step 1: Write failing component tests** that click Generate Schedule, show real model strategy/status/metrics, render editable recommendation rows, preserve a manual value during regeneration, and reset it only after explicit action.
- [ ] **Step 2: Run tests** and confirm the current screen only displays a status alert over the old manual wizard.
- [ ] **Step 3: Implement the result tabs and polling** using typed service modules; retain current approval UI while moving 1st–4th year counts/capacity into editable Demand & Sections rows.
- [ ] **Step 4: Add Schedule editing** for teacher, time, room, modality, pair and capacity with API field errors rendered inline; embed Room availability hints and conflict markers.
- [ ] **Step 5: Add Faculty Load and Review tabs**, including rationale, unassigned sections, warnings, override/reset badges, and submission blocking reasons.
- [ ] **Step 6: Run focused component tests green and commit only Task 7 files, using careful hunk staging because this file already contains user-owned edits.**

### Task 8: End-to-end verification, local readiness, and handoff

**Files:**
- Modify: `PROGRESS.md`
- Optionally modify: developer startup documentation for FastAPI/queue readiness

- [ ] **Step 1: Run `php artisan migrate:status`, then `php artisan migrate` and the local synthetic aggregate seeder; verify both pending predictive migrations are applied.**
- [ ] **Step 2: Start FastAPI and submit one authenticated COE generation run; verify a terminal run contains model strategy/metrics and editable draft sections.**
- [ ] **Step 3: Run all focused backend/frontend/ML tests, `npm run typecheck`, `npm run lint`, frontend build, and full Laravel/pytest suites.**
- [ ] **Step 4: Record actual command results in `PROGRESS.md`; stage only this feature’s files, commit, push `main`, and report any pre-existing verification issue separately.**
