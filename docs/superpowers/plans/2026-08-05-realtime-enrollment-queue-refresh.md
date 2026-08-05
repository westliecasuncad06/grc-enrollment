# Real-time enrollment approval queue refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Registrar Staff's Enrollment Approvals queue (and the two other
screens sharing its query) refresh automatically when a student submits an
enrollment, without a page reload.

**Architecture:** Add polling to one existing TanStack Query hook —
`useEnrollmentsListQuery` in `frontend/src/features/hooks/use-enrollment.ts`
— matching the 5-second active-tab-polling pattern already used for the
schedule-proposals queue and the notification bell. No backend change, no new
files, no new infrastructure.

**Tech Stack:** Next.js frontend, TanStack Query v5, Vitest + Testing Library
for tests.

## Global Constraints

- 5-second poll interval (`refetchInterval: 5_000`), matching the
  schedule-proposals/notification-bell precedent — not the 10-second interval
  used by the unrelated `useEnrollmentsQuery` (student's own record view).
- `refetchOnWindowFocus: "always"`.
- No `refetchIntervalInBackground` override — polling must pause in hidden
  tabs (TanStack Query's default).
- No backend changes, no new endpoints, no new notification types, no new
  files. This is a one-hook, one-test-file change.
- Full spec: `docs/superpowers/specs/2026-08-05-realtime-enrollment-queue-refresh-design.md`.

---

### Task 1: Poll `useEnrollmentsListQuery` and prove it with a regression test

**Files:**
- Modify: `frontend/src/features/hooks/use-enrollment.ts:82-93` (the
  `useEnrollmentsListQuery` function)
- Modify: `frontend/src/features/components/portal/registrar-enrollment-workspace.test.tsx`
  (add one test, extend `afterEach`, extend the `@testing-library/react`
  import)
- Test: `frontend/src/features/components/portal/registrar-enrollment-workspace.test.tsx`

**Interfaces:**
- Consumes: `useEnrollmentsListQuery(filters: EnrollmentFilters, { enabled })`
  — existing signature, unchanged. `RegistrarEnrollmentWorkspace` (existing
  component, unchanged) is the test's render target.
- Produces: nothing new is exported. `useEnrollmentsListQuery`'s return type
  (a TanStack Query `UseQueryResult`) is unchanged — only its runtime polling
  behavior changes. `accounting-payment-workspace.tsx` (the Cashier queue)
  consumes the same hook and inherits this behavior with no code change of
  its own.

- [ ] **Step 1: Write the failing regression test**

Open `frontend/src/features/components/portal/registrar-enrollment-workspace.test.tsx`.
Change the top `@testing-library/react` import to include `act`:

```tsx
import { act, screen, within } from "@testing-library/react"
```

Change the `afterEach` (currently `afterEach(() => vi.unstubAllGlobals())`)
to also reset real timers, so this test can't leak fake timers into later
tests in the file:

```tsx
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
```

Add this test right after the `"reviews a student's chosen subjects,
schedule, and units"` test (i.e. after the block that ends at line 290,
before `"offers void to Registrar Head on the overrides & voids queue,
filtered by status"`):

```tsx
  it("refreshes the approvals queue when a student submits without a page reload", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let submitted = false
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: submitted ? [pendingApprovalEnrollment] : [],
            links: paginationLinks,
            meta: paginationMeta,
          }),
        ),
      ),
    )

    renderWithSession(
      <RegistrarEnrollmentWorkspace initialModuleId="enrollment-approvals" />,
      { session: registrarStaffSession },
    )

    expect(
      await screen.findByText("No enrollments match this queue."),
    ).toBeInTheDocument()

    submitted = true
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })

    const table = await screen.findByRole("table", { name: "Enrollment queue" })
    expect(within(table).getByText("#9")).toBeInTheDocument()
  })
```

This reuses the file's existing `pendingApprovalEnrollment`,
`registrarStaffSession`, `paginationLinks`, and `paginationMeta` fixtures
(already defined near the top of the file) — no new fixtures needed.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/components/portal/registrar-enrollment-workspace.test.tsx -t "refreshes the approvals queue"`

Expected: FAIL. The initial empty state renders, but after
`advanceTimersByTimeAsync(5_000)` the query never refetches (no
`refetchInterval` is set yet), so the table with `#9` never appears and the
test times out waiting for `findByRole("table", ...)`.

- [ ] **Step 3: Add polling to the hook**

Open `frontend/src/features/hooks/use-enrollment.ts`. Replace the current
`useEnrollmentsListQuery` function (lines 82-93):

```ts
export function useEnrollmentsListQuery(
  filters: EnrollmentFilters,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: enrollmentsListQueryKey(session?.userId ?? null, filters),
    queryFn: ({ signal }) => listEnrollments(filters, signal),
    enabled: enabled && session !== null,
  })
}
```

with:

```ts
/**
 * Polls every 5s so a newly submitted enrollment shows up in whichever
 * role-scoped queue is watching it — Registrar Staff's Enrollment
 * Approvals, Registrar Head's Overrides & Voids, and the Cashier's
 * pending-payment queue all consume this one hook. Matches the interval
 * already used for the schedule-proposals queue and the notification bell
 * (see docs/superpowers/specs/2026-08-03-realtime-schedule-refresh-design.md);
 * `useEnrollmentsQuery` above stays at 10s since that one is a student's own
 * record view, not a staff review queue. Refetches immediately on window
 * focus. TanStack Query pauses polling in hidden tabs by default
 * (`refetchIntervalInBackground` is not set), so this costs nothing when
 * nobody is looking at the page.
 */
export function useEnrollmentsListQuery(
  filters: EnrollmentFilters,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: enrollmentsListQueryKey(session?.userId ?? null, filters),
    queryFn: ({ signal }) => listEnrollments(filters, signal),
    enabled: enabled && session !== null,
    refetchInterval: 5_000,
    refetchOnWindowFocus: "always",
  })
}
```

- [ ] **Step 4: Run the new test to verify it passes**

Run: `cd frontend && npx vitest run src/features/components/portal/registrar-enrollment-workspace.test.tsx -t "refreshes the approvals queue"`

Expected: PASS.

- [ ] **Step 5: Run the full affected test files to confirm no regressions**

Run: `cd frontend && npx vitest run src/features/components/portal/registrar-enrollment-workspace.test.tsx src/features/components/portal/accounting-payment-workspace.test.tsx`

Expected: PASS, all tests in both files (the Cashier payment-queue file is
included because it consumes the same hook and must keep working unchanged).

- [ ] **Step 6: Run TypeScript and lint checks**

Run: `cd frontend && npm run typecheck && npx eslint src/features/hooks/use-enrollment.ts src/features/components/portal/registrar-enrollment-workspace.test.tsx --max-warnings=0`

Expected: no errors. (`npm run lint` also works but lints the whole project;
the scoped `eslint` call above checks only the two changed files with the
same `--max-warnings=0` the project's `lint` script enforces.)

- [ ] **Step 7: Commit**

```bash
cd /c/xampp/htdocs/GRC-ENROLLMENT
git add frontend/src/features/hooks/use-enrollment.ts frontend/src/features/components/portal/registrar-enrollment-workspace.test.tsx
git commit -m "feat(portal): poll the enrollment approval queue so new submissions appear live

Registrar Staff's Enrollment Approvals table never refreshed when a
student submitted an enrollment in a different session — only a
manual reload picked it up, even though the notification bell already
polled. Applies the same 5s active-tab polling already used for
schedule approvals. Registrar Head's Overrides & Voids and the
Cashier's pending-payment queue share the same hook and inherit the
fix with no code change of their own.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012RAC8uSdnwSc6kVkSTCQ44"
```

---

## Self-Review

**Spec coverage:** The spec's one behavioral requirement — `useEnrollmentsListQuery`
polls at 5s with window-focus refetch, covering all three consumer screens —
is fully implemented in Task 1, Step 3. The spec's test-plan requirement (a
regression test proving live refresh without remount, plus confirming the
other two consumers still pass) is covered in Steps 1-2 and Step 5. No
backend, endpoint, or notification-type changes were specified, and none are
present in this plan.

**Placeholder scan:** No TBD/TODO. Every step has literal, complete code —
the full replacement function body, the full test body, and the exact
commands to run.

**Type consistency:** `useEnrollmentsListQuery`'s parameters
(`filters: EnrollmentFilters`, `{ enabled = true }`) and return value are
unchanged from the current implementation, so every existing caller
(`registrar-enrollment-workspace.tsx`, `accounting-payment-workspace.tsx`)
keeps compiling with no changes of their own — verified by reading both call
sites during planning.
