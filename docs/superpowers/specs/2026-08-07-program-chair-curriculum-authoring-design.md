# Program Chair Curriculum Authoring Redesign

**Date:** 2026-08-07
**Status:** Approved for implementation planning
**Scope:** Program Chair curriculum creation and Draft subject authoring in the
existing Curriculum Editor. The existing Draft → Dean Review → Executive Review
→ Active workflow remains in force.

## Goal

Replace the current header form and “Subject to place” control with a guided
creation flow and a year-scoped, spreadsheet-style subject editor. A Program
Chair must only create and edit curricula for programs in their assigned
college. The screen must preserve the existing 1st–4th Year navigation and
per-row 1st/2nd Semester placement.

## Confirmed product rules

1. The Program dropdown shows only programs belonging to the signed-in Program
   Chair's college (for example, CCS or COE). The API enforces the same rule;
   hiding options in the browser is not sufficient authorization.
2. Creating a curriculum is a two-step wizard: choose Program, then enter
   Curriculum name. Effective school year and status are not editable inputs.
3. On Proceed, the server creates an empty Draft curriculum and opens its
   preview/editor.
4. The server derives `effective_school_year` from the current active academic
   term. If there is no current term, it uses the latest configured term using
   the existing academic-term ordering. If no academic term exists, creation
   fails with a clear validation error.
5. Draft status remains visible as a read-only badge. It is not a dropdown.
   Existing approval-flow locks remain: only Draft curricula can be changed.
6. The editor retains 1st Year, 2nd Year, 3rd Year, and 4th Year tabs. Each
   placement row records 1st Semester or 2nd Semester.
7. The table columns visible to the Program Chair are Subject Code,
   Description, Units, Semester, and Prerequisite. An unobtrusive row-removal
   action may sit at the end of an editable row without changing those fields.
8. Adding a row presents two choices:
   - **Create new subject:** create the subject record in the database and add
     it to the Draft in the selected year and semester.
   - **Use existing subject:** search only subjects from the selected program's
     current/latest active curriculum. Subjects from older curriculum versions
     are never returned as candidates.
9. Selecting an existing subject automatically fills Code, Description, and
   Units. Semester and Prerequisite remain placement choices in the Draft.
10. A new subject belongs to the Program Chair's college. Its college is
    derived by the server, not sent as a trusted browser field.
11. Prerequisites are selected from subjects already placed in the new Draft.
    The system blocks duplicate placements, self-prerequisites, and direct or
    transitive prerequisite cycles.

## User experience

### Manage-tab entry point

When no curriculum is selected, Manage shows a centered **Create new
curriculum** call to action. The existing curriculum selector remains available
for opening an existing Draft or viewing a locked curriculum, but the creation
flow is no longer embedded in the header fields.

### Creation wizard

1. **Program step** — a selectable, accessible list/search control contains
   only the authenticated Program Chair's college-scoped programs. The college
   context is clear in the dialog so the user understands why no other college
   programs appear.
2. **Name step** — the user enters the curriculum name. The dialog offers Back,
   Cancel, and Proceed. It does not show Effective school year or Status.
3. **Proceed** — the request creates a server-owned Draft, then the UI selects
   it and renders its curriculum preview. The returned resource may still
   contain its effective school year and status for display and workflow logic;
   neither becomes an editable field.

### Preview and edit mode

Immediately after creation, the screen presents the same readable curriculum
table used by the View experience, scoped to the selected year tab. A bottom
**Edit curriculum** button enters edit mode only when the status is Draft.

In edit mode:

- the table uses normal keyboard-accessible inputs/selects and retains its
  column headers;
- the chosen Year tab determines `year_level` for every row added there;
- each row exposes a Semester selector with 1st Semester and 2nd Semester;
- the old “Subject to place” select and “Add subject placement” button are
  removed;
- a bottom **Add subject row** action opens the row-source chooser;
- the existing autosave behavior is retained with visible Saving, Saved, and
  Retry/error feedback; and
- leaving Draft status disables the entire authoring surface and returns to the
  normal read-only/approval behavior.

### Row-source chooser

Clicking Add subject row opens a focused dialog or popover with two explicit
actions.

#### Create new subject

The form asks for Subject Code, Description, and Units. After a successful
save, the server creates the college-owned subject and its placement in the
selected Draft transactionally. The resulting row appears in the active Year
tab, ready for Semester and Prerequisite editing.

#### Use existing subject

The chooser provides a searchable command-style list of candidates from the
selected program's current/latest active curriculum. It does not use the
unfiltered general subject catalog and never mixes older curriculum versions.
Choosing an item creates its placement in the Draft and fills Code,
Description, and Units. If the selected program has no usable current/latest
curriculum, this action explains that there are no reusable subjects while
leaving Create new subject available.

### Prerequisite cell

The prerequisite control searches subjects already in the Draft and supports
the placement's existing prerequisite representation. It excludes the row's
own subject and shows an inline message for rejected cycles. The backend remains
the final source of truth for cycle validation.

## API and authorization design

### Program access

`GET /api/v1/programs` will scope Program Chair results to the user's assigned
college. The API should return no authorable programs for a Program Chair with
no college assignment.

Curriculum creation and updates must independently verify that the program (or
the curriculum's program) has the same college as the Program Chair. This
closes direct-URL and forged-payload access paths. Dean and Executive Director
approval behavior remains as already designed: Dean is college-scoped and the
Executive Director is institution-scoped.

### Draft creation

`POST /api/v1/curricula` accepts only the user-entered creation fields:

```json
{
  "program_id": 42,
  "name": "BS Computer Science 2026 Curriculum",
  "subjects": []
}
```

The server, within the create action's transaction, resolves the academic term
from the authoritative current-term slot. If unavailable, it uses the same
latest-term ordering already exposed by the academic-terms API. It writes that
term's `school_year` as `effective_school_year` and always writes `draft` as
the initial status. The browser cannot supply either field.

### Current/latest reuse candidates

Add this college-authorized endpoint:

```
GET /api/v1/programs/{program}/current-curriculum-subjects
```

It resolves only the program's current/latest **active** curriculum, returns
its distinct placed subjects in the existing subject-resource shape, and does
not expose older-version placements. The implementation will define the
resolver centrally: prefer the active curriculum matching the server-resolved
academic-term school year; otherwise use the latest active curriculum in the
program's existing version ordering. An empty response is valid.

The endpoint and resolver must verify the Program Chair's college before
returning candidates. The row-add action must repeat that validation when the
client submits an existing subject ID, so a browser cannot inject a subject
from an older or another program's curriculum.

### Atomic subject-row creation

Add this Draft-only endpoint:

```
POST /api/v1/curricula/{curriculum}/subject-placements
```

It accepts a source discriminator plus the selected year and semester:

- `source: "new"` carries Code, Description, Units, year level, and semester.
  The action derives college from the Program Chair, creates the `subjects`
  record, and creates the curriculum placement in one database transaction.
- `source: "existing"` carries a reusable subject ID, year level, and semester.
  The action verifies source eligibility against the current/latest curriculum
  resolver, then creates the new Draft placement transactionally.

After either action, the endpoint returns the refreshed curriculum resource.
The existing full-replacement `PATCH /api/v1/curricula/{curriculum}` remains
the autosave path for in-cell edits, removals, and prerequisites. It continues
to reject edits after a Draft has been submitted for review.

Both actions require Program Chair ownership of the curriculum's college and
Draft status. Subject code uniqueness follows the existing `(college, code)`
database constraint. The action records the subject creation and curriculum
change in the existing audit vocabulary/snapshot pattern.

## Frontend boundaries

Split the current large `CurriculumWorkspace` into focused, testable parts
while preserving its service-module API boundary:

- `CurriculumCreationWizard` handles Program and Name steps only.
- `CurriculumPreview` owns the read-only selected-year display and the entry to
  edit mode.
- `CurriculumSpreadsheet` renders one active year of placements and emits
  placement edits only.
- `SubjectRowChooser`, `ExistingSubjectSearch`, and `NewSubjectForm` own their
  dialogs without direct fetch calls.
- Curriculum service functions and TanStack Query hooks own creation, current
  subject lookup, and subject-placement mutation/invalidation.

The frontend request schema removes editable effective school year and status
from the creation payload. The returned curriculum schema retains both fields
because the read-only status badge, reviewer modules, and API responses depend
on them.

## Failure handling and accessibility

- No college assignment: show that no programs can be created until the account
  is assigned a college; do not display another college's data.
- No active/latest academic term: prevent creation and show the API's clear
  term-configuration error.
- Duplicate subject code, duplicate Draft placement, and invalid existing
  subject: show API validation next to the relevant dialog/row and preserve
  the user's other Draft work.
- Autosave error: retain the unsaved table state, show Retry, and do not claim
  success until the API responds.
- Locked curriculum: controls are disabled and the user sees the workflow
  status rather than editable fields.
- Dialogs, the Year tabs, row controls, and search controls use the existing
  accessible shadcn primitives, keyboard focus management, visible labels, and
  error associations.

## Verification plan

### Backend

- Feature tests for college-scoped program listing and creation/update denial
  across colleges.
- Create tests that prove the server chooses the current term school year, then
  falls back to the latest term, and returns a validation error when no term
  exists.
- Endpoint/action tests for new-subject atomic creation, existing-subject
  placement, duplicate rejection, invalid candidate rejection, audit records,
  and Draft-only mutation.
- Resolver tests proving the reuse endpoint returns current/latest active
  curriculum subjects only and excludes older curriculum versions.
- Retain and run prerequisite-cycle and approval-workflow regression tests.

### Frontend

- Wizard tests for college-scoped programs, Back/Cancel/Proceed behavior, and
  removal of editable effective-year/status fields.
- Workspace tests for preview-to-edit transition, all four Year tabs, both
  Semester choices, and the absence of the old placement controls.
- Row chooser tests for search/autofill, empty reusable-candidate state, new
  subject insertion, prerequisite selection, lock behavior, and autosave
  feedback.

### Completion checks

Run the narrow affected backend and frontend suites after each slice, then the
applicable broader suites before declaring the feature complete. The known
local MySQL ALTER-permission blocker for the separate curriculum approval
migration remains external to this feature and must be reported if it still
prevents local migration application.

## Out of scope

- Changing the Archived/manual curriculum path.
- Changing the approved curriculum review state machine.
- Bulk copying every subject from a prior curriculum.
- Exposing other colleges' program or subject data to a Program Chair.
- A new academic-term policy beyond the existing current-term and latest-term
configuration behavior.
