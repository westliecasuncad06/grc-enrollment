# Registrar Enrollment Review Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a Registrar Staff enrollment review as the same compact schedule table used in the Student section view.

**Architecture:** Keep `EnrollmentReviewDialog`'s existing reference-data join and dialog state. Replace only its list of subject cards with the existing `DataTable`, supplying rows resolved from the enrollment and the same seven schedule columns used by the Student selection table.

**Tech Stack:** Next.js client component, React, TypeScript, TanStack Query, shadcn/ui, Vitest, Testing Library.

## Global Constraints

- Preserve the existing modal, its loading and empty states, and all enrollment review/decision behavior.
- Use the current `DataTable` component; do not add a dependency or a new table primitive.
- Keep the seven visible columns exactly: Subject code, Description, Units, Section ID, Day, Time, Room; Day and Time remain separate cells.
- Preserve the shared table component's existing responsive card fallback on narrow screens.
- Keep real API-boundary fetch mocks contract-complete in the existing Registrar workspace test.
- Do not commit or push without an explicit user request.

---

### Task 1: Cover the Registrar review schedule table

**Files:**
- Modify: `frontend/src/features/components/portal/registrar-enrollment-workspace.test.tsx`

**Interfaces:**
- Consumes: the existing Registrar Staff Review action and `EnrollmentReviewDialog` rendered by `RegistrarEnrollmentWorkspace`.
- Produces: a regression test proving the Review dialog presents one accessible schedule table with the seven required headers and resolved row values.

- [x] **Step 1: Write the failing test**

Extend `reviews a student's chosen subjects, schedule, and units` after the dialog is opened. Assert the accessible table and exact required headers; assert the current fixture's explicit Section ID in the row.

```tsx
const scheduleTable = within(dialog).getByRole("table", {
  name: "Enrollment #9 schedule",
})

expect(
  within(scheduleTable).getAllByRole("columnheader").map((header) => header.textContent),
).toEqual([
  "Subject code",
  "Description",
  "Units",
  "Section ID",
  "Day",
  "Time",
  "Room",
])
expect(within(scheduleTable).getByText("55")).toBeInTheDocument()
expect(within(scheduleTable).getByText("MWF")).toBeInTheDocument()
expect(within(scheduleTable).getByText("08:00–09:00")).toBeInTheDocument()
```

- [x] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- --run src/features/components/portal/registrar-enrollment-workspace.test.tsx
```

Expected: FAIL because the current dialog renders a list of cards and no table named `Enrollment #9 schedule`.

- [x] **Step 3: Do not modify production code in this task**

Keep the failing test as the contract for Task 2.

### Task 2: Render the resolved review subjects in the shared table pattern

**Files:**
- Modify: `frontend/src/features/components/portal/enrollment-review-dialog.tsx`
- Test: `frontend/src/features/components/portal/registrar-enrollment-workspace.test.tsx`

**Interfaces:**
- Consumes: the existing `EnrollmentReviewDialog` props and its computed row fields: `subject_code`, `subject_title`, `units`, `section_id`, `schedule_days`, `starts_at_time`, `ends_at_time`, and `room`.
- Produces: `DataTable` rendered with caption `Enrollment #${enrollment.id} schedule` and the seven approved columns.

- [x] **Step 1: Write the minimal implementation**

Import `DataTable` and `DataTableColumn`. Define the dialog's columns locally so they map resolved row data to the exact display contract. Replace the card-only `formatMeeting` helper with a time-only formatter so the Day and Time cells remain separate.

```tsx
const columns: DataTableColumn<ReviewRow>[] = [
  { key: "code", header: "Subject code", render: (row) => row.subject_code },
  { key: "description", header: "Description", render: (row) => row.subject_title },
  { key: "units", header: "Units", render: (row) => row.units ?? "—" },
  { key: "section-id", header: "Section ID", render: (row) => row.section_id },
  { key: "day", header: "Day", render: (row) => row.schedule_days ?? "Not assigned" },
  {
    key: "time",
    header: "Time",
    render: (row) => formatTimeRange(row.starts_at_time, row.ends_at_time),
  },
  { key: "room", header: "Room", render: (row) => row.room ?? "Not assigned" },
]

<DataTable
  caption={`Enrollment #${enrollment.id} schedule`}
  rowKey={(row) => row.section_id}
  rows={rows}
  columns={columns}
/>
```

Remove only the stacked `<ul>` cards. Preserve the existing summary below the table, loading skeletons, and empty-state copy.

- [x] **Step 2: Run the focused regression to verify it passes**

Run:

```powershell
npm run test -- --run src/features/components/portal/registrar-enrollment-workspace.test.tsx
```

Expected: PASS, including the new table layout contract and existing approval-flow behavior.

- [x] **Step 3: Run final focused verification**

Run:

```powershell
npx eslint src/features/components/portal/enrollment-review-dialog.tsx src/features/components/portal/registrar-enrollment-workspace.test.tsx --max-warnings=0 --concurrency 4
npm run lint:fast -- src/features/components/portal/enrollment-review-dialog.tsx src/features/components/portal/registrar-enrollment-workspace.test.tsx
npm run typecheck
npx prettier --check src/features/components/portal/enrollment-review-dialog.tsx src/features/components/portal/registrar-enrollment-workspace.test.tsx
git diff --check
```

Expected: all commands exit successfully with no lint, type, formatting, or whitespace errors.
