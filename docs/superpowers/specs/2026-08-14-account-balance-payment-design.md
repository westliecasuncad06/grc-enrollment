# Student Account Balance and Partial Payment Design

## Goal

Give Accounting Staff and Students an accurate, auditable view of outstanding
balances across active academic terms. Permit a qualifying partial enrollment
payment to finalize enrollment and generate a COM, while allowing separate
smaller payments to reduce earlier balances.

## Confirmed Rules

- An enrollment payment of at least **PHP 1,000.00** may finalize a current
  enrollment and generate the Digital COM even if an amount remains unpaid.
- A separate non-enrollment account payment may be any positive amount (for
  example, PHP 500.00).
- A non-enrollment account payment applies automatically oldest-first across
  the Student's outstanding active enrollments.
- The balance excludes cancelled, rejected, withdrawn, and voided
  enrollments.
- The hard-copy promissory note does not enter the system. Cashier may only
  record the operational indicator **Promissory note on file** when confirming
  an enrollment payment.
- Skipping a Cashier queue ticket requeues it to the back of its priority tier;
  it must remain visible as `waiting` and must never be removed.

## Current-State Constraints

`payments` has a one-payment-per-enrollment uniqueness constraint and is the
idempotency boundary for current enrollment confirmation/COM generation. It
must remain intact. The existing payment record may therefore continue to
capture the current enrollment payment, but cannot represent later separate
payments against a previous balance.

An assessment already represents the charge for one enrollment. Account
balance must be derived from assessments less payments, rather than stored as
an editable balance field, so it remains consistent with the audit trail.

## Architecture

### Account payment ledger

Add an `account_payments` table for a separate payment against an already
assessed enrollment balance. Every row records:

- `student_id`
- `enrollment_id`, one of the oldest outstanding enrollments selected by the
  server when a receipt spans more than one balance
- exact decimal `amount`
- `received_by`, the Accounting Staff member
- `received_at`
- timestamps

`payments` remains the single idempotent payment-confirmation row associated
with a current enrollment. Add `promissory_note_on_file` to that row. The
indicator is informational; it neither waives a balance nor changes student
eligibility.

### Balance calculation

Create one Billing-domain summary service that returns account totals and a
per-enrollment/per-term breakdown. For each active assessed enrollment it
computes:

```
remaining = assessment total
          - enrollment confirmation payment amount
          - separately allocated account payments
```

The account total is the sum of positive remaining values. A separate account
payment is accepted only when the Student has an outstanding active balance
and its amount does not exceed that balance. The server serializes Cashier
receipts by locking the Student profile within the same transaction, then
allocates to the oldest outstanding active enrollment(s) until the receipt is
fully recorded.

The summary reports whether an outstanding enrollment has a confirmed payment
marked `promissory_note_on_file`.

### API and authorization

- `GET /api/v1/student-account` returns only the authenticated Student's
  summary and term breakdown.
- `GET /api/v1/students/{student}/account` provides Cashier account context
  for the Student currently being served, including name and year. This data
  is only available to Accounting Staff; the ordinary queue list remains
  limited to its existing ticket fields.
- `POST /api/v1/students/{student}/account-payments` is Accounting Staff-only.
  The request contains an amount; it never accepts a target enrollment because
  the server performs oldest-first balance allocation itself.
- Enrollment confirmation accepts an optional `promissory_note_on_file` flag.
  If an explicit amount is supplied for a new enrollment confirmation, it must
  be at least PHP 1,000.00. A blank amount retains the existing full-assessment
  default.

### Cashier experience

The current Now Serving card will display Student name, number, year, current
enrollment assessment, prior-term balance, total outstanding balance, and a
promissory-note badge where applicable.

Two distinct actions prevent accounting ambiguity:

1. **Confirm enrollment payment** — uses the current enrollment, enforces the
   PHP 1,000.00 explicit-payment minimum, optionally records the hard-copy
   promissory-note indicator, then preserves the existing idempotent COM flow.
2. **Record balance payment** — accepts any positive amount within the total
  balance, identifies that it will apply oldest-first, and leaves the
   current enrollment and queue-ticket status unchanged.

### Student experience

Add a read-only Account balance panel to the Student enrollment workspace. It
shows total outstanding balance, a per-term list of remaining amounts, and the
promissory-note-on-file status. It never exposes another Student's data and
does not offer payment confirmation controls.

## Queue Invariant

No account-payment operation changes a queue ticket. The existing `skip`
transition remains `serving|waiting -> waiting` with `requeued_at` set. The
queue-list order and the Cashier UI must be tested after a skip to show the
ticket at the back of its priority tier, not absent from the queue.

## Error Handling

- A new enrollment payment below PHP 1,000.00 receives a field-level `422`
  validation error and does not create payment, COM, or enrollment transition.
- A balance payment of zero, a negative amount, an amount above the current
  balance, or a request with no outstanding active balance receives a `422`.
- A repeat enrollment-confirmation request returns the existing payment and
  COM without creating duplicates, as it does today.
- Simultaneous balance payments use a transaction and lock the Student profile
  so Cashier receipts for one account cannot overpay a balance by racing.

## Tests

- API tests for the PHP 1,000.00 enrollment-payment minimum, promissory-note
  persistence, and preserved confirmation idempotency.
- Account-summary tests covering prior/current term totals, excluded terminal
  enrollments, separate PHP 500.00 payment allocation to the oldest balance,
  and protection against overpayment.
- Policy tests proving Students can read only their own account and Accounting
  can read account context only via its authorized queue/payment operations.
- Cashier UI tests for the balance context, distinct payment actions, and
  skipped-ticket visibility/requeue ordering.
- Student UI tests for the own-account balance panel and promissory-note label.
