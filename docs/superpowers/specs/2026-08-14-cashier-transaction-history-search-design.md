# Cashier Transaction History and Student Lookup Design

## Goal

Give Accounting Staff a safe way to find a student by exact student number,
bring an eligible existing queue ticket into the Cashier workflow, prevent a
second confirmation on a completed enrollment, and review all payment
transactions in a dedicated Transaction History workspace.

## Scope and user decisions

- The existing `Payment Records` Cashier navigation becomes `Transaction
  History`; it is not a second, duplicate payment-history destination.
- Transaction History lists both enrollment-confirmation payments and later
  account-balance payments, with the student number, student name,
  enrollment, transaction type, amount, and processed timestamp.
- Accounting Staff can filter history by exact student number and date. The
  existing Registrar Head oversight remains read-only and retains the same
  history access.
- Student lookup is exact student-number lookup only. It returns only a
  Student with a current `pending_payment` enrollment and a current-day queue
  ticket that the Cashier is authorized to work.
- A lookup never confirms a payment directly. The Cashier must make the
  existing waiting ticket `serving` before the existing confirmation flow is
  available.
- Search cannot replace another Student who is already `serving`; the Cashier
  must first use the existing Skip action in this new search flow. A result
  already being served can be used directly. This does not change the
  existing general `serve` transition, which already completes a different
  currently serving ticket when the Cashier calls the next number.
- After a successful confirmation, the Payment Queue visibly marks that
  enrollment as processed and disables the outer **Confirm payment** action
  for that same ticket. The existing server-side idempotency remains the
  authoritative duplicate-payment guard.

## Architecture

### Transaction history

Create a read-only, role-authorized transaction-list endpoint under
`/api/v1`. A focused Billing action builds a normalized paginated stream from
the immutable enrollment `payments` table and the audited `account_payments`
ledger, newest first. Each resource row has a stable source-qualified ID and
type (`enrollment_payment` or `account_payment`), student context, enrollment
ID, exact decimal amount, and processed timestamp. The endpoint never exposes
payment references to unauthorized roles and never mutates either ledger.

The existing Payment Records workspace, service, query hook, schema, module
label, and tests are renamed/extended to Transaction History. Its table gains
student name and transaction type while retaining responsive cards,
pagination, and date filtering. Student-number filtering is submitted only
through an explicit form submission or Enter so typing does not make partial
identifier requests.

### Student-number lookup

Create an Accounting-only lookup endpoint that accepts one exact,
normalized `student_number`. A dedicated action loads the matching Student,
their `pending_payment` enrollment for the current active term, and the
current-day queue ticket in one authorization-safe query. It returns no
result for a missing student, a non-payment enrollment, a served ticket, or
a ticket from another day. It must not reveal arbitrary Student details to
other roles.

The Payment Queue gets a compact "Find student" form above Now Serving. A
waiting search result provides **Serve selected student** only when no other
ticket is serving. It delegates to the existing queue-ticket `serve`
transition, then invalidates the existing queue/enrollment/account queries.
If the matching ticket is already serving, it becomes the active Cashier
context without an additional transition. If another ticket is serving, the
UI explains that it must be skipped first and does not render the selected
ticket's serve action. No queue state is changed by the search itself.

### Confirmation state

The Payment Queue records the enrollment ID returned by the successful
confirmation. While that same ticket remains visible, its outer confirm
button is disabled and labelled **Payment processed**. It is also disabled
during the request and whenever the queue ticket no longer has a matching
`pending_payment` enrollment. Moving to another valid serving ticket enables
confirmation normally. The confirmation dialog retains its existing pending
state and idempotent backend behavior.

## Error handling

- Lookup with an empty or malformed number is rejected by the Form Request
  before any student query.
- A missing or ineligible student returns a generic not-found response; the
  Cashier UI says no eligible payment-queue record was found.
- A search never changes queue state. Serve conflicts surface the existing
  queue-transition error and retain the result so the Cashier can skip the
  active ticket and retry.
- Transaction-history filters use Form Request validation and the shared
  strict Zod contract. An invalid server response remains an explicit contract
  error, not partially rendered data.

## Testing and verification

- Backend feature tests cover transaction-stream ordering, type/context
  fields, role authorization, and student-number filtering without exposing
  other Student data.
- Backend lookup tests cover the eligible waiting ticket, already-serving
  ticket, missing/ineligible records, authorization, and no mutation from a
  lookup.
- Cashier component tests cover immediate disabled confirmation after success,
  disabled state during confirmation, search-to-serve, another-serving-ticket
  protection, and the resulting request payloads.
- Transaction History component/service tests cover both transaction types,
  exact student-number filtering, role gate, pagination, and accessibility.
- Run the focused backend and frontend suites, typechecking, lint/formatting,
  static analysis, and `git diff --check` before handoff.

## Non-goals

- No change to the PHP 1,000.00 minimum for new enrollment confirmation or
  the PHP 500.00 minimum for later balance payments.
- No payment gateway, refund, void, refund ledger, or promissory-note file
  upload.
- No direct payment for a Student outside the active Cashier queue and no
  queue-order bypass.
