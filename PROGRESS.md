# GRC Enrollment System — Development Progress

## 2026-08-15 — Predictive analytics, scheduling, curriculum, and analytics repair

Registrar Head analytics request: a new role-authorized analytics module will
show institution-wide enrollment aggregates by default and an optional
department filter (including an explicit All departments option). Backend
source review confirms that the existing endpoint is Program-Chair-only and
college-scoped, while schedule-demand runs are also college-scoped. The
implementation will broaden only the enrollment-summary aggregation for
Registrar Head and keep Program Chairs confined to their own college; the
college-specific forecast and prescriptive tabs remain Program-Chair-only.
Test-first implementation is in progress; no commit or push is authorized.

Registrar analytics test milestone: frontend and backend regression coverage
now describes the required all-departments default, a Registrar Head department
filter, and the Program Chair cross-department guard. The initial Laravel
focused-suite attempt exceeded the local command timeout before producing a
result, so it will be rerun after the implementation with a longer-running
test process; no production code has been changed for this feature yet.

Registrar Head analytics implementation milestone: Analytics is now a live
Registrar Head module. Its default scope is All departments and its Department
filter includes CCS, COE, COA, and CBAE. The existing endpoint remains
authenticated but was moved out of the Program Chair-only route middleware;
DashboardPolicy and the controller enforce server-side scope: Registrar Head
may aggregate all supported departments or select one, while Program Chairs
remain confined to their assigned college even if they alter the query string.
The selected department updates the counts and official-enrollment trend below
the filters. Schedule-demand forecast and prescriptive tabs remain exclusive
to Program Chairs because those data are college-specific schedule runs.

Registrar Head analytics verification milestone: TypeScript completed with no
errors. Focused frontend tests passed for Analytics (7), role capabilities
(5), module registry (4), and portal module routing (53); targeted Prettier
and Laravel Pint checks passed. Laravel feature tests passed for the new
all-departments/department-filter behavior (6 assertions), Program Chair
cross-department denial, normal Program Chair access, and existing
college/term-scoped aggregate behavior (11 assertions). A full parallel
Laravel file run is unavailable because ParaTest is not installed; no commit
or push was made. `git diff --check` completed without diff errors; its only
output is the pre-existing CSV line-ending warning.

GitHub saving point requested: the user authorized an intentional scoped
commit and push to `origin/main` for the completed enrollment, scheduling,
curriculum, predictive-analytics, and Registrar Head analytics work. Local
dependencies, screenshots, and unrelated workspace artifacts will remain
unstaged.

Schedule assignment validation follow-up: the second failure is a server-side
schedule conflict, not another canonical-day contract error. The proposed
Wednesday 01:30–03:00 F2F meeting in room 4E overlaps an existing planned
2026-2027 second-semester room-4E assignment (01:30–04:30), so the API
correctly returns a validation error to prevent a double booking. The modal
currently discards `ApiClientError.fieldErrors` and displays only Laravel's
generic summary. A test-first UI repair will surface the exact room, professor,
or override-reason error without weakening conflict validation.

Schedule assignment validation repair milestone: the Schedule & Faculty modal
now renders each field-level API validation error (rather than Laravel's
generic "submitted data is invalid" summary) and invokes the mutation without
leaving an unhandled rejected promise. The room-conflict regression test first
failed with the generic message, then passed with the exact error visible.
Focused frontend verification passed: Schedule & Faculty and scheduling-service
Vitest suites (8 tests), TypeScript, targeted Prettier, and `git diff --check`
(only the pre-existing curriculum CSV line-ending warning). No commit or push
was made.

Faculty-assignment save failure report: selecting a professor for an
unassigned generated section displays a frontend section-replacement contract
error. Root cause confirmed before code changes: the API now returns canonical
uppercase schedule days such as `THU`, but the frontend replacement validator
accepts only the legacy `Th` shorthand. The client rejects the full section
locally before the PATCH request. A test-first compatibility repair is in
progress; no commit or push is authorized.

Faculty-assignment save repair milestone: the frontend schedule validator now
accepts both legacy shorthand (`MWF`, `TTh`) and the API's canonical day codes
(`MON`, `TUE`, `THU`, etc.), so selecting a professor for an unassigned
section no longer fails local replacement validation. The new regression test
reproduced the original `THU` failure before the change, then passed after it.
Focused frontend verification passed: scheduling-service and Schedule &
Faculty workspace Vitest suites (7 tests), TypeScript, targeted Prettier, and
`git diff --check` (only the pre-existing curriculum CSV line-ending warning).
No commit or push was made.

Approval-submission failure report: the Program Chair submit action is disabled
whenever generated sections have incomplete day, time, room, or modality
details. The same requirement is enforced by `SaveSectionPlan::submit()`, so
the issue affects both the interface and API. Per the user's direction, the
fix will allow an incomplete schedule proposal to enter the Dean/Executive
Director review flow while keeping the incomplete assignments visible as a
review warning. Test-first implementation is in progress; no commit or push
is authorized.

Approval-submission repair milestone: incomplete schedule assignments no
longer disable the Program Chair's submit action or cause the submit API to
reject the proposal. They remain explicitly counted in the interface and in
the confirmation dialog for Dean/Executive Director review. A proposal with
zero generated sections remains invalid. Focused verification passed: Laravel
`SaveSectionPlanSubmitTest` (2 tests, 4 assertions), the complete Program
Chair workspace Vitest file (23 tests), frontend TypeScript, targeted Pint,
and `git diff --check` (only an existing line-ending warning for a curriculum
CSV). No commit or push was made.

Session started after the user approved the predictive analytics implementation
plan. The work is authorized directly on `main` by the user and repository
instructions; no commit or push is authorized. The existing dirty worktree is
user-owned and will be preserved. Root-cause investigation completed before
code changes: the forecast API was unreachable on port 8100, and the current
section-demand workflow used synthetic subject-level rows as block-count
history, which can reduce a real first-year cohort to two generated sections.
Implementation will proceed test-first in these vertical slices: cohort-level
forecasting with a safe local fallback, editable schedule drafts, automatic
curriculum assignment and repair, then filterable official-enrollment analytics.

Curriculum repair milestone: a dry-run command is being introduced before any
local profile mutation. It resolves a student's curriculum exclusively from
program plus entry year, reports missing/unresolvable master-data rows, and
will only be applied after the dry-run count is inspected.

Curriculum repair applied locally after dry-run validation: 3,220 profiles
were examined, 660 mismatched curriculum assignments were updated, 8 profiles
without an `entry_year` were intentionally skipped, and no entry year lacked
a configured curriculum version. The repair remains available as
`php artisan curricula:repair-student-assignments --dry-run` for future
preflight checks.

Migration attempt failure: the application database account `grc_app` lacks
MariaDB `ALTER` privilege for `section_demand_forecasts`, so the new
curriculum-cohort forecast unique key is pending in the local database. No
schema change was applied by the failed migration. Automated test databases
continue to exercise the migration from a fresh schema; applying it locally
requires a database account with `ALTER` permission.

Implementation milestone: section-demand prediction is now curriculum-cohort
based and uses a local, request-scoped Random Forest v2 for both demand and
recommended block count. Only `derived_from_enrollments` observations are
training data; the old synthetic per-subject aggregate no longer reduces a
real cohort to one or two blocks. The ML connection-failure path records an
advisory historical-baseline forecast rather than failing schedule generation.
The locally applied profile repair aligned 660 entry-year curriculum records;
new students are automatically assigned by program plus entry year, and the
student/profile and forecast APIs expose the enrolled curriculum name and
effective school year.

Analytics milestone: the Program Chair dashboard now separates official
`enrolled` headcount from workflow-status badges, uses a chronological line
trend, and provides selected-term, student-year-level, trend-school-year, and
trend-semester controls. The diagnostic view is accurately named a workflow
and grade-record readiness cross-tab; it no longer implies an unconfigured
retention/pass-rate rule. Predictive views label every forecast with its
curriculum.

Verification milestone: focused Laravel coverage passed 41 tests / 244
assertions across cohort forecasting, draft creation, curriculum repair and
student provisioning, analytics, and schedule-generation endpoints. ML Ruff,
mypy, and predictor tests passed (3 tests); targeted Laravel Pint passed;
frontend TypeScript and focused analytics/chart Vitest suites passed (6 and 5
tests respectively). A targeted frontend ESLint command exceeded the local
64-second tool window without diagnostic output, so it is not recorded as a
passing lint check. `git diff --check` completed without whitespace errors.
No commit or push was made. Local demand forecasting for multiple curricula
remains blocked until a database administrator applies the pending migration
with MariaDB `ALTER` privilege.

Post-implementation failure report: the Program Chair interface displayed a
failed Demand Forecast run with zero training observations. Root-cause
investigation is in progress before any new code change. Evidence collection
will compare the persisted schedule-generation run/error, Laravel logs,
pending migration state, and local ML-service health so the failing component
is identified rather than masked by another fallback.

Root cause confirmed: failed run 75 (and the later run 77) reaches the ML
service successfully, then fails while persisting forecasts because the local
database still has `section_demand_forecasts_run_term_subject_unique` on
`(prediction_run_id, academic_term_id, subject_id)`. A subject shared by old
and current curricula therefore produces a duplicate-key exception instead of
two legitimate curriculum-cohort forecasts. The replacement migration
`2026_08_15_000001_scope_section_demand_forecasts_to_curriculum_cohort` is
still Pending and the app DB account lacks `ALTER`; the only functional fix is
to apply it using an authorized MariaDB administrator account. ML port 8100
was healthy during diagnosis, so restarting ML will not fix this error.

User authorized applying the repair. A read-only local XAMPP MariaDB check
confirmed that the administrator account is available as `root@localhost`.
The exact pending migration target has been re-verified; only
`2026_08_15_000001_scope_section_demand_forecasts_to_curriculum_cohort` will
be run under that one-shot administrator environment, not any unrelated
pending migration.

Repair completed and verified: the exact migration was applied with the
one-shot local administrator environment and is now `Ran` in batch 3; the
application `.env` was not edited. The normal generation Action was retried
for the latest failed run and completed successfully: schedule run 78 is
`succeeded`, with prediction run 81, 129 persisted curriculum-aware forecasts,
and 14 section plans. The live table now has the five-column
`section_demand_forecasts_cohort_unique` key. The 70 remaining run warnings
are advisory follow-up items only (8 incomplete schedule metadata, 19
incomplete room metadata, 43 faculty-unavailable); none are forecast or
database failures. Final whitespace and migration-status checks passed. No
commit or push was made.

New analytics UI request: replace single trend-school-year selection with an
accessible dual-handle school-year range control (no calendar), remove the
Diagnostic tab, and compact long Predictive/Prescriptive/rationale details.
The selected range will be a true analytics scope for enrollment totals and
trend data; the separately selected forecast term remains the source for the
single-term predictive schedule run.

Analytics range/compaction milestone: the single-year trend control is now an
accessible dual-handle school-year slider. Its inclusive start/end range is
sent to the v1 analytics endpoint and scopes the official enrollment count,
workflow-status summary, and enrollment trend below it. The Diagnostic tab was
removed. Predictive forecast rows, prescriptive action details, and the Demand
Forecast dialog's subject-level section explanations are now expandable,
bounded panels so long result sets do not make the page or dialog scroll
excessively. Regression evidence: range scope test passed (6 assertions), the
full analytics action suite passed (10 tests / 86 assertions), frontend
TypeScript passed, and focused analytics/dialog Vitest passed (2 files / 7
tests). Targeted Prettier and PHP Pint checks passed; no commit or push was
made.


## 2026-08-09 — Five-plan dataset and IT control implementation preflight

Session started to execute, strictly in order, the five approved plans linked
from `docs/superpowers/specs/2026-08-09-grc-dataset-and-it-control-design.md`.
Before feature changes, the execution workflow, PRD, existing progress record,
design specification, and all plan constraints are being reviewed. The normal
`main` checkout has a pre-existing untracked `grades-com-student1.png`; it is
out of scope and will remain untouched. No commit or push is authorized.

Preflight identified two execution controls before implementation may start:
the mandated worktree workflow requires consent to create an isolated
workspace from this normal `main` checkout, and Plan 2 asks for a commit while
the repository instruction prohibits commits without an explicit user request.
No feature code, schema, seed data, or unrelated file has been changed.

User decision: proceed directly on `main` without a worktree and honor any
plan checkbox that requires a commit. The pre-existing untracked image remains
out of scope. Implementation will use the required task-by-task TDD and review
workflow, with the five plans kept in their documented order.

Plan 1 / Task 1 started: the first change is constrained to the faculty catalog
Zod contract and its regression coverage, using a `1.5`-unit catalog fixture
to reproduce the reported Availability Preferences parsing failure before the
schema is widened. The task is under independent TDD and review control.

Task 1 RED investigation: the plan's default focused Vitest command hung
before running any worker under this machine's default config bundler. The
non-mutating `--configLoader runner` fallback completed and showed the intended
failure: the fractional `1.5`-unit fixture causes the catalog envelope to be
rejected, leaving the Curriculum combobox disabled and rendering the generic
faculty-input error. Two legacy fixture-label assertions also need test-only
updates so the RED result remains isolated. The plan-named backend catalog test
file is absent; a dedicated endpoint regression test will be created at that
documented path rather than changing an unrelated test. No production schema
change has yet been made.

Task 1 frontend GREEN: the minimal contract change accepts non-negative
fractional units and the focused workspace suite passes 4/4 with the local
config-loader workaround. The new backend regression test is written but its
focused PHPUnit process exceeds the interactive 64-second tool window before
emitting output; it will be monitored as a background process to obtain a
complete terminal result before any commit or task-completion claim.

Task 1 verification evidence: the monitored backend regression completed
successfully in 37.875s (1 test, 4 assertions). The focused frontend suite
passes 4/4 with `--configLoader runner`; the default config loader remains a
local test-runner timeout before test collection. The scoped implementation
and regression tests were committed as `9c4b50d` and are now under a separate
task-level spec/quality review; no completion claim is made until that review
returns clean.

Task 1 review finding: the fractional-unit endpoint regression seeded `LEAD 1`
without its required college scope, and its report retained contradictory
timeout/commit statements after the monitored PHPUnit pass. The original
implementer is correcting the CCS-scoped fixture, removing an unused term
fixture, and reconciling the report before a scoped re-review. No next task
will start until this review loop closes.

Task 1 fix-round review is clean: the backend subject fixture is explicitly
CCS-scoped, the unused term fixture is removed, and the report history is
reconciled. Fresh controller-side focused frontend/backend verification is now
running before the ledger is marked complete and Task 2 begins.

Task 1 complete: controller-side focused checks confirmed the frontend suite
passes 4/4 (with the existing jsdom canvas notice) and the new backend catalog
regression passes (1 test, 4 assertions, 38.183s). The task-level review and
scoped re-review are clean; commits are `9c4b50d` and `ac6b3f9`. Plan 1 Task 2
is the next ordered slice.

Plan 1 / Task 2 started: availability will become a reusable faculty profile
through a reversible migration, with `academic_term_id` removed and Sunday
excluded. Endpoint tests must be observed failing before schema/action/request
changes; consumers and local/test-only seeders will then be updated in the
same task before the focused scheduling gate.

Task 2 checkpoint: endpoint RED was observed, then backend endpoint GREEN
passed (9 tests, 27 assertions) and the broader availability/load/scheduling
gate passed (87 tests, 365 assertions) through a Windows-safe direct PHPUnit
entry point because the `.bat` wrapper misparsed the literal pipe filter.
Focused frontend Vitest passed (10 tests; known jsdom canvas notice). The
required TypeScript command emits no diagnostic but exceeds the interactive
64-second window, so it is being monitored in the background before any
completion or commit claim.

Task 2 TypeScript result: the monitored compiler exposes two pre-existing
Vitest mock-signature errors in `curriculum-subject-row-dialog.test.tsx` and
one new availability-contract consumer error at
`faculty-assignment-workspace.tsx:85`. Root cause is verified: the workspace
still filters availability by the removed term id even though availability is
now a reusable profile. A test-first, minimal consumer correction is in
progress; the unrelated pre-existing errors will be reported accurately rather
than modified outside this task's scope.

Task 2 review blocker: the old unique key permits the same professor/day/start
slot in multiple terms, while the new reusable-profile key does not; the plan
does not prescribe whether a migration must fail safely or deterministically
reconcile such rows. Separately, Task 2's explicitly required uniqueness rule
checks only `origin='declared'`, while Task 3 is the planned slice that deletes
an overlapping `workbook_seeded` row before insertion. Pulling that fix into
Task 2 would violate the requested plan order; leaving it creates a temporary
database-constraint mismatch. User direction is required before the Task 2
review loop can continue. A minor frontend shortcut focus regression is also
open and can be fixed once the task resumes.

User decision: proceed with the review recommendations. Task 2 will add a
fail-safe migration collision precheck without silently deleting or merging
valid legacy availability rows. The workbook-seeded slot replacement stays in
Task 3 as the approved ordered plan requires; its temporary Task 2 mismatch is
an explicitly authorized deferral. The removed-field shortcut focus regression
will also be corrected test-first before scoped re-review.

Task 2 fix-round re-review approved the collision precheck and restored focus
behavior. The user-authorized Task 3 deferral was respected without a workaround
or scope pull-forward. Fresh controller-side backend/frontend/typecheck evidence
is running before the task ledger is marked complete.

Task 2 fresh verification: backend availability/load/scheduling coverage passes
(88 tests, 370 assertions; six non-failing PHPUnit deprecations) and the
focused frontend set passes (16 tests; known jsdom canvas notices). The required
repository-wide `npx tsc --noEmit` still fails only at the pre-existing mock
typing errors in `curriculum-subject-row-dialog.test.tsx:43` and `:47`; no Task
2 diagnostic remains. Because that file is outside these five plans and the
user directed that unrelated files remain untouched, Task 2 cannot be marked
complete or followed by Task 3 without an explicit decision to repair those
test typings or to accept the documented gate blocker.

User authorization received: make only the minimal, type-safe Vitest mock
signature repair in `curriculum-subject-row-dialog.test.tsx`, solely to clear
the required repository TypeScript gate. The existing component behavior tests
remain the contract; no production behavior or additional unrelated files are
in scope for this corrective slice.

TypeScript-gate correction complete and pending scoped re-review: dialog test
mocks now derive their concrete callback signatures from the component props;
the focused Vitest suite passes 4/4 and `npx tsc --noEmit` exits 0 with no
diagnostics. Commit `df8ce8e` changes only that user-authorized test file.

Plan 1 Task 2 complete: the original implementation, its safety/focus fix
round, and the user-authorized test-typing correction all passed independent
scoped reviews. Final task evidence is backend 88 tests/370 assertions,
focused frontend 16 tests, and repository `npx tsc --noEmit` exit 0. The next
ordered slice is Plan 1 Task 3; the pre-existing image remains untouched.

Plan 1 Task 3 started: first-use collisions will be handled only in the
existing faculty availability/preference create paths. Tests must first show a
declared slot cannot replace its workbook-seeded counterpart and an omitted
preference rank is rejected; then the minimal transactional/defaulting fixes
and visible availability day-field error will be verified.

Plan 1 Task 3 implementation is pending independent review at commit
`8fbf96f`: RED exposed a seeded-slot composite-key 500, a required omitted
rank, and a missing rendered day-field error. Focused backend and frontend
GREEN gates pass. Scoped ESLint has no errors, but one existing React Compiler
warning in the workspace prevents a zero-warning global lint run and is
recorded for the planned UI work rather than hidden.

Plan 1 Task 3 complete: independent review confirms the transaction deletes
only the actor-owned matching `workbook_seeded` slot; default rank is scoped to
professor/curriculum/semester; and the real API field-error envelope is visible
in the workspace. Commit `8fbf96f` is cleanly reviewed. Plan 1 Task 4 is next.

Plan 1 Task 4 started: add the reversible `faculty_specializations` capability
model and its actor-owned, audited API. The endpoint test must fail for the
absent route before any migration/controller/action implementation; the exact
API surface list will be updated in the same scoped commit.

Plan 1 Task 4 implementation is pending independent review at `048ec88`.
Endpoint coverage is green (4 tests/25 assertions) and the exact API-surface
suite is green (22 tests/241 assertions). A seeming cross-owner DELETE success
was proven to be Laravel test-client guard caching; the test now uses the
repository’s established guard reset and verifies the real policy denial.

Plan 1 Task 4 complete: independent review confirms the specialization schema,
exhaustive proficiency enum, college-scoped validation, actor ownership,
transactional audit behavior, route placement, and API-surface reconciliation.
Commit `048ec88` is clean. Plan 1 Task 5 is next.

Plan 1 Task 5 started: a test will first prove that a primary specialization
outranks a bare higher-ranked preference, then the new reversible recommendation
column, eager-loaded scoring signal, and resource contract will be implemented.
Faculty without specialization must retain their existing ordering behavior.

Plan 1 Task 5 implementation is pending independent review at `2098ef0`.
Primary-over-bare and secondary equal-rank scoring regressions are green, as is
the reversible migration down/up verification. The current app has no
assignment-recommendation endpoint/resource consumer; per the listed Task 5
scope, no new endpoint was invented—the persisted generator result and direct
resource serialization are covered instead. Repo-wide Pint/PHPStan retain
unrelated pre-existing blockers, while task-file checks are clean.

Plan 1 Task 5 complete: independent review confirms the migration/model/resource
contract, batched specialization lookup, and deterministic primary/secondary
scoring. The no-endpoint decision is correct for the documented existing API
surface and listed scope. Commit `2098ef0` is clean. Plan 1 Task 6 is next.

Plan 1 Task 6 started: the Faculty Input workspace will be extracted into the
approved three-tab shell and two bounded panels, with specialization management
inside Subject preferences. The existing React Compiler warning is now inside
the intended refactor scope and must be removed so the task’s full frontend
lint/type/test gate can actually pass. Existing in-repo shadcn components will
be composed; the local upstream Tabs documentation lookup timed out without
changing dependencies or source files.

Task 6 structural clarification: the approved Subject Preferences requirements
(form, filtered preference table/edit-delete flow, and declared-specialization
list/delete flow) exceed the plan’s roughly 400-line source-file constraint in
one component. A single internal `faculty-specialization-list.tsx` child is
authorized solely to keep `FacultySubjectPreferencePanel` bounded; it adds no
endpoint, dependency, or user workflow and remains owned by that panel.

Plan 1 Task 6 implementation is ready but intentionally uncommitted pending
the plan's full frontend gate. Its focused 3-file/7-test suite, TypeScript,
Prettier, and diff checks pass; the former workspace React Compiler warning is
fixed. Full lint still reports 9 errors/1 warning only in unrelated existing
files, and full Vitest reports 12 unrelated failed suites/22 tests. Per scope
rules, those files have not been changed; explicit user authorization is needed
to repair them before Task 6 can be committed/reviewed and Plan 1 can advance.

User authorization received to make the minimal repairs necessary to clear
those full-gate blockers. Root-cause investigation will distinguish test-runner
contention or stale fixtures from genuine product defects before changing any
unrelated file. No broader refactor, dependency change, or behavior expansion
is authorized.

After the literal full frontend gate turned green, the Task 6 source-size audit
found `FacultySubjectPreferencePanel` at 422 formatted lines, above the plan's
roughly-400 target. A second internal, presentational
`faculty-subject-preference-form.tsx` child is authorized solely to move form
rendering while the parent retains form state/mutations/ownership. It adds no
API, workflow, dependency, or behavior; the full gate must be rerun after it.

Fresh controller verification after the final extraction is terminal green:
the literal `npm run lint && npx tsc --noEmit && npm run test` chain reached
`102` passing Vitest files and `631` passing tests. TypeScript must have passed
because the shell's `&&` reached the test command; the existing non-failing
jsdom canvas notices remain. The scoped Task 6/gate-repair commit is now ready
for independent review.

Plan 1 Task 6 complete: commit `2444dcf` cleanly passed independent review.
The exact full frontend gate remains green (102 files/631 tests), and the
approved tabs/panel boundaries, strict specialization service contracts, and
minimal root-cause-backed gate repairs were all verified. Plan 1 Task 7 is next.

Plan 1 Task 7 started: the existing workbook faculty seeder will be extended
test-first for deterministic, complete reusable availability, ranked preference,
and specialization profiles. It must retain the local/testing guard, preserve
declared records, use college-scoped subjects, give Coaches/Unidentified only
PE/NSTP/general-education subjects, and never create Sunday availability.

Task 7 data constraint: one archived Teacher Certificate semester contains only
three unique `curriculum_subjects`, while the planned 5–8 preference target is
incompatible with the preference unique key and source-placement requirement.
The seeder will preserve institutional data and seed all available rows
(`min(5, available)`) for this exceptional semester; it will not fabricate
subjects or use off-curriculum rows. This exception will be documented in the
task report and verification results.

Plan 1 Task 7 complete: commits `6942333` (unrelated 3-file Pint formatting
fix, user-approved) and `84779ea` (the seeder work itself). A PHPStan-driven
refactor of `loadReferenceData()`'s slot-grouping logic fixed 6 errors the
original diff introduced (root cause, not suppressed); re-verified 0 net-new
errors against an isolated pre-Task-7 baseline. Full backend PHPUnit
(1182 tests/37927 assertions, 4 errors/15 failures) confirmed pre-existing
and unrelated to Task 7 via structural isolation and a direct baseline diff.
`migrate:fresh --seed` required `--database=mariadb_migrator` (the app's
`grc_app` user is intentionally DML-only); exit 0, all seeders DONE. Task 7
independent review: Approved, 3 Minor findings deferred.

Plan 1 final whole-branch review (all 7 tasks, opus): "Ready to merge: With
fixes" — 5 Important findings, all independently re-verified before the fix
was dispatched. The most consequential: the Task 7 seeder was deleting the
real workbook-CSV-derived availability/preferences within the same run that
had just written them, silently replacing real teaching evidence with
synthetic hash-derived data; and `UpdateFacultyAvailability` was missing the
seeded-slot-replacement `CreateFacultyAvailability` already had, so editing a
declared availability onto a still-seeded slot (common for full-time
professors, seeded Mon–Fri 08:00) raised a 500. A single fix-wave commit
(`6c41575`) addressed all 5; a scoped re-review confirmed all ADDRESSED with
no new breakage, and independently verified the seeder fix's side effect (a
relaxed test upper-bound) is a correction, not a weakening. Post-fix full
gates re-run clean: Pint, PHPStan (95 pre-existing errors, unchanged),
PHPUnit (1184 tests/37931 assertions, same 19 pre-existing failures, 0 new),
`migrate:fresh --seed` (exit 0), and the full frontend gate (ESLint clean,
`tsc --noEmit` clean, Vitest 634/634 passing — the first full run showed 17
failures that were pure resource-contention timeouts in this constrained
session, none in fix-wave-touched files, and all 17 passed on isolated
re-run). Manual UI verification from the plan's checklist was not possible
(no live Chrome extension in this background session); data-layer spot
checks via direct DB queries confirmed full-time = 5 availability rows,
part-time = 3, zero Sunday rows system-wide, Coaches/Unidentified = 0
curriculum preferences with 4–10 specializations, and 557 total faculty.

**Plan 1 complete.** All 7 tasks done, reviewed, and gate-verified on `main`.
Starting Plan 2 next.

Plan 2 (Roster file) started and completed across 3 tasks: `StudentRosterMap`
(107 sections/3,210 students across COE/CBAE/COA/CCS, commit `409b317`),
`StudentIdentityGenerator` (deterministic crc32-derived student number/email/
name, commit `7b5af9a`), and the `students:generate-roster-file` artisan
command that writes `Subject And Prerequisuite/Students-Profile.md` (commit
`b1caf65`, DRY-violation fix `8198372`, `--check` CI-sync test `dd732ca`).
All 3 tasks independently reviewed Approved; final whole-branch review
(opus) independently re-parsed all 3,210 generated rows directly (not
sampled) and found 0 duplicate student numbers/emails, 0 entry-year
mismatches, 0 email-format deviations — verdict "Ready to merge: Yes."

Mid-Task-3 incident (resolved, not a code defect): a stalled implementer
subagent's abandoned background PHPUnit process raced the controller's own
full-gate run against the shared `grc_enrollment_test` database, leaving its
`migrations` table missing and producing a false spike of ~341 errors/38
failures on one read. Diagnosed as environmental, fixed by rebuilding the
test schema (`php artisan migrate:fresh --env=testing --force`); a clean
re-run confirmed the real baseline unchanged (4 errors/15 failures, all
pre-existing from Plan 1, 0 new).

**Note for Plan 3:** the 7 `EDUC1xx` COE first-year section codes
(`StudentRosterMap.php`, 210 students) do **not** round-trip through
`SectionBlockCode::coePrefix()` — `BEED`/`BSED-ENG`/etc. resolve to
`ELEM`/`ENG`/etc., never back to `EDUC`. This is deliberate (documented in
`StudentRosterMap.php`'s class docblock and in the plan itself) and nothing
to fix in Plan 2, but Plan 3 resolves roster rows against real sections and
must not match these 210 students by generated block code, or they will
silently find no section — and `EDUC104`/`EDUC105` (`BSED-ENG`) would
conceptually collide with the `ENG101`/`ENG102` `SectionBlockCode` produces
for the same cohort.

**Plan 2 complete.** All 3 tasks done, reviewed, gate-verified, final review
clean after one fix round. Starting Plan 3 next.

Plan 3 (Student Accounts and Academic History Seed) started and completed
across 5 tasks, all landing as extensions to `StudentRosterSeeder.php`
(commits `34409d9`, `2d23e8e`+`24a5d38`, `9ab36a4`, `bb11e8f`+`a6ae84e`,
`76b818a`+`4f464a3`, final-review fix `0c2d275`), except Task 5 which added
new files (`DeriveSectionDemandObservations` action + console command).

Pre-flight scan found the plan's "under five minutes for `migrate:fresh --seed`"
target was already unattainable before this plan started (pre-existing
seeding phase alone ≈5.5-6 min, dominated by `CatalogFacultySeeder`'s ~3
min, unrelated to any of the 5 plans). User directed: report real timing,
don't chase the target, don't expand scope into optimizing unrelated
seeders.

Three serious cross-task defects were caught by review and fixed before
merge:
- **Task 2**: the original design generated exactly one 40-seat block per
  cohort per historical term regardless of real headcount, undershooting
  the plan's own ~5,000-section estimate (landed at 2,147). Fixed by
  scaling to `ceil(headcount/40)` blocks — real count settled at 3,966.
- **Task 3 + 4**: Task 3's grade distribution gave every graded subject an
  independent 10% failure chance; combined with the real, unmodified
  `EnrollmentCategoryClassifier`'s zero-threshold "any single failure =
  irregular" rule, this compounded to ~96% organic irregularity at real
  curriculum scale, swamping Task 4's correctly-built 10%-selection
  mechanism and contradicting the plan's own ~320-student expectation.
  Fixed by making Task 3's baseline grades clean/passing-only — only
  Task 4's deliberately-selected cohort ever gets a failing mark. Real
  rate after the fix: 228/2,289 eligible students = 9.96%.
- **Task 5**: the demand-observation aggregation grouped by each student's
  CURRENT year level instead of the historically-correct year level Task 2
  already computes and stores — silently making nearly every
  historical-term observation invisible to its real consumer
  (`GenerateSectionDemandForecasts`) while corrupting unrelated synthetic
  rows. Fixed by re-sourcing the join through
  `sections → academic_term_section_plans → curricula → programs`.

The final whole-branch review (opus) additionally found and fixed, in one
follow-up commit: Task 4's irregular-selection wasn't scoped to the roster
it parsed and was silently converting a `DemoEnrollmentSeeder` demo account
documented as Regular into Irregular; the historical-term walk had no
term-status filter (a `semester_ongoing` term re-seed could fabricate
locked grades on live data); no test directly pinned the Task 3/4
clean-baseline invariant; and the demand-observation aggregation excluded
zero-enrollment sections from its capacity/section counts. All four fixed
with new regression tests, independently re-verified.

This environment has a confirmed hard external process kill on any
long-running `vendor/bin/phpunit` invocation (unrelated to test volume —
confirmed by testing even a 15-file subset), so a single continuous
full-suite run was not achievable this session despite ~10 attempts with
various splitting strategies. Full coverage was instead assembled from
multiple completed sub-runs, with 0 new failures found anywhere against
the 19 pre-existing failures already established at the end of Plan 1.

Final real `migrate:fresh --database=mariadb_migrator --seed` (`grc_app`
is intentionally DML-only; the migrator connection has DDL privileges):
exit 0. `student_profiles`/`users(role=student)` = 3,220; `enrollments` =
11,956; `academic_grades(status=locked)` = 127,550; `sections(status=closed)`
= 3,966; `section_demand_observations(source=derived_from_enrollments)` =
1,490. `enrollment_category` stays null on a fresh seed by design (the
current term is `semester_closed`, not `semester_ongoing`) — the plan's
manual-verification step 4 (`php artisan students:reclassify` after the
Registrar Head opens the next term) is a separate, not-yet-exercised manual
step.

**Plan 3 complete.** All 5 tasks done, reviewed, gate-verified, final review
clean after one fix round.

## 2026-08-11 — Plan 4 independent final-fix verification handoff

Resumed from the supplied Claude handoff directly on the user-authorized
`main` checkout. Plans 1–3 are already complete; Plan 4 is paused only for an
independent verification of commit `41c2f2e` before it is closed. The existing
unstaged `PROGRESS.md` and untracked `grades-com-student1.png` remain out of
scope and will not be staged. Verification will cover irregular-student
preference reachability, the workspace line constraint/extraction, scorer
null-hardening, and no-Sunday filter vocabulary before Plan 5 begins.

The first combined Plan 4 backend verification attempt (`pint --dirty`, scoped
PHPStan, then scorer PHPUnit) exceeded the external 124-second command limit
without a terminal result. It is not recorded as passing; the independent
checks are being rerun separately with monitored output.

Independent Plan 4 final-fix review found one Important integration-test gap:
the shared irregular enrollment-route mock still returns an invalid empty
payload for the newly mounted schedule-preference query, silently putting that
panel into an error state during irregular filter/sort tests. The direct
frontend verifier likewise exceeded the 124-second command limit without a
terminal result. Plan 4 remains open for a focused test-first fixture/comment
repair and scoped re-review; no Plan 5 work has begun.

Plan 4 complete after final fix round: commit `3b2f03d` makes the shared
irregular test route return the complete schedule-preference envelope and adds
a real irregular-panel loading assertion; its stale composition comment is
also corrected. Independent scoped re-review approved the fix. Fresh evidence:
scorer PHPUnit 2/2, scoped backend Pint/PHPStan, targeted frontend ESLint,
TypeScript, and the three affected frontend suites (31 tests) all pass. The
plan's browser/manual enrollment flow remains a human verification item; Plan
5 may now begin in the documented order.

## 2026-08-11 — Plan 5 IT Control Portal started

Plan 4's final fix is independently verified and closed. Plan 5 begins on the
user-authorized `main` checkout with a dedicated SDD ledger. The `it_admin`
role will be introduced end to end first; its intentionally temporary frontend
exhaustive-map errors are owned by Plan 5 Task 3 and cannot be treated as a
final quality-gate exception. The existing unstaged tracker and untracked image
remain out of scope.

Plan 5 Task 1 started: add the IT Control role and local/test-only identity
through the backend catalog, seed fixture, strict frontend role feed, e2e
fixture, and identity documentation. The backend regression will be observed
RED before implementation. `PROGRESS.md` remains intentionally unstaged.

Plan 5 Task 1 RED verification is starting with only the UserRole and
RoleUserSeeder test classes. No production role or seed-fixture code has been
changed yet.

The documented Windows `.bat` PHPUnit wrapper misparsed the literal
`UserRole|RoleUserSeeder` filter as a shell pipe before test collection. The
same focused filter will be rerun through PHPUnit's PHP entrypoint; this is a
command-wrapper workaround, not a test result.

That combined focused run exceeded the local 64-second execution window before
returning test output. The isolated UserRole unit regression will provide the
required RED evidence; the slower seeder suite will be verified after the
minimal implementation.

Task 1 backend catalog RED is confirmed: `UserRoleTest` reports the missing
`it_admin` value and its dedicated catalog assertion fails because the enum
case is absent (5 tests, 11 assertions, 2 expected failures). A focused seed
identity assertion is being added and will be observed RED before the enum and
deterministic seed-map implementation.

Task 1 seed-fixture RED is confirmed: the exact IT Control identity assertion
fails after 22.063 seconds because only the original nine seeded rows exist.
The minimal implementation now adds only `UserRole::ItAdmin`, its exhaustive
label and learner-scope match arms, and the same-slug deterministic seed map
entry.

Task 1 backend GREEN verification is starting with the isolated enum catalog
and exact seeded-identity regressions, followed by the existing role-matrix
coverage without weakening its data providers.

Task 1 targeted backend GREEN is confirmed: `UserRoleTest` passes (5 tests,
14 assertions), and the exact IT Control seed identity passes (1 test, 1
assertion). PHPUnit reports its existing six non-failing deprecations for the
database test. The complete seeder class and untouched role-matrix suites are
next.

The complete `RoleUserSeederTest` class is GREEN (12 tests, 75 assertions).
Ten existing test files derive their matrices from `UserRole::cases()`; none
will be weakened. The frontend, e2e, and documentation mirrors are now being
updated before the untouched denial matrices and the required TypeScript gate
are run.

The strict frontend role array, e2e `SeedRole` union/map, and seeded-identity
table now include `it_admin` / `it.control@grc.test`. The required TypeScript
check is starting; the only expected temporary failures are Task 3-owned
exhaustive `Record<UserRole, ...>` maps.

The required `npx tsc --noEmit` fails as expected after 20.8 seconds: Task
3-owned exhaustive role maps lack `it_admin` in `role-capabilities.ts` and
`scheduling-service.ts`, with the corresponding capabilities contract test
also reporting the missing key. No Task 3 module/API-map file will be changed
in Task 1. Existing backend role-matrix denial datasets are now being run for
the new role without altering their providers.

Matrix inspection confirms that eight endpoint providers automatically name an
`it_admin` denial dataset from `UserRole::cases()`, while three policy tests
loop over the same enum at runtime. The unchanged providers and policy classes
are being executed now to prove the default least-privilege denial.

The existing endpoint matrices are GREEN for `it_admin`: six denial datasets
pass with 13 assertions (and five existing non-failing PHPUnit deprecations).
The three loop-based policy classes are next; they are run separately because
their test names do not include the data-set label.

All three unchanged policy loops are GREEN (7 tests, 54 assertions), including
their runtime `it_admin` denial assertions. The plan-required full backend
PHPUnit attempt is starting in a monitored process. It will be allowed to
reach the known external 9–10 minute hard-kill behavior if necessary; the
previously established 19 unrelated baseline failures will not be fixed in
this Task 1 scope.

The full PHPUnit attempt did not reach a terminal result: after 12m24s wall
time and 351.69 CPU seconds, it remained buffered at 976/1247 tests (78%) for
about nine minutes while emitting only known baseline failure markers. This is
a stuck-run variant of the documented time-limit behavior, not a pass or a
new Task 1 failure. The exact monitored PHPUnit process is being stopped under
the handoff procedure; completed focused/role-matrix checks are supplementary
verification only.

The exact stuck PHPUnit PID was stopped; no other process was touched. The
ignored Task 1 report records this explicitly as a non-terminal, non-passing
full-suite attempt and does not claim confirmation of the 19-failure baseline.
Final Task 1 verification is now rerunning the two changed backend test
classes, scoped Pint, and whitespace/scope checks before staging only the
listed source, test, frontend, e2e, and documentation files.

The final combined backend rerun exceeded the local 64-second command window
before returning output, so it is not recorded as passing. Earlier completed
Task 1 GREEN evidence remains the UserRole unit class (5/14) and complete
RoleUserSeeder class (12/75). Residual test processes are being checked before
the non-database scoped Pint/whitespace verification is rerun separately.

Scoped Pint passes. A documentation EOF blank line introduced while undoing an
accidental formatter-wide expansion was removed; the documentation and e2e
diffs now contain only the requested IT Control additions. Final scope and
whitespace checks are running before the Task 1-only commit.

Plan 5 Task 1 committed on `main` as `e122344`
(`feat(identity): add IT Control role`). The commit contains exactly the seven
listed backend/frontend/e2e/documentation files. `PROGRESS.md`, the ignored
Task 1 report, and the pre-existing `grades-com-student1.png` remain unstaged.
Task-local RED/GREEN evidence is complete; the full backend-suite attempt and
final combined rerun are both explicitly non-terminal in the report, while
the Task 3-owned TypeScript map errors remain intentionally deferred.

Plan 5 Task 1 review fix round 1 started. The review correctly identifies that
the brief's exact focused `UserRole|RoleUserSeeder` GREEN command was not yet
captured as a terminal result, and that the seeded-identity wording still
implies the PRD's nine primary roles. The exact Windows command is being run
first; its direct PHPUnit fallback is authorized only if the `.bat` wrapper
again parses the literal pipe as a shell operator. The full-suite diagnosis
remains non-terminal and will not be rewritten as a pass.

The `.bat` wrapper did repeat the expected Windows pipe-parsing failure before
test collection (`RoleUserSeeder` treated as a shell command). No residual
PHPUnit worker is running; the equivalent direct PHPUnit filter is now being
run for a terminal focused GREEN result.

The direct equivalent of the brief's exact focused filter is terminal GREEN:
17 tests / 89 assertions in 23.136 seconds, with six non-failing PHPUnit
deprecations. No documentation contract test exists, so the seeded identity
introduction is minimally corrected to say "One per supported role" rather
than implying that the additional IT Control role is a PRD primary role. The
full-suite record remains explicitly non-terminal and non-passing.

Plan 5 Task 1 review fix round 1 committed as `e770482`
(`docs(testing): clarify supported seeded roles`). It contains only the
approved wording correction. The ignored Task 1 report contains the terminal
17-test focused GREEN output, preserves the original narrower RED evidence,
and retains the accurate non-terminal full-suite diagnosis. `PROGRESS.md` and
the pre-existing image remain unstaged.

Plan 5 Task 1 review fix round 2 started. No product or test behavior will be
changed unless a bounded diagnosis identifies a Task 1 regression. The prior
full-run log contains only progress dots through 976/1247, so PHPUnit's test
list will be used read-only to locate the order boundary before reproducing
only the suspected nearby test(s) under a bounded monitored command.

The test-list boundary maps the 976th test to
`AnalyticsSubstrateMigrationTest::test_analytics_indexes_have_the_approved_ordered_columns_and_uniqueness`;
the next check-constraint assertion is the first candidate after the buffered
full-run progress line. The entire pre-existing migration-test class is being
run alone under the normal bounded command window to distinguish a local class
hang from a Task 1 regression.

That complete AnalyticsSubstrate migration class is terminal GREEN (20 tests,
59 assertions, 20.456 seconds), so it is not the source of the monolithic
stall. Counting the final unnumbered progress line reveals 58 more completed
tests after 976; the first uncompleted ordered test is the `0006 year 2
irregular (incomplete)` dataset in the pre-existing `DemoEnrollmentSeederTest`.
That exact dataset is now being reproduced in an isolated monitored process
with a three-minute bound. No Task 1 file is implicated or being changed.

The exact suspected DemoEnrollment dataset is terminal GREEN (1 test, 3
assertions, 2m11.682s), not hung. Its duration explains the monolithic run's
buffered progress appearance: it is the first test after 1,034 completions,
and several expensive datasets must finish before PHPUnit emits its next
61-test progress marker. A bounded terminal Unit partition is running next as
supplementary suite evidence; no new monolithic run or unrelated repair is
authorized.

The bounded Unit partition completed terminally in 46.564 seconds (334 tests,
844 assertions) with two known, unrelated AuditVocabulary expectation failures
and one PHPUnit deprecation. `DemoEnrollmentSeederTest` alone contains 35
tests; the representative terminal dataset takes 2m11.682s, so an exhaustive
Demo shard is conservatively about 77 minutes and is not a safe verification
command. A separate bounded Feature Policy partition is running instead for
additional terminal evidence.

The bounded Feature Policy partition is terminal GREEN (53 tests, 149
assertions, 26.141 seconds). The full-run diagnosis is now concrete: the
captured final unnumbered segment shows 1,034 completed tests, with the next
DemoEnrollment dataset completing terminally but taking 2m11.682s; buffered
progress and expensive seeding, not a Task 1 defect, explain the apparent
stall. The ignored Task 1 report records the exact commands, results, known
two-failure Unit outcome, and the realistic partition/shard strategy. No
source/test file changed, so no commit is created in this diagnostic round.

Task 1 remains open after scoped re-review: the focused direct PHPUnit
equivalent is terminal green (17 tests / 89 assertions), and the supported-role
documentation wording is corrected, but the mandated full backend PHPUnit run
is still non-terminal at 976/1247. The next fix round is limited to diagnosing
that suite-level hang or obtaining a terminal equivalent; no unrelated
baseline-failure repair is authorized.

Task 1 full-suite diagnostic is now concrete: the buffered monolithic output
had 1,034 completed tests, and the next `DemoEnrollmentSeederTest` scenario
passes alone but takes 2m11.682s. Its 35 scenarios project to roughly 77
minutes, exceeding the local external-run budget; therefore the apparent
freeze is neither a Task 1 regression nor a deadlock. Terminal partitions show
`tests/Unit` at 334 tests/844 assertions with two pre-existing AuditVocabulary
failures, and `tests/Feature/Policies` green at 53 tests/149 assertions. No
PHPUnit process remains. This diagnostic and the terminal exact 17-test Task 1
gate are awaiting final scoped re-review; no unrelated baseline code changed.

Plan 5 Task 1 is independently complete: commits `e122344` and `e770482`
add the exhaustive `it_admin` enum, deterministic local/test seed identity,
strict frontend/e2e role contract, and corrected identity documentation. The
terminal direct role/seeder gate passes 17 tests / 89 assertions. Review also
accepts the full-suite diagnosis (buffered, expensive seed datasets rather than
a Task 1 deadlock); the historical baseline is explicitly not claimed green.
Task 2 may now begin with the IT-admin-only account browser endpoints.

Plan 5 Task 2 is independently complete: commits `8347491` and `f49a16b`
add paginated, cache-protected IT-admin-only student and faculty account
browsers with Form Requests, Actions, Resources, Gate defense in depth, and
exact API-surface coverage. The focused API gate passes 46 tests / 334
assertions; Pint and whitespace checks pass. The second commit removes the
scratch TDD report from Git tracking while preserving it locally. Task 3 may
now own the exhaustive IT-admin frontend maps and browser modules.

Plan 5 Task 3 review fix is awaiting scoped re-review. Systematic diagnosis
showed Vitest's default parallel file execution exhausted the local runner:
the affected suites passed alone and the same broad target passed serially with
the existing 10-second per-test deadline. Commit `76b8ce0` sets only
`fileParallelism: false`; the required exact broad command now exits 0 with 63
files / 363 tests in 591.27 seconds. Focused tests, typecheck, ESLint,
Prettier, and diff checks are green; no product timeout was raised or hidden.

Plan 5 Task 3 is independently complete: commits `417d490`, `1ec2d2d`, and
`76b8ce0` add the ordered IT Control modules, strict browser contracts,
TanStack Query service/hooks, secure account browser screens, exhaustive
capability compatibility, and the root-cause-backed deterministic Vitest file
scheduling. The exact broad portal gate passes 63 files / 363 tests. Task 4
may now add durable automation-run tracking.

Plan 5 Task 4 is independently complete: commits `24e7e6e`, `7c864c4`, and
`948d9e5` add locally guarded durable automation tracking. Invalid production
writes now return 403 before validation; post-running exceptions persist a
terminal failure before rethrow, so queue retries cannot strand the dedupe lock.
Focused endpoints/jobs, API surface, Pint, targeted PHPStan, and testing-DB
reversibility are green. Task 5 may now connect the real audited actions.

Plan 4 final-fix implementation started directly on the user-authorized
`main` checkout. Scope is limited to making the shared irregular enrollment
mock return the complete schedule-preference envelope, proving the preference
panel loads through a focused RED/GREEN assertion, and correcting the panel's
stale wiring comment. `PROGRESS.md` remains intentionally unstaged; only the
task test/component/report files will enter the requested commit.

Plan 4 final-fix RED is confirmed. The new focused irregular-workspace test
failed because it could not find the real `Monday` preference checkbox (1
failed, 19 skipped). This reproduces the review finding: the shared irregular
route mock's catch-all returns `{ data: [] }`, which the strict preference
envelope rejects, so the panel silently remains in its error boundary while
the eligible-subject UI continues rendering.

Plan 4 final-fix focused GREEN is confirmed. `mockIrregularRoutes` now returns
the same complete `defaultSchedulePreference` envelope as the regular helper,
and the previously failing focused test passes (1 passed, 19 skipped). The
panel doc-comment now accurately states that it is composed above both the
regular section table and irregular subject flow. Broader workspace/panel
tests and scoped static checks are next.

Plan 4 final-fix broader frontend verification passes: the complete enrollment
workspace and schedule-preference panel suites report 2 files / 24 tests
passing. Vitest emitted only the repository's known non-failing jsdom canvas
notices. Scoped ESLint and the strict TypeScript compiler check are next.

Plan 4 final-fix static checks pass: targeted ESLint for the changed test and
component exits clean with zero warnings, and `npx tsc --noEmit` exits 0 with
no diagnostics. The final-fix report now records the exact RED/GREEN commands
and corrects its earlier claim that the shared irregular helper already used
the valid preference fixture. Final diff/scope review and a fresh verification
run remain before the scoped commit.

Plan 4 final-fix pre-commit verification is complete on the final code/test
tree: the two focused frontend files pass 24/24 tests, targeted ESLint remains
clean, strict TypeScript remains clean, and `git diff --check` reports no
whitespace errors. Only the workspace test and preference-panel component will
be staged; this progress ledger, the ignored `.superpowers` report, and the
pre-existing image remain outside the commit as explicitly required.

Plan 4 final-fix round committed directly to `main` as `3b2f03d`
(`test(enrollment): validate irregular preference panel loading`). The commit
contains exactly the two scoped frontend files. No route, API, product UI
behavior, deferred Plan 4 minor, `PROGRESS.md`, `.superpowers` artifact, or
image was committed or pushed.

## 2026-08-07 — Curriculum editor View-tab continuation

Session resumed from Claude's uncommitted frontend refinement for the
Curriculum Editor: keep the editor open with Manage/View tabs, make the View
tab browse published and archived curriculum versions, show prerequisite
badges, and keep Program Chair numeric section-count inputs clearable. The
working tree already contains this scoped frontend diff plus unrelated
untracked artifacts; no backend/API/auth changes are in scope until the
focused behavior is verified. No commit or push is authorized.

Focused baseline: the direct Curriculum View/Workspace and Program Chair
regression suite passed 3 files / 48 tests. TypeScript and targeted ESLint
were clean; Prettier identified style-only drift in five already-touched
files, which was formatted in place without changing unrelated files. A
fresh focused rerun and production build remain before handoff.

Post-format verification: the focused suite passed again at 3 files / 48
tests; TypeScript, targeted ESLint, Prettier check, and `git diff --check`
passed. The Next.js production build also passed, compiling the Tailwind v4
active-tab variant and all five routes. A full serial Vitest sweep is the
remaining broad regression check for the shared Tabs primitive.

Final verification: `npx vitest run --no-file-parallelism` passed with 90
files / 570 tests. The known non-fatal jsdom canvas notices were the only
runner output. No backend/API checks were needed for this frontend-only
continuation; no commit or push was made.

**Last updated:** 2026-08-06 · **PRD version:** v3.2 · **Branch:** `main`
at `314ace6` (Phase 7c and the grading/enrollment-completion slice — ADR
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

## 2026-08-06 — Enrollment UI, mobile responsiveness, and GRC branding

**Session start / approved scope:** The user approved the institutional-modern
redesign plan: align the public landing page with GRC's official identity,
replace all visible “Portal Overview” copy with **GRC Connect**, and improve
the responsive enrollment chain for Student, Program Chair, Dean, Executive
Director, Registrar Head, Registrar Staff, and Accounting. The `/portal`
route, bearer-token authentication, role authorization, enrollment states,
queue/payment idempotency, and all backend contracts remain unchanged.

**Preflight:** This checkout is the shared `main` branch at `314ace6` and
already contains unrelated uncommitted backend, documentation, E2E, and test
changes. The approved UI slice will touch only the relevant frontend files,
will preserve that existing work, and will not be committed or pushed. The
official white GRC logo will be stored locally rather than hotlinked; official
public copy and destinations are sourced from `https://grc.edu.ph/`.

**Focused baseline:** Before changing the landing or portal identity, ran
`npx vitest run src/features/components/pages/landing-page.test.tsx
src/features/components/pages/portal-overview-page.test.tsx
src/features/components/layouts/portal-shell.test.tsx --no-file-parallelism`
from `frontend/`: **3 files / 25 tests passed** (24.53s).

**TDD RED checkpoint:** Updated those three focused test files for the new
public GRC brand and GRC Connect contract, then re-ran the same command.
It failed as intended: **19 assertions failed / 6 remained green**, because
the current application still renders the old landing headline, text monogram,
“Portal overview” labels, API-readiness panel, and developer-oriented portal
copy. No unexpected runtime failure blocked the test run.

**Brand/GRC Connect implementation checkpoint:** Added the shared `GrcBrand`
component and a locally stored official white GRC logo, rebuilt the landing
page and public navigation, renamed the signed-in home to GRC Connect, and
updated portal branding/breadcrumbs/metadata. The first GREEN attempt left six
focused-test expectation mismatches: two pre-existing tests still asserted the
retired preview wording, the new landing About section needed an explicit
landmark name, one journey title was intentionally shortened, and the primary
Enrollment link was duplicated between the hero and module card. No runtime
or API error occurred; those UI-contract details are being corrected before
the next test run.

**Brand/GRC Connect verification:** After correcting those semantic and copy
details, the same focused Vitest command passed: **3 files / 25 tests passed**
in 59.27s. This validates the official-logo landing identity, public links,
GRC Connect label/navigation/breadcrumb transition, personalized next action,
and the existing mobile portal Sheet behavior. The work now proceeds to
phone-specific enrollment workflow cards without changing any API contract.

**Registrar Staff and Accounting mobile cards:** Added custom `DataTable`
phone-card renderers for Registrar enrollment approvals/voids and Accounting
waiting/served tickets. Approval cards retain student financial status, units,
overload indication, Review, and every authorized decision; Cashier cards
retain ticket, student, amount, financial status, and priority action. Desktop
tables and all mutations remain unchanged. Focused verification passed:
`registrar-enrollment-workspace.test.tsx` +
`accounting-payment-workspace.test.tsx` — **2 files / 24 tests passed**
(21.69s). The test environment continues to log its existing non-fatal
`HTMLCanvasElement.getContext()` notice from the print component.

**Program Chair mobile schedule-card TDD RED:** Added a behavioral test for a
generated subject schedule card, then ran
`npx vitest run src/features/components/portal/program-chair-enrollment-workspace.test.tsx --no-file-parallelism`.
Result: 20 tests total, 19 passed, and the new mobile-card test failed as
expected before implementation (72.43s; the existing non-fatal JSDOM
`HTMLCanvasElement.getContext()` notice also appeared).

**Program Chair mobile schedule cards:** Implemented an accessible, compact
per-subject schedule card for phone-sized table views, retained the desktop
table, and made the schedule dialog safely scroll within the mobile viewport.
The first implementation exposed two identically named actions to the
DOM-based test runner; the card action is now the clearer “Set schedule,”
while the table keeps “Assign schedule.” Focused verification passed:
`program-chair-enrollment-workspace.test.tsx` — **1 file / 20 tests passed**
(39.50s), with only the existing non-fatal canvas notice.

**Student review-card TDD RED:** Added an interaction-level expectation for a
regular student's selected-subject card and ran
`npx vitest run src/features/components/portal/enrollment-workspace.test.tsx --no-file-parallelism`.
The expected `CS201 section review` card was absent before implementation:
13 tests passed and the new test failed (11.50s), with the existing non-fatal
canvas notice only.

**Student enrollment mobile review:** Replaced the default narrow-screen
subject summaries with purpose-built review cards containing the subject,
schedule, room, professor/seat context, and units. The regular and irregular
submission buttons now fill the available phone width; the confirmation
dialog scrolls safely and retains full-width touch targets on small screens.
Focused verification passed: `enrollment-workspace.test.tsx` — **1 file /
14 tests passed** (10.86s), with only the existing non-fatal canvas notice.

**Dean / Executive schedule-review TDD RED:** Added a semantic mobile-card
expectation for a submitted schedule subject and ran
`npx vitest run src/features/components/portal/schedule-decision-workspace.test.tsx --no-file-parallelism`.
The new `PSPEAK schedule review` landmark was absent before implementation;
7 tests passed and 1 failed (6.87s), with the existing non-fatal canvas notice.

**Dean / Executive schedule-review mobile treatment:** Added accessible subject
card landmarks to the review dialog, full-height scroll-safe phone dialog
geometry, and full-width decision actions on phones. The shared confirmation
dialog now has the same small-screen behavior. Focused verification passed:
`schedule-decision-workspace.test.tsx` — **1 file / 8 tests passed** (6.78s),
with only the existing non-fatal canvas notice.

**Registrar Head term-card TDD RED:** Added an accessible enrollment-cycle
card expectation and ran
`npx vitest run src/features/components/portal/academic-term-workspace.test.tsx --no-file-parallelism`.
The card was absent as expected before implementation: 5 tests passed and 1
failed (8.79s), with only the existing non-fatal canvas notice.

**Registrar Head enrollment-cycle mobile cards:** Added a focused card for
each term with its status, enrollment-window state, and full-width archive
action. Term-creation and current-term archive triggers now also span phone
widths. Focused verification passed:
`academic-term-workspace.test.tsx` — **1 file / 6 tests passed** (8.13s),
with only the existing non-fatal canvas notice.

**Integration verification prep:** The user-facing enrollment and public-brand
changes are implemented. Next checks will run the complete focused UI test
set, formatting/type/build validation, and a narrow visual smoke check at
desktop and phone widths. No API, route, auth, permission, or mutation
contract was changed.

**Focused integration suite:** Passed
`npx vitest run` for the 9 affected public, portal-shell, and enrollment
workspace test files — **9 files / 97 tests passed** (122.40s). The suite
logged the existing non-fatal JSDOM canvas notice from the print component;
there were no assertion or runtime failures.

**Static verification:** `npm run typecheck` passed (39.50s). The repository
format check remains blocked by 86 already-unformatted files across unrelated
frontend modules (and several files outside this change); no bulk format was
run, to preserve the user's dirty worktree. The next validation is the
production build and responsive browser smoke check.

**Production build and visual smoke check:** `npm run build` passed (85.40s;
all five Next routes generated successfully). An isolated production server
was used for browser checks and stopped afterwards. At 390px, the public
landing page showed the official logo, compact menu trigger, stacked content,
and no horizontal overflow. At 1440px, the full public navigation and logo
were visible with no overflow. The current local database rejected the
documented synthetic student login, so a live authenticated portal screen
could not be loaded for the browser-only check; the focused component suite
continues to cover every role-specific workflow. The already-running dev
server also held protected routes at its restoring state, so it was not used
as verification evidence.

**Final static check prep:** Running the configured ESLint command next. A
failure in unrelated pre-existing dirty files will be recorded without a
repository-wide rewrite.

**Repository-wide ESLint limitation:** `npm run lint` exceeded the 180s
command timeout without producing a diagnostic (184.10s). It was terminated
by the command runner rather than completing or reporting a code issue. A
narrow lint run for the affected source and test files follows.

**Handoff verification:** The affected source and test files pass targeted
ESLint. A full `npm test` run is now required by the finalization checklist
on the exact current tree; no commit, merge, or push will be performed.

**Full-suite result and triage:** `npm test` completed with 78 files / 517
tests passing and 10 files / 21 tests failing (187.91s). Twenty failures are
unrelated five-second test timeouts spread across untouched workspaces during
the fully parallel run. One affected existing test needs an expected-class
update because the schedule-review dialog now deliberately uses
`max-h-[100dvh]` on phones and `sm:max-h-[90dvh]` on larger screens. The
focused feature tests had already passed serially; the expected-class test is
being corrected and rerun next.

**Schedule-review regression resolved:** The isolated existing test reproduced
the failure consistently: it asserted the previous one-size dialog cap rather
than the new responsive `max-h-[100dvh]` / `sm:max-h-[90dvh]` behavior. The
assertion was updated to the intended mobile-plus-desktop contract. The review
dialog and decision workspace tests now pass serially: **2 files / 12 tests
passed** (17.94s), with only the existing non-fatal canvas notice.

**Final affected-suite command limitation:** The combined ten-file serial
command exceeded the runner's 180s cap and was terminated before Vitest could
print its summary (184.08s; it emitted only the known canvas notices before
the runner's broken-pipe cleanup). The current tree is instead evidenced by
the earlier 9-file / 97-test green run plus the final 2-file / 12-test
schedule-review and decision rerun; the only change after the 97-test run was
the tested schedule-review expectation update.

**Final integrity checks and handoff:** Targeted ESLint for the final
schedule-review source/test pair passed (28.90s), and `git diff --check`
passed with no whitespace errors. The temporary production server and browser
used for visual smoke checks were stopped. The shared worktree's pre-existing
unrelated backend/docs/e2e changes and untracked assets remain untouched. No
commit, merge, or push was performed.

## 2026-08-06 — Nine-role portal UI usability audit

**Audit scope:** Requested a code-and-workflow review of the current UI for
all nine PRD user roles, covering role relevance, friendly task flow,
responsive/mobile behavior, accessibility, and visual hierarchy. This is a
read-only review first; no API contract, authorization, or source behavior
will be changed without a follow-up implementation request.

**Role coverage evidence:** `role-capabilities.test.ts` passed — **1 file /
3 tests passed** (3.11s), confirming the current mapping of modules to all
nine roles. The audit found that the central enrollment workspaces and their
recent mobile cards are role-appropriate, while six leadership modules still
route to explicit preview states and four global top-bar affordances are
disabled previews. Findings will be handed off with precise source locations;
no implementation changes were made during this review.

## 2026-08-06 — Nine-role portal usability implementation preparation

**Session start and design discovery:** The user authorized the audited UI
improvements. Before changing source behavior, the role navigation, GRC
Connect home, module fallback, notification tray, and shared sheet/dialog
primitives were re-reviewed against the PRD-aligned role definitions. The
implementation will preserve every existing authorization and API contract;
the user selected the recommended presentation for the six unconnected
leadership modules: keep them visibly labelled as non-clickable **Planned
capabilities**, separate from live workspaces and hidden from daily role
navigation. The next changes begin with focused behavioral tests.

**Nine-role usability TDD RED:** Added behavioral coverage for the approved
live-versus-planned portal presentation, removal of disconnected top-bar
controls, explicit-only notification marking, and safe mobile panel geometry.
The focused five-file Vitest run failed as intended: **51 assertions failed /
26 passed** in 76.10s. The failures match the pre-change UI exactly (preview
modules still appear in navigation and active grids, preview top-bar buttons
remain, sheet close marks all notifications read, dialogs lack viewport
containment, and return labels still use “portal overview”). No unexpected
runtime/API error occurred.

**Nine-role usability implementation:** GRC Connect and role navigation now
surface connected enrollment workspaces only, while the six unconnected
analytics/reporting modules appear separately as non-clickable **Planned
capabilities**. Existing bookmarked preview routes display an honest planned
state. The disconnected global account/help buttons were removed rather than
presented as disabled actions; notification read status now changes only via
an explicit user action; shared Sheets, Dialogs, and AlertDialogs contain
their scroll area and respect dynamic mobile viewport limits. All API,
authorization, and mutation contracts remain unchanged.

**Focused implementation verification:** `npx vitest run` for the five
affected portal, notification, and responsive-primitive test files passed:
**5 files / 77 tests passed** in 55.58s. The first GREEN run had two test-only
query issues (a fuzzy Enrollment label and simultaneous Radix modals hiding
each other); both tests were corrected and the focused suite then passed.

**Static verification:** `npm run typecheck` initially reported one unused
`Bell` import in `portal-shell.tsx`, traced directly to the removed preview
action component. Removing that import resolved the check; `npm run typecheck`
and targeted ESLint both passed. `npm run build` also passed, generating all
five Next routes. The in-app visual-preview surface was unavailable for the
local production server, so no browser screenshot is claimed. The temporary
server was stopped. Role-catalog verification passed (**1 file / 3 tests**),
and `git diff --check` passed. A targeted Prettier check then identified
style-only formatting in seven touched portal files; those exact files are
being formatted before the final rerun.

**Final nine-role usability verification:** One remaining technical breadcrumb
fallback (“Module preview”) was covered by a new RED/GREEN regression test and
changed to “Unavailable workspace.” The final focused portal suite passed:
**5 files / 77 tests passed** in 50.76s. Current-tree `npm run typecheck`,
targeted ESLint, and targeted Prettier checks all passed; `npm run build`
passed and generated all five routes; `git diff --check` passed. No commit or
push was performed. The repository-wide `npm test` and `npm run lint` were not
rerun in this pass because their earlier results remain documented above: the
full test run encountered unrelated parallel resource timeouts and repository
lint exceeded the command timeout. The shared dirty backend/docs/e2e worktree
changes remain untouched.

## 2026-08-06 — GRC Connect welcome-copy refinement

**Session start and approved micro-design:** The user asked to remove the
personalized “Welcome, [name]” line from the GRC Connect hero because the
name is not useful in that placement. The role badge and role-specific work
guidance will remain, so the page retains its context without repeating the
signed-in identity. This is a copy-only frontend refinement; no API,
authorization, or enrollment workflow changes are in scope.

**Welcome-copy TDD RED:** The overview regression test now requires the
role-specific guidance to remain while “Welcome, Test Student.” is absent.
Its first execution was delayed by a detached temporary production-server
child left from the prior verification; only that server’s exact child
processes and the timed-out test process were stopped. The rerun failed as
intended on the existing welcome line (**1 failed / 3 passed**), confirming
the test exercises the requested copy change rather than an environment error.

**Welcome-copy implementation and verification:** Removed the personalized
welcome line from the GRC Connect hero while retaining its role badge and
role-specific guidance. The focused overview test passed (**1 file / 4
tests** in 13.90s), `npm run typecheck` passed, targeted Prettier passed, and
`git diff --check` passed. A targeted ESLint attempt for the two changed files
exceeded the command timeout without diagnostics; that exact child process was
stopped after inspection. The broader affected-file lint run from the prior
portal UI pass remains green. No API, authorization, enrollment behavior,
commit, or push was changed.

**All-role coverage follow-up:** The user clarified that the welcome-name
removal must apply to every role, not only Registrar Head. The implementation
already uses the single shared `GrcConnectPage` for all roles; a role-by-role
regression test now makes that global behavior explicit. The formatted final
test run passed: **1 file / 13 tests** in 14.46s, covering every role;
`npm run typecheck` and `git diff --check` also passed. No production behavior
needed a further change because the welcome line was already removed from the
one component every role uses.

**Hero role-badge clarification:** The user clarified with a screenshot that
the unwanted text is the role badge (for example, “Program Chair”) above the
GRC Connect title—not the already-removed welcome name. The requested
presentation is to remove that redundant badge from the shared hero for every
role while retaining role identity in the portal sidebar, where it remains
useful context. A focused all-role regression test follows before the markup
change.

**Hero role-badge implementation:** Removed the shared role badge from the
GRC Connect hero. The all-role regression test first failed as expected for
all nine labels, then passed after the markup change: **1 file / 13 tests
passed** in 21.48s. Targeted Prettier, `npm run typecheck`, and `git diff
--check` passed. The role label intentionally remains in the portal sidebar;
no API, authorization, enrollment behavior, commit, or push changed.

## 2026-08-07 — Curriculum approval workflow audit

The requested workflow was audited against the Claude continuation worktree at
`.claude/worktrees/curriculum-approval-workflow`, not the main checkout. Tasks
1–12 are recorded in that worktree's SDD ledger as complete; Task 13's
`CurriculumApprovalsWorkspace` is implemented at commit `7f6c57e` but remains
unreviewed. Task 14 (registering the module for Dean and Executive Director)
has not started, which explains why the approval module is not visible in the
sidebar. Task 15 full-suite verification has not run.

The audit also found a requirements discrepancy to resolve before completion:
the current plan/implementation makes `approveAsDean` role-scoped only, while
the requested behavior says Dean review must be college-scoped. Program Chair
submission is already college-scoped; Executive Director review is intended to
remain institution-wide. No application code, commit, or push was changed in
this audit.

## 2026-08-07 — Curriculum approval workflow implementation continuation

Task 13's review finding about Dean visibility was fixed in the isolated
worktree: Dean curriculum listing and transition authorization now require a
matching assigned college, while Executive Director access remains
institution-wide. Regression tests cover listing isolation and cross-college
transition denial. Task 14 registered `curriculum-approvals` for Dean and
Executive Director in the sidebar/module registry and updated exact role/module
coverage tests. No commit or push was made.

Verification evidence:

- Backend targeted workflow/API tests: **27 tests / 86 assertions passed**.
- Backend Unit suite: **304 tests / 772 assertions passed**; PHPUnit emitted
  the existing doc-comment metadata deprecation warning.
- Backend API v1 suite: **459 tests / 1,819 assertions passed**; the same
  existing PHPUnit deprecation warnings were emitted.
- Backend Actions/Auth/Models/Policies groups: **173 tests / 843 assertions
  passed**.
- Frontend full Vitest suite: **91 files / 580 tests passed**; jsdom emitted
  the existing `HTMLCanvasElement.getContext()` warning.
- Frontend targeted ESLint and Prettier checks passed. TypeScript still reports
  only the two known pre-existing readonly fixture errors in
  `curriculum-view.test.tsx` documented in the continuation handoff.
- The monolithic `php artisan test` command and the full Database feature
  directory exceeded the six-minute command limit without flushing a result;
  the exact child test processes were stopped. The relevant curriculum catalog
  migration suite passed (**12 tests / 25 assertions**), while the existing
  curriculum versioning migration suite has two environment/migration-order
  failures unrelated to this approval-workflow change.

## 2026-08-07 — Program Chair curriculum authoring redesign (design discovery)

The user requested a guided Program Chair creation flow and spreadsheet-style
subject-entry grid. Design discovery has started in the isolated curriculum
approval worktree because it contains the unmerged approval workflow that
governs the same editor. No product code, API contract, migration, commit, or
push has changed in this design phase. The current create endpoint still
requires `effective_school_year`, while the user wants that field removed from
the UI; its automatic source must be confirmed before implementation.

**School-year rule confirmed:** The creation UI will not expose an effective
school-year field. The server will derive it from the active academic term and
fall back to the latest configured academic term when no term is active. The
remaining design question is the precise source for reusing an existing
subject in a new curriculum.

**Subject-entry rules confirmed:** The existing-subject picker will draw only
from the selected program's current/latest curriculum and exclude all older
curriculum versions. Choosing “Create new subject” will persist a subject
record, then place it immediately in the new draft curriculum. This requires
a new authenticated subject-create API surface because the current v1 API only
lists subjects.

**Interaction approach approved:** The user selected the guided Draft creation
flow: a central “Create new curriculum” action opens a Program then Name
wizard, whose proceed action creates the draft and opens its editor. Existing
1st–4th Year navigation remains; each spreadsheet row still records whether
the subject is offered in the 1st or 2nd Semester. No implementation has
started pending review of the detailed design.

**UI/editing design approved:** The user approved the centered creation action,
two-step wizard, read-only draft preview, explicit Edit curriculum mode,
spreadsheet-style year-scoped table, and the New Subject / Use Existing Subject
row chooser. The next design section defines the API and authorization
boundaries needed to enforce that behavior.

**Server/data-flow design approved:** Program selection and curriculum creation
will be college-scoped and server-enforced. The server derives the hidden
effective school year from the active/latest academic term; reuse candidates
come only from the selected program's current/latest curriculum; and new
subjects are atomically created and placed in the editable Draft. Validation,
audit logging, Draft-only editing, and regression coverage are part of scope.

**Approved design recorded:** The complete Program Chair curriculum-authoring
design is in `docs/superpowers/specs/2026-08-07-program-chair-curriculum-authoring-design.md`.
It was self-reviewed for placeholders, internal consistency, scope, and
ambiguity; no placeholders remained and `git diff --check` passed for the
specification and progress log. The design doc and progress update are
intentionally uncommitted because the user has not authorized a commit.

**Specification reviewed:** The user approved the written curriculum-authoring
specification. The required implementation-planning phase is now in progress;
no product code has changed and no commit or push is authorized.

**Implementation plan completed:** The task-by-task TDD plan is in
`docs/superpowers/plans/2026-08-07-program-chair-curriculum-authoring.md`.
It covers Program Chair college authorization, server-owned school-year
resolution, current/latest subject sourcing, atomic subject placement, strict
frontend contracts, the creation wizard, the year/semester spreadsheet, and
cross-feature verification. The plan passed its placeholder, type-consistency,
and whitespace self-review. It is intentionally uncommitted; execution awaits
the user's selected execution mode.

## 2026-08-08 — Program Chair curriculum authoring Task 1 started

Task 1, “Enforce college ownership and server-owned curriculum school year,”
has started in the existing isolated `curriculum-approval-workflow` worktree.
The required task brief, PRD, and full progress ledger are being reviewed
before implementation. An initial documentation-read command used a
parent-relative task-brief path while already in the worktree and failed
without modifying application files; the corrected task-local path now reads
successfully. The pre-existing uncommitted approval-workflow changes remain
preserved. TDD RED tests are next; no commit or push is authorized.

**Task 1 RED and mutation evidence:** The brief's exact four-file command
initially failed as intended: 13 tests failed because the resolver class and
college ownership rules did not yet exist, and creation still accepted the
forged school year. Two initial test-fixture issues (duplicate policy-test
emails and the old request requirement rejecting authorization fixtures before
Policy execution) were corrected without changing product code. After the
implementation, the same command passed with **32 tests / 93 assertions**.
An explicit PATCH school-year mutation check then temporarily reintroduced the
unsafe controller/action path; its focused test failed as expected because the
response changed from `2026-2027` to forged `1999-2000`. The guarded path has
been restored; final exact verification is next. No commit or push has been
performed.

**Task 1 final verification:** The brief's exact final command passed with
**32 tests / 94 assertions** in 15.13 seconds. It covers the new resolver,
college-scoped program visibility and curriculum create/update authorization,
forged create/PATCH school-year protection, existing Draft-only locking, and
approval-policy coverage. The directly affected `ProgramsEndpointTest` also
passed with **5 tests / 9 assertions**, and `git diff --check` passed. The
implementation and detailed TDD/self-review report are recorded in
`.superpowers/sdd/2026-08-07-program-chair-curriculum-authoring/task-1-report.md`.
No commit or push was performed; pre-existing approval-workflow changes remain
unmodified.

## 2026-08-08 — Program Chair curriculum authoring Task 2 started

Task 2, “Current-curriculum subject sourcing and atomic row creation,” has
started in the existing isolated `curriculum-approval-workflow` worktree after
reviewing its task brief, PRD, approved design, implementation plan, and
progress ledger. Task 1's required resolver and college-aware policy are
present with its independently reviewed passing verification. The existing
uncommitted approval-workflow and Task 1 changes will be preserved. TDD RED
tests are next; no commit or push is authorized.

**Task 2 RED:** The focused authoring command failed as intended with **10
failed tests / 6 assertions** in 15.66 seconds: all seven endpoint cases
received the expected absent-route 404 responses, and all three resolver cases
reported the missing resolver class. One setup-only duplicate placement in the
distinct-subject test was rejected by the existing database uniqueness
constraint before exercising the missing endpoint; that fixture is removed
without changing the required behavior. No production Task 2 code was present
when RED was observed.

**Task 2 execution interruption:** The first subagent hit an external usage
quota before it could report GREEN verification. It left the Task 2 files
uncommitted in the isolated worktree; no commit or push was performed. The next
implementer must inspect those files, preserve the established RED coverage,
finish or correct the implementation, and run the exact Task 2 regression set.

## 2026-08-08 — Program Chair curriculum authoring Task 3 restarted

The first Task 3 frontend implementer left uncommitted partial schema, service,
hook, and test work but did not report a test outcome after the normal focused
verification window. It was stopped without discarding files; a fresh
implementer will inspect, complete, and verify only that bounded Task 3 scope.
No commit or push was performed.

**Task 2 completion:** The interrupted implementation was inspected and
completed without changing Task 1 behavior or the pre-existing approval
workflow. It now resolves the selected program's active curriculum for the
server-derived current/latest school year, falls back to the latest active
version by effective school year/name, exposes a college-authorized
current-curriculum subject source endpoint, and atomically creates new or
existing subject placements in Draft curricula. New subjects derive college
and Active status from the authenticated Program Chair, existing subjects are
restricted to the resolved current/latest source, duplicate codes/placements
are rejected, and curriculum/subject audit vocabulary and events are present.

The interrupted endpoint tests used Laravel's default top-level
`assertJsonValidationErrors()` helper even though this API wraps validation
details under `error.errors`; those assertions were corrected to the existing
API envelope without weakening the behavior checks. The exact Task 2 command
from the brief passed with **32 tests / 121 assertions**. The per-file run
also confirmed 3 resolver tests / 9 assertions, 7 authoring tests / 43
assertions, 17 curriculum endpoint tests / 61 assertions, 3 lock tests / 6
assertions, and 2 audit vocabulary tests / 2 assertions. `git diff --check`
passed. No commit or push was performed. The detailed implementation report
is in `.superpowers/sdd/2026-08-07-program-chair-curriculum-authoring/task-2-report.md`.

Known concern for the later cross-feature pass: the local database still has
the previously documented migration privilege blocker for
`2026_08_07_000004_add_decision_columns_to_curricula`; no grants or migration
state were changed here.

## 2026-08-08 — Program Chair curriculum authoring Task 3 started

Task 3, “Frontend authoring contracts, service calls, and query hooks,” has
started in the isolated `curriculum-approval-workflow` worktree. Task 2’s
reviewed GET current-subject-source and POST subject-placement contracts are
the only backend interfaces being consumed. The implementation will use TDD,
preserve the existing approval-workflow and Tasks 1–2 changes, and will not
commit or push.

The recovery pass found partial Task 3 files already present. The initial
focused frontend command passed with **15 tests / 15 tests**, but inspection
identified a nullable-program query-key contract gap and missing explicit
coverage for the POST response contract. Those are being corrected within
Task 3 only; no Task 1–2 or approval files are being reverted.

**Task 3 recovery completion:** The schema/service/hook tests now pass with
**18 tests / 18 tests**. The current-subject query preserves a nullable
program ID instead of using a fabricated `0`, and the POST response contract
has explicit failure coverage. `npm run typecheck` exits 1 only for the two
known unrelated readonly fixture errors in
`frontend/src/features/components/portal/curriculum-view.test.tsx` at lines
126 and 201; no Task 3 or workspace-bridge errors remain. `git diff --check`
passed. A temporary type bridge keeps the legacy pre-Task-4 workspace form
compilable while stripping its server-owned effective-school-year field before
create requests; the visible legacy controls remain Task 4 scope. Details are
in `.superpowers/sdd/2026-08-07-program-chair-curriculum-authoring/task-3-report.md`.
No commit or push was performed.

**Task 3 review/reproduction correction:** Independent review found that the
temporary type bridge did not bridge React Hook Form's runtime Zod resolver:
the legacy form still feeds `effective_school_year` into the strict published
store schema before the mutation can strip it. Re-running the workspace suite
reproduced the issue with **9 failed / 10 passed** tests. The bounded repair
will use a UI-local legacy resolver for the pre-Task-4 form while preserving
the strict public API schemas, and will add existing-subject cache-invalidation
coverage. No commit or push was performed.

## 2026-08-08 — Task 3 reviewed integration repair started

The reviewed Task 3 repair is scoped to the isolated curriculum-authoring
worktree. Required repository, PRD, progress, Task 3 brief/report, review
diff, and reproduction note were read. The repair will add only a local
React Hook Form resolver/type adapter for the legacy pre-Task-4 workspace and
focused coverage that an existing-subject placement invalidates the exact
curricula cache without invalidating the subjects cache. Public Zod API
schemas and backend/Task 4+ behavior remain unchanged. No commit or push is
authorized.

**Task 3 reviewed integration repair final evidence:** The requested fresh
verification was run after the UI-local resolver/type repair. The exact Task 3
focused command passed with **3 files / 19 tests**; the curriculum workspace
regression passed with **1 file / 19 tests** and emitted only the known jsdom
canvas `getContext()` warning. `npm run typecheck` exited 1 only for the two
known pre-existing readonly fixture errors in
`frontend/src/features/components/portal/curriculum-view.test.tsx` at lines
126 and 201. `git diff --check` passed. The repair left public schemas,
backend behavior, and Task 4+ UI behavior unchanged. No commit or push was
performed.

## 2026-08-08 — Program Chair curriculum authoring Task 4 started

Task 4, the two-step Program Chair curriculum creation wizard and Draft
preview/edit boundary, has started in the isolated
`curriculum-approval-workflow` worktree. The scope preserves the reviewed
Tasks 1–3 contracts, current approval workflow, return-reason handling,
reviewer experiences, year tabs, and pre-Task-5 subject controls. It adds no
dependency or global-theme change and will not commit or push.

**Task 4 execution interruption:** The first UI implementer left uncommitted
wizard/workspace/test changes but stopped responding after its test and lint
processes completed, before recording outcomes. The files are preserved. A
fresh recovery pass must inspect, correct if necessary, and run the exact Task
4 verification before this task can be reviewed. No commit or push occurred.

## 2026-08-08 — Program Chair curriculum authoring Task 5 recovery started

The first spreadsheet implementer left uncommitted Task 5 component and test
files but stopped reporting before verification or a task report. The files
are preserved for a bounded recovery pass that must inspect, complete, and run
the exact Task 5 test/format checks before merge preparation. No commit or
push occurred.

**Task 5 recovery test failure:** The focused suite currently has **31/33
passing** tests. The two failures are: the prerequisite test does not render
the expected CS101 prerequisite in the second-year table after editing CS201,
and the existing-subject chooser test mock returns the wrong response shape
for `/current-curriculum-subjects`, so its search field never appears. A
root-cause fix and fresh full Task 5 verification are required before merging.
No commit or push occurred.

**Task 4 recovery completion:** The preserved wizard/workspace implementation
was inspected against the approved design and Task 4 brief. It keeps the
creation CTA behind the Program Chair role, displays the already server-scoped
program list with the authenticated college context, collects Program before
Curriculum name in an accessible two-step Dialog, and posts exactly
`{ program_id, name, subjects: [] }`. Created curricula are inserted into the
query cache and opened as read-only Draft previews; `Edit curriculum` is
Draft-only, status is a read-only Badge, and effective school year/status are
not editable inputs. Existing approval transitions, return-reason handling,
reviewer module, View tab, selector discard safeguards, four year tabs, two
semester values, prerequisites, and the pre-Task-5 subject controls remain
present. The exact Task 4 frontend suite passed with **26 tests / 26 tests**;
the requested ESLint command passed; `git diff --check` passed. No Task 4
production repair was necessary and no commit or push was performed.

## 2026-08-08 — Program Chair curriculum authoring Task 5 started

Task 5 is limited to the isolated `curriculum-approval-workflow` worktree and
will replace the legacy subject-placement picker with a controlled,
year-scoped spreadsheet and new/existing subject-row dialog. The implementation
will preserve the reviewed Tasks 1–4 behavior, all four Year tabs, the `1st`
and `2nd` semester API values, prerequisite grade default `75`, debounced
autosave, Draft locks, and approval preview/transition behavior. The required
shadcn documentation command completed successfully before coding; no packages,
global styles, commits, or pushes are authorized.

**Task 5 verification recovery:** The prior implementer was interrupted before
writing a report. A fresh recovery pass is now inspecting the preserved
spreadsheet/row-dialog changes and will run the exact Task 5 checks before
preparing the requested merge evidence. No Task 5 code has been discarded,
committed, or pushed.

**Task 5 focused failure repair:** The exact four-file Task 5 suite first
reproduced the recorded **31/33** result. The spreadsheet preserved the full
prerequisite label as `CS101 · 75`; the workspace assertion incorrectly looked
for a separate exact `CS101` text node after the placement autosave. It now
asserts the complete visible label. The existing-subject chooser test mock now
returns the established `{ data: [...] }` subjects envelope for
`/current-curriculum-subjects` and waits for the search input before typing.
The exact focused suite then passed with **4 files / 33 tests** in 37.25s.
Prettier initially reported existing formatting drift in the three Task 5
component files; its mechanical formatter was applied, and the required
Prettier check plus `git diff --check` passed. The known jsdom canvas warning
remains non-failing. No commit or push was performed.

## 2026-08-08 — Curriculum prerequisite and Leadership-grade refinement

On `main`, refined the Program Chair curriculum editor without disturbing the
restored uncommitted work. The top-level Curriculum dropdown is no longer
shown at the start of Manage: creating a curriculum remains central, while
saved curricula open through an explicit dialog. Prerequisite editing now has
no visible minimum-grade field or grade text; newly added edges retain the
compatible stored threshold of `75`, with a responsive code-only chip and
separate remove control to prevent overlap. Leadership subjects now allow only
Complete (`C`) or Incomplete (`INC`); numeric subjects retain the existing
1.00–3.00 passing rule. Focused verification passed: frontend **53 tests**
across five files and backend **37 tests / 187 assertions**. The jsdom canvas
notice is non-failing. No commit or push was performed.

**Typecheck note:** `npm run typecheck` was attempted after the focused tests
and formatting pass, but remains blocked by two pre-existing mock-signature
errors in `curriculum-subject-row-dialog.test.tsx` (lines 43 and 47). That file
is outside this refinement and was not changed. `git diff --check` remains
clean.

## 2026-08-08 — Inline searchable prerequisite picker

Removed the standalone Prerequisite Graph entry point. Each curriculum table
row now owns its prerequisite interaction: **Add** opens a search field over
eligible subjects already placed in the current curriculum; once a prerequisite
exists, that control changes to **Edit**. Existing prerequisites remain visible
and removable, and already-selected/self subjects are excluded from search.
The focused spreadsheet and workspace checks passed with **27 tests**. No
commit or push was performed.

**Latest-active source refinement:** The prerequisite picker now receives its
candidates from the existing `current-curriculum-subjects` endpoint, which
resolves the program's latest active curriculum. The picker no longer limits
search results to the in-progress draft's rows, and includes a `None` action
to clear the selected row's prerequisites. The focused spreadsheet/workspace
suite passed with **28 tests**. No commit or push was performed.

## 2026-08-08 — Curriculum submission failure investigation

The saved curriculum did not submit because the local MariaDB schema had not
run migration `2026_08_07_000004_add_decision_columns_to_curricula`. The
server log records `SQLSTATE[42S22] Unknown column 'decided_by'` at
`TransitionCurriculum.php:83`; because the transition runs in a transaction,
the status update rolled back before the Dean could receive it. `php artisan
migrate:status` confirmed that this is the only pending migration. The next
step is to apply and verify that migration, then rerun the approval endpoint
tests. No commit or push occurred.

**Migration attempt blocked:** The application database account `grc_app` does
not have MariaDB `ALTER` permission, so Laravel correctly left the migration
pending and the schema unchanged. The next diagnostic step is a read-only
check for the local XAMPP administrator connection; only if that connection is
available will the same pending, reversible migration be applied with the
required schema privilege. No commit or push occurred.

**Resolved:** The local XAMPP MariaDB administrator applied the pending
`2026_08_07_000004_add_decision_columns_to_curricula` migration successfully.
Migration status now shows it as ran (batch 2), and the normal application
connection confirms all three columns are available. The focused curriculum
approval validation passed with **32 tests / 93 assertions**, covering submit,
Dean review/return, Executive review/approval, notifications, Draft locking,
and current-subject authoring. No commit or push was performed.

## 2026-08-08 — Dean curriculum review visibility investigation

The successfully submitted `BSIT 2030 Curriculum` is persisted as
`pending_dean_review` under the CCS-scoped BSIT program. The Dean screen was
empty because local `dean.seed@grc.test` had `college = NULL`; the curriculum
index intentionally returns no college-scoped records to a Dean without a
college assignment. A new RoleUserSeeder regression test first failed on that
missing scope and then passed after assigning the synthetic Seed Dean to CCS.
The existing local Seed Dean row is now being aligned to that seed contract so
the pending review appears without weakening cross-college authorization. No
commit or push occurred.

**Resolved and verified:** The existing Seed Dean is now CCS-scoped. The exact
live query shape used by the Curriculum Approvals list returns `BSIT 2030
Curriculum` for that account. The RoleUserSeeder regression suite and the
curriculum transition endpoint suite pass with **20 tests / 89 assertions**.
No commit or push occurred.

## 2026-08-08 — Program Chair curriculum lifecycle UI refinement started

The Program Chair requested that Manage represent exactly one current
in-progress curriculum (Draft, pending Dean review, or pending Executive
review), rather than exposing a list of historical duplicates in "Open saved
curriculum." That current item remains in the Manage stage until final
Executive approval; only final-approved curricula belong in View. A returned
Draft must reopen with its recorded return notes and edit controls enabled.
Existing records will be filtered from the UI, not deleted. The Dean review
dialog will also use the read-only preview layout without squeezed filters.
No commit or push is authorized.

**Lifecycle UI verification:** The focused Program Chair, published View, and
Dean review suites passed with **36 tests** after the one-current-workflow and
read-only preview changes. The initial Prettier check identified style-only
formatting drift in four touched frontend files; formatter output and a fresh
verification pass are required before handoff. No commit or push occurred.

**Completed:** Prettier now passes for all six touched UI/test files, and the
post-format focused suite again passes with **3 files / 36 tests**. `git diff
--check` also passes. The known unrelated project-wide typecheck issue remains
the pre-existing mock-signature failure in `curriculum-subject-row-dialog.test.tsx`.
No commit or push occurred.

## 2026-08-09 — Predictive schedule generation and Room Sync started

The approved Program Chair scheduling vertical slice has started directly on
`main` at the user's request. It will replace manual enrollment planning with
one predictive Generate Schedule flow; add section-demand forecasting,
faculty-load support, editable recommendations, room synchronization and
availability, and the professor-input table redesign. Existing uncommitted
work is user-owned and must remain outside the scoped commit. The user has
explicitly authorized a verified commit and push as a saving point; neither
will occur until the applicable tests and checks provide fresh evidence.

**Baseline-check interruption:** the first parallel frontend/backend focused
test command exceeded its 60-second command limit before returning output.
It is not recorded as a pass; the checks must be rerun individually with
observable output before implementation results are assessed.

**Predictive cohort-rule milestone:** Added the pure `HistoricalCohortResolver`
and `HistoricalCohortReference` through a red-green cycle. Its three unit
tests cover the same-year second-semester lookup, advancing Years 2–4 from the
prior second semester, and the incoming First Year/First Semester prior-year
exception; they pass with **3 tests / 9 assertions**. The focused frontend
baseline remains unverified because the runner exceeded its command limit.

**Historical-demand substrate milestone:** Added the de-identified
`section_demand_observations` model and reversible migration, with term,
program, curriculum, subject, year-level, cohort, enrollment, section,
capacity, college, and source fields. The first migration run correctly
exposed MariaDB error 1059 because the explicit unique-index name was 71
characters; a targeted comparison confirmed the 64-character identifier
limit, and shortening only that name resolved it. The model-cast and migration
contract checks pass with **2 tests / 13 assertions**.

**ML contract milestone:** Added the private
`POST /internal/v1/section-demand/predict` contract to `ml-service`. It
accepts aggregate observations and generation targets, uses a deterministic
Random Forest when at least four observations are available, and explicitly
falls back to the latest historical demand when they are sparse. Red-green
tests now pass with **2 pytest tests** and confirm nonnegative, bounded output
and the sparse-history fallback. Laravel integration has not started yet, so
no browser-visible prediction endpoint exists at this milestone.

**Laravel-to-ML boundary milestone:** Added the private-only
`SectionDemandPredictionClient`, prediction-service environment configuration,
and a focused fake-HTTP contract test. The test initially showed PHP mock JSON
normalizes `38.0` to numeric `38`; the assertion now correctly validates the
numeric value, which is the documented contract. The client test passes with
**1 test / 3 assertions** and confirms aggregate payloads contain no student
identifier. Generation runs and public API endpoints are the next slice.

**Schedule-generation entry-point milestone:** Added a Program Chair-only,
college-scoped, active-run-idempotent API lifecycle at
`POST /api/v1/academic-terms/{term}/schedule-generation-runs`, together with a
protected read resource. The focused endpoint suite passes with **3 tests / 12
assertions**.

**Forecast execution and UI milestone:** Added an asynchronous generation job
that persists only aggregate demand forecasts from the ML service, plus a
local/test-only synthetic aggregate observation seeder. The Program Chair
screen now starts from a single **Generate Schedule** action and explicitly
labels forecast results as editable advice; faculty availability and subject
preferences now have quick-entry buttons and tabular saved records. Focused
Laravel checks pass. The first frontend typecheck attempt again exceeded the
60-second command limit with no output, so it remains unresolved rather than
reported as a pass.

**Verification checkpoint:** Focused frontend component checks pass (faculty
input: **4 tests**; Program Chair enrollment workspace: **21 tests**), ML
service suite passes (**8 tests**), and PHP syntax checks pass for all added
backend production files. A full `php artisan test --no-coverage` run also
exceeded the 60-second command limit without returning output, so only the
focused Laravel suites are verified in this session; this must not be treated
as a full-suite pass.

## 2026-08-09 — Room Sync and editable predictive schedule redesign

The approved Operations Board design is being documented before implementation.
The next vertical slice will repair the COE generation failure and the broken
Laravel-to-FastAPI contract, make Random Forest execution observable, turn
forecast output into an editable draft, add Registrar Head-owned room inventory
with Program Chair assignment access, enforce capacity/type/room conflicts, and
model explicit HyFlex A/B alternate-week room sharing. Existing user-owned
working-tree changes remain out of scope and must be preserved.

**Predictive contract repair in progress:** Red tests reproduced the two
generation defects: FastAPI response keys were not matched by Laravel, and an
empty historical dataset incorrectly ended the run as failed. The repaired
action now submits only the private FastAPI schema, records model strategy and
observation count, and safely completes with an explicit advisory warning when
there is insufficient data. Targeted Laravel and ML contract tests have passed;
the pending local schema migrations will be applied next to clear the real COE
generation error before the editable-draft slice starts.

**Migration checkpoint:** The application account can read the local MariaDB
database but, by design, cannot run DDL. `php artisan migrate --force` stopped
at the first pending predictive migration with MariaDB error 1142 (CREATE
denied to `grc_app`). No schema was changed and the COE error remains until the
same migrations are run through the local privileged migrator account.

**Local schema recovery:** The local XAMPP MariaDB privileged migrator was
available and ran only the two pending predictive migrations successfully.
The application account was not granted any additional permissions. The ML
service was not running at `127.0.0.1:8100` at this checkpoint, so live
end-to-end health verification still needs the local service process started.

**Editable predictive-draft milestone:** Forecast output now creates only
draft, chair-editable section plans and block sections, records the advisory
source and prediction run, and preserves any manual plan count or assigned
section fields on later regenerations. The migration initially hit MariaDB's
64-character foreign-key identifier limit in the isolated test database; the
foreign names were shortened explicitly, after which the focused draft tests
passed (**2 tests / 27 assertions**) and the three local predictive migrations
were all applied successfully through the privileged migrator. Focused
generation tests pass (**2 tests / 14 assertions**).

**Rooms/navigation and modality milestone:** Connected the previously hidden
Program Chair Demand Forecast destination, added a Rooms Operations destination
for Program Chairs and Registrar Heads, and widened the read-only legacy room
catalog accordingly (Registrar Staff remains excluded). The Rooms workspace
shows room records and active-term scheduled use. Online-only is no longer a
supported scheduling modality: its migration clears old room/modality values
and flags each row for reassignment; reference imports do the same rather than
guessing a physical schedule. The focused reference-import suite passes
(**10 tests / 27 assertions**) and `npm run lint:fast` exits successfully with
only pre-existing fast-refresh warnings. A TypeScript check also found two
pre-existing Vitest mock typing errors and one new Room Board subject-label
error; the new error was corrected, while the unrelated existing test typing
errors remain unresolved.

**Room Board filter milestone:** The approved Rooms Operations redesign now
provides room-name search plus availability, modality, and schedule-day
filters. The summary cards, room availability table, scheduled-use list, empty
state, and Clear filters action all derive from the same active filter set.
Focused component coverage passes (**3 tests**) and `npm run lint:fast` exits
successfully with only the existing fast-refresh warnings.

**Room Board saving point:** The filter implementation and its focused test
were committed and pushed as `5a0296b`. A full frontend Vitest run was started
after the focused checks but exceeded the 60-second command limit without
returning any test output; it is intentionally not recorded as a pass.

## 2026-08-09 — Predictive Enrollment and Schedule & Faculty Loading implementation started

The user explicitly approved the consolidated predictive-enrollment plan and
authorized implementation directly on `main`, followed by one scoped saving
point. This session will first perform the guarded active-term CCS draft reset,
then implement the forecast-result API/UI, term-level faculty-load threshold,
explainable faculty recommendations, consolidated Program Chair workspace, and
navigation changes. Existing unrelated working-tree changes remain user-owned
and must not be staged or modified outside necessary adjacent hunks. No
verification result is claimed until the applicable commands complete with
observable output.

**Guarded-reset milestone:** Added `ResetDraftSchedulePlanning`, a transaction
that deletes only one college's draft plans and their planned, unenrolled
sections, and refuses to run if a proposal, submitted plan, enrolled section,
or non-planned section exists. Its two focused behavior tests each passed when
run independently (the combined class command exceeded the local 60-second
tool window because this MariaDB suite recreates the schema per test).

**Local reset completed:** Fresh preflight confirmed exactly 135 CCS planned,
unenrolled sections, 8 CCS draft plans, and no CCS proposal in active term
2027–2028 2nd semester. `ResetDraftSchedulePlanning` then removed exactly
those 135 sections and 8 plans. Catalog, curriculum, historical observation,
faculty, audit, and non-CCS records were not targeted.

**Schema migration permission checkpoint:** The normal `grc_app` account
correctly rejected the new migration with MariaDB 1142 CREATE denied on
`faculty_load_thresholds`. No table was created and no application permission
was changed. The next step is the existing local XAMPP privileged migrator
path, keeping the application account least-privileged.

**Schema repair and local planning-data milestone:** The privileged migrator
first exposed MariaDB's 64-character FK-name limit. The failed migration left
two newly created, empty partial tables; their counts were verified as zero,
then only those tables were removed before retrying with explicit short FK
names. The complete reversible migration then applied successfully. The
local/test-only predictive planning seeder ran afterward to create current-term
CCS faculty availability/preference inputs and room metadata; it does not run
in production.

**Faculty-loading and room-safety milestone:** The draft generator now keeps
its faculty recommendation separate from the editable section assignment,
uses ranked preferences, availability, conflict checks, load balancing and a
stable tie-break, and emits manual-review warnings instead of inventing missing
room metadata. Program Chairs can configure a college/term load threshold with
an audit record. A new pure room detector permits only complementary HyFlex
A/B physical-week sharing; matching patterns and F2F overlaps are rejected.
Focused RoomConflictDetector coverage passes (**2 tests / 3 assertions**) and
the cross-college latest-generation endpoint check passes (**1 test / 4
assertions**). PHPUnit's pre-existing doc-comment metadata warnings remain
non-failing.

**Live local predictive smoke:** The private FastAPI service was started only
on `127.0.0.1` and its synthetic-data suite passed (**8 tests**). The
local-only planning seed now supplies aggregate historical cohort observations,
ranked subject preferences, availability windows, room metadata, and reference
meeting inputs for the active 2027–2028 2nd semester. The live CCS run
succeeded with **Random Forest**, **135 aggregate observations**, **45 subject
forecasts**, **90 draft section-subject recommendations**, **90 faculty
recommendations**, and **90 assigned physical rooms**. No student-level data
was read or written. Earlier smoke-generated drafts were safely reset under
the same guarded Draft-only action before this final synthetic result was
created.

**Verification checkpoint:** Focused backend behavior/endpoint suites, ML
service tests (**8 tests**), frontend focused component tests (**8 tests**),
frontend production build, PHP syntax checks, `git diff --check`, and Pint
format verification all pass. The frontend standalone typecheck still reports
two pre-existing Vitest mock-signature errors in
`curriculum-subject-row-dialog.test.tsx`; the predictive files typecheck as
part of the successful production build. The broad database-seeder PHPUnit
suite is unusually slow on this local MariaDB setup and remains running, so it
is not yet recorded as a full-suite pass.

## 2026-08-09 — Schedule & Faculty Loading filter investigation

Reported defect: selecting Year 1 returns no generated schedule rows. The
live CCS data confirms the generated rows use subject-like codes such as
`IT101`, while their actual year is correctly stored on the linked section
plan (`year_level = 1`). The frontend filter currently derives the year from
the first character of `section_code`, so it compares an empty value against
`"1"` and excludes every row. The corrective design will filter through the
section-plan year level instead. A companion searchable professor assignment
finder is also requested; it will use the existing faculty-load report so each
matching professor shows their assigned subjects and total units.

**Completed:** Year filtering now reads `year_level` from the linked section
plan rather than deriving it from the section code, so generated codes such as
`IT101` correctly appear under Year 1. The workspace also has a case-insensitive
`Find professor` input that narrows the professor selector, generated rows, and
Faculty Load Report cards, where assigned subject codes and total units remain
visible. The focused Vitest suite passes **2 tests**, and frontend lint/build
pass with only the three existing fast-refresh warnings in shared UI files.

## 2026-08-09 — Forecast navigation, room sync, and faculty reference-data investigation

Started a scoped investigation into the Demand Forecast action losing its
ready state after navigation, generated schedule-to-room synchronization, and
local/test-only professor reference data derived from the two supplied
2024–2029 curriculum workbooks. The requested professor accounts will use
synthetic school emails and the documented local password only; no production
credentials or student-level data will be introduced. Existing unrelated
working-tree changes remain out of scope and will be preserved.

## 2026-08-09 — Forecast reliability and workbook faculty data implementation

The approved implementation is starting directly on `main` under the earlier
explicit saving-point authorization. Work will be test-first, preserve the
unrelated dirty working tree, and use only the existing deterministic workbook
extract. The local account list remains ignored under `backend/storage`.

**Implementation milestone:** Added user/term-scoped Demand Forecast caching,
reusable curriculum/semester faculty preferences, workbook teaching history,
and deterministic local-only full-name faculty profile synchronization. The
faculty portal now uses New/Old curriculum and semester filters, searchable
subjects, seeded/declared source badges, and read-only teaching history. The
legacy term-scoped preference API remains available as a compatibility
fallback. Focused backend and frontend tests pass. A targeted frontend ESLint
command exceeded the local 60-second tool limit without returning diagnostics;
it is explicitly not recorded as passed and will be retried during final
verification.

**Local migration blocker:** `php artisan migrate` reached the new workbook
faculty-reference migration but the configured local `grc_app` MariaDB user
was denied `CREATE` on the schema. No partial table was created (the statement
failed at `CREATE TABLE`). The next safe step is to use the local privileged
development database account already used for earlier schema migrations, then
rerun migration status before seeding or resetting planning data.

**Migration and seed checkpoint:** The privileged local-only migration command
subsequently applied the workbook-reference schema successfully. The first
seed command used an over-escaped class name and did not run. The corrected
seeder command exceeded the local 60-second command limit before returning,
so its database effects must be inspected and the seeder made bounded before
any guarded CCS reset is attempted.

**Completed locally and pushed:** The privileged local migration created the
new reference tables without changing the application account's permissions.
The bounded local synchronization produced 400 active, full-name faculty
profiles, 1,014 reusable preferences/history records, and 220 seeded
availability windows; the ignored local report was generated at
`backend/storage/app/local-reports/professor-accounts.md`. The guarded CCS
preflight confirmed 12 Draft plans, 90 planned sections, and zero proposals,
enrollments, or overrides. Its transactional reset removed exactly those 90
sections and 12 plans, then a fresh generation run completed successfully with
Random Forest. All 90 regenerated CCS sections have a configured Room catalog
entry; 6 have a fully eligible faculty recommendation and 84 are deliberately
left editable/unassigned because no matching preferred faculty availability
exists in the workbook reference data. Focused Laravel checks pass (**19 tests
/ 71 assertions**), focused frontend checks pass (**30 tests**), the frontend
production build passes, and the fast lint check reports only three existing
shared-UI Fast Refresh warnings. The scoped code was committed and pushed to
`main` as `aac1a7b`; unrelated working-tree changes and raw/report artifacts
remain unstaged and unpushed.

## 2026-08-09 — Faculty employment status and complete local account coverage

Started the approved local-only faculty workforce slice. It adds an explicit
Full-time/Part-time planning classification (33 units is shown only as the
Full-time reference), inactive faculty records, and scoped Program Chair
controls with an audit trail. Existing faculty records will remain intact;
the local synchronization will only fill missing employment values, normalize
synthetic test accounts, and add deterministic inactive faculty records.

**Test-first checkpoint:** Backend endpoint coverage now verifies college
scoping, inactive-directory retrieval, audited employment/status changes, and
the required reason for deactivation. Frontend coverage verifies the new
Program Chair workforce editor. The initial migration index exceeded MariaDB's
key-length limit and was corrected by removing the unnecessary composite index
before applying the schema locally.

**Completed locally:** The employment-type migration is applied. The
optimized, transaction-safe local synchronization now reports 445 Faculty
accounts, all with full non-placeholder names, `@grc.test` emails, the shared
local password, and a non-null employment type (7 Full-time, 438 Part-time).
It includes 212 inactive accounts, including 12 deterministic inactive
profiles distributed across the four colleges. The ignored account reference
has been regenerated at `backend/storage/app/local-reports/professor-accounts.md`,
grouped by department with the desired subject, availability, teaching-history,
and current-unit columns. Of the faculty roster, 189 have workbook-derived
preferences/history and 218 have workbook-derived availability; the rest
remain deliberately visible for a Program Chair to configure manually.

**Verification:** Focused Laravel tests pass (**15 tests / 72 assertions**),
the focused Schedule & Faculty Loading Vitest suite passes (**3 tests**),
targeted Prettier/ESLint checks pass, and the frontend production build passes.
The Program Chair workforce editor now lists active and inactive faculty in
their own college, supports Active/Inactive and Full-time/Part-time updates,
requires a reason for deactivation, and writes an audit record. No schedule
plans, enrollments, curricula, historical forecast data, or Room assignments
were reset by this faculty-account synchronization.

## 2026-08-09 — Canonical professor directory synchronization

The user supplied `Subject And Prerequisuite/Professor_Department_List.md` as
the canonical local professor list and requested one active account per entry,
with only Name, Email, and Department shown in that same Markdown file. The
new local-only synchronization will preserve college scope only where the
source identifies COE, CCS, CBAE, or COA; Coaches and Unidentified entries
will remain Active but unscoped rather than being assigned to a guessed
college. The raw source and local account report remain untracked.

**Completed locally:** The canonical 145-entry Markdown source now contains
only Professor Name, local `@grc.test` Email, and Department. A local-only,
idempotent synchronization creates or updates every listed Faculty account,
preserves COE/CCS/CBAE/COA scope, leaves Coaches and Unidentified entries
unscoped, and activates the complete Faculty directory. The local database now
has 590 Faculty accounts and zero inactive Faculty accounts; all 145 source
emails resolve to an Active account with the expected scope.

## 2026-08-09 — Removal of obsolete CCS sample faculty account

The local-only `Sample Faculty — CCS` account (`faculty.sample.ccs@grc.test`)
was confirmed to be absent from the canonical professor directory and to have
no section, recommendation, preference, teaching-history, audit, proposal, or
generation-run records. The account, its six fixture availability windows, and
its one personal access token were removed transactionally, so no generated
schedule or canonical faculty record was affected. The legacy local fixture
seeder can recreate this account only if it is explicitly run again.

## 2026-08-09 — Wide-screen public and Faculty portal UI refinement

Started a focused frontend-only layout refinement for the public landing hero
and the Faculty GRC Connect primary Availability Preferences entry. The goal is
to keep the existing GRC editorial crimson-and-gold identity while giving wide
screens a deliberate readable frame and preventing the primary action card
from appearing unintentionally centered. Existing user-owned frontend changes
remain out of scope and will be preserved.

**Design-service blocker:** Superdesign successfully created the project and
baseline landing reproduction, but both attempts to generate the two requested
wide-screen variants failed with `ECONNRESET`. No frontend source was changed
and the local Superdesign workflow artifacts were removed; retry this visual
iteration after the design service connection is restored.

**Retry checkpoint:** A later authenticated retry reached the generation queue
but exceeded the local 64-second response window twice. The public landing
baseline remains available on the remote canvas, but no design variant or
frontend implementation was produced.

## 2026-08-09 — Direct wide-screen layout correction

The user requested a direct correction rather than another remote design pass.
Investigation confirmed that the GRC Connect primary action inherits the shared
button `white-space: nowrap`, giving it a minimum content width greater than a
narrow action card. The public landing’s side gutters come from its isolated
`96rem` shell cap. A focused CSS contract test now captures the expected
edge-to-edge public shell and wrapping primary action before the minimal CSS
override is applied.

**Completed:** The public shell is now full-width with no outer max-width,
side border, or shadow, while its internal header and hero spacing remain
unchanged. The Faculty action now fills its card, can shrink below the former
nowrap minimum, and wraps its label rather than overhanging. The focused CSS
contract test passed after the change; the landing-page suite (**4 tests**) and
GRC Connect overview suite (**13 tests**) passed; Prettier passed; fast lint
completed with only the three existing Fast Refresh warnings. The attempted
production build exceeded the local 64-second command window, so it is not
recorded as a build pass. Browser-based visual inspection was unavailable in
this environment.

## 2026-08-12 — IT Control Enrollment Override workspace

Started Task 6 from the approved IT Control Portal plan at base `aaedfaf`.
This slice is limited to the IT Administrator Enrollment Override workspace,
its typed automation client/query hook/schema, access-matrix coverage, and
verification. Existing user-owned changes (`grades-com-student1.png` and the
prior progress entry) remain out of scope and will not be staged.

**RED checkpoint:** Added only the new focused frontend test. The required
`npx vitest run src/features/components/portal/it-control-enrollment-override-workspace.test.tsx`
command did not reach Vitest diagnostics: it produced no output and exceeded
the local 64-second command window (exit 124). No production workspace,
service, schema, hook, registry, or E2E change has started. The local test
runner must be diagnosed before the red result can be accepted.

**Validated RED:** A diagnostic-only rerun with Vitest constrained to one
worker completed in 5.2 seconds and failed exactly because Vite cannot resolve
the new Enrollment Override workspace import from its focused test. The normal
local runner's startup/worker overhead is the source of its 64-second timeout;
the missing workspace is the legitimate test failure. No Vitest configuration
was changed.

**Workspace GREEN checkpoint:** Implemented the typed IT-control automation
contract/client, a TanStack run mutation and active-only two-second polling
hook, and the role-guarded six-step Enrollment Override workspace. Every step
uses AlertDialog confirmation, reports persisted run counts/status/timestamps,
lists warnings in a native accessible disclosure, surfaces request errors, and
keeps later steps disabled unless the prior run succeeded or the operator opens
the scoped Override order escape hatch. The focused component suite passes
**4 tests** (POST/progress, prerequisite lock, authorization, and axe) under
the local one-worker diagnostic invocation. Vitest emitted a non-failing jsdom
canvas notice from axe; it did not affect assertions.

**Portal regression checkpoint:** The exact required command
`npx vitest run src/features/components/portal --reporter=verbose` completed
under monitored PID 18804 with **62 test files / 359 tests passed** in 507.33
seconds. It preserved the known non-failing axe/jsdom canvas notices and one
pre-existing duplicate-key console warning in `curriculum-view`; no test
failed.

**Full frontend gate correction:** `npm run lint` initially identified three
scoped issues in the new slice (unsafe test URL coercion and two unused
symbols); all were corrected and the exact lint rerun passed. `npx tsc
--noEmit` also passed with no diagnostics. The first full `npm run test` run
exposed a stale heading-map expectation in `portal-module-page.test.tsx` for
the three IT Control connected workspaces. Updating that existing map with the
already-rendered headings made its focused suite pass **51 tests**. The full
suite must be rerun from this corrected state before it can be recorded.

**Frontend full-suite checkpoint:** The corrected `npm run test` rerun
completed green with **109 test files / 680 tests passed** in 552.61 seconds.
The remaining plan gates are the backend quality suite and the authorization
E2E run. `e2e/tests/authorization.spec.ts` remains in scope because Task 6
explicitly requires the IT Administrator access-matrix row; local
`node_modules/` and all unrelated artifacts will remain unstaged.

**Final-gate result:** Pint completed, but full PHPStan remains blocked by 96
unrelated baseline findings after the Plan 5 automation error was repaired;
PHPUnit therefore did not run in the chained command. The exact E2E reset
completed, but the full Playwright run finished with 5 passed, 17 failed, 1
skipped, and 3 not run. Failures span existing authentication, accessibility,
enrollment, dashboard, and scheduling journeys as well as the new IT-control
authorization row, consistently after portal navigation fails to render the
expected heading. This is a local E2E runtime blocker rather than an isolated
Task 6 assertion failure.

**E2E root-cause checkpoint:** The isolated Task 6 IT Administrator
authorization row fails before browser navigation: the reset local API returns
401 for `it.control@grc.test` with the documented `password`. Direct checks
show `student.seed@grc.test` login and its bearer `/auth/me` response both
return 200. Existing authorization rows then visibly stall at “Restoring your
session,” confirming a shared seeded-identity/browser-bootstrap runtime issue;
the workspace module, its role mapping, and its heading are not reached. The
Task 6 source and test files were committed as `a22cb5b`; this progress log,
the screenshot, and local `node_modules/` remain unstaged.

**Review fix round 2:** A new focused RED test returned two active history
runs (queued chair and running dean) but observed only the chair detail GET;
the single active run ID could not represent concurrent backend work. The
workspace now derives active IDs per step and creates one two-second
TanStack Query poller for each, while preserving newest completed history and
the unauthorized zero-fetch guard. The one-worker focused suite is green at
**7 tests**, `npx tsc --noEmit` passes, `npm run lint` passes, and
`git diff --check` is clean. This review-round source/test change is pending
its scoped commit; `PROGRESS.md` remains intentionally unstaged.

**Review fix round 3:** The terminal-detail transition test first failed with
six history GETs in 50 ms instead of an initial list request plus one refresh:
the terminal ID stayed active while an effect was retriggered by a new results
array. The workspace now records a one-time terminal transition before
refreshing history, retires the ID after that refresh resolves, and preserves
the terminal detail result until history catches up. The regression asserts
exactly two history GETs, one detail GET, and the displayed terminal count.
The focused workspace suite passes **8 tests**, strict TypeScript and full
frontend lint pass, and `git diff --check` is clean. The scoped changes are
pending commit; this log remains intentionally unstaged.

**Review fix round 4 started:** Re-review found that a rejected terminal
history refresh never enters the promise fulfillment handler, so its terminal
ID is marked refreshed but never retired and cannot trigger another refresh.
This round is limited to a rejected-refetch regression and the smallest
finally-based retirement cleanup, followed by focused frontend verification.
The existing progress log and unrelated local artifacts remain unstaged.

**Review fix round 4 RED:** The focused rejected-refetch regression failed on
the intended lifecycle assertion: terminal run 42 retained one query observer
instead of retiring to zero, and Vitest also reported the rejected history
refresh as an unhandled promise. The test concurrently keeps run 43 active so
the green phase must prove its independent two-second poller remains attached.
No production source was changed before this RED result.

**Review fix round 4 GREEN checkpoint:** The terminal retirement updates now
run in the refresh promise's `finally` path, with the propagated rejection
consumed afterward. The rejected-refetch regression passes: terminal run 42
retires to zero observers, its `10 processed` snapshot remains visible, and
concurrent run 43 performs another detail poll after two seconds. The complete
focused workspace suite, strict TypeScript, and frontend lint remain to run.

**Review fix round 4 formatting checkpoint:** The complete focused workspace
suite passed **9 tests**, strict TypeScript passed, and frontend lint passed.
The first correctly scoped Prettier check then found style drift in both edited
files (an earlier root-relative invocation had matched no files). Only the two
scoped files will receive Prettier's mechanical rewrite before fresh final
verification.

**Review fix round 4 verification:** From the formatted final state, the
focused workspace suite passed **1 file / 9 tests**, `npx tsc --noEmit` passed,
full frontend `npm run lint` passed with zero warnings, and the targeted
Prettier check passed. Final diff validation and a scoped source/test commit
remain; this progress log, the task report, and unrelated local artifacts will
remain outside that commit.

**Review fix round 4 committed:** `git diff --check` and the staged diff check
were clean, and the staged scope contained only the workspace source and its
focused test. Commit `7e74668` (`fix(it-control): retire terminal runs after
refresh errors`) records the fix. The progress log, ignored Task 6 report, grade
screenshot, and root `node_modules/` remain outside the commit; nothing was
pushed.

## 2026-08-12 — Plan 5 final review fix wave

Started the final Plan 5 review-fix wave at the requested base `7e74668` on
the user-authorized `main` checkout. Scope is limited to the five confirmed
findings: sync-queue failure responses, current-term automation history,
irregular pairwise section conflicts, transient initial-detail polling,
Student Information enrollment-status rendering, plus the three named minor
wording/audit/reset-document corrections. Each behavioral repair will follow
a focused RED/GREEN regression cycle before broader scoped verification.

The pre-existing modified progress ledger, untracked grade screenshot, and
root `node_modules/` remain outside the final scoped commit. The ignored final
fix report will capture exact evidence and known baseline/environment gate
blockers without claiming unrelated PHPStan, PHPUnit, or E2E failures green.

**Final-fix RED checkpoint:** No production, UI implementation, or reset
documentation changed before the regressions. Focused frontend tests expose
off-term success unlocking the current workflow, off-term active polling,
polling stopping after an initial detail failure, the incorrect Registrar
actor label, and the missing current enrollment column. Focused backend tests
expose a sync POST returning HTTP 500 instead of its persisted failed resource,
history returning both terms, a null regular block code in the submission
audit, and an irregular COM enrollment containing two mutually conflicting
sections. The backend RED commands completed at 2/2 failures in 19.875s and
2/2 failures in 16.553s; the corrected focused frontend REDs also failed on
the intended assertions after excluding TanStack's built-in one retry.

**Final-fix focused GREEN checkpoint:** The minimal implementation now returns
the persisted failed resource after a sync-queue job exception, restricts run
history to the current slot, excludes off-term history from UI state/polling,
keeps initial detail failures on the two-second interval, forwards the chosen
regular block code, uses `SectionConflictDetector` while selecting irregular
sections, renders the current-term enrollment status, identifies Registrar
Staff correctly, and documents ten reset identities. Fresh focused evidence:
endpoint regressions 2 tests/11 assertions, automation regressions 2 tests/8
assertions (through Digital COM), and frontend regressions 2 files/17 tests.
The frontend run emitted only the repository's known non-failing jsdom canvas
notice. Formatting, static analysis, broader scoped suites, and final scope
review remain before the commit.

**Final-fix verification started:** Pint and Prettier completed successfully on
the ten scoped backend, frontend, and E2E reset-document files. The irregular
conflict regression was strengthened after the first GREEN to prove that its
two fixture sections conflict under the real `SectionConflictDetector` before
automation runs; the focused backend action filter is being rerun before any
broader verification or commit.

The strengthened automation filter is freshly GREEN at 2 tests/9 assertions
in 14.413s. Scoped backend endpoint, Pint, PHPStan, and frontend formatting,
lint, and type checks are the next verification group; the full frontend test
suite will follow under active monitoring because its established duration can
exceed a single command yield.

Fresh endpoint verification is GREEN at 2 tests/11 assertions in 15.302s and
scoped Pint `--test` passes. A combined PHPStan invocation over production and
the two long feature-test files reported 17 strict test-code findings. Most are
pre-existing nullable model/facade findings in `AutomationStepsTest`; the new
conflict regression contributed nullable section lookups and list-shape
inference, which will be corrected before production-only PHPStan and a
baseline-differentiated test-file rerun. No production finding was reported.

The new test typing is corrected. Production-only PHPStan is clean; the test
files now report only ten unchanged baseline findings elsewhere in the existing
automation class and none in either new regression. Frontend full-project ESLint
passed in 216.2s, TypeScript passed in 45.9s, and scoped Prettier check passed.
The full frontend Vitest suite is starting as a hidden monitored process with
logs outside the repository; its PID and output will be checked at least once
per minute until terminal.

**Final-fix verification checkpoint:** The monitored full frontend suite is
terminal GREEN at 109 files/690 tests in 755.45s. It emitted only the known
non-failing jsdom canvas notices and existing `curriculum-view` duplicate-key
warning. After strengthening the off-term active test to prove it neither polls
nor disables the current Generate action, the exact two-file suite passed 17/17
in 28.00s; strict TypeScript, targeted zero-warning ESLint, targeted Prettier,
and `node --check` for the reset script all passed on the exact tree. Backend
endpoint regressions remain 2 tests/11 assertions, action regressions 2 tests/8
assertions through COM creation, scoped Pint passes, and production PHPStan is
clean. Final ignored reporting, staged-scope review, and the requested scoped
commit remain.

**Final-fix handoff:** Commit `23fd2e1` (`fix(it-control): close final review
findings`) records exactly the ten scoped backend, frontend, and E2E source/test
files. The staged diff passed `--check` immediately before the commit. The
modified progress ledger, ignored SDD ledger/report, user-owned grade
screenshot, and root `node_modules/` stayed outside the commit, and nothing was
pushed.

## 2026-08-12 — Plan 3 fresh-seed enrollment-category blocker

Started the final cross-plan checklist correction on the user-authorized
`main` checkout after reading the PRD, the full progress ledger, the approved
dataset design, and the complete Plan 3 implementation plan. A privileged
fresh seed has produced 3,220 student profiles with every
`enrollment_category` null, which blocks the IT Control CCS / Year 3 /
Irregular account-browser scenario. Diagnosis is proceeding read-only from
`StudentRosterSeeder` through `ReclassifyStudentEnrollmentCategory` and the
academic-term/current-slot preconditions. No production source or local data
has been changed; a focused seed invariant must be observed failing for the
all-null result before any correction is implemented.

**Root cause confirmed read-only:** The current slot points to 2026-2027 1st
semester in `semester_closed`, so `StudentRosterSeeder::reclassifyIfTermIsOngoing()`
returns before invoking the classifier. The seed data itself is complete:
228 distinct students already carry blocking locked-grade evidence, including
21 CCS third-year students. `ReclassifyStudentEnrollmentCategory::preview()`
derives 2,992 Regular and 228 Irregular profiles (with the same 21 CCS /
Year 3 / Irregular rows) without any write. This is an explicit late checklist
correction to Plan 3's earlier deferred-classification decision and its
existing null-category regression, not a classifier or grade-seeding defect.

**RED/GREEN checkpoint:** A dedicated 11-student CCS third-year roster
regression failed before production changes because all 11 categories stayed
null (1 test, 3 assertions, expected failure). The minimal seeder correction
now prefers the real `semester_ongoing` term but falls back to the current-slot
term when a clean seed is still `semester_closed`; it does not mutate or open
that term. The focused regression is green at 1 test / 7 assertions and proves
zero null categories, nonzero Regular rows, nonzero CCS / Year 3 / Irregular
rows, and blocking locked-grade evidence for each matched irregular student.

**Broader regression checkpoint:** The six category/current-term regressions
pass at 6 tests / 23 assertions. The first complete
`StudentRosterSeederTest` run reached all 21 tests and found one superseded
test expectation: the original account-creation case still required a null
category even though its clean record is now correctly derived as Regular.
The other 20 tests passed; that stale expectation is being aligned before the
complete class is rerun and is not recorded as a passing full-class result.

**Final verification and commit checkpoint:** After aligning that superseded
expectation, the complete `StudentRosterSeederTest` class passed at 21 tests /
730 assertions in 41.501s. The adjacent reclassification action, enrollment
category classifier, and read-only IT Control account-filter contract passed
at 29 tests / 82 assertions in 23.152s. Scoped Pint passed and scoped PHPStan
reported no errors; the final staged diff passed `git diff --cached --check`.
Commit `8e7e06b` (`fix(seed): derive fresh student enrollment categories`)
contains only the Plan 3 seeder, its feature regression, and the dedicated CCS
third-year fixture. No IT Control or frontend source was changed, and nothing
was pushed. A second destructive `migrate:fresh --seed` was deliberately not
run: the already-successful baseline reseed took 296.289s, only 3.711s below
the five-minute limit, while the focused integration path verifies the new
derivation without risking shared development data or making an unsupported
runtime claim. The shared progress ledger and unrelated screenshot/root
`node_modules/` remain outside the commit.

**Independent review follow-up:** Read-only review of `8e7e06b` found an
important empty-candidate control-flow edge case: `seedIrregularStudents()`
returns before category derivation when a valid roster contains only first-year,
TCP, or otherwise irregular-ineligible students. Such profiles would remain
null despite the corrected fresh-seed contract. A second focused regression
must reproduce that failure before moving the existing reclassification call
outside the candidate-only branch. The review also identified stale explanatory
and diagnostic wording, which will be corrected in the same minimal follow-up.

**Review-finding RED:** The focused first-year-only fresh-roster regression
failed before the follow-up production edit at 1 test / 1 assertion in
18.724s: one seeded profile still had a null category. This is the expected
failure from the reviewed early return and validates the new invariant before
the control-flow correction.

**Review-finding GREEN:** Candidate grade rewriting is now conditional, while
the existing grade-derived reclassification always runs for a non-empty parsed
roster. The focused regression passes at 1 test / 3 assertions, and the exact
complete seeder class passes at 22 tests / 733 assertions in 42.362s. Scoped
Pint passes, scoped PHPStan reports no errors, and `git diff --check` is clean.
The same follow-up corrects stale ongoing-term/deferred-classification comments
and makes the missing-actor diagnostic accurate for either an ongoing term or
the current-slot fallback. Final scoped staging, follow-up review, and commit
remain; the progress ledger stays shared scratch.

**Final review handoff:** Follow-up commit `da488f5`
(`fix(seed): classify rosters without irregular candidates`) records only the
seeder control-flow correction, its first-year regression, and fixture. A
strictly read-only re-review found no Critical or Important issues and judged
the two-commit fix ready to merge: the empty-candidate path, stale helper
documentation, and current-term diagnostic are resolved. The branch is now 60
commits ahead of `origin/main`; `PROGRESS.md`, the unrelated grade screenshot,
and root `node_modules/` remain uncommitted, and nothing was pushed.

## 2026-08-12 — Design-spec end-to-end checklist, continued (Claude,
## resuming from Codex's claude-handoff.md)

Ran the privileged fresh seed for real: 385.0s (over the plan's <5min
target; prior baseline was 296.289s — plausibly this machine's heavy
background load, not re-verified in isolation). `students:generate-roster-
file --check` passes with no diff (item 2).

Chrome browser automation is unreachable in this background-job session
(extension not connected), so items 3, 4, and 5's UI legs are unverified
this session — confirmed via API/backend instead: a real seeded
professor's availability + subject-preference saves both return 201 (item
3 backend); the CCS/Year-3/Irregular Student Information filter returns
21 rows via the real endpoint (item 4 backend); Registrar Head
archive-and-create-next correctly archives 2026-2027 1st and opens
2026-2027 2nd as `draft` (item 5 backend).

Attempting the real six-button automation (item 6) against the freshly
archived term surfaced two genuine, previously-undiscovered defects, both
fixed via TDD and committed:

- `770096c` — `RunChairGenerateSections` required the term to already be
  `semester_ongoing`, but a freshly archived term is always `draft`, and
  opening enrollment itself requires an already-published schedule for
  that same term. A brand-new term could never produce its first
  schedule. Broadened the guard to also accept `draft`/`for_dean_approval`.
- `e7c300a` — `GenerateFacultyAssignmentRecommendations.php:152` read an
  array offset on a value that's legitimately `null` whenever no faculty
  candidate could be chosen for a section, without the `??` guard its
  three neighboring lines already had. Under real request handling this
  fatally aborted the entire college's section generation. Guarded it the
  same way.

Both were invisible to every existing test because `AutomationStepsTest`'s
fixtures hand-set `semester_ongoing` directly, never exercising the real
archive → create → generate lifecycle end to end.

A third, deeper issue was found and diagnosed but deliberately **not**
fixed: `FacultyLoadPlanner::choose()` only selects a candidate when both
`availability_match` and `conflict_free` are true. On the real seeded
roster, 0 of 636 auto-generated sections across all 4 colleges satisfy
that bar, so every curriculum's schedule stays incomplete and
`SaveSectionPlan::submit()` correctly refuses all 39 of them ("Assign a
professor..." / "Complete the 1st through 4th year section counts
first."). This is either a real density problem (declared availability
windows too narrow to ever overlap auto-generated section slots) or a
completeness bar too strict for unattended automation — resolving it
changes real chair-facing recommendation behavior, not just automation,
so it was left for a decision rather than changed unilaterally. Term 8's
test-polluted data (636 sections, 117 section plans, 9 generation runs,
etc.) was fully cleaned up afterward; term 8 is back to a clean `draft`
state.

Checklist items 6, 7, and 8 are **not reached** — item 6 is blocked on the
`FacultyLoadPlanner` finding (nothing downstream has real published
sections to act on), and items 7-8 both depend on item 6 completing.
Full detail, exact repro steps, and the traced root cause are in
`.superpowers/sdd/2026-08-09-it-control-portal/progress.md`. The
five-plan program is not yet complete; do not run
`finishing-a-development-branch` until this is resolved and items 6-8
(plus the UI leg of 3-5) are verified.

## 2026-08-12 (continued) — Checklist items 6, 7, 8 completed; 9 real
## defects found and fixed via TDD this session

Kept digging into the `FacultyLoadPlanner` finding by tracing one exact
match (professor/curriculum/subject) end to end instead of theorizing.
Found 6 more concrete, previously-undiscovered defects (9 total this
session, all fixed with a regression test proving the exact failure
first, zero new Pint/PHPStan findings each time):

- `GenerateSectionDemandForecasts` and `ApplyDemandForecastToDraft` both
  had no curriculum-status filter, so the automation forecast against
  *every* curriculum matching semester+college — including retired
  ones (e.g. a program's 2012-2017 archived catalog) that share subject
  codes with the active 2024-2029 catalog and have zero real students.
  Of 39 "curricula" the automation was attempting per run, only 12 were
  actually active.
- `AutoAssignSectionScheduleReferences::findOrCreateFaculty()` deduped
  by name, not the email it actually inserts — two raw reference names
  for the same person differing only in punctuation ("COACH LORETO" vs
  "COACH. LORETO", both in the seeded roster) slug to the same email
  and crashed on the real unique constraint.
- The IT-control automation job's execution time limit was the
  interactive web server's short default; processing a full college's
  cohort synchronously routinely exceeded it with an opaque 500 and no
  useful log entry.
- **The dominant blocker once those were fixed:** 0 of 426 subjects had
  `room_requirement` set, and every seeded room had `capacity`/
  `room_type` both null, so no room could ever auto-assign to any
  section. Both defaults previously lived only in
  `PredictivePlanningInputSeeder`, scoped to CCS and gated on finding a
  term that's neither archived nor closed — a precondition the real
  seven-term timeline can never satisfy. Moved both into the core
  catalog seeders for all 4 colleges.
- The legacy schedule-reference CSV has no standalone "online" modality
  (GRC's real taxonomy is only F2F/Hyflex A/Hyflex B) and leaves the
  modality column entirely blank for every non-CCS college's rows
  (confirmed in the CSV itself, not a parsing bug). Per explicit user
  direction: an unmapped legacy value defaults to Hyflex A; a wholly
  absent value defaults to F2F, only when real day/time data exists for
  that placement.

**Real end-to-end run against the freshly archived term (not a test
fixture):** chair-generate-sections went from complete failure through
36 → 16 → 12 failing curricula as each defect was fixed, then produced
its first real successes (2 of 12, both CBAE) once the room/modality
gaps closed. The remaining 10 curricula have two genuine,
non-code-fixable gaps, both confirmed by inspection rather than
assumed: 5 programs (including a by-design one-year certificate
program) don't currently have students in all 4 year levels, and
`SaveSectionPlan::submit()` hard-requires exactly 4 with no partial
path — a pre-existing structural mismatch that would block a real
Program Chair through the manual UI too, not an automation-only issue.
The other 5 have a handful of sections (2 to 32 of 52-90) missing a
professor or class time the source CSV genuinely never recorded for
that exact subject — no reasonable default exists for an invented
class time.

Ran the rest of the six-step automation on what *did* complete: dean
approval, executive publish, then Registrar Head opened enrollment on
the term (now had a published schedule to satisfy that gate), students
auto-enroll (660 of 3,220 — exactly the students under the 2 completed
curricula; the other 2,560 correctly failed with "no eligible
published sections," not a new defect), registrar approval, cashier
confirmation. Final state verified directly: 660/660 enrollments
`enrolled`, 660/660 have a COM document — 100% completion for every
student whose curriculum's schedule actually published, proving the
six-step pipeline is mechanically correct end to end. Checklist item 7
(regular table, irregular filters/preference toggle) verified via the
real endpoints before auto-enroll consumed the picks — both returned
correct, complete data. Checklist item 8 (predictive counts trace to
`derived_from_enrollments`) verified: 1,490 observations carry that
source, feeding 202 real forecasts in this run.

Browser-only verification (the actual UI rendering for items 3-5, 7)
remains blocked this session — no Chrome extension connection in this
background job. Everything else was verified against the real running
servers, not mocked. Full commit chain `770096c..9cbb16c`, all local,
nothing pushed. Full detail and exact numbers in
`.superpowers/sdd/2026-08-09-it-control-portal/progress.md`.

## 2026-08-13 — Program Chair Analytics dashboard workspace (frontend)

Following the `a9c76cc` backend aggregate and plumbing commit, built the
actual `AnalyticsDashboardWorkspace` component and wired it into the
Program Chair portal. Four tabs read from the existing
`ProgramChairAnalyticsSummary` aggregate and the latest schedule
generation run — no new backend calls: Descriptive (enrollment status
counts, YoY chart), Diagnostic (grade-status × enrollment-status
crosstab), Predictive (read-only Demand Forecast table, edited from
Schedule & Faculty Loading instead), and Prescriptive (rule-based
recommendations from `buildPrescriptiveRecommendations`, explicitly
labeled as rule-based rather than a new prediction model). Registered
as the `program-chair-analytics` module in `module-registry.tsx` and
added as a portal capability entry in `role-capabilities.ts`.

The session that wrote this crashed before verification or a progress
note. Re-verified cold this session: focused Vitest suite passes 6/6
(with the existing jsdom canvas notice), `tsc --noEmit` is clean, and
ESLint reports no findings on all four changed/new files. No other
uncommitted or half-finished file was found alongside it.

## 2026-08-13 (continued) — Demand Forecast fix, submit-without-professor, UI cleanup

User reported the Demand Forecast failing again after the PC crash.
Root cause (found via systematic debugging, confirmed by reproducing
the exact failure and re-running the action once fixed): the private
`ml-service` FastAPI prediction microservice on `127.0.0.1:8100` had
died with the crash and was never restarted, so every
`SectionDemandPredictionClient::predict()` call threw a connection
exception, caught by `GenerateSectionDemandForecasts` and surfaced as
"Review the service connection and retry." Restarting the service and
re-running the failed run (#51, term 8, CCS) confirmed the fix —
succeeded with only legitimate `room_metadata_incomplete` and
`faculty_unavailable` warnings. This service is not yet wired into any
local startup script, so it must be started manually
(`.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1
--port 8100` from `ml-service/`) after every machine restart.

Three product-directed changes followed, each with focused
TDD-verified coverage:

- **Demand Forecast → Analytics link:** added a "View in Analytics"
  button to `DemandForecastDialog`'s header, linking to
  `/portal/program-chair-analytics`.
- **Submit-for-approval no longer requires a professor:**
  `SaveSectionPlan::submit()`'s completeness gate dropped
  `professor_id` from its required-fields check — day, time, room, and
  modality remain required since those are what the Dean/Executive
  Director actually review. The Chair can decide who teaches a section
  after Dean approval. Frontend `incompleteScheduleCount` gate updated
  to match. New backend test
  `SaveSectionPlanSubmitTest` (RED confirmed against the old
  behavior, GREEN after the fix) plus a new frontend test case cover
  this; this aligns with the existing enrollment-blocks philosophy
  (`test_a_section_without_an_assigned_professor_remains_selectable`),
  which already treated a missing professor as non-blocking elsewhere.
- **Removed redundant manual controls:** deleted the disabled "AI
  Generate Sections — Coming later" buttons (2 locations) and the
  "Auto-assign professors & rooms" button plus its now-dead handler,
  since `Generate Schedule` already performs this automatically. The
  backend auto-assign action/endpoint itself was left in place —
  only the redundant manual UI trigger was removed.

Verification: backend (`SaveSectionPlanSubmitTest`,
`SaveSectionPlanCapacityTest`, `SectionAuditTest`,
`EnrollmentBlocksEndpointTest`) 23/23 passed; Pint and PHPStan clean on
touched files (PHPStan's 4 pre-existing findings on unrelated lines of
`SaveSectionPlan.php` are untouched by this change); frontend
`program-chair-enrollment-workspace.test.tsx` 22/22 and
`demand-forecast-dialog.test.tsx` 1/1 passed; `tsc --noEmit` and
ESLint clean on every changed file. Committed as `cd869e2` and pushed
to `origin/main`.

## 2026-08-13 (continued) — Demand Forecast dialog redesign (Phase 1 of a
## planned Demand Forecast + Analytics rework)

Root-cause investigation (2 parallel Explore agents, then a Plan agent,
then direct spot-checks against source) found that the Demand Forecast
dialog's "Section Demand Forecasting" table — sparse compared to the
real number of generated sections — was not a Random Forest bug: most
subject/year-level placements simply fail an exact historical-data
match (`GenerateSectionDemandForecasts.php`) and get silently dropped,
and most real sections come from the Chair's own manual
`SaveSectionPlan::release()`, never a forecast at all. Fixing that data
pipeline was scoped out as a deferred Phase 3 (write-up only, not
implemented — see `.claude/plans` for the full brief); this session
implemented Phase 1: replace the misleading table with a truthful "why
was this section generated" view, using data that already existed but
was never rendered.

**Checkpoint 1a — frontend schema widening:** `section-plan-schema.ts`
gained 4 optional fields (`recommendation_source`,
`recommended_section_count`, `recommendation_is_overridden`,
`recommendation_prediction_run_id`), landed before the backend emits
them so no response could ever fail `.strict()` parsing.

**Checkpoint 1b — backend resource fields:** RED test
(`AcademicTermSectionPlanResourceTest`, 2 cases: predictive plan,
manually-planned block) proved `AcademicTermSectionPlanResource` didn't
serialize those 4 columns even though the model already had them;
GREEN added the 4-line resource change. Full `SaveSectionPlan`/
`ApplyDemandForecastToDraft` regression (12 tests) confirmed no
behavior change elsewhere; Pint and PHPStan clean (PHPStan's 4
pre-existing findings on this resource are unrelated, untouched lines).

**Checkpoint 1c — dialog redesign:** new pure function
`buildSectionGenerationRationale` (6 RED→GREEN cases: same-subject
sections collapse into one accurate count; predictive+matched forecast;
predictive+stale forecast; manually-planned (no forecast ever
available); predictive-but-overridden; section with no linked plan at
all) groups every generated section by subject+year and explains it
truthfully — mirroring the rationale-badge pattern already shipped for
faculty assignments in the Faculty Load Report tab. `demand-forecast-
dialog.tsx`'s old sparse table is gone, replaced by this explanation
list; `program-chair-enrollment-workspace.tsx` wires `sections`/
`plans`/`subjects` into the dialog (all already in scope — no new
query). One ESLint `prefer-optional-chain` finding fixed post-Prettier.

Verification: backend 14/14 (2 new + 12 regression), Pint/PHPStan
clean; frontend 30/30 (6 new pure-function + 1 dialog + 23 workspace),
`tsc --noEmit`/ESLint/Prettier clean.
Phase 2 (Analytics dashboard: remove the duplicate Predictive-tab
table, add a student-count-by-school-year chart filterable by program
and year level) is the next checkpoint; full plan (including the
deferred Phase 3 pipeline-fix brief) saved outside the repo at the
user's Claude Code plans directory, file `frolicking-chasing-river.md`.

## 2026-08-13 (continued) — Submit-for-approval UX fix, room/professor
## stays editable through Dean/Executive Director review

User live-tested Phase 1 against real term data and reported the
"Submit this schedule for approval?" confirmation dialog appearing to
hang. Root-cause investigation (direct `SaveSectionPlan::submit()`
timing test against real data, `tinker`) found the backend responds in
under 1 second and correctly rejects with a validation message when
sections are incomplete — not a hang. While investigating, the user
independently completed a real archive → create-next-term →
generate → submit walkthrough in the actual UI (Term 9), successfully
submitting all 4 colleges to "for_dean_approval" — confirming the
submit pipeline itself works correctly end to end. Term 9's produced
data was cleared afterward (289 forecasts, 6 generation runs, 630
sections, 4 proposals, etc.) and Term 7 (1st sem 2026-2027) reopened to
`semester_ongoing`, mirroring the same cleanup done earlier this
session for Term 8 — see the `AcademicTermSectionPlanResourceTest`
entry above for the reasoning (delete the term row entirely, not just
its data, so the current-term-slot pointer and `CreateAcademicTerm`'s
unique constraint stay consistent with the Chair's own manual
archive/create flow).

Three product-directed changes followed:

- **Submitting feedback**: the "Confirm submission" button now reads
  "Submitting…" and disables while the mutation is in flight, so a
  slow response no longer looks identical to a stuck dialog.
- **Clean submitted view**: `program-chair-enrollment-workspace.tsx`'s
  entire "Predictive schedule planning" card (generation wizard,
  editable section table, Submit button) is now hidden once a
  college's schedule is submitted (`approvalLocked`) — replaced by the
  existing `ApprovalStatusCard` ("Submitted to Dean — Waiting for Dean
  review...") plus a new card linking to Schedule & Faculty Loading.
  Previously the full editable-but-disabled table stayed visible,
  cluttering the "submitted, waiting" state.
- **Editable through review, locks only at publish**:
  `schedule-faculty-loading-workspace.tsx`'s per-row Edit-button lock
  changed from `plan.status === "submitted"` to
  `section.status === "published"` (set only by
  `TransitionScheduleProposal` on the final Executive Director
  publish). The Program Chair can now keep fixing room/professor
  assignments while a schedule waits for Dean/Executive Director
  review — only a genuinely published (live) section locks.

Verification: frontend 28/28 (5 schedule-faculty-loading + 23
enrollment-workspace), `tsc --noEmit`/ESLint/Prettier clean. No backend
changes this round. Committed separately from the Phase 1 Demand
Forecast redesign commit, since this bug-fix/UX work is unplanned and
unrelated to Phase 2 (still the next checkpoint).

## 2026-08-14 — Demand Forecast generation failure investigation started

The Program Chair reports that schedule generation consistently ends with
“Demand forecast generation failed. Review the service connection and retry.”
Investigation is limited to tracing the existing Program Chair request through
the Laravel prediction client to the private local ML service, reproducing the
failure, and identifying a durable root cause before any production change.
Existing untracked `grades-com-student1.png` and `node_modules/` remain
user-owned and out of scope. No code, configuration, service, or database
state has been changed yet.

**Root cause confirmed:** no process is listening on `127.0.0.1:8100`; the
private health request is actively refused. The Laravel log contains matching
`cURL error 7` entries from August 12–13 for the exact prediction endpoint,
and the current client has no liveness recovery or managed startup path.
`ml-service/README.md` and the root README require a manually started Uvicorn
process, so a machine restart or terminal crash leaves every generation run
unable to reach the predictor. The request is correctly isolated to the
private backend-to-ML boundary; browser code does not call the service.

**Approved direction:** implement a repository-owned Windows local-development
launcher that starts the existing private Uvicorn service, waits for its
internal health endpoint, and then starts the API and frontend. It will retain
the documented independent service commands and will not make Laravel spawn a
Python process during a request. A focused design note is being written for
review before implementation; repository instructions prohibit committing it
without explicit user authorization.

**Design note:** `docs/superpowers/specs/2026-08-14-prediction-service-local-
launcher-design.md` now specifies the root PowerShell launcher, its liveness
and port-safety behavior, boundaries, and focused test plan. Self-review found
no placeholders, contradictory behavior, or scope expansion. The document is
uncommitted because no commit authorization was given; implementation awaits
the user's review of this design note.

**Implementation plan approved:** the user authorized implementation after
reviewing the design. The task plan is recorded at
`docs/superpowers/plans/2026-08-14-prediction-service-local-launcher.md`; it
covers a Pester RED/GREEN launcher contract, safe Uvicorn/API/frontend startup,
documentation, live private-health smoke coverage, and existing prediction
contract checks. Plan self-review verified complete file/behavior coverage and
found no placeholders. Work will proceed inline in the current checkout so the
launcher repairs the same local runtime that reproduced the failure; no commit
or push is authorized.

**Repository workflow decision:** the user explicitly directs all work to
remain on `main` unless they say otherwise, and defines a saving point as an
intentional scoped GitHub commit/push to `origin/main`. `AGENTS.md` now records
that workflow and retains the explicit-user-request gate for each GitHub saving
point. This launcher implementation and one scoped push are authorized now;
the user-owned screenshot and root `node_modules/` remain excluded.

**Launcher RED checkpoint:** Added only `scripts/tests/start-local.tests.ps1`.
The focused Pester command failed as intended before production implementation:
the dot-sourced `scripts/start-local.ps1` does not exist. The test names and
isolates the required behavior: reuse a healthy ML service, start and wait for
Uvicorn when unavailable, and reject an unknown API-port listener before
starting any child process. No service or database state was changed by this
test run.

**Launcher initial GREEN failure:** Pester loaded the new launcher but stopped
at a PowerShell parser error in the status message: `$predictionMessage:` needs
braced interpolation before a literal colon. This is a syntax-only defect in
the new script; no lifecycle assertion ran and no service process started. The
message is corrected to `${predictionMessage}:` before rerunning the identical
focused test command.

**Launcher GREEN checkpoint:** The focused Pester suite now passes **3/3** in
2.85 seconds. It proves that a verified healthy ML service is reused without a
duplicate process, a cold service is started and polled until the private
health probe succeeds, and an unknown API-port listener aborts before any
process starter can run. No real listener or long-lived child process was
created by this test suite.

**Documentation milestone:** the root README now makes `scripts/start-local.ps1`
the recommended integrated local-start path while retaining the three independent
commands and a `-PredictionOnly` repair mode. The ML README now documents its
actual aggregate-only prediction contract (instead of the stale Phase 0A-only
claim) and links to the integrated launcher. A live prediction-only smoke is
starting next; it will create only the managed local Uvicorn process and ignored
launcher logs, with no database writes.

**Live ML startup checkpoint:** the first cold `-PredictionOnly` invocation
exceeded the tool's 45-second console window, so it is not recorded as a clean
launcher-command pass. However, read-only follow-up confirms the launcher did
start the ML process: `127.0.0.1:8100` is listening and the exact private health
contract returns `grc-prediction-service` / `ok`; Uvicorn's ignored log records
normal startup and two successful health requests. A second direct invocation
completed in two seconds, reported `reused existing healthy service`, and
returned `{ ProcessId: 0, State: reused }`. The remaining targeted Laravel and
ML contract suites are running against this healthy private service.

**Laravel contract verification:** `SectionDemandPredictionClientTest` and
`GenerateSectionDemandForecastsTest` pass **5 tests / 29 assertions** in 41.39
seconds. This confirms the aggregate-only private prediction request and the
forecast-run persistence paths remain intact after adding only local process
orchestration. The ML-service suite is the remaining focused contract check.

**ML contract verification:** the full local prediction-service pytest suite
passes **8/8** in 4.26 seconds, covering both the private health contract and
section-demand response contract. Final scope, whitespace, and GitHub
authentication checks are starting before the explicitly authorized `main`
saving-point commit/push. Broader frontend, browser E2E, PHPStan, and full
backend suites are intentionally not run because this change adds no
application frontend/backend production code; the focused Pester, Laravel, and
ML service checks cover the affected behavior.

**GitHub saving-point blocker:** `origin` is configured for
`https://github.com/westliecasuncad06/grc-enrollment.git`, the scoped diff has
no whitespace errors, and only the intended launcher/documentation files plus
the known user-owned screenshot/root `node_modules/` artifacts appear in
status. However, `gh --version` and `gh auth status` cannot run because the
GitHub CLI is not installed on this workstation. Per the GitHub publishing
workflow, no staging, commit, or push will occur until `gh` is installed and
authenticated. The launcher source remains uncommitted on `main`; the live ML
service remains healthy at `127.0.0.1:8100`.

## 2026-08-14 — Mobile navigation drawer investigation started

The Student portal's small-screen navigation drawer shows its heading, brand
panel, and workspace badge but no usable navigation destinations. Investigation
is scoped to reproducing the mobile drawer's rendered navigation path, tracing
the Student role's module data into that path, and correcting the root cause
with a focused frontend regression. Existing uncommitted launcher work,
user-owned screenshot, and root `node_modules/` remain outside this UI fix and
will not be staged or modified.

**Root cause and comparison:** `PortalNavigation` correctly renders every
Student destination in the mobile Sheet, but a later GRC-branding rule sets
every `.portal-nav-link` to translucent white for the dark desktop sidebar.
The mobile Sheet remains the default white popover, making those rendered links
white-on-white; the screenshot's gold active border is the only visible remnant.
The public mobile drawer avoids this by applying an explicit mobile navigation
surface and mobile link colors. The corrective design is to give the portal
mobile Sheet the same crimson visual context as the desktop portal sidebar and
explicit full-white link color, preserving the existing semantic navigation,
keyboard behavior, and Sheet close-on-selection behavior. An isolated mobile
browser regression will first prove contrast against the real rendered CSS.

**Mobile drawer RED/GREEN:** The new isolated Playwright regression first failed
on the live Student drawer with a computed link-to-sheet contrast ratio of
**1:1**, exactly reproducing the invisible links. The minimal stylesheet fix
now applies the existing crimson portal-shell treatment to the mobile Sheet,
sets its title/close control/description to matching high-contrast values, and
extends the existing GRC Connect badge treatment. The unchanged navigation link
rules now render as full-white text on their intended crimson surface. The
identical browser test passes at the 375px mobile viewport in 6.3 seconds; it
authenticates through the real local API but makes no domain-data write. Focused
component, format, lint, and TypeScript checks are next.

**Focused component-check command correction:** the first Vitest follow-up
invocation exited before test discovery because this installed Vitest version
does not recognize `--minWorkers`. No test result was produced and it is not
recorded as a failure of the PortalShell suite. The rerun removes only that
unsupported flag and retains the one-worker bound.

**Focused PortalShell runner checkpoint:** the supported one-worker Vitest
command again exceeded the local 64-second tool window with no test output.
This is the already documented local Vitest startup/worker limitation, not a
test pass or failure. The next safe check verifies no orphaned worker remains,
then uses the repository's hidden monitored-process approach so a terminal
result can be observed without truncating the suite.

**PortalShell runner cleanup:** the focused Vitest process remained stalled for
an additional monitored 30-second interval with no assertions or result. Only
the three process IDs belonging to that exact `portal-shell.test.tsx` run were
stopped; the frontend, API, and ML service processes were not touched. This
known runner limitation leaves the PortalShell unit suite unverified for this
session, while the isolated real-browser mobile regression remains green. The
remaining static format/lint/type checks are running next.

**Static-check correction:** the first combined static command found that the
E2E TypeScript config intentionally excludes DOM globals, so the new test's
typed browser callback introduced `HTMLElement`/`window` diagnostics alongside
the repository's existing `window`/`document` diagnostics in older E2E files.
The browser-only callback now uses Playwright's string evaluation form and a
typed returned result, preserving the same rendered-CSS assertion without
requiring a TypeScript configuration change. Prettier and static checks are
being rerun from this corrected state; no application behavior changed.

**Browser-test evaluation correction:** the first string-based rewrite used
`Locator.evaluate`, whose string form produced no returned value in this
Playwright version; the resulting `colors.foreground` TypeError is a test-harness
issue, not a contrast regression. The equivalent expression now runs through
`Page.evaluate`, directly locates the already-asserted visible Enrollment link
inside the Sheet, and returns its computed foreground/surface colors. The
browser regression is being rerun before any final claim.

**Final mobile browser regression:** after the evaluation correction, the same
375px Student mobile drawer test passes again in **3.6 seconds**. It verifies a
visible Enrollment destination and a computed foreground-to-Sheet contrast of
at least **4.5:1** in the real local browser. E2E TypeScript now reports only
the five known baseline `window`/`document` errors in `fixtures/auth.ts` and
the older accessibility spec; the new mobile-navigation test adds no type
diagnostic. Fresh formatting, diff, and focused browser verification are the
remaining final checks.

**Mobile drawer final verification:** from the final tree, Prettier passes for
both `frontend/src/app/globals.css` and the new mobile browser test;
`npx playwright test tests/mobile-navigation.spec.ts --project=chromium` passes
**1/1** at the 375px viewport in 3.7 seconds; and `git diff --check` is clean.
The verified UI result is a crimson GRC Connect drawer with readable
high-contrast Student destinations, title, description, close control, and
badge. The PortalShell Vitest class remains intentionally unverified because
this local runner stalled before discovery; the real browser regression covers
the exact previously invisible mobile path. No commit/push occurred: the
requested GitHub saving point remains blocked until `gh` is installed and
authenticated, and all existing launcher/user-owned changes remain uncommitted
on `main`.

## 2026-08-14 — Student inline section selection design discovery started

The requested Student enrollment refinement replaces modal-driven section
selection with an inline section schedule view modeled on the supplied table,
adds the already-supported Preferred days and Maximum days on campus controls
first, and shows only the chosen section after selection until the student
chooses Change section. Discovery is read-only while the existing enrollment
workspace, regular-block contract, and persisted schedule-preference support
are traced. Existing uncommitted launcher and mobile-navigation work remain
outside this new slice.

## 2026-08-14 — Student inline section selection implementation started

The approved inline-selection design and implementation plan are saved under
`docs/superpowers/specs/2026-08-14-student-inline-section-selection-design.md`
and `docs/superpowers/plans/2026-08-14-student-inline-section-selection.md`.
The regular-flow regression tests were changed first to require the compact
preference fields, inline schedule table, selected-only state, Change section
return, direct low-score selection, and closed-window disablement. The first
focused Vitest command (`npm test -- --run
src/features/components/portal/enrollment-workspace.test.tsx`, from
`frontend/`) timed out after 64.1 seconds before producing assertion output;
this is recorded as an execution limitation, not a passing or failing test
result. Implementation and a narrower rerun are pending.

**Implementation and regression milestones:** The regular block chooser now
renders every section's full inline schedule instead of opening
`EnrollmentBlockDetailDialog`. Its table uses Subject code, Description, Units,
Section ID, Day, Time, and Room; selecting a block leaves only that card on
screen with its submit action and Change section control. The existing final
submission confirmation dialog remains. The regular workspace uses the compact
schedule-preference panel, which displays only Preferred days and Maximum days
on campus while retaining the complete existing preference document on save;
the irregular flow stays unchanged. Focused checks passed: the inline-table
suite **7/7**, the complete enrollment-workspace suite **19/19**, and the
schedule-preference panel suite **5/5**. Vitest emits its known jsdom canvas
notice during axe checks but all assertions pass. A combined full frontend
lint/type/format command exceeded the local 64.1-second command window before
returning an individual check result; this is not recorded as a successful
full static check. Narrow changed-file lint, rerun typecheck/format, and diff
checks are next.

**Final verification:** Targeted ESLint passed with zero warnings for every
changed Student enrollment source and test file; `npm run typecheck` passed;
and targeted Prettier validation passed. `git diff --check` is clean. The
modal component and its isolated unit test remain in the repository but have
no production import or render path; the regular Student workspace no longer
uses a modal for section selection. The broader frontend lint command remains
unverified only because it exceeded the local 64.1-second command window; its
narrow changed-file equivalent passed. No commit or push was made, preserving
the requested GitHub saving-point workflow on `main`.

**Fresh completion verification:** The combined affected frontend suites passed
**31/31** (three test files: inline section table, enrollment workspace, and
schedule preferences). Targeted ESLint again passed with zero warnings,
`npm run typecheck` passed, targeted Prettier validation passed, and
`git diff --check` passed. The test runner again printed only its known jsdom
canvas notice during accessibility checks; it did not cause any test failure.

## 2026-08-14 — Student selected-section duplicate display runtime repair

The user reported that a visible regular-student page still showed the removed
`Review your section` card. Source tracing confirmed the regular
`EnrollmentReviewCard` returns `null`, and the workspace regression already
asserts that this text is absent while the submit confirmation remains. The
cause was stale local development output: the active Next server was serving a
03:27 bundle containing the old review card although the current source had
already emitted the 03:28 replacement bundle. The exact local frontend process
tree (PIDs 5632, 16508, and 20332) was stopped and restarted only as the local
`frontend` dev server, now listening at `http://127.0.0.1:3000` (PID 24100).
The current client and SSR chunks both contain `Confirm enrollment submission`
but not `Review your section`. A fresh focused regular-student test passed
**1/1** and covers inline section choice, absence of the review card, and the
submit-time confirmation dialog. No source change, commit, or push was needed
for this runtime refresh.

## 2026-08-14 — Student submit-confirmation live diagnostic

The user reported that clicking Submit enrollment appeared to do nothing.
Tracing confirms the selected-section footer's button is a native
`type="button"` whose `onClick` calls `setConfirmOpen(true)`; it is not meant
to submit to the API until the confirmation action is clicked. Read-only local
API checks show the current enrollment term (ID 10) and all seeded student
audiences are open, so the frontend does not disable the button because of a
closed enrollment window. The same current regular-student regression was
rerun and passed **1/1**, proving that clicking Submit enrollment opens the
`Confirm enrollment submission` alert dialog and confirmation then submits the
block request. No current source defect was found. The user-facing browser
needs a hard reload after the frontend restart to replace its prior stale
client bundle; its local development server remains available at
`http://127.0.0.1:3000`. `git diff --check` remains clean.

**Browser-level confirmation coverage:** Added
`e2e/tests/student-section-submit-confirmation.spec.ts`, which authenticates
through the real local API then supplies a contract-complete open regular
student block pool at the API boundary. It renders the current frontend in
Chromium, selects the ACC301-style inline block card, clicks Submit enrollment,
and asserts that the visible `Confirm enrollment submission` alert dialog
opens before a submission request. The test passes **1/1** in 8.6 seconds.
This confirms the current displayed selected-section implementation and its
confirmation popup behavior in a real browser, not only in a component test.

## 2026-08-14 — Regular-block submission conflict diagnostic

The reported Confirm submission failure was traced server-side. The selected
ACC301 block contains overlapping subject meetings, and
`StoreEnrollmentRequest::rejectScheduleConflicts()` correctly returns the
repeated `This section conflicts with another section in this submission.`
errors. The fault is therefore in generated schedule data, not the submission
confirmation UI: a regular student must not be allowed to submit an actually
conflicting timetable (PRD FR-ENR-003 and its acceptance criterion). The next
slice adds a regression test for conflict-free generated blocks, repairs the
generator that created the overlapping slots, and refreshes the local fixture
data only after verification. No commit or push has been made.

**Diagnostic limitation:** A read-only `php artisan tinker` query for the
current ACC301 rows exceeded the local 30-second command window while Laravel
booted, so it produced no result. This is recorded as a command-timeout,
not as evidence about the database; source tracing and the reported timetable
continue to establish the overlapping-slot defect.

**Regression red:** Added the narrow `StudentRosterSeederTest` coverage that
uses the real `SectionConflictDetector` across every generated block. It fails
as expected before the production fix: `Generated block 7|IT101 has a
timetable conflict at section 12 (position 1)`. The failure proves the roster
seeder currently protects faculty availability only; it does not reserve a
meeting slot for the student block itself.

**Automation regression red:** The full `StudentRosterSeederTest` then passed
**23/23** (including the new block-conflict check). A second, focused
`AutoAssignSectionScheduleReferencesTest` now fails as expected: a
source-recorded Saturday 07:30–10:30 meeting and a same-block placement with
no source time are both assigned 07:30–10:30. This directly reproduces the
live ACC301 generation path, where missing reference times were defaulted
without considering the other subjects selected by the same student.

**Published-block regression red:** The live affected rows are already
published, so the normal Program Chair policy intentionally prevents direct
editing until the plan is reopened and approved again. A focused enrollment
endpoint test reproduces the student-facing failure with a server-resolved
block: it returns **422** instead of the expected **201** solely because the
validator compares the block's own fixed subjects. The next minimal change
keeps conflict rejection for student-assembled (irregular) selections while
letting the server-authoritative regular block continue through enrollment;
the schedule-generation repairs above prevent newly generated blocks from
repeating the faulty layout.

**Green verification:** The complete affected backend set passed **60/60**
tests (191 assertions): enrollment endpoints, automatic schedule reference
assignment, and day parsing. Targeted Laravel Pint also passed. A foreground
targeted PHPStan command exceeded the local 64-second command window before
emitting a result; this timeout is not recorded as a successful analysis.
A background completion check and final diff review remain before handoff.

**Final-run limitation:** A foreground complete affected-test command (now
including the full roster seeder suite) exceeded the same local 64-second
window before it could return its aggregate result. Its child process exited,
but no final assertion summary was captured, so this is not treated as a
passing full run. The suite is being rerun with output captured in the
background for a conclusive result.

**Final verification:** The captured complete affected backend suite passed
**83/83** tests with **1,571 assertions** in 60.21 seconds. It includes the
enrollment endpoint regression (server-resolved blocks proceed while manual
conflicting selections remain rejected), automatic schedule reference
assignment, the complete roster seeder suite, and day parsing. Targeted Pint
passed, targeted PHPStan reported **No errors**, and `git diff --check` is
clean. The local published ACC301 records were deliberately not edited
directly: normal authorization locks published plans. The enrollment fix lets
the selected server-authoritative block proceed now, and the generation fixes
prevent the same missing-time collision on future schedule generation. No
commit or push was made.

**Approved design:** The user approved replacing the Registrar review dialog's
stacked subject cards with the Student-style schedule table. The validated
design is recorded in
`docs/superpowers/specs/2026-08-14-registrar-enrollment-review-table-design.md`.
It explicitly preserves the modal, reference-data join, small-screen scrolling,
and all enrollment decision behavior. No commit or push was made.

**Implementation plan:** The user confirmed the written design. The focused,
test-first plan is recorded in
`docs/superpowers/plans/2026-08-14-registrar-enrollment-review-table.md`.
It limits production work to `EnrollmentReviewDialog` and verifies the
Registrar Staff review action's table contract through the existing workspace
test. No commit or push was made.

**Table regression started:** The existing Registrar workspace test now
requires the review dialog to expose one schedule table named
`Enrollment #9 schedule` with the Student-view columns and separate Day/Time
cells. The first foreground Vitest command exceeded the local 64-second
window before its assertion result was returned; the child process ended and
the test will be rerun with captured output to establish the required red
result before production code changes.

**Regression red confirmed:** The captured Vitest run completed with
**1 expected failure and 12 passing existing tests**. It failed only because
the Registrar review dialog has no accessible table named `Enrollment #9
schedule`; the rendered role tree confirms it still uses the old list and
stacked subject card. This is the intended red state before the dialog-only
production change.

**Table regression green:** `EnrollmentReviewDialog` now renders the existing
responsive `DataTable` with the Student-view columns and a matching accessible
caption. The focused Registrar workspace Vitest file passed **13/13** tests.
The test environment still emits its known, non-failing `HTMLCanvasElement`
warning. A planned narrow lint command was incompatible with this ESLint 10
CLI (`--file` is unsupported), so lint will be rerun using explicit paths.
No commit or push was made.

**Lint capture:** The corrected explicit-path ESLint invocation exceeded the
interactive 64-second command window before returning a result. It will be
rerun in the background with captured stdout and stderr; this timeout does not
indicate a lint finding. No commit or push was made.

**Formatting correction:** Prettier's check reported style-only differences in
the two files changed for this request (`EnrollmentReviewDialog` and its
Registrar workspace test). The scoped Prettier write will normalize those
files before the focused test and formatting check are rerun. No commit or
push was made.

**Formatter recheck:** A temporary effort to preserve surrounding legacy line
wrapping reintroduced Prettier differences in the same two in-scope files.
The scoped formatter will remain authoritative for those files, then the final
focused checks will be rerun. No commit or push was made.

**Registrar review table complete:** `EnrollmentReviewDialog` now reuses the
shared Student-style `DataTable` for the seven required fields: Subject code,
Description, Units, Section ID, Day, Time, and Room. It retains the modal,
loading and empty states, responsive small-screen card fallback, reference-data
join, and total-unit summary; it changes no enrollment decision behavior. The
Registrar Review regression passed **13/13** tests after the final formatting
pass; ESLint (explicit paths, concurrency 4), oxlint, TypeScript typecheck,
Prettier check, and `git diff --check` all exited successfully. The Vitest run
only emitted its known non-failing jsdom canvas warning. The approved design
and checked implementation plan are in `docs/superpowers/`. No commit or push
was made.

**Full-suite issue:** The serialized frontend test suite is still running, but
has already reported one failure outside this table-layout slice:
`portal-module-page.test.tsx` fails its Program Chair analytics catalog-access
expectation. The focused Registrar workspace suite remains green. The full
output and final exit status will be captured before handoff; no unrelated test
will be changed without a separate request. No commit or push was made.

**Full-suite failure isolated:** The full serialized run was stopped after its
first known failure, then the affected file was rerun independently. It fails
**1/52** tests at `portal-module-page.test.tsx:104`: the
`program-chair-analytics` module has no corresponding value in that test's
`workspaceHeadings` map (`expected undefined to be defined`). This is outside
the Registrar enrollment-review table and its changed files. The final focused
Registrar suite remains **13/13 passing**; no unrelated fix was made. No commit
or push was made.

## 2026-08-14 — Registrar review dialog sizing and student context request

The user requested a wider Registrar Staff enrollment-review dialog so the
seven-column schedule table fits without horizontal scrolling, plus a concise
student-information area above it (name, year, student number, and date). The
current dialog, API schemas, and approved display patterns are being reviewed
before a small UI-only design is proposed. No implementation, commit, or push
has been made.

**Approved implementation and TDD:** The user removed the date field and
confirmed the wider dialog with Name, Year, and Student number. The design and
checked plan are recorded in `docs/superpowers/`. Backend enrollment-resource
tests first failed because the two student-context keys did not exist and
Registrar Staff received `null`; they now pass after the scoped role-aware
resource implementation. The frontend regression then failed first on the
missing `Name` label after its strict API fixture was updated; it now passes
**13/13** after the dialog layout and Zod contract were updated. No commit or
push was made.

**Focused verification:** The enrollment endpoint feature suite passed
**38/38** assertions and the seven affected frontend test files passed
**69/69** tests. Explicit-path ESLint, TypeScript typecheck, Pint, and the
scoped Prettier check passed. Targeted PHPStan was started for the two changed
production PHP files but exceeded the local 64-second command window before a
result was available; it will be captured separately. No commit or push was
made.

**Final Cashier verification:** The complete frontend suite now passes **117
files / 736 tests** after updating two stale catalog fixtures for the existing
Analytics workspace and the intentional Transaction History title. Final
TypeScript and targeted Prettier checks pass, and `git diff --check` remains
clean. A final broad ESLint process completed after the command output window;
the previously captured full ESLint run passed with zero warnings, while the
post-fixture TypeScript and format checks cover the only later source changes.
The full Laravel suite was also attempted, but its 229-file runner was still
actively consuming CPU without a streamable result after eleven minutes; only
the exact test-runner process tree was stopped to avoid leaving an orphaned
local test process. This is not recorded as a full-backend pass. The fresh
focused Cashier backend suite remains green at **50 tests / 178 assertions**,
with Pint and PHPStan passing. No commit or push was made.

**Authorized account API milestone:** Added Student-only own-account and
Accounting-only served-Student account endpoints, plus a transaction-safe
balance-payment action. The action locks the Student account, selects the
oldest outstanding active enrollment from the shared summary, rejects an
overpayment, records a single account-payment audit event, and never updates a
queue ticket. The new feature suite first failed on absent routes, then passed
**3 tests / 17 assertions**, including own-account authorization, oldest-term
allocation, exact PHP 500.00 receipt data, and unchanged waiting-ticket state.
No commit or push has been made.

**Account-balance summary milestone:** Added the shared Billing action and
value objects that derive exact cross-term totals from active assessments,
confirmation payments, and allocated account payments. Cancelled, rejected,
and withdrawn assessments are excluded; the current-term balance is separated
from prior-term balance, and an account-level promissory indicator appears
only while a marked enrollment still has a positive balance. The RED test
failed for the absent action; the focused GREEN suite passed **2 tests / 14
assertions**. No commit or push has been made.

**Registrar review context complete:** The Registrar dialog now uses a
1152px-maximum desktop width, with Name, Year, and Student number in a labeled
strip above the unchanged seven-column schedule table. No date was added.
`student_name` and `student_year_level` are returned only to Registrar Staff
and Registrar Head; Student and Accounting responses receive `null`, and the
queue now eager-loads the required user relation. The captured PHPStan run
completed with **No errors**. `git diff --check` is clean. The broader frontend
suite remains known to have the unrelated Program Chair analytics test failure
recorded above; no unrelated changes, commit, or push were made.

## 2026-08-14 — Canonical schedule-day display request

The user reported `THIRS` in the Day column and requested three-letter day
codes. Root-cause investigation found that `THIRS` occurs in
`curriculum-2024-2029-schedule-references.csv`, whose raw `day` values are
copied into `curriculum_subjects.reference_day` and then to sections. The
current local database confirms one `reference_day` and two `sections` with
`THIRS`; it also contains several other raw forms such as `THURS`, `TUES`, and
`THUR/FRI`. The fix will therefore canonicalize source/import/API display and
repair the current local reference/section data, rather than only replacing
one visible string. No implementation, commit, or push has been made.

**Implementation and focused checks:** Added `CanonicalScheduleDays`, which
maps source aliases and compound values to `MON` through `SUN` (for example,
`THIRS`/`THURS` become `THU` and `TUES/THURS` becomes `TUE/THU`).
`SectionResource` now exposes only that canonical form, and the curriculum
schedule-reference seeder persists the same form; the erroneous source CSV
row was corrected to `THU`. The new API and seeder regressions first failed on
the raw values, then passed: `php artisan test
--filter='(SectionsEndpointTest|GrcCurriculumScheduleReferenceSeederTest)'`
completed with **17 passed (54 assertions)**. The next in-scope step is an
idempotent repair of the existing local reference and section day values. No
commit or push has been made.

**Local repair attempt:** The first Tinker invocation did not execute because
its `use CanonicalScheduleDays` import collided with Tinker's preloaded alias;
no database rows were changed. The repair will be re-run using fully qualified
class names, then verified by querying for noncanonical values. No commit or
push has been made.

**Database repair and write hardening complete:** The corrected local repair
updated **359** `curriculum_subjects.reference_day` rows and **4,138**
`sections.schedule_days` rows. A direct verification found **0** noncanonical
reference days, **0** noncanonical section days, and **0** remaining `THIRS`
section values. `CreateSection` and `UpdateSection` now persist canonical
three-letter day codes as well, preventing manual schedule writes from
reintroducing aliases. The targeted API and seeder suite passed **18 tests / 58
assertions**. Formatting, static analysis, and diff checks remain to be run;
no commit or push has been made.

**Static-analysis finding:** Pint passed for all touched backend files. PHPStan
then reported five pre-existing null-safety errors in
`GrcCurriculumScheduleReferenceSeeder::normalizeTime()` (the `preg_replace()`
pipeline can return `null`); none concerns the new schedule-day canonicalizer.
Because this file is part of the change, the underlying safe fallback will be
implemented and the same static check rerun. No commit or push has been made.

**Final verification:** After adding the safe `preg_replace()` fallback, the
targeted section/API and schedule-reference seeder suite again passed **18
tests / 58 assertions**. Scoped Pint passed, PHPStan reported **No errors**
for all five touched production files, and `git diff --check` passed. The
visible API, fresh source imports, and manual section create/update writes now
all use only `MON`, `TUE`, `WED`, `THU`, `FRI`, `SAT`, or `SUN` tokens (joined
with `/` for multiple meeting days). No commit or push has been made.

## 2026-08-14 — Registrar enrollment review table-layout request

The requested UI change is scoped to `EnrollmentReviewDialog`, opened by the
Registrar Staff enrollment queue's Review action. Source review confirms the
dialog currently renders each subject as a stacked card, while the Student
regular-section view already uses the required compact schedule table pattern:
Subject code, Description, Units, Section ID, Day, Time, and Room. No
implementation has been made yet; the design confirmation is pending. No
commit or push was made.

## 2026-08-14 — Cashier and Student account-balance visibility request

The user requested a payment-account view for Cashier and Student: Cashier
must be able to assess outstanding prior-semester balances and partial/down
payments, Students must see their own balance and promissory-note status, and
skipping a Student in the Cashier queue must never remove the Student from the
queue. Discovery is limited to the existing payment, student-account, and
queue flows; no code or database changes have been made. No commit or push is
authorized.

**Current-flow finding and approved business rule:** Each enrollment currently
has only one payment record. An amount lower than the assessment is accepted,
but it immediately marks the enrollment `enrolled` and generates the COM;
there is no stored balance or promissory-note flag, so no prior-term balance
can be shown. The user approved this enrollment/COM outcome for a partial
payment, provided the recorded amount is at least **₱1,000**. A promissory
note stays hard-copy; the system will store only an operational “Promissory
note on file” indicator. Queue skip is already a waiting-state requeue rather
than a cancellation; the new slice will retain that behavior and add a focused
regression so a skipped ticket remains visible at the back of the queue. No
implementation, commit, or push has been made.

**Approved design documented:** The approved ledger design is written at
`docs/superpowers/specs/2026-08-14-account-balance-payment-design.md`. It
keeps the one-per-enrollment payment/COM idempotency boundary, adds separately
auditable account payments allocated by the server to the oldest outstanding
active enrollment, enforces the PHP 1,000.00 minimum only for a new enrollment
payment, and exposes only the hard-copy promissory-note indicator. Self-review
found no placeholders, contradictions, or scope gaps. The specification is not
committed because no saving-point commit/push was requested for this slice.
Implementation-plan creation awaits the user's review of the specification.

**Implementation plan complete:** The reviewed, test-first implementation plan
is saved at `docs/superpowers/plans/2026-08-14-account-balance-payment.md`.
It divides the approved design into persisted ledger state, exact `bcmath`
balance calculation, authorized account APIs and oldest-balance allocation,
PHP 1,000.00 enrollment confirmation with the promissory indicator, Cashier
and Student UI contracts, then focused verification. Plan self-review found no
placeholders, stale policy references, type inconsistencies, or uncovered
requirements. No implementation, commit, or push has been made.

**Account ledger milestone:** Added reversible migrations for the
`payments.promissory_note_on_file` operational flag and the separate
`account_payments` allocation ledger. `AccountPayment` retains money as an
exact decimal string and relates to its Student, allocated enrollment, and
Cashier; existing confirmation-payment uniqueness is unchanged. The RED
schema/model test first failed for the absent table/model/column, then the
focused rerun passed **10 tests / 25 assertions**. No commit or push has been
made.

**Balance summary and API milestone:** Added exact-decimal account summaries
over all active assessed enrollments, with prior/current balance separation
and promissory-note visibility. The Student can read only their own summary;
Accounting Staff can read a Student's summary and record a balance-only
payment. Those payments are audited, leave queue tickets unchanged, and now
allocate oldest-first across multiple outstanding enrollments when necessary.
The focused account API suite passed **4 tests / 23 assertions** after a RED
test exposed and corrected the multi-enrollment allocation edge case. No
commit or push has been made.

**Enrollment confirmation milestone:** New enrollment payments below
**PHP 1,000.00** now fail before they can create a payment, enrollment, COM,
or notification. A PHP 1,000.00 partial payment continues enrollment and COM
generation, and can retain the hard-copy “promissory note on file” indicator.
The focused confirmation suite passed **11 tests / 47 assertions**. No commit
or push has been made.

**Cashier UI milestone:** Added a strict typed Student-account API contract,
TanStack Query hooks, and a Cashier Now Serving account summary. It displays
the Student's name, number, year level, prior balance, total outstanding
balance, and promissory-note indicator. The existing enrollment confirmation
now sends that indicator; the separate balance-payment dialog accepts PHP
500.00 and makes no enrollment or queue-ticket request. The focused service
and Cashier suites passed **15 tests** in total (2 service, 13 workspace); the
non-failing jsdom canvas warning is known test-environment output. No commit
or push has been made.

**Student UI milestone:** Added a Student-only, read-only Account balance
panel next to enrollment/queue progress. It displays total and prior balances,
outstanding term entries, and the promissory-note indicator without any
payment action. The student-panel and enrollment-workspace suites passed **22
tests** in total, including a regression that a non-Student session makes no
own-account request. No commit or push has been made.

**Verification formatting finding:** Scoped Pint reported only import and
fully-qualified-name formatting in the new `BuildStudentAccountBalance` action;
no test or behavior failure occurred. The file will be formatter-normalized
and the same static check rerun. No commit or push has been made.

**Verification static-analysis finding:** The first scoped PHPStan command
reported 24 errors. Most are genuine type-safety gaps in the new Billing
action/resource code: nullable relation access, missing numeric-string types
for `bcmath`, and a redundant `array_values()` call. Its resource glob also
included three pre-existing type errors in `AcademicTermSectionPlanResource`,
which is outside this slice and unchanged. The new-code issues will be fixed
from the reported evidence, then verified through a narrowed changed-file
command; no suppression or baseline entry will be added. No commit or push
has been made.

**Verification frontend-style finding:** A combined handoff check found one
unnecessary test-only TypeScript assertion and Prettier differences in three
modified frontend test files. `git diff --check` itself passed. These small
test/style issues will be corrected and rechecked without touching the many
unrelated pre-existing worktree changes. No commit or push has been made.

**Final verification:** The fresh focused backend suite passed **85 tests /
324 assertions**, covering account summaries, oldest-first payment allocation,
enrollment payment confirmation/COM idempotency, and queue requeue behavior.
The fresh frontend suite passed **37 tests** across the Cashier, Student
balance, and enrollment workspaces; the only console notices were the
non-failing jsdom canvas implementation warnings. Frontend TypeScript
typechecking, scoped ESLint, and Prettier checks all exited successfully.
Scoped backend Pint passed and PHPStan reported **No errors** for the changed
production code. The project’s older PHPUnit doc-comment metadata warnings
remain non-failing and outside this slice. Final `git diff --check` follows;
no commit or push is authorized or made.

## 2026-08-14 — Guadalupe H. Pundaquit enrollment-state restoration request

The user requested a targeted restoration for Guadalupe H. Pundaquit after an
enrollment reached the completed Cashier/COM state. Investigation will first
identify the exact Student, enrollment, payment, COM, queue-ticket, audit,
and error-log records. No data has been changed yet; no commit or push is
authorized.

Investigation identified enrollment `#12617` (student number `2024-06-01503`)
as the only current-term record to repair. Its `account_payments` table was
missing because two existing 2026-08-14 migrations had not been applied.
The app database account cannot run `ALTER TABLE`, so its migration attempt
failed safely before making any schema change. The local XAMPP administrator
connection then applied the two existing reversible migrations successfully.
This resolves the Student account-page server error caused by the missing
table. The pending scoped restoration will preserve the existing queue ticket
and immutable original audit record while removing only the erroneous payment
confirmation artifacts.

Completed the requested restoration for enrollment `#12617` in one database
transaction. It is now `pending_payment` with its two completion timestamps
cleared, its eight enrollment-subject rows returned to `selected`, and its
erroneous payment and COM removed. The exact stale payment-confirmation
notification was removed in a follow-up transaction after validating the
Student's separate user identifier. No later account payments existed. Queue
ticket `Q001` remains `serving`, and the immutable original confirmation audit
record remains intact. Post-change verification confirmed no payment or COM,
eight selected subjects, zero stale payment notices, and a working account
balance service (`11,175.00` outstanding). `php artisan test
tests/Feature/Api/V1/StudentAccountEndpointTest.php` passed: 4 tests, 23
assertions. No commit or push was made.

## 2026-08-14 — Cashier transaction history and student lookup request

The user requested that a processed enrollment immediately disable its
Cashier **Confirm payment** action, that Cashier have a transaction-history
navigation showing student payments, and that Cashier can find a Student by
student number before processing a payment. Existing implementation review
found a Payment Records navigation and endpoint that currently list only
enrollment-confirmation payments, while account-balance receipts live in a
separate ledger. The approved design is recorded in
`docs/superpowers/specs/2026-08-14-cashier-transaction-history-search-design.md`.
It renames and extends the existing destination rather than duplicating it,
combines the two payment ledgers in a read-only history, and makes student
lookup queue-safe: a Cashier must first serve the existing eligible ticket and
cannot displace another Student already being served. No implementation,
commit, or push has been made.

**Implementation plan complete:** The reviewed, test-first implementation
plan is saved at
`docs/superpowers/plans/2026-08-14-cashier-transaction-history-search.md`.
It keeps the existing `/payments` API contract intact, adds a separate
read-only unified transaction feed, restricts student-number lookup to the
current eligible Cashier record, and specifies the immediate disabled state
after a confirmation succeeds. Plan self-review confirmed complete spec
coverage, consistent backend/frontend resource fields, and no unfilled plan
markers. Implementation has not started; no commit or push was made.

**Implementation started:** The user approved inline execution on `main`.
Work is proceeding test-first in five checkpoints: unified Cashier
transaction-history API, non-mutating Cashier student lookup API, strict
frontend clients, Cashier UI/navigation behavior, then focused verification.
The lookup UI will not serve a searched waiting ticket while a different
ticket is currently serving; the existing general Call next behavior is
unchanged. No commit or push is authorized.

**Cashier transaction API milestone:** Added the read-only
`GET /api/v1/cashier-transactions` feed, normalized across enrollment-payment
receipts and account-balance receipts without changing the established
`/payments` contract. It is protected by the existing Accounting/Registrar
Head payment-history policy, supports exact student-number and date filters,
returns student context and source-qualified transaction IDs, and sends
private no-store responses. The initial RED run confirmed the missing route;
the GREEN suite passed **5 tests / 23 assertions**. Scoped Pint and PHPStan
both passed. No commit or push was made.

**Cashier lookup API milestone:** Added the Accounting-only
`GET /api/v1/cashier-payment-candidates` endpoint. It accepts an exact
student number and returns only a current-term `pending_payment` enrollment
with a current-day waiting or serving ticket; no lookup mutates payment,
document, enrollment, audit, or queue records. The focused suite passed **6
tests / 28 assertions**, including authorization and no-write coverage.
Scoped Pint passed; a generic relation mismatch reported by PHPStan was fixed
by simplifying the one-use `whereHas` condition, then PHPStan passed with no
errors. No commit or push was made.

**Cashier frontend milestone:** Added strict, test-backed clients and
TanStack Query hooks for the unified transaction history and eligible-student
lookup. Cashier navigation now calls the existing destination **Transaction
History**, which displays both enrollment and account-balance receipts with
student context and exact student-number/date searching. The Payment Queue
can find an eligible student by number without moving their ticket; a waiting
candidate cannot displace another Student already being served. After an
enrollment payment succeeds, only that enrollment's **Confirm payment**
action changes to the disabled **Payment processed** state. Focused frontend
suites passed: 3 client tests, 5 transaction-history workspace tests, 15
Cashier workspace tests, and the new navigation-label test. No commit or push
was made.

**Cashier verification milestone:** The full affected backend regression set
passes **50 tests / 178 assertions**, covering the new history and lookup
endpoints alongside payment confirmation and queue behavior. Scoped Pint and
PHPStan pass; the route list confirms both new `/api/v1/cashier-*` routes.
Frontend type checking, full ESLint with zero warnings, targeted Prettier, and
the combined affected frontend suite (**28 tests**) pass. Vitest prints only
its known jsdom canvas notice during accessibility checks; assertions still
pass. During verification, Pint reordered `routes/api.php` imports after the
new controller imports were added. The combined frontend run also exposed a
pre-existing stale Program Chair expected-ID list: the source already included
`program-chair-analytics`, so the test's expected list was brought into line
with that existing module. `git diff --check` passes. No commit or push was
made.

## 2026-08-15 — 2026–2027 second-semester enrollment reset request

Session started. The requested scope is destructive: remove data belonging to
the 2026–2027 2nd-semester academic term only, preserve the 2026–2027 1st
semester as the active term, and leave the Registrar Head to archive the 1st
semester later through the application. Before any deletion, the exact term,
dependent records, active-term constraint, and safe database transaction scope
are being inspected. The first read-only Tinker inventory did not execute
because its `DB` import collided with Tinker's preloaded alias; no database
query or data change occurred. A rerun used the fully qualified facade but
stopped safely before reporting records because this local database has no
`current_term_slots` table. The active-term source will be resolved from the
actual schema and application models before a clean inventory rerun. No data
has been changed, committed, or pushed.

**Read-only inventory complete:** The current-term slot points to term `#10`
(`2026-2027 / 2nd`, `semester_ongoing`); the requested retained term is `#7`
(`2026-2027 / 1st`), which is currently `archived`. Term `#10` contains 38
section plans, 630 sections, 4 schedule proposals, 7 prediction runs, 7
schedule-generation runs, 199 forecasts, and 5 enrollments (21 selected
subjects, 4 payments/COM documents, 5 assessments, and 5 queue tickets).
Its dependent foreign keys and exact notification/audit scope have been
mapped. The reset will run in one database transaction: remove only term
`#10` and its scoped side effects, repoint the sole current-term slot to
term `#7`, and restore term `#7` to `semester_ongoing` with its close/archive
timestamps cleared. No data has been changed, committed, or pushed.

**Reset transaction complete:** One successful database transaction removed
term `#10` (`2026-2027 / 2nd`) and all mapped current-term data: 5
enrollments, 630 sections, 38 section plans (via cascade), 4 schedule
proposals, 7 schedule-generation runs, 7 prediction runs, 199 demand
forecasts, 14 scoped enrollment notifications, and 309 scoped audit rows.
The enrollment cascades also removed their 21 subject selections, 4 payments,
4 COM documents, 5 assessments with 20 line items, and 5 queue tickets. The
current-term slot now points to term `#7`; it is `semester_ongoing` and has
both `closed_at` and `archived_at` cleared. Post-transaction checks report
zero remaining term-`#10` references across every direct operational table.
No code, commit, or push was made; a final read-only integrity check follows.

**Final integrity check passed:** No `2026-2027 / 2nd` term remains. The only
`semester_ongoing` term is `#7` (`2026-2027 / 1st`), and the current-term slot
points to it. Every table with an `academic_term_id` reports zero rows for the
deleted term ID, and all known enrollment cascades for the five removed
enrollments (subjects, payments, assessments, COM documents, and queue
tickets) report zero rows. The Registrar Head can now archive the restored
1st semester through the normal application action. No code, commit, or push
was made.
