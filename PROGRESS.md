# GRC Enrollment System — Development Progress

**Last updated:** 2026-07-28 · **PRD version:** v3.2 · **Branch:** `main`

---

# ■ Overall Completion — 36%

```
█████████░░░░░░░░░░░░░░░░  36 / 100
```

The number is weighted, auditable, and recomputable. Every row below is scored
against work that is **merged**, not work that is written or planned.

| # | Component | Weight | Done | Contributes |
|---|---|---:|---:|---:|
| 1 | Platform & foundations — 3 service shells, 13 ADRs, OpenAPI, error contract, DB, CI | 8% | 90% | 7.20 |
| 2 | Identity & RBAC — Sanctum, 9 roles, role middleware, Policies, query scopes | 7% | 85% | 5.95 |
| 3 | Process 1.0 backend — scheduling (PRD §5.1) | 10% | 80% | 8.00 |
| 4 | Process 2.0 backend — enrollment & advising (PRD §5.2) | 10% | 25% | 2.50 |
| 5 | Process 3.0 backend — approvals, payment, COM (PRD §5.3) | 12% | 15% | 1.80 |
| 6 | Cross-cutting backend — `audit_logs`, `notifications` | 5% | 0% | 0.00 |
| 7 | Frontend platform — Next.js, design system, shell, auth | 8% | 100% | 8.00 |
| 8 | Nine role portals — 40 modules (spans Phases 5–7) | 25% | 5% | 1.25 |
| 9 | Process 4.0 — machine learning (PRD §5.4) | 10% | 3% | 0.30 |
| 10 | Verification & deployment — E2E, security, perf, ISO 25010, handoff | 5% | 25% | 1.25 |
| | **Total** | **100%** | | **36.25 ≈ 36%** |

Two scores that look surprising, explained:

- **Row 5 at 15%** — all 9 Process 3.0 tables are migrated, tested and
  documented, but not one Controller, Policy, Resource or route exists.
- **Row 8 at 5%** — the nav structure and role catalog exist, but all 40
  modules are still placeholder empty-states. This is the largest single
  block of remaining work.

**Recompute rule:** when a phase closes, update its row's *Done* column and
re-multiply. Do not adjust weights without recording why in Decisions.

---

# ■ System Snapshot

| | |
|---|---|
| **Stack** | Laravel 12.64 / PHP 8.2.12 · MariaDB 10.4.32 (ADR 0007) · **Next.js 16.2.12** (App Router) + React 19 · FastAPI (ml-service, dormant) |
| **Auth** | Laravel Sanctum bearer tokens; no cookies, no CSRF, no session state |
| **Live API routes** | 26 |
| **Database tables** | 21 migrated, all reversible |
| **Backend tests** | 348 passing (939 assertions) · Larastan level 8 clean · Pint clean |
| **Frontend tests** | 15 files, 145 tests, Vitest |
| **CI** | 4 GitHub Actions jobs — Backend ✅ · Frontend ✅ · OpenAPI ✅ · ML Service ❌ (paused, see Phase 9) |
| **Portals functional** | 0 of 9 |

---

# ■ The Nine System Users

All nine roles exist as `App\Domain\Identity\UserRole` enum cases and are seeded
one-per-role by `RoleUserSeeder`. Credentials live in `GRC_SEED_PASSWORD` and
are documented in `docs/testing/SEEDED_IDENTITIES.md` — **never committed**.

| # | Role | PRD § | Enum value | Seeded identity | Backend authorization | Portal |
|---|---|---|---|---|---|---|
| 1 | Student | §3.1 | `student` | `student.seed@grc.test` | ✅ own-record profile read | ⬜ Phase 6–7 |
| 2 | Admission Staff | §3.2 | `admission_staff` | `admission.seed@grc.test` | ✅ provisions students | ⬜ Phase 5 |
| 3 | Professor / Faculty | §3.3 | `faculty` | `faculty.seed@grc.test` | ✅ own-record availability + preferences | ⬜ Phase 5–7 |
| 4 | Program Chair | §3.4 | `program_chair` | `chair.seed@grc.test` | ✅ curriculum, sections, proposals | ⬜ Phase 5, 9 |
| 5 | Dean | §3.5 | `dean` | `dean.seed@grc.test` | ✅ schedule approve/return | ⬜ Phase 5, 7, 9 |
| 6 | Executive Director | §3.6 | `executive_director` | `executive.seed@grc.test` | ✅ final approve + publish | ⬜ Phase 5, 7, 9 |
| 7 | Registrar Head | §3.7 | `registrar_head` | `registrar-head.seed@grc.test` | ⚠️ close proposal only | ⬜ Phase 5, 7–9 |
| 8 | Registrar Staff | §3.8 | `registrar_staff` | `registrar-staff.seed@grc.test` | ❌ none yet | ⬜ Phase 7 |
| 9 | Accounting Staff | §3.9 | `accounting_staff` | `accounting.seed@grc.test` | ❌ none yet | ⬜ Phase 7 |

Every role can already sign in, receive a bearer token, and get a role-filtered
navigation set. What none of them can yet do is complete a real task — that is
what Phases 5–7 deliver.

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
| 4 | Cross-Cutting Backend & ML Substrate | ⬅ **Next** | 0 |
| 5 | Portals over Existing APIs (5 roles) | ⬜ Planned | 0 |
| 6 | Process 2.0 + Student Portal | ⬜ Planned | 25 |
| 7 | Process 3.0 + Registrar / Accounting / Grades Portals | ⬜ Planned | 15 |
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
FR-SCH-010 audit logging → Phase 4 (cross-cutting).

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

The 5 remaining PRD §10.4 tables. Placed before the portals because the portal
shell's notification centre is currently a disabled button, and because
retrofitting audit onto three more processes' writes costs far more later.

- `audit_logs` — actor, action, auditable type/id, before/after, reason,
  request ID, IP. Satisfies the deferred **FR-SCH-010** and is a prerequisite
  for FR-FIN-002's "reason required on every override".
- `notifications` + `GET /notifications`, `PATCH /notifications/{n}/read`.
- Retrofit audit onto existing privileged writes.
- **ML substrate, schema-only:** `prediction_runs`,
  `section_demand_forecasts`, `attrition_predictions`, plus the design for
  §5.5's `HISTORICAL DATA` store.

## Phase 5 — Portals over Existing APIs

Five portals, ~13 modules, **zero new backend**. 22 built endpoints currently
have no UI at all. First real proof the system works end to end.

## Phase 6 — Process 2.0 + Student Portal

- **Eligible Subject Pool** (DFD 2.2/2.3 · FR-ENR-001–003, 005, 011). Reuse
  the prerequisite graph walk and the conflict detector. Note two schema
  facts: prerequisite edges hang off `curriculum_subject_id`, not a bare
  subject pair; and `sections` join to a student's curriculum **only via
  `subject_id`** — there is no `curriculum_id` on `sections`.
- **Enrollment Submission** (DFD 2.4 · FR-ENR-004, 006–010). Atomic
  enrollment + enrollment_subjects + queue_ticket. The
  `enrollments.active_academic_term_id` generated column already enforces
  one-active-per-term at the database layer.

§17-blocked, mechanism-implemented-value-flagged: passing-grade rule,
max units / overload, block-section eligibility.

## Phase 7 — Process 3.0 + Remaining Portals

FR-FIN-001–010: grade encoding, Registrar approval and override, transferee
credits, withdrawal, payment queue, Digital COM. Delivers the Registrar Head,
Registrar Staff and Accounting portals plus Faculty grade submission and the
Student queue/payment/COM modules.

The most ML-consequential phase before 9 — it produces the attrition model's
label and most of its features.

## Phase 8 — Polish, Accessibility, E2E, Performance

PRD §12.4 required states on every page; WCAG 2.1 AA (§12.5); Playwright E2E
for §14.3's 15 critical journeys (no `e2e/` directory exists yet); §14.5
performance on the eligible-subject query and approval queues; §14.4 security
verification.

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

# ■ Portal Feature Matrix — 40 Modules

Source of truth: `frontend/src/app/portal/role-capabilities.ts` (moves to
`src/features/portal/` in Phase 3). Every module is currently a placeholder
empty-state rendering *"This module is not connected to workflow or
authorization APIs."*

Status: ⬜ placeholder · 🔨 in progress · ✅ done

### 1. Student — 4 modules

| Module | Phase | Status |
|---|---|---|
| Eligible Subjects | 6 | ⬜ |
| Enrollment | 6 | ⬜ |
| Queue & Payment | 7 | ⬜ |
| Grades & Digital COM | 7 | ⬜ |

### 2. Admission Staff — 3 modules

| Module | Phase | Status |
|---|---|---|
| Student Accounts | 5 | ⬜ |
| Admission Status | 5 | ⬜ |
| Credential Issuance | 5 | ⬜ |

### 3. Professor / Faculty — 4 modules

| Module | Phase | Status |
|---|---|---|
| Availability Preferences | 5 | ⬜ |
| Teaching Schedule | 5 | ⬜ |
| Class Rosters | 6 | ⬜ |
| Grade Submission | 7 | ⬜ |

### 4. Program Chair — 6 modules

| Module | Phase | Status |
|---|---|---|
| Curriculum | 5 | ⬜ |
| Subjects & Prerequisites | 5 | ⬜ |
| Sections & Schedules | 5 | ⬜ |
| Faculty Assignment | 5 | ⬜ |
| Schedule Proposals | 5 | ⬜ |
| Demand Forecast | **9** | ⬜ blocked on ML |

### 5. Dean — 5 modules

| Module | Phase | Status |
|---|---|---|
| Schedule Approvals | 5 | ⬜ |
| Enrollment Dashboard | 7 | ⬜ |
| Stuck Students | **9** | ⬜ |
| Honors | **9** | ⬜ |
| Reports | **9** | ⬜ |

### 6. Executive Director — 4 modules

| Module | Phase | Status |
|---|---|---|
| Master Schedule | 5 | ⬜ |
| Institution Dashboard | 7 | ⬜ |
| KPIs | **9** | ⬜ |
| Reports | **9** | ⬜ |

### 7. Registrar Head — 6 modules

| Module | Phase | Status |
|---|---|---|
| Audit Logs | 5 | ⬜ needs Phase 4 |
| Enrollment Approvals | 7 | ⬜ |
| Overrides & Voids | 7 | ⬜ |
| Policy Settings | 8 | ⬜ §17-dependent |
| Attrition Analytics | **9** | ⬜ |
| Compliance Reports | **9** | ⬜ |

### 8. Registrar Staff — 4 modules

| Module | Phase | Status |
|---|---|---|
| Credit Mappings | 7 | ⬜ |
| Drops & Withdrawals | 7 | ⬜ |
| Academic Records | 7 | ⬜ |
| Enrollment Documents | 7 | ⬜ |

### 9. Accounting Staff — 4 modules

| Module | Phase | Status |
|---|---|---|
| Payment Queue | 7 | ⬜ |
| Serving Number | 7 | ⬜ |
| Payment Confirmation | 7 | ⬜ |
| COM Finalization | 7 | ⬜ |

**Totals:** 40 modules · 0 done · 13 land in Phase 5 · 8 blocked on Phase 9.

---

# ■ What Is Built

## API surface — 26 routes

**Public:** `GET /api/v1/health` · `POST /api/v1/auth/login`

**Authenticated:** `POST /auth/logout` · `GET /auth/me`

**Readable by every role** (rows filtered by each model's `visibleTo` scope):
`GET /programs` · `/academic-terms` · `/subjects` · `/curricula` ·
`/faculty-availabilities` · `/faculty-subject-preferences` · `/sections` ·
`/schedule-proposals` · `/student-profile` (own-record only)

**`role:program_chair`:** `POST`/`PATCH /curricula` · `POST`/`PATCH /sections` ·
`POST /schedule-proposals`

**`role:faculty`:** `POST`/`PATCH`/`DELETE /faculty-availabilities` and
`/faculty-subject-preferences`

**`role:admission_staff`:** `POST /student-profiles`

**No `role:` middleware:** `PATCH /schedule-proposals/{id}` — one route serves
six transitions, so `ScheduleProposalPolicy` resolves the ability from the
request's `action` field (ADR 0011).

## Database — 21 tables

Identity and reference: `users`, `personal_access_tokens`, `programs`,
`academic_terms`.
Curriculum: `subjects`, `curricula`, `curriculum_subjects`,
`subject_prerequisites`.
Scheduling: `sections`, `schedule_proposals`, `faculty_availabilities`,
`faculty_subject_preferences`.
Enrollment records (**schema only, no API**): `student_profiles`,
`enrollments`, `enrollment_subjects`, `academic_grades`, `queue_tickets`,
`payments`, `enrollment_documents`, `transferee_credits`,
`withdrawal_requests`.

**Not yet created** (PRD §10.4): `audit_logs`, `notifications`,
`prediction_runs`, `section_demand_forecasts`, `attrition_predictions`.

Seeders: `RoleUserSeeder`, `ProgramSeeder`, `AcademicTermSeeder`,
`SubjectSeeder`, `CurriculumSeeder`, `SectionSeeder`, `DemoEnrollmentSeeder`.
All `local`/`testing` only.

## Frontend

**Next.js 16.2.12**, App Router, client-rendered only. Routes live in
`src/app/` (`layout`, `providers`, `page`, `login/`, `portal/[moduleId]/`,
`not-found`); application code in `src/features/`.

4 real screens — institutional landing (with a live health check), login
(real Sanctum, RHF + Zod, accessible error summary), role-filtered portal
shell, branded 404. Plus 12 reviewed shadcn components, a strict-Zod API
client, and TanStack Query.

Everything past the login wall is a static prototype. 40 modules, all
placeholders. Only 4 of 26 endpoints are consumed by any UI.

There is one auth path. The dev-only demo mode and its committed credential
file were deleted in Phase 3.

## Documentation

13 ADRs · `docs/api/openapi.yaml` (Redocly clean) · `docs/api/error-contract.md` ·
7 data-dictionary pages · `docs/testing/SEEDED_IDENTITIES.md` (now the only
credential doc) · `docs/history/2026-07-session-log.md`.

---

# ■ Operational Cautions

Hard-won constraints that will bite again. Read before touching the relevant area.

**MariaDB — never issue a schema-wildcard `GRANT`.** `GRANT … ON db.*` against
the local XAMPP MariaDB 10.4.32 has crashed the server twice
(`VCRUNTIME140.dll`). Use **table-level grants only**, run `CHECK TABLE` on the
privilege tables first, and check the Windows Event Log after. `GRANT` takes
effect immediately — `FLUSH PRIVILEGES` is unnecessary and was implicated in
one crash. Never stop, reconfigure, or upgrade `C:\xampp\mysql`.

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

**Seeded identities can drift from `GRC_SEED_PASSWORD`.** `RoleUserSeeder`
reads the password with `getenv()`, not Laravel's `.env` parsing, so it must be
exported into the process. If live login returns 401 for `*.seed@grc.test`
while the tests pass, the stored hash predates the current value — re-run
`php artisan db:seed --class=RoleUserSeeder` with the variable exported. The
seeder is `updateOrCreate` keyed on email, so it is idempotent and touches only
the nine synthetic accounts.

---

# ■ Open Institutional Decisions (PRD §17)

**Do not hardcode these.** Where a mechanism is needed before the value is
confirmed, implement the mechanism and flag the value — the pattern already
used for section viability thresholds.

| Unconfirmed decision | Blocks |
|---|---|
| Official passing-grade rule, special marks, equivalent grades | Phase 6 (FR-ENR-002) |
| Maximum regular units and overload approval workflow | Phase 6 (FR-ENR-004) |
| Registrar approval requirements for regular vs irregular students | Phase 6 (FR-ENR-011) |
| Section-viability threshold and exception authority | Phase 2 (implemented informational-only) |
| Room capacity source and conflict rules | Phase 2 (deliberately out of scope, ADR 0010) |
| Enrollment reservation timeout and seat-release rules | Phase 6 |
| Queue-ticket reset, priority, serving-number policy, Accounting authority | Phase 7 |
| Payment confirmation fields and supporting references | Phase 7 |
| Whether COR and COM are distinct artifacts | Phase 7 |
| COM format, numbering, signatures, retention | Phase 7 |
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
| 2026-07-28 | Phase 3 — Next.js migration | This entry; 145/145 tests, live proof 17/17 |
