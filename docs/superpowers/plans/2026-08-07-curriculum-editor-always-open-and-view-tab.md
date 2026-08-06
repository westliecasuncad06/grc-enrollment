# Curriculum Editor Always-Open Access + Read-Only View Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop gating the Program Chair's Curriculum Editor behind the Enrollment
workflow stage, and add a read-only, filterable "View" table (Code / Description /
Units, filterable by Program, Year level, Semester) alongside the existing edit form.

**Architecture:** Two call sites currently lock `subjects-prerequisites` to the
`schedule_preparation`/`for_dean_approval` Enrollment stages — the sidebar nav
(`portal-shell.tsx`) and the module page's `ProgramChairModuleGate`
(`portal-module-page.tsx`). Both simply drop it from their gated-module list. A new
presentational component, `CurriculumView`, takes the same `programs`/`curricula`
data `CurriculumWorkspace` already loads and renders it as one read-only `<Table>`
per (year level, semester) group, with client-side filters — no new API calls, no
backend changes. `CurriculumWorkspace` wraps its existing form and the new component
in a `Tabs` ("Manage" / "View"), defaulting to "Manage" so every existing test and
behavior is unchanged.

**Tech Stack:** Next.js (App Router), React Hook Form + Zod (unchanged, Manage tab
only), TanStack Query, Radix `Tabs`/`Select` (via this repo's `ui/` wrappers),
Vitest + Testing Library + `vitest-axe`.

## Global Constraints

- Curriculum data itself is not changing — `GrcCurriculumSeeder` already seeded the
  real 2024-2029 curricula (units, subjects, year/semester placement) for all 12
  programs from the source Excel schedules. This plan is a read/access-only change.
- The View tab's table shows exactly **Code, Description, Units** — no
  prerequisites, no day/time/room/faculty (those belong to Sections & Schedules, not
  the Curriculum Editor — see the Global Constraints of
  `docs/superpowers/plans/2026-08-06-curriculum-editor-and-real-schedule-data.md`).
- No explicit "majorship" control — majors are already distinct `Program` rows
  (`BSED-ENG`, `BSED-FIL`, `BSED-SOCSCI`, `BSED-VAL`, `BSBA-FM`, `BSBA-MM`,
  `BSBA-HRM`); the Program filter's `code — name` options already surface it.
- `sections-schedules`, `faculty-assignment`, and `schedule-proposals` keep their
  existing Enrollment-workflow gate exactly as today — only `subjects-prerequisites`
  changes.
- The View tab only shows each program's **active** curriculum — archived versions
  are excluded.
- The Manage tab is the default/first tab, so no existing test's behavior changes.

---

### Task 1: Remove the Enrollment-workflow gate from the Curriculum Editor

**Files:**
- Modify: `frontend/src/features/components/pages/portal-module-page.tsx:37-42`
- Modify: `frontend/src/features/components/layouts/portal-shell.tsx:114-122`
- Test: `frontend/src/features/components/pages/portal-module-page.test.tsx`
- Test: `frontend/src/features/components/layouts/portal-shell.test.tsx`

**Interfaces:**
- Consumes: nothing new — reuses `ProgramChairModuleGate`, `NavigationLink`, and the
  existing `useAcademicTermsQuery`/`useAcademicTermWorkflowsQuery` hooks exactly as
  they exist today.
- Produces: nothing new for later tasks — this task is self-contained.

- [ ] **Step 1: Write the failing test proving the module page gate is gone**

Add to `frontend/src/features/components/pages/portal-module-page.test.tsx`. First
update its top import line (it currently has no `vi`/`beforeEach`/`afterEach`):

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
```

Then append this new `describe` block at the end of the file, inside the outer
`describe("PortalModulePage", ...)` block's closing brace region (i.e. as a sibling
`describe` after it, at module scope):

```typescript
describe("Curriculum Editor access for a Program Chair", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  function requestUrl(input: RequestInfo | URL): string {
    if (typeof input === "string") return input
    return input instanceof URL ? input.toString() : input.url
  }

  /** Academic term is active and the chair's college workflow sits in `stage`. */
  function mockWorkflowStage(stage: string) {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes("/academic-term-workflows")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  type: "academic-term-workflow",
                  id: 1,
                  academic_term_id: 5,
                  college: "ccs",
                  college_label: "College of Computer Studies",
                  stage,
                  stage_label: stage,
                  curriculum_completed_at: null,
                  faculty_reviewed_at: null,
                  schedule_submitted_at: null,
                },
              ],
            }),
          ),
        )
      }
      if (url.includes("/academic-terms")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  type: "academic-term",
                  id: 5,
                  school_year: "2026-2027",
                  semester: "1st",
                  starts_at: null,
                  ends_at: null,
                  enrollment_opens_at: null,
                  enrollment_closes_at: null,
                  add_drop_deadline_at: null,
                  grading_deadline_at: null,
                  status: "semester_ongoing",
                  status_label: "Semester Ongoing",
                },
              ],
            }),
          ),
        )
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })
  }

  it("stays open while the chair's college Enrollment workflow is still in an earlier stage", async () => {
    mockWorkflowStage("curriculum_preparation")

    renderWithSession(
      <PortalShell>
        <PortalModulePage moduleId="subjects-prerequisites" />
      </PortalShell>,
      {
        route: "/portal/subjects-prerequisites",
        routeParams: { moduleId: "subjects-prerequisites" },
        session: {
          userId: "9",
          displayName: "Test Program Chair",
          role: "program_chair",
          college: "ccs",
          signedInAt: "2026-08-07T00:00:00.000Z",
        },
      },
    )

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Curriculum editor",
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Enrollment step in progress" }),
    ).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/components/pages/portal-module-page.test.tsx`
Expected: FAIL — the new test finds the heading "Enrollment step in progress"
instead of "Curriculum editor", because `subjects-prerequisites` is still in
`programChairGatedModules`.

- [ ] **Step 3: Remove `subjects-prerequisites` from the module-page gate**

In `frontend/src/features/components/pages/portal-module-page.tsx`, change:

```typescript
const programChairGatedModules = new Set([
  "subjects-prerequisites",
  "sections-schedules",
  "faculty-assignment",
  "schedule-proposals",
])
```

to:

```typescript
const programChairGatedModules = new Set([
  "sections-schedules",
  "faculty-assignment",
  "schedule-proposals",
])
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/components/pages/portal-module-page.test.tsx`
Expected: PASS (all tests in the file, including the pre-existing `it.each` loop).

- [ ] **Step 5: Write the failing test proving the sidebar link is no longer locked**

Add to `frontend/src/features/components/layouts/portal-shell.test.tsx`, inside the
existing `describe("PortalShell", ...)` block, alongside the other `it(...)` calls:

```typescript
  it("keeps the Curriculum Editor link unlocked while other Enrollment-gated links stay locked", async () => {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes("/academic-term-workflows")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  type: "academic-term-workflow",
                  id: 1,
                  academic_term_id: 5,
                  college: "ccs",
                  college_label: "College of Computer Studies",
                  stage: "curriculum_preparation",
                  stage_label: "Curriculum Preparation",
                  curriculum_completed_at: null,
                  faculty_reviewed_at: null,
                  schedule_submitted_at: null,
                },
              ],
            }),
          ),
        )
      }
      if (url.includes("/academic-terms")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  type: "academic-term",
                  id: 5,
                  school_year: "2026-2027",
                  semester: "1st",
                  starts_at: null,
                  ends_at: null,
                  enrollment_opens_at: null,
                  enrollment_closes_at: null,
                  add_drop_deadline_at: null,
                  grading_deadline_at: null,
                  status: "semester_ongoing",
                  status_label: "Semester Ongoing",
                },
              ],
            }),
          ),
        )
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })

    renderShell("program_chair", {
      session: { ...sessionFor("program_chair"), college: "ccs" },
    })

    const navigation = screen.getByRole("navigation", {
      name: "Role portal navigation",
    })
    expect(
      await within(navigation).findByRole("link", {
        name: "Curriculum Editor",
      }),
    ).not.toHaveAttribute("aria-disabled")
    expect(
      within(navigation).getByRole("link", { name: "Sections & Schedules" }),
    ).toHaveAttribute("aria-disabled", "true")
  })
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/components/layouts/portal-shell.test.tsx`
Expected: FAIL — the "Curriculum Editor" link still carries `aria-disabled="true"`.

- [ ] **Step 7: Remove `subjects-prerequisites` from the sidebar's locked array**

In `frontend/src/features/components/layouts/portal-shell.tsx`, change:

```typescript
              locked={
                enrollmentLinksLocked &&
                [
                  "subjects-prerequisites",
                  "sections-schedules",
                  "faculty-assignment",
                  "schedule-proposals",
                ].includes(module.id)
              }
```

to:

```typescript
              locked={
                enrollmentLinksLocked &&
                [
                  "sections-schedules",
                  "faculty-assignment",
                  "schedule-proposals",
                ].includes(module.id)
              }
```

- [ ] **Step 8: Run both test files to verify they pass**

Run: `cd frontend && npx vitest run src/features/components/layouts/portal-shell.test.tsx src/features/components/pages/portal-module-page.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/components/pages/portal-module-page.tsx frontend/src/features/components/layouts/portal-shell.tsx frontend/src/features/components/pages/portal-module-page.test.tsx frontend/src/features/components/layouts/portal-shell.test.tsx
git commit -m "fix(portal): stop gating the Curriculum Editor behind the Enrollment workflow stage"
```

---

### Task 2: Build the read-only `CurriculumView` table component

**Files:**
- Create: `frontend/src/features/components/portal/curriculum-view.tsx`
- Test: `frontend/src/features/components/portal/curriculum-view.test.tsx`

**Interfaces:**
- Consumes: `Program` and `Curriculum` types from
  `@/features/schemas/reference-data-schema` (already defined — `Curriculum.subjects`
  entries carry `subject_id`, `code`, `title`, `units?`, `year_level`, `semester`).
- Produces: `export function CurriculumView({ programs, curricula }: { programs: readonly Program[]; curricula: readonly Curriculum[] })`
  — a self-contained presentational component with its own filter state. Task 3
  imports this exact export and passes it `programsQuery.data ?? []` /
  `curriculaQuery.data ?? []`.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/features/components/portal/curriculum-view.test.tsx`:

```typescript
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { CurriculumView } from "@/features/components/portal/curriculum-view"
import { renderWithSession } from "@/tests/render-app"

const programs = [
  {
    type: "program",
    id: 1,
    code: "BSA",
    name: "BS Accountancy",
    status: "active",
    status_label: "Active",
  },
  {
    type: "program",
    id: 2,
    code: "BSIT",
    name: "BS Information Technology",
    status: "active",
    status_label: "Active",
  },
] as const

const curricula = [
  {
    type: "curriculum",
    id: 1,
    program_id: 1,
    name: "BSA 2024-2029",
    effective_school_year: "2024-2029",
    status: "active",
    status_label: "Active",
    subjects: [
      {
        subject_id: 11,
        code: "ACC101",
        title: "Financial Accounting",
        units: 3,
        year_level: 1,
        semester: "1st",
        is_required: true,
        prerequisites: [],
      },
      {
        subject_id: 12,
        code: "NSTP1",
        title: "National Service Training Program 1",
        units: 3,
        year_level: 1,
        semester: "1st|2nd",
        is_required: true,
        prerequisites: [],
      },
      {
        subject_id: 13,
        code: "ACC201",
        title: "Cost Accounting",
        units: 3,
        year_level: 2,
        semester: "2nd",
        is_required: true,
        prerequisites: [],
      },
    ],
  },
  {
    type: "curriculum",
    id: 2,
    program_id: 1,
    name: "BSA 2018-2023",
    effective_school_year: "2018-2023",
    status: "archived",
    status_label: "Archived",
    subjects: [
      {
        subject_id: 14,
        code: "OLD101",
        title: "Old Subject",
        units: 3,
        year_level: 1,
        semester: "1st",
        is_required: true,
        prerequisites: [],
      },
    ],
  },
  {
    type: "curriculum",
    id: 3,
    program_id: 2,
    name: "BSIT 2024-2029",
    effective_school_year: "2024-2029",
    status: "active",
    status_label: "Active",
    subjects: [
      {
        subject_id: 21,
        code: "ITC",
        title: "Introduction to Computing",
        units: 2,
        year_level: 1,
        semester: "1st",
        is_required: true,
        prerequisites: [],
      },
    ],
  },
] as const

function render(overrides: {
  programs?: typeof programs
  curricula?: typeof curricula
} = {}) {
  return renderWithSession(
    <CurriculumView
      programs={overrides.programs ?? programs}
      curricula={overrides.curricula ?? curricula}
    />,
  )
}

/** The `<table>` whose caption matches `captionText`. */
function tableFor(captionText: string): HTMLElement {
  const caption = screen.getByText(captionText)
  const table = caption.closest("table")
  if (!table) throw new Error(`No table found for caption "${captionText}"`)
  return table
}

async function selectOption(
  user: ReturnType<typeof userEvent.setup>,
  labelText: string,
  optionName: string,
) {
  await user.click(screen.getByLabelText(labelText))
  await user.click(await screen.findByRole("option", { name: optionName }))
}

describe("CurriculumView", () => {
  it("defaults to the alphabetically first program's active curriculum, grouped by year and semester, with only Code/Description/Units columns", () => {
    render()

    expect(screen.getByLabelText("Program")).toHaveTextContent(
      "BSA — BS Accountancy",
    )

    const firstYearFirstSem = tableFor("1st Year · 1st Semester")
    expect(within(firstYearFirstSem).getByText("ACC101")).toBeInTheDocument()
    expect(within(firstYearFirstSem).getByText("NSTP1")).toBeInTheDocument()
    const headers = within(firstYearFirstSem)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent)
    expect(headers).toEqual(["Code", "Description", "Units"])

    const firstYearSecondSem = tableFor("1st Year · 2nd Semester")
    expect(within(firstYearSecondSem).getByText("NSTP1")).toBeInTheDocument()
    expect(
      within(firstYearSecondSem).queryByText("ACC101"),
    ).not.toBeInTheDocument()

    const secondYearSecondSem = tableFor("2nd Year · 2nd Semester")
    expect(within(secondYearSecondSem).getByText("ACC201")).toBeInTheDocument()

    // The archived 2018-2023 curriculum never appears.
    expect(screen.queryByText("OLD101")).not.toBeInTheDocument()
  })

  it("filters to a single year level and semester", async () => {
    const user = userEvent.setup()
    render()

    await selectOption(user, "Year level", "2nd Year")
    await selectOption(user, "Semester", "2nd Semester")

    expect(screen.getByText("2nd Year · 2nd Semester")).toBeInTheDocument()
    expect(screen.queryByText("1st Year · 1st Semester")).not.toBeInTheDocument()
    expect(screen.queryByText("ACC101")).not.toBeInTheDocument()
    expect(screen.getByText("ACC201")).toBeInTheDocument()
  })

  it("switches to another program's active curriculum", async () => {
    const user = userEvent.setup()
    render()

    await selectOption(user, "Program", "BSIT — BS Information Technology")

    expect(screen.getByText("ITC")).toBeInTheDocument()
    expect(screen.queryByText("ACC101")).not.toBeInTheDocument()
  })

  it("shows an empty state when no program has an active curriculum", () => {
    render({ curricula: [curricula[1]] })

    expect(
      screen.getByText("No active curriculum is available to view yet."),
    ).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("shows an empty state when the filters exclude every subject", async () => {
    const user = userEvent.setup()
    render()

    await selectOption(user, "Year level", "4th Year")

    expect(
      screen.getByText("No subjects match the selected filters."),
    ).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/components/portal/curriculum-view.test.tsx`
Expected: FAIL with a module-not-found error — `curriculum-view.tsx` does not exist
yet.

- [ ] **Step 3: Implement `CurriculumView`**

Create `frontend/src/features/components/portal/curriculum-view.tsx`:

```typescript
"use client"

import { useMemo, useState } from "react"

import { Field, FieldLabel } from "@/features/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/components/ui/select"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
import type {
  Curriculum,
  Program,
} from "@/features/schemas/reference-data-schema"

const yearFilterOptions = [
  { value: "all", label: "All years" },
  { value: "1", label: "1st Year" },
  { value: "2", label: "2nd Year" },
  { value: "3", label: "3rd Year" },
  { value: "4", label: "4th Year" },
]
const semesterFilterOptions = [
  { value: "all", label: "All semesters" },
  { value: "1st", label: "1st Semester" },
  { value: "2nd", label: "2nd Semester" },
]

/** Deliberately not imported from curriculum-workspace.tsx — importing it back
 * would create a cycle once that file imports CurriculumView (Task 3). */
function yearLabel(year: number) {
  return `${year}${year === 1 ? "st" : year === 2 ? "nd" : year === 3 ? "rd" : "th"} Year`
}

/**
 * Mirrors the backend's `SemesterCoverage::parse` bucketing (see
 * `backend/app/Domain/Curriculum/SemesterCoverage.php`) so a composite
 * placement (`"1st|2nd"`, offered either semester) matches both specific
 * semester filters instead of only the first one found.
 */
function semesterSlots(raw: string): ("1st" | "2nd")[] {
  const normalized = raw.toLowerCase()
  const hasFirst = normalized.includes("1st")
  const hasSecond = normalized.includes("2nd")
  if (hasFirst && hasSecond) return ["1st", "2nd"]
  if (hasSecond) return ["2nd"]
  return ["1st"]
}

interface ViewRow {
  year_level: number
  semester: "1st" | "2nd"
  subjects: Curriculum["subjects"]
}

export function CurriculumView({
  programs,
  curricula,
}: {
  programs: readonly Program[]
  curricula: readonly Curriculum[]
}) {
  const activeCurricula = useMemo(
    () => curricula.filter((curriculum) => curriculum.status === "active"),
    [curricula],
  )
  const availablePrograms = useMemo(
    () =>
      programs
        .filter((program) =>
          activeCurricula.some(
            (curriculum) => curriculum.program_id === program.id,
          ),
        )
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code)),
    [programs, activeCurricula],
  )
  const [programId, setProgramId] = useState(0)
  const [yearFilter, setYearFilter] = useState("all")
  const [semesterFilter, setSemesterFilter] = useState("all")

  const selectedProgramId =
    programId > 0 ? programId : (availablePrograms[0]?.id ?? 0)
  const curriculum = activeCurricula.find(
    (item) => item.program_id === selectedProgramId,
  )

  const rows = useMemo<ViewRow[]>(() => {
    if (!curriculum) return []
    const byKey = new Map<string, ViewRow>()
    for (const subject of curriculum.subjects) {
      if (yearFilter !== "all" && subject.year_level !== Number(yearFilter))
        continue
      const slots = semesterSlots(subject.semester).filter(
        (slot) => semesterFilter === "all" || slot === semesterFilter,
      )
      for (const slot of slots) {
        const key = `${subject.year_level}-${slot}`
        const existing = byKey.get(key)
        if (existing) existing.subjects = [...existing.subjects, subject]
        else
          byKey.set(key, {
            year_level: subject.year_level,
            semester: slot,
            subjects: [subject],
          })
      }
    }
    return [...byKey.values()].sort((a, b) =>
      a.year_level !== b.year_level
        ? a.year_level - b.year_level
        : a.semester.localeCompare(b.semester),
    )
  }, [curriculum, yearFilter, semesterFilter])

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="curriculum-view-program">Program</FieldLabel>
          <Select
            value={selectedProgramId > 0 ? String(selectedProgramId) : ""}
            onValueChange={(value) => setProgramId(Number(value))}
          >
            <SelectTrigger id="curriculum-view-program" className="w-full">
              <SelectValue placeholder="Select a program" />
            </SelectTrigger>
            <SelectContent>
              {availablePrograms.map((program) => (
                <SelectItem key={program.id} value={String(program.id)}>
                  {program.code} — {program.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="curriculum-view-year">Year level</FieldLabel>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger id="curriculum-view-year" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearFilterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="curriculum-view-semester">Semester</FieldLabel>
          <Select value={semesterFilter} onValueChange={setSemesterFilter}>
            <SelectTrigger id="curriculum-view-semester" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {semesterFilterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {availablePrograms.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No active curriculum is available to view yet.
        </p>
      )}
      {availablePrograms.length > 0 && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No subjects match the selected filters.
        </p>
      )}

      {rows.map((row) => (
        <Table key={`${row.year_level}-${row.semester}`}>
          <TableCaption>
            {yearLabel(row.year_level)} · {row.semester} Semester
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Units</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {row.subjects.map((subject) => (
              <TableRow key={subject.subject_id}>
                <TableCell>{subject.code}</TableCell>
                <TableCell>{subject.title}</TableCell>
                <TableCell>{subject.units ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/components/portal/curriculum-view.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/components/portal/curriculum-view.tsx frontend/src/features/components/portal/curriculum-view.test.tsx
git commit -m "feat(portal): add a read-only, filterable CurriculumView table"
```

---

### Task 3: Wire `CurriculumView` into `CurriculumWorkspace` behind a Manage/View tab split

**Files:**
- Modify: `frontend/src/features/components/portal/curriculum-workspace.tsx:80` (imports), `:367-369` (Tabs open), `:745-749` (Tabs close)
- Test: `frontend/src/features/components/portal/curriculum-workspace.test.tsx`

**Interfaces:**
- Consumes: `CurriculumView` from Task 2, exactly as exported
  (`{ programs, curricula }` props).
- Produces: nothing new for later tasks — this is the final integration task.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/features/components/portal/curriculum-workspace.test.tsx`,
inside the existing `describe("CurriculumWorkspace", ...)` block:

```typescript
  it("defaults to the Manage tab and offers a read-only View tab of the program's active curriculum", async () => {
    const user = userEvent.setup()
    const activeCurricula = {
      data: [{ ...curriculum.data[0], status: "active", status_label: "Active" }],
    }
    fetchMock.mockImplementation((input) => {
      if (url(input).endsWith("/programs"))
        return Promise.resolve(new Response(JSON.stringify(programs)))
      if (url(input).endsWith("/subjects"))
        return Promise.resolve(new Response(JSON.stringify(subjects)))
      if (url(input).endsWith("/curricula"))
        return Promise.resolve(new Response(JSON.stringify(activeCurricula)))
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })
    renderWorkspace()

    // Manage is the default tab — the existing curriculum-select form is visible
    // without clicking anything, exactly as before this task.
    await screen.findByLabelText("Curriculum")
    expect(screen.getByRole("tab", { name: "Manage" })).toHaveAttribute(
      "aria-selected",
      "true",
    )

    await user.click(screen.getByRole("tab", { name: "View" }))

    expect(
      await screen.findByText("1st Year · 1st Semester"),
    ).toBeInTheDocument()
    const table = screen.getByRole("table")
    expect(within(table).getByText("CS101")).toBeInTheDocument()
    expect(within(table).getByText("Programming 1")).toBeInTheDocument()
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent)
    expect(headers).toEqual(["Code", "Description", "Units"])
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/components/portal/curriculum-workspace.test.tsx`
Expected: FAIL — there is no `tab` named "Manage" or "View" yet.

- [ ] **Step 3: Add the `CurriculumView` import**

In `frontend/src/features/components/portal/curriculum-workspace.tsx`, change:

```typescript
import { PrerequisiteEditor } from "@/features/components/portal/prerequisite-editor"
```

to:

```typescript
import { PrerequisiteEditor } from "@/features/components/portal/prerequisite-editor"
import { CurriculumView } from "@/features/components/portal/curriculum-view"
```

- [ ] **Step 4: Wrap the existing form in a Manage/View `Tabs` split**

Change the `AsyncBoundary` render prop's opening (currently):

```typescript
        {() => (
          <>
            <div className="flex gap-2">
```

to:

```typescript
        {() => (
          <Tabs defaultValue="manage" className="grid gap-4">
            <TabsList aria-label="Curriculum editor mode">
              <TabsTrigger value="manage">Manage</TabsTrigger>
              <TabsTrigger value="view">View</TabsTrigger>
            </TabsList>
            <TabsContent value="manage" className="grid gap-4">
              <div className="flex gap-2">
```

And its closing (currently):

```typescript
            </FieldGroup>
          </>
        )}
      </AsyncBoundary>
```

to:

```typescript
            </FieldGroup>
            </TabsContent>
            <TabsContent value="view">
              <CurriculumView
                programs={programsQuery.data ?? []}
                curricula={curriculaQuery.data ?? []}
              />
            </TabsContent>
          </Tabs>
        )}
      </AsyncBoundary>
```

Everything between those two markers (the curriculum selector, `FieldGroup`, year
tabs, etc.) is unchanged — only its wrapping tags move from a `<>...</>` fragment
into `<TabsContent value="manage">...</TabsContent>`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/components/portal/curriculum-workspace.test.tsx`
Expected: PASS (all tests in the file — the pre-existing tests never click a tab, so
they exercise the default-mounted Manage tab exactly as before).

- [ ] **Step 6: Run the full frontend test suite**

Run: `cd frontend && npx vitest run`
Expected: PASS. This confirms no other suite (e.g. `module-registry.test.tsx`,
accessibility checks) regressed from the gating or tab changes.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/components/portal/curriculum-workspace.tsx frontend/src/features/components/portal/curriculum-workspace.test.tsx
git commit -m "feat(portal): add a read-only View tab to the Curriculum Editor"
```

---

## Self-Review Notes

- **Spec coverage:** Goal 1 (always-open access) → Task 1. Goal 2 (View tab with
  Program/Year/Semester filters, Code/Description/Units columns) → Tasks 2-3. Goal 3
  (no backend data changes) → no backend file appears anywhere in this plan.
  Non-goals (no majorship dropdown, no archived versions, other modules' gating
  untouched) are honored by construction — Task 1 only ever removes
  `subjects-prerequisites`, and `CurriculumView` filters to `status === "active"`.
- **Type consistency:** `CurriculumView`'s props (`programs: readonly Program[]`,
  `curricula: readonly Curriculum[]`) match exactly what Task 3 passes
  (`programsQuery.data ?? []`, `curriculaQuery.data ?? []`, both already typed as
  `Program[]`/`Curriculum[]` by `useProgramsQuery`/`useCurriculaQuery`).
- **No circular import:** `curriculum-view.tsx` defines its own local `yearLabel`
  rather than importing the one in `curriculum-workspace.tsx`, since Task 3 makes
  `curriculum-workspace.tsx` import `CurriculumView` — importing back would cycle.
