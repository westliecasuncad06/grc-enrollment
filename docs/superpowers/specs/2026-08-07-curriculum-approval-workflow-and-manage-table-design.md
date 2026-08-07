# Curriculum Approval Workflow and Manage-Tab Table Redesign

**Date:** 2026-08-07
**Status:** Approved for implementation planning
**Scope:** Backend (status workflow, new Subject-creation capability) and frontend (Program Chair Manage tab, new Dean/Executive Director Curriculum Approvals module)

## Purpose

Today a Program Chair sets a curriculum's `status` (`draft` / `active` / `archived`) directly from a dropdown on the Manage tab — there is no review step. This makes an unreviewed curriculum immediately authoritative for degree progress and enrollment planning, which the product owner wants replaced with a real sign-off chain: **Program Chair submits → Dean approves → Executive Director approves → curriculum becomes Active.** The Status dropdown is removed; status becomes a system-managed consequence of that chain.

Separately, the Manage tab's subject-entry UI (free-form "Subject to place" selector + placement list, one Year tab covering all semesters) is replaced with a flat, filterable table matching the View tab's column layout (Code / Description / Units / Prerequisites), edited one Year+Semester slot at a time, with the ability to either place an existing subject or create a brand-new one inline.

Both pieces ship together because the Manage tab redesign only makes sense once "Save" and "Submit" are distinct, separately-gated actions.

## Out of scope

- The `Archived` status and its transition are untouched.
- Composite semester placements (a subject offered in both semesters, stored today as the string `"1st|2nd"`) stay exactly as they are now: producible only by direct seeding, not through the Manage UI. This is a pre-existing gap, not one this redesign introduces or fixes.
- No changes to the View tab (already shipped) beyond it continuing to read whatever the new workflow produces.

## 1. Status workflow

```
Draft --submit--> PendingDeanReview --dean_approve--> PendingExecutiveReview --executive_approve--> Active
                        |  ^                                  |  ^
                        |  |__________________________________|  |
                        |________________ dean_return / executive_return (reason required) _________|
                                          (both land back on Draft)
```

- New `CurriculumStatus` cases: `PendingDeanReview` (`pending_dean_review`), `PendingExecutiveReview` (`pending_executive_review`). `Draft`, `Active`, `Archived` already exist and keep their current meaning.
- `dean_return` and `executive_return` both return the curriculum to `Draft` and require a non-empty `reason`. The reason is stored (new `curricula.last_decision_reason` column, nullable string) and surfaced to the Program Chair.
- This mirrors `App\Domain\Scheduling\ScheduleProposalStatus` / `ScheduleProposalTransitionRules` / `TransitionScheduleProposal` structurally: a `CurriculumTransitionRules` domain class maps `action → [requiredStatus, targetStatus]`, and a `TransitionCurriculum` action applies one transition inside a locked-row transaction, writes an audit entry, and dispatches a notification.

## 2. Backend

### 2.1 Authorization scoping

- **Submit** (`Draft → PendingDeanReview`): Program Chair, only for curricula whose `program.college` matches the chair's own `college` (existing convention, e.g. `AutoAssignSectionScheduleReferences`'s college scoping).
- **Dean actions** (`dean_approve`, `dean_return`): Dean, only for curricula whose `program.college` matches the dean's own `college`.
- **Executive actions** (`executive_approve`, `executive_return`): Executive Director, unscoped (institution-wide, matching their existing "Enrollment" module scope).

`CurriculumPolicy` gains `submit(User, Curriculum)`, `approveAsDean(User, Curriculum)`, `approveAsExecutive(User, Curriculum)`, following the exact shape of `ScheduleProposalPolicy`.

### 2.2 New transition endpoint

`PATCH /api/v1/curricula/{curriculum}/transition` — body `{ action: string, reason?: string }`. A new `CurriculumController::transition` resolves the Policy ability per `action` via an `ABILITY_FOR_ACTION` map (identical pattern to `ScheduleProposalController`), then calls `TransitionCurriculum`.

This is a **new, separate** endpoint from the existing `PATCH /curricula/{curriculum}` (content save). Reusing one endpoint for both concerns (as `ScheduleProposalController::update` does) was considered and rejected here: Curriculum's existing update endpoint already has a distinct, well-tested shape (full subject-list replace) and mixing a `{action, reason}` transition payload into it would complicate both request validation and the autosave call site for no real benefit, since — unlike schedule proposals — the same UI action (chair editing) and the review actions (dean/executive deciding) never originate from the same form.

### 2.3 Locking content edits outside Draft

- `UpdateCurriculumRequest` and `StoreCurriculumRequest` **drop the `status` field entirely.** `CreateCurriculum` always creates at `Draft`. `UpdateCurriculum` no longer accepts or changes `status` — only the new transition action can.
- `UpdateCurriculum` (the action backing the existing content-save endpoint) now rejects the save with a 422 (`status: "Only a Draft curriculum can be edited."`) if `curriculum->status !== CurriculumStatus::Draft`. This is what makes the Manage tab read-only while `PendingDeanReview` / `PendingExecutiveReview`, and it also protects the endpoint if a stale tab tries to save after a review decision already moved the curriculum along.

### 2.4 Notifications

Four new `NotificationType` cases, mirroring the existing `Schedule*` family exactly:

- `CurriculumSubmittedForDean` — sent to the reviewing Dean when a chair submits.
- `CurriculumDeanApproved` — sent to the reviewing Executive Director (now the item needing their review) and to the submitting chair (progress update).
- `CurriculumExecutiveApproved` — sent to the chair; curriculum is now `Active`.
- `CurriculumReturned` — sent to the chair, includes the reason; fired for both `dean_return` and `executive_return`.

### 2.5 New Subject-creation capability

There is currently no write endpoint for `Subject` at all (`SubjectController` is a read-only single-action controller). The Manage table's "create new subject" path needs one.

- New `POST /api/v1/subjects` — body `{ code, title, units }`. Authorized to `ProgramChair` only (`SubjectPolicy::create`), matching the existing `CurriculumPolicy::create` shape.
- `code` is validated unique (case-insensitive) against `subjects.code`. On conflict, the request fails with a 422 pointing at the field, so the frontend can tell the chair to search for the existing subject instead of retrying blindly.
- The created `Subject` is immediately a real, permanent catalog row (subjects are a flat global catalog today, not versioned per curriculum-draft or per college) — consistent with how `curriculum_subjects.subject_id` already references it via foreign key. It is visible to every program's catalog search from that point on, independent of whether the curriculum it was created from is ever submitted or approved.

### 2.6 Migration

- `curricula.last_decision_reason` (nullable string) — the most recent return reason, cleared on the next successful submit.
- No backfill needed: every existing curriculum keeps its current `status` value as-is (including ones already `active`/`archived` from seed data) — the new workflow only governs the path forward from `Draft`.

## 3. Frontend — Program Chair Manage tab

### 3.1 Header controls

Program and Curriculum selectors, Curriculum name, and Effective school year fields are unchanged in position and behavior. The Status dropdown is removed and replaced with a read-only status badge (`Draft` / `Pending Dean Review` / `Pending Executive Review`) plus, when present, an `Alert` showing the last return reason and who returned it.

### 3.2 Year + Semester slot selection

Two button groups replace the single Year `Tabs` row:

- **Year level**: `1st Year` `2nd Year` `3rd Year` `4th Year` — no "All years" option, exactly one is always selected.
- **Semester**: `1st Semester` `2nd Semester` — no "All semesters" option, exactly one is always selected.

Together they pick exactly one (year, semester) slot. Both button groups are implemented as `Tabs`/`TabsList` (matching the existing red active-state styling from the Manage/View fix), not `Select` dropdowns, per explicit direction. Each button turns **green** (a `data-saved` style variant, distinct from the red active-state) once the currently-displayed slot has been saved at least once in the current session — see 3.4.

### 3.3 The table

Below the slot selector, a table scoped to exactly the selected (year, semester) — same four columns as the View tab: **Code / Description / Units / Prerequisites**.

- Every row is editable when the curriculum is `Draft`; the whole table renders read-only (no add/edit affordances) otherwise, consistent with 2.3's server-side lock.
- **Code cell**: the existing `SearchableCombobox` searching the Subject catalog, with one addition — a `+ Create new subject "<query>"` option pinned to the bottom of the results list when there's no exact match. Selecting it swaps that row's Code cell into three inline text inputs (Code, Description, Units) instead of the search box.

  On Save, the client first resolves every row still in "new subject" mode by calling `POST /subjects` (2.5) for each, in row order, before the main content-save PATCH fires. A row whose `POST /subjects` call fails (duplicate code) keeps its inline error and is dropped from the payload sent to the main PATCH; every other row (pre-existing placements plus rows that resolved successfully) still saves normally in that same PATCH call. The failed row stays in "new subject" edit mode, unsaved, so the chair can fix the code or switch it to search-and-pick the existing match.
- **Description / Units** cells: read-only display sourced from the chosen Subject (matches today's derivation — a placement doesn't carry its own copy of title/units).
- **Prerequisites cell**: badge chips (reusing the View tab's presentation) with an inline add/remove control — the existing `PrerequisiteEditor`'s per-row affordance, relocated into this cell instead of the separate "Prerequisite graph" dialog. The dialog itself stays available (unchanged) as a cross-year, whole-curriculum view of the dependency graph — the inline chips are for fast per-row edits within the current slot.
- **Add row**: one button below the table, adds a new blank row (empty Code cell) scoped to the current slot. A new curriculum starts with exactly one blank row already present in whichever slot is initially selected.

### 3.4 Save

An explicit **Save** button (not autosave) sits below the table, scoped to the current slot: it submits only the rows for the currently-selected (year, semester) via the existing content-save endpoint (2.3), leaving other slots' already-saved data untouched server-side (the payload is still a full-curriculum subject replace, so the client assembles the complete cross-slot subject list from local state before sending — mechanically the same shape as today's autosave payload, just now triggered by a click instead of a debounce).

On success: the current Year button and Semester button both switch to the green "saved" indicator for that slot. Switching to a different (year, semester) combination and back does not lose the green indicator, since it reflects server-confirmed state, not just local edit-session memory.

### 3.5 Submit

A **Submit for Dean Review** button sits at the very bottom of the Manage tab (below the slot editor, not per-slot) — enabled only when `status === Draft` and at least one subject is placed anywhere in the curriculum.

Clicking it opens a confirmation `Dialog`:

- Body: the full read-only subject listing across every year/semester with data, grouped exactly like the View tab (same table component, reused).
- Footer: `Cancel` and `Confirm & Submit`.

`Confirm & Submit` calls the transition endpoint (2.2) with `action: "submit"`. On success the tab re-renders locked (3.1's badge now reads `Pending Dean Review`).

## 4. Frontend — Dean and Executive Director: new "Curriculum Approvals" module

A new sidebar module, `curriculum-approvals`, added to both roles' module lists (`role-capabilities.ts`), positioned near their existing schedule-approval module.

- **List view**: one row per curriculum awaiting that role's decision (`PendingDeanReview` for Dean, scoped to their college; `PendingExecutiveReview` for Executive Director, unscoped) — program, curriculum name, effective school year, submitting chair, submitted-at. Empty state when nothing is pending.
- **Review action**: opens the same style of review dialog as `schedule-review-dialog.tsx` (sticky header with program/curriculum/submitter summary, scrollable body, sticky footer) — the body reuses the read-only grouped subject table (same component as 3.5's preview and the View tab).
- **Decision actions** in the sticky footer: `Return with notes` (opens the existing-pattern reason-required confirmation) and `Approve`. Labels: Dean's approve reads `Approve — send to Executive Director`; Executive Director's reads `Approve — activate curriculum`.

## 5. Testing

- Backend: `CurriculumTransitionRules` unit tests (every legal/illegal transition pair); `TransitionCurriculum` feature tests (happy path per action, reason-required enforcement on returns, college-scoping enforcement, row locking); `UpdateCurriculum` tests asserting a 422 outside `Draft`; new `SubjectController::store` tests (create, duplicate-code rejection, Program-Chair-only authorization).
- Frontend: `curriculum-workspace.test.tsx` gains coverage for the button-group slot selector, per-slot Save (including the green indicator), the create-new-subject inline flow, the Submit confirmation dialog, and the locked/read-only rendering outside Draft. A new `curriculum-approvals-workspace.test.tsx` (Dean and Executive Director variants) covers the list, review dialog, approve, and return-with-reason flows.
