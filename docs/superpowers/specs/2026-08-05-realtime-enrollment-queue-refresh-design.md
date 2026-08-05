# Real-time enrollment approval queue refresh design

**Date:** 2026-08-05

## Goal

When a student submits an enrollment, Registrar Staff must see it appear in
their Enrollment Approvals queue without reloading the page. The backend
already records a per-role notification for every submission
(`SubmitEnrollment.php` → `NotificationRecorder::recordManyForRole`), and the
notification bell already polls every 5 seconds for any signed-in user. What
is missing is the queue table itself catching up to that notification.

## Root cause

`useEnrollmentsListQuery` (`frontend/src/features/hooks/use-enrollment.ts`) —
the role-scoped, filterable, paginated query behind three screens — has no
`refetchInterval`. It only fetches on mount, on filter change, or after a
mutation made in the same browser tab. A submission made by a student in a
different session leaves every open queue stale until a manual reload:

- Registrar Staff's **Enrollment Approvals** (`pending_registrar_approval`)
- Registrar Head's **Overrides & Voids** (`pending_payment`)
- Cashier's **pending-payment queue** (`accounting-payment-workspace.tsx`)

This is the same shape of gap the 2026-08-03 design fixed for schedule
proposals: the mutation-side cache invalidation works for the actor who acted,
but nothing refreshes the screen for everyone else watching the same queue.

## Chosen approach

Add the same targeted, active-tab polling already established for the
schedule-proposals query and the notification bell, directly on the shared
hook:

- `useEnrollmentsListQuery` refetches every 5 seconds while its consumer is
  mounted and the tab is visible (TanStack Query pauses polling in hidden
  tabs by default — `refetchIntervalInBackground` is not set).
- Refetches immediately on window focus (`refetchOnWindowFocus: "always"`).

Because all three screens consume this one hook, this single change makes all
three queues refresh live — confirmed as in-scope with the user, since forking
the hook per screen would duplicate logic for identical desired behavior.

**Correction (post-implementation, final review):** this is accurate for
Registrar Staff's Enrollment Approvals and Registrar Head's Overrides &
Voids, which both render their table directly off this query. It overstates
the Accounting/Cashier screen: that screen's visible waiting-line list is
driven by a separate, non-polling hook (`useQueueTicketsQuery`); this
change only makes the enrollment-derived fields joined onto each ticket
row (financial status, units, amount due) refresh live there, not the
queue membership itself. Extending `useQueueTicketsQuery` with the same
polling is the natural follow-up, tracked separately — out of this slice's
scope, which is limited to `useEnrollmentsListQuery`.

5 seconds matches the schedule-proposals and notification-bell precedent
(these are the "staff review queue" family); the sibling
`useEnrollmentsQuery` (a student's own enrollment record) polls at 10 seconds,
which is a different, lower-urgency use case and is left untouched.

## Alternatives considered

1. **Laravel broadcasting + WebSockets (not selected):** same reasoning as
   the 2026-08-03 decision — no such infrastructure exists in this stack, and
   introducing it for one queue table would be a large, disproportionate
   change.
2. **10-second interval matching `useEnrollmentsQuery` (not selected):** this
   feature is functionally a staff approval queue, not a personal record view
   — the 5-second "review queue" precedent is the closer analogue.
3. **Per-screen hooks instead of the shared query (not selected):** the user
   confirmed all three consumers should get the same live behavior, so
   forking would only duplicate the query for an identical outcome.

## Component and data flow

```text
Student submits enrollment (SubmitEnrollment.php)
  -> status = pending_registrar_approval
  -> Notification::create() for the actor
  -> NotificationRecorder::recordManyForRole(RegistrarStaff, ...) (existing)
  -> Registrar Staff's open Enrollment Approvals table
     (useEnrollmentsListQuery) refetches within 5s -> new row appears
  -> Registrar Head's Overrides & Voids and Cashier's pending-payment queue
     (same hook) also refresh within 5s
```

Existing mutation-triggered invalidation (`useInvalidateEnrollmentQueries`)
is untouched and keeps giving the acting user's own browser an immediate
update; polling only covers the separate-session case invalidation cannot
reach.

## Error handling and authorization

Polling reuses the current authenticated API client, query key, `enabled`
gate (session + explicit `enabled` flag per screen), and retry policy. A
failed background refresh keeps the last successfully loaded queue rather
than clearing it. No new endpoint, permission, or state transition is
introduced — this is a frontend query-freshness change only.

## Test plan

- Add a failing regression test (in the Registrar Enrollment Workspace test
  file) that advances the query's fake-timer interval and confirms a newly
  submitted enrollment appears in the table without remounting the component,
  mirroring the 2026-08-03 schedule-proposals regression test.
- Confirm the same behavior is exercised (directly or via the shared hook
  test) for the Registrar Head Overrides & Voids and Cashier payment-queue
  consumers, since they share the changed hook.
- Retain and run existing registrar-enrollment-workspace, accounting-payment-
  workspace, use-enrollment hook, TypeScript, and lint checks.

## Scope boundaries

This slice changes only frontend query freshness on one existing hook. It
does not add WebSockets, Laravel broadcasting, queue workers, new endpoints,
new notification types, or change any approval/authorization rule.
