# Registrar Review Dialog Context Design

## Goal

Let Registrar Staff review an enrollment without horizontally scrolling the
schedule, while giving them the student's Name, Year, and Student number
directly above the schedule table.

## Layout

`EnrollmentReviewDialog` remains a modal. On desktop and tablet screens it
uses the available viewport width up to 1152px (`max-w-6xl`) rather than the
current 672px cap. The dialog retains its vertical scroll boundary and the
shared responsive table behavior.

The dialog header contains the enrollment title. A compact, labeled student
information strip follows it, with three values in reading order:

1. Name
2. Year
3. Student number

The existing seven-column schedule table follows immediately. At the wider
desktop size, its complete width is visible without the dialog-level
horizontal scrollbar shown in the current implementation. Small screens keep
the shared `DataTable` card fallback rather than forcing an overflowing table.
The total-unit summary remains below the schedule.

## Data and authorization

The current v1 enrollment contract deliberately omits names and year levels.
Add two nullable keys to every `EnrollmentResource` response:

- `student_name`
- `student_year_level`

Only Registrar Staff and Registrar Head receive their values. For all other
roles that can view enrollments (a student viewing their own record and
Accounting Staff), both fields are `null`. This is an explicit
least-privilege exception for the Registrar review workflow; it does not expose
the student's name to the payment queue.

`ListEnrollments` must eager-load `student.user` so queue responses do not
introduce one user query per enrollment. The frontend schema accepts the two
nullable keys, and the review dialog displays an em dash when a permitted
field is unexpectedly unavailable.

## Scope and safeguards

- Do not add a date; the user explicitly removed that request.
- Do not change enrollment status, approval, rejection, payment, seat, or
  queue behavior.
- Do not change the schedule columns or their existing data join.
- Preserve bearer-token API calls and the existing enrollment policy/scope.
- Keep the enrollment response's strict frontend/backend contract tests in
  sync.

## Verification

- Backend feature coverage proves Registrar Staff receives the name and year,
  while a Student or Accounting viewer receives null values.
- The Registrar dialog regression proves the three labeled student details
  precede the accessible schedule table.
- Run the scoped Laravel feature test, focused Vitest file, explicit-path
  ESLint, TypeScript, Prettier, and whitespace checks.
