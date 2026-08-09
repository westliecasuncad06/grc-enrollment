# Schedule & Faculty Loading Filter Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make year filtering use the persisted section-plan year and let Program Chairs search faculty assignments by professor name.

**Architecture:** The workspace already fetches term section plans, sections, faculty, and the faculty-load report. Build a plan-ID-to-year lookup from the fetched plans, use it in the table predicate, and add one normalized professor-name query used by both the generated-schedule table and load-report cards. No API or persistence change is needed.

**Tech Stack:** Next.js, React, strict TypeScript, TanStack Query, Vitest, Testing Library, Tailwind CSS, shadcn/ui.

## Global Constraints

- Preserve Program Chair college/term scoping supplied by existing API queries.
- Do not infer year level from section codes.
- Keep assignment results advisory and editable through the existing edit dialog.
- Do not modify unrelated dirty working-tree files.

---

### Task 1: Reproduce and repair the year filter

**Files:**
- Create: `frontend/src/features/components/portal/schedule-faculty-loading-workspace.test.tsx`
- Modify: `frontend/src/features/components/portal/schedule-faculty-loading-workspace.tsx`

**Interfaces:**
- Consumes: `Section.section_plan_id` and `AcademicTermSectionPlan.year_level` from existing section-plan query data.
- Produces: visible schedule rows whose Year filter is based on `plan.year_level`.

- [ ] **Step 1: Write the failing test**

```tsx
it("shows an IT101 row when Year 1 is selected from its linked section plan", async () => {
  renderWorkspace({ sectionCode: "IT101", sectionPlanId: 70, planYearLevel: 1 })
  await userEvent.selectOptions(screen.getByLabelText("Year"), "1")
  expect(await screen.findByText("IT101")).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/components/portal/schedule-faculty-loading-workspace.test.tsx -t "shows an IT101 row"`

Expected: FAIL because the current predicate extracts the year from `section_code` and `IT101` does not start with `1`.

- [ ] **Step 3: Write the minimal implementation**

```tsx
const planYearById = useMemo(
  () => new Map(plans.map((plan) => [plan.id, String(plan.year_level)])),
  [plans],
)

const sectionYear = planYearById.get(section.section_plan_id ?? -1) ?? ""
```

Replace the current regular-expression year extraction in the filter predicate with `sectionYear`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/components/portal/schedule-faculty-loading-workspace.test.tsx -t "shows an IT101 row"`

Expected: PASS.

### Task 2: Add searchable professor assignments

**Files:**
- Modify: `frontend/src/features/components/portal/schedule-faculty-loading-workspace.test.tsx`
- Modify: `frontend/src/features/components/portal/schedule-faculty-loading-workspace.tsx`

**Interfaces:**
- Consumes: `facultyQuery.data` for names and `reportQuery.data.faculty[].assignments` for assigned subject codes and total units.
- Produces: `professorSearch` state that filters the professor selector/table and Faculty Load Report cards case-insensitively.

- [ ] **Step 1: Write the failing test**

```tsx
it("finds a professor by name and shows that professor's assigned subject", async () => {
  renderWorkspace({ professorName: "Prof. Reyes", assignmentCode: "IT101" })
  await userEvent.type(screen.getByLabelText("Find professor"), "reyes")
  expect(await screen.findByText("Prof. Reyes")).toBeInTheDocument()
  expect(screen.getByText("IT101")).toBeInTheDocument()
  expect(screen.queryByText("Prof. Santos")).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/components/portal/schedule-faculty-loading-workspace.test.tsx -t "finds a professor by name"`

Expected: FAIL because no `Find professor` search control or filtered report exists.

- [ ] **Step 3: Write the minimal implementation**

```tsx
const [professorSearch, setProfessorSearch] = useState("")
const normalizedProfessorSearch = professorSearch.trim().toLocaleLowerCase()
const matchesProfessorSearch = (name: string | null | undefined) =>
  !normalizedProfessorSearch || (name ?? "").toLocaleLowerCase().includes(normalizedProfessorSearch)
```

Render an `Input` labeled `Find professor` beside the existing table filters. Apply `matchesProfessorSearch` to the table's professor name and to each Faculty Load Report card; retain the existing select for exact assigned/unassigned filtering.

- [ ] **Step 4: Run focused verification**

Run: `npx vitest run src/features/components/portal/schedule-faculty-loading-workspace.test.tsx`

Expected: PASS with both regression behaviors.

### Task 3: Static verification

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Run code-quality checks**

Run: `npm run lint:fast && npm run build`

Expected: exit code 0; report any pre-existing warning/error separately.

- [ ] **Step 2: Record evidence**

Document the root cause, focused test output, and static-check outcome in `PROGRESS.md` without staging unrelated entries.
