# Real-time schedule workflow refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show new schedule workflow states and notifications within five seconds without a full browser reload.

**Architecture:** Keep the Laravel API and approval lifecycle unchanged. Configure only the existing TanStack Query observers that represent cross-role workflow state: schedule proposals refresh while a role workspace is active, unread notification totals refresh while signed in, and notification-list rows refresh only while the sheet is open. Each relevant query also fetches when its browser window regains focus.

**Tech Stack:** Next.js 16, React 19, TypeScript, TanStack Query v5, Vitest 4, React Testing Library.

## Global Constraints

- Preserve existing `/api/v1` bearer-token reads and Schedule Proposal lifecycle authorization.
- Do not add WebSockets, Laravel broadcasting, queues, events, database migrations, or dependencies.
- Use the five-second interval from `2026-08-03-realtime-schedule-refresh-design.md` only for schedule-proposal and notification workflow queries.
- Keep inactive notification lists from polling; unread totals may poll while authenticated.
- Retain current same-user cache invalidations after proposal mutations.
- Do not commit or push unless the user explicitly requests it.

---

### Task 1: Refresh active schedule review queues

**Files:**
- Modify: `frontend/src/features/hooks/use-scheduling.ts:10-20`
- Modify: `frontend/src/features/components/portal/schedule-decision-workspace.test.tsx`

**Interfaces:**
- Consumes: `getScheduleProposals(signal)` and `scheduleProposalsQueryKey(userId)`.
- Produces: `useScheduleProposalsQuery()` observers that issue a new authorized GET every 5,000 milliseconds while active and whenever the window regains focus.

- [ ] **Step 1: Write the failing reviewer-queue refresh test**

  In `schedule-decision-workspace.test.tsx`, add a test named
  `"refreshes a Dean queue when a Program Chair submits without a page reload"`.
  Use `vi.useFakeTimers()`, make the first GET return `{ data: [] }`, then
  switch subsequent GETs to `{ data: [draftProposal] }`. Render the Dean
  workspace, advance exactly 5,000 milliseconds inside `act`, and assert that
  the `Approve schedule` button becomes available without calling `unmount` or
  rendering the workspace again.

- [ ] **Step 2: Run the new test and verify RED**

  Run:

  ```powershell
  npm test -- --run src/features/components/portal/schedule-decision-workspace.test.tsx -t "refreshes a Dean queue"
  ```

  Expected: FAIL because the proposal query has no five-second refetch
  interval, so the approval button never appears.

- [ ] **Step 3: Add the minimal query freshness options**

  In `useScheduleProposalsQuery`, add:

  ```ts
  refetchInterval: 5_000,
  refetchOnWindowFocus: "always",
  ```

  Do not change the query key, API service, authorization enablement, or
  existing invalidation callers.

- [ ] **Step 4: Run the reviewer-queue test and verify GREEN**

  Run the Step 2 command. Expected: PASS; the query refetches and the Dean
  view renders the proposal from the second response.

- [ ] **Step 5: Run the affected schedule review regressions**

  Run:

  ```powershell
  npm test -- --run src/features/components/portal/schedule-decision-workspace.test.tsx src/features/components/portal/master-schedule-workspace.test.tsx src/features/components/portal/program-chair-enrollment-workspace.test.tsx
  ```

  Expected: all focused tests pass.

- [ ] **Step 6: Leave changes uncommitted**

  Repository instructions prohibit commits unless explicitly requested by the
  user. Record verification evidence in `PROGRESS.md` instead.

### Task 2: Refresh notification count and opened notification list

**Files:**
- Modify: `frontend/src/features/hooks/use-notifications.ts:16-60`
- Modify: `frontend/src/features/components/portal/portal-notification-sheet.tsx:151-171`
- Modify: `frontend/src/features/components/portal/portal-notification-sheet.test.tsx`

**Interfaces:**
- Consumes: `getNotifications(options, signal)`, `notificationQueryKey`, and
  the existing controlled-open API of the shadcn `Sheet` component.
- Produces: `useNotificationsQuery(options, open)` for a list that only
  queries/polls while open; `useUnreadNotificationCountQuery()` that refreshes
  every 5,000 milliseconds for an authenticated session.

- [ ] **Step 1: Write the failing opened-sheet refresh test**

  In `portal-notification-sheet.test.tsx`, add a test named
  `"refreshes notifications while the sheet is open without a page reload"`.
  Use `vi.useFakeTimers()`, open the sheet against a first GET response with
  `"Earlier schedule update"`, switch the GET response to a second envelope
  with `"New Dean review request"`, advance 5,000 milliseconds inside `act`,
  and assert the new message appears while the same dialog remains open.

- [ ] **Step 2: Run the new test and verify RED**

  Run:

  ```powershell
  npm test -- --run src/features/components/portal/portal-notification-sheet.test.tsx -t "refreshes notifications while the sheet is open"
  ```

  Expected: FAIL because the visible notification-list query has neither an
  active-sheet interval nor a five-second interval.

- [ ] **Step 3: Make notification freshness scoped to the open sheet**

  Change `useNotificationsQuery` to accept a boolean `open` argument. Set
  `enabled` to `session !== null && open`, use `refetchInterval: 5_000`, and
  use `refetchOnMount: "always"` plus `refetchOnWindowFocus: "always"`.
  In `PortalNotificationSheet`, control `Sheet` with local `open` state and
  pass it to `useNotificationsQuery`. Set the unread count query interval to
  `5_000` and add `refetchOnWindowFocus: "always"`. Keep the API list options,
  page/filter state, and mutation invalidations intact.

- [ ] **Step 4: Run the notification refresh test and verify GREEN**

  Run the Step 2 command. Expected: PASS; the opened dialog renders the
  second response without closing or remounting.

- [ ] **Step 5: Run notification and portal-shell regressions**

  Run:

  ```powershell
  npm test -- --run src/features/components/portal/portal-notification-sheet.test.tsx src/features/components/layouts/portal-shell.test.tsx
  ```

  Expected: all focused tests pass.

- [ ] **Step 6: Leave changes uncommitted**

  Repository instructions prohibit commits unless explicitly requested by the
  user. Record verification evidence in `PROGRESS.md` instead.

### Task 3: Validate the bounded frontend slice

**Files:**
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: the Task 1 and Task 2 tests plus the existing strict frontend
  compiler and linter configuration.
- Produces: reproducible verification evidence for the query-refresh change.

- [ ] **Step 1: Run strict TypeScript validation**

  Run:

  ```powershell
  npm run typecheck
  ```

  Expected: exit code 0 with no TypeScript diagnostics.

- [ ] **Step 2: Run lint only for changed production and test files**

  Run:

  ```powershell
  npx eslint src/features/hooks/use-scheduling.ts src/features/hooks/use-notifications.ts src/features/components/portal/portal-notification-sheet.tsx src/features/components/portal/schedule-decision-workspace.test.tsx src/features/components/portal/portal-notification-sheet.test.tsx --max-warnings=0
  ```

  Expected: exit code 0 with no warnings.

- [ ] **Step 3: Run all schedule and notification regression tests**

  Run:

  ```powershell
  npm test -- --run src/features/components/portal/schedule-decision-workspace.test.tsx src/features/components/portal/master-schedule-workspace.test.tsx src/features/components/portal/program-chair-enrollment-workspace.test.tsx src/features/components/portal/portal-notification-sheet.test.tsx src/features/components/layouts/portal-shell.test.tsx
  ```

  Expected: exit code 0; the new cross-role and notification-refresh tests and
  existing role-workflow tests pass.

- [ ] **Step 4: Review the final diff for scope and whitespace**

  Run:

  ```powershell
  git diff --check
  git diff -- frontend/src/features/hooks/use-scheduling.ts frontend/src/features/hooks/use-notifications.ts frontend/src/features/components/portal/portal-notification-sheet.tsx frontend/src/features/components/portal/schedule-decision-workspace.test.tsx frontend/src/features/components/portal/portal-notification-sheet.test.tsx PROGRESS.md
  ```

  Expected: no whitespace errors and no backend or lifecycle-rule edits.

- [ ] **Step 5: Update `PROGRESS.md` and leave changes uncommitted**

  Record actual commands and outcomes, including any timeout or failure. Do
  not commit or push because no explicit commit request was made.
