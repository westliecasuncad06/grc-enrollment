# Cashier Transaction History and Student Lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Accounting Staff a queue-safe student-number lookup, an immediately disabled post-confirmation action, and a unified Transaction History for enrollment and balance payments.

**Architecture:** Keep the existing `/api/v1/payments` read contract intact and add a focused `/api/v1/cashier-transactions` read endpoint that unions immutable enrollment payments with the account-payment ledger into a single, normalized paginated stream. Add an Accounting-only lookup endpoint that returns only a current-term `pending_payment` enrollment with a current-day waiting or serving ticket; the frontend still uses the established queue transition before it can confirm a searched student's payment.

**Tech Stack:** Laravel 12, PHP 8.4, Sanctum bearer authentication, Form Requests, Policies, Actions, API Resources, MariaDB, React strict TypeScript, TanStack Query, Zod, Tailwind CSS, shadcn/ui, Vitest, PHPUnit.

## Global Constraints

- Keep all HTTP routes versioned under `/api/v1` and protected by existing Sanctum bearer-token middleware.
- Accounting Staff is the only role allowed to look up a Cashier payment candidate; Registrar Head and Accounting Staff can read transaction history through the existing `PaymentPolicy::viewAny` gate.
- Transaction history is read-only; it never changes a payment, an account-payment allocation, a queue ticket, enrollment status, or audit log.
- Student lookup is exact by student number and does not itself mutate queue state or expose arbitrary Student records.
- A searched waiting ticket can be served only through the existing `PATCH /api/v1/queue-tickets/{id}` `serve` transition; the new UI blocks that action while a different ticket is currently serving.
- Keep exact money values as decimal strings in backend resources and Zod schemas; do not use floating-point arithmetic for balances.
- Preserve existing PHP 1,000.00 enrollment-payment and PHP 500.00 account-payment minimums.
- Work on `main` as explicitly requested. Do not commit or push unless the user explicitly asks at handoff.

---

## File structure

- `backend/app/Actions/Billing/ListCashierTransactions.php` — builds the normalized SQL-union transaction paginator.
- `backend/app/Http/Controllers/Api/V1/CashierTransactionController.php` — authorizes and returns the transaction feed.
- `backend/app/Http/Requests/Api/V1/CashierTransaction/IndexCashierTransactionRequest.php` — validates exact filters and pagination.
- `backend/app/Http/Resources/Api/V1/CashierTransactionResource.php` — exposes the strict shared transaction shape.
- `backend/app/Actions/Billing/FindCashierPaymentCandidate.php` — exact, no-write lookup of the active eligible student, enrollment, and ticket.
- `backend/app/Http/Controllers/Api/V1/CashierPaymentCandidateController.php` — Accounting-only lookup controller.
- `backend/app/Http/Requests/Api/V1/CashierPaymentCandidate/ShowCashierPaymentCandidateRequest.php` — requires a nonblank student number.
- `backend/app/Http/Resources/Api/V1/CashierPaymentCandidateResource.php` — exposes only the Cashier context needed to serve the ticket.
- `backend/routes/api.php` — registers the two read-only endpoints inside the authenticated v1 group.
- `backend/tests/Feature/Api/V1/CashierTransactionsEndpointTest.php` — endpoint authorization, filtering, merging, and ordering.
- `backend/tests/Feature/Api/V1/CashierPaymentCandidateEndpointTest.php` — lookup eligibility, privacy, and no-write behavior.
- `frontend/src/features/schemas/cashier-transaction-schema.ts` — strict transaction and lookup Zod contracts.
- `frontend/src/features/services/cashier-transaction-service.ts` — authenticated fetches for transactions and lookup.
- `frontend/src/features/services/cashier-transaction-service.test.ts` — service request and contract regressions.
- `frontend/src/features/hooks/use-cashier-transactions.ts` — cache-isolated list and lookup queries.
- `frontend/src/features/components/portal/payment-records-workspace.tsx` — relabels and renders the unified Transaction History.
- `frontend/src/features/components/portal/payment-records-workspace.test.tsx` — history table/filter/role/accessibility coverage.
- `frontend/src/features/components/portal/accounting-payment-workspace.tsx` — adds search-to-serve and derives the disabled processed state.
- `frontend/src/features/components/portal/accounting-payment-workspace.test.tsx` — Cashier search and post-confirmation regressions.
- `frontend/src/features/portal/role-capabilities.ts` — renames the visible Cashier navigation label and description.
- `frontend/src/features/portal/role-capabilities.test.ts` — updates the visible role-navigation expectation.
- `PROGRESS.md` — records each milestone, any command failure, and final verification evidence.

## Interfaces

The new Cashier transaction resource is:

```ts
type CashierTransaction = {
  type: "cashier_transaction"
  id: `enrollment_payment:${number}` | `account_payment:${number}`
  transaction_type: "enrollment_payment" | "account_payment"
  student_id: number
  student_name: string
  student_number: string
  enrollment_id: number
  amount: string
  processed_at: string
}
```

The new Cashier lookup resource is:

```ts
type CashierPaymentCandidate = {
  type: "cashier_payment_candidate"
  student_id: number
  student_name: string
  student_number: string
  year_level: number
  enrollment_id: number
  ticket: {
    id: number
    ticket_number: string
    status: "waiting" | "serving"
  }
}
```

The backend actions have these public signatures:

```php
public function execute(array $filters): LengthAwarePaginator;

public function execute(string $studentNumber): CashierPaymentCandidate;
```

`CashierPaymentCandidate` is a small readonly domain DTO carrying the loaded
`StudentProfile`, `Enrollment`, and `QueueTicket`, so the resource does not
make additional database queries.

### Task 1: Add the unified, read-only Cashier transaction API

**Files:**
- Create: `backend/app/Actions/Billing/ListCashierTransactions.php`
- Create: `backend/app/Http/Controllers/Api/V1/CashierTransactionController.php`
- Create: `backend/app/Http/Requests/Api/V1/CashierTransaction/IndexCashierTransactionRequest.php`
- Create: `backend/app/Http/Resources/Api/V1/CashierTransactionResource.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/Api/V1/CashierTransactionsEndpointTest.php`

**Consumes:** `Payment`, `AccountPayment`, `StudentProfile`, `User`, `PaymentPolicy`, and Laravel query-builder pagination.

**Produces:** `GET /api/v1/cashier-transactions?student_number={exact}&processed_on=YYYY-MM-DD&page=1&per_page=20`, returning a paginated `CashierTransaction` stream newest first.

- [ ] **Step 1: Write failing feature tests for the normalized stream**

```php
public function test_accounting_staff_sees_enrollment_and_account_payment_transactions_newest_first(): void
{
    [$student, $enrollmentPayment, $accountPayment] = $this->makePaymentHistory();

    $response = $this->withToken($this->accountingToken())
        ->getJson('/api/v1/cashier-transactions');

    $response->assertOk()->assertJsonPath('data.0.id', 'account_payment:'.$accountPayment->id);
    $response->assertJsonPath('data.0.transaction_type', 'account_payment');
    $response->assertJsonPath('data.1.id', 'enrollment_payment:'.$enrollmentPayment->id);
    $response->assertJsonPath('data.1.student_number', $student->student_number);
}

public function test_transaction_history_filters_by_exact_student_number_without_showing_other_students(): void
{
    [$target] = $this->makePaymentHistory(studentNumber: '2026-06-01001');
    $this->makePaymentHistory(studentNumber: '2026-06-01002');

    $this->withToken($this->accountingToken())
        ->getJson('/api/v1/cashier-transactions?student_number='.$target->student_number)
        ->assertOk()->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.student_number', $target->student_number);
}
```

Also assert unauthenticated `401`, Student and Registrar Staff `403`, Registrar Head `200`, exact `processed_on` filtering, exact top-level resource keys, and `Cache-Control: no-store, private`.

- [ ] **Step 2: Run the new test file and confirm RED**

Run: `php artisan test tests/Feature/Api/V1/CashierTransactionsEndpointTest.php`

Expected: FAIL because `/api/v1/cashier-transactions` has no route.

- [ ] **Step 3: Implement filter validation, union action, resource, controller, and route**

`IndexCashierTransactionRequest` accepts only these keys:

```php
return [
    'student_number' => ['sometimes', 'string', 'max:255'],
    'processed_on' => ['sometimes', 'date'],
    'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
    'page' => ['sometimes', 'integer', 'min:1'],
];
```

`ListCashierTransactions` uses two query-builder selects with identical aliases:

```php
$enrollmentPayments = DB::table('payments')
    ->join('enrollments', 'enrollments.id', '=', 'payments.enrollment_id')
    ->join('student_profiles', 'student_profiles.id', '=', 'enrollments.student_id')
    ->join('users', 'users.id', '=', 'student_profiles.user_id')
    ->selectRaw("CONCAT('enrollment_payment:', payments.id) as id")
    ->selectRaw("'enrollment_payment' as transaction_type")
    ->select('student_profiles.id as student_id', 'users.name as student_name', 'student_profiles.student_number', 'enrollments.id as enrollment_id', 'payments.amount', 'payments.confirmed_at as processed_at');
```

Build the matching `account_payments` select with `received_at as processed_at`, apply the exact student-number and date filter to both sources before `unionAll`, then call `DB::query()->fromSub($union, 'cashier_transactions')` and order by `processed_at` then `id` descending. `CashierTransactionResource` casts only display values and uses `processed_at` in UTC ISO-8601 format. The controller authenticates, authorizes `viewAny` against `Payment::class`, and sends the private no-store response. Register the route in the existing authenticated API group.

- [ ] **Step 4: Run the feature test to confirm GREEN**

Run: `php artisan test tests/Feature/Api/V1/CashierTransactionsEndpointTest.php`

Expected: PASS with both sources, filters, order, authorization, and cache behavior covered.

- [ ] **Step 5: Apply focused PHP quality checks**

Run:

```powershell
vendor\bin\pint --test app/Actions/Billing/ListCashierTransactions.php app/Http/Controllers/Api/V1/CashierTransactionController.php app/Http/Requests/Api/V1/CashierTransaction app/Http/Resources/Api/V1/CashierTransactionResource.php
vendor\bin\phpstan analyse app/Actions/Billing/ListCashierTransactions.php app/Http/Controllers/Api/V1/CashierTransactionController.php app/Http/Requests/Api/V1/CashierTransaction app/Http/Resources/Api/V1/CashierTransactionResource.php --memory-limit=1G
```

Expected: both exit `0`.

### Task 2: Add queue-safe Cashier student-number lookup

**Files:**
- Create: `backend/app/Domain/Billing/CashierPaymentCandidate.php`
- Create: `backend/app/Actions/Billing/FindCashierPaymentCandidate.php`
- Create: `backend/app/Http/Controllers/Api/V1/CashierPaymentCandidateController.php`
- Create: `backend/app/Http/Requests/Api/V1/CashierPaymentCandidate/ShowCashierPaymentCandidateRequest.php`
- Create: `backend/app/Http/Resources/Api/V1/CashierPaymentCandidateResource.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/Api/V1/CashierPaymentCandidateEndpointTest.php`

**Consumes:** current `AcademicTermStatus::SemesterOngoing`, `EnrollmentStatus::PendingPayment`, today’s queue date, `QueueTicketStatus`, `QueueTicketPolicy`, and the existing queue ticket transition route.

**Produces:** `GET /api/v1/cashier-payment-candidates?student_number={exact}`, with no write side effect.

- [ ] **Step 1: Write failing lookup endpoint tests**

```php
public function test_accounting_staff_can_find_a_waiting_current_term_candidate_without_changing_the_ticket(): void
{
    [$student, $enrollment, $ticket] = $this->makeEligibleCandidate('2026-06-01001');

    $response = $this->withToken($this->accountingToken())
        ->getJson('/api/v1/cashier-payment-candidates?student_number='.$student->student_number);

    $response->assertOk()->assertJsonPath('data.enrollment_id', $enrollment->id);
    $response->assertJsonPath('data.ticket.id', $ticket->id);
    $response->assertJsonPath('data.ticket.status', 'waiting');
    self::assertSame('waiting', $ticket->fresh()->status->value);
}

public function test_lookup_does_not_return_a_completed_or_other_day_ticket(): void
{
    $student = $this->makeIneligibleCandidate(status: QueueTicketStatus::Served);

    $this->withToken($this->accountingToken())
        ->getJson('/api/v1/cashier-payment-candidates?student_number='.$student->student_number)
        ->assertNotFound();
}
```

Use `Carbon::setTestNow()` for the current-day condition. Also cover an already-serving matching ticket (`200`), a non-`pending_payment` enrollment (`404`), unknown number (`404`), missing parameter (`422`), Student/Registrar Head (`403`), and no payment, audit, document, enrollment, or queue mutation from a successful lookup.

- [ ] **Step 2: Run the lookup test file and confirm RED**

Run: `php artisan test tests/Feature/Api/V1/CashierPaymentCandidateEndpointTest.php`

Expected: FAIL because the lookup route does not exist.

- [ ] **Step 3: Implement the DTO, exact lookup action, request, resource, controller, and route**

The request requires one trimmed input:

```php
return ['student_number' => ['required', 'string', 'max:255']];
```

The action resolves the one `semester_ongoing` term, then loads only a matching Student with `user`, a `pending_payment` enrollment in that term, and a related ticket for `today()` whose status is `waiting` or `serving`. It throws `ModelNotFoundException` for every missing/ineligible combination. The resource returns exactly the `CashierPaymentCandidate` contract declared above. The controller authenticates, authorizes `viewAny` for `QueueTicket::class`, and sets `Cache-Control: no-store, private`; it does not call a transition Action. Register it inside the authenticated v1 route group.

- [ ] **Step 4: Run the lookup tests to confirm GREEN**

Run: `php artisan test tests/Feature/Api/V1/CashierPaymentCandidateEndpointTest.php`

Expected: PASS; lookups are exact, Accounting-only, current-term/current-day scoped, and non-mutating.

- [ ] **Step 5: Apply focused PHP quality checks**

Run:

```powershell
vendor\bin\pint --test app/Domain/Billing/CashierPaymentCandidate.php app/Actions/Billing/FindCashierPaymentCandidate.php app/Http/Controllers/Api/V1/CashierPaymentCandidateController.php app/Http/Requests/Api/V1/CashierPaymentCandidate app/Http/Resources/Api/V1/CashierPaymentCandidateResource.php
vendor\bin\phpstan analyse app/Domain/Billing/CashierPaymentCandidate.php app/Actions/Billing/FindCashierPaymentCandidate.php app/Http/Controllers/Api/V1/CashierPaymentCandidateController.php app/Http/Requests/Api/V1/CashierPaymentCandidate app/Http/Resources/Api/V1/CashierPaymentCandidateResource.php --memory-limit=1G
```

Expected: both exit `0`.

### Task 3: Add strict frontend contracts and TanStack Query clients

**Files:**
- Create: `frontend/src/features/schemas/cashier-transaction-schema.ts`
- Create: `frontend/src/features/services/cashier-transaction-service.ts`
- Create: `frontend/src/features/services/cashier-transaction-service.test.ts`
- Create: `frontend/src/features/hooks/use-cashier-transactions.ts`

**Consumes:** `getAuthenticatedJson`, `ApiClientError`, the API resource contracts from Tasks 1 and 2, and the authenticated session user ID.

**Produces:** `listCashierTransactions(filters, signal)`, `findCashierPaymentCandidate(studentNumber, signal)`, `useCashierTransactionsQuery`, and `useCashierPaymentCandidateQuery`.

- [ ] **Step 1: Write failing strict service tests**

```ts
it("requests the exact student-number transaction filter and parses both transaction types", async () => {
  fetchMock.mockResolvedValue(jsonResponse({ data: [enrollmentTransaction, accountTransaction], links, meta }))

  await expect(listCashierTransactions({ student_number: "2026-06-01001" })).resolves.toHaveLength(2)
  expect(requestUrl()).toContain("student_number=2026-06-01001")
})

it("rejects a lookup response that exposes an undeclared field", async () => {
  fetchMock.mockResolvedValue(jsonResponse({ data: { ...candidate, email: "private@grc.test" } }))

  await expect(findCashierPaymentCandidate("2026-06-01001")).rejects.toMatchObject({ kind: "contract" })
})
```

Add tests for date serialization, source-qualified IDs, the exact lookup query, and malformed list/lookup API envelopes.

- [ ] **Step 2: Run the service test and confirm RED**

Run: `pnpm vitest run src/features/services/cashier-transaction-service.test.ts`

Expected: FAIL because the contract and service modules do not exist.

- [ ] **Step 3: Implement Zod schemas, authenticated services, and hooks**

Use strict Zod objects with these transaction fields:

```ts
id: z.string().regex(/^(enrollment_payment|account_payment):\d+$/),
transaction_type: z.enum(["enrollment_payment", "account_payment"]),
student_id: z.number().int().positive(),
student_name: z.string().min(1),
student_number: z.string().min(1),
enrollment_id: z.number().int().positive(),
amount: z.string().regex(/^\d+\.\d{2}$/),
processed_at: z.iso.datetime(),
```

Make the list query key `['cashier-transactions', userId, filters]` and the lookup key `['cashier-payment-candidate', userId, studentNumber]`. The lookup query is disabled until a nonempty submitted number is supplied; no query runs while the Cashier types.

- [ ] **Step 4: Run the service test to confirm GREEN**

Run: `pnpm vitest run src/features/services/cashier-transaction-service.test.ts`

Expected: PASS with strict contract validation and exact URL coverage.

- [ ] **Step 5: Run frontend static checks for the new modules**

Run:

```powershell
pnpm exec eslint src/features/schemas/cashier-transaction-schema.ts src/features/services/cashier-transaction-service.ts src/features/services/cashier-transaction-service.test.ts src/features/hooks/use-cashier-transactions.ts
pnpm exec prettier --check src/features/schemas/cashier-transaction-schema.ts src/features/services/cashier-transaction-service.ts src/features/services/cashier-transaction-service.test.ts src/features/hooks/use-cashier-transactions.ts
```

Expected: both exit `0`.

### Task 4: Implement Transaction History navigation and Cashier payment-state/search UI

**Files:**
- Modify: `frontend/src/features/components/portal/payment-records-workspace.tsx`
- Modify: `frontend/src/features/components/portal/payment-records-workspace.test.tsx`
- Modify: `frontend/src/features/components/portal/accounting-payment-workspace.tsx`
- Modify: `frontend/src/features/components/portal/accounting-payment-workspace.test.tsx`
- Modify: `frontend/src/features/portal/role-capabilities.ts`
- Modify: `frontend/src/features/portal/role-capabilities.test.ts`

**Consumes:** Task 3 hooks/contracts and existing `useUpdateQueueTicketMutation`, `useConfirmPaymentMutation`, `DataTable`, `AsyncBoundary`, `WorkspacePage`, `Button`, `Field`, and `Input`.

**Produces:** a visible Cashier **Transaction History** navigation item, a unified history table, a non-mutating Find Student form, and an outer confirmation button that becomes disabled for the successfully processed ticket.

- [ ] **Step 1: Write failing Transaction History UI tests**

```tsx
it("shows enrollment and balance transactions with student context and exact-number filtering", async () => {
  renderWithSession(<PaymentRecordsWorkspace />, { session: accountingSession })

  const table = await screen.findByRole("table", { name: "Transaction history" })
  expect(within(table).getByText("Enrollment payment")).toBeInTheDocument()
  expect(within(table).getByText("Balance payment")).toBeInTheDocument()
  expect(within(table).getByText("Maria Santos")).toBeInTheDocument()

  await user.type(screen.getByLabelText("Student number"), "2026-06-01001")
  await user.keyboard("{Enter}")
  expect(lastRequestUrl()).toContain("student_number=2026-06-01001")
})
```

Update role-capability expectations to assert the visible `Transaction History` label for Accounting Staff while preserving the existing `payment-records` module ID. Retain Registrar Head history access and the accessibility assertion.

- [ ] **Step 2: Write failing Payment Queue UI tests**

```tsx
it("disables the outer confirmation action immediately after the same serving enrollment is confirmed", async () => {
  renderWithSession(<AccountingPaymentWorkspace />, { session: accountingSession })
  await user.click(await screen.findByRole("button", { name: "Confirm payment" }))
  await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Confirm payment" }))

  expect(await screen.findByRole("button", { name: "Payment processed" })).toBeDisabled()
})

it("looks up a waiting student by number and serves that existing ticket only when nobody else is serving", async () => {
  renderWithSession(<AccountingPaymentWorkspace />, { session: accountingSession })
  await user.type(screen.getByLabelText("Student number"), "2026-06-01002")
  await user.keyboard("{Enter}")
  await user.click(await screen.findByRole("button", { name: "Serve selected student" }))

  expect(queuePatchBody()).toEqual({ action: "serve" })
})
```

Add a case where another ticket is serving: the matching candidate is shown with the instruction to skip the active ticket first, the selected serve button is absent, and no queue patch occurs. Add cases for lookup not found, already-serving matching candidate, and a disabled action while the confirmation mutation is pending.

- [ ] **Step 3: Run the two component test files and confirm RED**

Run:

```powershell
pnpm vitest run src/features/components/portal/payment-records-workspace.test.tsx src/features/components/portal/accounting-payment-workspace.test.tsx src/features/portal/role-capabilities.test.ts
```

Expected: FAIL because Transaction History is still backed by `/payments`, the new controls do not exist, and post-success outer confirmation remains enabled.

- [ ] **Step 4: Implement Transaction History presentation**

Change the existing visible module label and workspace heading/description from Payment Records to Transaction History, but retain module ID `payment-records`. Replace `usePaymentsQuery` with `useCashierTransactionsQuery`. Add a student-number field inside an explicit `<form onSubmit>` that sets a submitted filter state, keep date filter and paginator reset behavior, and render these DataTable columns:

```tsx
{ key: "student", header: "Student", render: (row) => `${row.student_name} · ${row.student_number}` },
{ key: "type", header: "Type", render: (row) => row.transaction_type === "enrollment_payment" ? "Enrollment payment" : "Balance payment" },
{ key: "enrollment", header: "Enrollment", render: (row) => `#${row.enrollment_id}` },
{ key: "amount", header: "Amount", render: (row) => `₱${row.amount}` },
{ key: "processed_at", header: "Processed at", render: (row) => new Date(row.processed_at).toLocaleString() },
```

Use the same data in responsive `renderCard`, with an accessible caption `Transaction history`.

- [ ] **Step 5: Implement the Payment Queue state and lookup controls**

Store only the confirmed enrollment ID and derive whether the current card is processed:

```tsx
const [processedEnrollmentId, setProcessedEnrollmentId] = useState<number | null>(null)
const isCurrentEnrollmentProcessed = processedEnrollmentId === nowServingEnrollment?.id
const confirmDisabled = paymentMutation.isPending || nowServingEnrollment === undefined || isCurrentEnrollmentProcessed
```

On successful confirmation, set `processedEnrollmentId` to `result.enrollment.id`. Guard `openConfirm` with `if (confirmDisabled) return`, disable its outer button with `confirmDisabled`, and render `Payment processed` when true. This state automatically permits a different subsequently served enrollment while keeping the completed ticket greyed out.

Add a `Find student` form above Now Serving with local draft and submitted student-number state. Render the candidate name, number, year, and ticket after a successful lookup. If its ticket is already `serving`, show it as the active context. If it is `waiting` and no `nowServing` ticket exists, render **Serve selected student**, calling the established `ticketMutation.mutate({ id: candidate.ticket.id, action: "serve" })`. If another ticket is serving, render the existing-ticket number and `Skip the current ticket before serving this student.` without a selected-serve button. On lookup errors, show `No eligible payment-queue record was found for that student number.`

- [ ] **Step 6: Run the component tests to confirm GREEN**

Run:

```powershell
pnpm vitest run src/features/components/portal/payment-records-workspace.test.tsx src/features/components/portal/accounting-payment-workspace.test.tsx src/features/portal/role-capabilities.test.ts
```

Expected: PASS with disabled-confirmation, queue-safe lookup, unified history, role visibility, and accessibility coverage.

### Task 5: Integrate, verify, and record the result

**Files:**
- Modify: `PROGRESS.md`
- Test: `backend/tests/Feature/Api/V1/CashierTransactionsEndpointTest.php`
- Test: `backend/tests/Feature/Api/V1/CashierPaymentCandidateEndpointTest.php`
- Test: `frontend/src/features/services/cashier-transaction-service.test.ts`
- Test: `frontend/src/features/components/portal/payment-records-workspace.test.tsx`
- Test: `frontend/src/features/components/portal/accounting-payment-workspace.test.tsx`

**Consumes:** completed Tasks 1–4.

**Produces:** verified backend/API/frontend behavior, up-to-date progress evidence, and a clean diff check.

- [ ] **Step 1: Run focused backend feature suites**

Run:

```powershell
php artisan test tests/Feature/Api/V1/CashierTransactionsEndpointTest.php tests/Feature/Api/V1/CashierPaymentCandidateEndpointTest.php tests/Feature/Api/V1/PaymentsEndpointTest.php tests/Feature/Api/V1/PaymentConfirmationEndpointTest.php tests/Feature/Api/V1/QueueTicketsEndpointTest.php
```

Expected: PASS, proving the new APIs work without regressing legacy payment history, payment confirmation, or queue transitions.

- [ ] **Step 2: Run focused frontend, TypeScript, lint, and formatting checks**

Run:

```powershell
pnpm vitest run src/features/services/cashier-transaction-service.test.ts src/features/components/portal/payment-records-workspace.test.tsx src/features/components/portal/accounting-payment-workspace.test.tsx src/features/portal/role-capabilities.test.ts
pnpm typecheck
pnpm exec eslint src/features/components/portal/payment-records-workspace.tsx src/features/components/portal/payment-records-workspace.test.tsx src/features/components/portal/accounting-payment-workspace.tsx src/features/components/portal/accounting-payment-workspace.test.tsx src/features/portal/role-capabilities.ts src/features/portal/role-capabilities.test.ts src/features/schemas/cashier-transaction-schema.ts src/features/services/cashier-transaction-service.ts src/features/services/cashier-transaction-service.test.ts src/features/hooks/use-cashier-transactions.ts
pnpm exec prettier --check src/features/components/portal/payment-records-workspace.tsx src/features/components/portal/payment-records-workspace.test.tsx src/features/components/portal/accounting-payment-workspace.tsx src/features/components/portal/accounting-payment-workspace.test.tsx src/features/portal/role-capabilities.ts src/features/portal/role-capabilities.test.ts src/features/schemas/cashier-transaction-schema.ts src/features/services/cashier-transaction-service.ts src/features/services/cashier-transaction-service.test.ts src/features/hooks/use-cashier-transactions.ts
```

Expected: all commands exit `0`; known non-failing jsdom canvas warnings may appear without causing a failure.

- [ ] **Step 3: Run final backend static checks and diff validation**

Run:

```powershell
vendor\bin\pint --test app/Actions/Billing/ListCashierTransactions.php app/Actions/Billing/FindCashierPaymentCandidate.php app/Domain/Billing/CashierPaymentCandidate.php app/Http/Controllers/Api/V1/CashierTransactionController.php app/Http/Controllers/Api/V1/CashierPaymentCandidateController.php app/Http/Requests/Api/V1/CashierTransaction app/Http/Requests/Api/V1/CashierPaymentCandidate app/Http/Resources/Api/V1/CashierTransactionResource.php app/Http/Resources/Api/V1/CashierPaymentCandidateResource.php
vendor\bin\phpstan analyse app/Actions/Billing/ListCashierTransactions.php app/Actions/Billing/FindCashierPaymentCandidate.php app/Domain/Billing/CashierPaymentCandidate.php app/Http/Controllers/Api/V1/CashierTransactionController.php app/Http/Controllers/Api/V1/CashierPaymentCandidateController.php app/Http/Requests/Api/V1/CashierTransaction app/Http/Requests/Api/V1/CashierPaymentCandidate app/Http/Resources/Api/V1/CashierTransactionResource.php app/Http/Resources/Api/V1/CashierPaymentCandidateResource.php --memory-limit=1G
git diff --check
```

Expected: all commands exit `0`.

- [ ] **Step 4: Update progress and hand off without a commit**

Append the exact passing test counts, command output summaries, any known non-failing warnings, and the fact that no commit or push was made to `PROGRESS.md`. Do not alter unrelated dirty-worktree files or make a GitHub saving point unless the user explicitly authorizes it after reviewing the completed changes.

## Plan self-review

- Spec coverage: Task 1 implements the unified history; Task 2 implements exact, queue-safe lookup; Tasks 3–4 implement the strict contracts, visible navigation, post-confirmation disabled state, and search behavior; Task 5 verifies every stated requirement.
- Placeholder scan: the required scan produced no unfilled marker, vague validation instruction, or unbound interface. Every test step names the relevant command and expected failure/pass condition.
- Type consistency: the transaction and candidate types declared above are used by the backend resource, frontend Zod contract, service functions, hooks, and UI tasks with the same field names and source-qualified ID format.
