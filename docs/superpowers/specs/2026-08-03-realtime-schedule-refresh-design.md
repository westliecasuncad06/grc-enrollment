# Real-time schedule workflow refresh design

**Date:** 2026-08-03

## Goal

Make schedule workflow updates visible without a full browser reload. When a
Program Chair submits a schedule, the Dean's review queue must refresh while
open. When a Dean approves or returns a schedule, the Executive Director's
queue and the Program Chair's status must refresh while open. New notification
counts must also appear promptly.

## Root cause

The Laravel transition action persists the schedule state and its notification
records correctly, but the frontend has no server-push transport. The
`schedule-proposals` query is fetched only on mount or after a mutation in the
same browser, so changes made by another role leave the current cache stale.
The notification bell polls only its unread total every 60 seconds; the list
does not refresh while open.

## Chosen approach

Use targeted, active-tab polling of the existing authorized REST reads:

- `useScheduleProposalsQuery` refetches every 5 seconds while its consumer is
  visible. This single shared query already powers the Program Chair status,
  Dean review queue, Executive Director queue, and returned-schedule badge.
- The unread notification-count query refetches every 5 seconds while signed
  in.
- The notification sheet controls its open state. Its full notification-list
  query runs only while the sheet is open, refetches every 5 seconds then, and
  always refetches when reopened so stale cached rows are never shown.
- These queries refetch immediately when the browser window regains focus.

The five-second interval gives an observable near-real-time handoff without
introducing a polling interval globally or changing any other reference-data
read. Queries pause in hidden tabs; visibility focus triggers an immediate
refresh rather than producing unnecessary background traffic.

## Alternatives considered

1. **Laravel broadcasting + WebSockets (not selected):** true push and lower
   latency, but requires new infrastructure, configuration, deployment
   supervision, authorization channels, and client connection handling. None
   exists in the current architecture.
2. **Window-focus refresh only (not selected):** smaller change but still
   leaves active Dean and Executive screens stale during the workflow.
3. **Targeted REST polling (selected):** uses current endpoints and query
   boundaries, needs no backend mutation, and achieves the PRD's real-time or
   refreshed-update requirement without a full application reload.

## Component and data flow

```text
Program Chair submits schedule
  -> existing REST transition persists proposal + notification
  -> Dean's active schedule-proposals query refetches within 5 seconds
  -> Dean approves/returns using existing REST transition
  -> Executive's and Program Chair's active shared queries refetch within 5 seconds

Any schedule transition creates a notification
  -> signed-in recipient's unread-count query refetches within 5 seconds
  -> opened notification sheet refetches the full list within 5 seconds
```

Existing mutation cache invalidations remain intact, preserving immediate
feedback for the actor who performed the action. Polling handles the separate
browser/session case that invalidation cannot reach.

## Error handling and authorization

Polling uses the current authenticated API client, query keys, retry policy,
and role-gated consumers. An unsuccessful background refresh preserves the
last valid queue or notification data and follows the existing one-retry policy
for transient failures. No new endpoint, token, permission, or state
transition is introduced.

## Test plan

- Add a failing frontend regression test that advances the schedule-query
  interval and confirms a reviewer queue renders a newly submitted proposal
  without remounting or reloading.
- Add a failing notification-sheet regression test that advances the active
  sheet interval and confirms a newly arrived notification appears.
- Retain and run existing schedule-decision, master-schedule, Program Chair,
  notification-sheet, portal-shell, TypeScript, and lint checks.

## Scope boundaries

This slice changes only frontend query freshness. It does not add WebSockets,
Laravel broadcasting, queue workers, events, database migrations, notification
types, approval rules, or unrelated polling.
