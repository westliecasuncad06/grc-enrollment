# Faculty Workforce Page & Subject-Specialization Approval Design

## Goal

Split "Faculty Workforce" out of the Faculty Loading page into its own
navigation entry, open it to two roles instead of one, and add an
approval gate to the existing faculty self-declared "subjects I can
teach" list:

1. **New nav module `faculty-workforce`** for `program_chair` (own
   college, full read/write) and `registrar_head` (all four colleges,
   read-only).
2. **`FacultyLoadingWorkspace`** loses the "Faculty Workforce" button and
   both of its dialogs — it goes back to being threshold + term selector
   + metrics + Subject/Professor filters + the load report list only.
3. **`FacultySpecialization`** (the existing "subjects a professor can
   teach" capability list) gains a `pending`/`approved`/`rejected`
   status. A professor's own self-declared row starts `pending`; a
   Program Chair can create a row directly for a professor in their
   college (auto-`approved`), or approve/reject a professor's pending
   row. This reuses the Withdrawal Request approval pattern already
   established in this codebase (status guard + audit pair +
   notification pair), not a new pattern.

No new database table. No change to `FacultyCurriculumSubjectPreference`
(the ranked, curriculum+semester preference list used by the schedule
recommendation engine) — that model is out of scope; "subjects a
professor can teach" means `FacultySpecialization` specifically.

## Current state

- **`faculty-loading-workspace.tsx`** (616 lines) is one module
  (`ConnectedModuleId` `"faculty-loading"`) that renders the load
  report *and* contains the "Faculty Workforce" trigger button plus two
  `Dialog`s: a roster table (`workforceOpen`, `workforceQuery =
  useFacultyDirectoryQuery(true)`) and a per-member edit form
  (`workforceEditing`, `workforceDraft`, `saveWorkforceProfile` calling
  `updateFacultyWorkforceProfile`). This is all self-contained in one
  file with no separate component.
- **`FacultyMemberPolicy`** (`backend/app/Policies/FacultyMemberPolicy.php`):
  `viewAny` and `updateWorkforceProfile` are both gated to
  `UserRole::ProgramChair` with a non-null college; `updateWorkforceProfile`
  additionally requires the target faculty member's `college` to equal
  the actor's. Registrar Head has no access today.
- **`ListFacultyMembers`** (`backend/app/Actions/Identity/ListFacultyMembers.php`)
  unconditionally scopes `User::where('college', $actor->college?->value)`
  — there is no branch for a college-agnostic caller.
- **`FacultySpecialization`** (`backend/app/Models/FacultySpecialization.php`):
  columns `professor_id`, `subject_id`, `proficiency`
  (`SpecializationProficiency::Primary|Secondary`), `source` (string:
  `declared` or `seeded`), `notes`. No status column, no decision
  metadata. `scopeVisibleTo` already gives any non-learner-scoped role
  (Program Chair, Registrar Head, etc.) the **entire unfiltered table**
  — no college scoping at all.
- **`FacultySpecializationPolicy`**: `viewAny` → true for everyone;
  `view` → any non-learner-scoped role, or the owning professor;
  `create` → `UserRole::Faculty` only; `delete` → the owning Faculty
  only. No `update` ability exists.
- **`CreateFacultySpecialization`** action hardcodes
  `'professor_id' => $actor->id` and `'source' => 'declared'` — it can
  only ever create a row for the caller themselves.
- **`StoreFacultySpecializationRequest`** validates `subject_id` against
  `$this->user()->college` and against a uniqueness check scoped to
  `$this->user()->id` — it assumes the actor *is* the professor.
- **`FacultySpecializationController::index`** takes no filter
  parameters; it returns every visible row with no `professor_id` or
  `college` narrowing.
- **Withdrawal Request approval pattern** (the template to copy, see
  `backend/app/Actions/Enrollment/TransitionWithdrawalRequest.php` and
  `WithdrawalStatus`): a `pending|approved|rejected` status enum on the
  row, `processed_by`/`processed_at` columns, a single `decide` Policy
  ability, a `Transition*` Action that row-locks
  (`lockForUpdate()->firstOrFail()`), guards the current status,
  requires a reason for rejection, updates status + decision metadata
  inside a `DB::transaction`, records a paired `AuditAction`
  (`*_approved`/`*_rejected`), and sends a `Notification` to the
  affected user via a paired `NotificationType`.
- **Cross-college "Registrar Head sees everything" precedent**:
  `AcademicGrade::scopeVisibleTo` and `AcademicTermCollegeWorkflowPolicy`
  both special-case `UserRole::RegistrarHead` with an unconditional
  "no college filter" branch, alongside the normal
  Program-Chair-same-college branch. This is the pattern to copy for
  `FacultyMemberPolicy`/`ListFacultyMembers`.

## Approved design

### 1. Navigation

- Add one `portalModule("faculty-workforce", "Faculty Workforce", ..., <icon>)`
  entry to **both** `program_chair.modules` and `registrar_head.modules`
  in `role-capabilities.ts`.
- Add `"faculty-workforce"` to `ConnectedModuleId`, `connectedModuleIds`,
  and `connectedModuleRegistry` in `module-registry.tsx`, mapped to a new
  `FacultyWorkforceWorkspace` component. No new route file — the
  existing `/portal/[moduleId]` dynamic route resolves it.

### 2. Frontend: `FacultyWorkforceWorkspace` (new file)

- Roster: a text-filtered table of faculty (name search), sourced from
  `useFacultyDirectoryQuery(true)`. For `program_chair` this is already
  college-scoped server-side (unchanged). For `registrar_head`, add a
  College filter (`SearchableCombobox`, options = the 4 `CollegeCode`
  values, default "All colleges") — the query passes an optional
  `college` param, ignored server-side for Program Chair (see backend
  §4) and required for Registrar Head to narrow.
- Row click opens a detail panel (reuse `Dialog`, matching the existing
  visual style) showing: profile fields, the existing workforce-status
  edit form (moved verbatim from `faculty-loading-workspace.tsx` —
  `workforceDraft`/`saveWorkforceProfile`/`updateFacultyWorkforceProfile`,
  unchanged logic), and a **Subject specializations** section listing
  that professor's `FacultySpecialization` rows (fetched via
  `GET /api/v1/faculty-specializations?professor_id=`, see §4) each with
  a status badge (Pending/Approved/Rejected, same badge style already
  used elsewhere, e.g. `Badge variant="warning"` for pending).
- Role-gated actions, all hidden for `registrar_head`:
  - Edit workforce status/employment type (existing behavior, moved).
  - "Add subject" (`SearchableCombobox` over that college's subjects,
    excluding any subject the professor already has a specialization row
    for regardless of status — the existing DB-level uniqueness
    constraint on `(professor_id, subject_id)` would otherwise reject the
    request; a pending self-declared row is approved/rejected from the
    detail panel instead of re-added here — plus a proficiency select) →
    `POST /api/v1/faculty-specializations` with an explicit
    `professor_id`.
  - Per pending row: Approve / Reject buttons → `PATCH
    /api/v1/faculty-specializations/{id}` (see §4); Reject opens a small
    reason `Input` (required, matching the Withdrawal Request UI
    convention).
- `faculty-loading-workspace.tsx`: delete the "Faculty Workforce" button,
  both `Dialog`s, and their state/hooks/mutations
  (`workforceOpen`, `workforceEditing`, `workforceDraft`, `workforceQuery`,
  `visibleWorkforce`, `saveWorkforceProfile`, `openWorkforceProfile`).
  Everything else in that file (threshold, term selector, metrics,
  Subject/Professor filters, load report list) is unchanged.
- `faculty-subject-preference-form.tsx` (the professor's own self-service
  form): its Proficiency field already posts to
  `POST /api/v1/faculty-specializations`. Add a small read-only status
  badge next to each of the professor's own specialization rows (fetched
  from the same `index` endpoint, `professor_id` omitted so it
  self-scopes per `FacultySpecialization::scopeVisibleTo` for a learner-
  scoped role) so a professor can see Pending/Approved/Rejected on what
  they declared. No new professor-facing action beyond that badge.

### 3. Backend: approval workflow on `FacultySpecialization`

- **Migration**: add `status` (string, default `'approved'` — this
  backfills every pre-existing row, so nothing already used by the
  recommendation engine silently disappears behind a new pending gate),
  `decided_by` (nullable FK to `users`), `decided_at` (nullable
  timestamp), `decision_reason` (nullable string). Add a
  `FacultySpecializationStatus` enum (`Pending|Approved|Rejected`) in
  `App\Domain\Faculty`, matching the `WithdrawalStatus` shape, and cast
  `status` to it on the model.
- **`source`**: add a third value, `program_chair_assigned`, alongside
  the existing `declared`/`seeded`.
- **`CreateFacultySpecialization::execute`**: accept an actor and an
  explicit `professor_id` in `$validatedData` (currently absent —
  today it's always `$actor->id`). When `$actor->id === $professorId`
  (Faculty self-service): `source = 'declared'`, `status = 'pending'`.
  When the actor is a Program Chair creating for someone else:
  `source = 'program_chair_assigned'`, `status = 'approved'`,
  `decided_by = $actor->id`, `decided_at = now()`.
- **New `DecideFacultySpecialization` action** (mirrors
  `TransitionWithdrawalRequest`): `execute(User $actor, FacultySpecialization
  $specialization, 'approve'|'reject' $action, ?string $reason,
  AuditRequestContext $context)`. `DB::transaction`, row-lock, guard
  `status === Pending` (else `ValidationException`), require `$reason`
  when `$action === 'reject'`, set `status`/`decided_by`/`decided_at`/
  `decision_reason`, record `AuditAction::FACULTY_SPECIALIZATION_APPROVED`
  or `...REJECTED` (new constants, `faculty_specialization.approved` /
  `.rejected`, added to the audit action list), send a `Notification`
  to `$specialization->professor_id` via a new paired `NotificationType`
  (`FacultySpecializationApproved`/`FacultySpecializationRejected`).
- **`FacultySpecializationPolicy`**:
  - `create`: `UserRole::Faculty` (self, existing) **or**
    `UserRole::ProgramChair` with a non-null college (new).
  - New `decide(User $user, FacultySpecialization $specialization)`:
    `$user->role === UserRole::ProgramChair && $user->college !== null
    && $specialization->professor->college === $user->college`.
  - `viewAny`/`view` unchanged (already correctly open).
- **`StoreFacultySpecializationRequest`**: add an optional
  `professor_id` field. When absent, defaults to the authenticated user
  (existing Faculty self-service path, unchanged validation). When
  present (Program-Chair path), validate the target is `role=faculty`
  and same college as the actor, and drop the "unique per current user"
  rule in favor of "unique per the target professor_id".
- **`FacultySpecializationController`**:
  - `index`: accept optional `professor_id` and `college` query
    params. `professor_id` narrows to that professor (used by the
    detail panel and the professor's own preference form). `college`
    is honored only when the actor is Registrar Head (Program Chair is
    already implicitly single-college via `scopeVisibleTo`'s existing
    unfiltered-for-planning-roles behavior — narrow that scope to
    "same college as actor" for Program Chair specifically, see below).
  - Add `update(Request $request, FacultySpecialization
    $facultySpecialization, DecideFacultySpecialization $action, ...)`:
    `$this->authorize('decide', $facultySpecialization)`, validates
    `action` (`in:approve,reject`) and `reason` (required when
    rejecting), calls the action, returns the updated resource.
  - Route: `PATCH /api/v1/faculty-specializations/{facultySpecialization}`
    (new; `store`/`destroy` already exist on this resource).
- **`FacultySpecialization::scopeVisibleTo`**: today any non-learner-
  scoped role gets everything, unfiltered. Narrow this so
  `UserRole::ProgramChair` only sees rows for professors in their own
  college (`whereHas('professor', fn ($q) => $q->where('college',
  $user->college?->value))`), while `UserRole::RegistrarHead` (and any
  other non-learner-scoped role) keeps the current unfiltered behavior.
  This is the one behavior change to existing (non-approval-related)
  callers of this scope — worth flagging explicitly since the
  recommendation engine (`GenerateFacultyAssignmentRecommendations`)
  reads specializations too; confirm in the implementation plan that it
  already queries per-professor (so college-narrowing is a no-op for
  it) rather than relying on the previously-unfiltered full table.
- **`FacultySpecializationResource`**: add `status`, `status_label`,
  `decided_by`, `decided_at`, `decision_reason` to the response payload.

### 4. Backend: Registrar Head cross-college workforce access

- **`FacultyMemberPolicy::viewAny`**: widen to `UserRole::ProgramChair
  && $user->college !== null` **or** `UserRole::RegistrarHead`.
  `updateWorkforceProfile` is unchanged (Program Chair, same-college
  only) — Registrar Head still cannot edit.
- **`ListFacultyMembers::execute`**: branch on actor role — Program
  Chair keeps today's `where('college', $actor->college?->value)`;
  Registrar Head gets no college filter (matches
  `AcademicGrade::scopeVisibleTo`'s existing precedent) **unless** an
  explicit `college` request parameter is supplied, in which case
  narrow to it (backs the frontend's College filter dropdown). Thread
  this optional `college` param from `FacultyMemberController` down to
  the action (new parameter on `execute()`, backward compatible —
  existing Program-Chair call sites don't pass it and keep their
  current single-college behavior).

## Access control summary

| Action | Program Chair | Registrar Head |
|---|---|---|
| View Faculty Workforce page | own college only | all 4 colleges (filterable) |
| View a professor's profile/specializations | yes | yes (read-only) |
| Edit workforce status/employment type | yes, own college | no |
| Create a specialization for a professor | yes, own college (auto-approved) | no |
| Approve/reject a professor's pending specialization | yes, own college | no |

## Out of scope (explicitly deferred)

- `FacultyCurriculumSubjectPreference` (the ranked curriculum+semester
  preference list) is untouched — no approval gate added there.
- No change to `GenerateFacultyAssignmentRecommendations`'s scoring
  logic beyond confirming the `scopeVisibleTo` narrowing doesn't break
  it (see §3).
- No notification to the Program Chair when a professor *submits* a
  pending specialization (only the approve/reject notification back to
  the professor is in scope) — can be added later the same way if
  wanted.
- No bulk-approve UI; approve/reject is one row at a time.
