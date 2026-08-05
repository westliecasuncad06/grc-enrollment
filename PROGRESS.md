# GRC Enrollment System — Development Progress

**Last updated:** 2026-08-05 · **PRD version:** v3.2 · **Branch:** `main`
at `85a6357` (Phase 7c and the grading/enrollment-completion slice — ADR
0021 — are both merged). The working tree currently carries two further
uncommitted slices on top: the 2026-08-04 section-terminology/Grades-sidebar
fix, and the 2026-08-05 assessment/fees, guided Cashier flow, overload
approval, and 10-connected-professor slice (ADR 0022). **See *Session
History* at the bottom of this file for the current narrative** — the
*Current Objective* section immediately below is preserved as historical
record of the manual-enrollment-startup slice and is no longer the live
state; the *Exact Next Steps* section has a 2026-08-05 pointer to what's
actually next. Nothing since `85a6357` has been committed or pushed — the
user has repeated, multiple times, that they will say explicitly when that
should happen.

## Current Objective

**Refine, then implement, the manual enrollment-startup slice for Registrar
Head and Program Chair without overwriting unrelated user changes.** The
approved product direction is: Registrar Head gets one Enrollment module for
creating a Draft academic term; Program Chair gets one hard-gated three-step
Enrollment workspace for Process 1.1–1.3; supporting Chair links are retained
only where explicitly approved; ML and predictive outputs remain paused; seed
history is six archived terms covering both semesters of 2020–2021 through
2022–2023. The new session refinement adds a Registrar-friendly segmented
term lifecycle and an explicit archive action that closes ongoing terms, plus a Program Chair
waiting state when no current term exists. Because `academic_terms` stores one
school-year-and-semester pair per row, the exact archive target (one semester
or both semesters of a school year) must be confirmed before the design is
amended or code is changed.

The user confirmed one Program Chair per supported college: COE, CCS, COA,
and CBAE. Process 1.1–1.3 progress must therefore be tracked independently
per academic term and college; `academic_terms.status` remains the
institution-wide lifecycle, not a substitute for four independent Chair
workflows. The design is written and self-reviewed in
`docs/superpowers/specs/2026-08-01-manual-enrollment-startup-design.md` and is
The backend lifecycle/workflow implementation is now in place: five canonical
term statuses, singleton current-term guard, four college workflow rows per
new term, Program Chair stage transitions, and Registrar archive
actions, UTC archive metadata, and audit vocabulary/API routes. Supporting
database integration tests are written but remain blocked by the existing
test-database DDL/grant issue described below. The current WIP still contains a
partial academic-term create API/UI, subject-offering schema/API, and a long
Program Chair page; frontend hard gating and the friendly segmented portals
remain the next implementation slice.

2026-08-02 inline execution / Task 1 RED checkpoint: the user selected per-semester closing and
archiving (one `school_year` + `semester` record), approved a four-segment
Registrar Enrollment stepper, and approved the Program Chair waiting state.
The first attempt to amend the written spec failed cleanly because one patch
context line did not match; `apply_patch` made no spec change. The amendment
continued in smaller verified patches: the written spec now contains the
single-current-term rule, explicit `semester_ongoing` → `semester_closed` →
`archived` Registrar actions, non-destructive retention, close/archive audit
and idempotency requirements, and Program Chair waiting/closed states. It is
now self-reviewed: the placeholder scan is clean, the global term lifecycle
and per-college stages have separate sources of truth, per-semester archive
scope is explicit, and `git diff --check` passes. The revised written spec is
approved by the user. The implementation plan is now written and self-reviewed
at `docs/superpowers/plans/2026-08-02-manual-enrollment-startup.md`; it keeps
the applied lifecycle migration intact, sequences backend before frontend,
requires failing tests before implementation, and leaves the worktree
uncommitted pending an explicit integration request.

Documentation milestone: `docs/testing/SEEDED_IDENTITIES.md` now lists the
four college-specific Program Chair accounts (`chair.ccs`, `chair.coe`,
`chair.coa`, and `chair.cbae` at `@grc.test`) and explicitly confirms the
shared local/testing password `password`.

Task 1 checkpoint: the first RED run hit a test-only namespace typo, which was
fixed; the next run proved the intended five-status/model failures but also
hit an existing environment blocker before feature migrations could run:
`grc_test` lacks DDL permission for the pending WIP `subject_offerings`
migration. The focused Unit tests now pass (13 tests, 22 assertions). Feature
database tests remain unverified until the existing migration identity is
used or the test database grant is corrected; no production workaround was
added. A retry with the local migration credentials also failed because that
identity has no access to `grc_enrollment_test`; this is an environment grant
issue, not an application assertion result.

Task 2–3 milestone (2026-08-02): college-scoped workflow stages and the
Registrar close/archive API are implemented. Unit/model/policy/resource/audit
tests pass; API-surface tests pass (23 tests, 212 assertions), targeted
PHPStan reports no errors, and changed PHP files pass syntax checks. The
close/archive feature tests and workflow endpoint tests remain queued for a
database-enabled run; they cannot execute until the test account can migrate
the pending WIP schema. No commit or push was made.

Task 4–6 frontend milestone (2026-08-02): the shared portal navigation now
keeps Program Chair supporting links visible but non-navigable until that
college reaches schedule preparation. Program Chair Enrollment now shows the
Registrar waiting message when no actionable term exists, uses the current
college workflow, and exposes manual 1.1 → 1.2 → 1.3 progression controls.
Registrar Enrollment now has a four-segment lifecycle display plus explicit
Close and Archive actions per semester. Frontend `npm run typecheck` and
`npm run lint -- --quiet` pass. Existing focused UI tests still contain two
pre-existing responsive-card duplicate-text assumptions and two synchronous
loading assumptions; these are recorded as test follow-up rather than
claimed green.

Task 7 documentation/seed milestone (2026-08-02): archive-first seeded
identity/term documentation, ADR 0018, data-dictionary lifecycle notes, and
OpenAPI routes/schemas are aligned with the implemented contract.
`npx --yes @redocly/cli@latest lint docs/api/openapi.yaml` passes. Section and
demo-enrollment seeders now no-op safely when the clean seed has no ongoing
term; the focused database assertions remain blocked by the existing MariaDB
test grant, so no database-seeded result is claimed.

Final verification (2026-08-02): backend focused unit/API/static checks pass
(43 tests, 249 assertions; targeted PHPStan has no errors); frontend focused
contract/navigation/waiting tests pass (45 tests in the final focused run), `npm run typecheck`,
`npm run lint -- --quiet`, and `npm run build` pass; OpenAPI lint and
`git diff --check` pass. The full Vitest command with
`--no-file-parallelism` exceeded the 120-second execution limit, so it is not
reported as green. Feature tests that require `RefreshDatabase` still stop at
the existing `grc_test` DDL permission error for the pending
`subject_offerings` migration; the migration-credential retry lacks access to
`grc_enrollment_test`. No commits or pushes were made.

Fresh local testing reset (2026-08-02, user-requested): the local
`grc_enrollment` database had the new migrations listed but their tables were
not created, so Registrar create requests could not work. The pending
subject-offerings migration was corrected with a short MariaDB-safe unique
index name, then migrations `000002`–`000004` were applied locally. Table-level
local grants were added for the app/migrator identities. Existing
`2025-2026 2nd` and `2026-2027 1st` rows were retained but marked `archived`
with timestamps; the singleton current-term pointer is `NULL`. No sections,
enrollments, grades, or other dependent records were deleted. The Registrar
Head can now create a new school year and semester from a clean current-term
state. A read-only Registrar bearer-token smoke check confirms both displayed
terms are archived and `is_actionable_current=false`; no test term was
created on the user's behalf.

## Verified Completed — Phase 7c (factual dashboards, dwell-time signals, policy visibility)

Design spec: `docs/superpowers/specs/2026-07-31-phase-7c-dashboards-design.md`;
plan: `docs/superpowers/plans/2026-07-31-phase-7c-dashboards.md`; decision
record: `docs/adr/0017-dashboard-aggregation-layer.md` (new decisions) and
`docs/adr/0016-e2e-architecture-and-live-contract-fixes.md` (correction).
Both backend and frontend touched; no migrations.

- **Task 1 — corrected a factual error and fixed the real bug behind it.**
  ADR 0016 decision 8 originally claimed no module id reached
  `ScheduleDecisionWorkspace` for `executive_director`. Re-verified against
  the actual component tree: `MasterScheduleWorkspace` (in that role's
  module list) embeds `ScheduleDecisionControls` with
  `actorRole="executive_director"`, and `legalActions` already grants that
  role `executive_approve` — the controls were reachable the whole session.
  Tracing the miss further found the real defect: both the "Published
  sections" and "Executive decisions" cards sat inside one `AsyncBoundary`
  gated on `published.length === 0`, so with no section published yet the
  Executive Director couldn't approve the very first proposal — exactly the
  action that would publish the first section. Fixed by splitting into two
  independent boundaries (`master-schedule-workspace.tsx`); upgraded E2E
  journey 5 to drive the real UI instead of the API workaround it used
  before. See ADR 0016 decision 8's correction.
- **Task 2 — the first aggregation layer in this codebase.** Every prior
  Action returned a paginator or a single model; this phase's four new
  Actions (`App\Actions\Dashboard\*`) return typed readonly value objects
  built from `DB::table(...)`/`selectRaw` conditional aggregation, grouped
  strictly off `EnrollmentStatus::cases()`/`GradeStatus::cases()` (the two
  PRD-authoritative enums), never string literals. New config key
  `dashboard.stuck_threshold_days` (default `null`) follows the same
  mechanism-implemented/value-flagged pattern as `max_regular_units`. See
  ADR 0017.
- **Task 3 — `stuck-students`, factual half and judgment half kept
  separate.** Every non-terminal enrollment's dwell time in its current
  status renders unconditionally (arithmetic, not policy); rows are only
  *flagged* once `dashboard.stuck_threshold_days` is set, which it isn't by
  default — the page states plainly that no institutional threshold is
  configured rather than guessing. Scoped to `Draft`/
  `PendingRegistrarApproval`/`PendingPayment` specifically (not the broader
  `active()` scope, which also includes `Enrolled`) — found via live-data
  inspection that an already-enrolled student isn't "stuck" in the
  enrollment process. Minimal fields only (`student_number`, status, dwell
  days) — no name or email crosses the boundary.
- **Task 4 — four new workspaces, aggregate-only by design.** Dean's
  `enrollment-dashboard`/`stuck-students`, Executive Director's
  `institution-dashboard`, Registrar Head's `policy-settings` (read-only).
  Dean and Executive Director get counts, never rows: `Enrollment::
  scopeVisibleTo`/`EnrollmentPolicy::viewAny()` currently exclude both roles
  entirely, and widening that scope would hand both roles row-level access
  to every student's record — exactly what PRD §3.6/§9.4 constrain against.
  The new `DashboardPolicy`/`StuckEnrollmentPolicy` follow
  `EligibleSubjectPolicy`'s documented "computed view, not a stored
  resource" precedent instead. `compliance-reports` and the shared
  `reports` id (Dean + Executive Director) stay placeholder — genuinely
  §17-blocked (no field list, format, or sign-off authority for either).
- **Task 5 — tests.** Backend: `DashboardPolicyTest` (4 tests) and
  `DashboardEndpointsTest` (10 tests, including a no-student-identity-leak
  string-scan and a full role-boundary matrix); `ApiSurfaceTest` extended
  with the 4 new routes' exact golden list and role boundaries. Frontend:
  4 new workspace test files (13 tests, `vitest-axe` on each), plus fixes to
  the pre-existing `module-registry.test.tsx`/`portal-module-page.test.tsx`
  golden lists (29→33 connected modules). E2E: 2 new journeys (16 Dean, 17
  Executive Director) added to `e2e/tests/dashboards.spec.ts`, deliberately
  not asserting which seeded student number appears in `stuck-students` —
  journeys 6/7/8 all mutate shared seed state, and file order is not
  guaranteed under 2 CI workers, so only structural/format assertions are
  safe (see the spec's own header comment).
- **Task 6 — docs.** New ADR 0017 (aggregation layer: the third Action
  return shape, aggregate-only endpoints over widening authorization, the
  `Enum::cases()` group-by rule, the never-sum-`payments.amount` rule, the
  in-progress-only `stuck-students` scoping). ADR 0016 decision 8 corrected.
  This document's feature matrix, §17 table, and roadmap updated below.

## Verified Completed — Phase 8c (Playwright E2E foundation)

Design spec: `docs/superpowers/specs/2026-07-31-phase-8c-e2e-foundation-design.md`;
plan: `docs/superpowers/plans/2026-07-31-phase-8c-e2e-foundation.md`;
decision record: `docs/adr/0016-e2e-architecture-and-live-contract-fixes.md`.
Frontend and backend both touched: the frontend not at all beyond test
infra; the backend for two genuine bug fixes found along the way (see
below) — no migrations either way.

- **Task 1 — `e2e/` package and Playwright config.** New root-level npm
  package (`@playwright/test` ^1.62.0, `@axe-core/playwright` ^4.10.2, per
  the pre-existing `/e2e/node_modules/` `.gitignore` reservation and
  `version-compatibility.md`'s pin). `playwright.config.ts` splits a
  `chromium` project from a `throttle-isolated` project (serial, 1 worker,
  depends on `chromium`) — see Task 3.
- **Task 2 — stack orchestration and state reset.** `php artisan serve
  --env=testing` verified empirically to correctly route every request to
  `grc_enrollment_test`, not the dev database (see ADR 0016 decision 6).
  `e2e/scripts/reset-db.mjs` runs `migrate:fresh --seed --env=testing`
  once per suite run, not per test. Found and fixed a real infrastructure
  bug along the way: `.env.testing`'s `CACHE_STORE=array` silently disabled
  the rate limiter over real HTTP (PHP's built-in dev server spawns a fresh
  process per request; the array driver's state doesn't survive between
  them) — changed to `file`, confirmed not to affect PHPUnit (which
  overrides `CACHE_STORE` directly via `phpunit.xml`). Full detail: ADR
  0016 decision 5.
- **Task 3 — the 13 testable journeys.** `e2e/tests/*.spec.ts`, one file
  per journey group, `e2e/fixtures/{auth,api-client,seed-identities,
  select}.ts` shared helpers. Journeys 1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13
  fully covered; 4 & 5 covered together; 15 covered for its authorization
  half only; 14 skipped with a documented reason (ml-service dormant,
  Phase 9 boundary). Found and fixed a real, previously invisible
  live-contract bug: 7 of 11 date-serializing API Resources used a Carbon
  format the frontend's own Zod schemas reject, breaking every workspace
  that rendered a real timestamp — see *Technical Decisions* and ADR 0016
  decision 7. Also found, and left deliberately untouched as an
  application-scope decision, one real UI gap: no student-facing
  "Withdraw" button exists despite the mutation hook being fully
  implemented — ADR 0016 decision 8. **Corrected in Phase 7c:** this entry
  originally also claimed no module id reached `ScheduleDecisionWorkspace`
  for `executive_director`; that was wrong — the Executive Director's
  approval controls were reachable the whole time, via `master-schedule`.
  Journey 5 originally tested that role's half over the API as a result;
  it now drives the real UI. See ADR 0016 decision 8 and *Verified
  Completed — Phase 7c*.
- **Task 4 — accessibility in a real browser.** `e2e/tests/accessibility.spec.ts`:
  `@axe-core/playwright` against the landing page, login page, portal
  overview, and Eligible Subjects (the page from the original Phase 8b
  screenshot) — zero critical/serious violations. A 200%-zoom viewport pass
  on Eligible Subjects confirms no horizontal overflow. A
  `prefers-reduced-motion: reduce` pass confirms Phase 8b's `motion`
  library JS-driven transforms are genuinely suppressed, not just the CSS
  ones — closing the manual WCAG/visual-verification gap deferred in both
  Phase 8a and Phase 8b.
- **Task 5 — CI job.** New `e2e` job in `.github/workflows/ci.yml`,
  composing the `backend` job's MariaDB service container and env
  configuration with the `frontend` job's Node setup, plus Playwright
  browser install, both servers started in the background, a `wait-on`
  health gate, then the suite itself, with report/log artifact upload on
  failure. Not yet run on GitHub — per ADR 0012, a workflow is only proven
  by actually running, which needs a push.
- **Task 6 — docs.** ADR 0016 (comprehensive — architecture decisions plus
  every defect found and fixed or documented); `README.md`'s stale Vite
  `--port=5173` instruction corrected plus a new `e2e/` setup section;
  `docs/architecture/version-compatibility.md`'s Playwright row updated
  from "when E2E begins" to a real status.

## Verified Completed — Phase 8b (portal UI coherence & motion)

Design spec: `docs/superpowers/specs/2026-07-31-phase-8b-ui-coherence-motion-design.md`;
plan: `docs/superpowers/plans/2026-07-31-phase-8b-ui-coherence-motion.md`;
decision record: `docs/adr/0015-page-header-ownership-and-portal-motion.md`.
Frontend-only — no backend or migration changes.

- **Task 1 — page chrome.** `PortalModulePage`'s connected branch no longer
  wraps a workspace in a second, module-registry-sourced header — the
  workspace's own `WorkspacePage` is now the page's sole `<h1>` (was `<h2>`,
  since a second header used to own the true `<h1>` role). `CardTitle`'s
  default level moved 3→2 to stay one level below it; every explicit
  `level={3}`/`level={4}` override across the codebase shifted down by one to
  match, plus 3 raw `<h3>` headings that would otherwise have skipped a level
  (`curriculum-workspace.tsx`, `schedule-proposals-workspace.tsx`,
  `prerequisite-editor.tsx`). `.portal-module-page--connected` replaces the
  centered-splash-screen layout with a top-aligned column for real content;
  the original centered/placeholder layout stays for the two still-unbuilt-
  module branches, where it's correct. `portal-module-page.test.tsx`'s 43
  cases rewritten against the single header.
- **Task 2 — house design language.** `WorkspacePage` gained the existing
  `.eyebrow` micro-label and a serif display heading matching
  `.portal-overview-header`'s own pattern (previously it and its description
  carried no classes at all). `.portal-module-card` gained a hover
  lift/shadow (previously zero interaction feedback despite every card
  wrapping a link). New `--ease-house`/`--duration-fast/base/slow` tokens,
  seeded from values already in use (the `ledger-enter` keyframe's curve, the
  `Sheet` component's duration) — the codebase had no spacing/shadow/duration
  token layer at all before this. New `.portal-workspace-highlight` utility
  adapts the landing page's `.enrollment-folio` gold-offset-shadow idiom to a
  light background, for panels that deliberately want extra weight (the
  enrollment review panel).
- **Task 3 — motion.** Added `motion` (framer-motion, current package name)
  as a dependency — clean install, 0 vulnerabilities, no `overrides` needed.
  Wrapped in `src/features/components/portal/motion.tsx`
  (`Reveal`, `StaggerList`/`StaggerItem`, `FadePresence`), each checking
  `useReducedMotion()` itself since the existing CSS
  `prefers-reduced-motion` rule cannot reach JS-driven transforms. Added a
  `matchMedia` stub to `src/tests/setup.tsx` (jsdom has none) following the
  same pattern as Phase 8a's Pointer Events polyfill.
  **`AsyncBoundary`'s state transitions are deliberately NOT wrapped in
  `AnimatePresence`** — an early attempt broke a real workspace test on
  refetch (see ADR 0015 for the full mechanism); `FadePresence` stays
  available for narrower, single-workspace use instead.
- **Task 4 — shared primitive fixes + raw form-control migration.** All 28
  raw `<select>` and 14 raw `<input>` across 10 workspaces (plus
  `prerequisite-editor.tsx`) replaced with `ui/select.tsx`/`ui/input.tsx` —
  Phase 8a had asked for this and it wasn't done. Migrating these off
  native `register()` onto `Controller`-wrapped `Select` surfaced a genuine,
  previously-undetected bug: several "auto-select the active academic term"
  behaviors had silently stopped working, caught only because the new tests
  assert the *selected* value instead of just option presence (see ADR 0015
  decision 5 for the two different fixes this required, and decision 6 for a
  related Radix `Select` controlled-value bug fixed in 4 files). `AsyncBoundary`'s
  empty state now renders through `ui/empty.tsx` (was a bare `<p>`) —
  PRD §12.2's required pattern. `DataTable` gained an `emptyMessage` prop
  (callers no longer need their own ternary guard) and its mobile-card
  fallback now titles itself with the first column's rendered value instead
  of a raw database id. `SelectTrigger` gained `transition-colors`, matching
  its `Input`/`Textarea` siblings.
- **Task 5 — rebuilt `enrollment-workspace.tsx`.** The exact page from the
  reporting screenshot, and the only Student workspace Phase 8a's migration
  had skipped entirely. Now uses `AsyncBoundary`, `DataTable` (both the
  selection review table and the "Your enrollments" list), real `Select`s,
  and a single prioritised alert region (error > field errors > receipt —
  previously up to two could stack simultaneously if a stale receipt
  survived a new failed attempt; `submit()` now clears it first). The
  review/summary panel uses the new `.portal-workspace-highlight` treatment
  and `StaggerList` on the subject-selection cards.
- **Task 6 — polish across the other 18 workspaces.** `lastUpdated` wired to
  `WorkspacePage` in 16 of them (using the most-recently-updated query for
  multi-query/multiplexed pages via `Math.max(...dataUpdatedAt)`;
  deliberately skipped on `admission-provisioning-workspace.tsx`, a pure
  create-form with no "your data" list to timestamp). `StaggerList` applied
  to `eligible-subjects-workspace.tsx`'s card grid (motion is intentionally
  not applied to `<ul>`/`<li>`-based lists — `StaggerItem` renders a `<div>`,
  which would be invalid nesting inside a `<ul>`). `StudentQueuePaymentWorkspace`'s
  `StatusStepper` promoted to `src/features/components/portal/status-stepper.tsx`,
  now a generic, tested, reusable primitive (domain-specific stage derivation
  stays with the caller).
- **Task 7 — dead CSS.** Removed ~200 lines of `globals.css` with zero TSX
  references (`.readiness-hero`, `.hero-copy`/`.hero-summary`/`.hero-action-row`,
  `.route-ledger*`, `.phase-folio*`, `.boundary-note*`, including several
  instances hidden inside compound selectors shared with still-active
  classes, e.g. `.section-heading h2, .boundary-note h2`). Removed two
  classNames used in TSX but never defined in CSS (`landing-shell` on the
  landing page's outer div, `portal-module-section` on the portal overview's
  module grid) rather than inventing new styling for them — both were purely
  decorative dead weight already covered by sibling classes.
- **Task 8 — tests.** No separate pass was needed: every task above was
  verified with targeted test runs as it landed (see *Commands and Tests Run
  — Phase 8b*), and every one of the 19 workspace test files retains its
  `vitest-axe` "no detectable accessibility violations" case, confirmed by a
  final sweep. 2 new tests added directly to `data-table.test.tsx` for the
  `emptyMessage` prop and the corrected mobile-card heading; 2 new tests for
  the promoted `status-stepper.tsx`; 4 new tests for `motion.tsx` including
  the reduced-motion branch.
- **Task 9 — docs.** `docs/adr/0015-page-header-ownership-and-portal-motion.md`
  records the header-ownership decision, the motion-library tradeoffs, the
  `AsyncBoundary` reversal, and — in detail, since it's genuinely
  non-obvious and easy to get backwards — the two different fixes for
  populating a `Controller`-wrapped `Select` from asynchronously-loaded data
  depending on whether its `Controller` mounts before or after the data is
  known. This reconciliation.
- **Gate.** Full frontend gate green throughout (format, lint at
  `--max-warnings=0`, typecheck, build, `npm audit` 0 vulnerabilities); full
  suite 67 files / 362 tests (up from 66/358 at the start of this phase).
  **Not run this session:** live visual verification and the manual WCAG 2.1
  AA pass — the Chrome browser extension was not connected (same limitation
  Phase 8a recorded). The DOM-level and test-level evidence is solid (every
  structural defect from the screenshot is fixed and asserted by a test), but
  nobody has *looked* at the rendered result yet.

## Verified Completed — Phase 8a (accessibility & required states)

PRD §12.3 form behavior, §12.4 required states, §12.5 WCAG 2.1 AA, and the
presentation-layer part of §12.6. Design doc:
`docs/superpowers/specs/2026-07-30-phase-8a-accessibility-states-design.md`;
plan: `docs/superpowers/plans/2026-07-30-phase-8a-accessibility-states.md`;
decision record: `docs/adr/0014-presentation-layer-state-contract.md`.
Frontend-only — no backend or migration changes.

- **Task 1 — tooling.** Added `eslint-plugin-jsx-a11y@6.10.2` and
  `vitest-axe@0.1.0` as dev dependencies. `eslint-plugin-jsx-a11y`'s
  `peerDependencies` range tops out at ESLint 9 (stale metadata — the plugin
  works fine under the installed ESLint 10.8.0) and it bundles
  `minimatch@3.1.5` → `brace-expansion@1.1.18`, which carries a DoS advisory
  (GHSA-mh99-v99m-4gvg). Both fixed via `frontend/package.json` `overrides`
  (same mechanism already used there for `postcss`/`sharp`): `{"eslint":
  "$eslint"}` accepts the installed ESLint version for peer resolution, and
  `brace-expansion` is forced to `^5.0.8`. Verified `npm ci` (matching CI
  exactly) succeeds with 0 vulnerabilities. Enabling the plugin surfaced 5
  violations, all fixed: a redundant `role="region"` on an already-semantic
  `<section>` in `portal-module-page.tsx`; a confirmed false positive in
  `ui/pagination.tsx`'s `PaginationLink` (content arrives via a `...props`
  spread the linter can't trace — documented with a scoped disable comment);
  and 3 call sites where `ScheduleDecisionControls`' `role: UserRole` prop
  (domain data — which actor role, not ARIA) collided with `jsx-a11y/aria-role`
  — renamed to `actorRole` at the source rather than suppressed.
  `vitest-axe`'s `toHaveNoViolations` matcher registered in
  `src/tests/setup.tsx`; smoke-tested (flags an unlabeled `<button>`, passes
  a labeled one) before relying on it in the workspace migration.
- **Task 2 — status-aware error contract.** `getStatePresentation`
  (`lib/api-error-presentation.ts`) maps `ApiClientError` to PRD §12.4's
  named states (403/404/409/429/5xx/offline) — see ADR 0014 for the full
  status-to-copy table and the reasoning behind each retryable/non-retryable
  choice. `query-client.ts`'s `shouldRetryQuery` replaces the old blanket
  `retry: 1`: retries at most once, only for `kind: "connection"` or
  `status >= 500` — a 429 is never auto-retried, since that would worsen the
  throttle. `AuthGateway` gained `clearSession()`; `AuthProvider` now
  registers the 401 handler itself, so a rejected token drives real
  sign-out through `AuthContext` state instead of only clearing storage.
  `applyApiFieldErrors` gained `setFocus` wiring so a 422 focuses the first
  invalid field.
- **Task 3 — shared primitives.** New `WorkspacePage`, `AsyncBoundary`,
  `DataTable`, `Paginator`, `StatusRegion` (`components/portal/`), plus
  fixes to existing primitives: `CardTitle` gained a real `level` prop
  (renders `h2`–`h6`, not a `<div>`); `FieldError`/`useFieldError` wire
  `aria-describedby`/`aria-invalid`; `Skeleton` is `aria-hidden` (was
  silent to assistive tech in a way that also risked double-announcement);
  `Alert` uses `role="status"` for non-destructive variants instead of
  hardcoding `role="alert"` everywhere (a success receipt no longer
  interrupts assistively). New `Textarea` primitive replacing 2 raw
  `<textarea>`s.
- **Task 4 — portal shell & CSS.** `.portal-nav-link:focus-visible` added
  (was entirely unstyled); `aria-current="page"` on the active nav link;
  `.portal-content:focus` → `:focus-visible` with a visible outline
  (previously `outline: none` killed the skip-link's landing ring); new
  `Breadcrumb` replacing a hardcoded `<p>Role workspace / ...</p>`.
- **Task 5 — migrated all 19 `*-workspace.tsx` files** onto
  `WorkspacePage`/`AsyncBoundary`/`DataTable`/`Paginator`, replacing ~26
  hand-rolled loading/error/empty sites and 6 duplicated paginators.
  `enrollment-workspace.tsx`, `registrar-enrollment-workspace.tsx`, and
  `registrar-records-workspace.tsx` deliberately keep independent,
  hand-written `Alert` blocks for their *mutation* failures (submit/approve/
  reject/void) rather than routing them through `AsyncBoundary` — a failed
  mutation must preserve in-progress form state (selected section, typed
  reason), which `AsyncBoundary` (built to replace a query's entire render
  output) does not own. This split is recorded as a deliberate, documented
  asymmetry in ADR 0014, not an oversight.
- **Task 6 — tests.** Wrote the 3 previously-missing workspace tests
  (`class-rosters`, `grade-submission`, `registrar-records`). Added a
  `vitest-axe` "no detectable accessibility violations" test to all 19
  workspace test files. That pass surfaced one real production defect —
  `TeachingScheduleWorkspace`'s `DataTable` `renderCard` used `CardTitle
  level={4}` with no intervening `Card`/h3 between it and `WorkspacePage`'s
  own `h2`, a genuine heading-order (h2→h4) violation; fixed to `level={3}`,
  the default every other `DataTable` consumer gets automatically because
  each wraps its table in its own `Card`. Added real end-to-end integration
  tests for the states PRD §12.4 names — distinct from the unit-level
  coverage already in `api-error-presentation.test.ts` and
  `async-boundary.test.tsx` — driving an actual workspace through a mocked
  `fetch` returning a real HTTP envelope (not a hand-constructed
  `ApiClientError`): 403 and 404 on `registrar-records-workspace.test.tsx`'s
  credit-mappings query, 429 with a `Retry-After` header on its
  drops-withdrawals query, 409 on `enrollment-workspace.test.tsx`'s
  submission mutation (verifying the selected section survives the
  failure), and offline (`kind: "connection"`, via a rejected `fetch`) on
  its eligible-subjects query.
- **Task 7 — docs.** `docs/adr/0014-presentation-layer-state-contract.md`
  records the HTTP-status → presentation mapping and the query/mutation
  two-tier split. This reconciliation.
- **Gate.** See *Commands and Tests Run — Phase 8a*. Full frontend gate
  green (format, lint at `--max-warnings=0` including jsx-a11y, oxlint,
  typecheck, 65 files/354 tests, build, `npm audit` 0 vulnerabilities);
  backend no-regression confirmed at 641/641 (unchanged from Phase 7b, as
  expected — this slice touched no backend file). Live HTTP proof against
  the real dev database confirmed real 403 (student denied
  `/class-rosters`), 404 (`PATCH` a nonexistent enrollment id), and 429
  (login throttle, with a genuine `Retry-After` header) responses match
  exactly what `getStatePresentation` expects. **Not completed this
  session:** the manual WCAG 2.1 AA pass (keyboard-only traversal,
  screen-reader spot check, 200% zoom, responsive breakpoints,
  reduced-motion) and any visual/browser confirmation of the UI — the
  Chrome browser extension was not connected this session (same limitation
  Phase 7b recorded for its design pass). No live 409 trigger exists in the
  backend today (grep confirms nothing currently raises one — every
  business rule that could conflict returns 422 instead), so the 409 path
  is proven at the unit/integration level only, not against a real
  endpoint; this is a gap in the *backend's* state coverage, not evidence
  against the frontend contract.

## Verified Completed — Phase 7a (money path, merged `fc56148`)

- **Task 1 — role-scoped enrollment visibility (FR-FIN-001, FR-FIN-005).**
  `GET /api/v1/enrollments` generalized from the Phase 6 Student-only query
  into the `scopeVisibleTo` pattern (ADR 0008): Student → own rows;
  Registrar Head → all, with `status`/`academic_term_id` filters and
  pagination; Accounting Staff → `pending_payment` only, enforced in both
  `Enrollment::scopeVisibleTo` and `EnrollmentPolicy::viewAny` (defense in
  depth). `EnrollmentResource` gained `student_id`/`student_number` so
  non-owning roles can identify whose row they're viewing. New
  `IndexEnrollmentRequest` + `ListEnrollments` Action mirror
  `ListAuditLogs`'s shape.
- **Task 2 — Registrar decisions API (FR-FIN-001, FR-FIN-002).**
  `PATCH /api/v1/enrollments/{enrollment}` follows ADR 0011 verbatim: one
  route, an `action` field, `EnrollmentPolicy` resolving `decideApproval`
  (`registrar_approve`/`registrar_reject`) or `void` per request, no
  `role:` middleware. `registrar_approve` moves `pending_registrar_approval`
  → `pending_payment`; `registrar_reject` moves it to `rejected`; `void`
  moves `pending_payment` → `cancelled` — a distinct, later checkpoint for
  cancelling an already-approved-but-unpaid enrollment (§17 leaves
  "authorized edge case" undefined, so this scope choice is documented in
  `EnrollmentPolicy::void`'s docblock, not asserted as confirmed policy).
  Reject and void require a non-empty reason, recorded only in the audit
  row (`enrollments` has no `decision_reason` column, unlike
  `schedule_proposals`).
- **Task 3 — grade encoding API (PRD §4.3, §5.3 DFD 3.1).**
  `GET`/`POST`/`PATCH /api/v1/academic-grades`, role-scoped read (Student
  own, Faculty own sections via `section.professor_id`, Registrar Head
  all). `POST` is Faculty-only and re-checks section ownership plus the
  (student, subject, term) uniqueness server-side. `PATCH` serves three
  concerns on one route: a plain content edit of `final_grade`/`remarks`
  while still `draft`, `action: submit` (Faculty, `draft`→`submitted`), and
  `action: lock` (Registrar Head, `submitted`→`locked` — the moment a
  grade becomes part of the official record `BuildEligibleSubjectPool`
  reads for prerequisite evaluation, so it's the one point that notifies
  the student). `final_grade` stays the exact decimal string the model
  already carried since Phase 4 — no scale or passing-mark asserted, per
  PRD §17.
- **Task 4 — payment queue + serving number API (FR-FIN-006).**
  `GET /api/v1/queue-tickets` (Accounting Staff only, deterministic
  `queue_date` then `id` order, filterable, paginated) and
  `PATCH /api/v1/queue-tickets/{queueTicket}` with `action: serve`
  (`waiting`→`serving`) or `action: complete` (`serving`→`served`),
  following ADR 0011's constant-trio + row-lock shape. Both transitions
  are gated to the same single role with no per-ticket ownership
  dimension, so the route carries the coarse `role:accounting_staff`
  middleware (re-checked by `QueueTicketPolicy`) rather than a bare
  Policy-only gate. §17 leaves reset cadence, priority, and "how many
  tickets may be serving at once" unconfirmed — only the two-step order is
  enforced.
- **Task 5 — payment confirmation + Digital COM API (FR-FIN-007–010).**
  `POST /api/v1/enrollments/{enrollment}/payment` (Accounting only, only
  from `pending_payment`): one transaction creates the `Payment` row,
  transitions the enrollment to `enrolled`, and generates the Digital COM
  (`EnrollmentDocument`, type `com`, opaque `COM%06d` number), mirroring
  `SubmitEnrollment`'s five-write shape. **Idempotent** (FR-FIN-009): the
  Action checks for an existing `Payment` *before* checking the
  enrollment's status, so a repeat call — even one arriving after the
  enrollment has already moved on to `enrolled` — returns the existing
  payment/document rather than erroring or duplicating either (`200`
  instead of `201`). No PDF pipeline — `storage_path` stays null;
  FR-FIN-010's print/download is served by returning structured COM data
  for the Student module to render. `GET /api/v1/enrollment-documents`
  (Student own, Registrar Head all) via a new
  `EnrollmentDocument::scopeVisibleTo`.
- **Tasks 6–8 — 8 portal modules (Registrar Head ×2, Accounting ×4, Student
  ×2).** New schemas/services/hooks for academic grades, queue tickets, and
  enrollment documents, mirroring `audit-schema.ts`'s pagination pattern;
  `enrollment-schema.ts` updated for the paginated envelope,
  `student_id`/`student_number`, and the registrar-decision/
  payment-confirmation inputs. `getEnrollments`/`useEnrollmentsQuery` stay
  a flat own-list for the Student (backward-compatible with the existing
  Enrollment module); a new `listEnrollments`/`useEnrollmentsListQuery`
  adds the filterable, paginated role-scoped view for Registrar
  Head/Accounting. Four workspace components serve the 8 modules,
  following the Admission-provisioning precedent of one shared component
  per `initialModuleId`: `RegistrarEnrollmentWorkspace` (Enrollment
  Approvals + Overrides & Voids), `AccountingPaymentWorkspace` (Payment
  Queue + Serving Number + Payment Confirmation + COM Finalization), and
  two standalone Student modules, `StudentQueuePaymentWorkspace` and
  `StudentGradesComWorkspace` (grades + Digital COM with a `window.print()`
  affordance — §17 leaves COM format open and no PDF pipeline exists).
  Registry grew 15 → 23 `connectedModuleIds`; both boundary tests updated.
- **Task 9 — this reconciliation.** Confirmed zero pending migrations
  against the real dev database (Phase 7a adds no new tables — all 6 were
  already schema-only since the earlier foundation phase). Updated
  `docs/data-dictionary/enrollment-records.md`'s scope note and added an
  **API** line to each of the 6 tables this phase gave a route to, rather
  than duplicating the schema documentation in a new file. Ran a full live
  HTTP proof against the real dev database — not just tests — walking one
  fresh, really-submitted enrollment (`proof.student1@grc.test`) the whole
  way: Faculty encoded and submitted a grade → Registrar Head approved the
  enrollment and locked the grade → Accounting served and completed the
  queue ticket, then confirmed payment (**verified idempotent**: a second
  confirmation call with different, contradictory input returned the
  *original* payment/document unchanged, and direct SQL confirmed exactly
  one row in both `payments` and `enrollment_documents`) → the student's
  own `GET /enrollments`, `/academic-grades`, and `/enrollment-documents`
  all reflected the final state (enrolled, served ticket, locked grade,
  COM). Also exercised `registrar_reject` and `void` live on two other
  seeded enrollments, and confirmed Registrar Head/Accounting Staff
  visibility boundaries hold on the now-`enrolled` row (Accounting
  correctly stops seeing it once it leaves `pending_payment`). Every audit
  row (3 per the primary enrollment, 3 for the grade) and notification (4)
  landed in the exact expected order, verified via direct SQL.

## Verified Completed — Phase 7b (records core + Registrar Staff portal)

- **Design pass over the 8 Phase 7a portal modules**, done first at the
  user's explicit request before new feature work. `RegistrarEnrollmentWorkspace`
  and `AccountingPaymentWorkspace` now render their lists as `Table`s with
  semantic `Badge` status colors (destructive for rejected/cancelled,
  default for the "in-progress-positive" states) instead of plain
  `<ul><li>` rows; the payment-confirmation dialog's raw `<input>`s became
  proper `Field`/`FieldLabel`/`Input`; `StudentQueuePaymentWorkspace` gained
  a visual 4-stage status stepper (Submitted → Registrar approved →
  Payment confirmed → Enrolled) with a distinct stopped-state alert for
  rejected/cancelled/withdrawn; `StudentGradesComWorkspace`'s grade list
  became a `Table` and its Digital COM card got a certificate-style layout.
  All changes matched this codebase's own established design-system
  conventions (the same `Table`/`Badge`/`Field` patterns already used in
  `enrollment-workspace.tsx`, `admission-provisioning-workspace.tsx`) rather
  than inventing new ones. The Chrome browser extension was not connected
  in this session, so this was a rigorous code-level design audit against
  the existing component library and established patterns, not a live
  visual/screenshot review.
- **Task 1 — withdrawal request API (FR-FIN-004, PRD §4.2 rule 7).**
  `POST /api/v1/enrollments/{enrollment}/withdraw` (Student, own `enrolled`
  enrollment, reason required), `GET /api/v1/withdrawal-requests`
  (Student own, Registrar Staff and Registrar Head all — new
  `WithdrawalRequest::scopeVisibleTo`), `PATCH
  /api/v1/withdrawal-requests/{withdrawalRequest}` (Registrar-Staff-only
  `action: approve`/`reject`, following ADR 0011's constant-trio shape).
  `approve` drops every still-active `enrollment_subjects` row and, only
  when `config('enrollment.withdrawal.releases_seats')` is true (new flag,
  default `true`), decrements the affected section's `enrolled_count`
  exactly once — proven both by test and live, including a repeat-approval
  attempt that 422s with no second decrement. `withdrawal_requests` carries
  no unique constraint on `enrollment_id`, so idempotency is enforced under
  a row lock in the Action, not the schema.
- **Task 2 — transferee credits API (FR-FIN-003, PRD §3.8/§10.3).**
  `GET`/`POST`/`PATCH /api/v1/transferee-credits`. Registrar-Staff-only
  writes; `PATCH` serves the same plain-edit-vs-`action` shape
  `UpdateAcademicGradeRequest` established. Every write is audited,
  including plain content edits (`transferee_credit.updated`), so the
  record and its control history cannot diverge. Approved credits are
  deliberately record-only: proven both by test and live (approving a
  transferee credit mapped to a subject's own prerequisite left the
  student's `GET /eligible-subjects` verdict for the dependent subject
  unchanged) that `BuildEligibleSubjectPool` never reads this table —
  cross-institution grade equivalence stays an open PRD §17 decision.
- **Task 3 — Registrar Staff read access (PRD §3.8).** Widened
  `AcademicGradePolicy`/`AcademicGrade::scopeVisibleTo` and
  `EnrollmentDocumentPolicy`/`EnrollmentDocument::scopeVisibleTo` so
  Registrar Staff sees every row, the same breadth the Registrar Head
  already had. No new endpoints — existing routes, wider Policy/scope only.
- **Task 4 — class roster API.** `GET /api/v1/class-rosters` (filterable
  by `section_id`/`academic_term_id`, paginated), built on
  `EnrollmentSubject` with `enrollment.student`/`section.subject` eager
  loaded. New `EnrollmentSubject::scopeVisibleTo`: Faculty sees only their
  own sections; Registrar Staff and Registrar Head see all; every other
  role is denied by `EnrollmentSubjectPolicy::viewAny` before the scope
  ever runs. The roster endpoint `PROGRESS.md` has recorded as missing
  since Phase 6.
- **Tasks 5–7 — six portal modules.** Three schema/service/hook trios
  (withdrawal requests, transferee credits, class rosters) mirroring
  `queue-ticket-schema.ts`'s strict-Zod, prefix-key-invalidation pattern.
  `RegistrarRecordsWorkspace` serves all four Registrar Staff modules
  (Credit Mappings, Drops & Withdrawals, Academic Records, Enrollment
  Documents) via `initialModuleId`, region name `"Registrar records
  workspace"` (distinct from the Student `grades-com` module's existing
  `"Academic records workspace"`) — unlike `AccountingPaymentWorkspace`,
  it renders only the module matching `initialModuleId`, not all four at
  once, since these four are unrelated record types rather than steps of
  one flow. `ClassRostersWorkspace` (Faculty, read-only, following
  `teaching-schedule-workspace.tsx`'s responsive table/card pattern).
  `GradeSubmissionWorkspace` (Faculty, writes through the existing Phase
  7a academic-grades API — no new backend; reuses the new class-roster
  read to populate the per-section student list instead of inventing a
  student-search UI, since none exists elsewhere in this API). Registry
  grew 23 → 29 `connectedModuleIds`; both boundary tests updated; the six
  `role-capabilities.ts` descriptions de-"preview"-ified.
- **Task 8 — docs, gate, live proof.** `docs/api/openapi.yaml`: 3 new
  tags (`Withdrawals`, `Transferee Credits`, `Class Rosters`), 3 existing
  tag/route descriptions updated for the Task 3 widening, 7 new paths, and
  ~15 new schemas — Redocly-clean. `docs/data-dictionary/
  enrollment-records.md`: replaced both "API: none yet" notes, added the
  `class-rosters` API note to `enrollment_subjects`, and updated the two
  Task-3-widened tables' API notes. Full gate green (see *Commands and
  Tests Run*). **Live HTTP proof, not just tests**, against the real dev
  database: a fresh proof student (`proof.withdraw@grc.test`) submitted →
  registrar-approved → paid → `enrolled`; section 1's `enrolled_count`
  went 4 → 3 on withdrawal approval and stayed at 3 on a repeat approval
  attempt (422); a transferee credit approved for that same student,
  mapped to the exact subject its next course's prerequisite requires,
  left `GET /eligible-subjects`' verdict for that dependent subject
  unchanged (still ineligible, same reason) — proving the non-interaction
  live, not just by test; Faculty's live `GET /class-rosters` reflected the
  post-withdrawal `dropped` status; Registrar Staff's widened
  `academic-grades`/`enrollment-documents` reads returned real rows live.

## Work in Progress

None. Phase 7c is complete and fully quality-gated on `phase-7c-dashboards`,
not yet committed — committing/merging needs an explicit user request. See
*Exact Next Steps*.

## Files Changed — Phase 7c

**New — backend, dashboard aggregation layer:**
`app/Domain/Dashboard/{EnrollmentSummary,InstitutionSummary,
YearOverYearCount,PolicySettingsSummary,PolicyValueState,PolicyValueStatus,
StuckEnrollmentRow}.php`, `app/Actions/Dashboard/{BuildEnrollmentSummary,
BuildInstitutionSummary,BuildPolicySettingsSummary,ListStuckEnrollments}.php`,
`app/Http/Resources/Api/V1/Dashboard/{EnrollmentSummaryResource,
InstitutionSummaryResource,PolicySettingsResource,StuckEnrollmentResource}.php`,
`app/Http/Requests/Api/V1/Dashboard/IndexDashboardRequest.php`,
`app/Http/Controllers/Api/V1/Dashboard/{EnrollmentSummaryController,
InstitutionSummaryController,PolicySettingsController,
StuckEnrollmentController}.php`, `app/Policies/{DashboardPolicy,
StuckEnrollmentPolicy}.php`.

**New — backend tests:** `tests/Feature/Policies/DashboardPolicyTest.php`,
`tests/Feature/Api/V1/DashboardEndpointsTest.php`.

**New — frontend:** `features/schemas/dashboard-schema.ts`,
`features/services/dashboard-service.ts`, `features/hooks/use-dashboard.ts`,
`features/components/portal/{enrollment-dashboard-workspace,
institution-dashboard-workspace,stuck-students-workspace,
policy-settings-workspace}.tsx` and their `.test.tsx` twins (13 tests,
`vitest-axe` on each).

**New — E2E:** `e2e/tests/dashboards.spec.ts` (journeys 16, 17).

**New — docs:** `docs/adr/0017-dashboard-aggregation-layer.md`,
`docs/superpowers/specs/2026-07-31-phase-7c-dashboards-design.md`,
`docs/superpowers/plans/2026-07-31-phase-7c-dashboards.md`.

**Modified — backend, ADR 0016 correction and bug fix:**
`config/enrollment.php` (`dashboard.stuck_threshold_days`),
`routes/api.php` (4 new routes), `app/Providers/AppServiceProvider.php`
(4 new `Gate::define()`), `tests/Feature/Api/V1/ApiSurfaceTest.php` (golden
route list, role-boundary matrix).

**Modified — frontend:** `features/portal/module-registry.tsx` (4 new
connected module ids, 29→33), `features/components/portal/
master-schedule-workspace.tsx` (independent `AsyncBoundary`s, the real bug
fix), plus its `.test.tsx` and the two golden-list test files
(`module-registry.test.tsx`, `portal-module-page.test.tsx`).

**Modified — E2E and docs:** `e2e/tests/scheduling-and-approval.spec.ts`
(journey 5 upgraded to drive the real UI), `docs/adr/
0016-e2e-architecture-and-live-contract-fixes.md` (decision 8 corrected),
this document.

## Files Changed — Phase 8c

**New — `e2e/` package (root-level, its own `package.json`):**
`e2e/package.json`, `e2e/package-lock.json`, `e2e/tsconfig.json`,
`e2e/playwright.config.ts`, `e2e/scripts/reset-db.mjs`,
`e2e/fixtures/{auth,api-client,seed-identities,select}.ts`,
`e2e/tests/{auth,authorization,validation-and-throttling,
faculty-availability,scheduling-and-approval,enrollment,
registrar-approval,payment-and-com,grade-submission,withdrawal,
prediction-service-failure,accessibility}.spec.ts` (12 spec files).

**New — docs:** `docs/adr/0016-e2e-architecture-and-live-contract-fixes.md`,
`docs/superpowers/specs/2026-07-31-phase-8c-e2e-foundation-design.md`,
`docs/superpowers/plans/2026-07-31-phase-8c-e2e-foundation.md`.

**Modified — backend, real bug fixes (see Technical Decisions):**
`app/Http/Resources/Api/V1/{EnrollmentResource,EnrollmentDocumentResource,
AcademicGradeResource,PaymentConfirmationResource,QueueTicketResource,
TransfereeCreditResource,WithdrawalRequestResource}.php` (date-format fix,
14 fields across 7 files), `backend/.env.testing` +
`backend/.env.testing.example` (`CACHE_STORE` array→file).

**Modified — CI and docs:** `.github/workflows/ci.yml` (new `e2e` job),
`README.md` (stale Vite port fix + new `e2e/` setup section),
`docs/architecture/version-compatibility.md` (Playwright row).

## Files Changed — Phase 8b

No migrations, no backend files — frontend-only. ~95 files touched across
Tasks 1–9.

**New:** `src/features/components/portal/motion.tsx` (+ test),
`src/features/components/portal/status-stepper.tsx` (+ test),
`docs/adr/0015-page-header-ownership-and-portal-motion.md`,
`docs/superpowers/specs/2026-07-31-phase-8b-ui-coherence-motion-design.md`,
`docs/superpowers/plans/2026-07-31-phase-8b-ui-coherence-motion.md`.

**Modified — chrome and primitives:**
`src/features/components/pages/portal-module-page.tsx` (+ test, dedupe
header), `src/features/components/portal/workspace-page.tsx` (h2→h1,
eyebrow), `src/features/components/ui/card.tsx` (+ test, default level 3→2),
`src/features/components/portal/async-boundary.tsx` (Empty state),
`src/features/components/portal/data-table.tsx` (+ test, `emptyMessage`,
mobile-card heading fix), `src/features/components/ui/select.tsx`
(transition-colors), `src/app/globals.css` (new tokens, card hover,
`.portal-workspace-highlight`, `.portal-module-page--connected`, dead-CSS
removal), `src/tests/setup.tsx` (`matchMedia` stub).

**Modified — all 19 workspaces** (raw `<select>`/`<input>` → `Select`/`Input`
where present; `lastUpdated` wiring; `CardTitle` level shifts):
`admission-provisioning`, `audit-logs`, `curriculum` (+ `prerequisite-editor`),
`eligible-subjects` (+ `StaggerList`), `enrollment` (full rebuild, Task 5),
`faculty-assignment`, `faculty-input`, `grade-submission`, `class-rosters`,
`master-schedule`, `teaching-schedule`, `sections`, `schedule-proposals`
(+ raw `<h3>`→`<h2>` fix), `schedule-decision`, `student-queue-payment`
(StatusStepper promotion), `student-grades-com`, `accounting-payment`,
`registrar-enrollment`, `registrar-records` — each `.test.tsx` updated
alongside its workspace.

**Modified — dead-class removal only:**
`src/features/components/pages/landing-page.tsx` (removed `landing-shell`),
`src/features/components/pages/portal-overview-page.tsx` (removed
`portal-module-section`).

**Modified — package:** `frontend/package.json`/`package-lock.json`
(+`motion`).

## Files Changed — Phase 8a

No migrations, no backend files — frontend-only.

**New:** `src/features/lib/api-error-presentation.ts`,
`src/features/components/portal/{workspace-page,async-boundary,data-table,
paginator,status-region}.tsx` (+ each `.test.tsx`),
`src/features/components/common/breadcrumb.tsx` (+ test),
`src/features/components/ui/textarea.tsx` (+ test),
`src/features/lib/grade-presentation.ts`,
`src/tests/vitest-axe.d.ts`, `docs/adr/0014-presentation-layer-state-contract.md`.

**Modified — error contract and auth:** `src/features/services/api-client.ts`
(`retryAfterSeconds`, `readRetryAfterSeconds`); `src/features/lib/
query-client.ts` (`shouldRetryQuery` replaces blanket `retry: 1`);
`src/features/auth/{auth-types,api-auth-gateway,auth-context}.ts(x)`
(`clearSession()`, `AuthProvider` now owns the 401 handler);
`src/app/providers.tsx` (401 handler moved out); `src/features/lib/
api-form-errors.ts` (`setFocus` wiring); `src/features/components/common/
public-api-readiness.tsx` (adopts the shared `getStatePresentation`).

**Modified — primitives:** `src/features/components/ui/{card,field,
skeleton,alert}.tsx`.

**Modified — portal shell:** `src/app/globals.css`, `src/features/
components/layouts/portal-shell.tsx`, `src/features/components/pages/
portal-module-page.tsx`.

**Modified — all 19 workspaces migrated:** every
`src/features/components/portal/*-workspace.tsx` and its `.test.tsx`
(class-rosters, grade-submission, registrar-records, audit-logs,
master-schedule, eligible-subjects, student-queue-payment,
student-grades-com, schedule-decision, schedule-proposals, sections,
faculty-assignment, enrollment, registrar-enrollment, curriculum,
faculty-input, accounting-payment, admission-provisioning,
teaching-schedule); `src/features/components/pages/portal-module-page.test.tsx`
and `src/features/portal/module-registry.test.tsx` (region-name
expectations updated for each migration).

**Tooling:** `frontend/package.json` (+`eslint-plugin-jsx-a11y`,
`vitest-axe`, 2 new `overrides` entries), `frontend/eslint.config.js`
(+`jsxA11y.flatConfigs.recommended`), `src/tests/setup.tsx` (`vitest-axe`
matcher + jsdom Pointer Events polyfill for Radix `Select`).

**Docs:** `docs/runbooks/mariadb-local.md` (new "server will not start"
section, unrelated infra fix at the start of this session — see *Commands
and Tests Run — Phase 8a*); `docs/adr/0014-presentation-layer-state-contract.md`
(new); `PROGRESS.md` (this reconciliation).

## Files Changed — Phase 7a

No new migrations — all 6 tables this phase built an API for
(`enrollments`, `academic_grades`, `queue_tickets`, `payments`,
`enrollment_documents`, plus `enrollment_subjects` embedded read-only) were
already schema-only since an earlier foundation phase.

**Backend, domain:** `app/Domain/Audit/AuditAction.php` (+7 actions:
`enrollment.registrar_approved`/`registrar_rejected`/`voided`/
`payment_confirmed`, `academic_grade.created`/`submitted`/`locked`,
`queue_ticket.serving_started`/`served`), `AuditableType.php` (+
`academic_grade`, `queue_ticket`); `app/Domain/Notifications/NotificationType.php`
(+4: `enrollment_registrar_approved`/`registrar_rejected`/`voided`,
`academic_grade_locked`, `enrollment_payment_confirmed`).

**Backend, API — 8 new routes across 4 new + 1 extended controller:**
`Actions/Enrollment/{ListEnrollments,TransitionEnrollment,ConfirmPayment,
ListEnrollmentDocuments,ListQueueTickets,TransitionQueueTicket}.php`,
`Actions/Academic/{ListAcademicGrades,RecordAcademicGrade,
UpdateAcademicGrade}.php` (all new); `Http/Controllers/Api/V1/
{EnrollmentController.php (extended), AcademicGradeController.php,
EnrollmentDocumentController.php, QueueTicketController.php}` (new);
`Http/Requests/Api/V1/{Enrollment,AcademicGrade,EnrollmentDocument,
QueueTicket}/` (8 new Form Requests); `Http/Resources/Api/V1/
{EnrollmentResource.php (extended), AcademicGradeResource.php,
EnrollmentDocumentResource.php, PaymentConfirmationResource.php,
QueueTicketResource.php}`; `Models/{Enrollment.php, EnrollmentDocument.php}`
(new `scopeVisibleTo`), `Models/AcademicGrade.php` (new `scopeVisibleTo`);
`Policies/{EnrollmentPolicy.php (extended), AcademicGradePolicy.php,
EnrollmentDocumentPolicy.php, QueueTicketPolicy.php}`; `routes/api.php`
(8 new routes: `PATCH /enrollments/{id}`, `POST /enrollments/{id}/payment`,
`GET /enrollment-documents`, `GET`/`POST`/`PATCH /academic-grades[/{id}]`,
`GET`/`PATCH /queue-tickets[/{id}]`).

**Frontend:** `src/features/schemas/{academic-grade,queue-ticket,
enrollment-document}-schema.ts` (new), `enrollment-schema.ts` (paginated
envelope, `student_id`/`student_number`, registrar-decision/
payment-confirmation inputs); `services/{academic-grade,queue-ticket,
enrollment-document}-service.ts` (new), `enrollment-service.ts` (extended:
`listEnrollments`, `updateEnrollment`, `confirmPayment`);
`hooks/{use-academic-grades,use-queue-tickets,use-enrollment-documents}.ts`
(new), `use-enrollment.ts` (extended: `useEnrollmentsListQuery`,
`useUpdateEnrollmentMutation`, `useConfirmPaymentMutation`);
`components/portal/{registrar-enrollment,accounting-payment,
student-queue-payment,student-grades-com}-workspace.tsx` (new, 4 files
serving 8 registry entries); `portal/module-registry.tsx` (15 → 23
`connectedModuleIds`), `portal/role-capabilities.ts` (8 placeholder
descriptions de-"preview"-ified).

**Docs:** `docs/api/openapi.yaml` (8 new paths, 2 new tags — `Academic
Records`, `Payments` — and ~15 new schemas); `docs/data-dictionary/
enrollment-records.md` (scope note + per-table **API** notes updated
rather than duplicated into a new file); `PROGRESS.md` (this
reconciliation).

## Files Changed — Phase 7b

No new migrations — both tables this phase built an API for
(`transferee_credits`, `withdrawal_requests`) were already schema-only
since the earlier foundation phase; `enrollment_subjects` gained its first
dedicated read route but no schema change.

**Backend, domain:** `config/enrollment.php` (+`withdrawal.releases_seats`
flag, default `true`, env `ENROLLMENT_WITHDRAWAL_RELEASES_SEATS`);
`app/Domain/Audit/AuditAction.php` (+7: `withdrawal_request.created`/
`approved`/`rejected`, `transferee_credit.created`/`updated`/`approved`/
`rejected`), `AuditableType.php` (+`withdrawal_request`,
`transferee_credit`); `app/Domain/Notifications/NotificationType.php`
(+4: `withdrawal_request_approved`/`rejected`,
`transferee_credit_approved`/`rejected`).

**Backend, API — 7 new routes across 2 new + 1 extended controller:**
`Actions/Enrollment/{RequestWithdrawal,ListWithdrawalRequests,
TransitionWithdrawalRequest,ListClassRoster}.php`,
`Actions/Academic/{CreateTransfereeCredit,ListTransfereeCredits,
UpdateTransfereeCredit}.php` (all new); `Http/Controllers/Api/V1/
{EnrollmentController.php (extended: `withdraw`),
WithdrawalRequestController.php, TransfereeCreditController.php,
ClassRosterController.php}` (3 new); `Http/Requests/Api/V1/
{WithdrawalRequest,TransfereeCredit,ClassRoster}/` (7 new Form Requests);
`Http/Resources/Api/V1/{WithdrawalRequestResource.php,
TransfereeCreditResource.php, ClassRosterEntryResource.php}` (new);
`Models/{WithdrawalRequest.php, TransfereeCredit.php,
EnrollmentSubject.php}` (new `scopeVisibleTo`), `Models/AcademicGrade.php`
+`EnrollmentDocument.php` (widened `scopeVisibleTo` to include Registrar
Staff); `Policies/{WithdrawalRequestPolicy.php, TransfereeCreditPolicy.php,
EnrollmentSubjectPolicy.php}` (new), `Policies/{EnrollmentPolicy.php
(+`withdraw`), AcademicGradePolicy.php, EnrollmentDocumentPolicy.php}`
(widened `viewAny`); `routes/api.php` (7 new routes: `POST
/enrollments/{enrollment}/withdraw`, `GET`/`PATCH
/withdrawal-requests[/{id}]`, `GET`/`POST`/`PATCH
/transferee-credits[/{id}]`, `GET /class-rosters`).

**Frontend:** `src/features/schemas/{withdrawal-request,
transferee-credit,class-roster}-schema.ts` (new); `services/
{withdrawal-request,transferee-credit,class-roster}-service.ts` (new);
`hooks/{use-withdrawal-requests,use-transferee-credits,
use-class-roster}.ts` (new); `components/portal/{registrar-records,
class-rosters,grade-submission}-workspace.tsx` (new, 3 files serving 6
registry entries); `portal/module-registry.tsx` (23 → 29
`connectedModuleIds`), `portal/role-capabilities.ts` (6 placeholder
descriptions de-"preview"-ified); `portal/module-registry.test.tsx` +
`components/pages/portal-module-page.test.tsx` (both boundary tests
updated for the 6 new modules and their 3 region names).

**Docs:** `docs/api/openapi.yaml` (7 new paths, 3 new tags —
`Withdrawals`, `Transferee Credits`, `Class Rosters` — ~15 new schemas,
and the `audit-logs` filter enums brought current); `docs/data-dictionary/
enrollment-records.md` (both remaining "API: none yet" notes replaced,
`enrollment_subjects`/`academic_grades`/`enrollment_documents` API notes
updated for the new/widened access); `PROGRESS.md` (this reconciliation).

## Commands and Tests Run — Phase 7a

| Command | Result |
|---|---|
| `php artisan test` | **605 passed / 2,284 assertions**, ~35–55s (run after every task) |
| `vendor\bin\phpstan analyse --memory-limit=1G --no-progress` | No errors (level 8), run after every task |
| `vendor\bin\pint --test` | passed, run after every task |
| `composer audit --locked` | No security vulnerability advisories found |
| `npx @redocly/cli lint docs/api/openapi.yaml` | valid, no warnings, run after every task |
| `npx vitest run --no-file-parallelism` | **48 files / 243 tests passed** |
| `npx tsc --noEmit` | passed |
| `npx eslint . --max-warnings=0` | passed (2 real `@typescript-eslint/no-base-to-string` violations in new test files' ad-hoc URL-stringification helpers fixed by reusing the existing `url()` helper pattern) |
| `npx prettier --check .` | passed after one auto-fix pass over 7 files |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npx next build` (Turbopack) | compiled successfully, 5 routes |
| **Real dev DB:** `php artisan migrate:status --database=mariadb_migrator` | **zero pending migrations** — confirmed before the live proof, exactly as predicted (Phase 7a adds no new tables) |
| **Live HTTP, real dev DB:** submitted a fresh enrollment as `proof.student1@grc.test` (`POST /enrollments`, section 1/term 2) | **201**, enrollment #10 created `pending_registrar_approval` with a fresh queue ticket `Q000010` |
| **Live HTTP, real dev DB:** `faculty.seed@grc.test` encodes + submits a grade (`POST`, then `PATCH action=submit /academic-grades`) | grade #4 created `draft` → `submitted` for the same student/subject/section/term |
| **Live HTTP, real dev DB:** `registrar-head.seed@grc.test` approves the enrollment and locks the grade (`PATCH action=registrar_approve /enrollments/10`, `PATCH action=lock /academic-grades/4`) | enrollment → `pending_payment`; grade → `locked` |
| **Live HTTP, real dev DB:** same Registrar Head rejects a second seeded enrollment and voids a third (`PATCH action=registrar_reject /enrollments/9`, `PATCH action=void /enrollments/7`, both with a reason) | both **200**, → `rejected` / `cancelled` respectively — both other Task 2 actions proven live |
| **Live HTTP, real dev DB:** `accounting.seed@grc.test` serves then completes the queue ticket (`PATCH action=serve`, `PATCH action=complete` on `/queue-tickets/4`) | `waiting` → `serving` → `served` |
| **Live HTTP, real dev DB:** Accounting confirms payment (`POST /enrollments/10/payment`, `external_reference: "OR-000123"`) | **201**, enrollment → `enrolled`, Digital COM `COM000010` generated |
| **Live HTTP, real dev DB:** repeat the identical `POST` with a *different, contradictory* `external_reference` | **200** (not 201) — returned the **original** `OR-000123`/`COM000010` unchanged; direct SQL confirmed exactly 1 row in both `payments` and `enrollment_documents` for enrollment 10 — FR-FIN-009 idempotency proven live |
| **Live HTTP, real dev DB:** `proof.student1` reads `GET /enrollments`, `/academic-grades`, `/enrollment-documents` | all three reflect the final state: `enrolled` + served ticket, `locked` grade, COM present |
| **Live HTTP, real dev DB:** Registrar Head still sees enrollment 10 (now `enrolled`); Accounting Staff's `pending_payment`-scoped list no longer does | both confirmed — visibility boundaries hold after a status transition |
| **Direct SQL, real dev DB:** audit trail for enrollment 10 | 3 rows in order: `enrollment.submitted` → `enrollment.registrar_approved` → `enrollment.payment_confirmed` |
| **Direct SQL, real dev DB:** audit trail for grade 4 | 3 rows in order: `academic_grade.created` → `submitted` → `locked` |
| **Direct SQL, real dev DB:** notifications for `proof.student1` | 4 rows in order: enrollment submitted, registrar approved, grade locked, payment confirmed |

## Commands and Tests Run — Phase 7b

| Command | Result |
|---|---|
| `php artisan test` | **641 passed / 2,419 assertions**, ~40–45s (run after every task) |
| `vendor\bin\phpstan analyse --memory-limit=512M` | No errors (level 8), run after every task |
| `vendor\bin\pint --test` | passed, run after every task (one auto-fix pass on first run, over 3 files) |
| `composer audit --locked` | No security vulnerability advisories found |
| `npx --yes @redocly/cli@latest lint docs/api/openapi.yaml` | valid, no warnings |
| `npx vitest run --no-file-parallelism` | **48 files / 243 tests passed** |
| `npx tsc --noEmit` | passed |
| `npx eslint . --max-warnings=0` | passed (2 real violations fixed during development: a duplicate-union-type-constituent and a missed optional-chain) |
| `npx prettier --check .` | passed after one auto-fix pass over 6 new files |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npx next build` (Turbopack) | compiled successfully, 5 routes |
| **Real dev DB:** `php artisan migrate:status --database=mariadb_migrator` | **zero pending migrations** — confirmed before the live proof, exactly as predicted (no new tables this phase) |
| **Live HTTP, real dev DB:** submitted a fresh enrollment as `proof.withdraw@grc.test` (`POST /enrollments`, section 1/term 2) | **201**, enrollment #11 created `pending_registrar_approval` |
| **Live HTTP, real dev DB:** `registrar-head.seed@grc.test` approves, `accounting.seed@grc.test` confirms payment | enrollment #11 → `pending_payment` → `enrolled`; section 1 `enrolled_count` at 4 |
| **Live HTTP, real dev DB:** `proof.withdraw@grc.test` requests withdrawal (`POST /enrollments/11/withdraw`, reason required) | **201**, withdrawal request #2 created `pending` |
| **Live HTTP, real dev DB:** `registrar-staff.seed@grc.test` approves the request (`PATCH action=approve /withdrawal-requests/2`) | **200** → `approved`; enrollment #11 → `withdrawn`, `active_academic_term_id` → `null`; its `enrollment_subjects` row → `dropped`; section 1 `enrolled_count` **4 → 3** |
| **Live HTTP, real dev DB:** repeat the identical approve call | **422** ("requires ... pending; it is currently 'approved'"); section 1 `enrolled_count` confirmed still **3** — FR-FIN-004/§5.3 idempotency proven live, not just by test |
| **Live HTTP, real dev DB:** `registrar-staff.seed@grc.test` records a transferee credit for the same student mapped to `CS102` (the exact prerequisite `CS201` requires), then approves it | **201** then **200** → `approved` |
| **Live HTTP, real dev DB:** `proof.withdraw@grc.test` reads `GET /eligible-subjects` for `CS201` before and after the credit's approval | **unchanged** both times — still ineligible, same "prerequisite not yet completed" reason — proving `BuildEligibleSubjectPool` never reads `transferee_credits`, live not just by test |
| **Live HTTP, real dev DB:** `faculty.seed@grc.test` reads `GET /class-rosters?section_id=1` | returned all 4 roster rows for the section, including the just-withdrawn student correctly shown `dropped` |
| **Live HTTP, real dev DB:** `registrar-staff.seed@grc.test` reads `GET /academic-grades` and `GET /enrollment-documents` (Task 3 widening) | both returned real rows (4 and 3 respectively) — the widened read access works live |

## Commands and Tests Run — Phase 8a

A XAMPP/MariaDB startup failure (Aria checkpoint/recovery corruption in the
`mysql` system schema, unrelated to any application table) was fixed at the
start of this session, before any Phase 8a work — see
`docs/runbooks/mariadb-local.md`'s "Server will not start" section for the
root cause and fix. All commands below ran against the repaired database.

| Command | Result |
|---|---|
| `npm run format:check` | 3 files needed formatting (files this session touched); fixed with `prettier --write` on those 3, then re-checked clean |
| `npm run lint` (`eslint . --max-warnings=0`, includes jsx-a11y) | passed, 0 warnings |
| `npm run lint:fast` (oxlint) | passed, exit 0; 1 pre-existing warning (`field.tsx`'s `useFieldError` export alongside a component — a Fast Refresh advisory, not an error, unrelated to this phase's changes) |
| `npm run typecheck` | passed |
| `npm test` (`vitest run`, default multi-worker pool — no `--no-file-parallelism` needed this run) | **65 files / 354 tests passed** (up from 48 files/243 tests at the end of Phase 7b — +17 files, +111 tests); the 26-file `components/portal/` subset was also independently re-run with `--no-file-parallelism` after each fix during development, per the Known Issues caution below |
| `npm run build` (Turbopack) | compiled successfully, same 5 routes |
| `npm audit --audit-level=moderate` | 0 vulnerabilities |
| `composer test` (backend, no-regression check — this phase touched no backend file) | **641 passed / 2,419 assertions**, unchanged from Phase 7b |
| **Live HTTP, real dev DB:** `student.seed@grc.test` reads `GET /transferee-credits` | **200**, empty list — this endpoint is broadly readable and scope-filtered, not role-gated, so it does not itself produce a 403 |
| **Live HTTP, real dev DB:** same student reads `GET /class-rosters` (Faculty/Registrar-only) | **403** `{"error":{"code":"FORBIDDEN","message":"You are not authorized to perform this action."}}` — a genuine cross-role denial, matching `getStatePresentation`'s 403 branch exactly |
| **Live HTTP, real dev DB:** `registrar-head.seed@grc.test` sends `PATCH /enrollments/999999999` (nonexistent id) | **404** `{"error":{"code":"NOT_FOUND","message":"The requested resource was not found."}}` — route-model binding's automatic 404, matching the 404 branch exactly |
| **Live HTTP, real dev DB:** 32 rapid login attempts with a bad password | first several **401**, then **429** with a real `Retry-After: 5` header and `X-RateLimit-*` headers — confirms `readRetryAfterSeconds` parses a real header, not just a test double |
| **Not run this session:** manual WCAG 2.1 AA pass (keyboard-only traversal, screen-reader spot check, 200% zoom, responsive breakpoints, reduced-motion) | Chrome browser extension was not connected — see *Known Issues* |

## Commands and Tests Run — Phase 8b

| Command | Result |
|---|---|
| `npm install motion` | clean install, 4 packages added, 0 vulnerabilities, no `overrides` needed |
| `npm run lint` (`eslint . --max-warnings=0`, includes jsx-a11y) | passed, 0 warnings — run repeatedly through the phase, not just at the end |
| `npm run typecheck` | passed |
| `npm test` (`vitest run`) | **67 files / 362 tests passed** (up from 65 files/354 tests at the end of Phase 8a — +2 files, +8 tests: `motion.test.tsx`, `status-stepper.test.tsx`, plus 2 new cases each in `data-table.test.tsx` and the `curriculum`/`schedule-proposals`/`sections`/`admission-provisioning` 403/404/429 coverage already present) |
| `npm run build` (Turbopack) | compiled successfully, same 5 routes |
| `npm audit --audit-level=moderate` | 0 vulnerabilities |
| `composer test` (backend, no-regression check — this phase touched no backend file) | **641 passed / 2,419 assertions**, unchanged from Phase 8a |
| **Not run this session:** live visual verification, manual WCAG 2.1 AA pass | Chrome browser extension was not connected — see *Known Issues*. Every structural fix (duplicate header, placeholder frame, centering, raw `<select>`) is confirmed at the DOM/test level via the rewritten `portal-module-page.test.tsx` and the per-workspace test suites, but nobody has visually confirmed the rendered result yet. |

**Re-confirmed at reconciliation (2026-07-31):** full gate re-run from a
clean state — `format:check` (found 11 files not yet reformatted after the
Task 9 edits; fixed with `prettier --write`, then re-verified clean),
`lint` (0 warnings), `typecheck` (clean), `vitest run --no-file-parallelism`
(67 files / 362 tests passed), `next build` (compiled successfully, same 5
routes), `npm audit --audit-level=moderate` (0 vulnerabilities), and
`composer test` (641 passed / 2,419 assertions, unchanged). All match the
table above exactly.

## Commands and Tests Run — Phase 8c

| Command | Result |
|---|---|
| `npm install` (in `e2e/`) | clean install, 8 packages, 0 vulnerabilities |
| `npx playwright install --with-deps chromium` | installed Chromium 151.0.7922.34 |
| `npm run reset-db` (`php artisan migrate:fresh --seed --env=testing --force`) | ran repeatedly through the phase; always clean |
| `npx playwright test` (full suite, `--workers=1`, freshly seeded DB) | **18 passed, 1 skipped (journey 14)** — 13 journeys + 5 accessibility checks, confirmed green together in one run at reconciliation, not just individually during development |
| `composer test` (backend, no-regression check for the 2 Resource-file fixes) | **641 passed / 2,419 assertions**, unchanged — confirmed both before and after the `CACHE_STORE`/date-format fixes |
| **Not run this session:** the new `e2e` GitHub Actions job | Per ADR 0012, a workflow is only proven by actually running on GitHub — needs a push. Locally verified: YAML parses (`python -c "import yaml..."`), and every step it runs was independently verified working (the exact `--env=testing` server start, `reset-db.mjs`, `npx playwright test`) during local development. |

Two real defects were found and fixed mid-development, each confirmed with
its own before/after check rather than assumed fixed:
- **Rate limiter silently inert over real HTTP** — `.env.testing`'s
  `CACHE_STORE=array`. Confirmed broken: 31 rapid login attempts against a
  running `--env=testing` server never returned 429. Fixed
  (`CACHE_STORE=file`); confirmed fixed: same 31-attempt journey now
  reliably returns 429 on attempt 31, and `composer test` re-run afterward
  still 641/641 (phpunit.xml's own `CACHE_STORE=array` override is
  unaffected).
- **Date-serialization contract break** — 7 of 11 Resources used
  `->toIso8601String()` against Zod schemas expecting the `Z`-suffixed
  form. Confirmed broken: `GET /api/v1/enrollments` as Registrar Head
  rendered "Unexpected API response" the moment a real row had a non-null
  timestamp. Fixed (aligned all 7 to the existing `->utc()->format(...)`
  convention already correct in 4 other Resources); confirmed fixed: the
  same live request now parses cleanly, and `composer test` re-run
  afterward still 641/641 (no test encoded the old format as expected).

## Commands and Tests Run — Phase 7c

| Command | Result |
|---|---|
| `composer format:check` (Pint) | clean |
| `composer analyse` (Larastan level 8) | **0 errors** |
| `composer test` | **656 passed / 2,513 assertions** (up from 641 baseline) |
| `composer audit` | clean |
| `npx prettier --check .` (frontend) | clean (4 files auto-fixed with `--write` mid-development) |
| `npx eslint . --max-warnings=0` | clean |
| `npx oxlint` (lint:fast) | 1 pre-existing warning, unrelated file (`ui/field.tsx`), exit code 0 |
| `npx tsc --noEmit` (frontend) | clean |
| `npx vitest run --no-file-parallelism` | **376 passed** (up from 362 baseline), 71 files |
| `npx next build` (Turbopack) | compiled successfully, same 5 routes |
| `npm audit --audit-level=moderate` (frontend) | 0 vulnerabilities |
| `npm run reset-db` (e2e) | ran repeatedly through the phase; always clean |
| `npx playwright test` (full suite, `--workers=1`, freshly seeded DB) | **20 passed, 1 skipped (journey 14)** — 15 journeys + 5 accessibility checks, confirmed green together in one run at reconciliation |
| `CI=true npx playwright test` (2 workers, freshly seeded DB) | 7 failed — but across journeys 6, 7, 8, 9, 4/5, **and** 16/17, confirming a pre-existing PHP-built-in-server concurrency limitation unrelated to Phase 7c, not a regression; re-confirmed clean afterward with `--workers=1` |
| Live HTTP authorization-boundary proof (all 4 new routes × Student/Dean/ExecDir/RegistrarHead) | Student 403 on all 4; Dean 200 on `enrollment-summary`/`stuck-enrollments`, 403 on the other 2; ExecDir 200 on `enrollment-summary`/`institution-summary`, 403 on the other 2; RegistrarHead 200 on `policy-settings` only — matches the intended matrix exactly |
| No-student-identity-leak string scan (all 4 new payloads) | confirmed: no student name or email appears in any dashboard response, only `student_number` on `stuck-enrollments` |

One real, unprompted design refinement found via live-data inspection, not a
test failure: `stuck-students`' first implementation used
`Enrollment::scopeActive()`, which surfaced already-`Enrolled` students as
"stuck" candidates. Confirmed wrong by inspecting real dev-DB output; fixed
by scoping to `Draft`/`PendingRegistrarApproval`/`PendingPayment`
specifically; re-confirmed via the same live query.

## Technical Decisions

- **`void` is scoped to `pending_payment`, not any pre-`enrolled` state.**
  PRD §3.7 gives the Registrar Head "logged override or void actions for
  authorized edge cases" with no further definition. Rather than assert an
  unconfirmed scope, `void` covers exactly one checkpoint — cancelling an
  already-approved-but-unpaid enrollment — kept deliberately non-overlapping
  with `registrar_reject` (pre-approval) and the Phase 7b withdrawal flow
  (post-`enrolled`). Documented as a scope choice, not confirmed policy, in
  `EnrollmentPolicy::void`'s docblock.
- **`UpdateAcademicGradeRequest`/`UpdateAcademicGrade` serve three concerns
  on one PATCH route, one more than ADR 0011's usual two.** Every other
  ADR-0011 route (schedule proposals, enrollment decisions) is pure
  status-transition. Grades additionally need a plain content edit (Faculty
  correcting `final_grade`/`remarks` while still `draft`) that isn't a
  transition at all — mutual exclusivity is enforced by Zod's `union()` on
  the frontend and `prohibited_if` plus a `withValidator` check on the
  backend, so content fields and `action` are never accepted together.
- **Payment confirmation's idempotency check runs *before* the status
  check, not after.** A naive implementation would reject a repeat
  confirmation with "requires `pending_payment`; currently `enrolled`" —
  technically true but wrong, since FR-FIN-009 requires the repeat to
  succeed. `ConfirmPayment::execute` checks for an existing `Payment` row
  first and short-circuits to returning it, regardless of the current
  status; only a *first* call is checked against `pending_payment`. Proven
  live, not just by test: a second `POST` with a different, contradictory
  `external_reference` returned the original value unchanged.
- **Queue ticket transitions carry the coarse `role:accounting_staff`
  route middleware; every other Phase 7a write does not.** `Enrollment`/
  `AcademicGrade` transitions split across multiple roles per action
  (ADR 0011's reason for existing), but `serve`/`complete` are both
  Accounting-only with no per-ticket ownership dimension — the same shape
  `role:registrar_head` already uses for `audit-logs.index`. Using ADR
  0011's per-action-ability machinery here would be complexity without a
  role split to justify it.
- **No PDF pipeline for the Digital COM.** §17 leaves format, numbering,
  signatures, and retention unconfirmed. `document_number` is an opaque
  deterministic string (`COM%06d`, the same choice already made for
  `Q%06d` queue tickets) and `storage_path` stays `null`. FR-FIN-010's
  "view and print/download" is served by returning structured data that
  `StudentGradesComWorkspace` renders with a `window.print()` affordance —
  inventing a generator would assert a document format GRC hasn't approved.
- **`getEnrollments`/`useEnrollmentsQuery` keep returning a flat array;
  `listEnrollments`/`useEnrollmentsListQuery` is a new, separate pair for
  the paginated role-scoped view.** The backend response for
  `GET /enrollments` became a paginated envelope in Task 1, but the
  existing Student `EnrollmentWorkspace` (Phase 6) only ever needs its own
  handful of enrollments — no pagination UI is worth building for that. The
  service function absorbs the shape change internally (unwraps `.data`)
  rather than pushing it onto every existing caller.
- **`docs/data-dictionary/enrollment-records.md` was updated, not
  duplicated.** The plan anticipated a new data-dictionary page for
  Process 3.0, but all 6 tables this phase gave an API to were already
  fully documented there as schema-only groundwork from an earlier phase.
  Updating that page's stale "no Policy/Resource/Controller exists yet"
  scope note and adding an **API** line per table is more accurate and
  avoids duplicating schema documentation across two files.
- **Recompute Row 5 (Process 3.0 backend) from 15% to 70%, and Row 8 (nine
  role portals) from 38% to 58%.** Row 5: 4 of Process 3.0's 5 subprocesses
  are now complete (3.1 grade encoding, 3.3 final approval, 3.4 payment
  queue, 3.5 payment confirmation + COM); only 3.2 (transferee
  credits/withdrawal) remains, deferred to Phase 7b. Row 8: 23/40 modules
  now connected (57.5%, rounded to 58%). Contributions: Row 5 12% × 70% =
  8.40 (was 1.80); Row 8 25% × 58% = 14.50 (was 9.50). Overall: 55.00 +
  6.60 + 5.00 = 66.60 ≈ **67%**. No other row's weight or Done% changed.
- **Merge to local `main`, then push to `origin`.** Unlike every prior
  session, the user explicitly authorized the push at the start of this
  one ("yes proceed to pushed to origin") — this is not a scope
  extrapolation from a general merge authorization.

### Phase 7b

- **Chaining `withToken()` for two different actors within one Sanctum
  feature test silently reuses the first actor's cached guard resolution.**
  Discovered while debugging 5 failing `WithdrawalRequestsEndpointTest`
  cases: a Registrar Staff `PATCH` was denied 403 even though
  `WithdrawalRequestPolicy::decide()` correctly returned `true` for that
  role — a `fwrite(STDERR, ...)` diagnostic inside the Policy method
  revealed the authenticated user was still the *student* from an earlier
  request in the same test. This is the same gotcha
  `EnrollmentsEndpointTest.php` already documents (`makeEnrollment()`'s own
  docblock) but the new withdrawal tests hadn't yet applied: the fix is to
  seed the "other actor's" data directly via Eloquent
  (`makeWithdrawalRequest()`) rather than a second login+HTTP-submit, so
  every test method authenticates as exactly one actor.
- **Seat release is config-flagged; dropping the subject is not.**
  `config('enrollment.withdrawal.releases_seats')` (default `true`) gates
  only whether `Section.enrolled_count` decrements — because seats are
  reserved immediately and permanently on submission today, *not*
  releasing them would permanently inflate the count and wrongly block
  other students, but whether that's the confirmed institutional policy is
  still §17-open. Marking `enrollment_subjects` rows `dropped` happens
  unconditionally regardless of the flag, since that fact is simply
  correct once a withdrawal is approved. Idempotency (no double
  decrement) is enforced the same way regardless of the flag's value —
  under a row lock in the Action, re-checking both the request's own
  status and the enrollment's status before touching either.
- **Transferee credits never feed `BuildEligibleSubjectPool` — confirmed
  live, not just asserted.** Cross-institution grade equivalence is an
  open PRD §17 decision; a foreign "1.50" must not silently unlock a local
  subject's prerequisite. The Action, the model's `scopeVisibleTo`
  docblock, and the OpenAPI tag description all say so, and the live
  proof exercised it end-to-end (approved credit, unchanged
  `eligible-subjects` verdict) rather than trusting the code comment
  alone.
- **`RegistrarRecordsWorkspace` renders only the module matching
  `initialModuleId`, unlike every other multi-module workspace in this
  codebase.** `AccountingPaymentWorkspace`/`AdmissionProvisioningWorkspace`
  always render every card regardless of which link was clicked, because
  their modules are sequential steps of one flow (queue → serve → confirm
  → COM; account → outcome → handoff). Registrar Staff's four modules
  (Credit Mappings, Drops & Withdrawals, Academic Records, Enrollment
  Documents) are unrelated record types, not steps — showing all four at
  once on every visit would cram four unrelated tables onto one screen.
  Every query hook is still called unconditionally per the Rules of
  Hooks; only the three inactive ones are `enabled: false`.
- **`GradeSubmissionWorkspace` reuses the new class-roster read to
  populate its per-section student list, instead of a student-search
  UI.** No student-directory endpoint exists anywhere in this API (only
  `POST /student-profiles` and the caller's own `GET /student-profile`),
  so a from-scratch student picker would need new backend work the plan
  didn't scope. The class roster already returns exactly the (student_id,
  student_number) pairs needed for a section, and Faculty already reads
  it for the Class Rosters module — reusing it here avoids inventing a
  parallel lookup.
- **Recompute Row 5 (Process 3.0 backend) from 70% to 95%, and Row 8
  (nine role portals) from 58% to 73%.** Row 5: all 5 of Process 3.0's
  subprocesses are now complete except the tail that forwards attrition
  events to Process 4.0, which stays Phase 9 by design (ML goes last).
  Row 8: 29/40 modules now connected (72.5%, rounded to 73%).
  Contributions: Row 5 12% × 95% = 11.40 (was 8.40); Row 8 25% × 73% =
  18.25 (was 14.50). Overall: 66.60 − 8.40 − 14.50 + 11.40 + 18.25 =
  73.35 ≈ **73%**. No other row's weight or Done% changed.
- **Merge to local `main`.** This background session worked directly on
  `main` throughout (no per-phase worktree, per this session's own
  instructions), so "merge" is a clean-state confirmation, not an actual
  branch merge. **Correction (2026-07-30, next session):** the line below
  originally said push to `origin` was still deferred — that was stale by
  the time it was read; `main` was already pushed and `main == origin/main`
  at `d206574` when the next session started.

### Phase 8a

- **Query errors route through `AsyncBoundary`/`getStatePresentation`;
  mutation errors keep hand-written, state-preserving `Alert` blocks.** See
  ADR 0014 for the full reasoning. This is a genuine two-tier split, not a
  partial migration — mutation failures in `enrollment-workspace.tsx`,
  `registrar-enrollment-workspace.tsx`, and `registrar-records-workspace.tsx`
  render one generic message regardless of status (they do not yet
  distinguish a 409 mutation conflict from a 5xx), because the alternative
  (routing them through `AsyncBoundary`) would blank out the form the user
  was mid-editing. Wiring `getStatePresentation` into those `catch` blocks
  while preserving local state is additive future work, not a defect in
  this slice.
- **19-workspace migration surfaced its own recurring fix patterns, applied
  consistently rather than case-by-case.** `WorkspacePage`'s region
  accessible name is its title text with no "workspace" suffix, differing
  from the old hardcoded `aria-label="X workspace"` strings — this
  intentionally makes the accessible name match what a screen reader
  actually announces, but it meant `portal-module-page.test.tsx` and
  `module-registry.test.tsx`'s expectation maps needed updating after every
  one of the 19 migrations (legitimate test maintenance following a
  deliberate UX improvement, not test rot). `DataTable` always renders both
  a desktop table and a mobile card list simultaneously in jsdom (no real
  CSS media queries), so several tests needed `within(table)` scoping to
  avoid duplicate-match failures. `AsyncBoundary`'s real error copy ("Try
  again" + the server's message) replaced several tests' old hardcoded
  strings ("Retry X data").
- **`TeachingScheduleWorkspace`'s `DataTable level={4}` heading-order fix
  was verified not to be needed anywhere else.** Every other `DataTable`
  consumer wraps its table in its own `Card`, so `DataTable`'s internal
  default (`level={4}`, auto-carded) lands correctly one level below that
  `Card`'s own `h3`. `TeachingScheduleWorkspace` is the only workspace
  whose `DataTable` sits directly under `WorkspacePage`'s `h2` with no
  intervening `Card`, confirmed by code review across all 19 workspaces
  before scoping the fix to this one file.
- **No production code path currently raises a real 409.** Confirmed by
  grep — `ApiExceptionRenderer` maps 409 generically for any
  `ConflictHttpException`, but nothing in `app/` throws one; every
  business rule that could conflict (e.g., a repeat withdrawal approval)
  currently returns 422 instead. The frontend's 409 handling is
  forward-looking infrastructure matching PRD §12.4's named state, proven
  correct via a real HTTP envelope in `enrollment-workspace.test.tsx`, not
  yet provable against a live backend endpoint. A future slice that adds a
  genuine optimistic-concurrency check (e.g., rejecting a stale-state
  approval) would be the first real backend consumer of this path.

### Phase 8b

- **Two different fixes for the same-looking problem — see ADR 0015 for the
  full mechanism.** Migrating "auto-select the active academic term" fields
  from native `register()` onto `Controller`-wrapped `Select` broke the
  auto-selection in `schedule-proposals-workspace.tsx` and
  `sections-workspace.tsx` (fixed with a `key`-remounted `Controller` owning
  its own `defaultValue`, and removing the field from the form's top-level
  `defaultValues`) but the identical-looking fix *broke* the same behavior in
  `faculty-input-workspace.tsx` (fixed instead by restoring the classic
  `useEffect` + `setValue()` pattern). The difference: whether the
  `Controller` mounts for the first time before or after the async data is
  known (gated behind `AsyncBoundary`, or not). Confirmed by debug tracing,
  not guessed — an earlier attempt at the wrong fix for each case was tried,
  observed to fail, and reverted before landing the correct one.
- **This was a real, previously undetected bug**, not a side effect of the
  migration. The old tests only asserted that a matching `<option>` existed
  in the DOM — trivially true for a native `<select>` regardless of which
  option is actually selected — never that the *right* one was selected.
  The new `Controller`-based tests assert the displayed value, and caught it.
- **`AsyncBoundary`'s state transitions stay un-animated by design.** An
  early implementation wrapped every loading/error/empty/success transition
  in `AnimatePresence`; this broke a synchronous test assertion in
  `audit-logs-workspace.test.tsx` because a refetch (filter change) now had
  to wait for a real exit animation before new content mounted.
  `AsyncBoundary` backs ~26 query sites across 19 workspaces, too broad a
  surface for one shared crossfade tuning — reverted, and `FadePresence`
  stays available in `motion.tsx` for single-workspace uses instead.
- **`CardTitle`'s default heading level shifted 3→2**, since `WorkspacePage`'s
  own heading moved from `<h2>` to `<h1>` (Task 1's page-chrome fix removed
  the second, module-registry-sourced header that used to occupy the true
  `<h1>` role). Every explicit `level={3}`/`level={4}` override in the
  codebase — `class-rosters-workspace.tsx`'s nested roster-entry cards,
  `data-table.tsx`'s mobile-card fallback, and others — shifted down by one
  to keep matching, verified by re-running `vitest-axe`'s heading-order
  check across the full portal suite rather than by inspection alone. Three
  raw `<h3>` elements with no intervening heading (not using `CardTitle` at
  all) needed a matching manual fix: `curriculum-workspace.tsx`'s "Subject
  placements", `schedule-proposals-workspace.tsx`'s "Existing proposals",
  and `prerequisite-editor.tsx`'s "Prerequisites" all became `<h2>`.
- **Radix `Select`'s `value` prop must never toggle between `undefined` and
  a string** — doing so trips React's controlled/uncontrolled detection and,
  observed directly, silently breaks the placeholder from reappearing once a
  value is cleared. Fixed with a consistent `value={x ? String(x) : ""}`
  convention (empty string, Radix's own reserved "unselected" signal) in
  every `Select` this phase touched, including two from Phase 8a that
  carried the same latent pattern without ever having exercised it
  (`class-rosters-workspace.tsx`, `grade-submission-workspace.tsx`).
- **Motion is intentionally not applied to `<ul>`/`<li>` lists.**
  `StaggerItem` always renders a wrapping `<div>`, which is invalid between
  a `<ul>` and its `<li>` children. Several workspaces (schedule proposals'
  existing-proposals list, faculty input's saved-availability list) keep
  their semantic list markup and simply don't get the stagger treatment —
  a scope boundary recorded in ADR 0015, not an oversight.
- **`lastUpdated` deliberately not wired on `admission-provisioning-workspace.tsx`.**
  It's a pure create-form with a one-time credential receipt, not a
  browsable "your data" list — there's nothing there a staleness timestamp
  would meaningfully describe.
- **This session's `npm test` runs used the default multi-worker pool
  successfully, every time, with no flakiness observed** — contrary to the
  "Frontend full-suite parallel flakiness (this machine only)" note recorded
  below from an earlier phase. Not confident enough to say that issue is
  resolved (machine/environment conditions may simply have been favorable
  this session), so the earlier caution is left in place rather than
  removed, but recorded here as a data point.

### Phase 8c

- **`e2e/` is its own root-level npm package**, settled by the pre-existing
  `/e2e/node_modules/` `.gitignore` reservation rather than decided fresh —
  see ADR 0016 decision 1.
- **Run-scoped `migrate:fresh --seed`, not per-test reset** — one reset per
  suite run. `migrate:fresh` is DDL against a database dedicated to
  testing, not the `GRANT` statement shape documented to have crashed this
  MariaDB install; the two are not the same risk. ADR 0016 decision 2.
- **API-arranged preconditions must be genuinely self-contained, not just
  "check the seed, else fail."** Learned by hitting it directly: journeys 7
  and 8's first implementations assumed a specific seeded student would
  still be in the needed state, and both broke on a second local run once
  that state had already been consumed. Fixed by submitting a fresh
  enrollment from scratch when no usable existing state is found. ADR 0016
  decision 3.
- **Journey 12 (throttle) runs in its own isolated Playwright project.**
  `routes/api.php`'s login limiter is keyed per IP, not per credential —
  every worker shares one IP, so a tripped limiter would otherwise block
  every other journey's sign-in. ADR 0016 decision 4.
- **`CACHE_STORE=file`, not `array`, in `.env.testing`** — the rate limiter
  needs cache state that survives across PHP-CLI-server-per-request
  processes, which the array driver does not provide; PHPUnit is unaffected
  since `phpunit.xml` overrides the value directly. A `--env=e2e` file with
  its own `APP_ENV=e2e` value was tried first and abandoned — per-request
  child processes resolve their env file from the `APP_ENV` value, not the
  `--env` flag, so it would have needed every environment-restricted
  seeder's allowlist extended too. ADR 0016 decision 5.
- **Running `php artisan test` and the E2E suite back-to-back locally, in
  either order, requires re-seeding between them** — both resolve
  `DB_DATABASE=grc_enrollment_test` from `.env.testing`, and PHPUnit's
  initial migration reset wipes whatever the E2E seeding had put there.
  Does not affect CI, where the two run as fully independent jobs with
  independent database containers. ADR 0016 decision 5.
- **Two Resource-layer date-serialization bugs, fixed** (see *Commands and
  Tests Run — Phase 8c* for the before/after confirmation): 7 of 11
  date-serializing API Resources used `->toIso8601String()` (emits a
  `+00:00` offset) against frontend Zod schemas built for the `Z`-suffixed
  form already correct in 4 other Resources. This broke every workspace
  that rendered a real non-null timestamp, invisible to both PHPUnit
  (checks the backend against itself) and Vitest (mocked fixtures were
  hand-written to already satisfy the schema). The central justification
  for this phase existing at all — only a real frontend against a real
  backend exposes a seam like this. ADR 0016 decision 7.
- **One real UI gap found, documented, and deliberately not fixed**: no
  student-facing "Withdraw" button exists despite the mutation hook being
  fully implemented (journey 13 exercises the backend's idempotency guard
  over the API, verifying the outcome through the Registrar Staff UI that
  does exist). Wiring it is an application feature change, out of an
  E2E-foundation phase's scope — recorded for a future slice rather than
  silently patched. ADR 0016 decision 8. **A second claim recorded here at
  the time — that no module id reached `ScheduleDecisionWorkspace` for
  `executive_director` — was wrong, corrected in Phase 7c**: the Executive
  Director's approval controls were reachable the whole time via
  `master-schedule`. Tracing the actual miss further surfaced a real bug
  instead (the controls were gated behind the same empty-state boundary as
  the published-sections list, so with none published yet the Executive
  Director couldn't approve the first proposal) — fixed in Phase 7c.
- **Journey #14 skipped, #15 partial** — ml-service dormant (Phase 9
  boundary) and `compliance-reports` has no report content yet (Phase 7c,
  blocked on institutional content) respectively. ADR 0016 decision 9.

### Phase 7c

- **Aggregate-only endpoints, never row-level, for Dean and Executive
  Director.** `Enrollment::scopeVisibleTo`/`EnrollmentPolicy::viewAny()`
  currently exclude both roles entirely; widening them would hand both
  roles read access to every student's enrollment record, which PRD
  §3.6/§9.4 constrain against. The dashboards instead get their own
  `DB::table(...)` aggregation Actions returning counts, following
  `EligibleSubjectPolicy`'s "computed view, not a stored resource"
  precedent. `stuck-students` is the one PRD-authorized exception (§3.5),
  so it gets a separate, narrower endpoint with minimal fields only. See
  ADR 0017.
- **The first SQL-aggregation layer in this codebase, a third Action return
  shape.** Every prior Action returned a paginator or a single Eloquent
  model; the four new dashboard Actions return typed readonly value objects
  built from `selectRaw` conditional aggregation. Grouping is driven
  exclusively off `Enum::cases()`/`->value`, never string literals — most
  of the enums a dashboard would want to group by are marked "PROVISIONAL
  VOCABULARY" in their own docblocks, so keying UI off literals would
  silently break the moment GRC confirms real values. `EnrollmentStatus`
  and `GradeStatus` are the two PRD-authoritative exceptions actually used.
  See ADR 0017.
- **`stuck-students` scoped to `Draft`/`PendingRegistrarApproval`/
  `PendingPayment`, not `Enrollment::scopeActive()`.** The broader `active()`
  scope also includes `Enrolled`, which live-data inspection against the
  dev database showed was semantically wrong — an already-enrolled student
  has completed the process, not stalled in it. This is a row-selection
  refinement derived directly from the PRD-authoritative lifecycle order,
  not a new institutional definition; the dwell-time *threshold* stays
  separately gated behind `dashboard.stuck_threshold_days` (default
  `null`). Found live, not by a failing test.
- **`policy-settings` is read-only, backed by a hardcoded list of 11
  `PolicyValueState` entries, not a settings table.** Making it writable
  would require deciding which values are Registrar-editable at runtime —
  an unmade decision — and today every value is env-var-only. The endpoint
  reports each value's real `config('enrollment.*')` state
  (configured/provisional/unset) or, for the 5 values with no config key at
  all (e.g. `sections.viability_threshold`), a `no_mechanism` state with a
  `prd_reference` pointing at the open §17 question.
- **ADR 0016's decision 8 was factually wrong about one of its two claims,
  corrected here.** "No module id reaches `ScheduleDecisionWorkspace` for
  `executive_director`" was false — `MasterScheduleWorkspace` (already in
  that role's module list) embeds the same decision controls. Tracing the
  miss further, rather than accepting the first negative result, found the
  real defect: both cards on that page shared one `AsyncBoundary` gated on
  `published.length === 0`, hiding the approval controls whenever no
  section was yet published — exactly the state before the first approval.
  Fixed by splitting into two independent boundaries. The lesson recorded
  in ADR 0016's own "Consequences" section: when an E2E journey can't find
  something, the next step is tracing the component tree, not concluding
  the feature is unbuilt.
- **DataTable's dual desktop-table/mobile-card rendering needs
  `within(...)` scoping in tests.** jsdom does not evaluate the `md:hidden`
  media query that hides the mobile fallback, so both render simultaneously
  in every Vitest test — any text in a table cell also appears in its
  mobile-card twin, producing "Found multiple elements" failures unless
  queries are scoped via `within(screen.getByRole("table", { name:
  caption }))`. Also surfaced a real, separate accessibility bug in the two
  new DataTable consumers (`policy-settings-workspace.tsx`,
  `stuck-students-workspace.tsx`): both rendered `DataTable` directly under
  `WorkspacePage`'s `<h1>` with no intervening `<h2>`, so the mobile card's
  hardcoded `CardTitle level={3}` skipped a heading level. Fixed by wrapping
  each in the same `Card > CardHeader > CardTitle level={2}` shape every
  other `DataTable` consumer already uses.
- **E2E journeys 16/17 cannot assert which seeded student number appears in
  `stuck-students`.** Journeys 6, 7, and 8 each hunt for "any"
  matching-status enrollment across the shared seeded database and mutate
  whichever they find (their own header comments document this
  explicitly), and `playwright.config.ts` runs 2 workers in CI with
  `fullyParallel: true`, so file execution order is not guaranteed. Verified
  by running the full suite once serially (clean) and once with 2 workers
  (multiple pre-existing, unrelated journeys — 6, 7, 8, 9, and 4/5 — also
  failed, confirming this is a pre-existing PHP-built-in-server concurrency
  limitation, not a Phase 7c regression). The new journeys assert structure
  (row format, invariant notice text) instead of specific identities.

## Known Issues and Blockers

- **Frontend full-suite parallel flakiness (this machine only) — unchanged
  from prior phases.** `npm test` with Vitest's default multi-worker pool
  is unreliable under this machine's memory pressure; `npx vitest run
  --no-file-parallelism` is the trustworthy invocation and is what every
  frontend result recorded in this document used.
- No new blocking defect found in Phase 7b beyond the Sanctum
  multi-actor test gotcha (found and fixed — see Technical Decisions).
- **Phase 7c connected 4 of the 7 remaining modules; 3 stay placeholder,
  genuinely §17-blocked**: `compliance-reports` (all four of §17's
  dimensions — fields, format, naming, sign-off — are unconfirmed) and the
  shared `reports` id for both Dean and Executive Director (no field list,
  format, or export type enumerated anywhere in the PRD). `enrollment-
  dashboard`, `stuck-students`, `institution-dashboard`, and
  `policy-settings` are now connected — see *Verified Completed — Phase
  7c*. (`honors`, `kpis`, and `attrition-analytics` remain separately
  deferred to Phase 9 — they need trained ML output, not just a content
  decision.)
- **Transferee-credit equivalence rules and withdrawal seat-release
  policy** (this phase's two new §17 items) join queue-ticket
  numbering/reset and COM format on the still-unconfirmed list.
- **Phase 8a's manual WCAG 2.1 AA pass was deferred, and is now closed by
  Phase 8c's automated `@axe-core/playwright` coverage** — real-browser axe
  scans of the landing page, login page, portal overview, and Eligible
  Subjects (zero critical/serious violations), a 200%-zoom pass, and a
  `prefers-reduced-motion` pass confirming the motion library's JS-driven
  transforms are genuinely suppressed. A human keyboard-only/screen-reader
  spot check was still not performed and remains genuinely optional manual
  polish, not a blocking gap — the automated coverage is broad and now
  permanent (runs in CI on every push), not a one-off.
- **No production code path raises a real 409** (see Technical Decisions →
  Phase 8a). Not a defect — PRD §12.4 names the state and the frontend
  handles it correctly per the unit/integration tests — but it means the
  live-HTTP-proof convention this document otherwise follows couldn't
  cover 409 the way it covered 403/404/429.
- **Two-tier error presentation (query vs. mutation) is a known,
  documented asymmetry, not a partial migration** — see ADR 0014 and
  Technical Decisions → Phase 8a. A future slice may want to close this
  gap for `enrollment-workspace.tsx`, `registrar-enrollment-workspace.tsx`,
  and `registrar-records-workspace.tsx`'s mutation error messages.
- **Phase 8b's manual WCAG 2.1 AA pass and live visual verification were
  deferred, and are now closed by Phase 8c** — Playwright's real Chromium
  browser confirmed the structural fixes from the reporting screenshot
  (duplicate header, dashed placeholder frame, centered layout, bare native
  `<select>`) are genuinely gone: every journey navigates real connected
  workspaces and asserts on real rendered content, not mocked DOM.
- **No production code path raises a real 409** (unchanged from Phase 8a —
  see Technical Decisions → Phase 8a). Still true after Phase 8b and 8c;
  not a new gap.
- **One real UI gap found by Phase 8c, deliberately not fixed that
  session**: no student-facing "Withdraw" button exists despite the
  mutation hook being fully implemented. Documented in ADR 0016 decision 8.
  (A second item recorded alongside it — a claimed routing gap for
  `ScheduleDecisionWorkspace`/`executive_director` — was itself wrong; see
  *Verified Completed — Phase 7c* for the correction and the real bug
  tracing it further actually found.)
- **The new `e2e` GitHub Actions job has not run on GitHub yet** — per ADR
  0012, a workflow is only proven correct by actually running; this needs a
  push, which per `AGENTS.md` needs an explicit request.
- **Running `php artisan test` and the E2E suite locally, in either order,
  requires re-seeding (`npm run reset-db`) before continuing with whichever
  runs second** — both draw `DB_DATABASE=grc_enrollment_test` from
  `backend/.env.testing`, and PHPUnit's initial migration reset wipes
  whatever the E2E seeding had put there. Does not affect CI, where the two
  suites run in fully independent jobs with independent database
  containers. See ADR 0016 decision 5.

## Uncommitted or Risky Changes

**Phase 7c's full diff is uncommitted** as of this reconciliation — working
tree on `phase-7c-dashboards` (branched from `main` after Phase 8c's merge;
see *Files Changed — Phase 7c*), none staged or committed. Committing was
not requested this session; per `AGENTS.md`, nothing is committed without an
explicit ask. The diff adds a new backend domain (`app/Domain/Dashboard`,
`app/Actions/Dashboard`) and four new routes rather than modifying
shipped behavior, plus one real frontend bug fix
(`master-schedule-workspace.tsx`'s `AsyncBoundary` split, covered by a new
regression test) and one ADR correction — nothing migrates, nothing changes
an existing API's request shape, and every change is independently
confirmed working (see *Commands and Tests Run — Phase 7c*).

Phase 8a, Phase 8b, and Phase 8c are all safely merged to `main` and pushed
to `origin` — Phase 8a at `8bb7e66`, Phase 8b's merge commit at `2da5501`,
Phase 8c's merge commit at `6d1745b` — not at risk. The real dev database's
only persistent state is carried over unchanged from Phase 7b (see that
phase's entry); Phase 7c's own database work (the E2E journeys) happened
entirely against the isolated `grc_enrollment_test` database, never the dev
database (`grc_enrollment`) — the backend server was switched to
`--env=testing` for that work and switched back to plain dev afterward,
confirmed via `config('database.connections.mysql.database')` resolving to
`grc_enrollment` again before this reconciliation.

## Exact Next Steps

**Superseded 2026-08-05 (this session).** Phases 5–8c are merged to `main`
(latest merged commit `85a6357`, the ADR 0021 grading/enrollment-completion
slice). Everything below Phase 8d in the roadmap headers further down this
file predates several sessions' worth of work that happened directly on
`main`'s working tree without a numbered phase — see *Session History* at
the bottom of this file (entries `2026-08-02` through `2026-08-05`) for the
real, current narrative. The old item 3 below (Withdraw button gap, ADR
0016 decision 8) is now **done** — see the 2026-08-05 session entry.

**Current, not yet acted on:**

1. **Ask the user before committing or merging anything.** The working
   tree currently carries two uncommitted slices on top of `85a6357`: the
   block/section terminology + Grades sidebar polish (2026-08-04), and the
   assessment/fees, guided Cashier flow, unit-cap/overload approval, queue
   daily-reset, student Withdraw button, and 10 connected-professor slice
   (2026-08-05, see ADR 0022). The user has repeated this constraint
   explicitly and often — do not commit or merge without an explicit ask,
   even though every item above is verified and test-covered.
2. Once this session's work is committed (when asked), recompute the
   *Overall Completion* table's Row 8 and the module totals for real
   against that commit — see that table's own flagged caveat above.
3. Confirm the `e2e` CI job actually runs green on GitHub — unconfirmed
   since Phase 8c merged (ADR 0012: a workflow is only proven by running).
4. §14.4 security verification, §14.5 performance verification, and
   §12.6's remaining profile/password/help features (the rest of the old
   "Phase 8d") remain unstarted. Ask the user before starting.
5. Known follow-up, deliberately deferred each time it's been found: the
   Playwright E2E suite's `SEED_STUDENT_SCENARIOS` fixture model predates
   the 8-student/grade-history seed redesign (ADR 0021) and now also the
   10-professor seed (ADR 0022) — several specs need rewriting against the
   current fixture shape. Its own follow-up slice, not attempted piecemeal.

## Do Not Change

- Bearer-token auth; never introduce session-cookie/CSRF auth or a Next.js
  API proxy.
- Faculty own-assignment section scoping and Executive Director
  published-only section visibility (server-enforced in `Section` scopes
  **and** `SectionPolicy`).
- Notification ownership (`user_id` never exposed) and audit privacy (no
  actor name/email ever rendered).
- `session.userId`-scoped private TanStack Query keys.
- Every submitted enrollment section is re-validated server-side against a
  freshly built eligible pool — never trust the client's cached view.
- The `enrollments.active_academic_term_id` generated column and the
  pre-insert duplicate-active-enrollment check that turns its constraint
  violation into a clean 422 — do not remove either half.
- `PrerequisiteEvaluator`'s `needs_verification` path — never make it
  silently default to pass or fail when the grading policy is unconfigured.
- Payment confirmation, COM generation, queue-ticket transitions, and
  enrollment decisions must all stay idempotent/re-checked under a row
  lock — never remove `lockForUpdate()` or the idempotency-first ordering
  in `ConfirmPayment`.
- `void`'s scope (`pending_payment` only) and the `'irregular'`
  block-section placeholder are both clearly flagged as provisional — do
  not treat either as confirmed institutional policy elsewhere.
- Withdrawal approval, transferee-credit decisions, payment confirmation,
  COM generation, queue-ticket transitions, and enrollment decisions must
  all stay idempotent/re-checked under a row lock — never remove
  `lockForUpdate()` from `TransitionWithdrawalRequest`/
  `UpdateTransfereeCredit` or the idempotency-first ordering in
  `ConfirmPayment`.
- `BuildEligibleSubjectPool` must never read `transferee_credits` —
  cross-institution grade equivalence is an open PRD §17 decision; only
  locked `academic_grades` may feed prerequisite evaluation.
- The `enrollment.withdrawal.releases_seats` config flag and the
  `'pending'`/`'approved'`/`'rejected'` withdrawal/transferee-credit
  status vocabularies are both clearly flagged as provisional — do not
  treat either as confirmed institutional policy elsewhere.
- No ML runtime behavior before Phase 9; do not touch the paused
  `ml-service`.
- `query-client.ts`'s `shouldRetryQuery` must never retry a 4xx other than
  via `kind: "connection"`/5xx — retrying a 429 specifically worsens the
  throttle it exists to prevent (ADR 0014).
- `getStatePresentation`'s status→presentation table is the single source
  of truth for PRD §12.4 copy; do not hand-roll a second status-to-message
  mapping in a new workspace without a documented reason (see ADR 0014's
  "Alternatives considered").
- `AsyncBoundary`'s state transitions must stay un-animated — do not wrap
  them in `AnimatePresence`/`FadePresence`. A prior attempt broke a real
  refetch test because the loading state's exit animation had to finish
  before new content could mount (ADR 0015, decision 4).
- Radix `Select`'s controlled `value` must never toggle between `undefined`
  and a string — always `value={x ? String(x) : ""}`, with `""` reserved
  for "no selection." Toggling to `undefined` trips React's
  controlled/uncontrolled detection and can silently fail to redisplay the
  placeholder (ADR 0015, decision 6).
- When wiring a `Controller`-wrapped `Select` to auto-populate from data
  that loads asynchronously, the fix depends on whether the `Controller`
  mounts before or after that data is known — see ADR 0015, decision 5, for
  the two mutually exclusive patterns. Picking the wrong one fails silently
  (no error, the auto-selection just doesn't happen).
- Every date-serializing API Resource must use
  `->utc()->format('Y-m-d\TH:i:s\Z')` for timestamps — never
  `->toIso8601String()` or bare `->toJSON()`. The frontend's `z.iso.datetime()`
  schemas only accept the `Z`-suffixed form; 7 Resources got this wrong for
  the project's entire history until Phase 8c's E2E suite caught it (ADR
  0016, decision 7).
- `backend/.env.testing`'s `CACHE_STORE` must stay `file`, not `array` —
  the E2E suite's rate-limiter journey depends on cache state surviving
  across PHP-CLI-server-per-request processes, which the array driver does
  not provide. `phpunit.xml` overrides this independently for PHPUnit, so
  changing `.env.testing` back would silently break only the E2E suite,
  with no test failure pointing at why (ADR 0016, decision 5).

---

# ■ Overall Completion — 74%

```
██████████████████░░░░░░░  74 / 100
```

The number is weighted, auditable, and recomputable. Every row below is scored
against work that is **merged**, not work that is written or planned.

| # | Component | Weight | Done | Contributes |
|---|---|---:|---:|---:|
| 1 | Platform & foundations — 3 service shells, 13 ADRs, OpenAPI, error contract, DB, CI | 8% | 90% | 7.20 |
| 2 | Identity & RBAC — Sanctum, 9 roles, role middleware, Policies, query scopes | 7% | 85% | 5.95 |
| 3 | Process 1.0 backend — scheduling (PRD §5.1) | 10% | 80% | 8.00 |
| 4 | Process 2.0 backend — enrollment & advising (PRD §5.2) | 10% | 80% | 8.00 |
| 5 | Process 3.0 backend — approvals, payment, COM, transfers, withdrawals (PRD §5.3) | 12% | 95% | 11.40 |
| 6 | Cross-cutting backend — `audit_logs`, `notifications` | 5% | 100% | 5.00 |
| 7 | Frontend platform — Next.js, design system, shell, auth | 8% | 100% | 8.00 |
| 8 | Nine role portals — 40 modules (spans Phases 5–7b) | 25% | 73% | 18.25 |
| 9 | Process 4.0 — machine learning (PRD §5.4) | 10% | 3% | 0.30 |
| 10 | Verification & deployment — E2E, security, perf, ISO 25010, handoff | 5% | 35% | 1.75 |
| | **Total** | **100%** | | **73.85 ≈ 74%** |

Two scores that look surprising, explained:

- **Row 5 at 95%** — all 5 of Process 3.0's subprocesses are now complete:
  3.1 grade encoding, 3.2 transferee credits/withdrawal, 3.3 final
  Registrar approval, 3.4 payment queue, 3.5 payment confirmation + Digital
  COM. The remaining 5% is the tail that forwards attrition events to
  Process 4.0, deliberately deferred to Phase 9 (ML goes last).
- **Row 8's 29/40 figure is stale and no longer trustworthy — flagged
  2026-08-05, not recomputed here.** It was accurate as of Phase 7b, but
  Phase 7c actually merged (`f4cca33`, per this file's own header) and at
  least one further slice (`85a6357`, "grading system, auto-derived
  standing, and enrollment-cycle completion" — added Grade Approvals,
  Academic Transcripts, and Add/Drop Requests) merged after it, without
  this row ever being recomputed. Reconstructing the exact merged-only
  module count now requires diffing `role-capabilities.ts`/
  `module-registry.tsx` against each historical merge commit — not
  attempted here. **For current, accurate module counts, use the ■ Portal
  Feature Matrix below instead of this row** — it reflects the actual
  working tree (43 modules, 36 done per role instance / 35 distinct IDs),
  including this session's still-uncommitted slice. Whoever next merges
  work into `main` should recompute Row 8 for real against that commit,
  not against this stale 29/40.
- **Row 10 at 35%, up from 25%** — Phase 8c's Playwright E2E foundation
  (13 of PRD §14.3's 15 critical journeys) is merged to `main`, plus the
  accessibility scans that closed Phase 8a/8b's deferred manual WCAG pass.
  §14.4 security, §14.5 performance, and ISO 25010/handoff are still
  entirely unstarted — the bump reflects E2E specifically, not the whole
  row.

**Recompute rule:** when a phase closes, update its row's *Done* column and
re-multiply. Do not adjust weights without recording why in Decisions.

**Phase 8a, Phase 8b, and Phase 8c are all merged** to `main` (Phase 8a at
`8bb7e66`, Phase 8b's merge commit at `2da5501`, Phase 8c's merge commit at
`6d1745b`) and are reflected in Row 10 above. **Phase 7c is complete but not
yet merged**, per this table's own rule — see the Row 8 note.

---

# ■ System Snapshot

| | |
|---|---|
| **Stack** | Laravel 12.64 / PHP 8.2.12 · MariaDB 10.4.32 (ADR 0007) · **Next.js 16.2.12** (App Router) + React 19 · FastAPI (ml-service, dormant) |
| **Auth** | Laravel Sanctum bearer tokens; no cookies, no CSRF, no session state |
| **Live API routes** | **48 on `main`; 52 on `phase-7c-dashboards`** (+4 dashboard routes, uncommitted) |
| **Database tables** | **26** (unchanged — Phase 7c added no migrations) |
| **Backend tests** | **641 passing on `main`; 656 passing (2,513 assertions) on `phase-7c-dashboards`** · Larastan level 8 clean, Pint clean, `composer audit` clean |
| **Frontend tests** | **67 files, 362 tests on `main`** (Phase 8a + 8b + 8c) — run with `--no-file-parallelism` for a reliable result on this machine; see Known Issues. **71 files, 376 tests on `phase-7c-dashboards`** (4 new workspace test files, 2 golden-list fixes). |
| **E2E tests** | **13 spec files, 21 tests (20 passed, 1 skipped), Playwright, 15 journeys** on `phase-7c-dashboards` (uncommitted; Phase 8c's original 12 files/19 tests/13 journeys are merged to `main`) — see *Verified Completed — Phase 7c*. |
| **CI** | 4 GitHub Actions jobs live — Backend ✅ · Frontend ✅ · OpenAPI ✅ · ML Service ❌ (paused, see Phase 9). A 5th, E2E, is merged to `main` (Phase 8c) but has not run on GitHub yet (needs a push). |
| **Portals functional** | **9 of 9** have at least one connected module — **29 of 40 modules on `main`; 33 of 40 on `phase-7c-dashboards`** (uncommitted) |

---

# ■ The Nine System Users

All nine roles exist as `App\Domain\Identity\UserRole` enum cases and are seeded
one-per-role by `RoleUserSeeder`. Every local/testing synthetic account uses
the shared password `password`; the seeders refuse to run in production-like
environments. Credentials are documented in `docs/testing/SEEDED_IDENTITIES.md`.

| # | Role | PRD § | Enum value | Seeded identity | Backend authorization | Portal |
|---|---|---|---|---|---|---|
| 1 | Student | §3.1 | `student` | `student.seed@grc.test` | ✅ own profile, eligible pool, enrollment submission/decisions view, grades, payment/queue status, Digital COM + private notifications | ✅ Phase 6 (2 modules) · ✅ Phase 7a (2 more) — all 4 connected |
| 2 | Admission Staff | §3.2 | `admission_staff` | `admission.seed@grc.test` | ✅ provisions students + private notifications | ✅ Phase 5 (3 modules) |
| 3 | Professor / Faculty | §3.3 | `faculty` | `faculty.seed@grc.test` | ✅ own availability/preferences, grade encoding (draft→submitted), class roster read + publication notifications | ✅ Phase 5 (2 modules) · ✅ Phase 7b (2 more) — all 4 connected |
| 4 | Program Chair | §3.4 | `program_chair` | `chair.seed@grc.test` | ✅ curriculum, sections, proposals + publication notifications | ✅ Phase 5 (5 modules) · ⬜ Phase 9 (1 more) |
| 5 | Dean | §3.5 | `dean` | `dean.seed@grc.test` | ✅ schedule approve/return + private notifications | ✅ Phase 5 (1 module) · ⬜ Phase 7c (4 more) |
| 6 | Executive Director | §3.6 | `executive_director` | `executive.seed@grc.test` | ✅ final approve/publish + private notifications | ✅ Phase 5 (1 module) · ⬜ Phase 7c (3 more) |
| 7 | Registrar Head | §3.7 | `registrar_head` | `registrar-head.seed@grc.test` | ✅ close proposal, audit logs, enrollment approve/reject/void, grade locking, withdrawal/transferee-credit/academic-record/document reads + private notifications | ✅ Phase 5 (1 module) · ✅ Phase 7a (2 more) · ⬜ Phase 7c (3 more) |
| 8 | Registrar Staff | §3.8 | `registrar_staff` | `registrar-staff.seed@grc.test` | ✅ decides withdrawal requests and transferee credits, reads all academic records and enrollment documents + private notifications | ✅ Phase 7b (4 modules) — all connected |
| 9 | Accounting Staff | §3.9 | `accounting_staff` | `accounting.seed@grc.test` | ✅ payment queue, serving number, idempotent payment confirmation + Digital COM generation | ✅ Phase 7a (4 modules) — all connected |

The local database was reseeded on 2026-07-29. All 12 synthetic
`*.seed@grc.test` accounts—the nine role identities plus three additional
student lifecycle scenarios—were verified against the shared password
`password`.

Every role can already sign in, receive a bearer token, and get a role-filtered
navigation set. Several roles can complete backend tasks through the API, as
the table records, but the portal UI is still placeholder-only; Phases 5–7
connect those workflows to each role's portal.

---

# ■ Phase Roadmap

Reorganised 2026-07-28 around two directives: **machine learning goes last**,
and **the frontend moves to Next.js**. This supersedes the earlier checklist
that mirrored PRD §16's phase numbering. PRD §16 remains the contractual
phase definition; this roadmap is the execution order chosen to reach a fully
functional system before any model is trained.

| Phase | Name | Status | % |
|---|---|---|---:|
| 0 | Foundations & Platform | ✅ Complete | 90 |
| 1 | Identity, RBAC & the Nine Users | ✅ Complete | 85 |
| 2 | Process 1.0 — Scheduling backend | ✅ Complete (2 deferred) | 80 |
| 3 | **Next.js Migration** | ✅ Complete | 100 |
| 4 | Cross-Cutting Backend & ML Substrate | ✅ Complete (merged and verified) | 100 |
| 5 | Portals over Existing APIs (6 roles) | ✅ Complete (merged and verified) | 100 |
| 6 | Process 2.0 + Student Portal | ✅ Complete (merged and verified) | 100 |
| 7 | Process 3.0 + Registrar / Accounting / Grades Portals | ✅ Records core complete (7a+7b); dashboards deferred to 7c | 90 |
| 8 | Polish, Accessibility, E2E, Performance | ⬜ Planned | 25 |
| 9 | **Process 4.0 — Machine Learning** | ⬜ Last | 3 |
| 10 | Deployment & Handoff | ⬜ Planned | 0 |

## The machine-learning thread

ML is last, but it is **not** an afterthought bolted on at the end. Process 4.0
can only work if the transactional system captured the right data while it was
being built. Each phase therefore carries an explicit data-capture obligation:

| Phase | Captured so Phase 9 can use it |
|---|---|
| 4 | `audit_logs` behavioural event history; the three PRD §10.4 analytics tables land **schema-only** |
| 6 | Enrollment `submitted_at` timing, subject-selection patterns, eligibility-rejection reasons |
| 7 | Final grades + status transitions, withdrawal reasons + `processed_at`, payment timing — **the attrition label and most of its features** |
| 9 | Models only. No plumbing, no schema work. |

PRD §11.1 fixes the boundary: *"Subject eligibility remains deterministic;
recommendation ranking may use approved historical signals but cannot override
eligibility rules."* Honors (FR-ANL-006) and government reports (FR-ANL-007)
also stay deterministic. §4.4: *"Predictions never directly mutate enrollment
or academic status."*

---

## Phase 0 — Foundations & Platform ✅

Three independently runnable services; ADRs 0001–0013; `docs/api/openapi.yaml`
and the shared error contract; MariaDB with least-privilege principals;
21 reversible migrations; 8 seeders; GitHub Actions CI.

Open: the `ml-service` CI job fails and is paused until Phase 9.

## Phase 1 — Identity, RBAC & the Nine Users ✅

Sanctum bearer login/logout/me; `UserRole`/`UserStatus` enums; nine seeded
identities; `EnsureUserHasRole` middleware; `EnsureUserIsActive`; Policies plus
`scopeVisibleTo()` query scopes (ADR 0008 — a Policy cannot filter a
collection, so "which rows" lives in a scope).

Open: password reset / account recovery — blocked on PRD §17.

## Phase 2 — Process 1.0, Scheduling backend ✅

FR-SCH-001 through FR-SCH-005 and FR-SCH-007 through FR-SCH-009.

- Curriculum catalog with `PrerequisiteCycleDetector` (DFS 3-colour cycle
  check) and full-replace write semantics (ADR 0009).
- Faculty availability and ranked subject preferences — own-record
  authorization.
- Section planning with `ScheduleDayParser` + `SectionConflictDetector`
  (same-professor, same-term, shared-day, half-open time overlap; ADR 0010).
- Five-state approval workflow with role-per-transition authorization
  (ADR 0011).

**Deferred:** FR-SCH-006 demand forecast → Phase 9 (needs ML).
FR-SCH-010 audit logging is implemented and verified in the merged Phase 4
backend.

## Phase 3 — Next.js Migration ✅

**Next.js 16.2.12**, App Router, client-rendered only (ADR 0013). The 4 real
screens were ported with no feature changes; all 40 modules remain
placeholders as intended.

- `src/app/` is now routing only; application code moved to `src/features/`
  (69 files, verified complete by `tsc`).
- **Demo auth mode deleted** — but it could not simply be dropped: `demoRoles`
  was the runtime enum validating *real* API responses in `auth-schema.ts`,
  and `DemoAuthError`/`DemoSession` were used by the live API gateway. Those
  were extracted to `features/auth/roles.ts`, `auth-types.ts` and
  `auth-error.ts` first; only then were the demo files removed, along with
  `DEMO_CREDENTIALS.md`. `AuthProvider` lost its `sessionStore` prop and the
  whole `AuthMode` tri-state collapsed.
- Test harness rebuilt against a mocked `next/navigation`; `MemoryRouter` and
  the `LocationProbe` have no App Router equivalent, so routing assertions now
  check the redirect the guard *requested*. 20 files → 15, 145 tests.
- `app-router.test.tsx` was replaced by `auth-route-guards.test.tsx`, which
  keeps the security-adjacent coverage: `returnTo` encoding, query
  preservation, and rejection of a hostile cross-origin `returnTo`.

**Three defects caught during the migration, not after** — see Failure and
Recovery Record: a Next-introduced audit failure, an ESLint 10 incompatibility,
and a real unhandled-rejection bug in sign-out.

**Verification:** `typecheck`, `lint` (`--max-warnings=0`), `lint:fast`,
`format:check`, `audit` (0 vulnerabilities), `build`, and 145/145 tests all
clean. Backend gate unchanged at 348/348. **Live HTTP proof: 17/17** against a
real Laravel API — all four routes served, metadata migrated from `index.html`,
CORS accepting the new port 3000 origin, real Sanctum login → `/auth/me` →
logout → 401, and an explicit ADR 0013 check that **no authorized content is
ever server-rendered** on `/login` or `/portal`.

**Carried over unchanged:** the 1,930-line Tailwind v4 theme and GRC brand
tokens, all 12 shadcn components, the strict-Zod API client, the auth token
module, TanStack Query, React Hook Form, and every accessibility behaviour.

**Not done, deliberately:** any portal functionality (Phases 5–7); Playwright
E2E (Phase 8); `next/font` migration; server components fetching authorized
data and httpOnly-cookie auth, both rejected in ADR 0013.

## Phase 4 — Cross-Cutting Backend & ML Substrate

The merged backend now contains the five remaining PRD §10.4 tables and all planned
Phase 4 behavior. It is placed before the portals because the portal shell's
notification centre is still disabled and because later business processes
must produce complete audit and analytical history from their first write.

**Implemented:**

- `audit_logs` with actor/action/entity snapshots, reason, request ID and IP;
  application-level immutability; and transaction-coupled rollback.
- Registrar Head-only `GET /api/v1/audit-logs`, with validated filters,
  deterministic pagination, private/no-store responses, safe Resources, and
  an `audit_log.list_viewed` event created after page materialization.
- `notifications` plus authenticated user-owned
  `GET /api/v1/notifications` and idempotent
  `PATCH /api/v1/notifications/{notification}/read`; `user_id` is never
  exposed.
- Complete audit retrofit for curriculum graphs, faculty availability and
  preferences, sections, schedule-proposal creation/transitions/publication,
  and atomic student provisioning. Audit failure rolls back each domain
  write.
- Schedule publication notifies the submitting Program Chair and every unique
  non-null professor assigned to a newly published section, exactly once per
  recipient, in the publication transaction.
- **ML substrate, schema-only:** `prediction_runs`,
  `section_demand_forecasts`, and `attrition_predictions`, with lineage,
  uniqueness, range/bounds checks, fixed-point casts, and no HTTP, job,
  seeder, frontend, or student attrition access.
- Complete `HISTORICAL DATA` physical mapping in
  `docs/data-dictionary/cross-cutting-backend.md`; no duplicate generic
  `historical_data` table. `report_exports` remains Phase 9.

**Fresh takeover verification so far:** the full backend suite passes
503 tests / 1,899 assertions and the focused Phase 4 gate passes 152 tests /
935 assertions; the route inventory is exactly 29; no prediction public
boundary or direct write in the six refactored controllers exists; OpenAPI
semantic lint and `git diff --check` pass. A fresh migration of all 26 tables,
rollback and reapplication of exactly the five Phase 4 migrations, and the
focused migration suites pass (27 tests / 70 assertions). The full
static-analysis/format/security gate also passes: Pint clean, Larastan level 8
over 175 files with no errors, Composer locked audit with no advisories, and
Redocly with no warnings/errors. Phase 4 is merged into `main` and the
published overall score is now 41%.

## Phase 5 — Portals over Existing APIs ✅

Six portals, 13 modules, plus one audited faculty-directory read endpoint
for Program Chair section assignment. All nine tasks are implemented,
independently reviewed, quality-gated (see *Commands and Tests Run* at the
top of this file), and merged to local `main`.

- **Task 1 — backend.** `GET /api/v1/faculty-members`, Program Chair only,
  audited, no email. Route inventory 29 → 30.
- **Tasks 2–3 — shared frontend foundation.** PATCH/DELETE client, 422 form
  mapping, Sonner + 6 UI primitives, parsed reference/notification hooks,
  live notification Sheet, the typed 13-ID module registry.
- **Task 4 — Admission Staff.** One workspace for `student-accounts`,
  `admission-status`, `credential-issuance`; one-time browser-generated
  temporary credential, never persisted.
- **Task 5 — Faculty.** `availability-preferences` + `teaching-schedule`
  CRUD/read. Remediation fixed a real backend bug: `GET /api/v1/sections`
  had returned every Faculty member's sections to every Faculty member;
  now scoped to `professor_id` in both the collection scope and
  `SectionPolicy`.
- **Task 6 — Program Chair curriculum.** `curriculum` +
  `subjects-prerequisites`, full-replace editor with client + backend
  cycle/duplicate checks.
- **Task 7 — Program Chair scheduling.** `sections-schedules`,
  `faculty-assignment`, `schedule-proposals` (drafts only — chair gets no
  approval/publish/close controls).
- **Task 8 — Dean / Executive Director / Registrar Head.** Shared
  schedule-decision component gated to each role's exact legal transitions;
  master schedule; paginated/filtered audit log with no actor identity
  rendered. Remediation fixed a second real backend bug: Executive Director
  had received unpublished (planned/closed/cancelled) sections; now scoped
  to `status === 'published'` in both the collection scope and the direct
  policy.
- **Task 9 — this reconciliation.** Closed the two carried-forward test
  gaps, ran the full quality gate, rewrote this file, retired
  `HANDOFF.md`, merged to `main`.

Full task-by-task RED/GREEN/review detail — every focused test count,
remediation, and re-review verdict — is archived in
`docs/history/2026-07-session-log.md` under "Phase 5 — Portals over
Existing APIs, task-by-task record".

## Phase 6 — Process 2.0 + Student Portal ✅

Nine tasks, all merged: fractional-unit schema + the real 88-subject CCS
catalog, a config-driven grading policy with an explicit
`needs_verification` fallback, the block-section eligibility mechanism, the
Eligible Subject Pool and Enrollment Submission APIs, both Student portal
modules, and the generalized (no-longer-Phase-5-specific) module registry.

- **Eligible Subject Pool** (`GET /api/v1/eligible-subjects`, DFD 2.2 ·
  FR-ENR-001–003, 005, 011). Every curriculum subject is returned with an
  explainable verdict — `completed`, `already_selected`, `prerequisite`,
  `prerequisite_advisory`, `no_sections_available`, `block_restricted`, or
  `eligible` — reusing `SectionConflictDetector` is deferred to submission
  (see below); prerequisite edges hang off `curriculum_subject_id`, not a
  bare subject pair, and `sections` join a student's curriculum only via
  `subject_id`, exactly as anticipated.
- **Enrollment Submission** (`GET`/`POST /api/v1/enrollments`, DFD 2.4 ·
  FR-ENR-004, 006–010). One transaction: enrollment + enrollment_subjects +
  queue_ticket + audit entry + notification. The
  `enrollments.active_academic_term_id` generated column enforces
  one-active-per-term at the database layer; the request validator turns a
  would-be constraint violation into a clean 422 first. Every submitted
  section is re-validated against a freshly rebuilt pool — the client's
  cached view is advisory only. `SectionConflictDetector` (reused unchanged
  from Phase 2) runs here, pairwise across the submitted set, which is where
  FR-ENR-003's "conflicting sections cannot be submitted together" is
  actually enforced.
- **Real institutional data.** The user supplied two real GRC College of
  Computer Studies block-section spreadsheets mid-phase. 88 real subjects
  (code/title/units only) were added via an additive seeder; `units` columns
  were widened to `decimal` because Leadership subjects are genuinely 1.5
  units; the grading comparison (3.00 passing / 5.00 failing, lower-is-better,
  INC/NC) is the user's explicit direction, pre-populated as config default
  but never hardcoded into logic.
- **Live-verified, not just tested.** Applied both migrations to the real
  dev database, seeded the real catalog into it, and ran the full pool →
  submit → duplicate-rejection → list flow over real HTTP against a real
  seeded student, confirming all 5 atomic side effects landed correctly.

§17-blocked, mechanism-implemented-value-flagged: official passing-grade
*confirmation* (the comparison logic exists and is user-directed, but GRC
has not formally signed off), max units / overload (config exists, both
values default to `null` = unenforced), block-section eligibility (schema
exists, comparison uses a documented placeholder pending GRC's real
regular/irregular vocabulary).

## Phase 7a — Process 3.0 Money Path ✅

Nine tasks, all merged: role-scoped enrollment visibility, the Registrar
Head's approve/reject/void decisions, grade encoding
(draft→submitted→locked), the Accounting payment queue, idempotent payment
confirmation + Digital COM generation, and 8 portal modules across
Registrar Head, Accounting Staff, and Student.

- **Registrar decisions** (`PATCH /api/v1/enrollments/{enrollment}`,
  FR-FIN-001/002). Follows ADR 0011 verbatim: one route, an `action` field,
  `EnrollmentPolicy` resolving the ability per request. `registrar_approve`/
  `registrar_reject` decide the initial approval queue; `void` is a
  distinct later checkpoint, cancelling an already-approved-but-unpaid
  enrollment — scoped to `pending_payment` because §17 leaves "authorized
  edge case" undefined.
- **Grade encoding** (`GET`/`POST`/`PATCH /api/v1/academic-grades`, PRD
  §4.3 DFD 3.1). Role-scoped read; Faculty writes only their own sections'
  grades while `draft`; Registrar Head locks a `submitted` grade — the
  moment it becomes part of the official record
  `BuildEligibleSubjectPool` already reads for prerequisite evaluation.
- **Payment queue + confirmation** (`GET`/`PATCH /api/v1/queue-tickets`,
  `POST /api/v1/enrollments/{enrollment}/payment`, FR-FIN-006–010).
  Accounting-only; confirmation is a five-write transaction (`Payment` +
  enrollment→`enrolled` + `EnrollmentDocument` + audit + notification)
  proven **idempotent live**, not just by test — a repeat call with
  contradictory input returns the original record unchanged. No PDF
  pipeline; the Digital COM is structured data the Student portal renders
  with `window.print()`.
- **8 portal modules.** Registrar Head (Enrollment Approvals, Overrides &
  Voids), Accounting Staff (Payment Queue, Serving Number, Payment
  Confirmation, COM Finalization — all four sharing one workspace
  component the way Admission's 3 modules already do), Student (Queue &
  Payment, Grades & Digital COM).
- **Live-verified, not just tested.** Zero pending migrations confirmed
  against the real dev database (no new tables — all 6 were already
  schema-only). Walked one freshly-submitted enrollment the entire way
  over real HTTP — submit → grade encode/submit/lock → registrar approve →
  queue serve/complete → payment confirm (with the idempotency repeat) →
  student's own views — verifying every side effect via direct SQL, plus
  `registrar_reject` and `void` exercised live on two other enrollments.

§17-blocked, mechanism-implemented-value-flagged: `void`'s exact
"authorized edge case" scope, queue-ticket numbering/reset/priority,
required payment-confirmation fields and currency rounding, and Digital
COM format/numbering/signatures/retention all remain GRC-unconfirmed.

## Phase 7b — Transferee Credits, Withdrawal & the Registrar Staff Portal ✅

Deferred from Phase 7a by explicit user choice at kickoff; scoped to the
"records core" (Dean/Executive Director dashboards deferred again, to
7c, since they're the only part of the original scope with no
PRD-specified content).

- **Withdrawal requests** (FR-FIN-004, PRD §4.2 rule 7):
  `POST /api/v1/enrollments/{enrollment}/withdraw` (Student, own
  `enrolled` enrollment), `GET`/`PATCH /api/v1/withdrawal-requests[/{id}]`
  (Registrar-Staff-only `approve`/`reject`). Seat release is
  config-flagged (`enrollment.withdrawal.releases_seats`, default `true`)
  since §17 leaves the policy unconfirmed; idempotency (no double
  decrement on a repeat approval) is enforced under a row lock regardless
  of the flag — proven live, not just by test.
- **Transferee credits** (FR-FIN-003, PRD §3.8/§10.3):
  `GET`/`POST`/`PATCH /api/v1/transferee-credits`. Registrar-Staff-only
  writes; every write audited, including plain content edits. Approved
  credits never feed `BuildEligibleSubjectPool` — proven live that
  approving one leaves the student's prerequisite verdict unchanged,
  since cross-institution grade equivalence is an open §17 decision.
- **Registrar Staff read widening** (PRD §3.8, no new endpoints): sees
  every academic grade and enrollment document, the same breadth the
  Registrar Head already had.
- **Class roster API**: `GET /api/v1/class-rosters` (Faculty own
  sections, Registrar Staff and Registrar Head all) — the roster endpoint
  this document had recorded as missing since Phase 6.
- **6 portal modules.** Registrar Staff (Credit Mappings, Drops &
  Withdrawals, Academic Records, Enrollment Documents — one shared
  `RegistrarRecordsWorkspace`, which deliberately renders only the active
  module rather than all four at once, since they're unrelated record
  types), Faculty (Class Rosters, Grade Submission — the latter writing
  through the Phase 7a academic-grades API with no new backend).
- **Live-verified, not just tested.** Zero pending migrations confirmed.
  Walked one freshly-submitted enrollment to `enrolled`, then through a
  real withdrawal request and Registrar Staff approval — section seat
  count moved exactly once (4→3) and stayed there on a repeat approval
  attempt (422). Approved a transferee credit mapped to the exact subject
  a later course's prerequisite requires and confirmed the student's
  `GET /eligible-subjects` verdict for that course was unaffected. Read
  the live class roster (correctly showing the withdrawn student as
  `dropped`) and the widened academic-grades/enrollment-documents reads
  as Registrar Staff.

Discovered and fixed a pre-existing Sanctum multi-actor test gotcha along
the way (see Technical Decisions) — the same one `EnrollmentsEndpointTest`
already documented, now also applied to the new withdrawal tests.

The most ML-consequential remaining slice before Phase 9 — it produces the
attrition model's label and most of its features.

## Phase 7c — Dean/Executive Director Dashboards ✅ (quality-gated, unmerged)

Deferred twice before on the assumption that the whole slice needed an
institutional content decision first. A full PRD audit found that was only
half true: the dashboards' arithmetic (status distributions, funnel counts,
section fill, dwell time) needs no institutional judgment at all, only the
*threshold* that labels a dwell time "stuck" does — and PRD §17 never even
registered that question, let alone the shape of "what a dashboard shows."
Connected `enrollment-dashboard`, `stuck-students`, `institution-dashboard`,
and `policy-settings` (33/40 modules); left `compliance-reports` and the
shared `reports` id (Dean + Executive Director) as placeholders — those
three are genuinely §17-blocked (no field list, format, or sign-off
authority exists for any of them). `honors`/`kpis`/`attrition-analytics`
stay deferred to Phase 9 as ML work, unaffected by this phase. Complete and
quality-gated on `phase-7c-dashboards` — see *Verified Completed — Phase
7c* and ADR 0017. Not yet committed or merged to `main`.

## Phase 8 — Polish, Accessibility, E2E, Performance

### Phase 8a — Accessibility & Required States ✅ (merged)

PRD §12.4 required states on every page, WCAG 2.1 AA (§12.5), §12.3 form
behavior, and the presentation-layer part of §12.6. Complete and merged to
`main`, pushed to `origin` at `8bb7e66` — see *Verified Completed —
Phase 8a*. The manual WCAG keyboard/screen-reader/zoom pass was the one
piece not run before merge (no browser connection that session).

### Phase 8b — Portal UI Coherence & Motion ✅ (merged)

Fixed the duplicate page header, dashed placeholder frame, and centered
layout on every connected workspace (`PortalModulePage`/`WorkspacePage`
now share a single header); migrated the last raw `<select>`/`<input>`
elements onto `ui/select.tsx`/`ui/input.tsx` across 10 workspaces; rebuilt
`enrollment-workspace.tsx` (the one Student workspace Phase 8a's migration
skipped); adopted the landing/login pages' existing print-ledger design
language into portal chrome instead of inventing a new look; added the
`motion` library for entrance/stagger/presence animation, gated everywhere
by `useReducedMotion()`. Complete and merged to `main` (merge commit
`2da5501`) — see *Verified Completed — Phase 8b* and ADR 0015.

### Phase 8c — Playwright E2E Foundation ✅ (merged)

Filled the pre-reserved `e2e/` slot: 13 of §14.3's 15 critical journeys
against the real Next.js frontend, real Laravel API, and an isolated
MariaDB test database — not mocks. Journey #14 skipped (ml-service dormant,
Phase 9 boundary); journey #15 partial (no report content yet, Phase 7c).
Closed the manual WCAG 2.1 AA / live-visual-verification gap deferred in
both Phase 8a and Phase 8b, via `@axe-core/playwright` in a real browser.
Found and fixed two genuine, previously invisible defects along the way — a
date-serialization contract break across 7 API Resources, and a rate
limiter silently inert over real HTTP — that no prior test layer could have
caught; found and documented (not fixed) two real application UI gaps (one
of which — the claimed `ScheduleDecisionWorkspace` routing gap — turned out
to be a misdiagnosis, corrected in Phase 7c). Complete and merged to `main`
(merge commit `6d1745b`) — see *Verified Completed — Phase 8c* and ADR
0016.

### Phase 8d — Performance, Security, §12.6 Remaining Features (not started)

§14.5 performance on the eligible-subject query and approval queues (no
numeric targets exist in the PRD — "define target values during
architecture validation and pilot baselining" — so this means recording
measured `EXPLAIN ANALYZE` baselines, not asserting invented thresholds);
§14.4 security verification; §12.6's remaining profile/password/help
features (need new backend endpoints, deferred out of 8a/8b/8c for that
reason). One candidate surfaced by Phase 8c, not yet scoped in: building the
student-facing Withdraw button (ADR 0016 decision 8). (The other Phase-8c
candidate — wiring `ScheduleDecisionWorkspace` navigation for Executive
Director — turned out to already exist; Phase 7c corrected the record and
fixed the real empty-state bug that tracing it down actually found.)

## Phase 9 — Process 4.0, Machine Learning (LAST)

Only now, and only because Phases 4–7 captured the data. FR-ANL-001–012.

- Random Forest section demand; XGBoost attrition risk (PRD §11.1 candidates).
- Unblocks **FR-SCH-006** and the Program Chair's Demand Forecast module.
- Guardrails: FR-ANL-011 never auto-deny; FR-ANL-010 role-restricted;
  §11.3 model governance — versioning, rollback, drift, model card.
- Resumes the paused `ml-service` CI investigation. **Do not touch it before
  this phase.**

## Phase 10 — Deployment & Handoff

PRD §16 Phase 8 deliverables: production configuration, secret management,
HTTPS, backup/restore runbook, model card, UAT report, and the ISO/IEC 25010
evaluation (§15.9).

---

# ■ Portal Feature Matrix — 43 Modules

Source of truth: `frontend/src/features/portal/role-capabilities.ts` and
`frontend/src/features/portal/module-registry.tsx`. A ✅ module is dispatched
by `connectedModuleRegistry` to a real workspace component backed by parsed
API services and tests. Every other module is still a placeholder empty-state
rendering *"This module is not connected to workflow or authorization APIs."*
**Not yet merged to `main`** — see *Uncommitted or Risky Changes*.

Status: ⬜ placeholder · 🔨 in progress · ✅ done

### 1. Student — 4 modules

| Module | Phase | Status |
|---|---|---|
| Eligible Subjects | 6 | ✅ |
| Enrollment | 6 | ✅ (now also embeds Queue & Payment, Add/Drop, and Withdraw — see 2026-08-04/05 session notes) |
| Grades | 7a | ✅ |
| Digital COM | 7a | ✅ |

### 2. Admission Staff — 3 modules

| Module | Phase | Status |
|---|---|---|
| Student Accounts | 5 | ✅ |
| Admission Status | 5 | ✅ |
| Credential Issuance | 5 | ✅ |

### 3. Professor / Faculty — 4 modules

| Module | Phase | Status |
|---|---|---|
| Availability Preferences | 5 | ✅ |
| Teaching Schedule | 5 | ✅ |
| Class Rosters | 7b | ✅ |
| Grade Submission | 7b | ✅ |

### 4. Program Chair — 6 modules

| Module | Phase | Status |
|---|---|---|
| Curriculum | 5 | ✅ |
| Subjects & Prerequisites | 5 | ✅ |
| Sections & Schedules | 5 | ✅ |
| Faculty Assignment | 5 | ✅ |
| Schedule Proposals | 5 | ✅ |
| Demand Forecast | **9** | ⬜ blocked on ML |

### 5. Dean — 5 modules

| Module | Phase | Status |
|---|---|---|
| Schedule Approvals | 5 | ✅ |
| Enrollment Dashboard | 7c | ✅ |
| Stuck Students | 7c | ✅ (dwell time factual; threshold unset, flagged not confirmed) |
| Honors | **9** | ⬜ |
| Reports | 7c | ⬜ no PRD-specified content |

### 6. Executive Director — 4 modules

| Module | Phase | Status |
|---|---|---|
| Master Schedule | 5 | ✅ |
| Institution Dashboard | 7c | ✅ |
| KPIs | **9** | ⬜ |
| Reports | 7c | ⬜ no PRD-specified content |

### 7. Registrar Head — 9 modules

| Module | Phase | Status |
|---|---|---|
| Enrollment (Academic Terms) | 5 | ✅ |
| Grade Approvals | 2026-08-04 | ✅ mandatory, permanent lock; re-derives Regular/Irregular standing |
| Academic Transcripts | 2026-08-04 | ✅ look up any student's prospectus/grade slip |
| Overrides & Voids | 7a | ✅ |
| Add/Drop Requests | 2026-08-04 | ✅ decides student add/drop/change-section requests |
| Attrition Analytics | **9** | ⬜ |
| Compliance Reports | 7c | ⬜ no PRD-specified content |
| Audit Logs | 5 | ✅ |
| Policy Settings | 7c | ✅ (read-only view of current config; now also surfaces `fees.*` and overload-cap rows — see 2026-08-05 session) |

### 8. Registrar Staff — 6 modules

| Module | Phase | Status |
|---|---|---|
| Enrollment Approvals | 2026-08-04 | ✅ approver moved here from Registrar Head (ADR 0021); now also acknowledges FR-ENR-004 overload flags before approving — see 2026-08-05 session |
| Credit Mappings | 7b | ✅ |
| Drops & Withdrawals | 7b | ✅ |
| Academic Records | 7b | ✅ |
| Add/Drop Requests | 2026-08-04 | ✅ read visibility, same requests Registrar Head decides |
| Enrollment Documents | 7b | ✅ |

### 9. Accounting Staff — 2 modules

| Module | Phase | Status |
|---|---|---|
| Payment Queue | 2026-08-05 | ✅ redesigned into one guided flow (Now Serving/Waiting/Served today) replacing the four separate Phase 7a modules below |
| Payment Records | 2026-08-05 | ✅ new — date-filterable history of every payment confirmed, for both Accounting and Registrar Head |

**Removed this session (2026-08-05):** Serving Number, Payment Confirmation,
and COM Finalization no longer exist as separate nav modules — folded into
the single guided Payment Queue flow (see *Verified Completed* below).

**Totals:** 43 modules · **36 done** counted per role instance (35 distinct
connected IDs — `enrollment-change-requests` is one module dispatched to
both Registrar Head and Registrar Staff) · 4 blocked on Phase 9 (Demand
Forecast, Honors, KPIs, Attrition Analytics) · 3 remain with no PRD-specified
content (Dean's Reports, Executive Director's Reports, Registrar Head's
Compliance Reports). **This count is ahead of `main`** — see *Uncommitted or
Risky Changes*; Row 8 of the completion table below intentionally still
scores against the last-merged 29/40, per that table's own "merged only"
rule.

---

# ■ What Is Built

## API surface — 48 routes on `main`, 52 on `phase-7c-dashboards`

**Public:** `GET /api/v1/health` · `POST /api/v1/auth/login`

**Authenticated:** `POST /auth/logout` · `GET /auth/me`

**Phase 4 authenticated additions:** `GET /notifications` ·
`PATCH /notifications/{notification}/read` (own records for all roles) ·
`GET /audit-logs` (Registrar Head only)

**Readable by every role** (rows filtered by each model's `visibleTo` scope):
`GET /programs` · `/academic-terms` · `/subjects` · `/curricula` ·
`/faculty-availabilities` · `/faculty-subject-preferences` · `/sections` ·
`/schedule-proposals` · `/student-profile` (own-record only)

**`role:program_chair`:** `POST`/`PATCH /curricula` · `POST`/`PATCH /sections` ·
`POST /schedule-proposals` · `GET /faculty-members` (active Faculty directory,
private and audited)

**`role:faculty`:** `POST`/`PATCH`/`DELETE /faculty-availabilities` and
`/faculty-subject-preferences`

**`role:admission_staff`:** `POST /student-profiles`

**No `role:` middleware, own-record only (Student):** `GET /eligible-subjects`
(`EligibleSubjectPolicy`) — same pattern as `student-profile.show`, matching
the same shape `FacultyMemberPolicy`/`EligibleSubjectPolicy` use for a
virtual (non-Eloquent) resource.

**No `role:` middleware, role-scoped Policy gate (Phase 6 + 7a):**
`GET`/`POST /enrollments` (Student own / Registrar Head all / Accounting
`pending_payment` only — `Enrollment::scopeVisibleTo` + `EnrollmentPolicy`)
· `PATCH /enrollments/{id}` — one route serves `registrar_approve`/
`registrar_reject`/`void`, `EnrollmentPolicy` resolves the ability from the
request's `action` field (ADR 0011) · `POST /enrollments/{id}/payment`
(Accounting only, idempotent) · `GET /enrollment-documents` (Student own /
Registrar Head all) · `GET`/`POST`/`PATCH /academic-grades[/{id}]` (Student
own / Faculty own sections / Registrar Head all reads; Faculty-only
create; `PATCH` serves a content edit or `action: submit`/`lock`,
`AcademicGradePolicy` resolving per request).

**No `role:` middleware:** `PATCH /schedule-proposals/{id}` — one route serves
six transitions, so `ScheduleProposalPolicy` resolves the ability from the
request's `action` field (ADR 0011).

**`role:accounting_staff` (Phase 7a):** `GET /queue-tickets` ·
`PATCH /queue-tickets/{id}` (`action: serve`/`complete`) — the one Phase 7a
write pair with no per-row ownership dimension to split by Policy ability,
re-checked by `QueueTicketPolicy` as defense in depth.

**No `role:` middleware, role-scoped Policy gate (Phase 7b):**
`POST /enrollments/{id}/withdraw` (Student, own `enrolled` enrollment —
`EnrollmentPolicy::withdraw`) · `GET`/`PATCH
/withdrawal-requests[/{id}]` (Student own / Registrar Staff and Registrar
Head all reads; Registrar-Staff-only `approve`/`reject` —
`WithdrawalRequest::scopeVisibleTo` + `WithdrawalRequestPolicy`) ·
`GET`/`POST`/`PATCH /transferee-credits[/{id}]` (Student own / Registrar
Staff and Registrar Head all reads; Registrar-Staff-only writes —
`TransfereeCredit::scopeVisibleTo` + `TransfereeCreditPolicy`) ·
`GET /class-rosters` (Faculty own sections / Registrar Staff and
Registrar Head all — `EnrollmentSubject::scopeVisibleTo` +
`EnrollmentSubjectPolicy`).

**No `role:` middleware, role-scoped Policy gate (Phase 7c, uncommitted on
`phase-7c-dashboards`):** `GET /dashboards/enrollment-summary` (Dean and
Executive Director — `DashboardPolicy::viewEnrollmentSummary`) ·
`GET /dashboards/institution-summary` (Executive Director only —
`DashboardPolicy::viewInstitutionSummary`) ·
`GET /dashboards/policy-settings` (Registrar Head only, read-only —
`DashboardPolicy::viewPolicySettings`) ·
`GET /stuck-enrollments` (Dean only, minimal fields —
`StuckEnrollmentPolicy::viewAny`). All four are aggregate-only or
minimal-field views, following `EligibleSubjectPolicy`'s "computed view, not
a stored resource" precedent — see ADR 0017.

## Database — 26 tables

Identity and reference: `users`, `personal_access_tokens`, `programs`,
`academic_terms`.
Curriculum: `subjects`, `curricula`, `curriculum_subjects`,
`subject_prerequisites`.
Scheduling: `sections`, `schedule_proposals`, `faculty_availabilities`,
`faculty_subject_preferences`.
Enrollment records: `student_profiles` (own-record read only, Phase 1),
`enrollments`, `enrollment_subjects` (**Phase 6 — API-backed** via
`GET`/`POST`/`PATCH /enrollments`; **Phase 7b** — also read via
`GET /class-rosters`), `academic_grades` (**Phase 7a** —
`GET`/`POST`/`PATCH /academic-grades`; **Phase 7b** — read widened to
Registrar Staff), `queue_tickets` (**Phase 7a** —
`GET`/`PATCH /queue-tickets`), `payments` and `enrollment_documents`
(**Phase 7a** — written/read via `POST /enrollments/{id}/payment` and
`GET /enrollment-documents`; **Phase 7b** — read widened to Registrar
Staff), `transferee_credits` and `withdrawal_requests` (**Phase 7b** —
`GET`/`POST`/`PATCH /transferee-credits` and `POST
/enrollments/{id}/withdraw` + `GET`/`PATCH /withdrawal-requests`).

**Phase 4 additions:** operational `audit_logs` and `notifications`;
schema-only `prediction_runs`, `section_demand_forecasts`, and
`attrition_predictions`. The analytical tables have no API, job, seeder, or
frontend and stay unused until Phase 9.

**Phase 6 schema changes (no new tables):** `subjects.units` and
`enrollments.total_units` widened `integer` → `decimal(_,1)`;
`sections.is_block_exclusive` and `student_profiles.enrollment_category`
added, both nullable mechanism-only columns.

Seeders: `RoleUserSeeder`, `ProgramSeeder`, `AcademicTermSeeder`,
`SubjectSeeder`, `CcsSubjectSeeder` (Phase 6 — the real 88-subject GRC CCS
catalog), `CurriculumSeeder`, `SectionSeeder`, `DemoEnrollmentSeeder`.
All `local`/`testing` only.

## Frontend

**Next.js 16.2.12**, App Router, client-rendered only. Routes live in
`src/app/` (`layout`, `providers`, `page`, `login/`, `portal/[moduleId]/`,
`not-found`); application code in `src/features/`.

4 real screens — institutional landing (with a live health check), login
(real Sanctum, RHF + Zod, accessible error summary), role-filtered portal
shell, branded 404. Plus 18 reviewed shadcn components (12 from Phase 3 + 6
added in Phase 5: Table, Select, Dialog, Alert Dialog, Pagination, Toaster),
a strict-Zod API client with PATCH/DELETE support, and TanStack Query.

29 of 40 modules are real workspaces wired to live API data on `main`; 33 of
40 on `phase-7c-dashboards` (uncommitted) — see the Portal Feature Matrix
above. The remaining 7 stay placeholders, genuinely §17-blocked. Every
non-auth, non-health resource group in the route inventory now has at least
one UI consumer.

There is one auth path. The dev-only demo mode and its committed credential
file were deleted in Phase 3.

## Documentation

13 ADRs · `docs/api/openapi.yaml` (Redocly clean) · `docs/api/error-contract.md` ·
7 merged data-dictionary pages plus the Phase 4
`cross-cutting-backend.md` · `docs/testing/SEEDED_IDENTITIES.md` (the only
credential doc) · `docs/history/2026-07-session-log.md` (Phase 5's
task-by-task record) · `docs/reference/README.md` (Phase 6 — provenance for
the two real CCS block-section spreadsheets). `HANDOFF.md` was retired
2026-07-29 — this file is the sole progress/handoff document, per
`AGENTS.md`.

---

# ■ Operational Cautions

Hard-won constraints that will bite again. Read before touching the relevant area.

**MariaDB — never issue a schema-wildcard `GRANT`.** `GRANT … ON db.*` against
the local XAMPP MariaDB 10.4.32 has crashed the server twice
(`VCRUNTIME140.dll`). Use **table-level grants only**, run `CHECK TABLE` on the
privilege tables first, and check the Windows Event Log after. `GRANT` takes
effect immediately — `FLUSH PRIVILEGES` is unnecessary and was implicated in
one crash. Never stop, reconfigure, or upgrade `C:\xampp\mysql`.

**A green test suite does not prove the real dev database works — verify
migrations and grants separately.** `php artisan test` runs entirely against
`grc_enrollment_test`/`grc_test`; the actual running application uses
`grc_enrollment`/`grc_app` (per `.env`) and `grc_migrator` for schema changes
(per `config/database.php`'s `mariadb_migrator` connection —
`php artisan migrate --database=mariadb_migrator`, not the default
connection, which lacks CREATE/ALTER/DROP by design). These two databases can
silently drift: Phase 4's 5 migrations sat merged and 519/519-tested for a
full session while the real dev DB never received them or the matching
`grc_app`/`grc_migrator` grants, so the running application 500'd on every
audited write until this was caught by a live HTTP check and fixed
2026-07-29 (see the Phase 5 Technical Decisions entry). After any migration,
confirm with `php artisan migrate:status --database=mariadb_migrator`
against the real dev DB, not just a green test run. New table-level grants
follow the same safe procedure as above and can be pre-issued on a table
name that doesn't exist yet — MariaDB does not require the object to exist
first for a table-level `GRANT`.

**Sanctum guard caching — one authenticated actor per test method.** Chaining
`withToken()` across different users inside a single test method silently keeps
the *first* user; `forgetGuards()` does not help. This has cost time three
times. Create precondition state directly via Eloquent and authenticate once.
Treat it as a structural constraint of this suite, not a bug to re-diagnose.

**Larastan level 8 — `Collection::map()->all()` is not a `list<>`.** Wrap in
`array_values(...)`, which has an explicit "always returns a list" stub.
`Collection::values()->all()` alone does not satisfy it.

**Port 8000 may hold an unrelated process.** A pre-existing `php.exe` listener
this session did not start has appeared three times. Use an alternate port
(8100 worked) rather than killing an unknown process.

**Guest redirects must stay null.** `redirectGuestsTo(fn () => null)` is set
application-wide; without it any `auth:sanctum` route 500s for a caller that
omits `Accept: application/json`.

**`PRD(1).md` is a stale duplicate — do not read it.** It was byte-identical to
`PRD.md` until the v3.2 amendment; it is now out of date. `PRD.md` is the sole
source of truth per `AGENTS.md`.

**`npm audit` needs two `overrides` to stay clean.** Next 16.2.12 pins
`postcss@8.4.31` and `sharp@0.34.5`, both carrying advisories that fail CI's
`--audit-level=moderate`. `package.json` forces the patched releases. npm's own
suggested fix is a downgrade to `next@9.3.3` — never take it. Re-check on every
Next upgrade and drop the overrides once upstream ships them.

**`eslint-config-next` cannot be used on this repo.** It bundles
`eslint-plugin-react@7.37.5`, whose peer range stops at ESLint 9.7, so it
crashes ESLint 10 with `contextOrFilename.getFilename is not a function`. No
override fixes it — the plugin has no ESLint 10 release. It also drags in a
`brace-expansion` advisory chain. See the comment in `eslint.config.js`.

**Seeded identities use the shared password `password`.** Both user-producing
seeders are restricted to `local`/`testing` and hash the password through the
`User` model. If a `*.seed@grc.test` login still returns 401, its stored hash
predates this policy — re-run `php artisan db:seed`. The seeders are
idempotent and do not delete unrelated users.

**PHP's `json_encode` drops the `.0` from a whole-number float — write test
assertions against `3`, not `3.0`.** A `decimal`-backed Eloquent attribute
cast to `'float'` (e.g. `Enrollment::total_units`) serializes a value of
exactly `3.0` as the JSON literal `3`, which `json_decode(..., true)` then
returns as a PHP `int`. `assertJsonPath('data.total_units', 3.0)` fails with
"asserting that 3 is identical to 3.0" even though the API is correct — use
`3` (or, better, exercise a genuinely fractional value like `4.5` so the test
actually proves decimal precision survives the round trip). Cost real time
in Phase 6's `EnrollmentsEndpointTest`.

**`npm test` (default Vitest parallel workers) is flaky on this machine —
use `npx vitest run --no-file-parallelism` for a trustworthy result.** Five
full-suite runs during Phase 5 Task 9 failed a variable 2–27 of 216 tests, a
different subset each time (`waitFor`/`findBy` timeouts), on a machine
observed with only ~6 GB free memory. Every failing test passed individually,
and the sequential invocation passed clean (38 files / 216 tests) twice in a
row. Do not treat a lone `npm test` failure on this machine as a regression
without reproducing it under `--no-file-parallelism` first. Not observed as
a CI problem (GitHub Actions' Frontend job is green); do not change
`vitest.config.ts`'s shared defaults over a local-machine artifact.

---

# ■ Open Institutional Decisions (PRD §17)

**Do not hardcode these.** Where a mechanism is needed before the value is
confirmed, implement the mechanism and flag the value — the pattern already
used for section viability thresholds.

| Unconfirmed decision | Blocks |
|---|---|
| Official passing-grade rule, special marks, equivalent grades | Phase 6 — **mechanism implemented** (`config/enrollment.php`, `PrerequisiteEvaluator`), pre-populated with the user's 2026-07-30 direction; still needs formal GRC sign-off (FR-ENR-002) |
| Maximum regular units and overload approval workflow | Phase 6 — **mechanism implemented**, both caps default `null` (unenforced) until GRC sets a value; no overload approval workflow exists (FR-ENR-004) |
| Regular/irregular student classification and block-section reservation | Phase 6 — **mechanism implemented** (`sections.is_block_exclusive`, `student_profiles.enrollment_category`), comparison uses a documented placeholder string pending GRC's real vocabulary (FR-ENR-011) |
| Section-viability threshold and exception authority | Phase 2 (implemented informational-only) |
| Room capacity source and conflict rules | Phase 2 (deliberately out of scope, ADR 0010) |
| Enrollment reservation timeout and seat-release rules | Phase 6 — reservation timeout still unimplemented (seats are reserved immediately and permanently on submission). Phase 7b — **withdrawal seat release mechanism implemented**, config-flagged (`enrollment.withdrawal.releases_seats`, default `true`); not yet confirmed as institutional policy |
| Cross-institution grade/credit equivalence for transferee credits | Phase 7b — **mechanism implemented** (record, audit, display only); `source_grade` stays a free string with no equivalence rule, and approved credits never feed `BuildEligibleSubjectPool` |
| Queue-ticket reset, priority, "how many serving at once" | Phase 7a — **mechanism implemented** (`waiting`→`serving`→`served` two-step order only); no reset cadence, priority rule, or single-active-ticket constraint enforced |
| Registrar Head's "authorized edge case" scope for override/void (PRD §3.7) | Phase 7a — **mechanism implemented** (`void` scoped to `pending_payment` only); documented as a scope choice, not confirmed policy, in `EnrollmentPolicy::void` |
| Payment confirmation required fields and supporting references | Phase 7a — **mechanism implemented** (`external_reference`/`amount` both optional); no required-field rule or currency/rounding policy enforced |
| Whether COR and COM are distinct artifacts | Phase 7a landed the COM API; still unresolved — `enrollment_documents.document_type` stays deliberately single-valued (`com`) |
| COM format, numbering, signatures, retention | Phase 7a — **mechanism implemented** (opaque `COM%06d` number, `storage_path` stays null, structured data rendered client-side); no PDF pipeline, signature, or retention rule exists |
| "Stuck student" dwell-time threshold (PRD §3.5's "stuck-student reports" — the phrase appears twice in the whole PRD, with no duration, status set, or threshold) | Phase 7c — **mechanism implemented** (`config('dashboard.stuck_threshold_days')`, default `null`); every in-progress enrollment's dwell time renders unconditionally (arithmetic), but no row is labeled "stuck" until GRC sets a value — this question was never even registered in §17 before now |
| Which policy values are Registrar-Head-editable, and via what UI | Phase 7c — `policy-settings` ships **read-only**; deciding this needs a settings-table design this phase deliberately did not build (today every value is env-var-only) |
| Honors cutoff, disqualifying grades, tie handling | Phase 9 |
| Government report fields, format, naming, sign-off | Phase 9 |
| Attrition intervention workflow and authorized viewers | Phase 9 |
| Prediction refresh cadence | Phase 9 |
| Token lifetime and session-equivalent UX | Phase 1 (provisional 480 min) |
| Password and account recovery policy | Phase 1 (deferred) |
| Data retention, archive, backup, disposal schedules | Phase 10 |
| Hosting environment and supported browsers | Phase 10 |

The one value the PRD *does* state (§4.1): a section below the viability
threshold — **currently documented as 25 students** — must not be published
without an audited exception.

---

# ■ Decisions and Assumptions

Newest first. Full reasoning for older entries is in
`docs/history/2026-07-session-log.md`.

| Date | Decision | Reason |
|---|---|---|
| 2026-07-31 | Recompute Row 10 (verification & deployment) from 25% to 35%, moving overall completion from 73% to 74%. Row 8 (nine role portals) stays at 73% pending merge. | Phase 8a, 8b, and 8c are all now merged to `main` (`6d1745b` for 8c); Row 10's bump reflects Phase 8c's E2E foundation specifically. Row 8's 4 newly-connected Phase 7c modules (→83%) are not counted until `phase-7c-dashboards` merges, per the table's own "merged, not written or planned" rule. |
| 2026-07-31 | Build Phase 7c as factual-only dashboards plus a flagged dwell-time threshold, rather than treating the whole slice as blocked. | User's explicit choice via `AskUserQuestion`, after a full PRD audit found only the "stuck" threshold and the report-content modules were genuinely undecided — the dashboards' row counts are arithmetic over PRD-authoritative status enums, not institutional judgment. Follows the project's own established mechanism-implemented/value-flagged pattern (`max_regular_units`, `sections.viability_threshold`). |
| 2026-07-31 | Give Dean and Executive Director aggregate-only dashboard endpoints (counts, never rows) instead of widening `Enrollment::scopeVisibleTo`/`EnrollmentPolicy::viewAny()` to include them. | Both roles currently have zero read access to enrollment records. Widening the existing scope would hand both roles row-level access to every student's enrollment, which PRD §3.6 ("cannot alter detailed student academic records unless separately authorized") and §9.4 constrain against. New `DashboardPolicy`-gated `DB::table(...)` aggregation Actions avoid touching the existing authorization boundary at all. |
| 2026-07-31 | Scope `stuck-students` to `Draft`/`PendingRegistrarApproval`/`PendingPayment`, not `Enrollment::scopeActive()`. | Live-data inspection against the dev database showed `active()` (which also includes `Enrolled`) surfaced already-enrolled students as "stuck" candidates — semantically wrong, since they've completed the process. The narrower scope is derived directly from the PRD-authoritative lifecycle order, not a new institutional definition; the threshold that labels dwell time "stuck" stays separately §17-flagged. |
| 2026-07-31 | Ship `policy-settings` read-only, backed by a hardcoded list of `PolicyValueState` entries rather than a settings table. | Making it writable requires deciding which values are Registrar-editable at runtime — an unmade institutional decision — and every value today is env-var-only with no settings-table schema. The module's own description already promised "see where confirmed values will eventually be configured," not edit them. |
| 2026-07-31 | Correct ADR 0016 decision 8's claim that no module id reaches `ScheduleDecisionWorkspace` for `executive_director`, and fix the real bug found tracing it. | User's explicit choice via `AskUserQuestion` ("fix both"). Direct re-verification against the component tree showed the claim was false (`MasterScheduleWorkspace` already embeds the same controls); the actual defect was both cards sharing one `AsyncBoundary` gated on `published.length === 0`, hiding the Executive Director's approval controls whenever no section was yet published. |
| 2026-07-30 | Recompute Row 5 (Process 3.0 backend) from 70% to 95%, and Row 8 (nine role portals) from 58% to 73%, moving overall completion from 67% to 73%. | Row 5: all 5 of Process 3.0's subprocesses complete except the tail forwarding attrition events to Process 4.0, deferred to Phase 9. Row 8: 29/40 modules connected. No other row's weight or Done% changed. |
| 2026-07-30 | Split the remainder of Phase 7b again: deliver withdrawal/transferee-credit/class-roster APIs plus the Registrar Staff and Faculty portal modules ("records core") this session; defer the Dean/Executive Director dashboards to a new "Phase 7c". | User's explicit scope choice via `AskUserQuestion`. The dashboards are the only part of the original Phase 7b scope with no PRD-specified content (FR-ANL-003 is the sole substantive requirement, deferred to Phase 9/Process 4.0) — building them now would mean inventing institutional definitions, which `AGENTS.md` forbids. |
| 2026-07-30 | Gate withdrawal seat release behind `config('enrollment.withdrawal.releases_seats')`, default `true`; drop the `enrollment_subjects` row unconditionally either way. | User's explicit choice via `AskUserQuestion`. Seats are reserved immediately and permanently on submission today, so *not* releasing them on withdrawal would permanently inflate `enrolled_count` and wrongly block other students — but whether release is the confirmed institutional policy is still §17-open, so it's mechanism-implemented, value-flagged, the same shape as `max_regular_units`. |
| 2026-07-30 | `TransfereeCredit` approval never feeds `BuildEligibleSubjectPool`; the pool keeps reading only locked `academic_grades`. | User's explicit choice via `AskUserQuestion`. Cross-institution grade equivalence is an open PRD §17 decision — a foreign "1.50" must not silently unlock a local subject's prerequisite. Proven live: approving a credit mapped to a subject's own prerequisite left the dependent subject's eligibility verdict unchanged. |
| 2026-07-30 | Seed the "other actor's" data directly via Eloquent in `WithdrawalRequestsEndpointTest`/`TransfereeCreditsEndpointTest` rather than a second login+HTTP-submit within one test method. | Root-caused a 403-vs-200 test failure to a documented Sanctum gotcha: chaining `withToken()` for two different actors in one test silently reuses the first actor's cached guard resolution. `EnrollmentsEndpointTest.php` already recorded this fix (`makeEnrollment()`'s docblock); the new withdrawal/transferee-credit tests hadn't yet applied it. |
| 2026-07-30 | `RegistrarRecordsWorkspace` renders only the module matching `initialModuleId`, unlike `AccountingPaymentWorkspace`/`AdmissionProvisioningWorkspace` which always render every card. | Those two workspaces' modules are sequential steps of one flow; Registrar Staff's four (Credit Mappings, Drops & Withdrawals, Academic Records, Enrollment Documents) are unrelated record types — showing all four on every visit would cram four unrelated tables onto one screen. Every query hook is still called unconditionally per the Rules of Hooks; only the inactive ones are `enabled: false`. |
| 2026-07-30 | `GradeSubmissionWorkspace` populates its per-section student list from the new class-roster read rather than a new student-search UI. | No student-directory endpoint exists anywhere in this API; the roster already returns exactly the (student_id, student_number) pairs a section needs, and Faculty already reads it for the Class Rosters module. |
| 2026-07-30 | Split Phase 7 into 7a (money path: grade encoding → approval → payment → COM) and 7b (transferee credits, withdrawal, remaining portals), and deliver only 7a this session. | User's explicit choice via `AskUserQuestion` when the phase-7 plan was scoped, given the full phase's size (5 DFD subprocesses, 10 FR-FIN requirements, 16 modules across 7 roles). |
| 2026-07-30 | Scope Registrar Head's `void` action to `pending_payment` only, not any pre-`enrolled` state. | PRD §3.7's "authorized edge cases" has no further definition. A narrow, documented scope avoids overlapping `registrar_reject` (pre-approval) or the Phase 7b withdrawal flow (post-`enrolled`), and avoids asserting an unconfirmed institutional policy as fact. |
| 2026-07-30 | `ConfirmPayment` checks for an existing `Payment` row *before* checking the enrollment's current status. | A repeat confirmation call naturally arrives after the enrollment has already moved to `enrolled` — checking status first would incorrectly reject a call FR-FIN-009 requires to succeed idempotently. Proven live: a second call with different, contradictory input returned the original record unchanged. |
| 2026-07-30 | Update `docs/data-dictionary/enrollment-records.md`'s existing scope note rather than create a new Process-3.0 data-dictionary page. | All 6 tables Phase 7a gave an API to were already fully documented there as schema-only groundwork from an earlier phase; a new page would have duplicated that schema documentation. |
| 2026-07-30 | Recompute Row 5 (Process 3.0 backend) from 15% to 70%, and Row 8 (nine role portals) from 38% to 58%, moving overall completion from 55% to 67%. | Row 5: 4 of Process 3.0's 5 subprocesses complete, only transferee credits/withdrawal (3.2) deferred to Phase 7b. Row 8: 23/40 modules connected. No other row's weight or Done% changed. |
| 2026-07-30 | Merge `phase-7-process-3` into local `main` **and** push to `origin/main`. | Explicit user authorization given at the start of this session ("yes proceed to pushed to origin") — unlike every prior phase, this was a direct instruction, not an extrapolation from a general merge authorization. |
| 2026-07-30 | Ingest only `code`/`title`/`units` from the user's two real CCS block-section spreadsheets, as an additive seeder alongside the existing synthetic catalog. | User's explicit choice among three CSV-scope options. Schedule/room/faculty/modality columns were out of Phase 6's DFD 2.2/2.4 scope; replacing the synthetic catalog would have broken 500+ existing tests and 4 demo student lifecycles for no Phase 6 benefit. |
| 2026-07-30 | Pre-populate `config/enrollment.php`'s grading comparison with the user's explicit direction (3.00 passing / 5.00 failing, lower-is-better, INC/NC) rather than leaving it null by default. | User's explicit Phase 6 planning direction, distinct from formal GRC §17 sign-off — recorded as such in the config file's own docblock. Makes the system demonstrable end to end while keeping `PrerequisiteEvaluator`'s `needs_verification` fallback real, tested, and reachable by clearing the value. |
| 2026-07-30 | Use a documented placeholder string (`'irregular'`) for FR-ENR-011's block-section comparison rather than inventing a confirmed regular/irregular enum. | The approved schema (`is_block_exclusive` bool, `enrollment_category` free string) gives no reference value to compare against. Matches the existing `CurriculumSeeder::PLACEHOLDER_MINIMUM_GRADE` pattern — demonstrable and testable without asserting GRC's real vocabulary. |
| 2026-07-30 | Defer FR-ENR-003's cross-section conflict exclusion from the eligible-pool endpoint (Task 4) to the submission endpoint (Task 5). | The acceptance criterion is "cannot be *submitted* together" — there is no draft-selection state at pool-view time for two sections to conflict against. `SectionConflictDetector` (reused unchanged from Phase 2) runs pairwise across the submitted set at submission instead. |
| 2026-07-30 | Recompute Row 4 (Process 2.0 backend) from 25% to 80%, and Row 8 (nine role portals) from 33% to 38%, moving overall completion from 48% to 55%. | Row 4: 3 of DFD 2.1–2.4's four subprocesses are complete, the 4th (ML recommendation) deliberately deferred to Phase 9 — the same shape already recorded for Row 3. Row 8: 15/40 modules connected. No other row's weight or Done% changed. |
| 2026-07-30 | Merge `phase-6-process-2` into local `main` without pushing to `origin/main`. | Same user-scoped authorization pattern as every prior phase: finish the task, commit, merge locally; push needs separate explicit authorization. |
| 2026-07-29 | Retire `HANDOFF.md`; fold its verified content into `PROGRESS.md` and delete it. | Two competing handoff documents had drifted — `main`'s said Phase 4 was the active objective, the branch's said "stopped, do not resume Task 9" — while `PROGRESS.md` was three phases stale on `main`. `AGENTS.md` already designates `PROGRESS.md` as the update target at every milestone; a second file undermines that. User's explicit choice among three options offered at takeover. |
| 2026-07-29 | Recompute Portal-row (row 8) Done% from 5% to 33% (13/40 modules), moving overall completion from 41% to 48%. | Phase 5 landed 13 of 40 modules fully wired to live APIs, not scaffolding. No other row's weight or Done% changed; per the standing recompute rule, only a closed phase's own row moves. |
| 2026-07-29 | Merge `phase-5-portal-workspaces` into local `main` without pushing to `origin/main`. | User-scoped authorization at takeover: finish Task 9, commit, merge locally; push requires separate explicit authorization not given in this session. |
| 2026-07-29 | Document the Vitest full-parallel-worker flakiness as an Operational Caution rather than changing `vitest.config.ts`. | Five full-suite runs failed a different 2–27-test subset each time on this ~6 GB-free machine; every failing test passed alone, and `--no-file-parallelism` passed clean twice. The cause is machine memory pressure, not the tests or the code; CI is unaffected. Changing shared test-runner defaults for a local-machine artifact would slow every future run for no correctness benefit. |
| 2026-07-29 | Give every local/testing synthetic login the shared password `password`; retain the production-environment refusal and hashed storage. | Explicit user direction to make switching among all nine role portals easy during development. The full dataset applies the same password to its additional student scenarios. |
| 2026-07-28 | Extract `demoRoles`, the session/credential/gateway types and `DemoAuthError` out of the `demo-*` modules **before** deleting them. | They were not demo-only despite the naming: `demoRoles` is the runtime enum validating *real* API responses in `auth-schema.ts`, and `DemoAuthError`/`DemoSession` were used by the live API gateway. Deleting the files first would have broken production code. |
| 2026-07-28 | Assert routing in tests via the mocked router's calls rather than a rendered URL. | The App Router has no `MemoryRouter`, so real URL changes are not observable in jsdom. Guards are asserted on the redirect they *request*; true end-to-end routing moves to Playwright in Phase 8, which PRD §14.3 requires anyway. |
| 2026-07-28 | Pin `postcss` and `sharp` through `overrides` instead of accepting Next's pinned versions. | Next 16.2.12 ships versions with advisories that fail CI's `npm audit --audit-level=moderate`; npm's suggested fix is a downgrade to `next@9.3.3`. Both patches are semver-compatible and already elsewhere in the tree. |
| 2026-07-28 | Do not adopt `eslint-config-next`. | It bundles `eslint-plugin-react@7.37.5`, which has no ESLint 10 support and crashes the lint run. The existing type-checked `typescript-eslint` + `react-hooks` rules are stricter than what it would have added. |
| 2026-07-28 | Reorganise the roadmap into 11 execution phases, moving all machine learning to Phase 9. | User direction: make the whole system functional first. Each earlier phase now carries an explicit ML data-capture obligation so Phase 9 builds models, not plumbing. |
| 2026-07-28 | Migrate the frontend from Vite/React to Next.js, and amend PRD §1.2/§6.1/§7/§7.3 accordingly (PRD → v3.2). | User direction. Realigns with the manuscript's original architecture diagram, which the PRD had deliberately overridden. PRD §18 requires the document be updated when architecture changes. Also touched `README.md`'s architecture block — one line, same decision, forward-pointing note only since the migration has not run yet. See ADR 0013. |
| 2026-07-28 | Use Next.js as a client-rendered application only — no SSR of authorized data, no server session, no API proxying. | Preserves ADR 0001's independently-runnable service boundary and PRD §9.1's bearer-token rule. Next.js is adopted for routing and build pipeline, not to move computation to a Node server. |
| 2026-07-28 | Keep the bearer token in `localStorage` under Next.js rather than moving to an httpOnly cookie. | Preserves the proven Sanctum flow and stays compliant with PRD §9.1's explicit no-cookie/no-`withCredentials` rule. Server-side route protection is given up knowingly; guards stay client-side. |
| 2026-07-28 | Delete the frontend demo auth mode rather than porting it. | It predates real authentication; nine seeded database identities now cover the same need. Vite's `MODE === "test"` guard has no exact Next equivalent, and porting it wrong would make a committed password a valid production login. |
| 2026-07-28 | Build portals for backend-ready roles (Phase 5) before completing Process 2.0. | 22 endpoints are merged with no UI. Five portals can become functional with zero new backend work — the fastest path to a demonstrably working system. |
| 2026-07-28 | Archive the session log and failure record to `docs/history/` instead of deleting or keeping them inline. | 1,350 of 2,255 lines were historical narrative, making `PROGRESS.md` unusable as a tracker. Nothing is lost; the detail is one link away. |
| 2026-07-28 | Score completion with a published weighting table rather than asserting a single number. | The percentage must be auditable and challengeable, and recomputable as each phase closes. |
| 2026-07-28 | `StudentProfilePolicy::view()` gets no broader role visibility — own-record only. | Nothing in PRD §3 grants any role read access to *other* students' profiles; inventing one would be scope creep beyond DFD 2.1. |
| 2026-07-28 | Provision `User` + `StudentProfile` together in one transaction. | PRD §3.2 makes it one Admission Staff responsibility, and no `POST /users` endpoint exists to support a two-step flow. |
| 2026-07-28 | Pause the `ml-service` CI investigation. | Explicit user direction after two hypotheses were ruled out. Resumes in Phase 9. |
| 2026-07-28 | Scope `SectionConflictDetector` to same-professor double-booking only. | Neither the schema nor the seed data evidences room or availability matching as a hard rule; inventing either would repeat the §17 mistake. ADR 0010. |
| 2026-07-28 | Adopt rather than discard the 43-file untracked scaffold found in the working tree. | A full read-through confirmed it matched this codebase's conventions. User's explicit choice among three options. |
| 2026-07-27 | Build authorization as `role` middleware **and** Policies, with row filtering in query scopes. | PRD §9.4 requires both role-level and record-level access; a Policy cannot filter a collection. Sets the pattern for ~40 future endpoints. ADR 0008. |
| 2026-07-27 | Use the existing XAMPP MariaDB 10.4.32 instead of an isolated MySQL 8.4 instance. | User's explicit choice after four review rounds on 2,628 lines of never-executed lifecycle PowerShell. ADR 0007. |
| 2026-07-26 | Use Laravel 12.64 as a short-lived bridge. | PHP 8.2.12 cannot run Laravel 13; production planning must upgrade PHP and re-evaluate. ADR 0002. |

---

# ■ Session History

Full detail in **`docs/history/2026-07-session-log.md`**.

| Date | Slice | Outcome |
|---|---|---|
| 2026-07-26 | Repository, PRD canonicalisation, three service shells | Merged |
| 2026-07-26 | Landing, login, demo portal (nine roles) | Merged |
| 2026-07-27 | MySQL 8.4 isolated-instance plan | **Abandoned** → ADR 0007 |
| 2026-07-27 | MariaDB identity foundation + Sanctum auth | Merged |
| 2026-07-27 | Authorization foundation and reference data | Merged (ADR 0008) |
| 2026-07-27 | Curriculum catalog + prerequisite cycle rejection | Merged (ADR 0009) |
| 2026-07-28 | Untracked 43-file scaffold audited and adopted | Merged |
| 2026-07-28 | Schedule + enrollment schema foundation (13 tables) | Merged |
| 2026-07-28 | Faculty input API | Merged |
| 2026-07-28 | Section planning API | Merged (ADR 0010) |
| 2026-07-28 | Schedule approval workflow API | Merged (ADR 0011) |
| 2026-07-28 | CI quality gates | Merged (ADR 0012); ml-service job fails, paused |
| 2026-07-28 | Student profile foundation (DFD 2.1) | Merged; CI-confirmed green |
| 2026-07-28 | Roadmap replan, Next.js decision, PROGRESS restructure | Merged (ADR 0013); PRD → v3.2 |
| 2026-07-28 | Phase 3 — Next.js migration | Merged; 145/145 tests, live proof 17/17 |
| 2026-07-28 | Phase 4 — Cross-cutting backend & ML substrate | Merged; 503/503 backend tests |
| 2026-07-29 | Phase 5 — Portals over existing APIs (9 tasks, 6 roles, 13 modules, 1 new endpoint) | Merged; backend 519/519, frontend 216/216 |
| 2026-07-30 | Phase 6 — Process 2.0 + Student Portal (9 tasks, 2 modules, 3 new endpoints, real GRC CCS catalog) | Merged; live-verified; backend 563/563, frontend 224/224 |
| 2026-07-30 | Phase 7a — Process 3.0 money path (9 tasks, 8 modules, 8 new endpoints, idempotent payment confirmation) | Merged `fc56148`; live-verified; backend 605/605, frontend 243/243 |
| 2026-07-30 | Phase 7b — Transferee credits, withdrawal, Registrar Staff portal (8 tasks, 6 modules, 7 new endpoints, idempotent withdrawal seat release) | Merged; live-verified; backend 641/641, frontend 243/243 |
| 2026-07-31 | Phase 8a — Accessibility & required states (PRD §12.3–§12.5) | Merged `8bb7e66` |
| 2026-07-31 | Phase 8b — Portal UI coherence & motion (shared header, form control migration, `motion` library) | Merged `2da5501` (ADR 0015) |
| 2026-07-31 | Phase 8c — Playwright E2E foundation (13 of 15 critical journeys, `@axe-core/playwright`, 2 real defects found and fixed) | Merged `6d1745b` (ADR 0016) |
| 2026-07-31 | Phase 7c — Factual dashboards, dwell-time signals, policy visibility (4 modules connected, ADR 0016 correction + real bug fix) | This entry; live-verified; backend 656/656, frontend 376/376, E2E 20/21 (1 skipped) |
## 2026-08-02 — Registrar close option removed

- Removed the visible `Close` action from the Registrar Enrollment workspace;
  `Archive` is now the only lifecycle action shown for ongoing or closed terms.
- Archive closes an ongoing term and archives it in one transaction; the lower-
  level close action remains available only for backward-compatible service/API
  callers.
- Updated the enrollment specification and implementation plan so the visible
  lifecycle is Archive-only while preserving the compatibility transition.

## 2026-08-02 — Registrar term form fields simplified

- New-term creation now accepts and displays only School Year, Semester,
  Enrollment start, Enrollment deadline, and Add/drop/Change subject deadline.
- Term start/end and grading deadline are no longer required for new terms;
  nullable legacy columns remain available in historical responses.
- Verification: frontend typecheck, lint, and AcademicTermWorkspace tests (4/4),
  PHP syntax checks, OpenAPI lint, and `git diff --check` passed.

## 2026-08-02 — Program Chair section planning slice

- Implementing the approved guided year-level block-section flow, subject
  release, manual schedule visualization, and Dean/Executive approval handoff.
- CCS remains intentionally empty for manual testing; non-CCS approval samples
  will be local-only fixtures. Predictive generation and Google Classroom stay
  out of scope.
- Submitted section plans are now locked against further Program Chair edits;
  modality persistence and college/curriculum scoping are enforced server-side.
- Narrowed the frontend lifecycle mutation to the supported `archive` action and
  added a focused UI test covering the visible action and request payload.
- Verification: frontend typecheck, lint, and the focused AcademicTermWorkspace
  suite pass (4 tests); OpenAPI lint and `git diff --check` pass. The focused
  backend transition feature test remains blocked by the pre-existing test DB
  grant for `grc_test` (`CREATE` denied on `subject_offerings`).

### Completion notes

- Added the section-plan schema, college-scoped routes/policies, transactional
  block-section release, idempotent approval handoff, audit event, modality
  persistence, and local mixed approval fixtures (CCS intentionally empty).
- Program Chair now has a compact 1st–4th year → Review → Approval flow,
  current-term/active-curriculum release, faculty preference filtering, manual
  day/time/room/modality editing, 30-minute Monday–Saturday timetable, and
  confirmation before Dean/Executive submission. AI and Google Classroom stay
  visibly unavailable by design.
- Verification: backend PHP syntax and route checks pass; all 149 backend unit
  tests pass; frontend lint/typecheck pass; all 35 portal test files pass (149/149);
  OpenAPI lint passes. Feature tests using `RefreshDatabase`
  remain blocked by the local `grc_test` privilege setup, not by assertions.

## 2026-08-02 — Program Chair generated-block presentation correction

- Reworking the generated-subject display into year filters, spreadsheet-style
  block tables, and a focused schedule-assignment dialog; no Google Classroom
  field is included.
- The first combined verification command was invoked from the repository root
  rather than the independent `frontend/` and `backend/` applications, so it
  failed only because `package.json` and `artisan` are not present at that
  level. The focused frontend test suite remains green; rerunning scoped
  checks from their correct application directories is in progress.

### Completion notes

- Generated blocks now use the requested institutional names: IT, EDUC, ACC,
  or the matching CBAE-major prefix (FM, EN, MM, HR), followed by year and
  two-digit block ordinal (for example `IT101`, `IT102`, and `FM201`).
- After release, the Program Chair sees clickable 1st–4th Year filters, grouped
  spreadsheet-style tables by block, and an optional tile layout. Each subject
  opens a focused modal for professor, day, time, room, and modality—without a
  Google Classroom field.
- Verification: frontend typecheck and lint pass; all 35 Program Chair portal
  test files pass (151 tests); all 151 backend unit tests pass (321 assertions);
  PHP syntax checks and `git diff --check` pass.

## 2026-08-02 — CSV curriculum-year and add-section correction

- Investigating the reported missing 3rd/4th-year subjects and blank units in
  generated blocks. The supplied CSV carries the year/section information in
  its `sections` column, while the existing importer defaulted every placement
  to year 1.
- Planned correction: derive placement year and semester from the CSV,
  attach the catalog placements to the active local curricula, merge them with
  any manually configured subject offerings, remove stale legacy `1A`-style
  generated blocks during release, and add a scoped `Add section` action.
- A first read-only local row-count probe via `artisan tinker` used an
  incorrectly escaped namespace and failed before executing the query; no
  database state was changed. The scoped unit/frontend tests are green, and
  the probe will be rerun with a simpler expression.
- The CSV seeder feature test remains blocked before assertions by the
  pre-existing `grc_test` MariaDB privilege (`CREATE` denied on
  `academic_term_current_slots`). The local development database seeder ran
  successfully and verified BSCS placement counts across all four years.

### Completion notes

- Added CSV section metadata parsing and a curriculum-placement seeder. The
  supplied catalog now contributes subject units, year levels, and multi-term
  coverage to active local curricula; the development DB was reseeded.
- Release now merges manual subject offerings with every matching curriculum
  placement, so one configured subject cannot suppress 3rd/4th-year rows.
- Legacy generated `1A`/`2A`-style identifiers are hidden in the Program Chair
  view and removed within the scoped section-plan transaction before current
  catalog blocks are released.
- Added `Add section` beside the year filters; it increments only the selected
  year and idempotently releases the next block code.
- Verification: frontend typecheck/lint pass; all 35 portal test files pass
  (152 tests); backend unit tests pass (153 tests, 327 assertions); PHP syntax
  and `git diff --check` pass. The CSV feature suite remains blocked only by
  the existing test-database CREATE privilege described above.

## 2026-08-02 — Per-year curriculum selection correction

- Replacing automatic active-curriculum selection with an explicit required
  choice for each year level. The choice displays curriculum effectivity and
  a plain-language New/Old label; section counts are saved and released
  against the selected curriculum(s), preserving the existing approval flow.
- Backend syntax and unit tests pass. The first OpenAPI lint command used the
  backend working directory for a repository-root spec path, so Redocly could
  not locate the file; it will be rerun from the repository root.

### Completion notes

- Program Chairs now explicitly select one active curriculum for every year
  level before saving its section count. No curriculum is selected by default.
- Each option displays its effective school year and New/Old state; the review
  screen retains that context before release. Plans are grouped, released, and
  submitted per selected curriculum so year levels may intentionally use
  different curriculum versions.
- Verification: frontend typecheck/lint pass; all 35 portal test files pass
  (153 tests); all backend unit tests pass (153 tests, 327 assertions); PHP
  syntax, OpenAPI lint, and `git diff --check` pass.

## 2026-08-02 — Section decrement control

- Adding a Remove section action beside Add section. A first combined check
  correctly passed PHP syntax but attempted npm commands from `backend/`,
  where no `package.json` exists; no frontend tests ran in that command.
- A follow-up combined check repeated that directory mistake; PHP syntax passed
  and the npm portion did not execute. No source or database state changed.
- The same backend-directory command also could not locate the repository-root
  OpenAPI file; backend unit tests passed independently and the spec will be
  linted from the repository root.

### Completion notes

- Added `Remove section` beside `Add section`; it decrements only the selected
  year level and releases the reduced block count.
- Backend removal is guarded against assigned faculty, meeting details,
  published sections, or enrolled students. Such a reduction returns a clear
  validation error instead of deleting active scheduling data.
- Empty year tabs now show the saved block count plus `Generate subjects for
  <year>`; release accepts an optional year-level target so one year can be
  generated without rerunning the other three.
- Verification: all 35 portal test files pass (153 tests), backend unit tests
  pass (153 tests, 327 assertions), and `git diff --check` passes.

  Latest verification after the year-specific action: portal tests 154/154,
  backend unit tests 153/153, OpenAPI lint, PHP syntax, and diff check pass.

## 2026-08-02 — Section-plan generation fix

- Fixed the release transaction to capture the optional year-level filter. This prevented a valid four-year review from reading its saved plans and caused the generic curriculum/count warning when generating subject lists.
- Confirmed the prior runtime failure in the local log (`Undefined variable $yearLevel` in `SaveSectionPlan::release`). Verification after the fix: PHP syntax check passes and backend unit tests pass (153 tests, 327 assertions).

## 2026-08-02 — Room catalog and CSV faculty seed

- Starting a local/test-only room catalog for Program Chair schedule assignment. Each supplied room will be scoped to its permitted college(s), and the CSV faculty surnames will become deterministic synthetic Faculty records with their matching subject preferences. The existing `faculty.seed@grc.test` account will be a CCS Faculty account for manual testing.
- The new domain and frontend focused tests pass. Applying the local migration/seeds is currently blocked: both the app identity (`grc_app`) and configured migration identity (`grc_migrator`) receive MariaDB `CREATE` denied for `room_catalog_entries`. No privilege change was attempted; the pending migration and seeders can run once a database administrator restores the local DDL/DML grants.
- The CSV faculty seeder does not depend on the blocked room table and was run successfully after making per-term preference ranks unique. The local database now has 207 active Faculty records (CCS 55, COE 57, COA 37, CBAE 58), 633 subject preferences, and `faculty.seed@grc.test` is `Testing Faculty` in CCS.
- The Program Chair schedule modal now presents the matching selectable people as `Professor` consistently in both the modal and generated-section table. Focused frontend tests pass (10 tests) and frontend typecheck passes.
- Replaced the plain Professor and Room selects with searchable shadcn-compatible comboboxes. Added the required `@base-ui/react` dependency and a college-scoped local room fallback so Program Chair scheduling remains usable while the local `room_catalog_entries` migration is blocked. Focused UI/service tests pass (11 tests), frontend typecheck, and lint pass.
- Fixed the combobox selection regression: Base UI had portaled the option list outside the modal, where the Dialog correctly applied `pointer-events: none`. The popup now portals into the active schedule dialog. Regression tests click both a Room and Professor option and verify the selected input values; frontend typecheck, lint, and diff checks pass.
- Fixed schedule-save modal behavior: a successful section PATCH now closes the assignment modal immediately, while the section-list cache refresh continues in the background. A regression test holds the refresh pending and confirms the modal still closes after save; frontend tests (11), typecheck, lint, and diff checks pass.

## 2026-08-02 — Actual schedule-save authorization investigation

- The user confirmed the modal still did not close in the running portal. The
  prior component test only proved the close behavior after a successful mocked
  PATCH, so the runtime API was tested with the seeded CCS Program Chair.
- The real `PATCH /api/v1/sections/45` request returns HTTP 403 `FORBIDDEN`.
  This confirms the modal remains open because saving is rejected before the
  successful close path. The recurring `room_catalog_entries` SELECT-denied log
  is a separate room-options request and is not the schedule PATCH failure.
- An initial read-only Tinker command for the linked section plan failed because
  PowerShell expanded the inline PHP variables; no database state changed. The
  next diagnostic will use shell-safe quoting and inspect the plan ownership and
  status before changing the authorization behavior.
- Root cause confirmed: `User::college` is cast to `CollegeCode`, while
  `AcademicTermSectionPlan::college` is stored as a plain string. The Section
  policy compared them directly, so a Draft CCS plan was denied to the CCS
  Program Chair. A database-free regression test reproduced the false denial.
- Updated the policy to compare the plan string with `User::college->value` for
  both direct view and update authorization. The regression test now passes,
  including the cross-college denial case.
- Replayed the real request against the running local API as
  `chair.ccs@grc.test`: `PATCH /api/v1/sections/45` now returns HTTP 200. The
  temporary test schedule was immediately restored successfully, confirming
  that the existing frontend success path can now close the modal.
- Final verification: the focused Program Chair workspace suite passes (11
  tests), frontend TypeScript and ESLint pass, all 157 backend unit tests pass
  with 336 assertions (one pre-existing PHPUnit deprecation), and Pint passes
  for the changed policy and regression test. The database-backed feature suite
  remains unavailable because `grc_test` lacks CREATE permission in the local
  test database; this is the same local grant blocker recorded above.

## 2026-08-02 — Schedule modal validation visibility

- The new screenshot shows a 1:17 PM start and 12:15 PM end. The existing
  frontend schema correctly rejects that ordering before sending the PATCH,
  but the catch path writes its message to the page-level alert behind the open
  dialog. This makes a validation failure look like an unresponsive Save button.
- Starting a focused TDD fix: reproduce the invalid-time interaction, keep the
  modal open without issuing a request, and surface the actionable validation
  message inside the schedule dialog using the existing shadcn Alert/Field
  composition. A valid save must retain the existing close-on-success behavior.
- The invalid-time regression failed first because the dialog contained no
  explanation. The modal now marks both time controls invalid and shows `End
  time must be after start time.` directly below the end time; it does not send
  a PATCH until the ordering is corrected.
- Added a second red/green regression for API-side validation. Field-specific
  conflict messages from the API now render in a destructive Alert inside the
  still-open modal instead of being hidden in the workspace alert behind it.
- Live API verification used the screenshot's exact section 87, Professor
  ALONZO, day T, room 5F, and F2F with the corrected range 1:17 PM–2:15 PM. The
  PATCH returned HTTP 200 and the original section values were restored.
- Final verification: the Program Chair workspace suite passes all 13 tests,
  including valid close-on-save, invalid ordering, and API conflict feedback;
  frontend TypeScript, ESLint, and `git diff --check` pass.

## 2026-08-02 — Program Chair approval handoff and reviewer schedule view

- Reproduced the Program Chair submit behavior against the live API. The CCS
  term currently uses curricula 1, 2, and 4; each submit attempt returns HTTP
  422 because generated sections still lack one or more professor/day/time/
  room/modality assignments. The button appears broken because its generic
  error is rendered outside the current viewport instead of beside the action.
- Found a separate lifecycle defect: `dean_return` currently requires an
  already Dean-approved proposal and `executive_return` requires an already
  Executive-approved proposal. Reviewers therefore cannot return a proposal
  while it is actually waiting at their checkpoint. Returned proposals also do
  not currently unlock submitted section plans for Program Chair corrections.
- Starting an inline vertical-slice fix: visible submit readiness/error state,
  checkpoint-correct return-with-remarks transitions, college-scoped reviewer
  schedule details, and Dean/Executive review cards identified by term,
  department, and submitting Program Chair.
- Program Chair submission now shows the exact count of incomplete schedule
  assignments beside the approval action, disables submission until every
  generated row has Professor/Day/Time/Room/Modality, and surfaces API field
  errors at the button instead of above the viewport. The focused workspace
  suite passes all 15 tests.
- Centralized the schedule-proposal transition rules. Dean return is now legal
  while the submitted proposal is `draft`; Executive return is legal while it
  is `dean_approved`. Either return requires remarks, resets the proposal to
  Draft, unlocks the college's submitted section plans, and moves its workflow
  back to schedule preparation. A later Program Chair resubmission clears the
  old decision metadata.
- Added the proposal-scoped submitted-schedule endpoint and reviewer cards with
  department, academic term, submitter, status, a read-only schedule table,
  approval, and `Return to Program Chair` actions. Both Dean and Executive UI
  focused suites pass (11 tests total); transition-rule unit tests pass (7
  tests, 19 assertions).
- Database-backed feature verification remains blocked by the existing local
  test grant: `grc_test` receives MariaDB CREATE denied while RefreshDatabase
  creates `academic_term_current_slots`. A SQLite fallback also cannot run the
  MySQL-specific constraint migrations. No database privilege was changed.
- One route-list verification attempt used Laravel's unsupported `--columns`
  option; the plain route-list command was rerun successfully and confirms all
  four schedule-proposal routes, including the new `/sections` review route.
- A read-only Tinker diagnostic initially failed because PowerShell expanded
  inline PHP variables; shell-safe quoting was used on retry. The live database
  currently has no proposals, 12 CCS draft plans for term 5, and 48 of 49 term
  sections incomplete, which explains why the approval action must remain
  unavailable until those required assignments are completed.
- Fixed and ran the local mixed-approval sample seeder. Its first run exposed a
  duplicate faculty preference rank; sample preferences now receive unique,
  deterministic ranks and reseeding twice succeeds. The seeder also uses the
  real generated department section codes (not legacy `1A`–`4A`) and schedules
  both exact-semester and multi-semester catalog placements, so a valid sample
  can be resubmitted through the same release path as real data.
- Live Sanctum API verification now covers the complete handoff: a COE Program
  Chair submission returns proposal `draft`; Dean approval returns
  `dean_approved`; Executive approval returns `executive_approved`. Dean return
  and Executive return both preserve their remarks, reset the proposal to
  Draft, unlock all four department plans, and reset the workflow to schedule
  preparation. The sample queues were restored afterward to COE pending Dean
  and COA/CBAE pending Executive; CCS remains without a proposal for manual
  testing.
- Program Chairs now see the reviewer remarks in a prominent `Returned for
  correction` alert. Direct proposal schedule access is also college-scoped,
  so a Program Chair cannot inspect another department's proposal.
- Updated the OpenAPI contract for proposal metadata and the submitted-schedule
  endpoint. Redocly validation passes; the four schedule-proposal routes are
  registered; backend unit suite passes 165 tests/357 assertions; frontend
  typecheck and ESLint pass; the 27 focused Program Chair/Dean/Executive tests
  pass. The unconstrained 75-file frontend run reached 390/400 and ten UI
  interactions timed out under parallel resource contention; each affected
  file passes when run in isolation (Program Chair 16/16, Admission 7/7,
  Curriculum 9/9).
- Tried the in-app browser for final visual QA after completing API and
  component checks, but this session exposes no browser binding. No unrelated
  browser automation was substituted; live HTTP/API verification and rendered
  component tests remain the available evidence.
- The first final-state Tinker query lost SQL REGEXP quotes through shell
  parsing and failed read-only. The retry filtered the already-read section
  codes in PHP and confirmed zero legacy sample codes, COE=`draft`,
  COA/CBAE=`dean_approved`, and zero CCS proposals. `git diff --check` passes.

## 2026-08-02 — CCS test schedule assignments

- The CCS Program Chair's term 5 plan had 49 generated sections, with 47
  missing Professor/Day/Time/Room/Modality values. Using the authorized local
  `chair.ccs@grc.test` test identity, all 47 were assigned through the existing
  `UpdateSection` action so each assignment has an audit entry and keeps the
  existing two completed rows unchanged.
- Faculty selection prefers the seeded CCS teachable-subject preferences and
  falls back to the seeded CCS faculty directory only where no preference was
  available. Rooms use the supplied CCS room catalog values; schedules use
  deterministic Monday–Saturday slots and F2F modality for this manual test.
- Verification after assignment: 49/49 CCS sections are complete, 0 remain
  incomplete, and the CCS term still has 0 schedule proposals. The proposal
  was intentionally not submitted; the Program Chair can now submit it from
  the portal after the generated rows refresh.
- Added a small restore behavior to the Program Chair workspace: when saved
  four-year plans and generated sections are present, a page refresh opens the
  generated-subject view automatically. The focused Program Chair suite
  remains green (16/16), with frontend typecheck and ESLint passing.
- One combined test/typecheck/lint command exceeded its 124-second shell
  timeout while running serially. The Program Chair tests, typecheck, and lint
  were rerun separately and passed.

## 2026-08-02 — Persistent schedule approval status and reviewer notes

- Starting a vertical slice after the CCS Program Chair submitted the completed
  schedule: reproduce and correct the Sections & Schedules subject-contract
  error; persist the submitted/waiting/approved/returned presentation across
  refreshes; surface Dean and Executive reviewer identities and notes to the
  Program Chair; and expose the review queue from each reviewer's Enrollment
  portal without changing the already-submitted CCS proposal state.
### Investigation note — 2026-08-02

- Initial targeted read used an outdated frontend feature path and failed without changing files. Located the current schema/service paths under `frontend/src/features/schemas` and `frontend/src/features/services`; continuing there.

### Persistent approval UI milestone — 2026-08-02

- Root cause of the Sections & Schedules contract failure was three imported subject-catalog placeholders with `0` units. The frontend catalog contract now accepts nonnegative catalog units while generated section units remain sourced from the curriculum placement.
- Program Chair Enrollment now derives its submitted/locked state from the persisted schedule proposal after refresh, keeps generated schedules visible read-only, and shows pending, Dean-approved, Executive-approved, published, or returned status.
- Schedule proposal resources now include the latest reviewer name plus an immutable Dean/Executive decision history with actor, timestamp, and return notes.
- Dean Schedule Approvals and Executive Master Schedule are now presented in navigation as a single `Enrollment` review destination. Review buttons, approval/return actions, and `Notes for Program Chair` remain inside the existing authorized lifecycle.
- The Program Chair Sections & Schedules destination now reuses the generated schedule view in tile mode and includes the same persisted approval status.
- Focused frontend regression suite passed: 33/33 tests across reference-data schemas, Program Chair enrollment, reviewer controls, role capabilities, and module dispatch.

### Verification note — 2026-08-02

- `php artisan test --filter=ScheduleProposalsEndpointTest` produced no test output and exceeded the 120-second command timeout. No application records were mutated. Continuing with PHP syntax/static checks, narrower frontend checks, and read-only live API verification; this timeout is not recorded as a passing backend suite.
- A single-test retry exposed the existing local test-database blocker directly: MariaDB user `grc_test` lacks `CREATE` permission for `academic_term_current_slots` (0 assertions). The backend test remains authored but cannot execute until that test-schema privilege is restored.
- The full frontend Vitest run completed 385/403 passing. Two portal-shell expectations still used the old Dean/Executive headings and were corrected; the other 16 failures were five-second test timeouts under full-suite parallel load (the same focused Program Chair tests pass when run in their scoped suite). These are being rerun narrowly after the expectation update and are not recorded as functional regressions.
- Reruns passed for every full-suite failure group: portal shell 44/44, admission/curriculum 16/16, and Program Chair enrollment 18/18.
- Full backend PHPStan remains red with 29 previously existing errors across the broader uncommitted manual-enrollment slice; none were reported in the two new approval-history production files. A file-scoped analysis is run separately below rather than modifying unrelated work.

### Final verification — 2026-08-02

- Frontend production build passed (Next.js compile, TypeScript, page data, and static generation).
- Frontend typecheck and targeted ESLint passed. Focused feature tests passed 33/33, portal-shell rerun 44/44, admission/curriculum rerun 16/16, and Program Chair rerun 18/18.
- Backend PHP syntax and Pint passed for the changed approval-history model/resource/test. File-scoped PHPStan passed with no errors.
- Live API verification returned all 442 subjects (including three zero-unit catalog placeholders) and the new `decided_by_name` / `decision_history` fields. Existing seeded decisions returned their actor history.
- A first final-state Tinker read used PowerShell-sensitive `$` syntax and failed before executing; the corrected read-only query succeeded. CCS proposal `#4` remains `draft`, with no decider or decision reason, so the user's Dean/Executive test state was not advanced.
- Backend feature execution remains blocked by the documented `grc_test` MariaDB CREATE privilege issue; it was not misreported as passing.
## 2026-08-02 — Dean and Executive enrollment review redesign

- Starting a frontend-only redesign of the Dean and Executive Director review experience after the current wide schedule dialog was shown to be difficult to scan and taller than the viewport.
- Scope is presentation and review interaction only: preserve the existing authorized approve/return/publish lifecycle, reviewer notes, API services, and submitted CCS proposal state.
- Following the explicitly requested `frontend-design` skill, plus the repository's shadcn composition rules. Design approval is required before implementation; no production code changed at this milestone.
- The user selected and approved section tabs with compact subject cards. The approved behavior, responsive constraints, component boundaries, data flow, and test scope are recorded in `docs/superpowers/specs/2026-08-02-dean-executive-review-redesign.md`. No commit was created because repository instructions require an explicit commit request.
- Spec self-review found no placeholders, contradictory lifecycle behavior, or unresolved scope decisions. The placeholder scan intentionally returned no matches.
- After written-spec approval, an inline TDD implementation plan was created at `docs/superpowers/plans/2026-08-02-dean-executive-review-redesign.md`. It preserves on-demand detail loading, makes counts a dialog-only summary, and explicitly excludes backend/lifecycle changes and commits.
- The first Task 1 RED command did not reach test collection because Vitest's default fork worker timed out starting. No production code was changed. The same new test is being rerun with a single threads worker so the expected missing-component failure can be observed without stopping the user's running development server.
- The single-thread retry also exceeded the shell timeout before collecting tests. Process inspection shows only the user's Next development server, MCP server, and Codex runtime—no orphaned Vitest workers. A known-small existing test is being used as a control before the third RED attempt.
- The control test passed 2/2 and the third Task 1 RED attempt then failed for the expected reason: the new `ScheduleReviewDialog` import does not yet exist.
- The combined shadcn `info`/documentation lookup exceeded its 120-second CLI timeout without changing files. Local installed component sources were already inspected, and the documentation lookup is being retried in a smaller command before implementation.
- Task 1 is green: the reusable viewport-safe `ScheduleReviewDialog` now groups submitted rows into naturally ordered section tabs, renders compact subject cards with explicit missing-data copy, and exposes role-correct sticky actions. Its focused suite passes 4/4, including the accessibility scan.
- Task 2 is green: Dean and Executive proposal cards now open the compact review dialog, use concise role-specific action labels, preserve the required return-notes confirmation, and close the review after a successful transition. The combined dialog/queue suite passes 11/11.
- Task 3 is green: the Executive workspace now defaults to a focused `For review` tab and moves finalized section cards into a separate `Published` tab. Published entries use compact semantic cards and explicit `Not assigned` copy. The focused Executive suite passes 4/4, including accessibility.
- The first five-file final regression command exceeded its 180-second shell timeout before Vitest printed a result. It is not counted as passing. The three changed-component files had already passed individually; the remaining integration files are being rerun separately to distinguish startup/resource contention from a functional regression.
- Split final regression reruns passed: 15/15 across the three redesigned components, 44/44 for portal module dispatch, and 3/3 for the module registry. Vitest emitted its known jsdom canvas warning during accessibility setup, but all assertions and axe scans passed.
- The first final typecheck found one integration regression: narrowing `ScheduleDecisionControls.actorRole` to Dean/Executive rejected its existing Registrar Head reuse in the audit workspace. No runtime command was run. The control keeps its original `UserRole` API, while the new review dialog is being widened to preserve the existing legal Registrar close action.
- After restoring the shared actor-role interface, strict frontend typecheck passed. The first six-file `npx eslint` command then exceeded its 180-second shell timeout without producing a lint result; it is not counted as passing. Focused lint is being retried through the installed local ESLint binary in smaller groups.
- The three-production-file local ESLint retry also timed out without diagnostics. Process inspection confirmed no orphaned ESLint/Vitest workers; only the user's long-running Next dev server, MCP process, and Codex runtime remain. A single-file debug run is being used to locate the lint startup stall without stopping the user's server.
- The single-file debug lint completed and isolated two local style violations in the new dialog: the props contract must be an interface and missing-value normalization must avoid `||`. Both are being corrected directly; no broader files need changes.
- Final static checks are green after those corrections: strict TypeScript passed, production-file ESLint passed, and test-file ESLint passed. The lint runs were split only to stay below the local shell timeout.
- Final redesign verification passed: the production build completed through compilation, TypeScript, page data, and static generation; a fresh post-fix component run passed 15/15; portal dispatch passed 44/44; module registry passed 3/3; and `git diff --check` passed.
- Live reviewer-page inspection was attempted through the required in-app browser workflow, but this session exposes zero browser targets. No external browser automation was substituted and no approval/return/publish action was invoked. The submitted CCS proposal and all enrollment data remain unchanged by this redesign session.

## 2026-08-03 — Schedule notifications, send-back visibility, and registrar enrollment windows

- Starting a three-part slice from manual UI/functionality testing feedback:
  (1) notify Program Chairs, Deans, and the Executive Director on every
  schedule-proposal submit/approve/return, not only on publish; (2) make a
  send-back state impossible to miss across every reviewer and Program Chair
  screen (today `dean_return`/`executive_return` are `draft → draft` no-ops
  distinguished only by `decision_reason`, and every status renders the same
  neutral grey badge); (3) give the Registrar Head a real "Open Enrollment"
  control with per-year-level (1st–4th) open/close scheduling, enforced
  server-side on `POST /enrollments` — today there is no transition into
  `semester_ongoing` at all (only a seeder writes it) and the enrollment
  window columns are written and displayed but never compared to `now()`
  anywhere, so a student can enroll against a `draft` or `archived` term.
- Full design is written to
  `C:\Users\Westlie Casuncad\.claude\plans\cominicate-in-taglish-vectorized-crescent.md`
  after three parallel Explore agents mapped the schedule-proposal state
  machine, the existing (already-built) notification stack, and the
  academic-term/enrollment/registrar side. Key findings driving scope: the
  notification bell already exists end-to-end but only `publish` ever writes a
  row; the frontend `notification-schema.ts` uses `z.literal("schedule_published")`
  in a `.strict()` schema, so any other notification type already breaks the
  bell entirely (`audit-schema.ts` has the same class of bug against
  `/portal/audit-logs`) — both are being fixed as part of this slice.
- Constraints carried into the plan: no queue/scheduler/events/mail/broadcast
  infrastructure exists (`QUEUE_CONNECTION=sync`, `MAIL_MAILER=log`), so
  notifications stay inline `Notification::create` calls inside existing
  `DB::transaction`s, and year-level enrollment opening is read-time computed
  (no date-driven push notification is planned). MariaDB (`grc_test`) still
  lacks `CREATE` privilege, so feature tests remain blocked; load-bearing
  logic (`EnrollmentWindowResolver`, notification recipient rules) is being
  designed as pure, DB-free, unit-testable code for that reason.
- MariaDB service confirmed healthy (`mysqld.exe` running) before starting any
  DB-heavy work.
- Parts 1 (notifications on every schedule transition) and 2 (send-back
  visibility) are complete: backend unit suite 172/172 (was 165), Pint and
  file-scoped PHPStan level 8 clean on every new/changed file, frontend
  typecheck/lint clean, and 73/73 focused Vitest tests across 9 files
  (portal shell, notification bell, Program Chair/Dean/Executive/Registrar
  schedule screens, the new `schedule-status`/`schedule-status.test` helper).
  The `notification-schema.ts`/`audit-schema.ts` contract-drift bugs are
  fixed (loosened to `z.string()` on the resource fields; the enum arrays
  now only back filter dropdowns). The bell gained a true unread total
  (`meta.total` via a dedicated 60s-polled query — the one deliberate
  exception to "no polling in this app"), day grouping, per-type icon/tone,
  mark-all-as-read, and click-through navigation. The Program Chair's
  Enrollment nav link now carries a "Returned" badge, sourced from a new
  `is_returned`/`returned_by_role` pair on `ScheduleProposalResource`.
- **New blocker discovered starting Part 3 (Registrar enrollment windows):**
  the migration `2026_08_03_000001_create_academic_term_year_level_windows_table`
  cannot be applied to the local dev database. `migrate:status` on the
  default `mariadb` connection reports "Migration table not found" even
  though 27 application tables already exist — the dev DB has no
  `migrations` tracking table at all. The project's own
  `mariadb_migrator` connection (`grc_migrator`, documented in
  `config/database.php`) does have a working `migrations` table and shows
  the same-vintage `2026_08_02_000006_create_room_catalog_entries_table`
  already pending too, but running `php artisan migrate --database=mariadb_migrator`
  fails: `CREATE command denied to user 'grc_migrator'@'localhost' for
  table `room_catalog_entries``. `SHOW GRANTS FOR CURRENT_USER()` confirms
  the access model is **per-table, not database-wide** — `grc_migrator` has
  an individual `GRANT ... ON grc_enrollment.<table>` line for every table
  that currently exists, and nothing for a table that doesn't exist yet.
  This is the same shape as the already-documented `grc_test` CREATE issue,
  just now also blocking the **dev** database for any brand-new table. No
  privilege was self-granted and no destructive action was taken. **A user
  with root/admin MariaDB access needs to either `GRANT CREATE ON
  grc_enrollment.* TO grc_migrator@127.0.0.1` (and the equivalent for
  `grc_test`) or pre-create the two pending tables and grant per-table
  access on them,** before this migration (or the also-pending
  `room_catalog_entries` one) can run or before any Part 3 feature/live-API
  verification can execute. Continuing with everything in Part 3 that does
  not require a live database: the model, the pure `EnrollmentWindowResolver`
  (DB-free, fully unit-testable), the transition/action/controller code
  (syntax + PHPStan verified, not live-executed), and the frontend UI
  (Vitest-mocked, no real backend needed).

### Session completion — 2026-08-03

## 2026-08-03 — Real-time schedule workflow refresh investigation

- Starting investigation into the reported stale UI state: notification updates, Program Chair submissions reaching the Dean, and Dean approvals reaching the Executive Director currently require a manual page refresh. Scope is limited to identifying and correcting the existing client refresh/subscription flow; no schedule decision or notification records will be changed during diagnosis.
- Root cause confirmed from the frontend query boundaries: the backend persists each schedule-transition notification, but neither notifications nor schedule-proposal queues receive server-pushed events. Only the bell's unread-count request polls (every 60 seconds); the visible notification list and the Program Chair/Dean/Executive schedule-proposal queries fetch only on mount or on a same-user mutation. A Program Chair's cache invalidation cannot refresh the Dean's browser, and a Dean's cannot refresh the Executive Director's browser.
- The existing stack has no broadcasting/WebSocket infrastructure, so a role-scoped background refresh of these existing read-only REST queries is the smallest architecture-compatible fix. Awaiting user approval of the proposed cadence and scope before implementation.
- The user approved the targeted refresh approach. The implementation design is now recorded in `docs/superpowers/specs/2026-08-03-realtime-schedule-refresh-design.md`: active schedule queues, unread totals, and the opened notification list use a five-second interval, and visibility focus immediately refetches them. Spec self-review found no placeholders, contradictions, ambiguous scopes, or whitespace errors (`rg` placeholder scan and `git diff --check` were clean). No commit was created because repository instructions require an explicit request.
- The approved design has been converted to the test-first implementation plan at `docs/superpowers/plans/2026-08-03-realtime-schedule-refresh.md`. Plan self-review found no placeholder language or whitespace errors. The current checkout is the normal `main` worktree (not an existing linked worktree) and carries the user's large, uncommitted implementation slice; creating an isolated worktree would omit that in-progress slice and risk testing against the wrong state, so this bounded frontend fix will be made carefully in place without touching unrelated files.
- Plan execution has started inline with the user's explicit approval to work on the current `main` checkout. A preliminary read correctly located the Vitest configuration but made one stale read attempt against `frontend/src/tests/setup.ts`; the actual configured file is `setup.tsx`. That read failure made no file changes and does not affect the planned test run.
- Task 1 RED is confirmed: the new Dean queue regression test advances five seconds after its mocked Program Chair submission and fails exactly as expected (`Unable to find role=button, name=Approve schedule`). The visible queue remains on “No schedule decisions are currently available,” proving there is no automatic schedule-proposal refetch yet. No production code was changed before this failing test.
- Task 1 is green: `useScheduleProposalsQuery` now refreshes every five seconds and on window focus. The new Dean cross-role refresh regression passed (1/1), and the affected Program Chair/Dean/Executive suite passed 30/30. Vitest printed the known jsdom `HTMLCanvasElement.getContext()` accessibility warning three times, but all assertions passed; no test failure or production diagnostic occurred.
- Task 2 RED is confirmed: the opened notification-sheet regression advances five seconds after a new mocked schedule notification arrives and fails exactly as expected (`Unable to find an element with the text: New Dean review request`). The same dialog stays open with the prior notification, proving the visible list has no automatic refresh yet. No notification production code was changed before this failing test.
- Task 2 is green: the unread total now refreshes every five seconds; the notification sheet's full list only fetches/polls while open, always reloads on reopening, and refetches on window focus. The new opened-sheet regression passed (1/1), and notification-sheet plus portal-shell regressions passed 25/25.
- Starting final bounded frontend verification: strict TypeScript, ESLint on the five changed implementation/test files, the combined Program Chair/Dean/Executive/notification/portal-shell Vitest suite, and diff scope/whitespace review. No backend checks are required because this slice changes no Laravel code or API contracts.
- The final bounded checks are green: `npm run typecheck` and targeted ESLint exited cleanly; the combined cross-role/notification/portal-shell suite passed 55/55. Vitest again printed its known jsdom canvas warning three times during accessibility-related setup, with no failed assertions. `git diff --check` is clean. The affected files already contained the user's prior uncommitted schedule-notification redesign, so the repository-wide diff is intentionally larger than this refresh-only slice; final full frontend suite and production build are beginning before handoff.
- The first full frontend Vitest run is **not** recorded as passing: 78/79 files and 431/432 tests passed, but `ProgramChairEnrollmentWorkspace > closes the schedule modal after a successful save even while the section list refreshes` timed out at its five-second limit under full-suite load. This test's fixture deliberately holds the section-list refresh; the same focused Program Chair file had passed earlier in the session. No code change will be made until an isolated rerun and refresh-boundary evidence determine whether the new schedule-proposal interval contributes or this is the documented full-suite parallel-load timeout pattern.
- Root-cause check for that full-suite failure: the exact test passed in isolation (1/1), and the complete Program Chair file passed 18/18 immediately afterward. The failure is therefore consistent with the repository's existing parallel-load timeout pattern, not reproducible as a functional regression from the five-second proposal refresh. A fresh full-suite rerun is required before final handoff and is starting now; the earlier 431/432 run remains accurately recorded as failed.
- The fresh parallel full-suite rerun reproduced the exact same nonfunctional result: 78/79 files and 431/432 tests passed; only the intentionally held-refresh Program Chair modal-close test timed out at 5.261 seconds. It continues to pass 1/1 and 18/18 when not competing with all jsdom workers. Rather than alter an unrelated test or claim the parallel suite passed, the full suite is being run serially to validate the product change without the confirmed worker-contention ceiling; the production build follows only after that result.
- The first serial-run command used an obsolete camel-case Vitest option (`--poolOptions`) and exited before collecting any test. No files changed. The installed Vitest CLI help is being consulted for its current single-worker spelling before the serial full-suite retry.
- Full frontend validation is now green in the correct single-worker mode (`npx vitest run --no-file-parallelism --maxWorkers=1`): 79/79 files and 432/432 tests passed in 185.95 seconds. Vitest emitted the known jsdom canvas warning during accessibility setup but no assertion or runner failure. The two normal parallel runs remain accurately recorded as 431/432 due to the same pre-existing held-refresh test timing out under worker contention; they are not represented as passing. Starting the production build next.
- Production frontend build passed: Next.js/Turbopack compiled successfully, completed TypeScript validation, generated all five static pages, and finalized page optimization with exit code 0. Final scope/whitespace review and handoff are next; no commit will be made without an explicit request.
- Final handoff verification is complete: a fresh `git diff --check` passed; no backend/API/lifecycle code was changed for this frontend-only refresh slice. The current checkout remains intentionally dirty with the user's earlier manual-enrollment, schedule-notification, and registrar-window work; only the targeted query hooks, notification sheet, two regression tests, this progress log, and the new design/plan artifacts were touched for the refresh fix. No commit or push was made.

## 2026-08-03 — Registrar notification after Executive approval investigation

- Starting the requested extension: after the Executive Director has approved the submitted Program Chair schedule proposal, notify the Registrar Head that the approved schedule can proceed to the enrollment-opening workflow and make the Registrar view refresh without a page reload. Scope is limited to the existing schedule-transition notification and Registrar enrollment-read flow; no approval, publication, or enrollment-window policy values are being changed during diagnosis.
- Root cause found: `ScheduleTransitionNotificationPlan::forAction('executive_approve', ...)` currently targets only the Program Chair submitter and every Dean, so no Registrar notification row is written. The prior five-second `useScheduleProposalsQuery` refresh already powers `EnrollmentScheduleCard` for the Registrar Head, so its publication-readiness display will refresh once the backend creates the missing notification and the relevant proposal state changes.
- Policy dependency requiring a user decision: the PRD lifecycle is `executive_approved → published`, and the current server-side `open_enrollment` action permits opening only after at least one **published** schedule proposal. Sending a Registrar “you can start enrollment” notification at `executive_approved` would currently be premature because the separate Executive `publish` action has not happened yet. The requested trigger must be confirmed before code changes.
- One exploratory test-file read also referenced a nonexistent `frontend/src/features/lib/notification-presentation.test.ts`; it exited after the relevant source/test reads, made no file changes, and will not be retried because the presentation behavior is already covered through the notification-sheet component tests.

All three parts are implemented, statically verified, and unit-tested.
**Live API verification and feature tests remain blocked by the MariaDB
privilege issue above** and are explicitly not claimed as passing — see ADR
0019 for the full design rationale.

**Part 3 (Registrar enrollment windows), completed after the blocker above:**
- `academic_term_year_level_windows` migration + `AcademicTermYearLevelWindow`
  model; `CreateAcademicTerm` seeds one row per year level (1–4) from the
  term-wide dates.
- `App\Domain\Enrollment\EnrollmentWindowResolver` (pure, DB-free) plus
  `EnrollmentAvailability`/`EnrollmentAvailabilityReason`/`YearLevelAvailability`/
  `EnrollmentScheduleSummary` value objects. 10/10 unit tests
  (`EnrollmentWindowResolverTest`) covering every reason and boundary
  instant.
- `TransitionAcademicTerm` gained `open_enrollment` (`draft`/`for_dean_approval`
  → `semester_ongoing`, gated on ≥1 published `schedule_proposal`) — fixed a
  real bug while adding it: the existing `close`/`archive` `if/else` would
  have run archive's side effects (setting `archived_at`, nulling the
  current-slot) for the new action too, since it only ever checked
  `$action === 'close'`. Now an explicit three-way branch.
- New `BuildEnrollmentScheduleSummary` (read) and `SaveEnrollmentSchedule`
  (write) actions, `EnrollmentWindowController` with
  `GET/PATCH /academic-terms/{term}/enrollment-windows` and
  `.../enrollment-schedule`, gated by the existing `AcademicTermPolicy`
  (no new policy class).
- `EnrollmentWindowResolver` wired into `StoreEnrollmentRequest` as the
  first check, ahead of every existing section-level rule — this is what
  actually closes the previously-open hole where `POST /enrollments`
  accepted a `draft` or `archived` term id.
- Two new `AuditAction` constants (`academic_term.enrollment_opened`,
  `academic_term.enrollment_schedule_updated`) and one new `AuditableType`
  (`academic_term_year_level_window`); `AuditVocabularyTest`'s exact-list
  assertions updated to match.
- Frontend: `enrollment-window-schema.ts`, `enrollment-window-service.ts`,
  `use-enrollment-windows.ts`; Registrar `EnrollmentScheduleCard` (publication-
  readiness chips per college, confirm-gated "Open enrollment" action,
  per-year-level datetime editor with a "same as term window" reset) wired
  into `academic-term-workspace.tsx`; student `EnrollmentAvailabilityBanner`
  (open/before-window/after-window/term-not-open/term-closed) wired into
  both `enrollment-workspace.tsx` (also disables section selects and the
  submit button while closed) and `portal-overview-page.tsx` (student-only,
  informational). React Hook Form's `Path<T>` could not infer paths into a
  `Record<1|2|3|4, {...}>` shape for the year-level rows — fixed by using
  ten flat field names (`year_1_opens_at` … `year_4_closes_at`) instead of a
  nested/mapped structure.
- 18 new focused frontend tests across 3 new files
  (`enrollment-schedule-card.test.tsx` 4, `enrollment-availability-banner.test.tsx`
  6, plus 1 new case in `enrollment-workspace.test.tsx`), all passing.

**Final verification, this session:**
- Backend: Pint and file-scoped PHPStan (level 8) clean on every new/changed
  file (pre-existing debt in three untouched-by-logic files —
  `SaveSectionPlan.php`, `CreateAcademicTerm.php`, `TransitionAcademicTerm.php`
  — confirmed via `git stash` comparison to predate this session, left as-is
  per "don't fix unrelated files"). Backend unit suite: **182/182 passing**
  (was 165 at session start). `route:list` boots cleanly with 66 routes
  including the two new enrollment-window routes. Two new Feature test files
  (`AcademicTermOpenEnrollmentEndpointTest`, `EnrollmentScheduleEndpointTest`)
  plus 3 new cases in `EnrollmentsEndpointTest` are authored and confirmed to
  fail only at the documented `grc_test` CREATE-privilege step, not on any
  application logic.
- Frontend: `tsc --noEmit` clean; `eslint` clean on every session-touched
  file; full Vitest suite **79 files / 430 tests passing** (up from the
  403-test figure recorded earlier); production `next build` (Turbopack)
  compiles, typechecks, and generates all static pages successfully.
- `docs/api/openapi.yaml` updated (new `open_enrollment` action, two new
  paths, `EnrollmentScheduleResource`/`YearLevelAvailabilityResource`/
  `UpdateEnrollmentScheduleRequest` schemas, `is_returned`/`returned_by_role`
  on `ScheduleProposalResource`, the full `NotificationType` enum in place
  of the single stale `schedule_published` value); `@redocly/cli lint`
  passes. Along the way, found the OpenAPI spec's `notification_type` and
  `ScheduleProposalResource` were already stale relative to the live backend
  before this session (missing 10 notification types and the pre-existing
  `decided_by_name`/`decision_history` fields) — the notification enum gap
  is now closed; `decided_by_name`/`decision_history` remain undocumented,
  left alone as pre-existing, unrelated drift.
- ADR 0019 written covering all three design decisions and the no-scheduler
  constraint.

**Explicitly not done, and why:** live API/browser verification against the
running app (blocked — the new migration cannot be applied to either
database; see the MariaDB blocker above and the `mariadb-instability-incident`
memory file, updated this session with the recurrence). No GRANT was
attempted. The sample queue state (COE pending Dean, COA/CBAE pending
Executive, CCS proposal `#4` in draft) was never touched since no live write
was possible this session.

## 2026-08-04 — Enrollment go-live: audience windows, block enrollment, capacity, archive flow

Ten-phase slice (see `docs/adr/0020-block-enrollment-and-audience-windows.md`
for the full design rationale) that took the enrollment feature from
"exists in code, dead at runtime" to an actually-working cycle: Registrar
sets a staggered per-audience schedule → Program Chair sets per-year
capacity → regular students enrol by block → irregular students enrol per
subject → Registrar archives and opens the next term.

**Three compounding root causes found and fixed first:**
1. `grc_migrator`/`grc_test` held only table-by-table grants, not
   database-level — two migrations (`academic_term_enrollment_windows`,
   `room_catalog_entries`) had silently never applied anywhere. Fixed with a
   root-level database-level `GRANT`. `grc_app` (the narrow-grant runtime
   user) needed its own explicit grants added for both new tables
   afterward — the migrator/test grant does not extend to it, and the test
   suite's broader grants had been masking that gap (only found via a live
   curl 500 + `storage/logs/laravel.log`).
2. Frontend/backend contract mismatch on enrollment windows: backend sent 5
   `audiences`, frontend's `.strict()` schema demanded 4 `year_levels` —
   every Registrar save 422'd and no student ever saw a window banner.
   Fixed by aligning the frontend to the backend (tested, correct shape).
3. `sections.is_block_exclusive`/`student_profiles.enrollment_category`
   existed as columns nothing wrote to — 212/212 sections had
   `is_block_exclusive = null`. Root cause: `SaveSectionPlan::release()`'s
   `firstOrCreate` never updated an existing section row (also why 206/212
   were stuck at the hardcoded capacity of 40). Replaced with an
   `upsertGeneratedSection()` that respects a new `capacity_source`
   (`plan`|`manual`) flag so a Program Chair's per-year default and a
   dispatcher's manual override can coexist.

**Delivered:** `EnrollmentAudience` (5 values, ordinal labels — "1st Year"
never "Year 1"); `BlockSectionAccessPolicy` (time-based block exclusivity,
replacing a static always-visible check); block-as-a-unit enrollment (new
`GET /enrollment-blocks`, `POST /enrollments` accepting `block_code` as an
alternative to `sections`, `seatsRemaining` = MIN across the block);
`lockForUpdate()` all-or-nothing seat concurrency for multi-section block
submissions; Program Chair `students_per_block` per-year default plus
per-section capacity override; `ArchiveAndCreateNextTerm` (archive current +
create next Draft in one transaction) replacing the standalone term-creation
form, surfaced through a new `ArchiveTermDialog` that asks only for the next
school year and semester; 5 seeded student logins (year 1–4 regular by
block, one 2nd-year irregular by subject) plus an optional
`EnrollmentOpenDemoSeeder` that fast-forwards CCS past the Dean/Executive
approval chain for manual/E2E testing. Amends ADR 0018: a clean seed now
leaves one current Draft term (`2026-2027 / 1st`) instead of none.

**E2E:** `block-enrollment.spec.ts` and `enrollment-windows.spec.ts` are new;
`enrollment.spec.ts` rewritten (student4 is now a regular block-enrolling
student, so the per-subject journey moved to the one irregular seed
identity); `academic-term-archive.spec.ts` is new. The archive spec
one-way-transitions the shared seeded `semester_ongoing` term to `archived`,
which the other three specs depend on staying ongoing — same hazard the
existing throttle-isolation pattern in `playwright.config.ts` already
solved once; gave the archive spec its own serial `archive-isolated`
project, `dependencies`-ordered to run after both `chromium` and
`throttle-isolated`. Separately, three assertions across the block/irregular
specs needed a bumped timeout (5s → 15s): the audience viewer resolves via a
multi-request waterfall (term auto-select → schedule fetch → block-pool
fetch) that briefly renders the wrong fallback heading first, and the
post-submit receipt banner awaits three invalidated queries refetching
before it renders — both real, not flakes, confirmed by live Playwright MCP
browser walkthrough of the full block-enrollment journey (submission
produced queue ticket `Q000001` and the review/confirm-dialog copy matched
exactly) before the timeout fix.

**Docs:** `docs/adr/0020-block-enrollment-and-audience-windows.md`;
`docs/testing/SEEDED_IDENTITIES.md` updated for the 5-student table and the
now-non-empty clean-seed term list.

**Final verification, this session:**
- Backend: Pint clean (`--dirty`, i.e. every uncommitted file — 16 files had
  pre-existing style drift unrelated to this slice's logic, fixed
  mechanically); PHPStan level 8 found 24 pre-existing errors across files
  this slice didn't touch (or only lightly touched, inheriting debt already
  documented as deliberately-left in an earlier session) — one genuine new
  finding in `ProgramChairScheduleSampleSeeder.php` (`$plans[1]` unprovable
  by static analysis, same class as an already-guarded access two lines
  above) fixed with the same defensive-guard pattern. Full suite:
  **848/848 passing**.
- Frontend: `tsc --noEmit` clean; `eslint` clean (one stale
  `eslint-disable` comment in `program-chair-enrollment-workspace.tsx`,
  auto-fixed); full Vitest suite **445/445 passing** (80/80 files, serial);
  production `next build` (Turbopack) compiles, typechecks, and generates
  all 5 pages successfully.
- E2E: all 5 of this slice's new/rewritten specs pass cleanly on a fresh
  seed — `enrollment.spec.ts` (irregular journey), `block-enrollment.spec.ts`
  (both regular-block and irregular-window-closed journeys),
  `enrollment-windows.spec.ts` (new), `academic-term-archive.spec.ts` (new,
  isolated into its own `archive-isolated` Playwright project since it
  one-way-archives the shared current term). Two real bugs found and fixed
  along the way, both in test code, confirmed via live Playwright-MCP
  browser reproduction rather than assumed: (1) `enrollment-windows.spec.ts`
  submitted before the schedule form's own async-populated date fields had
  loaded, tripping client-side "Enter a date." validation with zero network
  request ever sent — fixed by waiting for the term-wide date input to hold
  a value before interacting further; (2) two tests' overall 30s budget was
  too tight once several slow waterfalls stacked in one test (audience-
  viewer resolution, then a post-submit triple-query-invalidation refetch)
  even with generous per-assertion timeouts — fixed with `test.setTimeout(60_000)`.
- Live Playwright-MCP browser walkthrough (not just automated specs):
  confirmed the full regular-student block-enrollment journey end-to-end
  (student4.seed@grc.test picked block IT401, reviewed its weekly schedule,
  submitted, got queue ticket `Q000001`, confirm-dialog copy exact);
  confirmed the Registrar's enrollment-schedule save + live per-audience
  status grid updates without reload; confirmed the archive-and-create-next
  dialog flow; confirmed the notification-bell unread-clear-on-close fix
  (from earlier this session) is in place in
  `portal-notification-sheet.tsx`'s `handleOpenChange`.

**Discovered but explicitly not fixed — a pre-existing gap, not from this
slice:** `withdrawal.spec.ts` (journey 13) and `grade-submission.spec.ts`
(journey 9) both fail against a genuinely fresh `migrate:fresh --seed`,
independent of any change in this session. Root cause: both explicitly
depend (by their own code comments) on `DemoEnrollmentSeeder` populating a
real `enrolled`-status enrollment for `student.seed@grc.test`, which only
happens when a `semester_ongoing` term already exists at the moment that
seeder runs — true before ADR 0018 (when the default seed produced an
`Active` term directly) but never true since, since ADR 0018 deliberately
made a clean seed produce no populated current term (and this session's ADR
0020 amendment, a Draft term, doesn't change that). `scheduling-and-approval.spec.ts`
(journeys 4 & 5) also fails: it drives the old manual per-subject "create a
section" form at `/portal/sections-schedules`, but that route now always
renders `ProgramChairEnrollmentWorkspace` (the block-plan wizard) for the
`program_chair` role — an earlier session's UI change this test was never
updated for. All three went undiscovered until now because `migrate:fresh
--seed` had never once completed successfully in this project before this
session's Phase 0 database-grant fix — this is the first time the full E2E
suite has ever run against a truly fresh seed. Fixing them properly means
either rewriting their precondition-arrangement to self-arrange over the API
(the pattern `docs/adr/0016-e2e-architecture-and-live-contract-fixes.md`
decision 3 already prescribes for exactly this class of bug) or rewriting
them against the current Program Chair UI — both substantial, and both
orthogonal to this slice's actual scope, so left as a flagged follow-up
rather than silently absorbed.

## 2026-08-04 — Grading system, auto-derived standing, and enrollment-cycle completion

Ten-phase slice (see `docs/adr/0021-grading-system-and-enrollment-completion.md`
for the full design rationale) that closed the three remaining gaps between
"can submit an enrollment" and "can complete one": grading, queue-issuance
timing, and add/drop.

**Delivered:** `GradeMark` backed enum (numeric scale + `C`/`NC`/`INC`/`DRP`)
replacing free-text `final_grade`; `CompletionOnlySubjectRule` matching every
real `LEAD` spelling; a `C`-satisfies-prerequisite short-circuit in
`BuildEligibleSubjectPool` ahead of `PrerequisiteEvaluator` so the 8-subject
Leadership chain can never self-block; `EnrollmentCategoryClassifier` +
`ReclassifyStudentEnrollmentCategory`, re-run on every grade lock, writing a
real (never hard-coded) Regular/Irregular verdict with reasons; print-ready
`<GradeSlipDocument>`/`<ProspectusDocument>` (CODE|SUBJECT|UNITS|FINAL|
REMARKS|SECTION|PROFESSOR|SIGNATURE + TOTAL ACADEMIC UNITS + GPA, matching
the reference paper form, GPA correctly excluding non-numeric marks) shared
between the student's own view and the Registrar's look-up-any-student view;
the previously-nonexistent Grade Approvals lock UI (mandatory, permanent,
confirmation-gated) and Academic Transcripts module; `QueueTicket` creation
moved from submission to Registrar Staff approval (`EnrollmentPolicy` and
`Enrollment::scopeVisibleTo` updated accordingly); `enrollment_change_requests`
+ `AddDropWindowResolver` giving `add_drop_deadline_at` its first real
behavior — window opens only once enrollment has closed and before the
deadline, student submits with a required reason, Registrar Head decides,
Registrar Staff sees the result; an 8-student demo roster
(`BSIT-DEMO`/"BSIT Grade History Demo 2026", a deliberately collegeless
program so the real CCS catalog importer can't contaminate it) with real
locked grade history proving the classifier's own derivation, spanning 8
terms (`2023-2024` through `2026-2027`, the last as the current
`semester_ongoing` term).

**Three bugs found only by a live Playwright-MCP walkthrough, not by the
automated suites, because none of them exercised the real cross-role
sequence a live user does:**
1. `ConfirmPayment` transitioned the parent `Enrollment` to `Enrolled` but
   never transitioned its `EnrollmentSubject` rows off `Selected` —
   `EnrollmentSubjectStatus::Enrolled` was defined but referenced nowhere
   else in the codebase. Since `grade-submission-workspace.tsx`'s roster
   filters strictly on `status === "enrolled"`, **no professor could ever
   see a single student to grade, for any student, system-wide** — silently
   blocking this slice's own central path. Fixed by bulk-transitioning
   `Selected → Enrolled` inside `ConfirmPayment`'s existing transaction;
   `ClassRostersEndpointTest`'s fixtures had (correctly) assumed this
   transition existed all along, which is why the gap was invisible to the
   test suite.
2. `enrollment_change_requests` (new in this slice) never received its
   `grc_app` database grant — every add/drop list call 500'd with `SELECT
   command denied`. Same class of gap `docs/runbooks/mariadb-local.md`
   already documented for the original four tables; fixed with the same
   table-level `GRANT` pattern (verified safe per the runbook's own
   crash-history notes — only wildcard grants have ever crashed this
   instance) after confirming server health and all `mysql.*` privilege
   tables checked `OK` before and after. The runbook now explicitly calls
   out that every new table needs its own grant.
3. `student-add-drop-workspace.tsx` swallowed the backend's specific 422
   message (e.g. "The add/drop window opens once enrollment closes for this
   term.") behind a generic "check your connection" fallback — the backend's
   business-rule enforcement was correct throughout, only the frontend's
   error surface was misleading. Fixed by extracting the first
   `fieldErrors` message via the existing `isApiClientError` helper.

None of the three were regressions from this slice's own design — the first
two are gaps inherited from earlier slices that this slice's live walkthrough
was the first to actually exercise end-to-end; the third is local to a
component this slice added. All three now have regression coverage
(`PaymentConfirmationEndpointTest`, the runbook update, and a new
`student-add-drop-workspace.test.tsx` case).

**Two more gaps caught by a full serial Vitest run** (the default parallel
run is unreliable under concurrent PHPStan/backend-suite/browser-automation
load — it showed 76 false-positive timeout failures that vanished once
re-run alone with `--no-file-parallelism`):
- `portal-module-page.test.tsx`'s `workspaceHeadings` fixture map was never
  updated with this slice's four new module IDs
  (`grade-approvals`/`academic-transcripts`/`add-drop-requests`/
  `enrollment-change-requests`), even though the identical map in
  `module-registry.test.tsx` already had them — a partial update from
  earlier in this session. Fixed by adding the same four entries.
- `grade-slip-document.test.tsx`'s fixture coincidentally gives one subject's
  mark and the slip's overall GPA the same value (`"1.50"`), so
  `getByText("1.50")` threw on multiple matches. The component itself
  renders correctly (confirmed live); fixed the assertion to
  `getAllByText("1.50")` expecting both occurrences.

**Final verification, this session:**
- Backend: Pint clean (`--dirty`); PHPStan level 8 clean on this slice's
  files (23 pre-existing errors remain elsewhere, unrelated to this slice,
  same baseline an earlier session already documented); full suite passing,
  0 failures, including the new `ConfirmPayment` regression test.
- Frontend: `tsc --noEmit` clean; `eslint` clean; full Vitest suite run
  serially: **484/487 passing**. The 3 remaining failures
  (`admission-provisioning-workspace.test.tsx` ×2,
  `curriculum-workspace.test.tsx` ×1, all "Test timed out in 5000ms") are in
  files last touched by the unrelated, pre-existing enrollment-startup WIP
  that predates this session (per this file's own header) — reproduced in
  isolation, unrelated to anything this slice touched, not attempted here.
- Live Playwright-MCP browser walkthrough covering every role in the cycle:
  professor encoded a numeric mark (CS201, "Very Good") and confirmed the
  Leadership-subject mark selector only offers `C`/`NC`; Registrar Head
  locked it through the mandatory confirmation dialog and the grade
  disappeared from the lock queue; a regular student's block enrollment went
  from "Waiting for approval" (no queue number) → Registrar Staff approval →
  queue ticket `Q000001` appearing at that exact moment → Cashier
  notification → payment confirmation → Digital COM `COM000001` → the
  student then (and only then) appearing on their professor's roster;
  Registrar Head looked up a regular student's (STU-2026-0004) full 8-semester
  prospectus and printable grade slip, and a separate irregular student's
  (STU-2026-0008) derived "Irregular" status with its missing-subject reason
  visible; a student's drop request correctly 422'd outside the add/drop
  window with the specific reason surfaced in the UI after the fix above.

**Discovered but explicitly not fixed — flagged follow-ups:**
- The Playwright E2E suite's `SEED_STUDENT_SCENARIOS` fixture model predates
  this slice's 8-student/grade-history seed redesign; several specs need
  rewriting against the new fixture shape. Not attempted here — its own
  follow-up slice.
- `docs/api/openapi.yaml` was not updated for the ~10 endpoints this slice
  added (prospectus, grade slip, grade approvals, add/drop requests, etc.).
  No test enforces sync with the real routes, so this is known, undetected
  drift rather than a silent regression.

## 2026-08-04 — Section terminology correction and Grades sidebar polish

Small user-reported fix on top of the grading slice above, before the larger
assessment/fees slice began. Two issues from a live screenshot: (1) the
enrollment screen said "Block" and showed placeholder block codes
(`DEMO1A`) instead of the real school section codes students actually see
(`IT101`, `BSIT401`, etc.); a section with no professor assigned yet was
also being excluded from selection, when professor assignment should be
allowed to follow later. (2) The Grades sidebar ordered semester chips by
"latest completed" instead of always showing 1st semester to the left of
2nd.

**Delivered:** every user-facing "Block"/"block" string in
`enrollment-workspace.tsx`/`enrollment-block-choice.tsx` reworded to
"Section"/"section" (internal variable/prop names and the `block_code`
field deliberately left unchanged — API contract, not copy); removed the
`professor_id === null` exclusion from `BuildEnrollmentBlockPool`'s
`incomplete` filter, reworded the incomplete-schedule/full-section messages
to drop "professor"; `DemoEnrollmentSeeder`'s `BLOCK_CODES_BY_YEAR` renamed
from `DEMO1A/1B/1C`-style placeholders to real-looking codes
(`BSIT101`/`BSIT102`/`BSIT103`, etc.; later renamed from `BSCS1xx` to
`BSIT1xx` — see the 2026-08-05 entry below), matching the convention other
colleges' real catalog data already used. `academic-record-view.tsx` gained
a `semesterOrdinal()` helper so `groupBySchoolYear()` always sorts 1st
before 2nd regardless of API order, plus sidebar polish (per-year divider,
bold active year, `grid grid-cols-2` chip layout).

Student self-selection was already correct and unchanged — a student always
picks their own section; the system never auto-assigns one.

**Verification:** backend feature test added
(`test_a_section_without_an_assigned_professor_remains_selectable`); all 12
`enrollment-workspace.test.tsx` assertions updated and passing; PHPStan/Pint
clean.

## 2026-08-05 — Assessment & fees, guided Cashier flow, overload approval, 10 connected professors

Full design and rationale: `docs/adr/0022-assessment-fees-cashier-and-overload.md`.
User-directed slice (Taglish request, approved via structured multiple-choice:
per-unit tuition + misc fees / one guided Cashier flow / 10 real professor
accounts / all four process gaps) closing five gaps a codebase exploration
found between "the enrollment cycle runs end to end" (ADR 0021) and "every
PRD-documented sub-process actually has a UI and a real value behind it":
no assessment/fees anywhere, four Cashier nav modules dispatching to one
undifferentiated screen with no NOW SERVING display, no way for a student to
withdraw despite the backend already supporting it, no FR-ENR-004 unit-cap
enforcement, no daily queue reset, and 206 of 211 seeded faculty accounts
disconnected from any section.

**Delivered, by part (all under `App\Domain\Billing`/`App\Actions\Billing`
unless noted, all following the established §17 "provisional, not
GRC-approved" config convention — see `config/fees.php`):**

- **Assessment & fees.** `AssessmentComputation` (pure static, `bcmath`
  half-up rounding — `bcadd(bcmul($units, $rate, 4), '0.005', 2)`, never
  float multiplication for money) computing a per-unit tuition line plus
  file-configured miscellaneous fee lines; new `assessments`/
  `assessment_items` tables (`quantity` deliberately `decimal(6,1)`, not
  integer — 1.5-unit Leadership subjects would silently truncate);
  `AssessEnrollment` called once, idempotently, inside
  `TransitionEnrollment`'s `registrar_approve` branch, folded into the
  *same* audit row and notification (no second `AuditRecorder::record()`
  call — `EnrollmentsEndpointTest`'s `->sole()` assertions require this);
  a new nullable `assessment` key on `EnrollmentResource`, visible to every
  role that can already see the enrollment; `ConfirmPayment` now defaults an
  omitted `amount` to the assessed total (an explicitly supplied amount is
  still trusted as-is — no partial-payment policy exists to reject a
  mismatch against).
- **Guided Cashier flow.** Accounting's nav cut from 4 modules to 2:
  `payment-queue` rewritten into one screen (Now Serving card with Confirm
  payment/Skip/Call next, a Waiting queue table, a Served-today table,
  amount due pre-filled from the assessment) and a new `payment-records`
  history module (also visible to Registrar Head) backed by a new
  `GET /api/v1/payments` endpoint. `serving-number`, `payment-confirmation`,
  and `com-finalization` no longer exist as separate nav items.
- **Queue overhaul.** `ticket_number` changed from a global
  enrollment-id-derived value to a per-day sequence (`Q001`, `Q002`, ...),
  gated by a new composite `(queue_date, ticket_number)` unique constraint
  replacing the old global-unique one; new `priority` column
  (cashier-markable, §17-flagged, not an eligibility policy this project
  invents) and `served_by`; `skip` revives the previously-dead
  `QueueTicketStatus::Cancelled` case; serving a new ticket now
  bulk-completes whichever ticket was already `serving` that day
  (single-active-serving, unaudited per-row — mirrors `ConfirmPayment`'s
  existing bulk `EnrollmentSubject` transition precedent); a new
  server-computed `position()` on `QueueTicket` (priority-tickets-ahead,
  then regular-tickets-ahead) lets a student see "3 students are ahead of
  you" without ever exposing the full queue.
- **Unit cap + overload approval (FR-ENR-004).** `OverloadEvaluator` (pure
  static) evaluates a submission's total units against the two *already
  existing* but previously-unenforced `max_regular_units`/
  `overload_max_units` config keys: within cap → unaffected; over cap but
  within the overload ceiling → permitted but flagged
  (`requires_overload_approval`, Registrar Staff must tick an
  acknowledgement checkbox before approving); beyond the overload ceiling →
  hard 422 reject. Both keys stay `null` by default, so this changes
  nothing until GRC sets a real value — the same
  mechanism-implemented/value-flagged pattern as `viability_threshold`.
- **Student process gaps.** A new `EnrollmentWithdrawPanel` (reason
  required, `AlertDialog`-confirmed) finally calls the
  `useCreateWithdrawalRequestMutation` hook that has had zero callers since
  it was built; `EnrollmentQueuePaymentPanel` now shows the assessed amount
  due with its line-item breakdown and the queue position message.
- **10 connected professors.** `DemoEnrollmentSeeder` now creates 10 real
  Faculty accounts (`prof.<surname>@grc.test`), a perfect 1:1 mapping onto
  the 10 distinct subjects the demo blocks offer (`CS201`, `MATH102`,
  `GE102`, `LEAD 2`, `CS301`, `LEAD 4`, `CS303`, `LEAD 6`, `CS402`,
  `LEAD8`) — each owns every block section of their own subject across
  every block code and year level, replacing the single shared
  `faculty.seed@grc.test` placeholder that previously owned all 448 demo
  sections. Each also gets a declared Mon–Fri 08:00–17:00
  `FacultyAvailability` and a rank-1 `FacultySubjectPreference` — real
  Faculty Input rows, not just a `professor_id` pointer.

**One real bug found by the new seeder test, not by the implementation
itself:** the first draft of
`test_each_connected_professor_owns_every_block_section_of_their_subject`
queried *every* `is_block_exclusive` section for a subject code, and failed
on `LEAD8` — `ProgramChairScheduleSampleSeeder` (a separate, pre-existing
fixture seeder) also generates its own block-exclusive sections for a
synthetic BSIT curriculum that happens to reuse the `LEAD8` subject code
(section `IT401`, owned by that seeder's own "Sample Faculty"). Not a
defect in `DemoEnrollmentSeeder` — the test's query was scoped too broadly.
Fixed by scoping the assertion to sections belonging to the `BSCS-DEMO`
curriculum's own section plans specifically.

**Verification:** backend — Pint clean, PHPStan level 8 clean (23
pre-existing baseline, zero new), full `DemoEnrollmentSeederTest` run green
(44 tests, 154+19 assertions across two runs) after the scoping fix above,
plus new/extended feature tests across `EnrollmentsEndpointTest`,
`PaymentConfirmationEndpointTest`, `PaymentsEndpointTest` (new),
`QueueTicketsEndpointTest`, `EnrollmentRecordsMigrationTest`,
`AuditVocabularyTest`, `DashboardEndpointsTest`. Frontend — `tsc --noEmit`
clean, targeted Vitest passing across every touched/new component
(`accounting-payment-workspace`, `payment-records-workspace`,
`enrollment-withdraw-panel`, `enrollment-queue-payment-panel`,
`registrar-enrollment-workspace`, `enrollment-workspace`), the 7-fixture
`.strict()`-schema update required by the new `assessment`/
`requires_overload_approval` `EnrollmentResource` keys done in the same
pass as the backend change (this schema is runtime-breaking on any
mismatch, not just test-breaking). `docs/api/openapi.yaml` and
`docs/data-dictionary/enrollment-records.md`/`faculty-input.md` updated and
`@redocly/cli lint` clean.

**Full-repo verification, completed after the above:**
- Backend: `vendor/bin/pint --dirty` clean; `vendor/bin/phpstan analyse`
  (full repo) at the same 23 pre-existing baseline errors, zero new; full
  `php artisan test` — **1045 passed, 3779 assertions, 0 failures**
  (797s), including the `DemoEnrollmentSeederTest` scoping fix below.
- Frontend: `npx tsc --noEmit` clean; `npx eslint .` — 3 pre-existing
  errors found, 2 confirmed unmodified since `85a6357` (left alone, out of
  scope) and 1 in this slice's own `registrar-enrollment-workspace.tsx`
  (fixed: `pending && pending.action === ...` → `pending?.action === ...`,
  satisfying `@typescript-eslint/prefer-optional-chain`); full
  `npx vitest run --no-file-parallelism` — **529 passed, 89 files, 0
  failures** (394s), no flaky timeouts this run.
- **One real test-scoping bug, caught by the fresh reseed, not the
  implementation:** the first draft of
  `test_each_connected_professor_owns_every_block_section_of_their_subject`
  queried every `is_block_exclusive` section for a subject code
  platform-wide and failed on `LEAD8` —
  `ProgramChairScheduleSampleSeeder`'s separate, pre-existing BSIT fixture
  also generates a block-exclusive section for that code (`IT401`, owned
  by its own "Sample Faculty"). Fixed by scoping the assertion to
  `BSCS-DEMO`'s own section plans (see ADR 0022 for the full writeup).
- `php artisan migrate:fresh --database=mariadb_migrator --seed --force`
  against the dev database, then a direct read of `assessments`/
  `assessment_items`/`queue_tickets`/`payments` through the **app**
  connection (`grc_app`, not the migrator) confirmed the new tables'
  grants are live — no `SELECT command denied`. 10 professors confirmed
  seeded; `prof.bautista@grc.test` confirmed owning exactly 3 CS201
  sections (one per year-1 block).
- **Live Playwright-MCP walkthrough, full cycle, no bugs found:** student
  (`student.seed@grc.test`) submitted a BSCS101 section — the picker
  showed real professor names (Bautista/Villanueva/Dela Cruz/Reyes) on
  every subject, confirming Task G live. Registrar Staff approved it; the
  student immediately saw `₱5775.00` (10.5 × 450 + 1050 misc) with its
  full Tuition/Registration/Library/Laboratory breakdown and "You're next
  in line." Accounting called `Q001`, confirmed payment with the amount
  field pre-filled `5775.00`, and the confirmation generated
  `COM000001`; Payment Records immediately listed it. Logging in as
  `prof.bautista@grc.test` showed "Ramon Bautista" in the sidebar (not a
  placeholder), all 3 CS201 sections on Teaching Schedule, the newly-paid
  student on the BSCS101 Class Roster as "Enrolled," and a working Grade
  Submission flow (recorded "Good," submitted). Registrar Head locked the
  grade; the student's grade slip's PROFESSOR column then showed **"Ramon
  Bautista"** — not "Testing Faculty." Finally, the student's own
  Enrollment page now showed the Withdraw panel with its button, only
  once the enrollment reached `Enrolled` (correctly absent while
  `pending_payment`).

**Update:** this entry (Task G / assessment-fees-cashier-overload-professor
slice, plus the grades/COM/enrollment restructure and terminology slices
that landed alongside it) was committed to `main` at `165f5b7` once the
user explicitly said "go ahead" — 127 files, 7,757 insertions / 2,058
deletions, on top of `85a6357`. Not pushed to origin.

**Note on `BSCS-DEMO` references above:** later the same day, the product
owner asked for the demo curriculum to represent BSIT rather than BSCS
(the entries above describe the walkthrough exactly as it happened, before
that request). `BSCS-DEMO`/`BSCS Grade History Demo 2026`/`BSCS1xx` block
codes were renamed to `BSIT-DEMO`/`BSIT Grade History Demo 2026`/`BSIT1xx`
throughout the codebase — see the follow-up session entry below.

## 2026-08-05 — Mobile stepper fix, ED direct-publish, Scholar/Payee tag, generated student numbers, BSIT-DEMO rename, real-time approvals, Cashier manual-payment cleanup

Twelve-part, user-directed slice (Taglish request plus a mid-turn addendum)
landing on top of the Task G slice above, once that slice was committed to
`main` at `165f5b7`. None of this entry has been committed or merged — the
user has repeated, multiple times across this session, that they will say
explicitly when that should happen.

**Delivered, by part:**

- **Mobile `StatusStepper`.** The `<li>` had an unconditional `flex-1`
  which, inside the mobile `flex-col` `<ol>`, stretched every step to fill
  the container's height — the huge stacked circles the product owner's
  screenshot showed. Fixed with a `flex-row flex-wrap` mobile layout
  (`sm:flex-nowrap` restores the desktop row), smaller circle/text sizes
  below `sm:`.
- **Executive Director workflow simplified.** Retired the `executive_approve`
  action — the ED's own PRD §4.1-documented two-step
  `dean_approved → executive_approved → published` lifecycle collapses to a
  direct `dean_approved → published`, at the product owner's explicit
  request to remove the "Final approve" step entirely. Followed the
  established "keep the enum case, retire the action" pattern (ADR 0022
  precedent for `QueueTicketStatus::Cancelled`): `ScheduleProposalStatus::
  ExecutiveApproved` stays defined for historical rows and old audit
  entries, but `ScheduleProposalTransitionRules` no longer lists
  `executive_approve` as reachable and `publish` now requires
  `DeanApproved` directly. `ScheduleProposalStatus`'s own docblock — which
  called this lifecycle "authoritative rather than provisional" — was
  amended in place to document this as a deliberate product decision, not
  a routine §17 provisional-value change.
- **Scholar/Payee tag.** New `App\Domain\Identity\FinancialStatus` enum
  (`scholar`/`payee`), nullable `financial_status` column on
  `student_profiles`, surfaced on both `StudentProfileResource` and
  `EnrollmentResource`. Deliberately informational only — confirmed with
  the product owner via structured question — never read by
  `AssessmentComputation` or any fee logic. Shown as a `Badge` next to the
  student number on the Accounting and Registrar Staff queues.
- **Generated student number format.** Switched from free-typed to an
  auto-generated, regenerable `YYYY-MM-NNNNN` (e.g. `2027-08-30001`),
  enforced by the same regex on both the Zod schema and the
  `StoreStudentProfileRequest` backend rule. `AdmissionProvisioningWorkspace`
  captures the first generated value once via
  `useState(() => generateStudentNumber())` — calling the generator inline
  inside `useForm`'s `defaultValues` object re-invokes it every render,
  silently wasting calls (invisible with the real generator, but broke a
  test using a stateful counting mock) — and exposes a "Generate new
  number" button plus an injectable `generateStudentNumber` prop for
  deterministic tests.
- **`BSCS-DEMO` → `BSIT-DEMO` rename.** Per the product owner's literal
  answer ("if it's in the curriculum, make it BSIT, not BSCS"): the demo
  grade-history curriculum (program code, curriculum name, and
  `DemoEnrollmentSeeder`'s `BSCS1xx` block codes) renamed to `BSIT-DEMO`/
  `BSIT1xx`. Deliberately left the separate, pre-existing real `BSIT`
  program (used by `ProgramChairScheduleSampleSeeder`'s own fixture)
  untouched — a real `BSIT` program code already existed and would have
  collided with a naive global rename.
- **Registrar schedule-save toast.** `enrollment-schedule-card.tsx`'s
  `saveSchedule()` now calls `toast.success("Enrollment schedule saved.")`
  — the app-wide `sonner` `<Toaster/>` had been mounted since Phase 3 but
  had zero real callers anywhere in the app until this.
- **Registrar Staff review dialog.** New `EnrollmentReviewDialog` lets
  Registrar Staff inspect a student's chosen subjects, schedule, and units
  before approving — reused the established reference-data client-side
  join pattern from `MasterScheduleWorkspace` (fetch all sections + all
  subjects, both `viewAny`-open per policy, join by `section_id` →
  `subject_id` client-side) rather than a new dedicated endpoint.
- **Real-time student polling.** `useEnrollmentsQuery` gained
  `refetchInterval: 10_000` so a Registrar decision or payment confirmation
  appears on the student's own Enrollment page without a manual refresh —
  a deliberate short-polling stand-in documented in the hook's own
  docblock, since no WebSocket/SSE infrastructure exists in this stack.
- **Cashier: manual payment only.** Removed the "External reference" field
  from the payment-confirmation dialog entirely — payments here are always
  manual, so the field never meant anything. Added a printable COM
  (`PrintDocument`/`PrintButton`) directly inside the confirmation success
  Alert once `document_number` is available, and removed the now-dead
  "Reference" column from Payment Records. Confirmed the student's Digital
  COM workspace (`student-digital-com-workspace.tsx`) already worked and
  needed no changes.

**Three real bugs found by tests during this session's own verification
pass, all pre-existing gaps this same slice left behind, not implementation
defects in the new code itself:**

1. `schedule-review-dialog.test.tsx` still asserted the old "Final approve"
   button label for the Executive Director role — a second call site for
   the ED action-label map that the Part B rename missed
   (`schedule-decision-workspace.tsx` and `schedule-review-dialog.tsx`
   were both fixed, but only the former's test file was updated). Fixed by
   asserting "Publish schedule" instead.
2. `ProvisionStudentAuditTest.php` used pre-Part-D `student_number`
   literals (`PRIVATE-STUDENT-0001`, `ROLLBACK-0001`) that the new format
   regex now rejects with 422, and its exact-match `after_values` audit
   assertion didn't expect the new `financial_status` key. Fixed both;
   confirmed the file's two other tests (`DENIED-0001`/`INVALID-0001`,
   deliberately testing authorization/validation rejection) were correctly
   unaffected since a FormRequest-level rejection was already the expected
   outcome either way.
3. The new `enrollment-workspace.test.tsx` polling test needed
   `vi.useFakeTimers()` installed **before** `renderWithSession`, not
   after — a `refetchInterval` timer scheduled under real timers during
   the initial render is invisible to a fake clock installed later,
   matching the precedent already established in
   `portal-notification-sheet.test.tsx`. Its assertions also needed
   `findAllByText`/length checks instead of `findByText`, since the status
   badge renders in more than one place at once (the same `DataTable`
   dual desktop/mobile-render ambiguity already hit once this session in
   the Part G Review-button test).

**Verification:** `vendor/bin/pint --dirty` clean. `vendor/bin/phpstan
analyse` (full repo) — 23 pre-existing baseline errors, zero new.
`npx tsc --noEmit` (full repo) clean. `npx eslint .` (full repo) — 2
pre-existing errors, both in files untouched this session (left alone, out
of scope).

Backend `php artisan test`, run in chunks after the whole-suite background
process was twice killed by the environment for unclear reasons (not a
MariaDB crash — the `mysqld` process survived both kills with the same
PID) once it reached the heavy `DemoEnrollmentSeederTest`/
`ReferenceDataSeederTest` pair: Unit 280/280, Feature/Actions 79/79 (after
the `ProvisionStudentAuditTest` fixes above), Feature/Api 438/438,
Feature/Auth 11/11, Feature/Models 19/19, Feature/Policies 49/49,
Feature/Database (light, excluding the two heavy seeder files) 121/121 —
**1,047 passed** across those chunks. `DemoEnrollmentSeederTest`/
`ReferenceDataSeederTest` (50 tests, 844.71s) were confirmed green earlier
in this same session, before Parts F–L, whose changes never touch anything
those two files or their seeders depend on.

One self-inflicted issue during this pass, not a code defect: a mistaken
concurrent background test run (the heavy seeder pair re-launched before
an earlier light-chunk run had finished) corrupted the `grc_enrollment_test`
database mid-migration, producing 45 spurious `Table 'migrations' doesn't
exist` failures. Repaired via the documented
`php artisan migrate:fresh --env=testing --force` (`grc_test` already has
full DDL per `docs/runbooks/mariadb-local.md`); the light Database chunk
then passed 121/121 cleanly on a foreground re-run.

Frontend `npx vitest run --no-file-parallelism` — 531/534 passing in the
full sequential run; the remaining 3 (`admission-provisioning-workspace`,
`curriculum-workspace`, `module-registry`) each failed only with a plain
`Test timed out in 5000ms` under the full run's resource load, and each
passed cleanly with 15–60s of headroom when re-run individually — the same
class of full-suite-only flakiness already seen with `class-rosters-
workspace` earlier in this session (a "Timeout waiting for worker to
respond" pool error), not a real regression.

Fresh `php artisan migrate:fresh --database=mariadb_migrator --seed --force`
against the dev database: clean, no errors. Confirmed via `tinker`:
`BSIT-DEMO` program present, no `BSCS-DEMO` leftover; `financial_status`
column live on `student_profiles`; 15 distinct professors owning sections
(the 10 new connected professors plus pre-existing fixture faculty).
Seeded demo students keep their old fixed `STU-YYYY-NNNN`-style numbers by
design — those rows are inserted directly by seeders, bypassing the HTTP
endpoint the new regex validates.
