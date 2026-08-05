# Cashier queue live refresh and skip-to-requeue design

**Date:** 2026-08-05

## Goal

Two related Cashier-queue reliability problems, fixed together since they
touch the same screen and adjacent files:

1. The Cashier's queue (Now Serving / Waiting / Served Today) never
   refreshes automatically — a newly approved-and-queued student, or another
   cashier's action, doesn't show up without a manual reload.
2. Clicking "Skip" on the currently-serving ticket permanently cancels it —
   the student vanishes from every view in the app with no way to recall
   them. Discovered live: the product owner testing the Cashier flow saw a
   student disappear from the queue entirely after a skip.

## Root cause

**Part A:** `useQueueTicketsQuery`
(`frontend/src/features/hooks/use-queue-tickets.ts`) has no
`refetchInterval` — unlike `useEnrollmentsListQuery`, which now polls every
5s (2026-08-05 realtime-enrollment-queue slice), this sibling hook was left
out. It is the hook that actually drives the Cashier's visible ticket list —
`nowServing`, `waiting`, and `servedToday` in
`accounting-payment-workspace.tsx` all derive from it, confirmed while
reviewing that slice's final code review.

**Part B:** `TransitionQueueTicket::execute()`
(`backend/app/Actions/Enrollment/TransitionQueueTicket.php:39-42`) maps the
`skip` action to `QueueTicketStatus::Cancelled` — a deliberate, by-design
terminal exit, per its own docblock ("`skip` as a `cancelled` exit from
either `waiting` or `serving`"). But no screen in the app displays
`Cancelled` tickets anywhere: `accounting-payment-workspace.tsx` only
buckets `serving`/`waiting`/`served` tickets (lines 87-91), confirmed via a
full-frontend search for any "cancelled"/"skipped" display bucket — none
exists. A skipped student disappears with zero visibility or recovery path.

## Chosen approach

### Part A: poll `useQueueTicketsQuery`

Add `refetchInterval: 5_000` and `refetchOnWindowFocus: "always"` to
`useQueueTicketsQuery`, matching `useEnrollmentsListQuery`'s exact
configuration and JSDoc style. No schema change, no new files.

### Part B: skip requeues to the back of the line

Redefine `skip`: instead of cancelling, it moves the ticket back to
`Waiting` and re-sorts it to the back of its own priority tier, so the
student stays in the queue and gets called again later — matching how a
real front-desk "skip/pass" works, and matching the product owner's
explicit choice over the alternative (keep cancel, just make it visible).

Today's ordering is entirely `id`-based — priority tier first, then
ascending `id` (`QueueTicket::position()`; `ListQueueTickets`'s
`orderBy('id')`; the frontend's `byQueueOrder`, `a.id - b.id`). `id` is
immutable and monotonic, so there is no way to "move a ticket to the back"
under the current schema — this needs a new sortable marker:

- New nullable column `queue_tickets.requeued_at` (timestamp).
- `TransitionQueueTicket`: `skip`'s `TARGET_STATUS` becomes
  `QueueTicketStatus::Waiting` (not `Cancelled`), and the update sets
  `requeued_at = now()`.
- Every ordering site — `QueueTicket::position()`,
  `ListQueueTickets::execute()`'s `orderBy`, and the frontend's
  `byQueueOrder` — switches its tiebreaker from raw `id` to
  `COALESCE(requeued_at, created_at)` (ascending), with `id` retained only
  as the final tiebreaker for a true timestamp tie. A never-skipped ticket
  sorts exactly as today (its `requeued_at` is null, so it falls back to
  `created_at`, which is monotonic with `id` anyway); a skipped ticket sorts
  as if freshly issued at the moment it was skipped.
- Priority is preserved on skip — the ticket goes to the back of its own
  priority tier (a Priority ticket never falls behind Regular tickets just
  because it was skipped once — Priority is frequently a
  PWD/senior-citizen/pregnant lane in a Philippine institutional setting,
  and losing it on skip would be a real harm, not a cosmetic one).
- `TARGET_STATUS`/`REQUIRED_CURRENT_STATUS` already permit skip from both
  `Waiting` and `Serving`; both continue to transition to `Waiting` with a
  fresh `requeued_at` — a skip from `Waiting` is a legitimate, if
  currently unused-by-UI, "push to the back" operation and needs no
  special-casing.
- `QueueTicketResource` exposes `requeued_at` so the frontend reproduces
  the exact backend ordering rather than guessing at it independently.

**Known limitation, deliberately not solved:** nothing bounds how many
times a ticket can be skipped — a ticket could theoretically be skipped
forever. No skip-count or limit exists today, and PRD §17 marks this whole
queue-policy area "provisional, pending GRC approval" (`QueueTicketStatus`'s
own docblock repeats this verbatim). Adding a cap now would be inventing
institutional policy, not implementing an approved one. Flagged here so it
is not rediscovered as a "missed" requirement later.
- Related: redirecting `skip` to `waiting` also makes
  `QueueTicketStatus::Cancelled` unreachable, so there is no remaining way
  to remove a no-show ticket from today's queue. Not evaluated or solved by
  this slice — an acknowledged gap, not a decision.

## Alternatives considered

1. **Keep skip as `Cancelled`, add a visible "Skipped today" section** (the
   alternative offered and not chosen): a smaller change — no new column, no
   ordering rewrite — and preserves current backend semantics, but does not
   solve the reported problem: the student still loses their place in line
   and needs an entirely new ticket.
2. **Mutate `created_at` on requeue instead of adding `requeued_at`** (not
   selected): `created_at` is a genuine historical fact (original issuance
   time); overwriting it on every skip is lossy and semantically wrong.
3. **A monotonic integer sequence column instead of a timestamp** (not
   selected): more moving parts (a max-lookup or DB sequence) for no
   behavioral difference at this data volume — a front-desk queue is never
   bursty enough for same-`queue_date` timestamp collisions to matter beyond
   the existing `id` tiebreaker.
4. **WebSockets for Part A** (not selected): same reasoning as the two prior
   realtime slices in this app (2026-08-03 schedule refresh, 2026-08-05
   enrollment queue refresh) — no such infrastructure exists, and it would
   be disproportionate for one queue screen.

## Component and data flow

```text
Part A:
Cashier's open payment workspace (useQueueTicketsQuery)
  -> refetches every 5s / on window focus
  -> nowServing / waiting / servedToday buckets stay current
     without a manual reload

Part B:
Cashier clicks "Skip" on the currently-serving ticket
  -> PATCH /api/v1/queue-tickets/{id} { action: "skip" }
  -> TransitionQueueTicket: status -> Waiting, requeued_at -> now()
  -> QueueTicket::position() / ListQueueTickets / byQueueOrder
     all resort by COALESCE(requeued_at, created_at)
  -> the student reappears in the Waiting bucket, at the back
     of their priority tier, within the next 5s poll (Part A)
```

## Error handling and authorization

No change to authorization — `TransitionQueueTicket`'s existing
`REQUIRED_CURRENT_STATUS['skip']` (`Waiting`/`Serving`) and
`QueueTicketPolicy` are untouched; only the *target* status and the
ordering key change. The existing row lock (`lockForUpdate()`) and
`DB::transaction` wrapper already guard a concurrent double-transition; one
more column write inside the same transaction introduces no new race.
Polling (Part A) reuses the existing authenticated client, retry policy,
and `enabled` gate — a failed background refresh keeps the last
successfully loaded queue.

## Test plan

- Backend: rewrite `test_skip_cancels_a_waiting_ticket` and
  `test_skip_cancels_a_serving_ticket` (`QueueTicketsEndpointTest.php`) to
  assert `status === 'waiting'`, `requeued_at` is set, and the ticket now
  sorts behind every other currently-waiting ticket in its priority tier.
  Add a case proving a skipped **Priority** ticket still sorts ahead of
  Regular tickets after being requeued.
  `test_skip_cannot_be_performed_from_served` is unaffected (still blocked)
  and stays as-is.
- Backend: a `QueueTicket::position()` test proving a requeued ticket's
  position reflects the back of its tier, not its original arrival order.
- Frontend: rewrite the "skips the currently serving ticket" test
  (`accounting-payment-workspace.test.tsx`) to assert the skipped student
  reappears in the Waiting list (not vanishes), and add a regression test
  for Part A mirroring the existing `useEnrollmentsListQuery` fake-timer
  polling test.
- Migration: a feature test confirming `requeued_at` exists on
  `queue_tickets`, is nullable, and defaults to null — matching this
  repo's convention of one coverage test per schema-changing migration.

## Scope boundaries

This slice changes: one new nullable column, `TransitionQueueTicket`'s skip
target, three ordering call sites (`QueueTicket::position()`,
`ListQueueTickets`, `byQueueOrder`), `QueueTicketResource`'s exposed
fields, and `useQueueTicketsQuery`'s polling config. It does not add a
skip-count limit, does not change `serve`/`complete`/`mark_priority`
behavior, does not touch `useEnrollmentsListQuery` (already realtime as of
the prior slice), and does not add WebSockets/broadcasting.
