# Phase 7c — Factual Dashboards, Dwell-Time Signals, Policy Visibility Implementation Plan

**Goal:** Connect 4 of the 7 remaining Phase-7c-deferred portal modules —
Dean's Enrollment Dashboard and Stuck Students, Executive Director's
Institution Dashboard, Registrar Head's Policy Settings — using only
arithmetic over existing, populated data. Leave the 3 genuinely §17-blocked
modules (`compliance-reports`, and the shared `reports` id) as documented
placeholders. Also correct a wrong claim in ADR 0016 and fix the real bug
tracing it down surfaced.

**Architecture:** New aggregate-only Actions/Resources/Policies/Controllers
under a `Dashboard` namespace, returning typed summary objects — the first
non-paginator, non-single-model Action return shape in this codebase. New
routes under `/api/v1/dashboards/*` plus `/api/v1/stuck-enrollments`,
role-gated via the existing `role:` middleware and `Gate::define()` pattern
(`EligibleSubjectPolicy` precedent). No new migrations — every number comes
from columns that already exist.

**Tech Stack:** Laravel 12 Actions/Policies/Resources (existing conventions),
Next.js 16 `WorkspacePage`/`AsyncBoundary`/`DataTable` (existing conventions),
PHPUnit, Vitest + `vitest-axe`, Playwright.

## Global Constraints

- No migrations. Every dashboard number is arithmetic over already-existing,
  already-populated columns.
- Never sum `payments.amount` — nullable by §17 design. Count payment
  *events*, never total money.
- Every group-by uses `Enum::cases()`/`->label()`, never a string literal —
  7 of the relevant enums are marked provisional and will be replaced by a
  future data migration.
- `Enrollment::scopeVisibleTo` and `EnrollmentPolicy` are not touched. Dean
  and Executive Director get new aggregate-only endpoints instead of widened
  access to the existing row-level enrollment endpoint.
- `stuck-students` ships with `dashboard.stuck_threshold_days` unset
  (`null`) — dwell time always shown, "stuck" label only once configured.
- `policy-settings` is read-only.
- Update `PROGRESS.md` after each completed task; never record a check as
  passed unless it actually ran.
- Do not commit, merge, or push unless explicitly asked.

---

## File Structure

| Area | Responsibility |
|---|---|
| `backend/config/enrollment.php` | Add `dashboard.stuck_threshold_days`. |
| `backend/app/Actions/Dashboard/BuildEnrollmentSummary.php` | Status distribution + funnel-stage counts for a term, Dean + Executive Director. |
| `backend/app/Actions/Dashboard/BuildInstitutionSummary.php` | Institution-wide counts (programs, terms, year-over-year), Executive Director only. |
| `backend/app/Actions/Dashboard/ListStuckEnrollments.php` | Row-level, minimal-field dwell-time list, Dean only. |
| `backend/app/Actions/Dashboard/BuildPolicySettingsSummary.php` | Reads `config('enrollment.*')`, reports configured/provisional/absent per value. |
| `backend/app/Http/Resources/Api/V1/Dashboard/*.php` | New summary-shaped Resources (not row/collection). |
| `backend/app/Policies/DashboardPolicy.php`, `StuckEnrollmentPolicy.php` | Computed-view policies, `EligibleSubjectPolicy` precedent. |
| `backend/app/Http/Controllers/Api/V1/Dashboard/*.php` | Thin controllers, `EligibleSubjectController` shape. |
| `backend/routes/api.php` | New `/dashboards/*` + `/stuck-enrollments` routes. |
| `backend/app/Providers/AppServiceProvider.php` | New `Gate::define()` entries. |
| `frontend/src/features/services/dashboard-service.ts` | New service module, existing `api-client.ts` conventions. |
| `frontend/src/features/hooks/use-dashboard.ts` | TanStack Query hooks. |
| `frontend/src/features/schemas/dashboard-schema.ts` | Zod schemas — **must produce `Z`-suffixed timestamps to match the backend fix from Phase 8c**. |
| `frontend/src/features/components/portal/{enrollment-dashboard,institution-dashboard,stuck-students,policy-settings}-workspace.tsx` | New workspaces + `.test.tsx`. |
| `frontend/src/features/portal/module-registry.tsx` | Wire the 4 module ids into `connectedModuleRegistry`. |
| `frontend/src/features/components/portal/master-schedule-workspace.tsx` | Task 1 fix (already applied and verified). |
| `e2e/tests/*.spec.ts` | New Dean/Executive Director dashboard journeys; `scheduling-and-approval.spec.ts` already upgraded. |
| `docs/adr/0016-*.md`, `docs/adr/0017-*.md` | Correction + new aggregation-layer ADR. |

---

## Task 0 — Housekeeping ✅ done

Restored `php artisan serve` to the dev environment (was left on
`--env=testing` from Phase 8c). Verified via live login (`user.id: 1`,
matching the dev database).

## Task 1 — Correct ADR 0016, fix the real bug ✅ done

1. Corrected ADR 0016 decision 8 and every `PROGRESS.md` reference: the
   Executive Director's schedule-approval controls were reachable the whole
   time, via `master-schedule` → `ScheduleDecisionControls` with
   `actorRole="executive_director"`.
2. Fixed the real bug tracing it down found: `MasterScheduleWorkspace` gated
   *both* the published-sections list and the decision controls behind one
   `AsyncBoundary` keyed on `published.length === 0`. Split into two
   independent boundaries — verified via a new regression test
   (`master-schedule-workspace.test.tsx`, 4/4 passing).
3. Upgraded E2E journey 5 to drive the real `/portal/master-schedule` UI for
   the Executive Director's half instead of the API workaround — verified
   (full suite 18/19 passing, 1 skipped as designed).

## Task 2 — Backend aggregation layer

1. `config/enrollment.php`: add `dashboard.stuck_threshold_days`
   (`env('DASHBOARD_STUCK_THRESHOLD_DAYS')`, default null), docblock
   matching `max_regular_units`' existing wording.
2. `EnrollmentSummary` value object + `BuildEnrollmentSummary` Action:
   counts grouped by `EnrollmentStatus::cases()` for a given term, plus
   funnel-stage counts derived from `submitted_at`/`registrar_decided_at`/
   `payment_confirmed_at`/`enrolled_at` (populated vs. null per stage).
   Section fill (`sum(enrolled_count)` / `sum(capacity)` across published
   sections for the term) and grade-submission completeness (`AcademicGrade`
   counts by `GradeStatus::cases()`) join the same summary.
3. `InstitutionSummary` value object + `BuildInstitutionSummary` Action:
   the same enrollment/section aggregates institution-wide (no term filter),
   plus year-over-year counts grouped by `academic_terms.school_year`.
4. `PolicySettingsSummary` + `BuildPolicySettingsSummary` Action: reads every
   `config('enrollment.*')` key, classifies each as configured / provisional
   -default / absent-from-config, and attaches the matching §17 line for
   anything not GRC-confirmed (reusing the language already in
   `PROGRESS.md`'s Open Institutional Decisions table).
5. New Resources (`EnrollmentSummaryResource`, `InstitutionSummaryResource`,
   `PolicySettingsResource`) — summary-shaped, not row/collection. Dates
   formatted `->utc()->format('Y-m-d\TH:i:s\Z')` per ADR 0016's rule.
6. `DashboardPolicy`: `viewEnrollmentSummary` (dean, executive_director),
   `viewInstitutionSummary` (executive_director only),
   `viewPolicySettings` (registrar_head only). Registered in
   `AppServiceProvider::boot()` alongside the existing two gates.
7. Controllers + routes:
   ```
   Route::middleware('role:dean,executive_director')->group(function (): void {
       Route::get('/dashboards/enrollment-summary', EnrollmentSummaryController::class);
   });
   Route::middleware('role:executive_director')->group(function (): void {
       Route::get('/dashboards/institution-summary', InstitutionSummaryController::class);
   });
   Route::middleware('role:registrar_head')->group(function (): void {
       Route::get('/dashboards/policy-settings', PolicySettingsController::class);
   });
   ```

**Verify:** live-HTTP proof (matching the existing 403/404/429 convention)
that a Student token gets 403 on every `/dashboards/*` route, and that no
response payload from any dashboard endpoint contains a student identifier.

## Task 3 — `stuck-students`

1. `StuckEnrollmentPolicy` (`role:dean` gate) + `ListStuckEnrollments` Action:
   non-terminal enrollments (`EnrollmentStatus::terminalValues()` excluded)
   sorted by days-in-current-status descending, returning only
   `student_number`, `status`/`status_label`, `days_in_status` — never a full
   `Enrollment` row, never contact/identity fields beyond the number.
2. `stuck_threshold_days` from config attaches an `is_flagged` boolean per
   row when set; when null, every row's `is_flagged` is `false` and the
   Resource includes a `threshold_configured: false` flag the frontend uses
   to render the "no institutional threshold confirmed" message.
3. Route: `GET /api/v1/stuck-enrollments`, `role:dean`.

**Verify:** confirm live that a Dean token sees dwell-time data with
`threshold_configured: false` against the unmodified `config/enrollment.php`
default, and that a non-Dean token (including Executive Director) gets 403 —
this endpoint is intentionally narrower than the shared dashboards.

## Task 4 — Frontend workspaces

Four new components, `WorkspacePage` + `AsyncBoundary` + `DataTable`
conventions:

- `enrollment-dashboard-workspace.tsx` (Dean) — status distribution +
  funnel-stage + section-fill + grade-completeness cards.
- `institution-dashboard-workspace.tsx` (Executive Director) — same shape,
  institution-wide, plus year-over-year.
- `stuck-students-workspace.tsx` (Dean) — `DataTable` of dwell-time rows;
  renders the "no threshold confirmed" banner when `threshold_configured`
  is false, a flagged-row highlight when true.
- `policy-settings-workspace.tsx` (Registrar Head) — read-only list of
  policy values, each row showing configured / provisional-default / absent,
  with a link/reference to the matching §17 line for anything unconfirmed.

Wire all four into `connectedModuleIds`/`connectedModuleRegistry` in
`module-registry.tsx`. `reports` (Dean and Executive Director) stays
unwired — it has no content to show.

## Task 5 — Tests

- Backend: Action unit tests (correct counts against seeded fixtures),
  Policy tests (role-denial matrix for all 4 new gates, matching
  `SubjectPolicyTest`'s "every role may view any" / denial-case shape),
  Feature tests per new route including the 403 cases.
- Frontend: one `.test.tsx` per new workspace with `vitest-axe`, matching
  the existing 19 workspaces' pattern.
- E2E: two new Dean/Executive Director journeys exercising the connected
  dashboards.

## Task 6 — Docs

**ADR 0017 — the aggregation layer**: the third Action return shape and why
it's a deliberate pattern (not incidental); aggregate-only endpoints instead
of widening `Enrollment::scopeVisibleTo`, with the verified-in-code
current-exclusion as evidence; the `Enum::cases()` group-by rule and why
provisional vocabularies force it; the never-sum-money rule;
`stuck-students`' factual/judgment split.

`PROGRESS.md`: Phase 7c section rewritten from "not started" to done; feature
matrix 29→33; §17 table gets `dashboard.stuck_threshold_days` as a new
mechanism-implemented/value-flagged row; roadmap updated; the four ADR 0016
correction points (Task 1) already applied.

---

## Verification

Nothing recorded as passing unless it actually ran (`AGENTS.md`).

- Backend: `composer format:check`, `analyse` (Larastan level 8), `test`
  (must exceed 641), `audit --locked`.
- Frontend: `format:check`, `lint`, `lint:fast`, `typecheck`, `test` (must
  exceed 362), `build`, `audit`.
- E2E: full suite green including the 2 new journeys, run against a freshly
  seeded database.
- **Live authorization-boundary proof**, matching this project's established
  convention of proving 403/404/429 over real HTTP rather than only in unit
  tests: Student and Faculty tokens denied on every `/dashboards/*` and
  `/stuck-enrollments` route; Dean denied `institution-summary` and
  `policy-settings`; Executive Director denied `stuck-enrollments` and
  `policy-settings`; no student identity present in any dashboard payload
  (grep the raw JSON for `email`/`name` fields — should find none outside
  `stuck-enrollments`' deliberate `student_number`).

## Commits

Per `AGENTS.md`, nothing is committed, merged, or pushed without an explicit
request.
