# Schedule/Faculty Loading Navigation Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Work directly on the `main` branch — do not create a git worktree for this plan.

**Goal:** Split the single "Schedule & Faculty Loading" Program Chair module into two independent navigation entries — "Schedule" and "Faculty Loading" — and upgrade Faculty Loading's Subject/Professor filters to searchable dropdowns, with a modal-based Faculty Workforce entry point.

**Architecture:** Extract the existing `ScheduleFacultyLoadingWorkspace` component's three tabs into two standalone page components (`ScheduleWorkspace`, `FacultyLoadingWorkspace`), each with its own `useAcademicTermSelection()` term picker. Three small shared pieces (a term-selector hook, a term-selector UI row, and a plain-`Field` label wrapper) factor out duplication between the two new pages. The existing `SearchableCombobox` primitive (already used in four other places) replaces today's Subject text box and Professor `<select>` + text-search pair.

**Tech Stack:** Next.js (client components), React Query (`@tanstack/react-query`), Zod schemas, Vitest + Testing Library, the existing shadcn-style UI kit in `frontend/src/features/components/ui`.

**Spec:** `docs/superpowers/specs/2026-08-27-schedule-faculty-loading-room-scheduler-design.md` (Sub-project 1 section only — Sub-project 2, the Room scheduler, is a separate later plan).

## Global Constraints

- No backend changes in this plan — every data source is an existing hook/service call.
- No new UI primitive — reuse `SearchableCombobox` (`features/components/ui/searchable-combobox.tsx`) exactly as already used in `faculty-subject-preference-form.tsx`.
- Follow this repo's established test convention: mock `fetch` directly with `vi.stubGlobal`/`vi.fn`, render with `renderWithSession` from `@/tests/render-app` — do not introduce MSW or a different mocking approach.
- Do not touch `rooms-operations-workspace.tsx` or any Room-related file — out of scope for this plan.
- Work directly on `main`, no git worktree.

---

## Task 1: `useAcademicTermSelection` hook, shared UI pieces, and `ScheduleWorkspace`

**Files:**
- Create: `frontend/src/features/hooks/use-academic-term-selection.ts`
- Create: `frontend/src/features/components/portal/academic-term-selector.tsx`
- Create: `frontend/src/features/components/portal/workspace-field.tsx`
- Create: `frontend/src/features/components/portal/schedule-workspace.tsx`
- Test: `frontend/src/features/components/portal/schedule-workspace.test.tsx`

**Interfaces:**
- Produces: `useAcademicTermSelection(): { termsQuery: ReturnType<typeof useAcademicTermsQuery>; sortedTerms: readonly AcademicTerm[]; term: AcademicTerm | null; termId: number; isCurrentTerm: boolean; selectedTermId: number | null; setSelectedTermId: (id: number) => void }` — imported by Task 2's `FacultyLoadingWorkspace`.
- Produces: `AcademicTermSelector({ sortedTerms, term, isCurrentTerm, onSelectTerm }): JSX.Element` — imported by Task 2's `FacultyLoadingWorkspace`.
- Produces: `WorkspaceField({ label, children }): JSX.Element` — imported by Task 2's `FacultyLoadingWorkspace`.
- Produces: `ScheduleWorkspace(): JSX.Element` — imported by Task 3's `module-registry.tsx`.
- Consumes: existing `useAcademicTermsQuery`, `useSectionsQuery`, `useSubjectsQuery`, `sectionsQueryKey` from `@/features/hooks/use-reference-data`; `useFacultyDirectoryQuery` from `@/features/hooks/use-faculty-directory`; `useSectionPlansQuery` from `@/features/hooks/use-section-plans`; `getActiveAcademicTerm`, `formatAcademicTerm` from `@/features/services/reference-data-service`; `replaceSection`, `toSectionReplacement` from `@/features/services/scheduling-service`; `isApiClientError` from `@/features/services/api-client`; `type Section` from `@/features/schemas/reference-data-schema`.

- [ ] **Step 1: Create the `useAcademicTermSelection` hook**

This is a direct extraction of the term-selection state already proven working in `schedule-faculty-loading-workspace.tsx` (lines 108–127) — no behavior change, just given its own file so both new pages can share it.

```ts
// frontend/src/features/hooks/use-academic-term-selection.ts
"use client"

import { useMemo, useState } from "react"

import { useAcademicTermsQuery } from "@/features/hooks/use-reference-data"
import { getActiveAcademicTerm } from "@/features/services/reference-data-service"
import type { AcademicTerm } from "@/features/schemas/reference-data-schema"

export function useAcademicTermSelection() {
  const termsQuery = useAcademicTermsQuery()
  const currentTerm = getActiveAcademicTerm(termsQuery.data)
  const sortedTerms = useMemo(
    () =>
      [...(termsQuery.data ?? [])].sort((left, right) => right.id - left.id),
    [termsQuery.data],
  )
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null)
  const term =
    sortedTerms.find((candidate) => candidate.id === selectedTermId) ??
    currentTerm ??
    sortedTerms[0] ??
    null
  const termId = term?.id ?? 0
  const isCurrentTerm =
    term !== null && currentTerm !== null && term.id === currentTerm.id

  return {
    termsQuery,
    sortedTerms,
    term,
    termId,
    isCurrentTerm,
    selectedTermId,
    setSelectedTermId,
  }
}

export type AcademicTermSelection = ReturnType<typeof useAcademicTermSelection>
```

There is no standalone hook-level test in this codebase's convention (`use-reference-data.ts`, `use-faculty-directory.ts`, `use-section-plans.ts` have no sibling `.test.ts`) — this hook's behavior is proven by `schedule-workspace.test.tsx`'s archived-term test in Step 6 below, which fails if the hook is missing or wrong.

- [ ] **Step 2: Create the shared `AcademicTermSelector` row**

Direct extraction of the "School year and semester" row markup (lines 481–512 of the original file) — identical JSX, now parameterized.

```tsx
// frontend/src/features/components/portal/academic-term-selector.tsx
"use client"

import { History } from "lucide-react"

import type { AcademicTerm } from "@/features/schemas/reference-data-schema"
import { formatAcademicTerm } from "@/features/services/reference-data-service"

const termStatusLabels: Record<string, string> = {
  draft: "Draft",
  for_dean_approval: "For Dean Approval",
  semester_ongoing: "Current",
  semester_closed: "Closed",
  archived: "Archived",
}

interface AcademicTermSelectorProps {
  sortedTerms: readonly AcademicTerm[]
  term: AcademicTerm | null
  isCurrentTerm: boolean
  onSelectTerm: (id: number) => void
}

export function AcademicTermSelector({
  sortedTerms,
  term,
  isCurrentTerm,
  onSelectTerm,
}: AcademicTermSelectorProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <History className="size-4 text-primary" aria-hidden="true" />
        <div>
          <p className="font-medium">School year and semester</p>
          <p className="text-sm text-muted-foreground">
            {isCurrentTerm
              ? "Viewing the current term. Assignments are editable."
              : "Viewing an archived schedule — read-only. Switch back to the current term to make changes."}
          </p>
        </div>
      </div>
      <label className="grid gap-1 text-sm font-medium">
        <span className="sr-only">Academic term</span>
        <select
          value={term?.id ?? ""}
          onChange={(event) => onSelectTerm(Number(event.target.value))}
          className="h-9 rounded-md border bg-background px-2"
        >
          {sortedTerms.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {formatAcademicTerm(candidate)}
              {candidate.status !== "semester_ongoing"
                ? ` (${termStatusLabels[candidate.status] ?? candidate.status})`
                : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
```

- [ ] **Step 3: Create the shared `WorkspaceField` label wrapper**

Direct extraction of the local `Field` helper (original file, last function) — renamed to `WorkspaceField` so it never collides with the unrelated `Field` exported by `@/features/components/ui/field` (which Task 2 also imports, for the new combobox filters).

```tsx
// frontend/src/features/components/portal/workspace-field.tsx
import type { ReactNode } from "react"

export function WorkspaceField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      {children}
    </label>
  )
}
```

- [ ] **Step 4: Write the failing test for `ScheduleWorkspace`**

```tsx
// frontend/src/features/components/portal/schedule-workspace.test.tsx
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ScheduleWorkspace } from "@/features/components/portal/schedule-workspace"
import { renderWithSession } from "@/tests/render-app"

const archivedTerm = {
  type: "academic-term",
  id: 2,
  school_year: "2024-2025",
  semester: "1st",
  starts_at: null,
  ends_at: null,
  enrollment_opens_at: null,
  enrollment_closes_at: null,
  add_drop_deadline_at: null,
  grading_deadline_at: null,
  status: "archived",
  status_label: "Archived",
} as const

const terms = {
  data: [
    {
      type: "academic-term",
      id: 1,
      school_year: "2027-2028",
      semester: "2nd",
      starts_at: null,
      ends_at: null,
      enrollment_opens_at: null,
      enrollment_closes_at: null,
      add_drop_deadline_at: null,
      grading_deadline_at: null,
      status: "semester_ongoing",
      status_label: "Semester Ongoing",
    },
    archivedTerm,
  ],
} as const

const subjects = {
  data: [
    {
      type: "subject",
      id: 101,
      code: "IT101",
      title: "Introduction to Computing",
      units: 3,
      status: "active",
      status_label: "Active",
      is_completion_only: false,
    },
    {
      type: "subject",
      id: 201,
      code: "IT201",
      title: "Data Structures",
      units: 3,
      status: "active",
      status_label: "Active",
      is_completion_only: false,
    },
    {
      type: "subject",
      id: 301,
      code: "OLD101",
      title: "Retired Elective",
      units: 3,
      status: "active",
      status_label: "Active",
      is_completion_only: false,
    },
  ],
} as const

const sections = {
  data: [
    {
      type: "section",
      id: 11,
      academic_term_id: 1,
      section_plan_id: 70,
      subject_id: 101,
      section_code: "IT101",
      professor_id: 12,
      schedule_days: "MW",
      starts_at_time: "08:00:00",
      ends_at_time: "10:00:00",
      room: "LAB 1",
      modality: "f2f",
      capacity: 40,
      capacity_source: "plan",
      viability_threshold: null,
      enrolled_count: 0,
      remaining_seats: 40,
      is_block_exclusive: true,
      status: "planned",
      status_label: "Planned",
    },
    {
      type: "section",
      id: 12,
      academic_term_id: 1,
      section_plan_id: 71,
      subject_id: 201,
      section_code: "IT201",
      professor_id: 13,
      schedule_days: "TTh",
      starts_at_time: "10:00:00",
      ends_at_time: "12:00:00",
      room: "LAB 2",
      modality: "hyflex_a",
      capacity: 40,
      capacity_source: "plan",
      viability_threshold: null,
      enrolled_count: 0,
      remaining_seats: 40,
      is_block_exclusive: true,
      status: "planned",
      status_label: "Planned",
    },
    {
      type: "section",
      id: 13,
      academic_term_id: 2,
      section_plan_id: 72,
      subject_id: 301,
      section_code: "OLD101",
      professor_id: 12,
      schedule_days: "F",
      starts_at_time: "13:00:00",
      ends_at_time: "15:00:00",
      room: "LAB 3",
      modality: "f2f",
      capacity: 40,
      capacity_source: "plan",
      viability_threshold: null,
      enrolled_count: 0,
      remaining_seats: 40,
      is_block_exclusive: true,
      status: "planned",
      status_label: "Planned",
    },
  ],
} as const

const plans = {
  data: [
    {
      type: "academic-term-section-plan",
      id: 70,
      academic_term_id: 1,
      curriculum_id: 10,
      college: "ccs",
      year_level: 1,
      section_count: 1,
      students_per_block: 40,
      status: "draft",
      status_label: "Draft",
      submitted_at: null,
    },
    {
      type: "academic-term-section-plan",
      id: 71,
      academic_term_id: 1,
      curriculum_id: 10,
      college: "ccs",
      year_level: 2,
      section_count: 1,
      students_per_block: 40,
      status: "submitted",
      status_label: "Submitted",
      submitted_at: "2026-08-01T00:00:00Z",
    },
    {
      type: "academic-term-section-plan",
      id: 72,
      academic_term_id: 2,
      curriculum_id: 10,
      college: "ccs",
      year_level: 1,
      section_count: 1,
      students_per_block: 40,
      status: "draft",
      status_label: "Draft",
      submitted_at: null,
    },
  ],
} as const

const faculty = {
  data: [
    {
      type: "faculty_member",
      id: 12,
      name: "Prof. Reyes",
      college: "ccs",
      status: "active",
      status_label: "Active",
      employment_type: "full_time",
      employment_type_label: "Full-time",
      planning_unit_reference: 33,
      is_assignable: true,
    },
    {
      type: "faculty_member",
      id: 13,
      name: "Prof. Santos",
      college: "ccs",
      status: "active",
      status_label: "Active",
      employment_type: "part_time",
      employment_type_label: "Part-time",
      planning_unit_reference: null,
      is_assignable: true,
    },
  ],
} as const

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

function renderWorkspace() {
  return renderWithSession(<ScheduleWorkspace />, {
    session: {
      userId: "chair-1",
      displayName: "Program Chair",
      role: "program_chair",
      college: "ccs",
      signedInAt: "2026-08-09T00:00:00Z",
    },
  })
}

describe("ScheduleWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  let sectionSaveError: unknown = null

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    sectionSaveError = null
    fetchMock.mockImplementation((input, init) => {
      const url = requestUrl(input)
      if (
        url.endsWith("/sections/11") &&
        init?.method === "PATCH" &&
        sectionSaveError !== null
      )
        return Promise.resolve(
          new Response(JSON.stringify(sectionSaveError), { status: 422 }),
        )
      const body = url.endsWith("/academic-terms")
        ? terms
        : url.endsWith("/sections")
          ? sections
          : url.endsWith("/subjects")
            ? subjects
            : url.includes("/faculty-members")
              ? faculty
              : url.includes("/academic-term-section-plans")
                ? plans
                : { data: [] }
      return Promise.resolve(new Response(JSON.stringify(body)))
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it("shows the IT101 block only under its linked year tab, not the long flat list", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    expect(
      await screen.findByRole("cell", { name: "IT101" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("cell", { name: "IT201" }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "2nd Year" }))

    expect(
      await screen.findByRole("cell", { name: "IT201" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("cell", { name: "IT101" }),
    ).not.toBeInTheDocument()
  })

  it("keeps a section editable while its plan is submitted and pending Dean/Executive Director review", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(await screen.findByRole("tab", { name: "2nd Year" }))
    await screen.findByRole("cell", { name: "IT201" })

    const editButton = screen.getByRole("button", { name: "Edit" })
    expect(editButton).toBeEnabled()

    await user.click(editButton)
    expect(
      screen.getByRole("dialog", { name: /Edit section assignment/ }),
    ).toBeInTheDocument()
  })

  it("shows the room conflict returned when saving a section assignment", async () => {
    sectionSaveError = {
      error: {
        code: "VALIDATION_FAILED",
        message: "The submitted data is invalid.",
        errors: {
          room: [
            "This room is already physically occupied by another section at the proposed time.",
          ],
        },
        request_id: "test-room-conflict",
      },
    }
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(await screen.findByRole("button", { name: "Edit" }))
    const dialog = screen.getByRole("dialog", {
      name: "Edit section assignment",
    })
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    )

    expect(
      await screen.findByText(
        "This room is already physically occupied by another section at the proposed time.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("The submitted data is invalid."),
    ).not.toBeInTheDocument()
  })

  it("lets the Program Chair switch to an archived term and view its schedule read-only", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await screen.findByRole("cell", { name: "IT101" })
    expect(
      screen.getByText("Viewing the current term. Assignments are editable."),
    ).toBeInTheDocument()

    await user.selectOptions(
      screen.getByLabelText("Academic term"),
      String(archivedTerm.id),
    )

    expect(
      await screen.findByText(/Viewing an archived schedule/),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole("cell", { name: "OLD101" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Archived" })).toBeDisabled()
  })
})
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/components/portal/schedule-workspace.test.tsx`
Expected: FAIL — `Failed to resolve import "@/features/components/portal/schedule-workspace"` (the component doesn't exist yet).

- [ ] **Step 6: Create `ScheduleWorkspace`**

```tsx
// frontend/src/features/components/portal/schedule-workspace.tsx
"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PencilLine } from "lucide-react"
import { useMemo, useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AcademicTermSelector } from "@/features/components/portal/academic-term-selector"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { WorkspaceField } from "@/features/components/portal/workspace-field"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/features/components/ui/dialog"
import { Input } from "@/features/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/features/components/ui/tabs"
import { useFacultyDirectoryQuery } from "@/features/hooks/use-faculty-directory"
import { useAcademicTermSelection } from "@/features/hooks/use-academic-term-selection"
import {
  useSectionsQuery,
  useSubjectsQuery,
  sectionsQueryKey,
} from "@/features/hooks/use-reference-data"
import { useSectionPlansQuery } from "@/features/hooks/use-section-plans"
import {
  replaceSection,
  toSectionReplacement,
} from "@/features/services/scheduling-service"
import { isApiClientError } from "@/features/services/api-client"
import type { Section } from "@/features/schemas/reference-data-schema"

const years = [1, 2, 3, 4] as const

function yearLabel(year: number) {
  return `${year}${year === 1 ? "st" : year === 2 ? "nd" : year === 3 ? "rd" : "th"} Year`
}

const asTime = (value: string) => (value ? `${value}:00`.slice(0, 8) : "")

function sectionSaveErrorMessages(error: unknown): readonly string[] {
  if (isApiClientError(error)) {
    const fieldErrors = Object.values(error.fieldErrors ?? {}).flat()
    if (fieldErrors.length > 0) return fieldErrors
    return [error.message]
  }

  if (error instanceof Error) return [error.message]

  return ["The section assignment could not be saved. Try again."]
}

export function ScheduleWorkspace() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const termSelection = useAcademicTermSelection()
  const { term, termId, sortedTerms, isCurrentTerm, setSelectedTermId } =
    termSelection
  const sectionsQuery = useSectionsQuery()
  const subjectsQuery = useSubjectsQuery()
  const facultyQuery = useFacultyDirectoryQuery()
  const plansQuery = useSectionPlansQuery(termId, term !== null)
  const [activeYear, setActiveYear] = useState("1")
  const [editing, setEditing] = useState<Section | null>(null)
  const [draft, setDraft] = useState({
    professor_id: "",
    schedule_days: "",
    starts_at_time: "",
    ends_at_time: "",
    room: "",
    modality: "f2f",
    capacity: 40,
    override_reason: "",
  })
  const currentSections = (sectionsQuery.data ?? []).filter(
    (section) => section.academic_term_id === termId,
  )
  const planYearById = useMemo(
    () =>
      new Map(
        (plansQuery.data ?? []).map((plan) => [
          plan.id,
          String(plan.year_level),
        ]),
      ),
    [plansQuery.data],
  )
  const subjectMap = useMemo(
    () =>
      new Map(
        (subjectsQuery.data ?? []).map((subject) => [subject.id, subject]),
      ),
    [subjectsQuery.data],
  )
  const facultyMap = useMemo(
    () =>
      new Map(
        (facultyQuery.data ?? []).map((faculty) => [faculty.id, faculty]),
      ),
    [facultyQuery.data],
  )
  const groupedByYear = useMemo(() => {
    const groups = new Map<string, Section[]>()
    currentSections
      .filter(
        (section) =>
          (planYearById.get(section.section_plan_id ?? -1) ?? "") ===
          activeYear,
      )
      .sort(
        (left, right) =>
          left.section_code.localeCompare(right.section_code) ||
          left.id - right.id,
      )
      .forEach((section) =>
        groups.set(section.section_code, [
          ...(groups.get(section.section_code) ?? []),
          section,
        ]),
      )
    return [...groups.entries()].map(([blockCode, sections]) => ({
      blockCode,
      sections,
    }))
  }, [currentSections, activeYear, planYearById])
  const saveSection = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Choose a section to edit.")
      return replaceSection(
        editing.id,
        toSectionReplacement(editing, {
          professor_id: draft.professor_id ? Number(draft.professor_id) : null,
          schedule_days: draft.schedule_days,
          starts_at_time: asTime(draft.starts_at_time),
          ends_at_time: asTime(draft.ends_at_time),
          room: draft.room,
          modality: draft.modality as "hyflex_a" | "hyflex_b" | "f2f",
          capacity: Number(draft.capacity),
          override_reason: draft.override_reason || null,
        }),
      )
    },
    onSuccess: () => {
      setEditing(null)
      void queryClient.invalidateQueries({
        queryKey: sectionsQueryKey(session?.userId ?? null),
        exact: true,
      })
    },
  })
  const open = (section: Section) => {
    setEditing(section)
    setDraft({
      professor_id: section.professor_id ? String(section.professor_id) : "",
      schedule_days: section.schedule_days ?? "",
      starts_at_time: section.starts_at_time?.slice(0, 5) ?? "",
      ends_at_time: section.ends_at_time?.slice(0, 5) ?? "",
      room: section.room ?? "",
      modality: section.modality ?? "f2f",
      capacity: section.capacity,
      override_reason: "",
    })
  }
  const query = {
    isPending:
      termSelection.termsQuery.isPending ||
      sectionsQuery.isPending ||
      subjectsQuery.isPending ||
      facultyQuery.isPending ||
      plansQuery.isPending,
    isError:
      termSelection.termsQuery.isError ||
      sectionsQuery.isError ||
      subjectsQuery.isError ||
      facultyQuery.isError ||
      plansQuery.isError,
    error:
      termSelection.termsQuery.error ??
      sectionsQuery.error ??
      subjectsQuery.error ??
      facultyQuery.error ??
      plansQuery.error,
    data: true as const,
    refetch: () => {
      void termSelection.termsQuery.refetch()
      void sectionsQuery.refetch()
      void subjectsQuery.refetch()
      void facultyQuery.refetch()
      void plansQuery.refetch()
    },
  }

  return (
    <WorkspacePage
      title="Schedule"
      description="Review and edit the generated section schedule and assignments for the selected term."
      lastUpdated={sectionsQuery.dataUpdatedAt}
    >
      <AsyncBoundary query={query} loadingLabel="Loading the generated schedule…">
        {() => (
          <div className="grid gap-5">
            <AcademicTermSelector
              sortedTerms={sortedTerms}
              term={term}
              isCurrentTerm={isCurrentTerm}
              onSelectTerm={setSelectedTermId}
            />

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle level={2}>
                      Generated schedule and assignments
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Faculty matching prioritizes declared subject
                      preference, availability, no conflict, then lower
                      assigned units.
                    </p>
                  </div>
                  <Badge variant="outline">{currentSections.length} rows</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Tabs value={activeYear} onValueChange={setActiveYear}>
                  <TabsList aria-label="Generated section year filter">
                    {years.map((year) => (
                      <TabsTrigger key={year} value={String(year)}>
                        {yearLabel(year)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {years.map((year) => (
                    <TabsContent key={year} value={String(year)} className="mt-3">
                      {groupedByYear.length === 0 ? (
                        <Alert>
                          <AlertDescription>
                            No generated schedule rows for {yearLabel(year)}.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="grid gap-4">
                          {groupedByYear.map(({ blockCode, sections }) => (
                            <Card key={blockCode}>
                              <CardHeader className="border-b bg-muted/30">
                                <CardTitle className="flex flex-wrap items-center gap-2">
                                  {blockCode}
                                  {sections.every(
                                    (section) =>
                                      section.capacity === sections[0].capacity,
                                  ) ? (
                                    <Badge variant="secondary">
                                      {sections[0].capacity} seats
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline">
                                      Mixed seat counts
                                    </Badge>
                                  )}
                                </CardTitle>
                                <CardDescription>
                                  {yearLabel(year)} block section ·{" "}
                                  {sections.length} subject
                                  {sections.length === 1 ? "" : "s"}
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="pt-0">
                                <div className="overflow-x-auto rounded-lg border">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Subject code</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Units</TableHead>
                                        <TableHead>Sched ID</TableHead>
                                        <TableHead>Day</TableHead>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Room</TableHead>
                                        <TableHead>Professor</TableHead>
                                        <TableHead>Modality</TableHead>
                                        <TableHead className="text-right">
                                          Action
                                        </TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {sections.map((section) => {
                                        const subject = subjectMap.get(
                                          section.subject_id,
                                        )
                                        const locked =
                                          section.status === "published"
                                        return (
                                          <TableRow key={section.id}>
                                            <TableCell className="font-medium">
                                              {subject?.code ??
                                                `#${section.subject_id}`}
                                            </TableCell>
                                            <TableCell>
                                              {subject?.title ?? "Subject"}
                                            </TableCell>
                                            <TableCell>
                                              {subject?.units ?? "—"}
                                            </TableCell>
                                            <TableCell>{section.id}</TableCell>
                                            <TableCell>
                                              {section.schedule_days ?? "—"}
                                            </TableCell>
                                            <TableCell>
                                              {section.starts_at_time &&
                                              section.ends_at_time
                                                ? `${section.starts_at_time.slice(0, 5)}–${section.ends_at_time.slice(0, 5)}`
                                                : "—"}
                                            </TableCell>
                                            <TableCell>
                                              {section.room ?? "—"}
                                            </TableCell>
                                            <TableCell>
                                              {section.professor_id ? (
                                                (facultyMap.get(
                                                  section.professor_id,
                                                )?.name ??
                                                `Faculty #${section.professor_id}`)
                                              ) : (
                                                <Badge variant="destructive">
                                                  Unassigned
                                                </Badge>
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              {section.modality
                                                ?.replace("_", " ")
                                                .toUpperCase() ?? "—"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => open(section)}
                                                disabled={
                                                  locked || !isCurrentTerm
                                                }
                                              >
                                                <PencilLine data-icon="inline-start" />
                                                {locked
                                                  ? "Published"
                                                  : !isCurrentTerm
                                                    ? "Archived"
                                                    : "Edit"}
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        )
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
      </AsyncBoundary>
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit section assignment</DialogTitle>
            <DialogDescription>
              Changes to an AI-generated faculty, time, room, or modality need
              an override reason for the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <WorkspaceField label="Professor">
              <select
                value={draft.professor_id}
                onChange={(event) =>
                  setDraft({ ...draft, professor_id: event.target.value })
                }
                className="h-9 rounded-md border bg-background px-2"
              >
                <option value="">Unassigned</option>
                {(facultyQuery.data ?? []).map((faculty) => (
                  <option key={faculty.id} value={String(faculty.id)}>
                    {faculty.name}
                  </option>
                ))}
              </select>
            </WorkspaceField>
            <WorkspaceField label="Schedule days">
              <Input
                value={draft.schedule_days}
                onChange={(event) =>
                  setDraft({ ...draft, schedule_days: event.target.value })
                }
                placeholder="MWF"
              />
            </WorkspaceField>
            <WorkspaceField label="Start time">
              <Input
                type="time"
                value={draft.starts_at_time}
                onChange={(event) =>
                  setDraft({ ...draft, starts_at_time: event.target.value })
                }
              />
            </WorkspaceField>
            <WorkspaceField label="End time">
              <Input
                type="time"
                value={draft.ends_at_time}
                onChange={(event) =>
                  setDraft({ ...draft, ends_at_time: event.target.value })
                }
              />
            </WorkspaceField>
            <WorkspaceField label="Room">
              <Input
                value={draft.room}
                onChange={(event) =>
                  setDraft({ ...draft, room: event.target.value })
                }
              />
            </WorkspaceField>
            <WorkspaceField label="Modality">
              <select
                value={draft.modality}
                onChange={(event) =>
                  setDraft({ ...draft, modality: event.target.value })
                }
                className="h-9 rounded-md border bg-background px-2"
              >
                <option value="f2f">F2F</option>
                <option value="hyflex_a">HyFlex A</option>
                <option value="hyflex_b">HyFlex B</option>
              </select>
            </WorkspaceField>
            <WorkspaceField label="Capacity">
              <Input
                type="number"
                min="1"
                value={draft.capacity}
                onChange={(event) =>
                  setDraft({ ...draft, capacity: Number(event.target.value) })
                }
              />
            </WorkspaceField>
            <WorkspaceField label="Override reason">
              <Input
                value={draft.override_reason}
                onChange={(event) =>
                  setDraft({ ...draft, override_reason: event.target.value })
                }
                placeholder="Required when changing AI output"
              />
            </WorkspaceField>
          </div>
          {saveSection.error !== null && (
            <Alert variant="destructive">
              <AlertDescription>
                {sectionSaveErrorMessages(saveSection.error).map(
                  (message, index) => (
                    <p key={`${message}-${index}`}>{message}</p>
                  ),
                )}
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => saveSection.mutate()}
              disabled={saveSection.isPending}
            >
              {saveSection.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspacePage>
  )
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/components/portal/schedule-workspace.test.tsx`
Expected: PASS — all 4 tests green.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/hooks/use-academic-term-selection.ts \
  frontend/src/features/components/portal/academic-term-selector.tsx \
  frontend/src/features/components/portal/workspace-field.tsx \
  frontend/src/features/components/portal/schedule-workspace.tsx \
  frontend/src/features/components/portal/schedule-workspace.test.tsx
git commit -m "feat(portal): add standalone Schedule workspace page"
```

---

## Task 2: `FacultyLoadingWorkspace`

**Files:**
- Create: `frontend/src/features/components/portal/faculty-loading-workspace.tsx`
- Test: `frontend/src/features/components/portal/faculty-loading-workspace.test.tsx`

**Interfaces:**
- Consumes: `useAcademicTermSelection` from Task 1 (`@/features/hooks/use-academic-term-selection`); `AcademicTermSelector` from Task 1 (`@/features/components/portal/academic-term-selector`); `WorkspaceField` from Task 1 (`@/features/components/portal/workspace-field`); `SearchableCombobox` from `@/features/components/ui/searchable-combobox` (existing, unmodified); `Field`, `FieldGroup`, `FieldLabel` from `@/features/components/ui/field` (existing, unmodified); `useSubjectsQuery` from `@/features/hooks/use-reference-data`; `useFacultyDirectoryQuery` from `@/features/hooks/use-faculty-directory`; `getFacultyLoadReport`, `saveFacultyLoadThreshold` from `@/features/services/schedule-generation-service`; `updateFacultyWorkforceProfile` from `@/features/services/faculty-directory-service`; `type FacultyMember` from `@/features/schemas/scheduling-schema`.
- Produces: `FacultyLoadingWorkspace(): JSX.Element` — imported by Task 3's `module-registry.tsx`.

- [ ] **Step 1: Write the failing test for `FacultyLoadingWorkspace`**

```tsx
// frontend/src/features/components/portal/faculty-loading-workspace.test.tsx
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { FacultyLoadingWorkspace } from "@/features/components/portal/faculty-loading-workspace"
import { renderWithSession } from "@/tests/render-app"

const terms = {
  data: [
    {
      type: "academic-term",
      id: 1,
      school_year: "2027-2028",
      semester: "2nd",
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
} as const

const subjects = {
  data: [
    {
      type: "subject",
      id: 101,
      code: "IT101",
      title: "Introduction to Computing",
      units: 3,
      status: "active",
      status_label: "Active",
      is_completion_only: false,
    },
    {
      type: "subject",
      id: 201,
      code: "IT201",
      title: "Data Structures",
      units: 3,
      status: "active",
      status_label: "Active",
      is_completion_only: false,
    },
  ],
} as const

const faculty = {
  data: [
    {
      type: "faculty_member",
      id: 12,
      name: "Prof. Reyes",
      college: "ccs",
      status: "active",
      status_label: "Active",
      employment_type: "full_time",
      employment_type_label: "Full-time",
      planning_unit_reference: 33,
      is_assignable: true,
    },
    {
      type: "faculty_member",
      id: 13,
      name: "Prof. Santos",
      college: "ccs",
      status: "active",
      status_label: "Active",
      employment_type: "part_time",
      employment_type_label: "Part-time",
      planning_unit_reference: null,
      is_assignable: true,
    },
  ],
} as const

const facultyIncludingInactive = {
  data: [
    ...faculty.data,
    {
      type: "faculty_member",
      id: 14,
      name: "Marian S. Villanueva",
      college: "ccs",
      status: "disabled",
      status_label: "Inactive",
      employment_type: "part_time",
      employment_type_label: "Part-time",
      planning_unit_reference: null,
      is_assignable: false,
    },
  ],
} as const

const facultyLoadReport = {
  data: {
    academic_term_id: 1,
    college: "ccs",
    threshold_units: 18,
    required_teaching_units: 6,
    required_assignments: 2,
    equivalent_faculty_loads: 1,
    assigned_count: 2,
    unassigned_count: 0,
    overloaded_count: 0,
    faculty: [
      {
        professor_id: 12,
        professor_name: "Prof. Reyes",
        total_units: 3,
        overloaded: false,
        assignments: [
          {
            section_id: 11,
            section_code: "IT101",
            subject_id: 101,
            subject_code: "IT101",
            subject_title: "Introduction to Computing",
            units: 3,
            professor_id: 12,
            professor_name: "Prof. Reyes",
            recommended_professor_id: 12,
            rationale: ["Ranked preference"],
            override_reason: null,
            schedule_days: "MW",
            starts_at_time: "08:00:00",
            ends_at_time: "10:00:00",
            room: "LAB 1",
            modality: "f2f",
          },
        ],
      },
      {
        professor_id: 13,
        professor_name: "Prof. Santos",
        total_units: 3,
        overloaded: false,
        assignments: [
          {
            section_id: 12,
            section_code: "IT201",
            subject_id: 201,
            subject_code: "IT201",
            subject_title: "Data Structures",
            units: 3,
            professor_id: 13,
            professor_name: "Prof. Santos",
            recommended_professor_id: 13,
            rationale: ["Ranked preference"],
            override_reason: null,
            schedule_days: "TTh",
            starts_at_time: "10:00:00",
            ends_at_time: "12:00:00",
            room: "LAB 2",
            modality: "hyflex_a",
          },
        ],
      },
    ],
    unassigned: [],
  },
} as const

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

function renderWorkspace() {
  return renderWithSession(<FacultyLoadingWorkspace />, {
    session: {
      userId: "chair-1",
      displayName: "Program Chair",
      role: "program_chair",
      college: "ccs",
      signedInAt: "2026-08-09T00:00:00Z",
    },
  })
}

describe("FacultyLoadingWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      const body = url.endsWith("/academic-terms")
        ? terms
        : url.endsWith("/subjects")
          ? subjects
          : url.includes("/faculty-members")
            ? url.includes("include_inactive=1")
              ? facultyIncludingInactive
              : faculty
            : url.endsWith("/faculty-load-report")
              ? facultyLoadReport
              : { data: [] }
      return Promise.resolve(new Response(JSON.stringify(body)))
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it("narrows the Faculty Load Report to a professor selected from the searchable dropdown", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(await screen.findByLabelText("Professor"))
    await user.click(await screen.findByText("Prof. Reyes"))

    expect(
      await screen.findByText("Assigned subjects: IT101"),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Assigned subjects: IT201"),
    ).not.toBeInTheDocument()
  })

  it("narrows the Faculty Load Report to a subject selected from the searchable dropdown", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(await screen.findByLabelText("Subject"))
    await user.click(await screen.findByText("IT201 — Data Structures"))

    expect(
      await screen.findByText("Assigned subjects: IT201"),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Assigned subjects: IT101"),
    ).not.toBeInTheDocument()
  })

  it("opens the Faculty Workforce table in a modal and edits a profile from within it", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await screen.findByText("Faculty load threshold")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await user.click(
      await screen.findByRole("button", { name: "Faculty Workforce" }),
    )

    const workforceDialog = screen.getByRole("dialog", {
      name: "Faculty workforce",
    })
    expect(
      await within(workforceDialog).findByText("Marian S. Villanueva"),
    ).toBeInTheDocument()

    await user.click(
      within(workforceDialog).getByRole("button", {
        name: "Edit workforce profile for Marian S. Villanueva",
      }),
    )

    const editDialog = screen.getByRole("dialog", {
      name: "Update faculty workforce profile",
    })
    expect(editDialog).toHaveTextContent("Employment type")
    expect(screen.getByLabelText("Account status")).toHaveValue("disabled")
    expect(screen.getByLabelText("Employment type")).toHaveValue("part_time")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/components/portal/faculty-loading-workspace.test.tsx`
Expected: FAIL — `Failed to resolve import "@/features/components/portal/faculty-loading-workspace"`.

- [ ] **Step 3: Create `FacultyLoadingWorkspace`**

```tsx
// frontend/src/features/components/portal/faculty-loading-workspace.tsx
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PencilLine, SlidersHorizontal, Users } from "lucide-react"
import { useMemo, useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AcademicTermSelector } from "@/features/components/portal/academic-term-selector"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { WorkspaceField } from "@/features/components/portal/workspace-field"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/features/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
import { SearchableCombobox } from "@/features/components/ui/searchable-combobox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
import { useFacultyDirectoryQuery } from "@/features/hooks/use-faculty-directory"
import { useAcademicTermSelection } from "@/features/hooks/use-academic-term-selection"
import { useSubjectsQuery } from "@/features/hooks/use-reference-data"
import {
  getFacultyLoadReport,
  saveFacultyLoadThreshold,
} from "@/features/services/schedule-generation-service"
import { updateFacultyWorkforceProfile } from "@/features/services/faculty-directory-service"
import type { FacultyMember } from "@/features/schemas/scheduling-schema"

export function FacultyLoadingWorkspace() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const termSelection = useAcademicTermSelection()
  const { term, termId, sortedTerms, isCurrentTerm, setSelectedTermId } =
    termSelection
  const subjectsQuery = useSubjectsQuery()
  const facultyQuery = useFacultyDirectoryQuery()
  const workforceQuery = useFacultyDirectoryQuery(true)
  const reportQuery = useQuery({
    queryKey: ["faculty-load-report", session?.userId ?? null, termId],
    queryFn: () => getFacultyLoadReport(termId),
    enabled: termId > 0,
  })
  const [threshold, setThreshold] = useState("")
  const [filter, setFilter] = useState({ subjectId: "", professorId: "" })
  const [workforceOpen, setWorkforceOpen] = useState(false)
  const [workforceEditing, setWorkforceEditing] =
    useState<FacultyMember | null>(null)
  const [workforceDraft, setWorkforceDraft] = useState({
    status: "active" as "active" | "disabled",
    employment_type: "part_time" as "full_time" | "part_time",
    reason: "",
  })
  const subjectOptions = useMemo(
    () => [
      { value: "", label: "All subjects" },
      ...(subjectsQuery.data ?? []).map((subject) => ({
        value: String(subject.id),
        label: `${subject.code} — ${subject.title}`,
      })),
    ],
    [subjectsQuery.data],
  )
  const professorOptions = useMemo(
    () => [
      { value: "", label: "All professors" },
      ...(facultyQuery.data ?? []).map((member) => ({
        value: String(member.id),
        label: member.name,
      })),
    ],
    [facultyQuery.data],
  )
  const visibleFaculty = useMemo(
    () =>
      (reportQuery.data?.faculty ?? []).filter(
        (member) =>
          (filter.professorId === "" ||
            String(member.professor_id) === filter.professorId) &&
          (filter.subjectId === "" ||
            member.assignments.some(
              (assignment) =>
                String(assignment.subject_id) === filter.subjectId,
            )),
      ),
    [reportQuery.data?.faculty, filter],
  )
  const visibleWorkforce = useMemo(
    () =>
      (workforceQuery.data ?? []).filter(
        (member) =>
          filter.professorId === "" ||
          String(member.id) === filter.professorId,
      ),
    [workforceQuery.data, filter],
  )
  const saveThreshold = useMutation({
    mutationFn: () => saveFacultyLoadThreshold(termId, Number(threshold)),
    onSuccess: () => {
      setThreshold("")
      void reportQuery.refetch()
    },
  })
  const saveWorkforceProfile = useMutation({
    mutationFn: async () => {
      if (!workforceEditing) throw new Error("Choose a faculty member to edit.")
      return updateFacultyWorkforceProfile(workforceEditing.id, {
        status: workforceDraft.status,
        employment_type: workforceDraft.employment_type,
        reason: workforceDraft.reason || undefined,
      })
    },
    onSuccess: () => {
      setWorkforceEditing(null)
      void queryClient.invalidateQueries({
        queryKey: ["faculty-directory", session?.userId ?? null],
      })
      void reportQuery.refetch()
    },
  })
  const openWorkforceProfile = (member: FacultyMember) => {
    setWorkforceEditing(member)
    setWorkforceDraft({
      status: member.status,
      employment_type: member.employment_type ?? "part_time",
      reason: "",
    })
  }
  const query = {
    isPending:
      termSelection.termsQuery.isPending ||
      subjectsQuery.isPending ||
      facultyQuery.isPending ||
      workforceQuery.isPending ||
      reportQuery.isPending,
    isError:
      termSelection.termsQuery.isError ||
      subjectsQuery.isError ||
      facultyQuery.isError ||
      workforceQuery.isError ||
      reportQuery.isError,
    error:
      termSelection.termsQuery.error ??
      subjectsQuery.error ??
      facultyQuery.error ??
      workforceQuery.error ??
      reportQuery.error,
    data: true as const,
    refetch: () => {
      void termSelection.termsQuery.refetch()
      void subjectsQuery.refetch()
      void facultyQuery.refetch()
      void workforceQuery.refetch()
      void reportQuery.refetch()
    },
  }

  return (
    <WorkspacePage
      title="Faculty Loading"
      description="Set the faculty load threshold, review the load report, and manage the faculty workforce."
      lastUpdated={reportQuery.dataUpdatedAt}
    >
      <AsyncBoundary query={query} loadingLabel="Loading faculty load data…">
        {() => (
          <div className="grid gap-5">
            <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card">
              <CardHeader className="border-b bg-background/60">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="grid gap-1">
                    <div className="flex items-center gap-2 text-primary">
                      <SlidersHorizontal className="size-4" />
                      <span className="text-xs font-semibold tracking-[0.15em] uppercase">
                        Planning control room
                      </span>
                    </div>
                    <CardTitle level={2}>Faculty load threshold</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Set one maximum teaching-unit threshold for this college
                      and term. Assignment recommendations remain editable.
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {term
                      ? `${term.school_year} · ${term.semester}`
                      : "No term"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3 pt-5">
                <label
                  className="grid gap-2 text-sm font-medium"
                  htmlFor="faculty-load-threshold"
                >
                  Maximum units
                  <Input
                    id="faculty-load-threshold"
                    type="number"
                    min="1"
                    value={
                      threshold === ""
                        ? (reportQuery.data?.threshold_units ?? "")
                        : threshold
                    }
                    onChange={(event) => setThreshold(event.target.value)}
                    placeholder="e.g. 18"
                  />
                </label>
                <Button
                  type="button"
                  onClick={() => void saveThreshold.mutateAsync()}
                  disabled={
                    !threshold || saveThreshold.isPending || !isCurrentTerm
                  }
                >
                  {saveThreshold.isPending
                    ? "Saving threshold…"
                    : "Save threshold"}
                </Button>
                {reportQuery.data?.threshold_units === null && (
                  <p className="text-sm text-muted-foreground">
                    Overload flags remain off until a threshold is configured.
                  </p>
                )}
              </CardContent>
            </Card>

            <AcademicTermSelector
              sortedTerms={sortedTerms}
              term={term}
              isCurrentTerm={isCurrentTerm}
              onSelectTerm={setSelectedTermId}
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Teaching assignments"
                value={reportQuery.data?.required_assignments ?? 0}
                detail="Generated section-subject rows"
              />
              <Metric
                label="Required units"
                value={reportQuery.data?.required_teaching_units ?? 0}
                detail="Across current draft"
              />
              <Metric
                label="Equivalent faculty loads"
                value={reportQuery.data?.equivalent_faculty_loads ?? "—"}
                detail="Uses configured threshold"
              />
              <Metric
                label="Flags to review"
                value={
                  (reportQuery.data?.unassigned_count ?? 0) +
                  (reportQuery.data?.overloaded_count ?? 0)
                }
                detail="Unassigned or overload"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle level={2}>Filters</CardTitle>
                <CardDescription>
                  Narrows the Faculty Load Report below to a subject, a
                  professor, or both.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="grid gap-3 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="faculty-loading-subject-filter">
                      Subject
                    </FieldLabel>
                    <SearchableCombobox
                      id="faculty-loading-subject-filter"
                      label="Subject"
                      options={subjectOptions}
                      value={filter.subjectId}
                      onValueChange={(value) =>
                        setFilter({ ...filter, subjectId: value })
                      }
                      placeholder="Search code or title"
                      emptyMessage="No matching subject."
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="faculty-loading-professor-filter">
                      Professor
                    </FieldLabel>
                    <SearchableCombobox
                      id="faculty-loading-professor-filter"
                      label="Professor"
                      options={professorOptions}
                      value={filter.professorId}
                      onValueChange={(value) =>
                        setFilter({ ...filter, professorId: value })
                      }
                      placeholder="Search name"
                      emptyMessage="No matching professor."
                    />
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle level={2}>Faculty Load Report</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Assignment rationale is retained even when the Program
                      Chair makes an override.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {visibleFaculty.length} professors
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setWorkforceOpen(true)}
                    >
                      <Users data-icon="inline-start" aria-hidden="true" />
                      Faculty Workforce
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                {visibleFaculty.length ? (
                  visibleFaculty.map((member) => (
                    <div
                      key={member.professor_id}
                      className="rounded-lg border p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {member.professor_name ??
                              `Faculty #${member.professor_id}`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Assigned subjects:{" "}
                            {member.assignments
                              .map((assignment) => assignment.subject_code)
                              .join(", ")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              member.overloaded ? "destructive" : "secondary"
                            }
                          >
                            {member.total_units} units
                          </Badge>
                          <Badge variant="outline">
                            {member.assignments.length} assignments
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {member.assignments
                          .flatMap((assignment) => assignment.rationale)
                          .filter(
                            (value, index, values) =>
                              values.indexOf(value) === index,
                          )
                          .map((reason) => (
                            <Badge key={reason} variant="outline">
                              {reason.replaceAll("_", " ")}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  ))
                ) : reportQuery.data?.faculty.length ? (
                  <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                    No professor matches the current filters.
                  </p>
                ) : (
                  <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                    Generate a schedule to see the load report.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </AsyncBoundary>

      <Dialog open={workforceOpen} onOpenChange={setWorkforceOpen}>
        <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Faculty workforce</DialogTitle>
            <DialogDescription>
              Manage the local planning status and employment type for
              faculty in your college. Inactive faculty cannot be recommended
              or assigned.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end">
            <Badge variant="outline">{visibleWorkforce.length} faculty</Badge>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Faculty member</TableHead>
                  <TableHead>Account status</TableHead>
                  <TableHead>Employment type</TableHead>
                  <TableHead>Planning reference</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleWorkforce.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          member.is_assignable ? "secondary" : "destructive"
                        }
                      >
                        {member.status_label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.employment_type_label ?? "Unspecified"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.planning_unit_reference
                        ? `${member.planning_unit_reference}-unit reference`
                        : "No fixed reference"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-label={`Edit workforce profile for ${member.name}`}
                        onClick={() => openWorkforceProfile(member)}
                      >
                        <PencilLine data-icon="inline-start" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {visibleWorkforce.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-9 text-center text-muted-foreground"
                    >
                      No faculty match the current professor filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={workforceEditing !== null}
        onOpenChange={(open) => !open && setWorkforceEditing(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Update faculty workforce profile</DialogTitle>
            <DialogDescription>
              {workforceEditing?.name ?? "Faculty member"} will be available
              for future schedule recommendations only while their account is
              active. Marking an active account inactive requires an audit
              reason.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <WorkspaceField label="Account status">
              <select
                value={workforceDraft.status}
                onChange={(event) =>
                  setWorkforceDraft({
                    ...workforceDraft,
                    status: event.target.value as "active" | "disabled",
                  })
                }
                className="h-9 rounded-md border bg-background px-2"
              >
                <option value="active">Active</option>
                <option value="disabled">Inactive</option>
              </select>
            </WorkspaceField>
            <WorkspaceField label="Employment type">
              <select
                value={workforceDraft.employment_type}
                onChange={(event) =>
                  setWorkforceDraft({
                    ...workforceDraft,
                    employment_type: event.target.value as
                      "full_time" | "part_time",
                  })
                }
                className="h-9 rounded-md border bg-background px-2"
              >
                <option value="full_time">Full-time (33-unit reference)</option>
                <option value="part_time">Part-time</option>
              </select>
            </WorkspaceField>
            <WorkspaceField
              label={
                workforceEditing?.status === "active" &&
                workforceDraft.status === "disabled"
                  ? "Reason for making this account inactive"
                  : "Change note (optional)"
              }
            >
              <Input
                value={workforceDraft.reason}
                onChange={(event) =>
                  setWorkforceDraft({
                    ...workforceDraft,
                    reason: event.target.value,
                  })
                }
                placeholder="Record the reason for this change"
              />
            </WorkspaceField>
          </div>
          {saveWorkforceProfile.error instanceof Error && (
            <p className="text-sm text-destructive">
              {saveWorkforceProfile.error.message}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setWorkforceEditing(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveWorkforceProfile.mutateAsync()}
              disabled={
                saveWorkforceProfile.isPending ||
                (workforceEditing?.status === "active" &&
                  workforceDraft.status === "disabled" &&
                  !workforceDraft.reason.trim())
              }
            >
              {saveWorkforceProfile.isPending
                ? "Saving…"
                : "Save workforce profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspacePage>
  )
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string
  value: string | number
  detail: string
}) {
  return (
    <Card>
      <CardContent className="grid gap-1 p-4">
        <span className="text-xs font-semibold tracking-wide text-primary uppercase">
          {label}
        </span>
        <strong className="font-heading text-2xl">{value}</strong>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/components/portal/faculty-loading-workspace.test.tsx`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/components/portal/faculty-loading-workspace.tsx \
  frontend/src/features/components/portal/faculty-loading-workspace.test.tsx
git commit -m "feat(portal): add standalone Faculty Loading workspace page with searchable filters"
```

---

## Task 3: Wire up navigation, update registry tests, remove the old combined workspace

**Files:**
- Modify: `frontend/src/features/portal/module-registry.tsx`
- Modify: `frontend/src/features/portal/module-registry.test.tsx`
- Modify: `frontend/src/features/portal/role-capabilities.ts`
- Modify: `frontend/src/features/portal/role-capabilities.test.ts`
- Delete: `frontend/src/features/components/portal/schedule-faculty-loading-workspace.tsx`
- Delete: `frontend/src/features/components/portal/schedule-faculty-loading-workspace.test.tsx`

**Interfaces:**
- Consumes: `ScheduleWorkspace` from Task 1, `FacultyLoadingWorkspace` from Task 2.

- [ ] **Step 1: Update `module-registry.tsx`'s import**

In `frontend/src/features/portal/module-registry.tsx`, replace:

```tsx
import { ScheduleFacultyLoadingWorkspace } from "@/features/components/portal/schedule-faculty-loading-workspace"
```

with:

```tsx
import { ScheduleWorkspace } from "@/features/components/portal/schedule-workspace"
import { FacultyLoadingWorkspace } from "@/features/components/portal/faculty-loading-workspace"
```

- [ ] **Step 2: Update the `ConnectedModuleId` type**

In the same file, in the `ConnectedModuleId` union type, replace the line:

```tsx
  | "schedule-faculty-loading"
```

with:

```tsx
  | "schedule"
  | "faculty-loading"
```

- [ ] **Step 3: Update the `connectedModuleIds` array**

In the same file, in the `connectedModuleIds` array, replace the line:

```tsx
  "schedule-faculty-loading",
```

with:

```tsx
  "schedule",
  "faculty-loading",
```

- [ ] **Step 4: Update the module component constants**

In the same file, replace:

```tsx
const scheduleFacultyLoadingWorkspace: PortalModuleComponent = () => (
  <ScheduleFacultyLoadingWorkspace />
)
```

with:

```tsx
const scheduleWorkspace: PortalModuleComponent = () => <ScheduleWorkspace />
const facultyLoadingWorkspace: PortalModuleComponent = () => (
  <FacultyLoadingWorkspace />
)
```

- [ ] **Step 5: Update the `connectedModuleRegistry` map**

In the same file, replace the line:

```tsx
  "schedule-faculty-loading": scheduleFacultyLoadingWorkspace,
```

with:

```tsx
  schedule: scheduleWorkspace,
  "faculty-loading": facultyLoadingWorkspace,
```

- [ ] **Step 6: Update `role-capabilities.ts`'s Program Chair modules**

In `frontend/src/features/portal/role-capabilities.ts`, inside `program_chair.modules`, replace:

```tsx
      portalModule(
        "schedule-faculty-loading",
        "Schedule & Faculty Loading",
        "Review editable section schedules, faculty loads, conflicts, and advisory recommendations.",
        CalendarDays,
      ),
```

with:

```tsx
      portalModule(
        "schedule",
        "Schedule",
        "Review and edit the generated section schedule and assignments for the selected term.",
        CalendarDays,
      ),
      portalModule(
        "faculty-loading",
        "Faculty Loading",
        "Set the faculty load threshold, review the load report, and manage the faculty workforce.",
        Gauge,
      ),
```

`Gauge` is already imported at the top of this file (used elsewhere for other roles' modules) — no new import needed.

- [ ] **Step 7: Update `role-capabilities.test.ts`'s expected module list**

In `frontend/src/features/portal/role-capabilities.test.ts`, inside `expectedModuleIds.program_chair`, replace:

```ts
    "schedule-faculty-loading",
```

with:

```ts
    "schedule",
    "faculty-loading",
```

- [ ] **Step 8: Update `module-registry.test.tsx`'s expected region names**

In `frontend/src/features/portal/module-registry.test.tsx`, inside `migratedRegionNames`, replace:

```ts
  "schedule-faculty-loading": "Schedule & Faculty Loading",
```

with:

```ts
  schedule: "Schedule",
  "faculty-loading": "Faculty Loading",
```

- [ ] **Step 9: Delete the old combined workspace and its test**

```bash
git rm frontend/src/features/components/portal/schedule-faculty-loading-workspace.tsx \
  frontend/src/features/components/portal/schedule-faculty-loading-workspace.test.tsx
```

- [ ] **Step 10: Run the full affected test set to verify everything is green**

Run:
```bash
cd frontend && npx vitest run \
  src/features/portal/module-registry.test.tsx \
  src/features/portal/role-capabilities.test.ts \
  src/features/components/portal/schedule-workspace.test.tsx \
  src/features/components/portal/faculty-loading-workspace.test.tsx
```
Expected: PASS — every test in all four files green, and no reference to `schedule-faculty-loading-workspace` remains anywhere (confirm with `grep -r "schedule-faculty-loading-workspace" frontend/src` returning nothing).

- [ ] **Step 11: Run the frontend type check, fast lint, and full test suite**

Run: `cd frontend && npm run typecheck && npm run lint:fast && npx vitest run`
Expected: PASS — no type errors, no lint errors, no failing tests anywhere in the frontend suite.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/features/portal/module-registry.tsx \
  frontend/src/features/portal/module-registry.test.tsx \
  frontend/src/features/portal/role-capabilities.ts \
  frontend/src/features/portal/role-capabilities.test.ts
git commit -m "feat(portal): split Schedule & Faculty Loading into two nav entries"
```
