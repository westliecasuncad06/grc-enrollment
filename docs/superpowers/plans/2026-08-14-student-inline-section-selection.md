# Student Inline Section Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the regular student's modal-driven block picker with an inline schedule-table selection flow and limit its visible preferences to preferred days and maximum days on campus.

**Architecture:** Rework the existing `EnrollmentSectionTable` into the regular selection surface: it will render every available block inline before a selection, or only the selected block after a selection. The existing preferences panel will gain a compact variant that writes the complete existing preference document while displaying only the two requested fields. `EnrollmentWorkspace` will own the selected block, submission, and change-section state; no backend route or request shape changes.

**Tech Stack:** Next.js 16, React 19, TypeScript, React Hook Form, Zod, TanStack Query, Tailwind CSS, shadcn/ui, Vitest, Testing Library.

## Global Constraints

- Modify the regular block-based student flow only; leave irregular subject selection unchanged.
- Do not use a modal or dialog to select a regular student section.
- Keep schedule preferences advisory; they rank and never gate section choices.
- Preserve the bearer-token API and server-side `block_code` validation on enrollment submission.
- Save a full valid schedule-preference payload so non-visible existing values are never overwritten.
- Do not commit or push this work until the user requests a GitHub saving point.

---

## File structure

- Modify `frontend/src/features/components/portal/student-schedule-preferences-panel.tsx` — add the two-field compact display while preserving the complete form payload.
- Modify `frontend/src/features/components/portal/enrollment-section-table.tsx` — replace the summary table with accessible inline block schedule cards and selected-state controls.
- Modify `frontend/src/features/components/portal/enrollment-workspace.tsx` — remove modal state/import, connect inline choose/change controls, and render the regular submit action inside the selected section.
- Modify `frontend/src/features/components/portal/enrollment-review-card.tsx` — render the review card only for the irregular flow so the regular selection is not duplicated.
- Modify `frontend/src/features/components/portal/enrollment-workspace.test.tsx` — replace modal/table assertions with inline schedule, change-section, compact-preference, and submit assertions.
- Keep `frontend/src/features/components/portal/enrollment-block-detail-dialog.tsx` untouched for now because it is not part of the requested regular selection render path; removal can be considered only after confirming no other future route imports it.

### Task 1: Cover compact preferences and inline regular selection

**Files:**
- Modify: `frontend/src/features/components/portal/enrollment-workspace.test.tsx:952-1132`

**Interfaces:**
- Consumes: `EnrollmentWorkspace` with `mockRegularRoutes`, `enrollmentBlock`, and `scoredBlocks` fixtures.
- Produces: Regression coverage for the regular student interaction contract.

- [ ] **Step 1: Write failing regular-flow tests**

Replace the modal-based tests with these assertions:

```tsx
expect(await screen.findByLabelText("Preferred days")).toBeInTheDocument()
expect(screen.getByLabelText("Maximum days on campus")).toBeInTheDocument()
expect(screen.queryByLabelText("Preferred time block")).not.toBeInTheDocument()

const section = await screen.findByRole("article", { name: /IT201 section/i })
expect(within(section).getByRole("table", { name: /IT201 schedule/i })).toBeInTheDocument()
await user.click(within(section).getByRole("button", { name: /choose IT201/i }))
expect(screen.queryByRole("dialog", { name: /IT201/i })).not.toBeInTheDocument()
expect(screen.getByRole("button", { name: "Change section" })).toBeInTheDocument()
```

Add a two-block test that chooses `IT301`, confirms `IT302` is hidden, clicks Change section, then confirms both sections are shown again. Retain a low-score selectable assertion by clicking `Choose IT302` directly from its inline card. Update the closed-window expectation to find the inline `Choose IT201` button disabled.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --run frontend/src/features/components/portal/enrollment-workspace.test.tsx`

Expected: FAIL because the current UI still renders a summary table and `EnrollmentBlockDetailDialog`.

### Task 2: Add compact schedule preference mode

**Files:**
- Modify: `frontend/src/features/components/portal/student-schedule-preferences-panel.tsx:69-281`
- Test: `frontend/src/features/components/portal/enrollment-workspace.test.tsx:952-1132`

**Interfaces:**
- Consumes: `StudentSchedulePreference` from `useStudentSchedulePreferenceQuery` and the existing `StudentSchedulePreferenceInput` schema.
- Produces: `StudentSchedulePreferencesPanel({ compact?: boolean })`, where `compact` defaults to `false` and renders only `preferred_days` and `max_days_on_campus` when true.

- [ ] **Step 1: Add a `compact` prop to the panel and form**

```tsx
export function StudentSchedulePreferencesPanel({ compact = false }: { compact?: boolean }) {
  // keep authorization and card behavior
  return <StudentSchedulePreferencesForm compact={compact} />
}

function StudentSchedulePreferencesForm({ compact }: { compact: boolean }) {
  // keep useForm<StudentSchedulePreferenceInput> and toFormValues unchanged
}
```

- [ ] **Step 2: Render only requested fields in compact mode**

Wrap the current time block, modality, early-class, and notes fields in `!compact` conditions. Keep `preferred_days`, `max_days_on_campus`, error display, and submit button in both modes. Use compact heading/description copy that says the two values rank available sections.

- [ ] **Step 3: Preserve the full API document on save**

Do not construct a partial payload. Continue calling `saveMutation.mutateAsync(input)` with the React Hook Form model populated by `toFormValues`, ensuring hidden existing values remain present in the `PUT` body.

- [ ] **Step 4: Run the focused test**

Run: `npm test -- --run frontend/src/features/components/portal/enrollment-workspace.test.tsx`

Expected: preference assertions progress, while inline selection assertions remain failing until Task 3.

### Task 3: Implement inline block schedule cards and selected state

**Files:**
- Modify: `frontend/src/features/components/portal/enrollment-section-table.tsx:1-119`
- Test: `frontend/src/features/components/portal/enrollment-workspace.test.tsx:952-1132`

**Interfaces:**
- Consumes: `readonly EnrollmentBlock[]`, `selectedBlockCode: string | null`, `onChoose(blockCode: string)`, `onChangeSection()`, `disabled: boolean`, and `renderSelectedFooter(block: EnrollmentBlock): ReactNode`.
- Produces: `EnrollmentSectionTable` with inline `article` cards, schedule tables, and no `onView` callback.

- [ ] **Step 1: Define the inline table component contract**

```tsx
export function EnrollmentSectionTable({
  blocks,
  selectedBlockCode,
  onChoose,
  onChangeSection,
  disabled = false,
  renderSelectedFooter,
}: {
  blocks: readonly EnrollmentBlock[]
  selectedBlockCode: string | null
  onChoose: (blockCode: string) => void
  onChangeSection: () => void
  disabled?: boolean
  renderSelectedFooter: (block: EnrollmentBlock) => ReactNode
})
```

- [ ] **Step 2: Render each available block as an inline card**

For each block, render an `article` labelled `"${block.block_code} section"`, header code, a `Badge` for `capacity` or remaining seats, and subtitle `"Year ${block.year_level} block section · ${block.subjects.length} subjects"`. Render a `DataTable` named `"${block.block_code} schedule"` with Subject code, Description, Units, Section ID, Day, Time, and Room columns. Use the table's responsive card renderer to provide the same fields on narrow screens.

- [ ] **Step 3: Switch between the available and selected states**

When `selectedBlockCode` is null, render every block and each enabled `Choose ${block.block_code}` button only if `block.is_selectable`; otherwise show its first reason. When selected, render only the matching block, its Change section button, and `renderSelectedFooter(block)`. No `Dialog`, `Sheet`, or `AlertDialog` is used in this component.

- [ ] **Step 4: Run the focused test**

Run: `npm test -- --run frontend/src/features/components/portal/enrollment-workspace.test.tsx`

Expected: PASS for the new inline selection, change-section, low-score, and closed-window checks.

### Task 4: Connect workspace submission and remove regular duplication

**Files:**
- Modify: `frontend/src/features/components/portal/enrollment-workspace.tsx:1-430`
- Modify: `frontend/src/features/components/portal/enrollment-review-card.tsx:69-162`
- Test: `frontend/src/features/components/portal/enrollment-workspace.test.tsx:952-1132`

**Interfaces:**
- Consumes: the Task 3 `EnrollmentSectionTable` API and existing `submitFooter(totalUnitsValue)`.
- Produces: modal-free regular block selection that still submits `{ academic_term_id, block_code }` after the existing confirmation dialog.

- [ ] **Step 1: Remove only modal-selection state and wiring**

Delete the `EnrollmentBlockDetailDialog` import, `viewingBlock` state, dialog render, and the `setViewingBlock` side effect in `chooseBlock`. Keep the final `AlertDialog` confirmation unchanged.

- [ ] **Step 2: Wire the regular section surface**

```tsx
<StudentSchedulePreferencesPanel compact />
<EnrollmentSectionTable
  blocks={blocks}
  selectedBlockCode={selectedBlockCode}
  onChoose={chooseBlock}
  onChangeSection={() => setSelectedBlockCode(null)}
  disabled={enrollmentWindowClosed}
  renderSelectedFooter={(block) => submitFooter(block.total_units)}
/>
```

Keep the existing `AsyncBoundary`, availability rules, mutation request body, and inactive regular audience empty state.

- [ ] **Step 3: Remove the duplicate regular review card**

Make `EnrollmentReviewCard` return `null` for `isRegularAudience`; retain the irregular `selectedEntries` review card and submit footer unchanged. This leaves one authoritative selected-section presentation for regular students.

- [ ] **Step 4: Run focused component test**

Run: `npm test -- --run frontend/src/features/components/portal/enrollment-workspace.test.tsx`

Expected: PASS, including `{ academic_term_id: 2, block_code: "IT201" }` submission assertion.

### Task 5: Format and verify the completed behavior

**Files:**
- Modify: `PROGRESS.md`
- Verify: changed frontend source and test files.

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: verified, documented implementation with no unrecorded checks.

- [ ] **Step 1: Format changed frontend files**

Run: `npx prettier --write src/features/components/portal/student-schedule-preferences-panel.tsx src/features/components/portal/enrollment-section-table.tsx src/features/components/portal/enrollment-workspace.tsx src/features/components/portal/enrollment-review-card.tsx src/features/components/portal/enrollment-workspace.test.tsx`

- [ ] **Step 2: Run checks**

Run:

```powershell
npm test -- --run frontend/src/features/components/portal/enrollment-workspace.test.tsx
npm run lint -- --quiet
npm run typecheck
git diff --check
```

Expected: focused test, lint, typecheck, and whitespace checks pass. If a repository baseline failure occurs outside the changed files, record its exact output in `PROGRESS.md` instead of claiming the full check passed.

- [ ] **Step 3: Update progress**

Record the inline flow, compact preference boundary, test results, and any check limitation in `PROGRESS.md`. Do not record checks as passed unless their command completed successfully.

## Self-review

- Spec coverage: Task 2 implements precisely the two requested preference fields and full-payload persistence. Tasks 3–4 implement inline schedule cards, selected-only state, Change section return, no selection modal, accurate Section ID, and preserved server-authoritative submission. Task 1 protects all requested interactions; Task 5 verifies and records them.
- Placeholder scan: no TBD/TODO/placeholders are present.
- Type consistency: `selectedBlockCode`, `onChoose`, `onChangeSection`, `disabled`, and `renderSelectedFooter` are declared in Task 3 and consumed exactly in Task 4.
