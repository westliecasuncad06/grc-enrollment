# Manual Enrollment Startup and College Program Chair Workflow Design

**Status:** Revised design approved in conversation; written-spec review pending  
**Date:** 2026-08-01  
**Revised:** 2026-08-02  
**PRD:** v3.2, Process 1.0 / FR-SCH-001–010

## Goal

Make Registrar Head the explicit starting and closing actor for every
semester enrollment cycle, then give each college-specific Program Chair one
hard-gated Enrollment workspace covering Process 1.1, 1.2, and 1.3. Registrar
Head can archive the current semester (closing an ongoing one in the same
transaction) without deleting its records,
and Program Chairs see a clear waiting state until the next semester exists.
The slice stays fully manual; machine-learning forecasts and predictive
analytics remain paused until Phase 9.

This slice covers Registrar Head and Program Chair only. Other role portals
keep their current behavior for now. The supported colleges are COE, CCS, COA,
and CBAE; “CSS” in conversation is normalized to the repository's established
CCS code for the College of Computer Studies.

## Navigation and User Experience

### Registrar Head

The Registrar Head portal shows Portal Overview and one Enrollment navigation
item. Existing Registrar Head APIs and workspaces are preserved but their
navigation links are hidden until their later process stages are revisited.

Enrollment uses a friendly four-segment progress indicator at the top. The
active segment is visually distinct, completed segments remain reviewable,
and unavailable segments explain what must happen first. On narrow screens it
becomes a compact vertical stepper without losing labels or status text.

1. **Term Setup** — create the school year, semester, enrollment
   start/deadline, and add/drop/change-subject deadline. Every
   created term starts as Draft.
2. **College Planning** — show independent Process 1.1–1.3 progress for COE,
   CCS, COA, and CBAE without exposing cross-college editing controls.
3. **Enrollment Ongoing** — show the current semester and published-schedule
   summary after the existing approval/publication process opens it.
4. **Archive** — archive the current semester directly. The action closes an
   ongoing semester as part of the same transaction, shows a plain-language
   impact summary, and retains all data.

Below the stepper, Enrollment contains one context-sensitive action card, a
separate current-semester summary, and archived semester history with
read-only dates, status, and audit-friendly close/archive timestamps.

Creation is atomic: the term and four college workflow rows are created in one
transaction. A failure creates neither. A new term cannot be created while
any prior term remains non-archived; Registrar Head must archive the current
term first. Archiving an ongoing term performs the close and archive together.

### Program Chair

Each college Program Chair sees Portal Overview plus exactly four items:

1. Enrollment
2. Subjects & Prerequisites
3. Sections & Schedules
4. Faculty Assignment

Schedule Proposals moves inside Enrollment step 1.3. Demand Forecast is hidden
until Phase 9.

Enrollment is a three-step workspace scoped to the authenticated Chair's
college and a selected academic term:

1. **1.1 Define Curriculum Capacities** — actual curriculum and capacity
   controls, including program/course, year level, subject code, description,
   units, prerequisites, offered semester, minimum/maximum capacity, manual
   recommended section count, and curriculum version/effectivity.
2. **1.2 Gather Faculty Input** — read-only review of in-college faculty
   availability and ranked subject preferences, submitted/missing counts, and
   an explicit Program Chair review sign-off. No submission quorum is invented.
3. **1.3 Generate & Validate Schedule** — actual section planning, faculty
   assignment, conflict validation, and schedule-proposal submission controls.

Only the current or completed step opens. Subjects & Prerequisites unlocks when
1.1 starts. Sections & Schedules and Faculty Assignment unlock after the 1.2
review sign-off. Locked pages show why they are locked and link back to
Enrollment. The Enrollment page and retained links reuse the same panel
components and API state; they do not maintain duplicate forms.

When no actionable current semester exists, the Enrollment workspace contains
no curriculum, section, schedule, or faculty forms. It shows the friendly
empty state **“Waiting for Registrar to create the school year and semester.”**
The supporting navigation pages show the same reason and link back to
Enrollment. A closed semester is no longer actionable: while Registrar Head
finishes archiving it, Program Chairs see **“The semester is closed. Waiting
for Registrar to open the next school year and semester.”** Archived records
remain available only through authorized read-only history views.

## Data Model and Lifecycle

### Institution-wide academic term

`academic_terms` remains the institution-wide record. Creation always sets
`status = draft`; request clients cannot supply status. Per-college planning
stages do not appear here because four colleges may be at different steps. The
institution-wide enum keeps only the states needed by this slice and by
already-built enrollment/history flows:

- `draft`
- `for_dean_approval`
- `semester_ongoing`
- `semester_closed`
- `archived`

The speculative WIP-only intermediary states beyond this slice are removed.
The term remains Draft while any college is still in Process 1.1–1.3 and moves
to For Dean Approval only after all four college workflows submit. Existing
schedule-proposal status remains authoritative for Dean, Executive Director,
and publication decisions. The term advances to `semester_ongoing` only after
all four college proposals reach the existing published state; no date alone
silently changes lifecycle status.

There is at most one non-archived academic term. The application enforces this
inside the term-creation transaction while locking the academic-term set; it
does not rely on a frontend check. A term in `draft`, `for_dean_approval`,
`semester_ongoing`, or `semester_closed` therefore blocks creation of the next
term.

Registrar Head owns the final transitions:

- `close`: `semester_ongoing` → `semester_closed`;
- `archive`: `semester_ongoing` → `archived` or `semester_closed` → `archived`;
  when archiving an ongoing semester, `closed_at` and `archived_at` are set in
  the same transaction.

Closing freezes term-scoped Program Chair planning writes. Archiving is a
non-destructive classification of an already-closed semester; curricula,
offerings, sections, schedules, enrollments, grades, payments, COM records,
and audit history remain intact and continue to reference the same term. The
archive transition records actor and UTC timestamps, uses a row lock, and
emits an archive audit event (a separate `close` API remains available for
backward-compatible service callers). Repeating the action returns the
existing final state without creating duplicate side effects.

A forward migration adds nullable `closed_at` and `archived_at` UTC timestamps
to `academic_terms`. The acting Registrar Head is preserved in the immutable
audit entry rather than duplicated as a mutable term foreign key. Concurrent
term creation is protected by a database-enforced single-current slot as well
as the Action-level transaction, so two requests cannot create two
non-archived terms.

### Per-college workflow

Add `academic_term_college_workflows`, unique on
`(academic_term_id, college)`, with:

- the owning college code;
- stage: `draft`, `curriculum_preparation`, `faculty_input`,
  `schedule_preparation`, or `for_dean_approval`;
- actor/time fields for curriculum completion, faculty review, and schedule
  submission;
- timestamps.

Registrar term creation inserts one row for each supported college. Archived
seed terms do not need workflow rows because they are history, not runnable
planning cycles.

Program Chair workflow actions are server-enforced, audited, and row-locked:

- `start_curriculum_preparation`: Draft → Curriculum Preparation;
- `complete_curriculum_preparation`: Curriculum Preparation → Faculty Input;
- `complete_faculty_input`: Faculty Input → Schedule Preparation.

The Chair may act only on the workflow matching their assigned college. The
institution-wide term advances to `for_dean_approval` only when all four
college workflows have submitted schedules. If a Dean or Executive Director
returns a college proposal, that college workflow returns to Schedule
Preparation and the term returns to Draft until all colleges are ready again.

### Curriculum capacities and schedule proposals

Keep the WIP `subject_offerings` table, keyed by academic term, curriculum,
and subject. It stores the Chair's manual planning choice, not an ML result.
Phase 9 may display `section_demand_forecasts.suggested_section_count` beside
it but must never overwrite the Chair's value.

Completing 1.1 requires at least one in-college curriculum to have a complete
offering set and rejects partial matrices: every subject placement in each
included curriculum must have year level, offered semester, min/max capacity,
and manual recommended sections, with max capacity at least min capacity.
Existing prerequisite cycle prevention remains authoritative.

Add a college code to schedule proposals and change active-proposal uniqueness
from one per term to one per term and college. A Chair may submit only their
college's proposal from Schedule Preparation. Submission requires at least one
planned in-college section, complete faculty/time assignments, and no conflicts
under the existing conflict detector. Recommended-section mismatches are
warnings, not blockers. Proposal submission and workflow completion happen in
one transaction. Proposal publication affects only sections whose subjects
belong to that proposal's college.

## API and Authorization

All endpoints remain Sanctum bearer-token APIs under `/api/v1` and use Form
Requests, Policies, Actions, API Resources, transactions, and the shared error
envelope.

- `GET /academic-terms` — existing role-aware list.
- `POST /academic-terms` — Registrar Head only; creates Draft term plus four
  workflows, and rejects creation while a non-archived term exists.
- `PATCH /academic-terms/{academicTerm}` — Registrar Head only; accepts the
  explicit action `close` or `archive`, applies only the legal transition, and
  is idempotent when the requested final state already exists.
- `GET /academic-term-workflows?academic_term_id=…` — Registrar Head may see
  all four; Program Chair sees only their college.
- `PATCH /academic-term-workflows/{workflow}` — Program Chair only, own
  college, action-driven legal transition.
- `GET /subject-offerings` — Program Chair only, own-college curriculum,
  readable during the current and completed workflow states.
- `POST /subject-offerings` — Program Chair only, own-college curriculum,
  writable only during Curriculum Preparation.
- Existing section, faculty-input, and schedule-proposal endpoints gain college
  scoping and stage guards without changing bearer authentication.

Cross-role or cross-college access returns `403`. Malformed input and illegal
stage transitions return field-addressable `422`. Multi-write failure rolls
back workflow state, proposal/term changes, close/archive timestamps, and
audit records together.

## Seed Data and Migration Safety

The academic-term seeder contains exactly six archived terms: first and second
semesters for 2020–2021, 2021–2022, and 2022–2023. It seeds no newer, Draft, or
ongoing term. `migrate:fresh --seed` is the deterministic clean state for the
owner's manual test. A normal seeder run never deletes a manually created term.

The local database has already recorded
`2026_08_02_000001_expand_academic_term_lifecycle` as applied, while the WIP
subject-offering migration is still pending. Do not rename or destructively
rewrite the applied migration. Reconcile the narrowed lifecycle and per-college
workflow through forward migrations; the still-pending subject-offering
migration may be corrected before its first application.

## Verification and Documentation

Backend tests cover reversible migrations, exact seed rows, atomic term plus
workflow creation, role/college visibility, every legal and illegal transition,
1.1 completeness, 1.2 sign-off without a quorum, schedule validation,
proposal/workflow synchronization, return behavior, scoped publication,
single-current-term enforcement, archive transition ordering and idempotency,
write freezes, non-destructive historical retention, rollback, and audit
entries.

Frontend tests cover the two approved navigation sets, Registrar form and
field-error behavior, the four-segment Registrar current/completed/locked
states, archive confirmation and history, Program Chair waiting/closed
states, three-step current/completed/locked states, supporting page gates,
manual-forecast labeling, error/offline states, keyboard behavior, and
`vitest-axe` accessibility. Playwright covers Registrar creation followed by
four college Chair flows through proposal submission, term opening, close,
archive, and the restored Program Chair waiting state, and verifies that ML is
not called.

Update OpenAPI, the identity/organization and scheduling data dictionaries, an
ADR for per-college workflow ownership, seeded-identity documentation, and
`PROGRESS.md`. Run narrow checks after each task and the full applicable
backend, frontend, OpenAPI, migration, and Playwright gates before handoff.

## Explicit Boundaries

- No ML-service changes, forecast generation, or automatic recommendation.
- No consolidation of the other seven role portals in this slice.
- No deletion of existing Registrar APIs/workspaces; navigation only is
  reduced.
- Archive applies to one school-year-and-semester record, never both semesters
  of a school year in one action.
- Close and archive do not delete or detach academic, enrollment, payment, or
  audit records.
- No session-cookie, CSRF-cookie, SSR-authorized-data, or Next.js API proxy.
- No commit, merge, or push without a separate explicit user request.
