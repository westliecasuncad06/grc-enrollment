# Registrar Enrollment Review Table Design

## Goal

Make the Registrar Staff enrollment-review dialog present the enrolled
subjects in the same compact schedule-table format used by the Student regular
section view. This replaces the current stacked subject cards only.

## User experience

When Registrar Staff selects **Review** from the enrollment queue, the modal
keeps its existing title, student number, total-unit summary, loading state,
empty state, close control, and scrollable dialog boundary. Once reference
data has loaded, its body contains one accessible table with these columns:

1. Subject code
2. Description
3. Units
4. Section ID
5. Day
6. Time
7. Room

Each row corresponds to one enrollment subject. The values come from the
existing client-side join between the enrollment's subject records and the
permitted sections and subjects reference queries. Missing day, time, or room
continues to render as a clear unassigned value rather than hiding the row.
On narrow screens, it uses the existing shared table component's accessible
card fallback; desktop and tablet screens show the seven-column table.

## Scope and safeguards

- Keep `EnrollmentReviewDialog` as a modal; do not move it into the queue.
- Reuse the existing `DataTable` visual and semantic pattern from the Student
  section schedule so the two views have matching headers and dense rows.
- Do not change enrollment API calls, authorization, statuses, approval,
  rejection, queue refresh, or data schemas.
- Retain the displayed total at the bottom of the dialog, calculated from the
  resolved subject units, as today.

## Verification

Add a dialog regression test that opens Review and asserts the accessible
schedule table has the seven expected headers plus the selected subject's
section ID, day, time, room, and units. Keep the existing Registrar workspace
tests green, then run focused lint, typecheck, formatter, and diff checks.
