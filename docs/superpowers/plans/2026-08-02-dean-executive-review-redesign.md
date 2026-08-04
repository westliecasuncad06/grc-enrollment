# Dean and Executive Enrollment Review Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the oversized reviewer schedule table with a viewport-safe, section-tabbed review dialog and a clearer Executive review/published workspace.

**Architecture:** Keep proposal fetching and lifecycle mutations in `ScheduleDecisionControls`, but move schedule-detail presentation into a focused `ScheduleReviewDialog` that loads rows on demand and groups them by block section. Recompose the Executive workspace with shadcn Tabs so pending decisions appear before published schedules without changing services, schemas, API endpoints, authorization, or lifecycle states.

**Tech Stack:** Next.js 16, React, strict TypeScript, TanStack Query, Tailwind CSS v4, shadcn/ui (Radix Nova), Vitest, Testing Library, vitest-axe.

## Global Constraints

- Frontend presentation and review interaction only; no backend or database changes.
- Preserve `/api/v1`, bearer authentication, Policies, and the existing schedule lifecycle.
- Use existing semantic theme tokens and shadcn/ui composition; do not add raw color utilities.
- The dialog is capped at `90dvh`; only its body scrolls.
- Section tabs are keyboard accessible, horizontally scrollable, and show one active block at a time.
- Subject cards use two columns on large screens and one column on small screens.
- Missing details render as `Not assigned`.
- Work at 320 CSS pixels without horizontal page overflow.
- Do not edit schedules from reviewer portals.
- Do not commit because the user has not authorized a commit.

## File structure

- Create `frontend/src/features/components/portal/schedule-review-dialog.tsx`: on-demand detail query, proposal summary, section grouping/tabs, subject cards, and sticky decision footer.
- Create `frontend/src/features/components/portal/schedule-review-dialog.test.tsx`: grouping, tab switching, counts, missing data, action labels, viewport structure, and accessibility.
- Modify `frontend/src/features/components/portal/schedule-decision-workspace.tsx`: queue orchestration, open/close state, action copy, and delegation to the new dialog.
- Modify `frontend/src/features/components/portal/schedule-decision-workspace.test.tsx`: reviewer queue and confirmation behavior with the new dialog.
- Modify `frontend/src/features/components/portal/master-schedule-workspace.tsx`: Executive `For review` / `Published` tabs.
- Modify `frontend/src/features/components/portal/master-schedule-workspace.test.tsx`: default review tab, published tab, and lifecycle actions.
- Modify `PROGRESS.md`: milestone and verification evidence.

---

### Task 1: Build the section-tabbed schedule review dialog

**Files:**
- Create: `frontend/src/features/components/portal/schedule-review-dialog.tsx`
- Create: `frontend/src/features/components/portal/schedule-review-dialog.test.tsx`

**Interfaces:**
- Consumes: `ScheduleProposal`, `ScheduleAction`, `availableScheduleActions`, and `useScheduleReviewSectionsQuery(proposalId)`.
- Produces:

```ts
type ScheduleReviewDialogProps = {
  actorRole: "dean" | "executive_director"
  proposal: ScheduleProposal | null
  decisionPending: boolean
  onOpenChange: (open: boolean) => void
  onDecision: (proposal: ScheduleProposal, action: ScheduleAction) => void
}

export function ScheduleReviewDialog(props: ScheduleReviewDialogProps): React.JSX.Element
```

- [x] **Step 1: Add failing dialog tests**

Create fixtures containing two `IT101` rows and one `IT201` row. Assert the dialog initially shows `IT101`, summary text `2 block sections` and `3 subject schedules`, hides the `IT201` subject until its tab is selected, renders missing fields as `Not assigned`, exposes the correct Dean/Executive footer labels, and has a dialog-content descendant with `max-h-[90dvh]` and `overflow-hidden`.

```tsx
expect(await screen.findByText("2 block sections")).toBeInTheDocument()
expect(screen.getByText("3 subject schedules")).toBeInTheDocument()
expect(screen.getByText("Programming 1")).toBeInTheDocument()
expect(screen.queryByText("Data Structures")).not.toBeInTheDocument()
await user.click(screen.getByRole("tab", { name: "IT201" }))
expect(screen.getByText("Data Structures")).toBeInTheDocument()
expect(screen.getAllByText("Not assigned")).not.toHaveLength(0)
```

- [x] **Step 2: Run the dialog test and confirm RED**

Run:

```powershell
npm test -- --run src/features/components/portal/schedule-review-dialog.test.tsx
```

Expected: FAIL because `ScheduleReviewDialog` does not exist.

- [x] **Step 3: Check shadcn project context and component documentation**

Run from `frontend/`:

```powershell
npx shadcn@latest info --json
npx shadcn@latest docs dialog tabs card badge button empty skeleton separator
```

Use the existing installed primitives. Do not overwrite shared component files.

- [x] **Step 4: Implement deterministic grouping and natural section ordering**

Inside the new component, derive groups with `useMemo` and `Intl.Collator`:

```ts
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })
const groupedSections = useMemo(() => {
  const groups = new Map<string, ScheduleReviewSection[]>()
  for (const section of sectionsQuery.data ?? [])
    groups.set(section.section_code, [...(groups.get(section.section_code) ?? []), section])
  return [...groups.entries()]
    .sort(([left], [right]) => collator.compare(left, right))
    .map(([sectionCode, subjects]) => ({ sectionCode, subjects }))
}, [sectionsQuery.data])
```

When `proposal?.id` changes, reset `activeSection` to the first loaded group. Do not reset it during ordinary refetches of the same proposal.

- [x] **Step 5: Implement the viewport-safe dialog shell**

Compose `Dialog`, `DialogHeader`, `Badge`, `Tabs`, `Card`, `Skeleton`, `Empty`, `Separator`, and `DialogFooter`. Use this shell contract:

```tsx
<DialogContent className="grid max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0 sm:max-w-5xl">
  <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6">...</DialogHeader>
  <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">...</div>
  <DialogFooter className="px-4 pb-4 sm:px-6 sm:pb-6">...</DialogFooter>
</DialogContent>
```

The dialog header displays proposal identity immediately. After rows load, show section/subject counts as badges. The body uses a horizontally scrollable `TabsList` and renders only the active section's cards.

- [x] **Step 6: Implement compact subject cards and missing-data copy**

Each `ScheduleSubjectCard` uses full Card composition. Render subject code/title in the header and a compact definition grid in content:

```tsx
<dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
  <div><dt className="text-muted-foreground">Professor</dt><dd>{valueOrNotAssigned(section.professor_name)}</dd></div>
  <div><dt className="text-muted-foreground">Units</dt><dd>{section.units}</dd></div>
  <div><dt className="text-muted-foreground">Schedule</dt><dd>{formatMeeting(section)}</dd></div>
  <div><dt className="text-muted-foreground">Room</dt><dd>{valueOrNotAssigned(section.room)}</dd></div>
</dl>
```

Use a Badge for modality. `formatMeeting` returns `Not assigned` unless day, start, and end are all present.

- [x] **Step 7: Add the role-specific sticky footer actions**

Use `availableScheduleActions(actorRole, proposal)` and map labels exactly:

```ts
const reviewActionLabels: Partial<Record<ScheduleAction, string>> = {
  dean_approve: "Approve schedule",
  dean_return: "Return with notes",
  executive_approve: "Final approve",
  executive_return: "Return with notes",
  publish: "Publish schedule",
}
```

Return actions use `variant="outline"`; approval/publication use the default variant. Disable actions while `decisionPending`.

- [x] **Step 8: Run dialog tests and accessibility scan**

Run:

```powershell
npm test -- --run src/features/components/portal/schedule-review-dialog.test.tsx
```

Expected: all tests pass, including `axe(container)` after rows load.

### Task 2: Integrate the dialog with the reviewer queue

**Files:**
- Modify: `frontend/src/features/components/portal/schedule-decision-workspace.tsx`
- Modify: `frontend/src/features/components/portal/schedule-decision-workspace.test.tsx`

**Interfaces:**
- Consumes: `ScheduleReviewDialog` from Task 1.
- Produces: the unchanged exported `ScheduleDecisionControls` and `ScheduleDecisionWorkspace` APIs.

- [x] **Step 1: Update tests to require the compact review interaction**

Assert `Review schedule` opens the new dialog, queue cards continue to display department/term/submitter/status, the Dean confirmation uses `Approve schedule`, and return confirmation uses `Return with notes` plus `Notes for Program Chair`.

```tsx
await user.click(screen.getByRole("button", { name: "Review schedule" }))
expect(await screen.findByRole("dialog", { name: /College of Computer Studies/ })).toBeInTheDocument()
await user.click(screen.getByRole("button", { name: "Return with notes" }))
expect(screen.getByLabelText("Notes for Program Chair")).toBeInTheDocument()
```

- [x] **Step 2: Run the reviewer workspace test and confirm RED**

Run:

```powershell
npm test -- --run src/features/components/portal/schedule-decision-workspace.test.tsx
```

Expected: FAIL on the old button labels and old inline table dialog.

- [x] **Step 3: Replace the inline review table with `ScheduleReviewDialog`**

Remove `useScheduleReviewSectionsQuery`, `Dialog`, and table presentation imports from `schedule-decision-workspace.tsx`. Render:

```tsx
<ScheduleReviewDialog
  actorRole={actorRole as "dean" | "executive_director"}
  proposal={reviewingProposal}
  decisionPending={mutation.isPending}
  onOpenChange={(open) => { if (!open) setReviewingProposal(null) }}
  onDecision={(proposal, action) => {
    setPending({ proposal, action })
    setReason("")
    setError("")
  }}
/>
```

Change the queue button to `Review schedule`. Keep queue-card decisions as secondary shortcuts, using the same new labels as the dialog.

- [x] **Step 4: Close the review dialog after a successful decision**

In the existing mutation `onSuccess`, add `setReviewingProposal(null)` after invalidating proposal and section caches. On failure, leave the review context available and show the existing error Alert.

- [x] **Step 5: Run reviewer and dialog tests**

Run:

```powershell
npm test -- --run src/features/components/portal/schedule-review-dialog.test.tsx src/features/components/portal/schedule-decision-workspace.test.tsx
```

Expected: both files pass.

### Task 3: Recompose the Executive workspace around review priority

**Files:**
- Modify: `frontend/src/features/components/portal/master-schedule-workspace.tsx`
- Modify: `frontend/src/features/components/portal/master-schedule-workspace.test.tsx`

**Interfaces:**
- Consumes: unchanged `ScheduleDecisionControls` and existing reference-data queries.
- Produces: unchanged `MasterScheduleWorkspace` export.

- [x] **Step 1: Write failing Executive tab tests**

Assert `For review` is selected by default, decision cards/actions are visible there, published section cards are hidden until the `Published` tab is selected, and the published empty state does not hide review actions.

```tsx
expect(await screen.findByRole("tab", { name: "For review", selected: true })).toBeInTheDocument()
expect(screen.queryByText("Published sections")).not.toBeInTheDocument()
await user.click(screen.getByRole("tab", { name: "Published" }))
expect(screen.getByRole("heading", { name: "Published sections" })).toBeInTheDocument()
```

- [x] **Step 2: Run Executive tests and confirm RED**

Run:

```powershell
npm test -- --run src/features/components/portal/master-schedule-workspace.test.tsx
```

Expected: FAIL because the workspace currently stacks both cards vertically.

- [x] **Step 3: Implement shadcn Tabs for review and published content**

Wrap the two existing cards in:

```tsx
<Tabs defaultValue="review">
  <TabsList aria-label="Executive enrollment review views">
    <TabsTrigger value="review">For review</TabsTrigger>
    <TabsTrigger value="published">Published</TabsTrigger>
  </TabsList>
  <TabsContent value="review">...</TabsContent>
  <TabsContent value="published">...</TabsContent>
</Tabs>
```

Keep the two AsyncBoundary instances independent. Do not fetch extra data for proposal-card counts.

- [x] **Step 4: Refine published cards without changing data behavior**

Use full Card composition for each published section, with subject as title, term as description, and section/day/room in content. Use `Not assigned` for missing meeting details. Preserve the published-section filter and existing reference queries.

- [x] **Step 5: Run Executive tests**

Run:

```powershell
npm test -- --run src/features/components/portal/master-schedule-workspace.test.tsx
```

Expected: all Executive workspace tests pass.

### Task 4: Verify the redesign and record evidence

**Files:**
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: verified frontend redesign with no backend mutation.

- [x] **Step 1: Run the focused test group**

```powershell
npm test -- --run src/features/components/portal/schedule-review-dialog.test.tsx src/features/components/portal/schedule-decision-workspace.test.tsx src/features/components/portal/master-schedule-workspace.test.tsx src/features/components/pages/portal-module-page.test.tsx src/features/portal/module-registry.test.tsx
```

Expected: all tests pass.

- [x] **Step 2: Run typecheck and focused ESLint**

```powershell
npm run typecheck
npx eslint src/features/components/portal/schedule-review-dialog.tsx src/features/components/portal/schedule-review-dialog.test.tsx src/features/components/portal/schedule-decision-workspace.tsx src/features/components/portal/schedule-decision-workspace.test.tsx src/features/components/portal/master-schedule-workspace.tsx src/features/components/portal/master-schedule-workspace.test.tsx
```

Expected: exit code 0 for both commands.

- [x] **Step 3: Run the production build**

```powershell
npm run build
```

Expected: Next.js compiles, TypeScript completes, and route generation finishes with exit code 0.

- [ ] **Step 4: Inspect the live reviewer pages without taking decisions**

Blocked by environment: the required browser runtime reported zero available browser targets. No state-changing fallback was used.

Open the seeded Dean `/portal/schedule-approvals` and Executive `/portal/master-schedule` routes. Verify dialog viewport containment, section tabs, one/two-column responsive behavior, action labels, notes confirmation, and Executive tabs. Do not approve, return, publish, or otherwise mutate the submitted CCS proposal.

- [x] **Step 5: Update progress evidence**

Append exact test counts, build result, visual checks, and any blocker to `PROGRESS.md`. Do not report a check as passed unless its command exited successfully.
