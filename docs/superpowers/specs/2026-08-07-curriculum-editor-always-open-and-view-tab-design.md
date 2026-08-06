# Curriculum Editor: always-open access + read-only View tab

Date: 2026-08-07
Status: Approved

## Problem

The Program Chair's "Curriculum Editor" (`subjects-prerequisites` module) is
locked behind the same Enrollment-workflow gate as `sections-schedules`,
`faculty-assignment`, and `schedule-proposals`: it only opens once that
chair's college is in the `schedule_preparation` or `for_dean_approval`
workflow stage. Everywhere else in the workflow it renders as a grayed-out
sidebar link and, if navigated to directly, an "Enrollment step in progress"
locked page.

This is wrong for the Curriculum Editor specifically: curriculum maintenance
(and browsing) is not an enrollment-cycle step — a Program Chair should be
able to open it any time.

Separately, the only way to see a program's curriculum today is the dense
editable form (program/name/status pickers, per-year tabs, inline subject
search, prerequisite editors, autosave). There's no simple, read-only,
filterable table for a chair who just wants to check "what subjects, units,
are in 2nd year 1st semester of BSED-ENG" — the shape the source Excel
schedules (`Subject And Prerequisuite/2024 - 2029 Curriculum 1st/2nd
Semester.xlsx`) are conceptually organized in, reduced to the three columns
that matter for that read: Subject Code, Description, Units.

## Goals

1. Curriculum Editor is never gated by Enrollment workflow stage for Program
   Chairs — always accessible from the sidebar and directly.
2. Add a read-only "View" table alongside the existing edit form, filterable
   by Program (which doubles as majorship, see below), Year level, and
   Semester, showing Code / Description / Units.
3. No backend data changes — the real 2024-2029 curricula (units, subjects,
   year/semester placement) are already seeded correctly from the source
   schedules by `GrcCurriculumSeeder` (see its docblock). This is a read
   surface on existing data only.

## Non-goals

- Changing the existing Manage/edit form's behavior, fields, or autosave.
- Adding an explicit "majorship" dropdown separate from Program — majors are
  already distinct `Program` rows (`BSED-ENG`, `BSED-FIL`, `BSED-SOCSCI`,
  `BSED-VAL`, `BSBA-FM`, `BSBA-MM`, `BSBA-HRM`); the existing Program select
  pattern (`code — name`) already surfaces the major in one control.
- Surfacing archived curriculum versions (2018-2023, 2012-2017) in the View
  tab — it shows each program's **active** curriculum only.
- Any change to `sections-schedules`, `faculty-assignment`, or
  `schedule-proposals` gating — they keep their existing workflow-stage gate.

## Design

### 1. Remove the Curriculum Editor's workflow gate

Two call sites currently gate `subjects-prerequisites`:

- `frontend/src/features/components/pages/portal-module-page.tsx` —
  `programChairGatedModules` (a `Set` wrapped around `ProgramChairModuleGate`).
- `frontend/src/features/components/layouts/portal-shell.tsx` — the sidebar
  nav's `locked` array, which grays out the link and (per existing behavior)
  presumably blocks/badges navigation.

Remove `"subjects-prerequisites"` from both lists. No other change to the
gating mechanism — `sections-schedules`, `faculty-assignment`, and
`schedule-proposals` keep gating exactly as today.

### 2. `CurriculumWorkspace` gets a Manage/View tab split

`frontend/src/features/components/portal/curriculum-workspace.tsx` currently
renders the edit form directly under `WorkspacePage`. Wrap the existing form
in a `Tabs` with two triggers:

- **Manage** — the existing form, unchanged (curriculum select, program/name/
  status fields, per-year placement tables, prerequisite graph dialog,
  autosave). This is today's entire component body, moved under this tab
  with no behavior change.
- **View** — new. A read-only table for browsing any program's active
  curriculum.

### 3. View tab

**Filters** (all client-side, over data already fetched by
`useCurriculaQuery`/`useProgramsQuery`/`useSubjectsQuery` — no new API
calls):

- **Program** — a `Select` of every program that has an active curriculum in
  the chair's already-college-scoped `useCurriculaQuery` result (the backend
  already restricts this query to the acting chair's college — see
  `CurriculumController::index`). Default: the first program alphabetically.
  Each option shows `code — name` exactly like the Manage tab's program
  select, so majors read as distinct rows (e.g. `BSED-ENG — Bachelor of
  Secondary Education major in English`).
- **Year level** — `Select`: "All years" / "1st Year" / "2nd Year" / "3rd
  Year" / "4th Year". Default: "All years".
- **Semester** — `Select`: "All semesters" / "1st Semester" / "2nd
  Semester". Default: "All semesters". A subject placed in both semesters
  (backend composite value `"1st|2nd"`) matches either specific-semester
  filter.

**Table**, modeled on the existing per-semester table pattern in
`prospectus-document.tsx` (`SemesterTable`): one `Table` per (year level,
semester) group present after filtering, in year/semester order, with a
`TableCaption` reading "Year `N` · `1st/2nd` Semester". Columns: **Code**,
**Description**, **Units** only — no prerequisites, no grade/status (this
isn't a student record), no faculty/schedule columns (that's
`sections-schedules`, not curriculum).

If the selected program has no active curriculum, or the active curriculum
has zero subjects after filtering, show a plain empty-state message (reuse
the existing `Empty`/`EmptyDescription` components already used elsewhere in
the portal) rather than an empty table shell.

### 4. Data source

No new hooks or endpoints. The View tab reads from the same
`useCurriculaQuery()` the Manage tab already loads (already scoped to the
chair's college server-side), filtered client-side to `status === "active"`
curricula, grouped by their `program_id`. `useProgramsQuery()` supplies the
program picker's `code`/`name` labels exactly as the Manage tab's program
`Select` already does.

## Testing

- Unit/component test for the gating removal: a Program Chair outside
  `schedule_preparation`/`for_dean_approval` can still render
  `subjects-prerequisites` (extend/adjust
  `frontend/src/features/components/pages/portal-module-page.test.tsx` and
  the portal-shell sidebar test if one exists covering the `locked` array).
- Component tests for the new View tab: program/year/semester filtering
  narrows the rendered rows correctly, a subject with composite
  `"1st|2nd"` semester appears under both semester filters, and the empty
  state renders when a program has no active curriculum.
- No backend tests needed (no backend changes).
