# Rooms Filter Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Program Chairs and Registrar Heads a responsive, accessible Rooms Operations Board with usable search, availability, modality, and day filters.

**Architecture:** The client derives all filter results from the existing room-option and active-term section queries. No Laravel route, persisted state, or room-assignment behavior changes. A local filter state drives summary cards, the room table, the scheduled-use list, and the empty state from one consistent derived data set.

**Tech Stack:** Next.js, React, TypeScript, TanStack Query, Tailwind CSS, shadcn/ui, Vitest, Testing Library.

## Global Constraints

- Keep Program Chair room results college-scoped and Registrar Head results system-wide through the existing room-options endpoint.
- Do not make API calls directly from rendering components.
- Supported selectable modalities are `f2f`, `hyflex_a`, and `hyflex_b`; unset legacy values display only as needs-reassignment context.
- Use accessible labels, keyboard-operable controls, visible result counts, and the existing responsive table container.
- Do not stage unrelated user-owned changes.

---

### Task 1: Add observable Room Board filter coverage

**Files:**
- Create: `frontend/src/features/components/portal/rooms-operations-workspace.test.tsx`
- Modify: `frontend/src/features/components/portal/rooms-operations-workspace.tsx`

**Interfaces:**
- Consumes: existing `useRoomOptionsQuery()`, `useAcademicTermsQuery()`, and `useSectionsQuery()` query data.
- Produces: Room Board controls labelled `Search rooms`, `Availability`, `Modality`, `Schedule day`, and `Clear filters`.

- [ ] **Step 1: Write the failing component tests**

```tsx
it("filters room rows by a case-insensitive room name", async () => {
  render(<RoomsOperationsWorkspace />)
  await userEvent.type(screen.getByLabelText("Search rooms"), "lab")
  expect(screen.getByRole("cell", { name: "LAB 1" })).toBeInTheDocument()
  expect(screen.queryByRole("cell", { name: "3A" })).not.toBeInTheDocument()
})

it("shows only rooms with active-term classes for the Scheduled filter", async () => {
  render(<RoomsOperationsWorkspace />)
  await userEvent.selectOptions(screen.getByLabelText("Availability"), "scheduled")
  expect(screen.getByRole("cell", { name: "LAB 1" })).toBeInTheDocument()
  expect(screen.queryByRole("cell", { name: "3A" })).not.toBeInTheDocument()
})

it("clears all active filters", async () => {
  render(<RoomsOperationsWorkspace />)
  await userEvent.type(screen.getByLabelText("Search rooms"), "lab")
  await userEvent.click(screen.getByRole("button", { name: "Clear filters" }))
  expect(screen.getByRole("cell", { name: "3A" })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm exec vitest run src/features/components/portal/rooms-operations-workspace.test.tsx`

Expected: FAIL because the Room Board does not render labelled filter controls or filter its data.

- [ ] **Step 3: Implement local filter state and derived data**

```tsx
const [filters, setFilters] = useState({ search: "", availability: "all", modality: "all", day: "all" })
const matchingSections = (roomName: string) => scheduledSections.filter(
  (section) =>
    section.room === roomName &&
    (filters.modality === "all" || section.modality === filters.modality) &&
    (filters.day === "all" || section.schedule_days?.includes(filters.day)),
)
const roomRows = roomOptions
  .filter((room) => room.name.toLocaleLowerCase().includes(filters.search.toLocaleLowerCase()))
  .map((room) => ({ room, scheduled: matchingSections(room.name) }))
  .filter(({ scheduled }) => filters.availability === "all" || (filters.availability === "scheduled" ? scheduled.length > 0 : scheduled.length === 0))
```

Render a labelled filter toolbar and derive the cards/table/list from `roomRows`; Clear filters resets all four values to their defaults.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm exec vitest run src/features/components/portal/rooms-operations-workspace.test.tsx`

Expected: PASS with search, availability, modality, day, no-results, and reset behavior covered.

- [ ] **Step 5: Run the fast frontend quality check**

Run: `npm run lint:fast`

Expected: exit code 0; record any baseline warnings separately.

- [ ] **Step 6: Commit only the filter-board feature files**

```bash
git add frontend/src/features/components/portal/rooms-operations-workspace.tsx frontend/src/features/components/portal/rooms-operations-workspace.test.tsx
git commit -m "feat: filter rooms operations board"
git push origin main
```
