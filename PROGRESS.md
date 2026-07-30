# GRC Enrollment System — Development Progress

**Last updated:** 2026-07-30 · **PRD version:** v3.2 · **Branch:** `main`
(merged `phase-6-process-2` at `783c775`, fast-forward)

## Current Objective

Roadmap Phase 6, "Process 2.0 + Student Portal": DFD 2.2 (Eligible Subject
Pool) and DFD 2.4 (Enrollment Submission) backends, plus the Student
portal's Eligible Subjects and Enrollment modules (FR-ENR-001–011). Also
folds in real institutional data the user supplied mid-phase: the actual
GRC College of Computer Studies subject catalog (88 subjects, two real
block-section spreadsheets) and the user's confirmed §17-pending grading
direction (3.00 passing / 5.00 failing, lower-is-better, INC/NC special
marks). **Phase 6 is complete, quality-gated, live-verified against real
data, and merged to local `main`.**

## Verified Completed

- **Task 1 — fractional units + real CCS catalog.** `subjects.units` and
  `enrollments.total_units` widened `integer` → `decimal(_,1)` (Leadership
  subjects are genuinely 1.5 units). New `CcsSubjectSeeder` adds the 88 real
  CCS subjects, additive alongside the existing synthetic catalog — no code
  collisions. An integration test proves the existing Phase 5 Program Chair
  curriculum/prerequisite editor operates on the real catalog end to end.
- **Task 2 — grading policy + `PrerequisiteEvaluator`.** New
  `config/enrollment.php` (comparison direction, passing/failing grade,
  special marks, unit caps), pre-populated with the user's direction but
  never hardcoded into logic — `App\Domain\Academic\PrerequisiteEvaluator`
  returns `needs_verification`, never a silent pass or fail, whenever the
  policy is unconfigured.
- **Task 3 — block-section mechanism schema.** `sections.is_block_exclusive`
  and `student_profiles.enrollment_category`, both nullable, no default —
  the same mechanism-implemented/value-flagged pattern as
  `sections.viability_threshold`.
- **Task 4 — Eligible Subject Pool API.** `GET /api/v1/eligible-subjects`
  (Student own-record only). Every curriculum subject returns with an
  explainable verdict: `completed`, `already_selected`, `prerequisite`,
  `prerequisite_advisory`, `no_sections_available`, `block_restricted`, or
  `eligible`. Cross-subject conflict exclusion is deliberately deferred to
  Task 5 — the pool has no draft-selection state to conflict against yet.
- **Task 5 — Enrollment Submission API.** `GET`/`POST /api/v1/enrollments`.
  One transaction creates the enrollment, its subjects, one queue ticket,
  one audit entry, and a notification. The client's pool view is advisory
  only — every submitted section is re-validated server-side against a
  freshly rebuilt pool, plus duplicate-subject, schedule-conflict
  (`SectionConflictDetector`, reused from Phase 2), and — only when
  configured — overload checks.
- **Tasks 6–7 — Student portal modules.** `EligibleSubjectsWorkspace`
  (read-only pool view) and `EnrollmentWorkspace` (per-subject section
  picker, Digital PEF review table, `AlertDialog` confirmation matching the
  Phase 5 pattern, receipt with queue ticket number, and the student's own
  enrollment history for FR-ENR-010's real-time status).
- **Task 8 — generalized module registry.** `phaseFiveModuleRegistry` /
  `isPhaseFiveModuleId` / `PhaseFiveModuleId` renamed to
  `connectedModuleRegistry` / `isConnectedModuleId` / `ConnectedModuleId`,
  now covering 15 modules (13 Phase 5 + 2 new).
- **Task 9 — this reconciliation.** Applied the 2 pending migrations to the
  real dev database (only after Phase 5's takeover discovered that gap;
  see the Operational Caution below), seeded the real CCS catalog into it,
  and ran a full live HTTP proof — not just tests — as `student4.seed@grc.test`
  (a withdrawn, therefore free-to-re-enroll, seeded student): fetched a real
  eligible pool (5 eligible subjects, 5 correctly excluded by unmet
  prerequisites or no sections), submitted a real enrollment for 2 sections,
  and verified all 5 atomic side effects landed in the real database
  (1 enrollment, 2 enrollment_subjects, 1 queue ticket, 1 audit row, 1
  notification, both sections' `enrolled_count` incremented exactly once),
  then verified the duplicate-active-enrollment guard rejects a second
  attempt with a clean 422.

## Work in Progress

**Phase 7a — Process 3.0 money path**, on worktree branch
`phase-7-process-3` (not yet merged). Full recompute of this document
(objective, verified-completed list, files changed, percentages) happens
once at Task 9, per the approved plan's cadence; this section tracks
real-time status in the meantime so the phase can resume cleanly if
interrupted.

- ✅ **Task 1 — role-scoped enrollment visibility (FR-FIN-001, FR-FIN-005).**
  `GET /api/v1/enrollments` generalized from Student-only to the
  `scopeVisibleTo` pattern (ADR 0008): Student → own rows; Registrar Head →
  all, with `status`/`academic_term_id` filters and pagination; Accounting
  Staff → `pending_payment` only, enforced in both `Enrollment::scopeVisibleTo`
  and `EnrollmentPolicy::viewAny` (defense in depth). `EnrollmentResource`
  gained `student_id`/`student_number` so non-owning roles can identify whose
  row they're viewing. New `IndexEnrollmentRequest` + `ListEnrollments`
  Action mirror `ListAuditLogs`'s shape. 5 new focused tests (cross-student
  isolation, Registrar Head all-rows + filters + pagination, Accounting
  pending-payment-only regardless of requested filter) plus the existing
  Phase 6 index test, all green; full backend suite 566/566 passing;
  PHPStan level 8 and Pint clean.
- ✅ **Task 2 — Registrar decisions API (FR-FIN-001, FR-FIN-002).**
  `PATCH /api/v1/enrollments/{enrollment}` follows ADR 0011 verbatim (see
  `TransitionScheduleProposal`): one route, an `action` field,
  `EnrollmentPolicy` resolving `decideApproval` (`registrar_approve`/
  `registrar_reject`) or `void` per request, no `role:` middleware.
  `registrar_approve` moves `pending_registrar_approval` → `pending_payment`;
  `registrar_reject` moves it to `rejected`; `void` moves `pending_payment` →
  `cancelled` — a distinct, later checkpoint for cancelling an
  already-approved-but-unpaid enrollment, scoped this way because §17 doesn't
  define "authorized edge case" precisely (documented in
  `EnrollmentPolicy::void`'s docblock). Reject and void require a non-empty
  reason, recorded only in the audit row (`enrollments` has no
  `decision_reason` column of its own, unlike `schedule_proposals`). 6 new
  focused tests (both happy paths, both reason-required checks, wrong-status
  rejection, cross-role forbidden checks) all green; full backend suite
  572/572 passing; PHPStan level 8, Pint, and Redocly all clean.
- ✅ **Task 3 — grade encoding API (PRD §4.3, §5.3 DFD 3.1).**
  `GET`/`POST`/`PATCH /api/v1/academic-grades`, role-scoped read (Student
  own, Faculty own sections via `section.professor_id`, Registrar Head all
  — `AcademicGrade::scopeVisibleTo`). `POST` is Faculty-only and re-checks
  section ownership plus the (student, subject, term) uniqueness
  server-side. `PATCH` serves three concerns on one route: a plain content
  edit of `final_grade`/`remarks` while still `draft`, `action: submit`
  (Faculty, `draft`→`submitted`), and `action: lock` (Registrar Head,
  `submitted`→`locked` — the moment a grade becomes part of the official
  record `BuildEligibleSubjectPool` reads for prerequisite evaluation, so
  it's the one point that notifies the student). `final_grade` stays the
  exact decimal string the model already carried since Phase 4 — no scale
  or passing-mark asserted, per PRD §17. 15 new focused tests all green;
  full backend suite 588/588 passing; PHPStan level 8, Pint, and Redocly
  all clean.
- ✅ **Task 4 — payment queue + serving number API (FR-FIN-006).**
  `GET /api/v1/queue-tickets` (Accounting Staff only, deterministic
  `queue_date` then `id` order, filterable by `status`/`queue_date`,
  paginated) and `PATCH /api/v1/queue-tickets/{queueTicket}` with
  `action: serve` (`waiting`→`serving`) or `action: complete`
  (`serving`→`served`), following ADR 0011's constant-trio + row-lock
  shape. Unlike Enrollment/AcademicGrade, both transitions are gated to the
  same single role with no per-ticket ownership dimension, so the route
  carries the coarse `role:accounting_staff` middleware (re-checked by
  `QueueTicketPolicy`) rather than a bare Policy-only gate. §17 leaves reset
  cadence, priority, and "how many tickets may be serving at once"
  unconfirmed — only the two-step order is enforced, documented in the
  Action's docblock the same way `QueueTicketStatus` already does. 8 new
  focused tests all green; full backend suite 596/596 passing; PHPStan
  level 8, Pint, and Redocly all clean.
- ✅ **Task 5 — payment confirmation + Digital COM API (FR-FIN-007–010).**
  `POST /api/v1/enrollments/{enrollment}/payment` (Accounting only, only
  from `pending_payment`): one transaction creates the `Payment` row,
  transitions the enrollment to `enrolled`, and generates the Digital COM
  (`EnrollmentDocument`, type `com`, opaque `COM%06d` number), mirroring
  `SubmitEnrollment`'s five-write shape. **Idempotent** (FR-FIN-009): the
  Action checks for an existing `Payment` *before* checking the
  enrollment's status, so a repeat call — even one arriving after the
  enrollment has already moved on to `enrolled` — returns the existing
  payment/document rather than erroring or duplicating either (`200`
  instead of `201`); a dedicated test asserts exactly one row of each
  survives two calls. No PDF pipeline — `storage_path` stays null, and
  FR-FIN-010's print/download is served by returning structured COM data
  for the Student module to render as a print-stylesheet page.
  `GET /api/v1/enrollment-documents` (Student own, Registrar Head all) via
  a new `EnrollmentDocument::scopeVisibleTo`. 9 new focused tests all
  green; full backend suite 605/605 passing; PHPStan level 8, Pint, and
  Redocly all clean. **All 5 backend API tasks of Phase 7a are now
  complete** — remaining: 3 frontend portal-module tasks (6–8) and the
  final docs/gate/live-proof/merge task (9).
- ⬜ Tasks 6–8 — 8 portal modules (Registrar Head ×2, Accounting ×4, Student ×2).
- ⬜ Task 9 — docs, full quality gate, live HTTP proof, `PROGRESS.md`
  recompute, merge to `main`, push to `origin`.

## Files Changed

**Backend, schema/seed:** `database/migrations/2026_07_30_000001_widen_unit_columns…`,
`…000002_add_block_section_eligibility_mechanism_columns`;
`database/seeders/CcsSubjectSeeder.php` (new), `DatabaseSeeder.php`;
`app/Models/Subject.php`, `Enrollment.php`, `Section.php`,
`StudentProfile.php` (casts/docblocks for the widened/new columns).

**Backend, domain:** `app/Domain/Academic/PrerequisiteEvaluator.php`,
`PrerequisiteVerdict.php`, `PrerequisiteVerdictStatus.php` (new);
`config/enrollment.php` (new); `app/Domain/Enrollment/EligibleSubjectEntry.php`
(new); `app/Domain/Audit/AuditAction.php`, `AuditableType.php` (+
`enrollment.submitted` / `enrollment`); `app/Domain/Notifications/NotificationType.php`
(+ `enrollment_submitted`).

**Backend, API:** `app/Actions/Enrollment/BuildEligibleSubjectPool.php`,
`SubmitEnrollment.php` (new); `Http/Controllers/Api/V1/EligibleSubjectController.php`,
`EnrollmentController.php` (new); `Http/Requests/Api/V1/EligibleSubject/`,
`Enrollment/StoreEnrollmentRequest.php` (new); `Http/Resources/Api/V1/EligibleSubjectResource.php`,
`EnrollmentResource.php` (new); `Policies/EligibleSubjectPolicy.php`,
`EnrollmentPolicy.php` (new); `Providers/AppServiceProvider.php`
(`PrerequisiteEvaluator` binding, 2 new Gates); `routes/api.php` (3 new
routes: `GET /eligible-subjects`, `GET`/`POST /enrollments`).

**Frontend:** `src/features/schemas/enrollment-schema.ts`,
`services/enrollment-service.ts`, `hooks/use-enrollment.ts`,
`hooks/use-term-selection.ts` (new, shared by both new workspaces);
`components/portal/eligible-subjects-workspace.tsx`,
`enrollment-workspace.tsx` (new); `portal/module-registry.tsx` (renamed
+ 2 new modules), `portal/role-capabilities.ts` (Student module
descriptions de-"preview"-ified); `components/pages/portal-module-page.tsx`
(symbol rename only).

**Docs:** `docs/reference/` (new — the two CSV spreadsheets, verbatim, plus
a provenance README); `docs/api/openapi.yaml` (3 new paths, 5 new schemas);
`PROGRESS.md` (this reconciliation).

## Commands and Tests Run

| Command | Result |
|---|---|
| `php artisan test --without-tty` | **563 passed / 2,099 assertions**, ~30s |
| `composer format:check` (Pint) | passed |
| `vendor\bin\phpstan analyse --memory-limit=1G --no-progress` | No errors (level 8) |
| `composer audit --locked` | No security vulnerability advisories found |
| `npx @redocly/cli lint docs/api/openapi.yaml` | valid, no warnings |
| `npx vitest run --no-file-parallelism` | **41 files / 224 tests passed** |
| `npm run typecheck` (`tsc --noEmit`) | passed |
| `npm run lint` (`eslint . --max-warnings=0`) | passed (after fixing 1 real `react-hooks/set-state-in-effect` violation in `use-term-selection.ts` and 2 non-null-assertion style errors — see *Technical Decisions*) |
| `npm run format:check` (Prettier) | passed after one auto-fix pass over 5 new files |
| `npm audit --audit-level=moderate` | 0 vulnerabilities |
| `npm run build` (`next build`, Turbopack) | compiled successfully, 5 routes |
| **Real dev DB:** `php artisan migrate:status --database=mariadb_migrator` | exactly the 2 expected Phase 6 migrations pending, both `ALTER TABLE` on already-granted tables — confirmed no new `GRANT` needed |
| **Real dev DB:** `php artisan migrate --database=mariadb_migrator --force` | both migrations applied, `DONE` |
| **Real dev DB:** `php artisan db:seed --class="Database\Seeders\CcsSubjectSeeder" --force` | seeded; verified 9+ real CCS codes present via direct query |
| **Live HTTP, real dev DB:** login as `student4.seed@grc.test`, `GET /api/v1/eligible-subjects?academic_term_id=2` | 5 eligible subjects with real available sections, 5 correctly excluded (4 by unmet prerequisite, 1 by no offered sections) — verified against real seeded curriculum/section data |
| **Live HTTP, real dev DB:** `POST /api/v1/enrollments` with 2 real sections | **201 Created**; verified via direct SQL: exactly 1 `enrollments` row, 2 `enrollment_subjects` rows, 1 `queue_tickets` row, 1 `audit_logs` row, 1 `notifications` row, both sections' `enrolled_count` incremented by exactly 1 |
| **Live HTTP, real dev DB:** repeat the same `POST` | **422**, `academic_term_id: "You already have an active enrollment for this term."` — duplicate guard confirmed live |
| **Live HTTP, real dev DB:** `GET /api/v1/enrollments` | returns both the new and the prior withdrawn enrollment, newest first |
| `CHECK TABLE mysql.user, mysql.tables_priv` (before/after live testing) | `OK` throughout |
| `Get-WinEvent -LogName Application` (last 15 min, MariaDB-related) | no entries |
| **On merged `main`:** `git merge phase-6-process-2` | Fast-forward, `77ae5ac..783c775`, **0 conflicts** — the branch was cut from `main`'s current tip and `main` had no divergent commits |
| **On merged `main`:** `php artisan test --without-tty` | **563 passed / 2,099 assertions**, 45s |
| **On merged `main`:** `npx vitest run --no-file-parallelism` | **41 files / 224 tests passed** |
| **On merged `main`:** `npm run build` (`next build`, Turbopack) | compiled successfully, 5 routes |

## Technical Decisions

- **Real GRC data changes what "the subject catalog" means for this
  system.** The user supplied two real CCS block-section spreadsheets
  mid-phase. Extracted only `code`/`title`/`units` (88 subjects) into an
  additive seeder — schedule/room/faculty/modality stayed out of scope.
  13 of 384 source rows had a SCHED ID in the UNITS column (a spreadsheet
  column-alignment artifact); resolved by majority value per code, fully
  documented in `docs/reference/README.md`.
- **Widen `units` columns rather than leave them integer.** The real data
  makes this non-optional: Leadership subjects are 1.5 units. Cast as
  `float` (not left as a raw decimal string like
  `academic_grades.final_grade`) because a unit count carries no §17 policy
  ambiguity — coercion is safe.
- **Grading policy is user-directed, not GRC-confirmed — encode both facts.**
  `config/enrollment.php` ships with the user's explicit 2026-07-30 planning
  direction (3.00 passing / 5.00 failing / lower-is-better / INC / NC) as
  its *default*, so the system is demonstrable, but
  `PrerequisiteEvaluator`'s `needs_verification` path is real, tested, and
  reachable by clearing the config — never silently bypassed. Every
  §17-pending value stays overridable via environment variable.
- **FR-ENR-011's block-exclusive comparison uses a documented placeholder
  string (`'irregular'`), not an invented enum.** The approved schema gives
  `sections.is_block_exclusive` (bool) and `student_profiles.enrollment_category`
  (free string) — nothing defines what the category values *are*. Matching
  the existing `CurriculumSeeder::PLACEHOLDER_MINIMUM_GRADE` precedent, the
  comparison target is one named, clearly-commented placeholder constant,
  swappable the moment GRC confirms real vocabulary.
- **FR-ENR-003's "conflicting sections" check lives in Task 5, not Task 4.**
  The acceptance criterion is "cannot be *submitted* together" — there is no
  draft-selection state between viewing the pool and the atomic submission
  for two sections to conflict against. `SectionConflictDetector` (reused
  unchanged from Phase 2) runs pairwise across the submitted set instead.
- **`EnrollmentWorkspace` uses plain `useState`, not React Hook Form.** The
  "form" is N independent per-subject section pickers, not one object with
  a schema — RHF's `zodResolver` model doesn't fit. FR-ENR-006 ("preserve
  valid selections on error") falls out naturally: the selection map is
  never cleared except on success.
- **Recompute Row 4 (Process 2.0 backend) from 25% to 80%, and Row 8 (nine
  role portals) from 33% to 38%.** Row 4: 3 of DFD 2.1–2.4's four
  subprocesses are now complete (2.1 profile read, 2.2 eligible pool, 2.4
  submission); only 2.3 "Generate Predictive Recommendation" remains,
  deliberately deferred to Phase 9 as ML work — the same "80%, ML piece
  deferred" shape already recorded for Row 3 (Process 1.0). Row 8: 15/40
  modules now connected (32.5% → 37.5%, rounded to 38%). Contributions:
  Row 4 10% × 80% = 8.00 (was 2.50); Row 8 25% × 38% = 9.50 (was 8.25).
  Overall: 48.25 → 55.00 ≈ 55%. No other row's weight or Done% changed.
- **Merge locally, do not push.** Same scope as every prior session:
  finish Task 9, commit, merge to local `main`. No push without separate
  explicit authorization.

## Known Issues and Blockers

- **Frontend full-suite parallel flakiness (this machine only) — unchanged
  from Phase 5.** `npm test` with Vitest's default multi-worker pool is
  unreliable under this machine's memory pressure; `npx vitest run
  --no-file-parallelism` is the trustworthy invocation and is what this
  session's 41/224 result used throughout.
- No new blocking defect found in Phase 6. The real-data live proof (Task 9)
  surfaced no gaps beyond what's already fixed and recorded above.
- Phase 7 remains the next §17-heavy phase (passing-grade *rule* is now
  user-directed but still GRC-unconfirmed; queue-ticket numbering, payment
  confirmation fields, COM format all still open) — see *Open Institutional
  Decisions*.

## Uncommitted or Risky Changes

None. `main`'s working tree is clean after the fast-forward merge (now at
`783c775`). The `phase-6-process-2` branch and its worktree at
`.worktrees/phase-6-process-2` remain on disk, unpushed and not deleted, in
case a rollback is ever needed. The real dev database carries the 2 Phase 6
migrations and the `CcsSubjectSeeder`'s 88 rows, applied deliberately as
part of this session's live verification (not a side effect) — the same
database the merged `main` code now runs against.

## Exact Next Steps

1. Start **Phase 7 — Process 3.0 + Remaining Portals** (FR-FIN-001–010):
   grade encoding, Registrar approval/override, transferee credits,
   withdrawal, payment queue, Digital COM. This is the most
   ML-consequential phase before 9 — it produces the attrition model's
   label and most of its features. Read `PRD.md` §5.3/DFD 3.x first.
2. Before writing code, follow `AGENTS.md`: confirm current `git
   status`/`git log`, and use `superpowers:brainstorming` →
   `superpowers:writing-plans` for a new phase-7 plan/spec pair under
   `docs/superpowers/`.
3. Optional cleanup (not blocking): remove the
   `.worktrees/phase-6-process-2` worktree and delete the merged branch
   once the user confirms the merge is stable — ask first, per the Git
   Safety Protocol.

## Do Not Change

- Bearer-token auth; never introduce session-cookie/CSRF auth or a Next.js
  API proxy.
- Faculty own-assignment section scoping and Executive Director
  published-only section visibility (server-enforced in `Section` scopes
  **and** `SectionPolicy`).
- Notification ownership (`user_id` never exposed) and audit privacy (no
  actor name/email ever rendered).
- `session.userId`-scoped private TanStack Query keys.
- Temporary admission credentials: never persisted to storage, logs, form
  state, or query caches.
- Every submitted enrollment section is re-validated server-side against a
  freshly built eligible pool — never trust the client's cached view.
- The `enrollments.active_academic_term_id` generated column and the
  pre-insert duplicate-active-enrollment check that turns its constraint
  violation into a clean 422 — do not remove either half.
- `PrerequisiteEvaluator`'s `needs_verification` path — never make it
  silently default to pass or fail when the grading policy is unconfigured.
- The `'irregular'` block-section placeholder is clearly flagged as
  provisional — do not treat it as confirmed institutional policy elsewhere.
- No ML runtime behavior before Phase 9; do not touch the paused
  `ml-service`.
- Do not push to `origin/main` without separate, explicit authorization.

---

# ■ Overall Completion — 55%

```
██████████████░░░░░░░░░░░  55 / 100
```

The number is weighted, auditable, and recomputable. Every row below is scored
against work that is **merged**, not work that is written or planned.

| # | Component | Weight | Done | Contributes |
|---|---|---:|---:|---:|
| 1 | Platform & foundations — 3 service shells, 13 ADRs, OpenAPI, error contract, DB, CI | 8% | 90% | 7.20 |
| 2 | Identity & RBAC — Sanctum, 9 roles, role middleware, Policies, query scopes | 7% | 85% | 5.95 |
| 3 | Process 1.0 backend — scheduling (PRD §5.1) | 10% | 80% | 8.00 |
| 4 | Process 2.0 backend — enrollment & advising (PRD §5.2) | 10% | 80% | 8.00 |
| 5 | Process 3.0 backend — approvals, payment, COM (PRD §5.3) | 12% | 15% | 1.80 |
| 6 | Cross-cutting backend — `audit_logs`, `notifications` | 5% | 100% | 5.00 |
| 7 | Frontend platform — Next.js, design system, shell, auth | 8% | 100% | 8.00 |
| 8 | Nine role portals — 40 modules (spans Phases 5–7) | 25% | 38% | 9.50 |
| 9 | Process 4.0 — machine learning (PRD §5.4) | 10% | 3% | 0.30 |
| 10 | Verification & deployment — E2E, security, perf, ISO 25010, handoff | 5% | 25% | 1.25 |
| | **Total** | **100%** | | **55.00 ≈ 55%** |

Two scores that look surprising, explained:

- **Row 4 at 80%** — 3 of DFD 2.1–2.4's four Process 2.0 subprocesses are
  complete (2.1 profile read, 2.2 eligible pool, 2.4 submission). Only 2.3
  "Generate Predictive Recommendation" remains, deliberately deferred to
  Phase 9 as ML work — the same shape as Row 3's 80% (FR-SCH-006 demand
  forecast deferred the same way).
- **Row 5 at 15%** — all 9 Process 3.0 tables are migrated, tested and
  documented, but not one Controller, Policy, Resource or route exists.
- **Row 8 at 38%** — 15 of 40 modules are now fully wired to real APIs
  (forms, mutations, parsed queries, tests), across 6 of 9 roles. 15/40 =
  37.5%, rounded to 38%; see Decisions. The other 25 modules (Registrar
  Staff's 4, Accounting's 4, plus the Phase 7/9 modules for the six
  Phase-5/6 roles) remain placeholder empty-states.

**Recompute rule:** when a phase closes, update its row's *Done* column and
re-multiply. Do not adjust weights without recording why in Decisions.

---

# ■ System Snapshot

| | |
|---|---|
| **Stack** | Laravel 12.64 / PHP 8.2.12 · MariaDB 10.4.32 (ADR 0007) · **Next.js 16.2.12** (App Router) + React 19 · FastAPI (ml-service, dormant) |
| **Auth** | Laravel Sanctum bearer tokens; no cookies, no CSRF, no session state |
| **Live API routes** | **33** |
| **Database tables** | **26** |
| **Backend tests** | **563 passing (2,099 assertions)** · Larastan level 8 clean, Pint clean, `composer audit` clean |
| **Frontend tests** | **41 files, 224 tests, Vitest** — run with `--no-file-parallelism` for a reliable result on this machine; see Known Issues |
| **CI** | 4 GitHub Actions jobs — Backend ✅ · Frontend ✅ · OpenAPI ✅ · ML Service ❌ (paused, see Phase 9) |
| **Portals functional** | 7 of 9 have at least one connected module (15 of 40 modules total); Registrar Staff and Accounting Staff remain fully placeholder pending Phase 7 |

---

# ■ The Nine System Users

All nine roles exist as `App\Domain\Identity\UserRole` enum cases and are seeded
one-per-role by `RoleUserSeeder`. Every local/testing synthetic account uses
the shared password `password`; the seeders refuse to run in production-like
environments. Credentials are documented in `docs/testing/SEEDED_IDENTITIES.md`.

| # | Role | PRD § | Enum value | Seeded identity | Backend authorization | Portal |
|---|---|---|---|---|---|---|
| 1 | Student | §3.1 | `student` | `student.seed@grc.test` | ✅ own profile, eligible pool, enrollment submission + private notifications | ✅ Phase 6 (2 modules) · ⬜ Phase 7 (2 more) |
| 2 | Admission Staff | §3.2 | `admission_staff` | `admission.seed@grc.test` | ✅ provisions students + private notifications | ✅ Phase 5 (3 modules) |
| 3 | Professor / Faculty | §3.3 | `faculty` | `faculty.seed@grc.test` | ✅ own availability/preferences + publication notifications | ✅ Phase 5 (2 modules) · ⬜ Phase 6–7 (2 more) |
| 4 | Program Chair | §3.4 | `program_chair` | `chair.seed@grc.test` | ✅ curriculum, sections, proposals + publication notifications | ✅ Phase 5 (5 modules) · ⬜ Phase 9 (1 more) |
| 5 | Dean | §3.5 | `dean` | `dean.seed@grc.test` | ✅ schedule approve/return + private notifications | ✅ Phase 5 (1 module) · ⬜ Phase 7, 9 (4 more) |
| 6 | Executive Director | §3.6 | `executive_director` | `executive.seed@grc.test` | ✅ final approve/publish + private notifications | ✅ Phase 5 (1 module) · ⬜ Phase 7, 9 (3 more) |
| 7 | Registrar Head | §3.7 | `registrar_head` | `registrar-head.seed@grc.test` | ✅ close proposal + audit logs + private notifications | ✅ Phase 5 (1 module) · ⬜ Phase 7–9 (5 more) |
| 8 | Registrar Staff | §3.8 | `registrar_staff` | `registrar-staff.seed@grc.test` | ⚠️ private notifications only | ⬜ Phase 7 |
| 9 | Accounting Staff | §3.9 | `accounting_staff` | `accounting.seed@grc.test` | ⚠️ private notifications only | ⬜ Phase 7 |

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

Source of truth: `frontend/src/features/portal/role-capabilities.ts` and
`frontend/src/features/portal/module-registry.tsx`. A ✅ module is dispatched
by `connectedModuleRegistry` to a real workspace component backed by parsed
API services and tests. Every other module is still a placeholder empty-state
rendering *"This module is not connected to workflow or authorization APIs."*

Status: ⬜ placeholder · 🔨 in progress · ✅ done

### 1. Student — 4 modules

| Module | Phase | Status |
|---|---|---|
| Eligible Subjects | 6 | ✅ |
| Enrollment | 6 | ✅ |
| Queue & Payment | 7 | ⬜ |
| Grades & Digital COM | 7 | ⬜ |

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
| Class Rosters | 7 | ⬜ deferred from Phase 6, needs its own roster endpoint |
| Grade Submission | 7 | ⬜ |

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
| Enrollment Dashboard | 7 | ⬜ |
| Stuck Students | **9** | ⬜ |
| Honors | **9** | ⬜ |
| Reports | **9** | ⬜ |

### 6. Executive Director — 4 modules

| Module | Phase | Status |
|---|---|---|
| Master Schedule | 5 | ✅ |
| Institution Dashboard | 7 | ⬜ |
| KPIs | **9** | ⬜ |
| Reports | **9** | ⬜ |

### 7. Registrar Head — 6 modules

| Module | Phase | Status |
|---|---|---|
| Audit Logs | 5 | ✅ |
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

**Totals:** 40 modules · **15 done** (13 Phase 5 + 2 Phase 6) · 8 blocked on
Phase 9 · 17 remain for Phase 7–8.

---

# ■ What Is Built

## API surface — 33 routes

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
(`EligibleSubjectPolicy`) · `GET`/`POST /enrollments` (`EnrollmentPolicy`) —
same pattern as `student-profile.show`, matching the same shape
`FacultyMemberPolicy`/`EligibleSubjectPolicy` use for a virtual (non-Eloquent)
resource.

**No `role:` middleware:** `PATCH /schedule-proposals/{id}` — one route serves
six transitions, so `ScheduleProposalPolicy` resolves the ability from the
request's `action` field (ADR 0011).

## Database — 26 tables

Identity and reference: `users`, `personal_access_tokens`, `programs`,
`academic_terms`.
Curriculum: `subjects`, `curricula`, `curriculum_subjects`,
`subject_prerequisites`.
Scheduling: `sections`, `schedule_proposals`, `faculty_availabilities`,
`faculty_subject_preferences`.
Enrollment records: `student_profiles` (own-record read only, Phase 1),
`enrollments`, `enrollment_subjects`, `queue_tickets` (**Phase 6 — API-backed**
via `GET`/`POST /enrollments`). Still **schema only, no API**:
`academic_grades`, `payments`, `enrollment_documents`, `transferee_credits`,
`withdrawal_requests` (Phase 7).

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

15 of 40 modules are now real workspaces wired to live API data — see the
Portal Feature Matrix above. The other 25 remain placeholders. Every
non-auth, non-health resource group in the 33-route inventory now has at
least one UI consumer.

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
| Enrollment reservation timeout and seat-release rules | Phase 6 — still unimplemented; seats are reserved immediately and permanently on submission |
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
| 2026-07-30 | Phase 6 — Process 2.0 + Student Portal (9 tasks, 2 modules, 3 new endpoints, real GRC CCS catalog) | This entry; live-verified; backend 563/563, frontend 224/224 |
