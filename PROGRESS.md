# GRC Enrollment System — Development Progress

**Last updated:** 2026-07-27 19:22 +08:00
**Current branch:** working in worktree `.worktrees/mysql84-identity-foundation`
on `feat/mysql84-identity-foundation`; `main` remains at the locally merged
demo portal plus the verified login correction, both still uncommitted there
**Current PRD version:** v3.1  
**Current phase:** Phase 0 — Discovery, Policy Confirmation, and Foundations  
**Completed slice:** Phase 0A — Contract-first runnable service shells;
MariaDB identity foundation + Sanctum bearer-token auth vertical slice
**Overall status:** Identity/auth slice complete and locally verified,
including live browser QA; Phase 0 remains in progress (CI, authorization
policies, business workflows, and institutional policy confirmations remain)

## Source Documents Reviewed

- [x] `AGENTS.md`
- [x] `PRD.md` in full (1,707 lines)
- [x] `README.md`
- [x] Current backend, frontend, prediction-service, documentation, and tests

## Current Objective

Identity foundation and real Sanctum authentication are **complete** against
the existing XAMPP MariaDB 10.4.32 instance (ADR 0007, superseding the
abandoned isolated MySQL 8.4 plan) — all 9 tasks of
`docs/superpowers/plans/2026-07-27-mariadb-identity-sanctum-auth.md` done and
verified, including a live browser pass. Next: choose an integration path
(commit/merge to `main`, per `AGENTS.md`'s explicit-authorization requirement)
and begin the next PRD vertical slice (authorization Policies, business
workflow endpoints, or CI).

## Completed

- Established the canonical project record.
  - `PRD.md` and the supplied `PRD(1).md` remain byte-identical with SHA-256
    `E180797A70A5CE5CB8B32CED3F753608702A889EF5695F94C35D8DDFD2C10CD2`.
  - Created `AGENTS.md`, this progress record, root documentation, ignore rules,
    and local Git metadata on `main`.
- Audited the workstation and selected a documented compatibility bridge.
  - Local: PHP 8.2.12, Composer 2.9.2, Node 24.14.1, npm 11.11.0,
    Python 3.14.3/3.11.9, MariaDB 10.4.32, and no Docker.
  - Target versions and upgrade triggers are in
    `docs/architecture/version-compatibility.md`.
  - Laravel 12.64 is the temporary PHP 8.2-compatible bridge; it is not the
    final production-platform decision.
- Implemented the database-independent Laravel API shell.
  - Public `GET /api/v1/health` with an exact API Resource envelope.
  - Safe error envelopes, validated/generated request IDs, no-store responses,
    explicit credentialless CORS, and a 60-request/minute health throttle.
  - API-only route inventory: `GET|HEAD api/v1/health`; generated local storage
    serving routes are disabled.
  - No user model, database behavior, migrations, authentication, or business
    policy was introduced.
- Implemented the React/strict-TypeScript frontend shell.
  - Distinctive GRC registrar-ledger service-readiness page using reviewed
    shadcn sources, Tailwind CSS, Lucide icons, and locally bundled fonts.
  - Fetch is isolated to the API service, uses `credentials: "omit"` and
    `cache: "no-store"`, and never contacts the ML service.
  - TanStack Query loading, success, connection, HTTP, configuration, contract,
    and retry states.
  - Strict Zod schemas reject undeclared success and error-envelope fields.
  - Semantic landmarks, skip-link focus, visible focus, reduced motion,
    responsive layouts, and accessible live status text.
- Implemented the private FastAPI prediction-service shell.
  - Private `GET /internal/v1/health`; no CORS, model, prediction endpoint,
    training data, or student data.
  - Safe 404/405/422/500 envelopes with aligned request-ID/no-store headers and
    preserved protocol headers such as `Allow`.
- Added Phase 0 architecture and contract documentation.
  - ADRs `0001`–`0006` cover service boundaries, the Laravel runtime bridge,
    bearer authentication, the private prediction bridge, document generation,
    and artifact storage.
  - `docs/api/openapi.yaml` and `docs/api/error-contract.md` define the current
    public contract.
- Completed an independent foundation/security review.
  - No critical/high issue, committed secret, personal data, or production data
    was found.
  - All three medium findings were corrected and regression-tested.
  - Actionable low gaps for throttling, CORS preflight, exact schemas, route
    exposure, and lockfile wording were corrected.

## In Progress and Deferred

- The user-approved landing, login, documented synthetic test accounts, and
  role-correct portal design is implemented in the isolated feature worktree.
  The complete design
  is at
  `docs/superpowers/specs/2026-07-26-landing-login-demo-portal-design.md`;
  its status now records approval for implementation planning.
- The detailed ten-task red-green-refactor plan is complete at
  `docs/superpowers/plans/2026-07-26-landing-login-demo-portal.md`. It defines
  exact files, interfaces, narrow failure/pass commands, all-nine-role
  credential synchronization, safe routing, demo-session isolation,
  production disablement, portal navigation, static boundary scans, browser QA,
  the full frontend gate, and continuous `PROGRESS.md` checkpoints.
- The user selected inline execution. The executing-plans workflow confirmed
  consent to create an isolated feature worktree. The worktree is ready at
  `.worktrees/landing-login-demo-portal` on
  `feat/landing-login-demo-portal`; hash checks confirmed that `PROGRESS.md`,
  the approved design, and the implementation plan were transferred
  byte-for-byte.
- The isolated frontend baseline is verified: `npm ci --ignore-scripts`
  installed 339 packages with 0 vulnerabilities, and `npm test` passed the
  existing 3 files/9 tests.
- Task 1 is complete through red-green verification. The missing auth-mode
  module produced the expected failing test; the production-safe selector now
  passes 4 focused tests, strict TypeScript passes, and the dependency audit
  reports 0 vulnerabilities after installing `react-router@8.3.0` and
  `@hookform/resolvers@5.5.7`.
- Task 2 is complete. Current shadcn and official component documentation were
  reviewed; dry runs exposed existing Button/Separator overwrites, so both
  repository files were preserved while Input, Field, Sheet, Empty, Avatar,
  and the required Label source were added. Format, ESLint, Oxlint, strict
  TypeScript, and audit all pass.
- Task 3 is complete. Exact typed fixtures and
  `docs/testing/DEMO_CREDENTIALS.md` now cover all nine PRD roles with the
  shared local-demo password and explicit safety/testing instructions. The
  fixture/document contract, auth-mode contract, formatting, and strict
  TypeScript pass (2 files/7 focused tests).
- Task 4 is complete. The demo/disabled gateways, strict Zod session store,
  browser-storage adapter, auth provider, and production wiring are
  implemented. Five auth files/25 tests pass along with formatting, ESLint,
  Oxlint, and strict TypeScript. The storage scan finds `sessionStorage` only in
  `demo-session-store.ts`.
- Task 5 safe routing/guards is complete. Its known-module return-path
  contract requires the role-capability catalog that was originally scheduled
  in Task 8, so the catalog's TDD subtask was pulled forward. The exact
  nine-role matrix, 23-case safe return parser, protected/public guards,
  corruption cleanup, anonymous/authenticated redirects, and branded
  not-found route now pass 3 files/34 focused tests. Formatting, ESLint,
  Oxlint, and strict TypeScript pass. Task 8 still owns the portal shell and
  overview UI.
- Task 6 institutional landing page and embedded public-readiness work is in
  complete using the approved registrar-ledger visual direction. The public
  header/footer, hero, three audience pathways, four-stage journey, and
  extracted readiness component preserve the existing health loading, success,
  connection failure, and retry states. Three page/route files/15 focused tests
  pass with formatting, ESLint, Oxlint, and strict TypeScript.
- Task 7 is complete. The split institutional login, React Hook Form/Zod
  validation, focused error summary, password visibility, generic credential
  failure, pending state, safe/unsafe return handling, and disabled-production
  state pass 2 files/16 login/router tests. Formatting, ESLint, Oxlint, and
  strict TypeScript pass.
- Task 8 is complete. The responsive desktop/mobile shell, accessible Sheet,
  exact role navigation for all nine identities, profile context, disabled
  preview controls, persistence warning, sign-out flow, demo boundary,
  disconnected-term/API states, and role-filtered module cards pass 2 files/16
  focused tests. Formatting, ESLint, Oxlint, and strict TypeScript pass.
- Task 9 is complete. All catalog-assigned module routes render their exact
  role-owned label and description in an accessible Empty preview state. Unknown
  and cross-role module IDs render a scoped portal not-found state without
  foreign navigation/content, direct protected URLs return through login, and
  the overview action remains inside the signed-in role. Two files/52 focused
  tests, formatting, ESLint, Oxlint, and strict TypeScript pass.
- Task 10 documentation and static boundary review are complete. The frontend
  README now documents all route classes, `VITE_AUTH_MODE=demo`, the all-role
  credential guide, production disablement, client-fixture limits, source/test
  layout, and the Sanctum replacement path. Reviewed scans confirm
  `sessionStorage` only in `demo-session-store.ts`, the only raw `fetch(` in
  `api-client.ts`, and no bearer/fake-token/ML endpoint or unfinished-marker
  matches in delivered frontend/testing content.
- Task 10's complete frontend gate passes: Prettier, ESLint, Oxlint, strict
  TypeScript, 16 Vitest files/140 tests, and the Vite production build all exit
  successfully; `npm audit --audit-level=moderate` reports 0 vulnerabilities.
  A fresh completion rerun again passed all 16 files/140 tests.
- The local `main` fast-forward to `292e3c4` is independently verified after a
  clean locked-dependency install: Prettier, ESLint, Oxlint, strict TypeScript,
  16 Vitest files/140 tests, Vite production build, and the moderate-level
  dependency audit all pass; the audit reports 0 vulnerabilities.
- Local integration cleanup is complete: the verified feature worktree was
  removed and `feat/landing-login-demo-portal` was deleted after its commit
  became reachable from `main`. The earlier root-only records remain
  recoverable in the named `pre-merge root progress backup 2026-07-26` stash.
- Browser visual/interaction QA remains an explicit gap. The app started
  successfully on `http://127.0.0.1:5174`, but the supported browser discovery
  and recovery flow returned an empty browser list. The temporary server was
  stopped and port 5174 was verified closed; no visual, zoom, reduced-motion,
  or live keyboard QA pass is claimed.
- Planning-time package metadata confirmed that `react-router@8.3.0` supports
  the installed Node/React baseline and that `@hookform/resolvers@5.5.7`
  supports the installed React Hook Form and Zod versions. Current shadcn
  metadata confirms a Vite, strict-TypeScript, Tailwind 4, non-RSC
  `radix-nova` project. No dependency was installed during planning.
- Design-spec self-review passed: no `TBD`/`TODO`/`FIXME` flags, nine unique
  `.test` credential emails, and the approved shared synthetic password is
  present. The review separated gateway validation from session persistence and
  removed ambiguous demo-expiration wording.
- Phase 0 overall remains open.
- MySQL connection, reversible base migrations, deterministic role seeders,
  migration rollback/fresh verification, and database integration tests are
  waiting on MySQL 8.4 LTS. A fresh post-fix audit still finds only XAMPP
  MariaDB 10.4.32 on port 3306 and PHP 8.2.12.
- CI is not configured or executed yet. All intended local quality gates pass,
  but that is not a substitute for a remote pipeline.
- Authentication, Sanctum bearer tokens, role policies, institutional
  workflows, and business endpoints belong to later complete vertical slices.
- Interactive browser visual QA was attempted, but the available-browser list
  was empty. No screenshot or interactive-browser pass is claimed.
- A user browser check found the login correctly rendering its disabled state
  but unexpectedly unusable for the intended local demo. Investigation shows
  the selector requires `VITE_AUTH_MODE=demo`, while the checkout contains only
  `.env.example`; Vite does not automatically load `.env.example`. The local
  startup contract and production-disable boundary are being reproduced and
  corrected test-first before proceeding to MySQL/Sanctum work.
- The local login-access correction is implemented test-first. A fresh Vite
  development checkout now defaults to demo auth, an explicit local
  `VITE_AUTH_MODE=disabled` still opts out, and every production-mode request
  remains disabled. The active server is serving the corrected selector;
  5 login/router/portal files/79 focused tests pass. README and `.env.example`
  now document the zero-env startup and production boundary.
- The complete frontend gate after the login correction passes: Prettier,
  ESLint, Oxlint, strict TypeScript, 16 Vitest files/144 tests, Vite production
  build, and `npm audit --audit-level=moderate` all complete successfully; the
  audit reports 0 vulnerabilities.

## Next Exact Actions

All nine tasks of the MariaDB identity + Sanctum auth plan are complete and
verified (see the 2026-07-27 session log below). Remaining, in rough priority
order:

1. Choose an integration path for this work (commit and/or merge
   `feat/mysql84-identity-foundation` into `main`) — requires the user's
   explicit authorization per `AGENTS.md`; none has been given yet.
2. Fix the `C:\xampp\mysql\bin\VCRUNTIME140.dll` issue on this workstation
   (re-extract from a fresh XAMPP/MariaDB download, or install the matching
   VC++ Redistributable) so schema-wildcard `GRANT` statements stop crashing
   the server; confirm with a real grant before trusting it again.
3. Begin the next PRD vertical slice: authorization Policies beyond
   role-filtered navigation, the first business workflow endpoint group, or
   CI — whichever the user prioritizes.
4. Update PHP to a current supported patch and re-evaluate the documented
   Laravel 13 upgrade trigger before locking the production framework baseline.
5. Confirm the PRD §17 institutional policy values this slice left
   provisional (Sanctum token expiration; `programs`/`academic_terms` status
   vocabularies) before any production-like deployment.

## PRD Phase Checklist

- [ ] Repository and environment foundation
  - [x] Canonical `PRD.md`, `AGENTS.md`, and `PROGRESS.md`.
  - [x] Local Git repository and ignore rules.
  - [x] Repository/runtime audit and version-compatibility record.
  - [x] Safe service `.env.example` files.
  - [x] Independently runnable frontend, API, and prediction-service shells.
  - [x] Shared API error contract and OpenAPI document.
  - [x] Database-independent local quality gates and dependency audits.
  - [x] Database connection and reversible base migrations (MariaDB per
    ADR 0007, not the PRD's MySQL 8 LTS — a documented local-development
    deviation).
  - [x] Deterministic role seeders.
  - [ ] CI quality checks.
- [x] Authentication (Sanctum bearer-token login/logout/me; RBAC authorization
  policies beyond role-filtered frontend navigation remain unstarted)
- [ ] Pre-enrollment schedules (PRD §5.1, decomposed into sub-projects)
  - [x] Authorization foundation and reference data: `role` middleware,
    `ProgramPolicy`/`AcademicTermPolicy`, `visibleTo` query scopes,
    `GET /api/v1/programs` and `GET /api/v1/academic-terms` (see ADR 0008).
  - [x] Curriculum catalog: subjects, curricula, placements, prerequisite
    cycle rejection (FR-SCH-001, FR-SCH-002; see ADR 0009). First production
    consumer of the `role` middleware — writes restricted to Program Chair.
  - [x] Faculty input: availability and ranked subject preferences
    (FR-SCH-003) — own-record authorization (`role:faculty` +
    `FacultyAvailabilityPolicy`/`FacultySubjectPreferencePolicy`), not the
    status-based visibility every prior slice used.
  - [x] Section planning: capacity, viability threshold (informational only,
    pending §17), professor-double-booking conflict detection (FR-SCH-004,
    FR-SCH-005; see ADR 0010).
  - [x] Approval workflow: `schedule_proposals`, the five-state lifecycle,
    role-per-transition authorization (no `role:` middleware — one route
    serves six transitions), required return reasons, publish bulk-updates
    the term's sections (FR-SCH-007 through FR-SCH-009; see ADR 0011). This
    was the last unblocked §5.1 sub-project.
  - [ ] Demand forecast display (FR-SCH-006) — still blocked until Process
    4.0 (predictive analytics) exists; this is now the only remaining
    §5.1 sub-project besides cross-cutting audit logging.
  - [ ] Audit logging (FR-SCH-010) — cross-cutting, deferred to the audit
    slice rather than any single sub-project above.
- [ ] Enrollment and digital advising
  - Schema-only groundwork landed early as a byproduct of the §5.1
    schema-foundation task below: `student_profiles` plus the eight PRD
    §10.3 tables (`enrollments`, `enrollment_subjects`, `academic_grades`,
    `queue_tickets`, `payments`, `enrollment_documents`,
    `transferee_credits`, `withdrawal_requests`), migrated, tested
    (`EnrollmentRecordsMigrationTest`, `DemoEnrollmentSeederTest`), and
    documented (`docs/data-dictionary/enrollment-records.md`). **No Policy,
    Resource, Controller, or route exists for any of these tables** — this
    checklist item stays unchecked until that API layer has its own
    spec → plan → build cycle.
- [ ] Final approvals, payment queue, and COM
- [ ] Predictive analytics and reporting
- [ ] Cross-cutting UI, notifications, accessibility, and security
- [ ] Testing and ISO/IEC 25010 evaluation support
- [ ] Deployment and handoff documentation

## API and Backend Status

- Implemented endpoints: public, database-independent `GET /api/v1/health`;
  `POST /api/v1/auth/login` (public, throttled); `POST /api/v1/auth/logout`
  and `GET /api/v1/auth/me` (`auth:sanctum` + `EnsureUserIsActive`);
  `GET /api/v1/programs` and `GET /api/v1/academic-terms` (readable by every
  role, row set filtered by each model's `visibleTo` scope);
  `GET /api/v1/subjects` and `GET /api/v1/curricula` (same read pattern);
  `POST /api/v1/curricula` and `PATCH /api/v1/curricula/{curriculum}`
  (`role:program_chair` + `CurriculumPolicy`, full-replace subject/
  prerequisite payload, rejects direct/transitive cycles — see ADR 0009);
  `GET/POST /api/v1/faculty-availabilities` and
  `PATCH/DELETE /api/v1/faculty-availabilities/{facultyAvailability}`, same
  shape for `faculty-subject-preferences` (`role:faculty` + own-record
  Policy — a professor may write only their own rows; every other role
  reads everyone's); `GET/POST /api/v1/sections` and
  `PATCH /api/v1/sections/{section}` (`role:program_chair` + `SectionPolicy`,
  rejects professor double-booking — see ADR 0010); `GET/POST
  /api/v1/schedule-proposals` and `PATCH /api/v1/schedule-proposals/{scheduleProposal}`
  (submission is `role:program_chair`; the transition route carries **no**
  `role:` middleware at all — six actions, six required roles, resolved per
  request by `ScheduleProposalPolicy` — see ADR 0011).
- Route middleware: API group, health/login/reference-data throttles, Sanctum
  bearer auth, and the `role` alias (`EnsureUserHasRole`) — consumed by
  `POST`/`PATCH /curricula`, `sections`, and `schedule-proposals` submission
  (`program_chair`), and the four faculty-input write routes (`faculty`).
  `PATCH /schedule-proposals/{scheduleProposal}` is the first write route
  with no `role:` middleware — see ADR 0011.
- Pending endpoints: every remaining business endpoint group in PRD §8.4
  (enrollment, payment queue, grades, analytics, notifications, audit logs).
- Form Requests: `LoginRequest` (validates, normalizes email, owns the
  per-account+IP throttle key); `StoreCurriculumRequest`/
  `UpdateCurriculumRequest` (validate nested subject/prerequisite arrays,
  run `PrerequisiteCycleDetector` in `withValidator()`);
  `Store`/`UpdateFacultyAvailabilityRequest` and
  `Store`/`UpdateFacultySubjectPreferenceRequest` (composite uniqueness
  enforced via `Rule::unique()->where()->ignore()`, scoped to the
  authenticated professor and submitted term); `Store`/`UpdateSectionRequest`
  (composite unique `section_code`, plus `SectionConflictDetector` in
  `withValidator()`); `StoreScheduleProposalRequest` (one-active-proposal-
  per-term guard) and `UpdateScheduleProposalRequest` (validates the
  requested `action` against the proposal's *current* status, and that
  `decision_reason` is present exactly for the two return actions).
- Policies: `ProgramPolicy`, `AcademicTermPolicy`, `SubjectPolicy` —
  `viewAny`/`view` only, readable by every role; `CurriculumPolicy`/
  `SectionPolicy` add `create`/`update` restricted to `program_chair`. Row
  filtering lives in query scopes, not the Policy (see ADR 0008).
  `App\Http\Controllers\Controller` now `use AuthorizesRequests` again
  (Laravel 12 dropped it from the base controller; `$this->authorize()` did
  not work until this slice). `FacultyAvailabilityPolicy`/
  `FacultySubjectPreferencePolicy` add a new shape: `update`/`delete` require
  role **and** row ownership (`professor_id === $user->id`), not role alone.
  `ScheduleProposalPolicy` adds a third shape: four abilities
  (`approveAsDean`, `approveAsExecutive`, `publish`, `close`) instead of the
  usual `create`/`update` pair, since one route serves six role-specific
  transitions (see ADR 0011).
- API Resources: `HealthResource`, `AuthResource`, `UserResource`,
  `ProgramResource`, `AcademicTermResource`, `SubjectResource`,
  `CurriculumResource` (nested subject placements and prerequisites),
  `FacultyAvailabilityResource`, `FacultySubjectPreferenceResource`,
  `SectionResource` (includes a `remaining_seats` display-only convenience),
  `ScheduleProposalResource`.
- Actions/Services: `App\Actions\Auth\AuthenticateUser` (verifies, rejects
  non-active accounts, issues token, stamps `last_login_at`, all in one
  transaction); `App\Actions\Curriculum\SynchronizeCurriculumSubjects`
  (full-replace write, one `DB::transaction`);
  `App\Domain\Curriculum\PrerequisiteCycleDetector` (pure DFS cycle check,
  no persistence dependency); `App\Domain\Scheduling\ScheduleDayParser`
  (parses `"MWF"`/`"TTh"`-style shorthand into ISO-8601 day-of-week integers)
  and `SectionConflictDetector` (same pure, persistence-free shape as the
  cycle detector — see ADR 0010); `App\Actions\Scheduling\TransitionScheduleProposal`
  (applies one of six transitions, records who/when, and — only for
  `publish` — bulk-updates the term's `planned` sections to `published` in
  the same transaction; see ADR 0011).
- Transactions and idempotency: `AuthenticateUser` wraps token issuance and
  the login timestamp update in one `DB::transaction`;
  `SynchronizeCurriculumSubjects` wraps the delete-and-recreate of a
  curriculum's subject placements/prerequisites in one `DB::transaction`;
  `TransitionScheduleProposal` wraps the proposal's status change and (for
  `publish`) the term's section status bulk-update in one `DB::transaction`.
- Security present: correlation IDs, safe exception rendering, no-store,
  credentialless CORS allowlist/preflight behavior, health/login throttling,
  Sanctum bearer tokens with a provisional expiration policy, one generic
  credential-failure response (no account enumeration), least-privilege
  MariaDB principals (`grc_app` DML-only, `grc_migrator`/`grc_test`
  table-scoped DDL), a clean 401 (not a 500) for every `auth:sanctum`
  route regardless of whether the caller sends `Accept: application/json`
  (`bootstrap/app.php`'s `redirectGuestsTo(fn () => null)` override — see
  Failure and Recovery Record), and the first role-gated write endpoints
  (curriculum authoring restricted to Program Chair, enforced at both the
  route and Policy layers).
- Security pending: authorization Policies for every remaining business
  resource, business rate limiters, audit events, the approved
  (non-provisional) token-expiration policy and status vocabularies, and
  infrastructure controls.

## Frontend Status

- Pages: institutional landing, service readiness, login (mode-aware copy for
  `api`/`demo`/`disabled`), role-aware portal overview, catalog-authorized
  module preview/denial, and branded not-found route.
- Components: public and portal shells (mode-aware "Preview portal"/"Demo
  portal" badging) plus reviewed shadcn Alert, Avatar, Badge, Button, Card,
  Empty, Field, Input, Label, Separator, Sheet, and Skeleton sources.
- Auth: `api` mode is now the default everywhere (was `demo`); `auth-token.ts`
  is the sole owner of the bearer token in `localStorage`; `api-auth-gateway.ts`
  authenticates against the real backend and restores sessions across page
  reload via `GET /api/v1/auth/me`; `demo`/`disabled` modes unchanged and still
  fully covered by their pre-existing tests.
- Data layer: typed API client (`getJson`/`postJson`/authenticated variants,
  registered token provider, 401 handler), strict Zod success/error parsing
  (health + auth schemas), TanStack Query client and health hook.
- Forms: React Hook Form/Zod login with generic credential errors, summary
  focus, pending state, and password visibility — real API validation errors
  and demo fixture errors both flow through the same UI.
- States: loading, success, connection, HTTP, configuration, contract, retry,
  and session-restore.
- Boundary: source scan confirms the sole browser `fetch` call is in
  `src/app/services/api-client.ts`; `localStorage` only in `auth-token.ts`;
  `sessionStorage` only in `demo-session-store.ts`; no ML URL/call present.
- Accessibility/responsiveness: source/component tests pass, **and** live
  Playwright browser QA passed for the first time this project has had a
  connected browser — desktop and 390×844 mobile viewports, real login,
  session restore across a real page reload, sign-out, zero console errors.
- Router status: patched `react-router@8.3.0` provides public, anonymous,
  protected, safe-return, all-role portal, module-preview, and not-found
  routes.

## Database and Migrations

- Applied migrations: `users`, `programs`, `academic_terms`,
  `personal_access_tokens`, `subjects`, `curricula`, `curriculum_subjects`,
  `subject_prerequisites` — all eight, live in `grc_enrollment` (dev) and
  verified reversible (`migrate:rollback` → `migrate`) in
  `grc_enrollment_test`. The curriculum-catalog four are the first in this
  codebase to use foreign keys (`restrictOnDelete`/`cascadeOnDelete` per
  table — see ADR 0009 and `docs/data-dictionary/curriculum-catalog.md`).
- Seeders: `RoleUserSeeder` — nine synthetic identities, one per role;
  `ProgramSeeder`/`AcademicTermSeeder` — a small synthetic catalog (3
  programs, 3 terms), each including one non-learner-visible row so the
  authorization difference is observable. All run against the dev database,
  `local`/`testing` only. No seeder for subjects/curricula in this
  sub-project — not required by any acceptance criterion.
- Database: `C:\xampp\mysql` MariaDB 10.4.32, active on `127.0.0.1:3306`.
  Accepted as the local development substitute for the PRD's MySQL 8 LTS
  requirement per ADR 0007. `grc_enrollment` / `grc_enrollment_test` exist
  with `utf8mb4`/`utf8mb4_unicode_ci`; `grc_app` (DML-only on the domain
  tables), `grc_migrator` (full DDL+DML, used for `php artisan migrate
  --database=mariadb_migrator`), and `grc_test` (full DDL+DML on the test
  database) all exist with least-privilege table-level grants, now including
  `subjects`/`curricula`/`curriculum_subjects`/`subject_prerequisites` for all
  three principals (table-level `GRANT`, not schema-wildcard — see the
  MariaDB-instability memory; zero incidents across this session's 12
  additional grant statements). `grc_app`'s DML grant on these four tables
  was initially missed (only `grc_migrator`/`grc_test` were granted at
  migration time) and had to be added after a live-server 500 surfaced it —
  see Failure and Recovery Record.
- Rollback status: verified — a full `migrate:rollback` then `migrate` cycle
  passes in the automated test suite for both migration sets.
- Applied migrations (schema-foundation task): 13 more tables —
  `student_profiles`, `faculty_availabilities`, `faculty_subject_preferences`,
  `sections`, `schedule_proposals`, `enrollments`, `enrollment_subjects`,
  `academic_grades`, `queue_tickets`, `payments`, `enrollment_documents`,
  `transferee_credits`, `withdrawal_requests`. These were found already
  written to the working tree with **zero git history** (see Failure and
  Recovery Record) and, on inspection, already applied to both `grc_enrollment`
  and `grc_enrollment_test` (migration batch 3) by whatever process wrote
  them — confirmed schema-correct via `SHOW CREATE TABLE`, migrated no further,
  only granted and tested. `enrollments.active_academic_term_id` is a
  `storedAs()` generated column enforcing "one active enrollment per student
  per term" while permitting re-enrollment after a terminal state — see
  `docs/data-dictionary/enrollment-records.md`.
- Grants: table-level `CREATE`+DDL+DML to `grc_migrator`/`grc_test`, then
  `SELECT`/`INSERT`/`UPDATE`/`DELETE` to `grc_app`, on all 13 tables — 39 grant
  statements, zero incidents, `CHECK TABLE` and Windows Event Log checked
  before and after each batch. `FLUSH PRIVILEGES` deliberately omitted this
  time (see Decisions and Assumptions) — `GRANT` takes effect immediately and
  `FLUSH PRIVILEGES` was part of one of the two prior crash incidents.
- Two seeders added that belong to the **already-merged** curriculum-catalog
  slice but were missing a seeder: `SubjectSeeder`, `CurriculumSeeder` — found
  alongside the same untracked batch, sound and idempotent, wired into
  `DatabaseSeeder` ahead of the new `SectionSeeder`/`DemoEnrollmentSeeder`.

## Predictive Analytics Status

- Data preparation, training, inference, model artifacts, and metrics: not
  started.
- Implemented boundary: versioned internal FastAPI liveness only.
- Failure fallback: no prediction endpoint exists yet.
- Privacy: no student/model data and no CORS; the browser cannot reach this
  service through application code.
- Pending infrastructure: enforce private network reachability before a
  prediction endpoint is deployed.

## Tests and Verification

| Check | Command | Result | Last Run |
|---|---|---|---|
| Backend manifest | `composer validate --strict` | Passed | 2026-07-26 |
| Backend format | `composer format:check` | Passed | 2026-07-26 |
| Backend static analysis | `composer analyse` | Passed: Larastan/PHPStan level 8, 14 files | 2026-07-26 |
| Backend tests | `composer test` | Passed: 11 tests, 61 assertions | 2026-07-26 |
| Backend platform | `composer check-platform-reqs` | Passed | 2026-07-26 |
| Backend lock install | `composer install --dry-run --no-scripts --no-interaction` | Passed: nothing to install/update/remove | 2026-07-26 |
| Backend dependency audit | `composer audit --locked --no-interaction` | Passed: no vulnerability advisories | 2026-07-26 |
| Backend routes | `php artisan route:list --json` | Passed: only `GET\|HEAD api/v1/health`, with throttle | 2026-07-26 |
| Frontend clean install | `npm ci --ignore-scripts` | Passed: 339 packages installed, 340 audited, 0 vulnerabilities | 2026-07-26 |
| Frontend format | `npm run format:check` | Passed | 2026-07-26 |
| Frontend ESLint | `npm run lint` | Passed, zero warnings | 2026-07-26 |
| Frontend fast lint | `npm run lint:fast` | Passed | 2026-07-26 |
| TypeScript | `npm run typecheck` | Passed: strict project build | 2026-07-26 |
| Frontend tests | `npm test` | Passed: 3 files, 9 tests | 2026-07-26 |
| Frontend build | `npm run build` | Passed: 2,028 modules; JS 341.20 kB/103.85 kB gzip | 2026-07-26 |
| Frontend audit | `npm audit --audit-level=moderate` | Passed: 0 vulnerabilities | 2026-07-26 |
| Integrated HTTP smoke | temporary Vite + Laravel servers | Passed: frontend/API 200, exact v1 identity, request ID, no-store, CORS | 2026-07-26 |
| Secret-pattern scan | filename-only `rg` scan excluding dependencies/requirements | Passed: 0 potential secret files | 2026-07-26 |
| Service cleanup | listener check for ports 5173, 8000, and 8100 | Passed: no listeners remain | 2026-07-26 |
| Interactive browser QA | browser-runtime discovery | Not run: no browser session available | 2026-07-26 |
| ML lint | `.venv\Scripts\python.exe -m ruff check .` | Passed | 2026-07-26 |
| ML format | `.venv\Scripts\python.exe -m ruff format --check .` | Passed: 6 files | 2026-07-26 |
| ML static analysis | `.venv\Scripts\python.exe -m mypy app` | Passed: 4 source files | 2026-07-26 |
| ML tests | `.venv\Scripts\python.exe -m pytest` | Passed: 6 tests | 2026-07-26 |
| ML dependency integrity | `.venv\Scripts\python.exe -m pip check` | Passed | 2026-07-26 |
| ML dependency audit | isolated `pip-audit 2.10.1 -r requirements.lock` | Passed: no known vulnerabilities | 2026-07-26 |
| ML HTTP smoke | temporary Uvicorn server | Passed: 200, exact internal v1 envelope and headers | 2026-07-26 |
| OpenAPI parse | PyYAML parse/assertions | Passed | 2026-07-26 |
| OpenAPI semantic lint | `npx --yes @redocly/cli@latest lint docs/api/openapi.yaml` | Passed: no warnings/errors | 2026-07-26 |
| Backend format | `composer format:check` | Passed | 2026-07-27 |
| Backend static analysis | `composer analyse` | Passed: Larastan/PHPStan level 8, 32 files | 2026-07-27 |
| Backend tests | `composer test` | Passed: 70 tests, 250 assertions | 2026-07-27 |
| Backend dependency audit | `composer audit --locked --no-interaction` | Passed: no vulnerability advisories | 2026-07-27 |
| Backend routes | `php artisan route:list --json` | Passed: exactly health + 3 auth routes | 2026-07-27 |
| Migration reversibility | `migrate:rollback` then `migrate` | Passed: all 4 tables drop/recreate cleanly | 2026-07-27 |
| Frontend clean install | `npm ci --ignore-scripts` | Passed: 343 packages, 0 vulnerabilities | 2026-07-27 |
| Frontend format | `npm run format:check` | Passed | 2026-07-27 |
| Frontend ESLint | `npm run lint` | Passed, zero warnings | 2026-07-27 |
| Frontend fast lint | `npm run lint:fast` | Passed | 2026-07-27 |
| TypeScript | `npm run typecheck` | Passed: strict project build | 2026-07-27 |
| Frontend tests | `npm test` | Passed: 20 files, 174 tests | 2026-07-27 |
| Frontend build | `npm run build` | Passed: 509.01 kB/158.30 kB gzip (chunk-size advisory only) | 2026-07-27 |
| Frontend audit | `npm audit --audit-level=moderate` | Passed: 0 vulnerabilities | 2026-07-27 |
| OpenAPI semantic lint | `npx --yes @redocly/cli@latest lint docs/api/openapi.yaml` | Passed: no warnings/errors (after adding auth routes/schemas) | 2026-07-27 |
| Interactive browser QA | Playwright MCP against live Laravel (127.0.0.1:8100) + Vite (127.0.0.1:5173) + MariaDB | Passed: real login, session restore across full page reload, sign-out, mobile viewport, zero console errors — first successful browser session in this project's history | 2026-07-27 |
| Live HTTP smoke (auth) | temporary `php artisan serve` on 127.0.0.1:8100 | Passed: login/me/logout/revoked-token/generic-401/throttle all exact per plan | 2026-07-27 |
| Service cleanup | listener check for ports 3306 (unaffected), 5173, 8100 | Passed: dev-server ports closed after QA; MariaDB left running (shared XAMPP service) | 2026-07-27 |
| Backend format | `composer format:check` | Passed | 2026-07-27 |
| Backend static analysis | `composer analyse` | Passed: Larastan/PHPStan level 8, 0 errors | 2026-07-27 |
| Backend tests | `composer test` | Passed: 110 tests, 325 assertions | 2026-07-27 |
| Backend dependency audit | `composer audit --locked` | Passed: no vulnerability advisories | 2026-07-27 |
| Backend routes | `php artisan route:list --json` | Passed: exactly health + 3 auth + 2 reference-data routes (6 total) | 2026-07-27 |
| OpenAPI semantic lint | `npx --yes @redocly/cli@latest lint docs/api/openapi.yaml` | Passed: no warnings/errors (after adding programs/academic-terms) | 2026-07-27 |
| Live HTTP authorization proof | curl against a running `php artisan serve` on 127.0.0.1:8000, seeded dev database | Passed: `student.seed@grc.test` received 2 programs (both `active`) and 2 terms (no `planning`); `chair.seed@grc.test` received all 3 programs (including `inactive`) and all 3 terms (including `planning`) from the identical URL; `Cache-Control: no-store, private` confirmed; a request with no bearer token returned 401 `UNAUTHENTICATED` both with and without an `Accept: application/json` header | 2026-07-27 |
| Backend format | `composer format:check` | Passed | 2026-07-27 |
| Backend static analysis | `composer analyse` | Passed: Larastan/PHPStan level 8, 0 errors | 2026-07-27 |
| Backend tests | `composer test` | Passed: 162 tests, 451 assertions | 2026-07-27 |
| Backend routes | `php artisan route:list --json` | Passed: exactly 10 routes (health + 3 auth + 2 reference-data + 4 curriculum-catalog) | 2026-07-27 |
| Migration reversibility (curriculum catalog) | `migrate:rollback` then `migrate` | Passed: all 4 new tables drop/recreate cleanly, FK-dependency order respected | 2026-07-27 |
| OpenAPI semantic lint | `npx --yes @redocly/cli@latest lint docs/api/openapi.yaml` | Passed: no warnings/errors (after adding subjects/curricula) | 2026-07-27 |
| Live HTTP proof (curriculum catalog) | curl against a running `php artisan serve` on 127.0.0.1:8000, dev database | Passed, after fixing the `grc_app` grant gap below: Program Chair created a curriculum with a valid prerequisite (201); the same role's attempt at a direct two-subject cycle was rejected (422 `VALIDATION_FAILED`, exact PRD wording "cannot create a prerequisite cycle"); a Student's identical `POST` was rejected (403 `FORBIDDEN`) while their `GET` still succeeded and correctly omitted the still-`draft` curriculum; `PATCH` fully replaced the subject list and, once `status` became `active`, the Student's next `GET` did include it | 2026-07-27 |
| MariaDB privilege-table health | `CHECK TABLE mysql.db, mysql.global_priv, mysql.tables_priv, mysql.columns_priv, mysql.procs_priv` | Passed: all `OK`, before and after 39 grant statements | 2026-07-28 |
| Windows Event Log crash check | `Get-WinEvent` filtered for `mysqld` Application Errors | Passed: no new crash before, immediately after granting, or after migrating — still only the two known 2026-07-27 incidents | 2026-07-28 |
| Backend format | `composer format:check` | Passed | 2026-07-28 |
| Backend static analysis | `composer analyse` | Passed: Larastan/PHPStan level 8, 106 files, 0 errors | 2026-07-28 |
| Backend tests | `composer test` | Passed: 248 tests, 640 assertions (up from 162/451) | 2026-07-28 |
| Backend dependency audit | `composer audit --locked` | Passed: no vulnerability advisories | 2026-07-28 |
| Backend routes | `php artisan route:list --json` | Passed: still exactly 10 routes — this task is schema-only, no new endpoints | 2026-07-28 |
| Backend format | `composer format:check` | Passed | 2026-07-28 |
| Backend static analysis | `composer analyse` | Passed: Larastan/PHPStan level 8, 116 files, 0 errors | 2026-07-28 |
| Backend tests | `composer test` | Passed: 278 tests, 752 assertions (up from 248/640) | 2026-07-28 |
| Backend dependency audit | `composer audit --locked` | Passed: no vulnerability advisories | 2026-07-28 |
| Backend routes | `php artisan route:list --json` | Passed: exactly 18 routes (10 prior + 8 faculty-input) | 2026-07-28 |
| OpenAPI semantic lint | `npx --yes @redocly/cli@latest lint docs/api/openapi.yaml` | Passed: no warnings/errors (after adding faculty-availabilities/faculty-subject-preferences; also fixed a pre-existing edit slip that had split `minimum_grade`'s `maxLength` from its `type`) | 2026-07-28 |
| Backend format | `composer format:check` | Passed | 2026-07-28 |
| Backend static analysis | `composer analyse` | Passed: Larastan/PHPStan level 8, 123 files, 0 errors (after fixing 4 errors — see Failure and Recovery Record) | 2026-07-28 |
| Backend tests | `composer test` | Passed: 312 tests, 832 assertions (up from 278/752) | 2026-07-28 |
| Backend dependency audit | `composer audit --locked` | Passed: no vulnerability advisories | 2026-07-28 |
| Backend routes | `php artisan route:list --json` | Passed: exactly 21 routes (18 prior + 3 section-planning) | 2026-07-28 |
| OpenAPI semantic lint | `npx --yes @redocly/cli@latest lint docs/api/openapi.yaml` | Passed: no warnings/errors (after adding sections) | 2026-07-28 |
| Backend format | `composer format:check` | Passed | 2026-07-28 |
| Backend static analysis | `composer analyse` | Passed: Larastan/PHPStan level 8, 129 files, 0 errors | 2026-07-28 |
| Backend tests | `composer test` | Passed: 335 tests, 898 assertions (up from 312/832) | 2026-07-28 |
| Backend dependency audit | `composer audit --locked` | Passed: no vulnerability advisories | 2026-07-28 |
| Backend routes | `php artisan route:list --json` | Passed: exactly 24 routes (21 prior + 3 approval-workflow) | 2026-07-28 |
| OpenAPI semantic lint | `npx --yes @redocly/cli@latest lint docs/api/openapi.yaml` | Passed: no warnings/errors (after adding schedule-proposals) | 2026-07-28 |

Never change a result to `Passed` unless that command actually ran
successfully.

## Decisions and Assumptions

| Date | Decision | Reason and PRD impact |
|---|---|---|
| 2026-07-26 | Canonicalize one byte-identical supplied Markdown PRD as `PRD.md`. | Provides the required source-of-truth path without changing requirements. |
| 2026-07-26 | Implement only a database-independent Phase 0A shell in this slice. | The repository started empty and the required MySQL environment is absent; no policy value was invented. |
| 2026-07-26 | Use Laravel 12.64 as a short-lived local bridge. | PHP 8.2.12 cannot run Laravel 13; production planning must upgrade PHP and re-evaluate. |
| 2026-07-26 | Use TypeScript 6.0.x, React 19, Vite 8, and Tailwind 4. | This is the current compatible strict-TypeScript toolchain recorded in the version matrix. |
| 2026-07-26 | Defer React Router. | The one-page shell needs no router, and reviewed React Router 7.18.1 carried an unfixed high RSC advisory. |
| 2026-07-26 | Keep the browser boundary at Laravel. | The SPA calls only `/api/v1`; the FastAPI service is private and advisory. |
| 2026-07-26 | Rate-limit public health at 60 requests/minute per Laravel throttle key. | Makes the documented 429 contract truthful without database state. Business routes need use-case-specific policies later. |
| 2026-07-26 | Mark licensing as pending authorized GRC approval. | The generated framework license was not adopted as the product's license. |
| 2026-07-26 | Use a modern registrar-ledger visual direction. | Provides a distinctive institutional Phase 0 surface without inventing workflow policy. |
| 2026-07-26 | Document synthetic demo credentials for all nine PRD roles. | The user needs to test every role portal; the file and UI must label them local-demo-only and never imply production authentication. |
| 2026-07-26 | Use React Router 8.3.0 in client-library mode for the demo routes. | The current patched release resolves the recorded RSC advisory; this SPA will not use RSC, server actions, or framework-mode packages. |
| 2026-07-26 | Enable synthetic authentication only in development/test modes. | Production builds may show the public landing page but must not accept committed demo credentials. |
| 2026-07-26 | Plan `react-router@8.3.0` and `@hookform/resolvers@5.5.7`. | Registry metadata confirms compatibility with Node 24, React 19.2.7, React Hook Form 7.83, and Zod 4.4; the plan retains client-library/non-RSC routing only. |
| 2026-07-27 | Abandon the isolated MySQL 8.4 instance; use the existing XAMPP MariaDB 10.4.32 on port 3306 with scoped principals instead. | Four review rounds hardened 2,628 lines of lifecycle PowerShell that had never once been executed; user explicitly chose to stop and use MariaDB. See ADR 0007. Collation changes to `utf8mb4_unicode_ci` (MySQL 8's `utf8mb4_0900_ai_ci` does not exist in MariaDB). |
| 2026-07-27 | Fold the Sanctum login/logout/me vertical slice into this identity-foundation slice instead of deferring it. | User explicitly requested it so the portal authenticates against the database instead of frontend fixtures; PRD §8.4/§9.1 already specify the exact three routes and bearer-token rules. |
| 2026-07-27 | Decompose PRD §5.1 (Pre-enrollment schedules) into six sub-projects instead of one slice. | Spans 10 FRs, 8 tables, and 4 independent subsystems plus a demand-forecast requirement blocked on Process 4.0; attempting it as one unit was not viable. |
| 2026-07-27 | Build authorization as `role` middleware **and** Policies, with row filtering in query scopes, not just Policies alone. | PRD §9.4 requires both role-level and record-level access; a Policy cannot filter a collection, so "which rows" had to live in a query scope. Sets the pattern for ~40 future endpoints (ADR 0008). |
| 2026-07-27 | Ship the `role` middleware in this slice even though no production route consumes it yet. | Both new endpoints are readable by all nine roles; the middleware's first real consumer is the curriculum-catalog sub-project. Built and tested now so that slice inherits a proven mechanism rather than building it under time pressure later. |
| 2026-07-27 | Introduce provisional `ProgramStatus` (`active`/`inactive`) and `AcademicTermStatus` (`planning`/`active`/`closed`) enums with an `isVisibleToLearners()` predicate. | PRD §17 leaves the real vocabularies unconfirmed; these exist only so learner-scoped vs. planning roles can be proven to receive different results. Same provisional-value discipline as `SANCTUM_TOKEN_EXPIRATION`. Columns stay `VARCHAR`, so the real vocabulary lands as a data migration, not a schema change. |
| 2026-07-27 | Override Laravel's default `redirectGuestsTo` with `fn () => null` for every guard, application-wide. | Found while live-verifying this slice: any `auth:sanctum` route crashed with a 500 `RouteNotFoundException` for a caller that omits `Accept: application/json`, because `ApplicationBuilder` always points guests at a `login` named route this JSON-only API doesn't have. Affected every pre-existing guarded route, not just this slice's two new ones. |
| 2026-07-27 | Manage `curriculum_subjects`/`subject_prerequisites` only as a nested array inside `POST`/`PATCH /curricula`, not as separate endpoints. | PRD §8.4 lists no standalone routes for either table; treating a curriculum as one aggregate root matches the literal endpoint list instead of inventing new routes. See ADR 0009. |
| 2026-07-27 | `POST`/`PATCH /curricula` fully replace a curriculum's subject placements and prerequisites rather than diffing incrementally. | PRD does not specify partial-update semantics for this resource; a full replace is simpler to test and avoids undefined behavior when a placement is omitted from a partial payload. See ADR 0009. |
| 2026-07-27 | Restrict `POST`/`PATCH /curricula` to the Program Chair role via the `role` middleware (first production consumer) plus `CurriculumPolicy`. | Matches the frontend's existing "Curriculum"/"Subjects & Prerequisites" module ownership in `role-capabilities.ts` — not a new policy invented for this slice. |
| 2026-07-27 | Introduce provisional `SubjectStatus` (`active`/`inactive`) and `CurriculumStatus` (`draft`/`active`/`archived`) enums, and use foreign keys with explicit delete behavior (`restrictOnDelete`/`cascadeOnDelete`) for the first time in this codebase. | Same PRD §17 provisional-value discipline as `ProgramStatus`/`AcademicTermStatus`; PRD §10.6 requires foreign keys with explicit delete behavior, which the identity-foundation slice deferred. See ADR 0009. |
| 2026-07-28 | Adopt, rather than discard, a 43-file batch of untracked migrations/models/enums/seeders/tests found in the working tree with zero git history — after a full read-through confirmed it matches this codebase's conventions (PRD §-citations, PROVISIONAL-vocabulary flags, correct FK semantics). | User's explicit choice among three options; discarding unreviewed work of unknown value, or silently building on it without review, were both worse than auditing it first. |
| 2026-07-28 | Land the enrollment-records domain (`student_profiles` + 8 PRD §10.3 tables) as schema-only — migrated, tested, documented — with no Policy/Controller/route/endpoint. | Confirmed with the user: this domain belongs to a distinct, later PRD phase ("Enrollment and digital advising"), not §5.1. Building its API now would jump the checklist's own sequencing. |
| 2026-07-28 | Split the remaining scaffold work into four sequential branches (schema foundation → faculty input → section planning → approval workflow) reviewed as one plan but merged one at a time. | Matches every prior sub-project's one-branch-per-slice discipline; a single mega-branch across four sub-projects would make review and rollback harder without saving real effort. |
| 2026-07-28 | Add an `integer` cast for `StudentProfile.year_level`, which the found scaffold omitted. | Every other tiny/small-int column in this codebase (`Section.capacity`, `CurriculumSubject.year_level`, `FacultyAvailability.day_of_week`, etc.) is cast; the omission was an inconsistency, not a deliberate choice — caught by a new unit test. |
| 2026-07-28 | Omit `FLUSH PRIVILEGES` from this session's `GRANT` batches. | `GRANT` takes effect immediately in MySQL/MariaDB; `FLUSH PRIVILEGES` is unnecessary here and was part of the command sequence in one of the two prior `VCRUNTIME140.dll` crash incidents. |
| 2026-07-28 | Give `FacultyAvailability`/`FacultySubjectPreference` an own-record `scopeVisibleTo()` (`professor_id === $user->id` for learner-scoped roles) instead of the status-based visibility every prior model used. | Neither table has a status column; the real visibility question is "whose row is this," not "is this row published." Reuses `UserRole::isLearnerScoped()` as the role split rather than inventing a parallel predicate. |
| 2026-07-28 | Enforce the two `faculty_subject_preferences` composite-uniqueness rules via `Rule::unique()->where()->ignore()` in the Form Request, not a custom `withValidator()` graph check. | The underlying rule is a plain uniqueness check, not graph logic like the prerequisite cycle detector; Laravel's built-in composite-unique rule reaches the same outcome (clean 422, not a raw SQL error) with less code. |
| 2026-07-28 | Scope `SectionConflictDetector` (FR-SCH-005) to same-professor double-booking only — no room conflicts, no faculty-availability matching. | Neither the found schema nor its seed data evidences either as a hard rule (`room` is an unconstrained free string; nothing links `sections` to `faculty_availabilities`). Inventing either would repeat the §17 mistake of encoding an unconfirmed policy as settled. See ADR 0010. |
| 2026-07-28 | Parse `sections.schedule_days` shorthand (`"MWF"`, `"TTh"`, `"Sat"`) into ISO-8601 day-of-week integers via a new `ScheduleDayParser`, rather than comparing the raw strings. | The shorthand is `SectionSeeder`'s own convention, not a PRD vocabulary; parsing it precisely (longest-token-first, so `Th`/`Sat`/`Sun` aren't swallowed by single-letter checks) is what makes day-overlap checking possible at all, and produces the same numbering `FacultyAvailability.day_of_week` already uses. See ADR 0010. |
| 2026-07-28 | Restrict section writes to `role:program_chair`, matching curriculum authorship. | Sections are the chair's schedule plan — same reasoning as ADR 0009's curriculum-write restriction. *(Assumption, not literal PRD text — flagged in the approved plan for review.)* |
| 2026-07-28 | Map the six schedule-proposal transitions to roles as: `dean_approve`/`dean_return` → Dean; `executive_approve`/`executive_return`/`publish` → Executive Director; `close` → Registrar Head. Each `*_return` action is treated as the *same* role reconsidering their own checkpoint, not a later role rejecting an earlier one's decision. | Inferred from the state/action naming and typical hierarchical-approval symmetry, not literal PRD text. See ADR 0011. *(Assumption flagged for review.)* |
| 2026-07-28 | Give `schedule_proposals` no new foreign key to `sections`; `publish` bulk-updates the term's `planned` sections to `published` by `academic_term_id` instead. | The two tables were designed independently with no relationship; a bulk update needs no migration to either already-shipped table, and is exactly correct given a term has at most one non-closed proposal at a time. See ADR 0011. |
| 2026-07-28 | Enforce "one active proposal per term" in `StoreScheduleProposalRequest`, not a DB constraint. | Same reasoning as `enrollments.active_academic_term_id`: a plain `UNIQUE(academic_term_id)` would wrongly block resubmission after a term's proposal closes, but unlike enrollments this check only needs to run at creation time, so an application-level guard (not a generated column) is sufficient. |
| 2026-07-28 | Test the approval lifecycle as four separate single-actor tests rather than one chained multi-user walk. | Chaining `withToken()` across different users within one test method hit a Sanctum guard-caching quirk (the guard resolves and caches a user once per instance, outliving a single simulated request); `forgetGuards()` did not resolve it. Every other endpoint test in this session already uses one authenticated actor per test — matching that structure sidesteps the framework issue entirely rather than fighting it. See Failure and Recovery Record. |

## Blockers and Clarifications Needed

### Supported database environment

- Resolved 2026-07-27: no longer a blocker for local development. The user
  authorized using the existing XAMPP MariaDB 10.4.32 instance (ADR 0007)
  instead of waiting for an isolated MySQL 8.4 install, which had consumed
  four review rounds without ever being executed.
- Residual gap: MariaDB 10.4 is not the PRD-specified MySQL 8 LTS, and MariaDB
  10.4 itself is past its upstream end-of-life (June 2024). Migrations,
  constraints, and integration tests in this phase are verified against
  MariaDB only; a real MySQL 8 re-verification remains required before any
  production deployment decision.
- Owner: revisit alongside the PHP/Laravel production-baseline decision below.

### PHP production baseline

- Blocker: local PHP 8.2.12 is behind current supported patch levels and cannot
  run Laravel 13.
- Impact: the final production Laravel/PHP baseline cannot be locked.
- Owner: development environment owner.
- Safe work meanwhile: maintain the documented Laravel 12 compatibility bridge.

### Institutional policy values

- Blocker: the values listed as open decisions in PRD §17 remain unconfirmed.
- Impact: related workflows cannot hardcode those values or be declared
  production-complete.
- Owner: authorized GRC stakeholders for each policy domain.
- Safe work meanwhile: generic schema, configuration placeholders,
  authorization foundations, and synthetic tests.
- Added 2026-07-27: `App\Domain\Organization\ProgramStatus`
  (`active`/`inactive`) and `AcademicTermStatus`
  (`planning`/`active`/`closed`) are **provisional** vocabularies in the same
  vein as `SANCTUM_TOKEN_EXPIRATION` — needed so the authorization slice has
  something concrete to filter on, not an approved institutional value. The
  `programs.status`/`academic_terms.status` columns stay `VARCHAR` so the real
  vocabulary lands as a data migration, not a schema change, once confirmed.
- Added 2026-07-27 (curriculum catalog): `App\Domain\Curriculum\SubjectStatus`
  (`active`/`inactive`) and `CurriculumStatus`
  (`draft`/`active`/`archived`) are provisional for the same reason. Also,
  `subject_prerequisites.minimum_grade` is stored as an opaque `VARCHAR` and
  never validated against a grading scale, since the official passing-grade
  rule (PRD §17) is unconfirmed.

### Visual verification

- Gap, not a product blocker: no in-app browser or Chrome session was available
  during Phase 0A verification.
- Impact: no screenshot, interactive focus traversal, or responsive visual pass
  is claimed.
- Next opportunity: rerun the readiness page at desktop and mobile widths when a
  browser session is connected.

## Failure and Recovery Record

- The first canonical-file patch was invalid, and the patch move then removed
  the redundant PRD copy; it was restored from the hash-verified canonical file.
- Initial runtime lookup could not find `mysql` on `PATH`; the explicit XAMPP
  audit found MariaDB 10.4.32 instead.
- The initial Laravel scaffold dependency lookup and several early Composer
  audits timed out against Packagist. Dependency installation recovered, and
  the final explicit locked audit passed with no advisories.
- Initial strict Composer validation rejected an exact framework constraint
  style; the supported `^12.64` constraint passes.
- An initial backend CORS test expected an absent header for a single configured
  origin. Live diagnosis showed the framework emits a fixed non-matching origin;
  coverage was corrected and later expanded to a two-origin allowlist,
  preflight, and rejected-origin behavior.
- The first ML Ruff run found import-order/format changes, and the original
  TestClient dependency emitted an upstream deprecation warning. The code was
  formatted and the current official test client installed; final checks pass.
- The first OpenAPI parse command had invalid PowerShell quoting. Two Redocly
  iterations then exposed missing public-security, 4xx, server, and license
  metadata. The final document parses and lints without warnings.
- The first frontend audit found a high React Router RSC advisory and a moderate
  transitive shadcn CLI advisory. Both unused runtime packages were removed;
  the final audit reports zero vulnerabilities.
- The first TypeScript 6 check rejected deprecated `baseUrl`; path aliases were
  retained without it and strict checking passes.
- Browser selection failed because no browser was available. Required
  troubleshooting confirmed the browser list was empty; no fallback browser
  claim was made.
- Final route inventory unexpectedly exposed generated local storage serve/upload
  routes. `filesystems.disks.local.serve` was disabled, and the rerun shows only
  the health route.
- The first listener-cleanup verification command had a PowerShell pipeline
  syntax error; the corrected command confirmed ports 5173, 8000, and 8100 were
  no longer listening.
- The first isolated Python-audit cleanup script was rejected before execution
  by command policy, and `pipx` was unavailable. A separate temporary venv
  completed the audit. Recursive cleanup of that verified temporary directory
  was also blocked, so the non-project tool environment remains under the user
  temp directory at `grc-pip-audit-20260726-1719`; no workspace file is affected.
- The first combined design-spec/progress patch failed atomically because one
  expected `PROGRESS.md` line did not match its wrapped form. No partial file was
  created; the specification and progress changes were reapplied as smaller
  exact patches.
- The first Task 2 source-review `rg` expression used lookahead without
  `--pcre2`; the corrected scan ran with PCRE2 and found no forbidden import,
  remote asset, or RSC directive after review.
- The isolated worktree's first format check flagged 44 files because global
  Git `core.autocrlf=true` checked tracked files out as CRLF while Prettier
  requires LF. Byte/line-ending evidence confirmed the root cause.
  `.gitattributes` now fixes the repository policy at LF (PDF remains binary);
  formatting was normalized and the rerun passes.
- The upstream generated Field source used `Array<T>`, which the repository
  ESLint policy forbids. It was changed to the equivalent `T[]`; ESLint and all
  other Task 2 checks now pass. Existing Button and Separator sources were not
  overwritten.
- The first credential-document test used `new URL(..., import.meta.url)`;
  Vite rewrote the static asset URL, so Node rejected the resulting non-file
  scheme. A raw import was also correctly denied because the document is above
  Vite's frontend root. The test now uses Node file access with a file-local
  Node type reference, preserving the browser project's restricted global type
  set; focused tests and typecheck pass.
- Running Vitest, TypeScript, and Prettier concurrently in the Windows worktree
  starved Vitest's two fork workers until their startup timeout. The same tests
  pass in 1.90 seconds when checks run sequentially, so resource-sensitive
  frontend checks will remain sequential for this worktree.
- Task 4's first ESLint run found seven integration-policy issues: unbound
  method destructuring in the probe, synchronous effect state updates, a
  component/hook Fast Refresh split, `async` functions without `await`, and an
  unused storage initialization. The provider now restores in a cancellable
  microtask, context/hook exports are separated, promise boundaries are
  explicit, and the browser store returns directly; focused tests and both
  linters pass.
- Strict TypeScript then rejected the gateway error's constructor parameter
  property under `erasableSyntaxOnly`. It now uses an explicit declared field
  and assignment; typecheck passes without relaxing configuration.
- Task 5's first lint pass rejected a control-character regular expression and
  mixed component/helper Fast Refresh files. The parser now checks Unicode code
  points explicitly, and the route location probe is isolated in its own
  component file; route tests and both linters pass.
- Task 7 tests found that React Hook Form's default field autofocus overrode the
  required error-summary focus and that the anonymous-only guard could redirect
  to `/portal` before the login page applied a safe module return path. The form
  now focuses its committed summary in an effect, and the guard uses the same
  safe return parser; all login and router tests pass.
- Task 8 tests found that clearing the demo session synchronously could let the
  protected-route guard redirect to login before the explicit home navigation
  settled. The sign-out handler now awaits navigation before clearing session
  state; its route and persistence assertions pass.
- Task 8's first quality command used the wrong local Oxlint script name
  (`lint:oxlint` instead of `lint:fast`) and the format check found two newly
  added test files. No application defect was hidden; the files are being
  normalized and the exact repository scripts will be used for the rerun.
- Task 9's first unknown-module assertion scanned the entire test document and
  saw the route only because the test-only location probe intentionally prints
  the current URL. The assertion now scopes the no-leak check to the rendered
  unavailable-module region; all 52 focused tests pass.
- Task 10's first raw-fetch scan passed an over-escaped regular expression to
  PowerShell and `rg` rejected the unclosed group. A fixed-string scan exposed
  one intentional `refetch()` name plus the raw call; a reviewed PCRE2
  identifier-boundary rerun confirms the sole raw browser `fetch(` remains in
  `src/app/services/api-client.ts`.
- The first post-merge `npm ci --ignore-scripts` on `main` stopped with Windows
  `EPERM` while replacing Rolldown's native binding. This indicates the existing
  binary is open by a local process. Two exact workspace Vite PIDs were found on
  ports 5173/5174, stopped, and both ports confirmed closed. The clean-install
  retry then passed.
- A post-merge command orchestrator yielded partial Vitest/build output without
  completion status and advanced conservatively. Those partial results were
  discarded; no related processes remained, and direct isolated reruns
  completed with 140/140 tests and a successful production build.
- The requested Playwright browser validation was attempted against the active
  local login URL, but the supported MCP browser runtime again returned “No
  browser is available.” This remains a tooling gap rather than an application
  pass; focused browser-like component/router tests are being run, and live
  Playwright claims remain withheld.
- After pushing the curriculum-catalog merge, `git status` showed 43 untracked
  files plus a modified `DatabaseSeeder.php` — none of it with any git
  history (checked `git log --all`, `git stash list`, and `git reflog`; all
  came up empty for these files). A full read-through found genuinely careful,
  convention-matching code (13 migrations/models across faculty input, section
  planning, approval workflow, and a separate enrollment-records domain), but
  it had never migrated cleanly: a `composer test` run mid-investigation hit
  `SQLSTATE[HY000] [2002] ... target machine actively refused it` for 7 of 14
  tests. Checked the Windows Event Log before concluding anything — no fresh
  `mysqld.exe` crash, still only the two known 2026-07-27 incidents — so the
  refusal was a transient connectivity gap, not a new crash. Separately
  discovered the dev database's `migrations` table already listed all 13 new
  tables as applied (batch 3) even though the files were never committed —
  `SHOW CREATE TABLE` confirmed the live schema, including the
  `enrollments.active_academic_term_id` generated column, matches the
  migration files exactly. Resolved by user decision (see Decisions and
  Assumptions) rather than guessing: adopt the code, land the schema as
  tested/documented groundwork, keep the enrollment-records domain schema-only,
  and build the remaining §5.1 sub-projects' API layer through the normal
  branch-per-slice process.
- A `docs/api/openapi.yaml` edit for the faculty-input schemas matched its
  `old_string` one property short of the actual file content, splitting the
  pre-existing `CurriculumSubjectPrerequisiteInput.minimum_grade` property's
  `type: string` from its `maxLength: 255` sibling — the latter got stranded,
  badly indented, at the very end of the file. `@redocly/cli lint` caught it
  immediately as a YAML parse error before any completion claim; fixed by
  restoring `maxLength: 255` next to `type: string` and deleting the
  orphaned line, then re-linting clean.
- While starting a `php artisan serve` for live verification, found a
  pre-existing listener already on port 8000 (two `php.exe` processes,
  started ~40 minutes before this check) that this session never started —
  a possible concurrent process working against the same repository/database.
  Identified my own new pair by matching process start times exactly, stopped
  only those two, and left the pre-existing pair (and one other unrelated
  `php.exe`) untouched rather than guessing at ownership. Relied on the
  automated test suite's full HTTP-level coverage (real Sanctum tokens
  through `postJson`/`patchJson`/`deleteJson` against the real named routes)
  instead of further manual `curl` verification for this slice.
- A new `SectionPolicyTest` test called its own `makeUser(UserRole::ProgramChair)`
  helper twice in one test method; the helper derives each user's email from
  the role alone (`$role->value.'@grc.test'`), so the second call hit
  `users_email_unique`. Fixed by creating the Program Chair once and reusing
  it for both the `create()` and `update()` assertions — the two calls never
  needed distinct users in the first place.
- `SectionConflictDetector`/`ScheduleDayParser` and the two Section Form
  Requests hit the same two Larastan patterns already seen this session:
  (1) a nullable array-shape field (`schedule_days: ?string`) passed to a
  `string`-typed parameter after a null-check in a *different* method —
  PHPStan doesn't carry flow-sensitive narrowing across a method-call
  boundary, fixed by making `ScheduleDayParser::parse()` itself accept
  `?string` and return `[]` for `null`; (2) the same `Collection::map()->all()`
  vs `list<...>` gap the curriculum-catalog slice hit, fixed the same way
  (`array_values(...)` wrapping the whole chain).
- Mid-way through this task's first full test run, `mysqld.exe` stopped
  entirely (confirmed via `tasklist` and `netstat` — no process, nothing on
  port 3306) with **no** crash logged in the Windows Event Log, so this was a
  clean stop by something else, not a third `VCRUNTIME140.dll` incident. The
  symptom was misleading: `composer test` ran for 300+ seconds (versus its
  usual ~20–25s) before Composer's own process-timeout killed it, and the
  piped `| tail` made the reported exit code 0 regardless — the real failure
  was buried in a wall of unrelated `LoginEndpointTest` failures partway
  through the run. Paused and asked rather than starting the service myself,
  given this instance's crash history and every prior restart in this
  project having gone through the user via the XAMPP Control Panel; user
  confirmed they had started it, and a clean rerun completed normally in
  ~23s with everything green.
- `ProgramResource`/`AcademicTermResource` initially defined `withResponse()`
  to set `Cache-Control: no-store, private`, following `UserResource`'s
  pattern exactly — but the header assertion in both new endpoint tests failed
  with `no-cache, private` instead. Root cause: `withResponse()` on an item
  Resource is only invoked when that Resource is returned standalone;
  `JsonResource::collection()` wraps items in an `AnonymousResourceCollection`,
  and `ResourceResponse::toResponse()` calls `withResponse()` on the
  *collection* object, not each item, so the override was silently dead code
  and Symfony's Response computed its own conservative default. Fixed by
  setting the header explicitly on the `JsonResponse` returned from
  `->response($request)` in each controller, and removed the now-misleading
  `withResponse()` overrides from both Resource classes.
- The live HTTP authorization proof for this slice used plain `curl` (no
  `Accept: application/json` header) against `GET /api/v1/programs` and got a
  500 instead of the expected 401. Laravel's `ApplicationBuilder` always
  registers `redirectGuestsTo(fn () => route('login'))` before the app's own
  middleware callback runs; this app is JSON-only and has no `login` named
  route, so any guarded route hit by a client that doesn't send that header
  crashed with `RouteNotFoundException`. This affected every pre-existing
  `auth:sanctum` route too (`/api/v1/auth/me`, `/api/v1/auth/logout`) — no
  prior feature test caught it because `getJson()`/`postJson()` set the
  header automatically. Fixed with
  `$middleware->redirectGuestsTo(fn () => null)` in `bootstrap/app.php`, and
  confirmed by temporarily reverting the fix and re-running the new
  regression test, which failed with the identical error, then passed once
  restored.
- The curriculum-catalog live HTTP proof hit a real gap the automated test
  suite could not have caught: `GET /api/v1/subjects` returned a 500 against
  the live dev server (`grc_app` connection) even though every automated
  feature test passed (those run against `grc_test` via `.env.testing`).
  `storage/logs/laravel.log` showed `SQLSTATE[42000] ... SELECT command
  denied to user 'grc_app'@'localhost' for table
  grc_enrollment.subjects`. Root cause: Task 1 granted `CREATE`+DDL+DML on
  the four new tables to `grc_migrator` and `grc_test` (needed to run and
  test the migrations) but never came back to grant `grc_app` — the
  connection Laravel's own runtime queries actually use — its DML-only
  grant, unlike the identity-foundation slice, which granted `grc_app` right
  after its migrations. Health-checked `mysql.db`/`global_priv`/
  `tables_priv` clean, then granted `SELECT, INSERT, UPDATE, DELETE` to
  `grc_app` on all four tables (table-level, per the MariaDB-instability
  memory); server survived, endpoint immediately returned `200`.
- The approval-workflow endpoint test originally chained four different
  authenticated users (Program Chair submits, Dean approves, Executive
  Director approves and publishes, Registrar Head closes) within one test
  method using sequential `withToken()` swaps. The second swap silently
  failed: `ScheduleProposalPolicy::approveAsDean()` received the *first*
  request's Program Chair user, not the Dean the test had just authenticated
  as, producing a 403 that looked like an authorization bug. Direct dumps
  inside the Policy method and the controller confirmed `auth()->user()`
  itself returned the stale user — this is a genuine Laravel/Sanctum testing
  quirk (the guard resolves and caches a user once per guard instance, which
  outlives a single simulated request within one test method) not previously
  triggered because no earlier test in this codebase had chained multiple
  *different* authenticated users within one test method.
  `$this->app['auth']->forgetGuards()` between swaps did not fix it. Fixed
  by restructuring into four single-actor tests (each precreating the
  proposal directly at whatever status the transition under test requires),
  matching the structure every other endpoint test in this suite already
  uses. See ADR 0011's testing note and Decisions and Assumptions.
- Two of that same test file's setup bugs, caught by the run rather than
  assumed correct: a proposal precreated in `dean_approved` status was
  tested against the `executive_return` action, which actually requires
  `executive_approved` — fixed by correcting the precondition status, not
  the action; and a visibility test called its own `makeTerm()` helper
  twice per test, hitting `academic_terms`' unique `(school_year, semester)`
  constraint — fixed by creating the term once and reusing its ID for both
  proposals (direct `ScheduleProposal::create()` calls don't enforce the
  one-active-proposal-per-term rule, so this was always safe to do).

## Files Changed in the Current Session

- Root: `.gitignore`, `AGENTS.md`, `PRD.md`, restored `PRD(1).md`,
  `PROGRESS.md`, `README.md`, and local `.git/` metadata.
- Backend: Laravel API-only scaffold, configuration, request-ID middleware,
  health controller/resource, safe error support, tests, Composer lockfile,
  Larastan configuration, safe environment example, and README.
- Frontend: React/Vite/Tailwind scaffold, registrar-ledger page, shadcn source
  components, API/query/schema layers, tests, local fonts, Prettier/ESLint/
  Oxlint/TypeScript configuration, lockfile, safe environment example, and
  README.
- Prediction service: FastAPI shell, schemas, safe errors/middleware, tests,
  exact-version manifests, safe environment example, model placeholder, and
  README.
- Documentation: six ADRs, version-compatibility matrix, public OpenAPI
  document, and shared error contract.
- Current demo-portal session: approved specification and ten-task TDD plan
  under `docs/superpowers/`; nine-account credential guide under
  `docs/testing/`; React Router/auth/session/catalog layers; institutional
  landing and login; responsive all-role portal shell, overview, and module
  preview/denial states; focused and full regression coverage; continuously
  updated `PROGRESS.md`.
- Supplied artifact preserved unchanged: `Casuncad, Westlie.pdf`.
- Authorization foundation and reference-data session (branch
  `feat/authz-foundation-reference-data`): `Organization` status enums,
  `UserRole::isLearnerScoped()`, `Program`/`AcademicTerm` models and query
  scopes, `EnsureUserHasRole` middleware, `ProgramPolicy`/`AcademicTermPolicy`,
  two new endpoints and Resources, two new seeders, a `bootstrap/app.php`
  fix for a pre-existing 500-instead-of-401 defect, ADR 0008, OpenAPI/data-
  dictionary/testing doc updates, and 40 new backend tests.
- Curriculum catalog session (branch `feat/curriculum-catalog`): `Curriculum`
  domain enums, `PrerequisiteCycleDetector`, `Subject`/`Curriculum`/
  `CurriculumSubject`/`SubjectPrerequisite` models (first FKs in this
  codebase), `SubjectPolicy`/`CurriculumPolicy`, four new endpoints and
  Resources, `StoreCurriculumRequest`/`UpdateCurriculumRequest`,
  `SynchronizeCurriculumSubjects` action, ADR 0009, OpenAPI/data-dictionary
  updates, and 52 new backend tests.
- Schema-foundation session (branch
  `feat/schedule-and-enrollment-schema-foundation`): adopted a 43-file
  untracked batch (13 migrations, 13 models, 10 domain enums, `SubjectSeeder`/
  `CurriculumSeeder`/`SectionSeeder`/`DemoEnrollmentSeeder`, 2 tests) found
  with zero git history — see Failure and Recovery Record. Added 24 unit
  tests (11 enums, 13 models) and 4 migration-constraint test files
  (`FacultyInputMigrationTest`, `SectionSchedulingMigrationTest`,
  `ScheduleProposalMigrationTest`, `TransfereeAndWithdrawalMigrationTest`)
  covering the 6 tables the found tests didn't reach. One real gap fixed:
  `StudentProfile.year_level` now casts to `integer`, matching every other
  tiny/small-int column in this codebase. 39 table-level `GRANT` statements
  (`grc_migrator`/`grc_test` CREATE+DDL+DML, then `grc_app` DML) across all 13
  tables, zero incidents. New `docs/data-dictionary/enrollment-records.md`;
  updated `curriculum-catalog.md`'s stale "no seeder" note.
- Faculty input session (branch `feat/faculty-input`): own-record
  `scopeVisibleTo()` on `FacultyAvailability`/`FacultySubjectPreference`,
  `FacultyAvailabilityPolicy`/`FacultySubjectPreferencePolicy`, `Store`/
  `UpdateFacultyAvailabilityRequest` and `Store`/
  `UpdateFacultySubjectPreferenceRequest` (composite uniqueness via
  `Rule::unique()->where()->ignore()`), `FacultyAvailabilityResource`/
  `FacultySubjectPreferenceResource`, `FacultyAvailabilityController`/
  `FacultySubjectPreferenceController` (index/store/update/destroy — the
  first `DELETE` endpoints in this API), 8 new routes gated `role:faculty`
  for writes, `docs/data-dictionary/faculty-input.md`, OpenAPI updates
  (1 new tag, 8 new paths, 10 new schemas), and 30 new backend tests.
- Section planning session (branch `feat/section-planning`):
  `App\Domain\Scheduling\ScheduleDayParser` (parses `schedule_days`
  shorthand into ISO-8601 day integers) and `SectionConflictDetector` (pure,
  persistence-free professor double-booking check — ADR 0010),
  `SectionStatus::isVisibleToLearners()`, `Section::scopeVisibleTo()`,
  `SectionPolicy`, `Store`/`UpdateSectionRequest`, `SectionResource`,
  `SectionController` (index/store/update), 3 new routes gated
  `role:program_chair` for writes, `docs/data-dictionary/section-planning.md`,
  OpenAPI updates (1 new tag, 2 new paths, 4 new schemas), and 34 new backend
  tests.
- Approval workflow session (branch `feat/schedule-approval-workflow`):
  `App\Actions\Scheduling\TransitionScheduleProposal` (applies one of six
  transitions, records who/when, bulk-publishes the term's planned sections
  on `publish` — ADR 0011), `ScheduleProposal::scopeVisibleTo()`,
  `ScheduleProposalPolicy` (four abilities instead of the usual pair —
  `approveAsDean`, `approveAsExecutive`, `publish`, `close`), `Store`/
  `UpdateScheduleProposalRequest`, `ScheduleProposalResource`,
  `ScheduleProposalController` — the first controller whose write route
  carries no `role:` middleware at all. 3 new routes. Docs: ADR 0011,
  `docs/data-dictionary/approval-workflow.md`, OpenAPI updates (1 new tag,
  3 new paths, 4 new schemas), and 23 new backend tests. This completes
  every unblocked PRD §5.1 sub-project — only demand forecast (blocked on
  Process 4.0) and cross-cutting audit logging remain.

## Session Handoff Log

### 2026-07-26 16:19 +08:00

**Goal:** Establish mandatory continuity records and begin the Phase 0 audit.  
**Completed:** Repository/Git inspection, complete PRD review, duplicate hash verification, initial runtime audit, and continuity-file creation.  
**Not completed:** MySQL binary/service check, stable-version compatibility research, service scaffolding, and quality checks.  
**Tests run:** No application tests exist yet. Read-only repository and runtime checks only.  
**Known issues:** Git is not initialized; `mysql` is not on `PATH`; all PRD §17 institutional decisions remain open.  
**Next exact step:** Check `C:\xampp\mysql\bin\mysql.exe --version`, then document compatible stack versions before scaffolding the first service.

### 2026-07-26 17:33 +08:00

**Goal:** Audit the empty repository and implement the earliest safe PRD slice.  
**Completed:** Canonical repository records, version/architecture decisions,
three runnable Phase 0A shells, public/private health and error contracts,
security review corrections, automated quality gates, dependency audits, and
integrated HTTP smoke verification.  
**Not completed:** MySQL-backed schema, deterministic role seeders, CI,
authentication/RBAC, business workflows, or interactive browser visual QA.  
**Tests run:** Backend 11 tests/61 assertions; frontend 3 files/9 tests; ML 6
tests; all applicable format, lint, static-analysis, build, integrity,
dependency-audit, OpenAPI, and live HTTP checks listed above passed.  
**Known issues:** MySQL 8.4 LTS and a current PHP runtime are unavailable;
institutional PRD §17 values remain open; no browser session was connected.  
**Next exact step:** Provision a least-privileged MySQL 8.4 LTS development
database, then implement and verify reversible PRD §10.1 base migrations and the
nine-role deterministic seeder.

### 2026-07-26 18:41 +08:00

**Goal:** Design the requested landing page, login, all-role demo credentials,
and role-aware portal without misrepresenting frontend fixtures as real
authentication.
**Completed:** Current code/PRD review, approach comparison, user-approved
architecture, screen content, all-nine-role credential matrix, portal
navigation, demo-session boundaries, failure behavior, accessibility, and test
acceptance criteria. The written specification is
`docs/superpowers/specs/2026-07-26-landing-login-demo-portal-design.md`.
**Not completed:** Implementation plan, frontend implementation, real Laravel
authentication, MySQL users/seeders, or browser visual verification.
**Tests run:** No application code changed in this design stage, so application
tests were not rerun. The design self-check found zero placeholder flags,
exactly nine unique credential emails, and the required shared password.
**Known issues:** MySQL 8.4 and real Sanctum authentication remain blocked; the
design document is intentionally uncommitted because `AGENTS.md` prohibits
committing without explicit user authorization.
**Next exact step:** User reviews the written design, then a TDD implementation
plan is created.

### 2026-07-26 18:57 +08:00

**Goal:** Convert the approved landing/login/demo-portal design into an
executable red-green-refactor plan.
**Completed:** Verified planned dependency compatibility and current shadcn
configuration; advanced the approved design status; created and self-reviewed
the ten-task implementation plan at
`docs/superpowers/plans/2026-07-26-landing-login-demo-portal.md`. The plan
includes exact source/test/documentation files, all-nine-role credentials,
safe-route and storage boundaries, UI requirements, static scans, browser QA,
and the full frontend gate.
**Not completed:** Frontend implementation, dependency installation, demo
credential fixture/document creation, real Laravel authentication, MySQL
users/seeders, or browser visual verification.
**Tests run:** No application code or dependency changed in planning, so
application tests were not rerun. Plan inspection confirmed 10 task headings
and 1,050 lines; placeholder-scan matches were only the plan's explicit
prohibition and its future scan command.
**Known issues:** MySQL 8.4 and real Sanctum authentication remain blocked; no
browser session is currently known to be available; implementation remains
uncommitted because `AGENTS.md` prohibits commits without explicit user
authorization.
**Next exact step:** Select the execution workflow, then begin Task 1 with a
failing auth-mode test and exact dependency installation.

### 2026-07-26 22:42 +08:00

**Goal:** Execute the approved landing/login/demo-portal plan and provide
testable credentials for every user role.
**Completed:** All ten tasks through TDD; production-safe demo-mode selection;
nine synchronized synthetic accounts and `docs/testing/DEMO_CREDENTIALS.md`;
strict session persistence; safe return paths and route guards; institutional
landing, login, responsive all-role portal, role catalog, overview cards,
module previews, scoped denial states, operator documentation, and reviewed
static safety boundaries.
**Not completed:** Real Laravel/Sanctum authentication, MySQL users/role
seeders, backend authorization policies, business workflow APIs, CI, or
interactive visual/browser QA. No commit, push, merge, or pull request was
created.
**Tests run:** Final frontend gate passed Prettier, ESLint, Oxlint, strict
TypeScript, 16 Vitest files/140 tests, Vite production build, and audit with 0
vulnerabilities. A fresh completion rerun again passed 16 files/140 tests.
**Known issues:** Browser discovery returned no available browser, so mobile,
wide-screen, keyboard, zoom, and reduced-motion visual QA remain unverified.
MySQL 8.4, real Sanctum authentication/authorization, institutional policy
values, and CI remain deferred.
**Next exact step:** Choose the feature-branch integration option, then
provision the supported MySQL 8.4 identity baseline before implementing the
real Sanctum vertical slice.

### 2026-07-26 23:01 +08:00

**Goal:** Merge the completed demo-portal feature back to local `main`.
**Completed:** Created local feature commit `292e3c4`, preserved the earlier
root records in a named stash, fast-forwarded `main`, completed the full merged
frontend gate, removed the verified feature worktree, and deleted the merged
feature branch.
**Not completed:** No push or pull request was created. Real MySQL/Sanctum
authentication, server authorization, business workflow APIs, CI, and
interactive browser visual QA remain deferred.
**Tests run:** On merged `main`, `npm ci --ignore-scripts` completed with 0
vulnerabilities; Prettier, ESLint, Oxlint, strict TypeScript, 16 Vitest
files/140 tests, Vite production build, and the moderate-level dependency audit
all passed.
**Known issues:** The first clean install was blocked by two verified workspace
Vite processes holding the native Rolldown binary; both processes were stopped,
ports 5173/5174 confirmed closed, and the retry passed. Browser discovery still
returns no available browser.
**Next exact step:** Re-run browser QA when available, then provision the
supported MySQL 8.4 identity baseline before the real Sanctum vertical slice.

### 2026-07-26 23:15 +08:00

**Goal:** Restore usable local demo login access and verify the UI-only portals
before continuing the PRD.
**Completed:** Traced the disabled form to a missing Vite demo-mode input on a
fresh checkout; added a failing regression, made development default to demo
with an explicit local disable override, preserved production disablement,
updated setup documentation, confirmed the active Vite server serves the fix,
and reran the complete frontend gate.
**Not completed:** Live Playwright interaction/visual QA remains unavailable
because the MCP browser runtime has no connected browser. Real Sanctum auth,
MySQL users/roles, API authorization, CI, and business workflows remain
deferred.
**Tests run:** Focused login/router/portal coverage passed 5 files/79 tests.
The complete gate passed Prettier, ESLint, Oxlint, strict TypeScript, 16 Vitest
files/144 tests, Vite production build, and audit with 0 vulnerabilities.
**Known issues:** The workstation still provides MariaDB 10.4.32 and PHP
8.2.12, not the PRD's supported MySQL 8.4/current PHP production baseline.
**Next exact step:** Refresh `http://127.0.0.1:5173/login` and test the
documented synthetic roles; repeat MCP Playwright QA when a browser connects,
then provision MySQL 8.4 before implementing real Sanctum authentication.

### 2026-07-26 23:24 +08:00

**Goal:** Define the next PRD-aligned database foundation without disrupting
the existing XAMPP MariaDB environment.
**Completed:** Audited the local database/backend baseline; compared portable
MySQL, Windows service, and MariaDB approaches; received approval for an
isolated official MySQL 8.4 LTS instance on `127.0.0.1:3307`; and created the
review-ready design at
`docs/superpowers/specs/2026-07-26-mysql84-identity-foundation-design.md`. The
design specifies checksum verification, loopback-only operation,
least-privileged development/test principals, three reversible identity
foundation tables, a nine-value role enum, and safe deterministic seed data
whose password must come from an ignored environment variable.
**Not completed:** The MySQL archive has not been downloaded or installed;
databases, principals, migrations, enum, seeders, tests, and lifecycle scripts
have not been implemented. Sanctum and real portal authentication remain a
later slice.
**Tests run:** No runtime or application code changed during design, so tests
were not rerun. Written-design checks found no placeholder markers, exactly
nine unique synthetic role emails, and no diff whitespace errors. Self-review
removed premature `curricula` and `student_profiles` tables and their
unconfirmed policy values; the slice now uses only the unambiguous `users`,
`programs`, and `academic_terms` foundation.
**Known issues:** The active local database remains MariaDB 10.4.32 on port
`3306`. Live Playwright visual QA remains unavailable because no browser is
connected to the MCP runtime.
**Next exact step:** Self-review the written database design, obtain user
approval, then create the TDD implementation plan before provisioning MySQL.

### 2026-07-26 23:24 +08:00 — Planning started

**Goal:** Convert the approved MySQL 8.4 identity-foundation design into an
exact, test-driven implementation plan.
**Completed:** User approved the written design; reread `AGENTS.md`, `PRD.md`,
and the complete progress record; mapped the backend, test, configuration, and
documentation surfaces; confirmed that `scripts/`, models, migrations, and
seeders do not yet exist; and aligned the planned PHP role values with the
existing frontend credential contract.
**Not completed:** The implementation plan is still being written. No MySQL
download, instance configuration, database mutation, migration, seeder, or
application implementation has started.
**Tests run:** No runtime/application code changed, so application tests were
not rerun.
**Known issues:** The existing XAMPP database remains MariaDB 10.4.32 on port
`3306`; MySQL 8.4 must remain isolated on `3307`. The working tree also retains
the previously verified login correction and documentation changes.
**Next exact step:** Finish and self-review the plan against every approved
design requirement, then offer the supported execution workflows.

### 2026-07-26 23:47 +08:00

**Goal:** Finish a directly executable TDD plan for the approved MySQL 8.4
identity foundation.
**Completed:** Created
`docs/superpowers/plans/2026-07-26-mysql84-identity-foundation.md` with nine
tasks and 65 checkbox checkpoints covering canonical identity types,
dependency-free PowerShell safety tests, bootstrap/lifecycle scripts, Laravel
connections, isolated provisioning, reversible migrations, the guarded
nine-role seeder, engine/grant verification, data dictionary, runbook, and
final quality gates. Self-review aligned four role IDs with the existing portal
contract, removed unresolved implementation labels, added Windows PowerShell
5.1-compatible secret generation, added DPAPI-protected administrator
credential persistence, and supplied direct model/constraint/privilege tests.
The approved design was synchronized with the canonical roles and encrypted
administrator-credential boundary.
**Not completed:** No implementation task, worktree, download, installation,
database/principal creation, migration, seeding, or runtime mutation has
started. No commit or push was created.
**Tests run:** Planning checks confirmed nine tasks, 65 executable steps, 1,752
plan lines, exactly nine unique seed emails, coverage of every required
runtime/security/rollback/documentation term, zero unresolved-marker matches,
and zero `git diff --check` errors. Application tests were not rerun because
only planning and progress documents changed.
**Known issues:** MySQL 8.4 is still absent and MariaDB 10.4.32 remains the
local database. The current `main` checkout is intentionally dirty with the
previously verified login correction plus this uncommitted design/plan, so
execution must begin through the repository's worktree workflow.
**Next exact step:** Choose subagent-driven or inline execution, then use the
required execution/worktree/TDD skills to begin Task 1 without altering the
dirty root checkout.

### 2026-07-26 23:59 +08:00 — Execution started

**Goal:** Execute the approved nine-task MySQL identity-foundation plan through
fresh task implementers and independent task reviews.
**Completed:** User selected and explicitly authorized subagent-driven
execution. Loaded the subagent, worktree, TDD, and test-quality workflows;
confirmed the root checkout is normal `main`, `.worktrees/` exists and is
ignored through `.git/info/exclude`, and no conflicting feature branch or
linked worktree exists.
**Not completed:** The isolated worktree, SDD ledger, baseline dependency
installation/tests, Task 1 implementation, reviews, and every MySQL mutation
remain pending.
**Tests run:** Read-only Git/worktree preflight only; no application test has
run in the new execution workspace yet.
**Known issues:** Repository instructions prohibit commits without a separate
explicit request, so this SDD run will use task-scoped uncommitted review
packages. Preflight is also checking whether the planned PowerShell
source-contract harness should remain a lint gate while Task 5 supplies the
required real lifecycle behavior verification.
**Next exact step:** Create and baseline the isolated feature worktree, create
the plan-specific SDD ledger, then resolve any load-bearing plan/review-rule
conflict before dispatching Task 1.

### 2026-07-27 00:05 +08:00 — MySQL identity foundation Task 1 started

**Goal:** Add only the database-independent canonical technical identity types
and narrow Eloquent user model for the Phase 0 identity foundation.
**Scope:** No schema exists yet; this task adds no migrations, database access,
Sanctum behavior, authentication flow, or institutional policy values.
**Next exact step:** Create the specified failing enum/model unit tests, then
implement only the canonical role/status types and model casts required by the
approved Task 1 brief.

**Checkpoint:** The specified focused red run failed as expected because
`UserRole`, `UserStatus`, and `User` did not exist. After the minimal
implementation, the same run passed 4 tests/7 assertions. The first
`composer format:check` then failed only on Pint's `new_with_parentheses` rule
in `tests/Unit/Models/UserTest.php`; no production behavior failed or changed.

**Completed:** Added the nine-value `UserRole` enum with stable labels, the
two-value technical `UserStatus` enum, and the narrow `User` model with only
the approved fillable, hidden, password/hash, enum, and immutable-login casts.
No schema, database operation, Sanctum trait, authentication flow, or policy
value was added.
**Tests run:** After correcting the test-only Pint style finding,
`php artisan test tests/Unit/Domain/Identity/UserRoleTest.php tests/Unit/Domain/Identity/UserStatusTest.php tests/Unit/Models/UserTest.php`
passed 4 tests/7 assertions; `composer format:check` passed; `composer analyse`
passed with no errors across 17 files; and full `composer test` passed 15
tests/68 assertions.
**Self-review:** `git diff --check` passed with no output. The implementation
matches the approved role IDs, labels, status values, and casts verbatim; the
model deliberately excludes `HasApiTokens` because Sanctum belongs to a later
slice. No commit or push was created.
**Next exact step:** Perform the task-scoped independent review, then continue
with the next approved identity-foundation task.


### 2026-07-27 02:07–02:20 +08:00 — MySQL 8.4 lifecycle scripts (Tasks 2–3, collapsed)

**Summary:** The PowerShell safety library and MySQL 8.4 bootstrap/lifecycle
scripts (old Task 2 and Task 3: `scripts/mysql84/MySql84.Common.ps1`,
`bootstrap.ps1`, `start.ps1`, `status.ps1`, `stop.ps1`, and their test/scan
harnesses) were implemented and passed four rounds of independent
security/spec review (canonical path handling, process argument/quoting
integrity, initialization-password/TOCTOU/cleanup safety, exact `my.ini`
option-file validation, and MySQL comment/alias-character path rejection plus
byte-exact UTF-8/LF generation). Every round found and fixed a real defect,
and every fix, RED/GREEN cycle, and non-runtime verification pass ran clean.
No MySQL 8.4 download, extraction, initialization, or server process was ever
executed at any point: `C:\xampp\mysql84` remained absent and port `3307`
never had a listener through every round. The scripts were reviewing
themselves correctly; nothing had verified them against a real MySQL server.
**Superseded 2026-07-27:** the user chose to use the existing XAMPP MariaDB
10.4.32 instance instead of provisioning an isolated MySQL 8.4 install.
`scripts/mysql84/` (8 files, 2,628 lines) was deleted; the approved design and
plan were marked superseded in place; `docs/adr/0007-mariadb-development-database.md`
records the rationale and PRD deviation; `docs/architecture/version-compatibility.md`
was updated. The full round-by-round detail remains in
`.superpowers/sdd/2026-07-26-mysql84-identity-foundation/task-3-report.md` and
the SDD ledger. The replacement plan is
`docs/superpowers/plans/2026-07-27-mariadb-identity-sanctum-auth.md`, which
also folds in the Sanctum authentication vertical slice.
**Carried forward unchanged:** old Task 1's canonical identity types and
`User` model (`backend/app/Domain/Identity/UserRole.php`,
`UserStatus.php`, `backend/app/Models/User.php`) are database-agnostic and
remain the foundation for the MariaDB-based migrations.
**Next exact step:** Begin the replacement plan's Task 2 — create
`grc_enrollment`/`grc_enrollment_test` and the three scoped principals against
the live MariaDB instance.

### 2026-07-27 18:00–18:20 +08:00 — Task 2: databases and principals, with a real incident

**Goal:** Create `grc_enrollment`/`grc_enrollment_test` and the three scoped
principals against the live MariaDB instance.
**Found first:** `SHOW DATABASES` revealed `grc_enrollment` already existed,
with 18 tables and real-looking data (12 `system_users`, 4
`faculty_schedules`, etc.), all created 2026-07-23 — before this repo's git
history starts. Not created by this project. User confirmed it was disposable
prototype data. Backed up via `mysqldump` to
`C:\xampp\mysql-backups\grc_enrollment_prototype_backup_20260723.sql` before
dropping and recreating the database fresh.
**Incident:** The first schema-wildcard `GRANT SELECT, INSERT, UPDATE, DELETE
ON grc_enrollment.* TO 'grc_app'@'127.0.0.1'` failed with `Got error 176 "Read
page with wrong checksum" from storage engine Aria` — the `mysql.db` system
table (MariaDB's schema-grant table) was corrupted. `CHECK TABLE` confirmed
`mysql.global_priv`/`tables_priv`/`columns_priv`/`procs_priv` were all healthy;
only `mysql.db` was affected. With explicit user approval, ran `REPAIR TABLE
mysql.db`, which fixed the corruption but reset the table from 3 rows to 0,
losing `pma@localhost`'s (phpMyAdmin's control user) grant on its own
`phpmyadmin` database. The next write to that table (`FLUSH PRIVILEGES` after
a `GRANT` attempting to restore `pma`'s access) crashed `mysqld.exe` entirely
(Windows Event Log: exception `0xc0000005` in `VCRUNTIME140.dll`). User
restarted MariaDB via XAMPP Control Panel; a fresh plain schema-wildcard
`GRANT` on `grc_enrollment.*` crashed it again with the **identical** fault
signature (same exception, same module, same byte offset), even though
`CHECK TABLE mysql.db` reported clean immediately beforehand. Two identical
crashes on a table that checks out clean rules out ordinary data corruption as
the proximate cause — this points to a broken/corrupted
`C:\xampp\mysql\bin\VCRUNTIME140.dll`, not the database itself. Not caused by
this session; a separate, unrelated `mysqld.exe` crash on 2026-07-24 (Windows
Event Log) predates any agent involvement and is the likely origin of the
`mysql.db` corruption in the first place.
**Workaround, user-approved:** table-level `GRANT ... ON db.specific_table TO
...` statements (routed through `mysql.tables_priv`, confirmed healthy through
both crashes) do not trigger the crash. Used this exclusively from this point:
`grc_migrator` and `grc_test` each received `CREATE, ALTER, DROP, INDEX,
SELECT, INSERT, UPDATE, DELETE` on all five planned table names (`migrations`,
`users`, `personal_access_tokens`, `programs`, `academic_terms`) in their
respective databases — valid pre-creation because `CREATE` is the one
privilege MySQL/MariaDB allows granting on a not-yet-existing table.
`grc_app`'s `SELECT, INSERT, UPDATE, DELETE`-only grant attempt on the same
tables correctly failed with `ERROR 1146 table doesn't exist` (expected,
documented behavior, not a crash) and is deliberately deferred to the start of
Task 4, once the tables are real. `pma`'s access was fully restored via the
same table-level approach across its 19 real `phpmyadmin.*` tables — server
survived all 20+ table-level GRANT statements without incident.
**State after this task:** MariaDB running (verified via `netstat` + `SELECT
1`). `grc_enrollment`/`grc_enrollment_test` exist with the intended
`utf8mb4`/`utf8mb4_unicode_ci` collation. `grc_app`/`grc_migrator`/`grc_test`
exist; `grc_migrator`/`grc_test` hold their full planned grants, `grc_app`
holds none yet (by design). `pma` fully restored. No other pre-existing
database (`b1g_timer_dev`, `harmonyhub`, `login_system`, `sixt_sense_spa`,
`sixth_sense_spa`, `smartload`, `websystem`, `test`) was touched. The three
generated passwords exist only in the now-exited PowerShell process memory —
never written to any file — and must be reset via `ALTER USER ... IDENTIFIED
BY` when Task 3 writes `backend/.env`/`.env.testing`.
**Known issue carried forward:** the underlying `VCRUNTIME140.dll` problem is
unresolved. Schema-wildcard `GRANT ... ON db.*` must not be attempted again
against this instance without the user first replacing that DLL (fresh XAMPP
extraction or a matching VC++ Redistributable install) and confirming a
schema-wildcard grant survives.
**Next exact step:** Task 3 — Laravel `mariadb` connection config, `.env`/
`.env.testing`, `phpunit.xml`, and `DatabaseConfigurationTest`.

### 2026-07-27 18:25 +08:00 — Task 3: Laravel connection and environment config

**Completed:** Reset the three principals' passwords (never persisted before)
via `ALTER USER` and wrote them directly into `backend/.env` (`DB_CONNECTION=
mariadb`, `grc_app`/`grc_enrollment`) and a new `backend/.env.testing`
(`grc_test`/`grc_enrollment_test`) without ever displaying or logging a
password. Added a `mariadb_migrator` connection to `config/database.php`
(reads `DB_MIGRATOR_USERNAME`/`DB_MIGRATOR_PASSWORD`) so local migrations run
as `grc_migrator` via `php artisan migrate --database=mariadb_migrator`,
keeping the app's default connection scoped to `grc_app`'s DML-only grants —
a one-flag deviation from the original design's "no manual step" wording,
accepted as a reasonable least-privilege trade-off. Updated `.env.example`
(`mysql`→`mariadb`, added migrator template vars), added
`.env.testing.example`, added `.env.testing` to `.gitignore`, and removed
phpunit.xml's stale commented sqlite lines.
**Discovered and worked through:** the default `mariadb` connection (`grc_app`)
cannot even select `grc_enrollment` as its default database yet — MariaDB
requires at least one privilege in a database before `USE` succeeds, and
`grc_app`'s grants are deliberately deferred to Task 4. Verified instead
through the new `mariadb_migrator` connection, which already holds real
table-level grants; `DatabaseConfigurationTest` checks connection config
directly via `DB::connection()` (works because PHPUnit's `APP_ENV=testing`
loads `.env.testing`, where `grc_test` already has full rights on
`grc_enrollment_test`) rather than asserting against the not-yet-usable
dev `grc_app` connection.
**Tests run:** `tests/Feature/Database/DatabaseConfigurationTest.php` — 5
tests/11 assertions, all against the real live MariaDB server (version string,
charset, collation, strict SQL mode, migrator connection config). Full
`composer test`: 20 tests/79 assertions passed. `composer format:check` and
`composer analyse` (Larastan level 8, 17 files) both passed.
**Next exact step:** Task 4 — reversible migrations for `users`, `programs`,
`academic_terms`, and Sanctum's `personal_access_tokens`, run via
`grc_migrator`; then grant `grc_app`'s deferred DML privileges once the real
tables exist.

### 2026-07-27 18:35 +08:00 — Tasks 4 and 6: migrations, Sanctum install, and a caught PRD violation

**Completed (Task 4):** Installed `laravel/sanctum` v4.3.3 (pulled forward from
Task 6 because Task 4 needs its migration), published and renamed its migration
to `2026_07_26_000004_create_personal_access_tokens_table.php` to fit the
slice's ordering, and added `HasApiTokens` to `App\Models\User`. Wrote
`tests/Feature/Database/IdentityFoundationMigrationTest.php` first and
confirmed RED (7 failed / 1 passed), then implemented the three reversible
migrations for `users`, `programs`, and `academic_terms` exactly as the
approved design specifies — `role`/`status` as application-backed strings
rather than MySQL `ENUM`, no foreign keys in this slice, unique `email`,
unique `code`, and unique `(school_year, semester)`.
**Migrations applied:** `php artisan migrate --database=mariadb_migrator`
created all four tables in `grc_enrollment`. Verified every table is `InnoDB`
with `utf8mb4_unicode_ci`.
**Deferred grants completed:** With the tables now real, `grc_app` received its
`SELECT, INSERT, UPDATE, DELETE` grants on `users`,
`personal_access_tokens`, `programs`, and `academic_terms` (deliberately not
`migrations`), using table-level statements per the Task 2 workaround. Server
survived every batch. Least-privilege verified live: `grc_app` can read
`users` but a `CREATE TABLE` attempt through its connection is correctly
denied.
**PRD violation caught by a test (Task 6):** the pre-existing `ApiSurfaceTest`
route-inventory assertion failed the moment Sanctum was installed, because
Sanctum auto-registers `GET|HEAD sanctum/csrf-cookie` — precisely what PRD §9.1
forbids ("Do not use session cookies, CSRF-cookie endpoints, or
`withCredentials`"). Published `config/sanctum.php` and set `routes => false`,
`stateful => []`, `guard => []` (stock `['web']` would consult the session
guard before falling back to bearer tokens), and `middleware => []`. Route
inventory is back to exactly `GET|HEAD api/v1/health`. Added
`tests/Feature/Auth/SanctumConfigurationTest.php` (7 tests) so this boundary
cannot silently drift back.
**Token expiration flagged, not invented:** PRD §9.1 requires an approved
expiration policy and PRD §17 lists it as an open institutional decision.
`config/sanctum.php` reads `SANCTUM_TOKEN_EXPIRATION` with a **provisional**
480-minute local default, explicitly documented in the config and
`.env.example` as not an approved policy value. Sanctum's own default (`null`
= tokens never expire) was deliberately rejected so an unset policy fails safe.
**Tests run:** full `composer test` — 35 tests/109 assertions passed, including
8 migration tests (column presence, all three unique constraints enforced
against the live server, and a full `migrate:rollback` → `migrate` reversibility
cycle). `composer format:check` passed after importing `QueryException` rather
than using inline FQCNs. `composer analyse` (Larastan level 8) passed with no
errors. `composer audit --locked` found no advisories.
**Next exact step:** Task 5 — the deterministic nine-role seeder, guarded by
`GRC_SEED_PASSWORD` and restricted to local/testing environments.

### 2026-07-27 18:45 +08:00 — Task 5: deterministic nine-role seeder

**Completed:** Wrote `RoleUserSeederTest.php` first (RED: 8 failed), then
implemented `database/seeders/RoleUserSeeder.php` and `DatabaseSeeder.php`.
The seeder upserts exactly the nine approved synthetic identities keyed on
email inside a transaction, reads `GRC_SEED_PASSWORD` from the environment,
hashes through Laravel's `hashed` cast, and refuses to run outside `local`/
`testing`. Seeded the real dev database and verified all nine rows: one per
role, all `active`, all passwords stored as 60-character bcrypt hashes, no
plain text.
**Test correction during TDD:** the environment-guard test initially failed
for the wrong reason — `db:seed` in a faked production environment hits
Laravel's own interactive confirmation prompt before the seeder body runs, so
the assertion saw a Mockery error rather than the guard. Rewrote it to invoke
`app(RoleUserSeeder::class)->run()` directly, which is also the more valuable
assertion: it proves the seeder is safe when chained programmatically from
another seeder, where the command-level prompt would not protect it. Added two
further tests asserting that a refused run seeds *nothing* (not a partial
write) in both the wrong-environment and missing-password cases.
**Secret handling:** the seed password was generated locally with
`RandomNumberGenerator`, written only into the gitignored `backend/.env`, and
never printed, logged, echoed, or recorded in this file or
`docs/testing/SEEDED_IDENTITIES.md`.
**Documentation:** added `docs/testing/SEEDED_IDENTITIES.md` listing the nine
role/name/email triples, the safety guarantees each test enforces, and an
explicit comparison table separating these database fixtures from the UI-only
`DEMO_CREDENTIALS.md` accounts — the two sets must never share a password.
**Quality-gate improvement (unplanned, recorded per AGENTS.md):** `phpstan.neon`
scanned only `app`, `bootstrap`, and `routes`, so the new seeder and all four
migrations were invisible to static analysis. Added `database` to the analysed
paths; coverage went from 17 to 23 files and still passes Larastan level 8
with no errors.
**Tests run:** `RoleUserSeederTest` — 10 tests/42 assertions. Full
`composer test` — 45 tests/151 assertions passed. `composer format:check`
passed. `composer analyse` passed across 23 files.
**Next exact step:** Task 7 — `POST /api/v1/auth/login`, `POST
/api/v1/auth/logout`, and `GET /api/v1/auth/me` with a Form Request, an
Action, `AuthResource`, generic credential failures, and login rate limiting.

### 2026-07-27 18:50 +08:00 — Task 7: Sanctum auth endpoints

**Completed:** Wrote `LoginEndpointTest` (14 tests) and `SessionEndpointTest`
(9 tests) first, then implemented the three PRD §8.4 routes:
`POST /api/v1/auth/login` (public, throttled), `POST /api/v1/auth/logout` and
`GET /api/v1/auth/me` (both `auth:sanctum`). Layering follows the repository's
existing conventions: `LoginRequest` Form Request (validates, lowercases and
trims the email before validation, and owns the throttle key),
`App\Actions\Auth\AuthenticateUser` action (verifies, rejects non-active
accounts, issues the token and stamps `last_login_at` in one transaction),
`AuthResource` as the single path a token may leave through per PRD §9.1, and
`UserResource` for `/me` with an exact key set that never includes the hash.
**Security properties implemented and tested:** unknown email, wrong password,
and disabled account all raise one `InvalidCredentialsException` rendered as an
identical generic 401, so the endpoint cannot enumerate accounts; a dummy
`Hash::check` runs on the missing-user path so response timing does not leak
existence either. Login throttles at 5 attempts per **email+IP** (verified live
that exhausting one account does not lock out another). Logout revokes only the
presented token, leaving other devices signed in. A new `EnsureUserIsActive`
middleware rejects and deletes a still-valid token whose account was disabled
after issue — without it, disabling a user would only block new logins.
`Cache-Control: no-store, private` on every token-bearing response.
**Contract correction during TDD:** the first test run failed because the tests
expected an unwrapped body. The existing API contract (`HealthResource`,
`docs/api/openapi.yaml`, and `HealthEndpointTest`'s `assertExactJson`) uses a
`data` wrapper for success and `error` for failures. The tests were wrong, not
the implementation; they now assert `data.*` paths, keeping the new endpoints
consistent with the documented envelope.
**Test-artifact diagnosis:** `a revoked token can no longer authenticate`
initially returned 200. The token row *was* deleted (the sibling test asserts
`personal_access_tokens` count drops), so this was Laravel's auth guard caching
the already-resolved user across calls within one test method rather than a
real defect. The test now calls `forgetGuards()` to reproduce a fresh request,
and the **live HTTP smoke test independently confirmed the real behavior is
401**.
**Static analysis fix (root cause, not suppression):** Larastan reported 8
errors because `App\Models\User` had no property annotations, so `role` and
`status` were inferred as `string` rather than their enum types — which also
made a status comparison look always-true and its following code unreachable.
Added `@property` docblocks for all columns plus `list<string>`/`array<string,
string>` annotations, and replaced one nullsafe call on a non-nullable Sanctum
return with an explicit `instanceof` check. No `@phpstan-ignore`, baseline
entry, cast, or widened type was used.
**Tests run:** auth suites 23 tests/87 assertions. Full `composer test` — 70
tests/250 assertions passed. `composer format:check` passed. `composer analyse`
passed with no errors across 32 files.
**Live HTTP smoke verification** (temporary server on 127.0.0.1:8100, since
stopped and the port confirmed closed): login returned 200 with the exact
envelope, `Cache-Control: no-store, private`, `token_type=Bearer`,
`expires_at=2026-07-27T18:46:36Z` (ISO-8601 UTC), correct `role_label`, and no
bcrypt hash anywhere in the body; `/me` with the bearer returned the identity;
logout returned 204; **reusing the revoked token returned 401**; wrong-password
and unknown-email returned byte-identical messages; the 6th bad attempt
returned 429 with `Retry-After: 58` while a different account still logged in
successfully.
**Next exact step:** Task 8 — frontend `auth-token` module, `postJson` plus
bearer/401 handling in `api-client`, Zod-validated `auth-service`, and an
`api` auth gateway replacing the demo fixtures as the default.

### 2026-07-27 19:05 +08:00 — Task 8: frontend real authentication

**Completed:** Frontend dependencies were never installed in this worktree
(`node_modules` absent); ran `npm ci --ignore-scripts` (343 packages, 0
vulnerabilities) before any typecheck/test could run.
Added `auth-token.ts` as the sole owner of the bearer token in `localStorage`,
deliberately separate from the demo session's `sessionStorage`. Extended
`api-client.ts` with `postJson`/`getAuthenticatedJson`/`postAuthenticatedJson`,
a registered token provider so the client never imports the token store
directly, and a 401 handler that clears the token — scoped to authenticated
calls only, so login's own 401 (bad credentials) does not trigger it. Added
`auth-schema.ts` (strict Zod, mirrors `AuthResource`/`UserResource` exactly)
and `auth-service.ts`. Added `api-auth-gateway.ts` implementing the existing
`DemoAuthGateway` interface, extended additively with optional
`persistsSessions`/`restore`/`signOut` so the 144 pre-existing demo/disabled
tests needed no changes to their gateway contract. `demo-auth-mode.ts` gained
an `"api"` mode as the default everywhere (`demo` and `disabled` now both
require explicit opt-in); `main.tsx` wires the token store, provider/handler
registration, and the three gateways by mode.
**Real defect caught by a new test, not by inspection:** the login page
computed `demoDisabled = authMode !== "demo"`, so under the new `api` default
the sign-in form would have been disabled and shown "Interface
demonstration—not real authentication" / "Laravel does not accept them" to
real users. Rewrote it with mode-specific copy (`api`/`demo`/`disabled`, each
with its own eyebrow, intro, credential-guide pointer, and generic- vs.
demo-specific invalid-credentials message) and changed the disable condition
to `authMode === "disabled"` only. Also fixed the route guard's hardcoded
"Restoring demo session…" text, now "Restoring your session…" since it covers
both modes.
**Real bug caught by a new test, not by inspection (second one):** the new
API-mode restore path called `gateway.restore?.().then(...)` — when a gateway
declares `persistsSessions: true` but implements no `restore` (a valid shape
per the now-optional interface), `gateway.restore?.()` evaluates to
`undefined` and `.then` on `undefined` threw, leaving every route stuck on
"Restoring your session…" forever. A new login-page test using exactly that
minimal gateway shape caught it; fixed with
`gateway.restore?.() ?? Promise.resolve(null)`.
**Contract correction:** `auth-schema.ts` and the new service/gateway tests
initially assumed an unwrapped response body; the existing contract wraps
success in `{"data": ...}` (matching `HealthResource` and
`docs/api/openapi.yaml`), so schemas and assertions were corrected to that
shape, not the backend.
**Boundary scans:** exactly one raw `fetch(` (`api-client.ts`; the other match
was `refetch()` from TanStack Query), exactly one `localStorage` user
(`auth-token.ts`), exactly one `sessionStorage` user
(`demo-session-store.ts`; `auth-token.ts`'s only match was a doc-comment
naming that file).
**Tests run:** added 4 test files — `auth-token.test.ts` (5),
`api-client.auth.test.ts` (6), `auth-service.test.ts` (5),
`api-auth-gateway.test.ts` (7) — plus 2 new/updated login-page API-mode tests
and a rewritten `demo-auth-mode.test.ts`. Full suite: 20 files, **170 tests**,
all passing. `format:check`, `lint` (ESLint, 0 warnings), `lint:fast` (Oxlint),
and `typecheck` all passed. `npm run build` succeeded (508.80 kB / 158.22 kB
gzip — a chunk-size warning only, not an error). `npm audit
--audit-level=moderate` found 0 vulnerabilities.
**Documentation:** rewrote `frontend/README.md` (removed the now-false
"Deferred Production Authentication" section, added the Auth Modes table and
current three-endpoint contract) and `.env.example` (`VITE_AUTH_MODE` now
commented out/opt-in instead of defaulting to `demo`).
**Next exact step:** Task 9 — data dictionary, runbook, OpenAPI update,
`DEMO_CREDENTIALS.md` clarification, and the final combined backend+frontend
verification gate including a live browser QA attempt.

### 2026-07-27 19:22 +08:00 — Task 9: documentation and full verification gate

**Documentation completed:**
- `docs/api/openapi.yaml` — added the three auth routes, a `bearerAuth`
  security scheme, `LoginRequest`/`AuthResource`/`UserResource` schemas, and
  `NoStorePrivate`/`Unauthenticated` shared components. Fixed one OpenAPI 3.1
  issue caught by Redocly: `nullable: true` (an OpenAPI 3.0-ism) on
  `expires_at` isn't valid JSON Schema for 3.1 — corrected to
  `type: ["string", "null"]`. Redocly lint and a PyYAML structural parse both
  pass (4 paths, 9 schemas).
- `docs/data-dictionary/identity-foundation.md` — all four tables, exact
  types/constraints, the token-expiration provisional-value note, and the
  seeded-data summary.
- `docs/runbooks/mariadb-local.md` — full setup/migrate/seed/reset procedure,
  leading with the known instability warning and the table-level-grant
  workaround so a future session doesn't rediscover it the hard way.
- `docs/testing/DEMO_CREDENTIALS.md` — added an explicit comparison table
  against `SEEDED_IDENTITIES.md` and corrected the local-setup steps to
  require `VITE_AUTH_MODE=demo` (no longer the default).
- Root `README.md` — corrected a now-actively-wrong line ("Do not run
  migrations against the bundled XAMPP MariaDB instance") and updated Current
  Status/Environment Baseline to reflect ADR 0007 and the real auth slice.

**Live browser QA — the first successful browser session in this project's
history.** Every prior session recorded "No browser is available." This
session's Playwright MCP connection worked. Ran real Laravel (`php artisan
serve`, port 8100) and Vite (port 5173, matching `CORS_ALLOWED_ORIGINS`)
servers against the live MariaDB database and drove the actual browser:
- Fresh `/login` in the default (`api`) mode: real institutional copy, no
  demo disclaimer, form enabled, pointing to `SEEDED_IDENTITIES.md`.
- Signed in with a real seeded identity (`dean.seed@grc.test`, then
  `registrar-staff.seed@grc.test`) — genuine `POST /api/v1/auth/login`
  against MariaDB, zero console errors, landed on `/portal` with the correct
  role, display name, and role-filtered module set for each.
- **Full page reload while authenticated correctly restored the session** via
  the stored bearer token and a live `GET /api/v1/auth/me` call — no
  re-login required, zero console errors.
- Mobile viewport (390×844): screenshot confirmed clean layout, no overflow,
  correct copy.
- Sign-out correctly cleared the session and revoked the token.
**Found and fixed one real content bug via this live pass:** the portal
shell's sidebar hardcoded a "Demo portal" badge (and matching mobile-sheet
description and storage-unavailable warning text) regardless of auth mode,
so a genuinely authenticated user would have been told they were in a demo.
Made all three mode-aware (`isDemo` from `authMode`): `api`/`disabled` now
show "Preview portal" and non-demo wording; demo mode is byte-identical to
before. Left the separate "Workflow and authorization APIs are not connected
in this preview" module alert untouched — that one remains accurate in every
mode, since business workflow endpoints genuinely aren't implemented yet.
**Found and fixed a second real gap via a test that initially claimed the
wrong thing:** writing a test for "API mode warns when storage is
unavailable" revealed that `auth-context.tsx` never surfaced whether the
API gateway's token write actually succeeded — `storageAvailable` was
hardcoded effectively-true for API mode, so a user in a browser with
`localStorage` disabled would get no warning that their session cannot
survive a refresh. Added an optional `persistenceAvailable()` method to the
`DemoAuthGateway` interface, implemented in `api-auth-gateway.ts` by tracking
the last `tokenStore.write()` result, and wired it into `auth-context.tsx`'s
sign-in path. Four new tests cover both the fixed portal-shell copy and the
gateway method directly.
**Known non-blocking finding, not fixed:** in a real `BrowserRouter` (not
jsdom), `PortalShell`'s pre-existing sign-out handler (`await navigate("/",
...); signOut()`) sometimes lands on `/login?returnTo=/portal` instead of
`/` for the API-mode async sign-out path — `navigate()` from `useNavigate()`
isn't a reliably awaitable commit signal outside a data router, so the two
calls can interleave differently than in jsdom. The user still ends up on a
fully functional page (a working login form, arguably reasonable UX since
re-authenticating returns them to where they were) with no data or security
issue and the token is genuinely revoked either way. Not part of this
slice's scope (auth backend/gateway, not portal-shell navigation
architecture); flagged here rather than risking an unreviewed architectural
change under time pressure.
**Test-environment hygiene:** a stray `.env.local` created for the live
browser test (pointing `VITE_API_BASE_URL` at the temporary port 8100)
leaked into two Vitest runs, breaking `health-service.test.ts`'s hardcoded
URL assertion. Removed before the final gate; confirmed 174/174 clean
afterward. Also found and stopped an unrelated stale `vite` process serving
the **main checkout** (not this worktree) that had been idly holding port
5173 from an earlier, unrelated session — consistent with this repo's own
documented history of needing exactly this kind of cleanup.
**Final verification, everything from a clean state:**
- Backend: `composer test` 70/70 (250 assertions), `format:check`,
  `analyse` (32 files, Larastan level 8, 0 errors), `audit --locked` (0
  advisories), `route:list` shows exactly the 4 intended routes.
- Frontend: `npm test` 174/174, `format:check`, `lint` (0 warnings),
  `lint:fast`, `typecheck`, `build` (succeeds; one chunk-size advisory
  notice, not an error), `audit --audit-level=moderate` (0 vulnerabilities).
- OpenAPI: Redocly lint clean, PyYAML parse clean.

**All nine tasks of
`docs/superpowers/plans/2026-07-27-mariadb-identity-sanctum-auth.md` are now
complete.** The identity foundation runs on the existing XAMPP MariaDB
instance (ADR 0007), and the portal authenticates for real against it via
Sanctum bearer tokens — the original goal driving this entire session's
pivot away from the abandoned isolated MySQL 8.4 plan.
**Not done, out of scope for this slice:** CI, authorization Policies beyond
role-filtered navigation, business workflow endpoints, password reset, and
every PRD §17 institutional policy confirmation (including the real token
expiration value). No commit, push, or merge back to `main` was made —
`AGENTS.md` requires explicit authorization for that, which has not been
given in this session.

### 2026-07-27 20:27 +08:00

**Goal:** Turn "what's next on the PRD checklist" into the first concrete
sub-project of PRD §5.1 (Pre-enrollment schedules) and implement it.
**Decomposition:** Process 1.0 spans 10 FRs, 8 tables, and 4 independent
subsystems plus a forecast requirement blocked on Process 4.0 — too large for
one slice. Brainstormed and chose the authorization foundation and reference
data as sub-project 1: it unblocks every later sub-project (PRD §9.4 requires
a Policy or explicit authorization decision on every resource endpoint, and
none existed yet) and both `programs`/`academic_terms` were empty tables with
no models.
**Completed (branch `feat/authz-foundation-reference-data` off `main`, worked
in place per this session's configuration, not a worktree):**
- `App\Domain\Organization\ProgramStatus`/`AcademicTermStatus` — provisional
  status enums (PRD §17 unconfirmed vocabulary) with an
  `isVisibleToLearners()` predicate.
- `UserRole::isLearnerScoped()` — single source of truth for which three
  roles (student, faculty, accounting staff) receive filtered results versus
  the six planning roles.
- `Program`/`AcademicTerm` Eloquent models with full `@property` docblocks
  and a `scopeVisibleTo()` query scope on each.
- Authorization stack: `AuthorizesRequests` restored on the base
  `Controller` (Laravel 12 had dropped it), `EnsureUserHasRole` middleware
  registered as the `role` alias (built now, no production route consumes it
  yet — see ADR 0008), `ProgramPolicy`/`AcademicTermPolicy`.
- `GET /api/v1/programs` and `GET /api/v1/academic-terms` — readable by every
  role, row set filtered by `visibleTo()`, `{"data": [...]}` envelope,
  `Cache-Control: no-store, private`.
- `ProgramSeeder`/`AcademicTermSeeder` — synthetic catalog (3 programs, 3
  terms), each including one non-learner-visible row.
- Docs: ADR 0008, `docs/api/openapi.yaml` (2 new paths + schemas, Redocly
  clean), `docs/data-dictionary/identity-foundation.md`,
  `docs/testing/SEEDED_IDENTITIES.md`, this file.
**Bugs found by tests, not by inspection:**
- `withResponse()` on `ProgramResource`/`AcademicTermResource` never fired —
  dead code, because `JsonResource::collection()` calls `withResponse()` on
  the wrapping `AnonymousResourceCollection`, not each item. See Failure and
  Recovery Record above for the fix (set the header on the controller's
  `JsonResponse` directly).
- A plain `curl` request (no `Accept: application/json`) to any
  `auth:sanctum` route — including the pre-existing `/api/v1/auth/me` and
  `/api/v1/auth/logout`, not just the two new endpoints — crashed with a 500
  `RouteNotFoundException: Route [login] not defined`, instead of the
  documented 401. Root cause: Laravel's `ApplicationBuilder` unconditionally
  defaults unauthenticated guests to `redirectGuestsTo(fn () => route('login'))`;
  this is a JSON-only API with no `login` named route. This predates this
  slice — every prior feature test used `getJson()`/`postJson()`, which set
  the `Accept` header automatically and never exercised the crash path.
  Fixed with `$middleware->redirectGuestsTo(fn () => null)` in
  `bootstrap/app.php`; confirmed the new
  `tests/Feature/Auth/UnauthenticatedNonJsonRequestTest.php` fails with the
  exact same error when the fix is temporarily reverted, and passes with it
  restored.
**Verification:** `composer test` 110/110 (325 assertions, up from 70/250),
`format:check`, `analyse` (Larastan level 8, 0 errors), `audit --locked` (0
advisories), Redocly OpenAPI lint clean, `route:list` exactly 6 routes, and a
**live HTTP proof** against a seeded dev database and a running
`php artisan serve`: `student.seed@grc.test` and `chair.seed@grc.test` hit
the identical `GET /api/v1/programs` and `GET /api/v1/academic-terms` URLs
and received genuinely different row counts and status sets; a tokenless
request returned 401 `UNAUTHENTICATED` both with and without an `Accept`
header.
**Not done, out of scope for this sub-project:** writes to programs/terms;
curriculum catalog, faculty input, section planning, approval workflow,
demand forecast, and audit logging (the remaining five Process 1.0
sub-projects); every frontend change; CI. No commit, push, or merge was
made — `AGENTS.md` requires explicit authorization, not yet given.

### 2026-07-27 21:15 +08:00

**Goal:** Implement the next PRD §5.1 sub-project — the curriculum catalog
(FR-SCH-001, FR-SCH-002) — and update the checklist after.
**Completed (branch `feat/curriculum-catalog` off `main`, worked in place):**
- Four migrations (`subjects`, `curricula`, `curriculum_subjects`,
  `subject_prerequisites`) — the first in this codebase to use foreign keys,
  with explicit `restrictOnDelete()`/`cascadeOnDelete()` per PRD §10.6.
  Required granting `grc_migrator`/`grc_test` table-level `CREATE`+DDL+DML on
  all 4 new tables first (health-checked `mysql.db` et al. before granting,
  per the MariaDB-instability memory; zero incidents).
- `App\Domain\Curriculum\SubjectStatus`/`CurriculumStatus` — provisional
  enums, same discipline as ADR 0008.
- `App\Domain\Curriculum\PrerequisiteCycleDetector` — a pure DFS cycle check
  over `{subject_id, prerequisite_subject_id}` edges, independent of
  Eloquent/persistence, covered by 8 unit tests (self-loop, direct, and
  transitive cycles; linear chains, shared prerequisites, and diamond graphs
  all correctly pass as non-cyclic).
- `Subject`/`Curriculum`/`CurriculumSubject`/`SubjectPrerequisite` models,
  `SubjectPolicy`/`CurriculumPolicy` (the latter adds `create`/`update`
  restricted to `program_chair`), and `GET /api/v1/subjects`,
  `GET/POST /api/v1/curricula`, `PATCH /api/v1/curricula/{curriculum}`.
- `POST`/`PATCH /curricula` are the **first production route** gated by the
  `role` middleware built (but unused) in the previous slice — restricted to
  `program_chair`, matching the frontend's existing module ownership.
- Full-replace write semantics: `StoreCurriculumRequest`/
  `UpdateCurriculumRequest` validate a nested `subjects` array and run the
  cycle detector in `withValidator()`; `SynchronizeCurriculumSubjects`
  deletes and recreates a curriculum's placements/prerequisites in one
  transaction. See ADR 0009 for why (PRD §8.4 lists no separate endpoints for
  the two child tables).
- Docs: ADR 0009, `docs/data-dictionary/curriculum-catalog.md`, 2 new OpenAPI
  paths + a `Forbidden` response + 10 new schemas (Redocly clean), this file.
**Bug caught by Larastan, not by tests:** `CurriculumResource`'s nested
array-shape docblocks declared `list<...>` but `Collection::map()->all()`
doesn't guarantee a list to PHPStan even when keys are sequential. Fixed with
`array_values(...)`, which has an explicit "always returns a list" stub —
`Collection::values()->all()` alone did not satisfy Larastan.
**Verification:** `composer test` 162/162 (451 assertions, up from 110/325),
including the PRD's own acceptance criterion verbatim ("A Program Chair
cannot create a prerequisite cycle") for both a direct and a transitive
cycle; `format:check`; `analyse` (Larastan level 8, 0 errors); `route:list`
exactly 10 routes; migration rollback/reapply clean; Redocly OpenAPI lint
clean; and a **live HTTP proof** that the automated suite alone could not
have caught (see Failure and Recovery Record for the `grc_app` grant gap it
surfaced): as `chair.seed@grc.test`, created a curriculum with a valid
prerequisite (201), then had a direct two-subject cycle rejected (422, exact
PRD wording); as `student.seed@grc.test`, the same `POST` was rejected (403)
while `GET` succeeded and correctly hid the still-`draft` curriculum, then
correctly showed it once a `PATCH` (full subject-list replace) set its
status to `active`.
**Not done, out of scope for this sub-project:** faculty input, section
planning, approval workflow, demand forecast, and audit logging (the
remaining four Process 1.0 sub-projects); every frontend change; CI.

### 2026-07-28 01:00 +08:00 — Untracked scaffold discovered and audited; schema foundation landed

**Goal:** Push `main` to `origin` (routine follow-up from the previous
session), then continue with whatever the user directed next.
**Discovery:** `git status` showed 43 untracked files and a modified
`DatabaseSeeder.php` with zero git history — not part of anything this
session or the prior one had done. A full read-through (all 13 migrations,
13 models, 10 enums, 4 seeders, 2 tests) found genuinely careful,
convention-matching work: correct FK semantics, PRD §-citations, consistent
PROVISIONAL-vocabulary flags, and one clever piece of schema design (below).
It covered two unrelated things — the three remaining PRD §5.1 sub-projects
(faculty input, section planning, approval workflow) and a completely
separate enrollment-records domain (`student_profiles` + 8 PRD §10.3 tables)
belonging to a distinct, later phase. See Failure and Recovery Record for the
full investigation (event log checks, the already-applied migrations, the
transient MariaDB connection refusal).
**User decisions (via plan mode, `backgrounded-inherited-treasure.md`):**
adopt and properly finish the scaffold rather than discard or ignore it; land
the enrollment-records domain as schema-only (tested, documented, no API)
since it belongs to a future phase; work through four sequential branches
(schema foundation → faculty input → section planning → approval workflow)
reviewed as one plan but merged one at a time.
**Completed (branch `feat/schedule-and-enrollment-schema-foundation` off
`main`, worked in place):**
- MariaDB safety check (`CHECK TABLE` on the five privilege tables, Event Log
  clean) then 39 table-level `GRANT` statements — `CREATE`+DDL+DML to
  `grc_migrator`/`grc_test`, DML to `grc_app` once tables existed — across all
  13 new tables, zero incidents. `FLUSH PRIVILEGES` deliberately omitted this
  time (unnecessary, and part of one of the two prior crash incidents).
- Confirmed the 13 tables were already migrated (batch 3) by whatever process
  wrote them; verified schema correctness directly (`SHOW CREATE TABLE`)
  rather than re-migrating.
- 24 new unit tests (11 domain enums, 13 models) and 4 new migration-
  constraint test files covering the 6 tables the found tests didn't reach.
- Fixed one real gap: `StudentProfile.year_level` now casts to `integer`,
  matching every other tiny/small-int column in this codebase — caught by a
  new unit test, not assumed.
- `docs/data-dictionary/enrollment-records.md` (new); corrected
  `curriculum-catalog.md`'s now-stale "no seeder ships" note, since
  `SubjectSeeder`/`CurriculumSeeder` were part of the same found batch.
- This `PROGRESS.md` entry, plus updated Database/Tests/Decisions sections
  and a checklist note that "Enrollment and digital advising" has schema-only
  groundwork but stays unchecked.
**Verification:** `composer test` 248/248 (640 assertions, up from 162/451);
`format:check`; `analyse` (Larastan level 8, 106 files, 0 errors); `audit`
clean; `route:list` still exactly 10 routes (schema-only task, no new
endpoints); Windows Event Log re-checked clean after every privilege write
and after migrating.
**Not done, deliberately deferred to the next three branches:** any Policy,
Resource, Controller, or route for faculty input, section planning, approval
workflow, or the enrollment-records domain; every frontend change; CI.

### 2026-07-28 01:45 +08:00 — Task 2: Faculty Input API (FR-SCH-003)

**Goal:** Second of the three remaining PRD §5.1 sub-projects from the
approved plan — build the API layer on top of the schema landed in the
previous task.
**Completed (branch `feat/faculty-input` off `main`, worked in place):**
- `FacultyAvailability`/`FacultySubjectPreference` gained a **new**
  `scopeVisibleTo()` shape: own-record, not status-based (neither table has
  a status column). Learner-scoped roles (in practice only `Faculty`) see
  `WHERE professor_id = $user->id`; planning roles see every professor's
  rows unfiltered.
- `FacultyAvailabilityPolicy`/`FacultySubjectPreferencePolicy`: `viewAny`
  true for everyone (the scope filters rows); `view` follows the
  visibility rule; `create` requires the `Faculty` role; `update`/`delete`
  require **both** the `Faculty` role **and** row ownership — a new
  two-condition shape, since same-role professors must not edit each
  other's rows.
- 8 new routes: `GET/POST /api/v1/faculty-availabilities`,
  `PATCH/DELETE /api/v1/faculty-availabilities/{facultyAvailability}`, same
  shape for `faculty-subject-preferences`. Writes gated `role:faculty`;
  `professor_id` is forced server-side to the authenticated user's ID, never
  accepted from the request body. These are the first `DELETE` endpoints in
  this API.
- The two `faculty_subject_preferences` composite-uniqueness rules
  (subject-per-term, rank-per-term) are enforced pre-flight with
  `Rule::unique()->where()->ignore()` rather than a custom `withValidator()`
  hook — simpler than the curriculum catalog's cycle detector because the
  underlying rule is plain uniqueness, not graph logic; same outcome (clean
  422, not a raw SQL error).
- Docs: `docs/data-dictionary/faculty-input.md`; OpenAPI gained 1 new tag,
  8 new paths, 10 new schemas.
**Two things caught before completion, not after:**
- An `openapi.yaml` edit matched its `old_string` one property short of the
  actual file, splitting the pre-existing `minimum_grade` property's
  `type`/`maxLength` apart. `@redocly/cli lint` failed immediately with a
  YAML parse error; fixed and re-linted clean. See Failure and Recovery
  Record.
- Starting `php artisan serve` for live verification found a pre-existing
  listener on port 8000 (two `php.exe`, running ~40 minutes already) that
  this session never started — a possible concurrent process against the
  same repository/database. Identified and stopped only my own new pair by
  matching exact process start times; left the pre-existing pair and one
  other unrelated `php.exe` untouched. See Failure and Recovery Record.
**Verification:** `composer test` 278/278 (752 assertions, up from
248/640), `format:check`, `analyse` (Larastan level 8, 116 files, 0
errors), `audit` clean, `route:list` exactly 18 routes, OpenAPI lint clean.
Given the port-8000 ambiguity, relied on the automated suite's real
HTTP-level coverage (Sanctum tokens through `postJson`/`patchJson`/
`deleteJson` against the real named routes) rather than an additional
manual `curl` session for this slice.
**Not done, out of scope for this sub-project:** section planning, approval
workflow (the next two branches); the enrollment-records domain's API layer
(deliberately out of scope per the schema-foundation task's decision); every
frontend change; CI.

### 2026-07-28 05:03 +08:00 — Task 3: Section Planning API (FR-SCH-004, FR-SCH-005)

**Goal:** Third of the three remaining PRD §5.1 sub-projects from the
approved plan.
**Completed (branch `feat/section-planning` off `main`, worked in place):**
- `App\Domain\Scheduling\ScheduleDayParser` — parses the `schedule_days`
  shorthand already seeded (`"MWF"`, `"TTh"`, `"Sat"`) into ISO-8601
  day-of-week integers, greedy and longest-token-first so `Th`/`Sat`/`Sun`
  aren't swallowed by single-letter checks; stops at the first unrecognized
  character rather than guessing.
- `App\Domain\Scheduling\SectionConflictDetector` — same pure,
  persistence-free shape as `PrerequisiteCycleDetector`. Flags a conflict
  only for same-professor, same-term, shared-day, overlapping-time
  double-booking (half-open interval check, so back-to-back slots don't
  conflict). Deliberately does **not** check room conflicts or
  faculty-availability matching — see ADR 0010 for why.
- `SectionStatus::isVisibleToLearners()` and `Section::scopeVisibleTo()`,
  matching the `Curriculum`/`Subject` pattern exactly.
- `SectionPolicy`, `Store`/`UpdateSectionRequest` (composite-unique
  `section_code` via `Rule::unique()->where()`, conflict check in
  `withValidator()`), `SectionResource` (includes a display-only
  `remaining_seats`), `SectionController` (index/store/update — no delete,
  matching curriculum's shape). 3 new routes, writes gated
  `role:program_chair`.
- Docs: ADR 0010, `docs/data-dictionary/section-planning.md`; OpenAPI gained
  1 tag, 2 paths, 4 schemas.
**Caught before completion, not after:**
- Larastan found 4 errors on the first run — a nullable-field-narrowing gap
  and a recurrence of the `Collection::map()->all()` vs `list<...>` issue
  from the curriculum-catalog slice. Both fixed using the same patterns
  already established. See Failure and Recovery Record.
- A `SectionPolicyTest` test tripped a duplicate-email unique-constraint
  violation from calling its own test helper twice with the same role.
  Fixed by reusing one user instance.
- Mid-way through the first full test run, MariaDB stopped entirely with no
  crash logged — paused and asked the user rather than restarting it myself,
  given the crash history; user confirmed they'd started it, rerun was
  clean. See Failure and Recovery Record for the full timeline.
**Verification:** `composer test` 312/312 (832 assertions, up from
278/752), `format:check`, `analyse` (Larastan level 8, 123 files, 0 errors),
`audit` clean, `route:list` exactly 21 routes, OpenAPI lint clean.
**Not done, out of scope for this sub-project:** approval workflow (the
final branch); the enrollment-records domain's API layer; every frontend
change; CI.

### 2026-07-28 05:24 +08:00 — Task 4: Approval Workflow API (FR-SCH-007 through FR-SCH-009); PRD §5.1 unblocked scope complete

**Goal:** Final of the four tasks in the approved plan — the last of the
three remaining PRD §5.1 sub-projects.
**Completed (branch `feat/schedule-approval-workflow` off `main`, worked in
place):**
- `App\Actions\Scheduling\TransitionScheduleProposal` — applies one of six
  transitions (`dean_approve`, `dean_return`, `executive_approve`,
  `executive_return`, `publish`, `close`), records `decided_by`/`decided_at`/
  `decision_reason`, and — only for `publish` — bulk-transitions every
  `planned` section in the proposal's term to `published`, all in one
  `DB::transaction()`. No new foreign key between `schedule_proposals` and
  `sections`; see ADR 0011 for why a term-scoped bulk update is the right
  call here.
- `ScheduleProposalPolicy` — a new authorization shape: four abilities
  (`approveAsDean`, `approveAsExecutive`, `publish`, `close`) instead of the
  usual `create`/`update` pair, since one `PATCH` route serves six
  role-specific transitions. `ScheduleProposalController` resolves which
  ability applies from the request's `action` field — the first write route
  in this API with **no** `role:` middleware at all.
- `Store`/`UpdateScheduleProposalRequest` — the one-active-proposal-per-term
  guard (application-level, same reasoning as `enrollments`' generated
  column), the current-status precondition per action, and
  `decision_reason` required exactly for the two return actions.
- 3 new routes; `ScheduleProposalResource`; ADR 0011;
  `docs/data-dictionary/approval-workflow.md`; OpenAPI gained 1 tag, 3
  paths, 4 schemas.
**Caught before completion, not after:**
- A genuine Laravel/Sanctum testing quirk: chaining four different
  authenticated users within one test method (simulating the real
  chair→dean→executive→registrar workflow) hit a guard-caching issue where
  the second `withToken()` swap silently kept the *first* request's user.
  `forgetGuards()` didn't fix it. Resolved by testing each transition as its
  own single-actor test — the same structure every other endpoint test in
  this session already uses — rather than fighting the framework further.
  See Failure and Recovery Record and ADR 0011's testing note.
- Two test-setup mistakes caught by the run itself: a proposal precreated in
  the wrong status for the action under test, and a visibility test hitting
  `academic_terms`' unique constraint by creating two terms with identical
  `(school_year, semester)`. Both fixed at the test, not the application
  code — see Failure and Recovery Record.
**Verification:** `composer test` 335/335 (898 assertions, up from
312/832), `format:check`, `analyse` (Larastan level 8, 129 files, 0
errors), `audit` clean, `route:list` exactly 24 routes, OpenAPI lint clean.
**Not done, deliberately out of scope:** the enrollment-records domain's
API layer (a future PRD phase, per the schema-foundation task's decision);
demand forecast (FR-SCH-006, blocked on Process 4.0); audit logging
(FR-SCH-010, cross-cutting, its own future slice); every frontend change;
CI. This completes every currently-unblocked PRD §5.1 sub-project.
