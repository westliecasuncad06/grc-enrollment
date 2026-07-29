# Project Handoff

## Last Updated

- **Agent:** Codex
- **Date and time:** 2026-07-29 21:43:00 +08:00
- **Current branch:** `phase-5-portal-workspaces`
- **Previous reviewed commit:** `b6ee7ed docs(handoff): accept admission provisioning remediation`
- **Integration state:** Phase 4 remains locally integrated on `main`. Phase 5
  Tasks 1–6 are accepted and committed only on their isolated review branch;
  nothing has been pushed or merged.

## Current Objective

Begin Phase 5 Task 7 — Program Chair sections and schedule workspace on the
isolated branch. Preserve the accepted Task 6 full-replace curriculum graph
contract, identity-scoped reference queries, browser-token ownership, strict
parsed API contracts, and Program Chair-only backend authorization; do not
merge or push.

The page-top published completion remains **41%**. Machine learning remains
last in roadmap Phase 9; no model, prediction endpoint, or student attrition
UI belongs in Phase 5.

## Verified Completed Work

### Phase 5 Task 1 — Program Chair faculty directory

- Added the audited, private `GET /api/v1/faculty-members` endpoint for the
  Program Chair. It returns only active Faculty users in deterministic `name`,
  then `id` order, with the exact safe resource keys `type`, `id`, `name`,
  `status`, and `status_label`.
- Authorization is defense in depth: authenticated/active/throttled route
  middleware plus `role:program_chair`, the `view-faculty-directory` Gate,
  and `FacultyMemberPolicy`.
- The action materializes the directory and writes the
  `faculty_directory.list_viewed` audit event with only `result_count` in one
  transaction. An injected audit-write failure returns no successful
  directory payload.
- Focused verification passed:
  `php artisan test --filter='FacultyMembersEndpointTest|AuditVocabularyTest|ApiSurfaceTest'`
  — **24 tests, 147 assertions**. The API inventory increased from **29 to
  30 routes**.
- Local review commit: `c71d7b7` (isolated branch only; not pushed or merged).

### Phase 5 Task 2 — Shared frontend data layer

- Added authenticated `PATCH` and `DELETE` JSON helpers to the strict API
  client. They preserve bearer injection, `credentials: "omit"`, `cache:
  "no-store"`, abort signals, 204 handling, and authenticated-401 sign-out.
- `ApiClientError` now retains the validated backend `errors` envelope, and
  `applyApiFieldErrors()` maps named 422 messages into React Hook Form without
  treating conflicts or other server failures as field validation.
- Added the configured radix/shadcn sources for Table, Select, Dialog, Alert
  Dialog, Pagination, and a single Sonner `Toaster` mounted from `Providers`.
- Verification passed: focused client/form gate **14 tests**; full frontend
  suite **16 files / 150 tests**; Prettier, ESLint, Oxlint, TypeScript, and
  production build all passed. The storage-boundary scan found no direct
  browser storage access outside `auth-token.ts` (other match is a comment).
- Independent Task 2 review verdict: **Accept with no findings**.

### Phase 5 Task 3 — Portal reference context, notifications, and registry

- Added strict Zod clients and TanStack Query hooks for academic terms,
  programs, subjects, and authenticated user-owned notifications. The active
  term is selected only from `status: active`, with an honest no-active-term
  fallback.
- Replaced the disabled notification preview action with an accessible Sheet:
  unread count, unread-only filter, pagination, mark-as-read PATCH, and a
  safe generic API-error state. Profile, password, help, and report-issue
  controls remain disabled and honestly labeled.
- Added the explicit 13-ID Phase 5 registry after the existing role check.
  Registry-owned IDs dispatch to their isolated workspace slots; every other
  catalog module retains the scoped preview state, including cross-role
  not-found protection.
- RED evidence: the required narrow notification/sheet/registry Vitest
  command exited 1 because all three new imports did not exist. Final targeted
  coverage passed **6 files / 70 tests**; complete frontend verification passed
  **19 files / 160 tests**, TypeScript, Prettier, ESLint, Oxlint, and
  production build. `git diff --check` was clean.
- Independent review found an identity-free private-query cache issue. The
  remediation scopes notification and authenticated reference-data query keys
  by `session.userId` and disables them while anonymous, so no account can
  address another account's fresh cache. The A → logout → B regression passes;
  full frontend verification is **19 files / 160 tests**. Independent re-review
  returned **Accept with no findings**; Task 3 is accepted and complete.

### Phase 5 Task 4 — Admission Staff provisioning workspace

- Connected `student-accounts`, `admission-status`, and
  `credential-issuance` to one three-step Admission Staff workspace. It submits
  exactly the seven existing student-provisioning fields through the existing
  bearer-authenticated `POST /api/v1/student-profiles` contract.
- Added strict student-profile parsing, typed curricula reference data, and a
  browser CSPRNG 20-character temporary credential with required upper/lower,
  digit, and symbol classes. Credentials never enter browser storage, form
  state, logs, or TanStack Query caches; failures discard them and the success
  receipt clears them on close.
- The workspace maps named 422 errors, prevents duplicate submission, provides
  a safe connection retry, and renders the API-guaranteed `Admitted` / `Good`
  status read-only without inventing an update API.
- RED evidence: the required three-test Vitest command exited 1 because all
  three new feature imports were absent. Final focused gate passed **4 files /
  9 tests**; complete frontend verification passed **22 files / 166 tests**,
  Prettier, ESLint, Oxlint, TypeScript, and production build. Published
  completion remains **41%**; Task 5 is next.

#### Review remediation — accepted

- Corrected the curriculum status contract from the unsupported `retired`
  literal to backend/OpenAPI's `archived`; strictly parses provisioning inputs
  before the request; and resets dependent curriculum form state on a program
  change.
- Added regressions for clipboard success/denial and distinct failed/retry
  credentials. The remediation gate passed **4 files / 12 tests** and the full
  frontend suite passed **23 files / 170 tests**. Prettier, ESLint, Oxlint,
  TypeScript, and production build passed.
- Independent re-review returned **Accept with no findings**; its latest review
  check passed **6 relevant files / 56 tests**. Task 4 is accepted and
  complete; published completion remains **41%**.

### Phase 5 Task 5 — Faculty availability, preferences, and teaching schedule

- Connected the Faculty role's `availability-preferences` and
  `teaching-schedule` module IDs to real workspaces. Availability and subject
  preferences use strict Zod contracts and typed CRUD clients for the existing
  own-record `/faculty-availabilities` and `/faculty-subject-preferences`
  endpoints; all query keys include the authenticated user ID.
- The RHF forms validate ISO weekdays 1–7, `HH:mm:ss`, end-after-start, and
  preference rank. Backend 422 field errors render beside their named inputs;
  each mutation invalidates only its matching user-scoped query key. Edit,
  loading, empty, generic-error, and accessible Alert Dialog delete-confirm
  states are covered.
- Added a strict parsed `/sections` reference hook. Teaching schedule display
  maps only the API-scoped section response with subjects and terms, never
  calls roster or grade APIs, and renders both a desktop table and mobile
  cards.
- RED evidence: the required three-file Vitest command exited 1 because all
  three new production imports were absent. Final Faculty/portal-shell gate
  passed **4 files / 23 tests**; complete frontend verification passed
  **26 files / 179 tests**, Prettier, ESLint, Oxlint, TypeScript, and the
  production build. Published completion remains **41%**; Task 6 is next.

#### Review remediation — accepted

- Corrected a Task 5 authorization gap: the existing `/api/v1/sections`
  contract now scopes a Faculty response to its own `professor_id` and to
  `published`/`closed` rows. Student and Accounting retain their original
  status-only scope, and planner visibility remains unchanged.
- `SectionPolicy::view()` applies the same own-assignment condition, preventing
  a later direct-ID read from bypassing collection scope. The frontend applies
  the same exact numeric `session.userId` / `professor_id` match only as a
  defense-in-depth display filter; backend authorization remains authoritative.
- Regression coverage proves a Faculty index excludes another Faculty member's
  published and closed sections and direct policy evaluation denies another
  Faculty assignment. Schedule desktop cells now include subject code and
  title, matching mobile cards.
- Independent re-review returned **Accept with no findings**. The review gate
  passed **18 backend files / 52 tests** and **5 frontend files / 27 tests**;
  the full backend (**517 tests / 1,956 assertions**) and frontend (**26 files
  / 179 tests**) suites remain green. Task 5 is accepted and complete;
  published completion remains **41%** and Task 6 is next.

### Phase 5 Task 6 — Program Chair curriculum and prerequisites

- Connected both Program Chair module IDs, `curriculum` and
  `subjects-prerequisites`, to one full-replace curriculum workspace. The
  typed client sends `program_id` only on `POST`; immutable ownership is not
  sent to `PATCH`, while all metadata, placements, and prerequisite edges are
  preserved.
- Strict Zod/RHF contracts reject duplicate placements, self-prerequisites,
  and direct or transitive graph cycles before submission. The editor also
  renders the backend's authoritative cycle `422` beside the graph, preserves
  values for retry/conflict resolution, and requires an accessible discard
  confirmation for unsaved edits.
- Curricula, programs, and subjects remain parsed reference data through
  TanStack Query; curriculum query keys are scoped to `session.userId`, and
  rendering components make no direct browser requests. Loading, empty,
  error, saving, and retry-capable states are explicit.
- RED evidence: the required three-file command failed because the service,
  workspace, and prerequisite editor imports did not exist. Final focused gate
  passed **4 files / 10 tests**; full frontend verification passed **29 files /
  186 tests**, Prettier, ESLint, Oxlint, TypeScript, production build, and
  `git diff --check`. Published completion remains **41%**; Task 7 is next.

#### Review remediation — accepted

- Placement is again an explicit catalog-subject choice. Every placement now
  exposes editable year level (1–4), semester (1st–3rd), and required status;
  duplicate placements remain blocked before submission.
- A dirty curriculum selection change uses the same accessible discard dialog
  as New. Cancel preserves both the selected curriculum and unsaved values;
  confirmed replacement is intentional. A successful create adopts the
  returned curriculum ID so the next save is a PATCH, not a duplicate POST.
- Curriculum responses now use a strict Zod `{ data }` envelope that rejects
  unexpected top-level properties, matching the published OpenAPI contract.
- New RED coverage exposed the four review defects and the selector-to-New
  reset edge case. GREEN verification passed the 4-file Task 6 gate (**15
  tests**) and the complete frontend suite (**29 files / 191 tests**),
  production build, TypeScript, Prettier, ESLint,
  Oxlint, and `git diff --check`. The independent re-review returned **Accept
  with no findings**. Task 6 is accepted and complete; published completion
  remains **41%** and Task 7 is next.

### Takeover verification performed by Codex

- Read the complete root `AGENTS.md`, `PRD.md`, and `PROGRESS.md`.
- No nested `AGENTS.md` exists.
- No prior `HANDOFF.md` existed; this file establishes the required protocol.
- Reviewed Git status, current tracked/untracked diff inventory, and recent
  commits `694010c`, `e611db4`, and `d65a1e5`.
- Read the two attached Claude transcripts. They describe the merged Phase 3
  baseline and an older student-profile verification sequence; they are not a
  current Phase 4 handoff.
- Inspected the Phase 4 design, 13-task implementation plan, task ledger,
  Task 12/13 briefs, task reports, migrations, models, domain vocabulary,
  audit/notification actions, policies, controllers, Resources, requests,
  routes, seeder changes, and documentation diffs.
- Fresh focused Phase 4 command passed:
  **152 tests, 935 assertions**.
- Fresh complete backend suite passed:
  **503 tests, 1,899 assertions**.
- Fresh test-database migration gate passed:
  - all 26 tables created from a fresh `grc_enrollment_test`;
  - exactly the five Phase 4 migrations rolled back;
  - all five reapplied; and
  - focused migration suites passed **27 tests, 70 assertions**.
- Fresh route inspection found exactly **29** `/api/v1` routes.
- Fresh boundary greps found:
  - no `PredictionRun`, `SectionDemandForecast`, or
    `AttritionPrediction` reference in `app/Http`, `routes`, or
    `database/seeders`; and
  - no direct `create`, `update`, `delete`, or `DB::transaction` call in the
    six refactored mutation controllers.
- Fresh Redocly semantic lint passed with no warnings or errors.
- Fresh `git diff --check` passed with no output.
- Fresh final static/security gate passed:
  - Pint format check clean;
  - Larastan/PHPStan level 8, 175 files, no errors;
  - Composer locked dependency audit, no advisories;
  - Redocly clean;
  - `git diff --check` clean; and
  - route inventory still exactly 29.

### Phase 4 implementation merged into `main`

Tasks 1–11 in
`.superpowers/sdd/2026-07-29-phase-4-cross-cutting-backend/progress.md`
are implemented and have task-level reports:

1. Stable audit, notification, and prediction vocabulary.
2. `audit_logs` and `notifications` migrations.
3. Schema-only `prediction_runs`, `section_demand_forecasts`, and
   `attrition_predictions` migrations with MariaDB checks and uniqueness.
4. Models, casts, relationships, and application-level `AuditLog`
   immutability.
5. Request context and privacy-guarded `AuditRecorder`.
6. Authenticated user-owned notification list and idempotent mark-as-read API.
7. Registrar Head-only filterable, paginated audit-log API whose successful
   privileged reads are audited.
8. Transactional audit retrofit for faculty availability and preferences.
9. Transactional audit retrofit for curriculum graphs and sections.
10. Transactional schedule lifecycle auditing and deduplicated publication
    notifications.
11. Privacy-safe student-provisioning audit in the existing User +
    StudentProfile transaction.

Task 12 route inventory is implemented and included in the fresh passing
focused suite. OpenAPI and the cross-cutting data dictionary are written and
Redocly-clean.

`PROGRESS.md` was reconciled through the full-gate and merge milestone:

- it records the merged 29-route/26-table Phase 4 surface;
- records the complete audit, notification, publication-recipient, and
  schema-only analytical scope;
- updates the nine-role authorization table without marking any portal
  functional;
- keeps ML in Phase 9; and
- raises the published overall completion to 41% after the merge.

After the fresh full suite, `PROGRESS.md` was updated to the verified worktree
total of **503 tests / 1,899 assertions**. It now states only the remaining
migration and static/security gates.

After the fresh migration gate, `PROGRESS.md` was updated with the successful
fresh + five-step rollback + reapply result and **27 tests / 70 assertions**.
It now states only the remaining static/security gate and final
reconciliation.

After the final quality gate and local merge:

- `PROGRESS.md` now marks Phase 4 **complete (merged and verified)** and
  published completion at 41%;
- its system snapshot carries the exact 503/1,899 full-suite and 27/70
  migration-gate results plus the clean static/security results; and
- the local SDD ledger marks Tasks 12 and 13 complete.

Final requirements inspection found one documentation omission:
`cross-cutting-backend.md` described preservation behavior throughout but did
not explicitly label the required retention/sensitivity expectations. A
focused section now records each table's sensitivity and deletion behavior,
states that PRD §17 retention duration is unapproved, and deliberately avoids
inventing a purge duration. The follow-up grep and `git diff --check` passed.

Independent final review found no Critical code/security/authorization/
transaction/migration/API-contract defect. It found one Important handoff-only
blocker: three older passages still said Task 13 verification and migration
reversibility were pending. Those passages now state the completed
503/1,899 suite, successful migration sequence, and “merged and verified”
status consistently. The targeted stale-pattern scan and `git diff --check`
pass. Focused re-review approved the correction; no Critical or Important
review finding remains.

Final pre-merge whole-worktree inspection passed:

- feature branch was at base commit `694010c` before the Phase 4 commit;
- 27 tracked files are modified and 69 exact untracked files exist (Git's
  short status collapses these into 51 untracked path entries);
- zero files are staged;
- no environment file, dependency directory, test cache, coverage output,
  build-info file, log, or Python cache appears in status;
- every mandatory handoff section exists;
- no stale completion phrase matched; and
- final `git diff --check` exited 0.

The explicit user-requested seeder policy is also present: every synthetic
local/testing login uses shared password `password`, Laravel hashes it, and
both user-producing seeders still refuse production-like environments.

## Work in Progress

Task 12 of the Phase 4 plan is content-complete:

- `backend/tests/Feature/Api/V1/ApiSurfaceTest.php` is updated and passes.
- `docs/api/openapi.yaml` contains the three new paths and reusable
  notification/audit pagination schemas; Redocly passes.
- `docs/data-dictionary/cross-cutting-backend.md` documents all five tables
  and the approved `HISTORICAL DATA` mapping.
- `PROGRESS.md` publishes the merged totals, labels Phase 4 complete, and
  reports 41% overall completion.

No implementation or verification task remains in the approved Phase 4 plan.
Tasks 1–13 are complete, independently reviewed, merged into `main`, and
  with the post-merge test run, handoff update, and cleanup complete.

## Files Changed

### Tracked modifications

- `PROGRESS.md`
- Existing mutation actions/controllers:
  `SynchronizeCurriculumSubjects.php`, `ProvisionStudent.php`,
  `TransitionScheduleProposal.php`, and the six affected API controllers
- `backend/app/Models/User.php`
- `backend/routes/api.php`
- Existing endpoint and seeder tests
- `RoleUserSeeder.php`, `DemoEnrollmentSeeder.php`
- `docs/api/openapi.yaml`
- seed-password documentation in:
  `docs/data-dictionary/enrollment-records.md`,
  `docs/runbooks/mariadb-local.md`, and
  `docs/testing/SEEDED_IDENTITIES.md`

### New implementation groups merged by `5bf9e77`

- Audit, faculty, notification, curriculum, and scheduling Actions
- Analytics/audit/notification domain vocabulary
- Audit and notification controllers, Form Requests, Resources, and Policies
- `AuditLog`, `Notification`, `PredictionRun`, `SectionDemandForecast`, and
  `AttritionPrediction` models
- Audit support classes
- Five `2026_07_29_00000*` migrations
- Phase 4 unit, feature, policy, API, action, model, and migration tests
- `docs/data-dictionary/cross-cutting-backend.md`
- Phase 4 design and implementation-plan documents
- This `HANDOFF.md`

The feature worktree was removed only after post-merge verification. The
`.superpowers/sdd/...` ledger and reports remain local execution evidence and
may be ignored by Git.

## Commands and Tests Run

Fresh takeover commands:

```powershell
git status --short --branch
git log -8 --oneline --decorate
git diff --stat
git show --stat --oneline --summary 694010c
git show --stat --oneline --summary e611db4
git show --stat --oneline --summary d65a1e5
```

```powershell
cd backend
php artisan test --filter='Audit|Notification|Prediction|CurriculumAudit|FacultyInputAudit|SectionAudit|ScheduleProposalAudit|ProvisionStudentAudit|ApiSurfaceTest'
```

Result: **passed — 152 tests, 935 assertions, 10.94 seconds**.

Full backend suite:

```powershell
cd backend
composer test
php artisan test --without-tty
```

The `composer test` run completed successfully but its streamed output
truncated the final summary. A fresh non-TTY run was therefore captured to a
temporary log and its tail inspected. Result:
**503 tests passed, 1,899 assertions, 31.61 seconds**.

Post-merge verification on `main`:

```powershell
cd C:\xampp\htdocs\GRC-ENROLLMENT\backend
php artisan test --without-tty
```

Result: **503 tests passed, 1,899 assertions, 46.23 seconds**; exit code 0.

```powershell
php artisan route:list --json
```

Result: **29 `/api/v1` routes**.

Test-database migration gate:

```powershell
cd backend
php artisan migrate:fresh --env=testing
php artisan migrate:rollback --step=5 --env=testing
php artisan migrate --env=testing
php artisan test --filter='AuditAndNotificationMigrationTest|AnalyticsSubstrateMigrationTest'
```

Target was confirmed first as `APP_ENV=testing`,
`DB_CONNECTION=mariadb`, `DB_DATABASE=grc_enrollment_test`; no credential was
displayed. Results: fresh/rollback/reapply all passed; **27 tests,
70 assertions** passed.

```powershell
rg -n 'PredictionRun|SectionDemandForecast|AttritionPrediction' app/Http routes database/seeders
```

Result: no matches.

```powershell
rg -n '::create\(|->update\(|->delete\(|DB::transaction' `
  app/Http/Controllers/Api/V1/CurriculumController.php `
  app/Http/Controllers/Api/V1/FacultyAvailabilityController.php `
  app/Http/Controllers/Api/V1/FacultySubjectPreferenceController.php `
  app/Http/Controllers/Api/V1/ScheduleProposalController.php `
  app/Http/Controllers/Api/V1/SectionController.php `
  app/Http/Controllers/Api/V1/StudentProfileController.php
```

Result: no matches.

```powershell
cd ..
npx --yes @redocly/cli@latest lint docs/api/openapi.yaml
git diff --check
```

Results: OpenAPI valid with no warnings/errors; diff check clean.

Final static/security gate:

```powershell
cd backend
composer format:check
vendor\bin\phpstan analyse --memory-limit=1G --no-progress
composer audit --locked
cd ..
npx --yes @redocly/cli@latest lint docs/api/openapi.yaml
git diff --check
```

Results: Pint passed; PHPStan/Larastan level 8 analyzed 175 files with no
errors; no locked dependency advisories; OpenAPI valid; diff check clean.

After the first takeover checkpoint, `PROGRESS.md` was updated and checked:

```powershell
rg -n '26 routes|21 tables|Not yet created|Task 7|⬅ \*\*Next\*\*|Registrar Head.*close proposal only|348 passing \(968' PROGRESS.md
git diff --check
```

Results: no stale-pattern matches; diff check clean.

Earlier task-level commands and exact results are recorded in
`.superpowers/sdd/2026-07-29-phase-4-cross-cutting-backend/task-*-report.md`.
The post-merge full-suite result must still be recorded below before cleanup.

## Technical Decisions

- Existing privileged mutations use explicit transaction-owning Actions.
  Controllers authenticate, authorize, create request context, invoke one
  use case, and return Resources.
- `AuditRecorder` joins the caller's transaction and never owns a transaction.
  Audit failure therefore rolls back the associated domain write.
- Audit snapshots use allowlisted safe fields. Secret and contact-key
  fragments are recursively rejected.
- Audit rows have no mutation route and reject Eloquent update/delete events.
- Notifications are always scoped to their owning authenticated user;
  `user_id` is never serialized.
- Schedule publication locks/rechecks state, audits every newly published
  section, audits the proposal, and notifies the submitter plus unique assigned
  faculty in one transaction.
- The three prediction tables are storage-only. Outputs are advisory and
  cannot mutate operational records.
- `HISTORICAL DATA` maps to authoritative operational tables; no duplicate
  generic `historical_data` table is created.
- Shared development password `password` is intentional user direction,
  limited to synthetic `local`/`testing` seeders and stored only as a hash.

## Known Issues and Blockers

- No blocking implementation defect is currently known.
- Three minor test enhancements remain explicitly deferred in the task ledger:
  non-integer audit list filters, explicit null-reason assertions for faculty
  audit helpers, and a direct action-level stale-proposal concurrency test.
  Existing production validation/guards and HTTP coverage are present.
- The known `ml-service` CI failure remains paused until Phase 9 and is outside
  this phase.

## Uncommitted or Risky Changes

- The pre-existing user edit to
  `docs/superpowers/plans/2026-07-27-mariadb-identity-sanctum-auth.md` remains
  modified on `main` and was not touched.
- Five migrations add persistent tables. Their complete test-database
  fresh/five-step rollback/reapply sequence and focused constraint suites
  passed in Task 13.
- MariaDB is the local XAMPP 10.4.32 instance. Never issue a schema-wildcard
  `GRANT`, run `FLUSH PRIVILEGES`, stop, reconfigure, or upgrade
  `C:\xampp\mysql`. Only exact table-level grants are permitted.
- Do not expose database credentials from `.env.testing`.
- Do not kill unknown port-8000 processes; use another port if live HTTP
  verification is later needed.
- Do not push or alter the unrelated plan edit without explicit user direction.

## Exact Next Steps

1. Begin **Phase 5 Task 7 — Program Chair sections and schedule workspace**
   from its supplied task brief on `phase-5-portal-workspaces`. Preserve the
   accepted Task 6 full-replace curriculum graph semantics.
2. Preserve the unrelated modified plan file until its owner decides what to
   do with it; do not push or merge the isolated Task 1 or Task 2 commits without
   explicit authorization.

## Do Not Change

- Do not implement machine learning, prediction endpoints, prediction jobs,
  model training, or attrition UI before roadmap Phase 9.
- Do not change the Next.js client-rendered/bearer-token architecture.
- Do not introduce cookie/session/CSRF authentication or API proxying.
- Do not hardcode unresolved PRD §17 institutional policies.
- Do not weaken audit privacy, notification ownership, Registrar Head audit
  authorization, transactional rollback, or advisory-only analytical
  boundaries.
- Do not modify `ml-service` code or work outside the scoped Phase 5 task.
- Do not alter unrelated dirty-worktree changes.
- Do not stage, commit, merge, push, reset, or stash without explicit user
  authorization.

## Useful References

- `AGENTS.md`
- `PRD.md`
- `PROGRESS.md`
- `docs/superpowers/specs/2026-07-29-phase-4-cross-cutting-backend-design.md`
- `docs/superpowers/plans/2026-07-29-phase-4-cross-cutting-backend.md`
- `.superpowers/sdd/2026-07-29-phase-4-cross-cutting-backend/progress.md`
- `.superpowers/sdd/2026-07-29-phase-4-cross-cutting-backend/task-12-brief.md`
- `.superpowers/sdd/2026-07-29-phase-4-cross-cutting-backend/task-13-brief.md`
- `docs/api/openapi.yaml`
- `docs/data-dictionary/cross-cutting-backend.md`
- `docs/testing/SEEDED_IDENTITIES.md`
- `docs/runbooks/mariadb-local.md`
