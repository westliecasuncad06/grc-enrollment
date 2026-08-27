# Schedule/Faculty Loading Navigation Split & Room Scheduler Design

## Goal

Two related changes to the Program Chair's planning tools:

1. Split the single "Schedule & Faculty Loading" module into two independent
   navigation entries — **Schedule** and **Faculty Loading** — and upgrade
   Faculty Loading's Subject/Professor filters to searchable dropdowns.
2. Redesign the **Rooms** module from a flat filtered board into a
   term-scoped room picker that opens a per-room schedule (table or weekly
   calendar) and lets a Program Chair assign an existing unscheduled section
   directly into an open room/day/time slot.

Both operate on the existing `Section`/`AcademicTerm`/`Subject`/faculty
directory data. Neither introduces a new backend resource; sub-project 2
adds one small domain helper (`Subject::isLectureComponent()`).

**Sequencing:** these ship as two separate implementation passes, each with
its own plan. Sub-project 1 ships first — it introduces the shared
`Combobox` UI primitive that sub-project 2's room picker also uses.

## Sub-project 1: Split Schedule & Faculty Loading

### Current state

`schedule-faculty-loading-workspace.tsx` is one module (`ConnectedModuleId`
`"schedule-faculty-loading"`) rendering three `Tabs` — "Generated Schedule
and Assignments", "Faculty Load Report", "Faculty Workforce" — that share one
term selector and one Filters card (Subject text search, Professor `<select>`,
a separate "Find professor" text search, Assignment state).

### Approved design

- Replace the `"schedule-faculty-loading"` module id with two new ids:
  `"schedule"` and `"faculty-loading"`. Update `module-registry.tsx`
  (`ConnectedModuleId`, `connectedModuleIds`, `connectedModuleRegistry`) and
  `role-capabilities.ts` (nav label/description/icon for both entries,
  replacing the single "Schedule & Faculty Loading" `portalModule(...)`
  call for the Program Chair role).
- **`ScheduleWorkspace`** (new component): term selector (school
  year/semester) + the existing "Generated Schedule and Assignments"
  per-year grouped table + the existing edit-section dialog
  (`replaceSection`). No filter controls for now — deferred, per explicit
  instruction.
- **`FacultyLoadingWorkspace`** (new component): its own term selector +
  the "Faculty load threshold" card (moves here from the shared header,
  since it's a faculty-units concern) + a Filters card with two searchable
  dropdowns (Subject, Professor — see below) + the Faculty Load Report list
  + a **"Faculty Workforce" button** that opens the existing Workforce table
  and edit-profile dialog inside a `Dialog` modal instead of a third tab.
- Searchable dropdown = a combobox: a text input that filters a dropdown
  list of options as you type, single-select. Subject options come from
  `useSubjectsQuery()` (label: code — title); Professor options come from
  `useFacultyDirectoryQuery()` (label: name). This replaces today's
  Subject text-only search, the Professor `<select>`, and the separate
  "Find professor" text box with one control per field. No new UI
  primitive exists in `features/components/ui` yet — build a small
  `Combobox` component there (native-select fallback content, keyboard
  filtering) since it is reusable and this is the second place (after the
  room picker in sub-project 2) that wants it.
- Term-selection, "current vs. archived term" derivation, and the
  faculty-load report query are needed by `FacultyLoadingWorkspace` only
  (the Schedule page needs just the term selector, not the report).
  Extract the shared "pick a term, know if it's current" state into a small
  hook (e.g. `useAcademicTermSelection()`) used by both new components
  instead of duplicating the `sortedTerms`/`selectedTermId`/`isCurrentTerm`
  logic twice.
- `schedule-faculty-loading-workspace.tsx` is deleted once both new
  components exist and its tests are ported.

### Out of scope (explicitly deferred)

- Any new filter UI on the Schedule page.
- Changing `legalActions`/authorization for schedule proposals.

## Sub-project 2: Room scheduler

### Current state

`rooms-operations-workspace.tsx` renders one flat board: a filter toolbar
(search, availability, modality, day) above a table of every room in the
actor's scope with a scheduled-class count, plus a flat list of every
matching scheduled section below. Room options come from
`GET /api/v1/room-options` (`RoomCatalogEntryController`), which is already
college-scoped for `program_chair` (system-wide for `registrar_head`) via
`App\Domain\Organization\RoomCatalog`. **Confirmed: this per-college catalog
is kept exactly as-is — no backend room data changes.**

### Approved design

Replace the flat filtered board with a two-step picker that opens a
per-room detail view:

1. **Filter 1 — School Year & Semester.** Reuses `useAcademicTermSelection()`
   from sub-project 1. Selecting a term scopes everything below to that
   term's sections.
2. **Filter 2 — Room.** A list of the actor's room options for the
   selected term (same `useRoomOptionsQuery()`/`getLocalRoomOptions()`
   fallback as today, unchanged). Rendered using the `Combobox` component
   from sub-project 1 (type to narrow, pick one room).
3. **Room detail popup.** Selecting a room opens a `Dialog` scoped to that
   room + term, with a view toggle:
   - **Table view (default):** every section scheduled in that room this
     term — subject code/title, professor name, section code, day(s),
     time range. Same data `matchingSections()` already computes today,
     just scoped to one room instead of rendered as a page-wide list.
   - **Calendar view:** a weekly grid. Columns: Monday–Saturday (the
     app's existing single-letter day codes `M T W Th F Sat` used in
     `schedule_days`). Rows: 30-minute slots from 7:30 AM to 9:00 PM.
     Each scheduled section renders as a block in its day column(s),
     spanning (row-span) its actual `starts_at_time`–`ends_at_time`
     range. Empty cells are rendered distinctly as "available."
4. **BSIT lecture exclusion.** Within this room's schedule (table and
   calendar), a section is omitted if its `Subject` is the lecture half
   of a paired LEC/LAB subject **and** the section's program is BSIT.
   Add `Subject::isLectureComponent(): bool` (true when
   `paired_subject_id !== null` and `title` does not contain "LAB",
   case-insensitive — mirroring the existing title-suffix convention used
   by the `paired_subject_id` backfill). A section's program is resolved
   via `Section::section_plan_id → AcademicTermSectionPlan::curriculum_id
   → Curriculum::program_id`, the same path already available through
   `useSectionPlansQuery()`. The room-detail view filters on the frontend
   from the existing `useSectionsQuery()` + `useSubjectsQuery()` +
   `useSectionPlansQuery()` data — no new endpoint. Other programs
   continue to show their Lecture-component sections normally.
5. **Assign into an open slot.** Clicking an empty calendar cell (or an
   "Available" row in table view) opens a small form: pick an existing
   **unscheduled section** for the selected term — a `Section` with
   `room === null` whose subject's college matches the room's college
   (the same college scope `RoomCatalogEntryController` already applies)
   — and a Professor, defaulting day/time/room to the clicked slot
   (editable). Submits via the existing
   `replaceSection(section.id, toSectionReplacement(section, { room,
   schedule_days, starts_at_time, ends_at_time, professor_id }))` — the
   same `PATCH /api/v1/sections/{id}` the Schedule page's edit-section
   dialog already calls. No backend change.

### Out of scope (explicitly ruled out)

- Flattening the room catalog into one cross-college list (existing
  per-college `RoomCatalogEntry` data and scoping stay untouched).
- Creating brand-new sections from the Room page (only assigning existing
  unscheduled sections).
- Any change to `RoomCatalogEntryController` authorization or scoping.

## Data and boundaries (both sub-projects)

- No new database tables, columns, or endpoints. Sub-project 2 adds one
  pure-logic method on the `Subject` model.
- All term, section, subject, and faculty-directory data continues coming
  from the existing `useAcademicTermsQuery`, `useSectionsQuery`,
  `useSubjectsQuery`, `useFacultyDirectoryQuery`, `useRoomOptionsQuery`
  hooks — no new React Query keys beyond what a shared term-selection hook
  needs.
- Authorization is unchanged: Schedule and Faculty Loading remain
  Program-Chair-facing (same access the combined module had); Rooms
  remains Program Chair (college-scoped) and Registrar Head
  (system-wide), unchanged.

## Accessibility and responsive behavior

- The new `Combobox` has a visible label, is keyboard-operable (arrow keys
  + Enter to select, Escape to close), and exposes the selected value to
  screen readers (matches the existing shadcn form-control conventions
  already used across this codebase).
- The room calendar grid scrolls horizontally inside its own container on
  narrow viewports (per this codebase's existing wide-content convention)
  rather than letting the page scroll horizontally.
- Empty/no-match states (no rooms match, no sections this term, no
  unscheduled sections to assign) show a clear message, matching the
  existing Rooms board's empty-state pattern.

## Verification

- Component tests for `ScheduleWorkspace` and `FacultyLoadingWorkspace`
  replace `schedule-faculty-loading-workspace.test.tsx`, covering: term
  selection, threshold save, the Subject/Professor combobox filtering, and
  the Faculty Workforce modal open/edit/save flow.
- `module-registry.test.tsx` and `role-capabilities.test.ts` updated for
  the two new module ids and the removed one.
- New component tests for the Room picker + detail dialog: table view,
  calendar view toggle, an empty-slot assign flow (happy path + the
  unscheduled-sections-only constraint), and the BSIT lecture-exclusion
  rule (a paired LEC/LAB pair where only the LAB section renders, verified
  against a non-BSIT program's pair still showing both).
- A backend unit test for `Subject::isLectureComponent()` covering: paired
  LEC subject → true, paired LAB subject → false, unpaired subject → false.
- Frontend fast lint/typecheck and the focused backend test for the new
  Subject method must pass.
