# Student Account Balance and Partial Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show accurate cross-term Student account balances to Students and Accounting Staff, allow a PHP 1,000.00-or-more enrollment payment to finalize enrollment/COM, and accept smaller payments against the oldest outstanding balance without removing a skipped queue ticket.

**Architecture:** Preserve the existing idempotent one-row `payments` record for an enrollment confirmation and add a separate `account_payments` ledger for later payments against existing balances. A single Billing-domain summary service derives exact decimal balances from active assessments, confirmation payments, and allocated account payments. Role-specific API resources expose that summary to the Student's own portal and the Accounting payment queue; React hooks consume only service-module API calls.

**Tech Stack:** Laravel 12, PHP 8.4, Sanctum bearer auth, Form Requests, Policies, Eloquent, database transactions/migrations, PHPUnit; React 19 strict TypeScript, TanStack Query, Zod, Tailwind CSS, shadcn/ui, Vitest.

## Global Constraints

- Work in the existing `main` checkout; do not create a worktree, commit, or push unless the user explicitly requests a GitHub saving point.
- Read all of `PRD.md` and `PROGRESS.md` before implementation; update `PROGRESS.md` before this substantial slice, after each milestone/failure, and before handoff.
- Keep the existing `payments.enrollment_id` uniqueness constraint and confirmation idempotency behavior intact.
- Every monetary value remains an exact decimal string in PHP and uses `bcmath`; never use binary float arithmetic for balances.
- An explicit enrollment-confirmation payment must be at least `1000.00`; an omitted amount keeps the existing assessed-total default.
- Account payments must be positive, cannot exceed the outstanding balance, and are allocated server-side oldest-first across outstanding nonterminal enrollments.
- Exclude `rejected`, `cancelled`, and `withdrawn` enrollments from account-balance calculations. “Voided” uses the existing cancelled transition.
- The promissory note is a boolean operational indicator only. Do not capture a file, due date, or any additional institutional policy.
- Preserve least-privilege access: Student sees only their own account; Accounting Staff alone reads cashier account context and records account payments.
- Queue skip remains `waiting|serving -> waiting` with a `requeued_at` timestamp. No payment-related operation may mutate queue-ticket state.

---

### Task 1: Persist balance-payment allocations and promissory-note state

**Files:**
- Create: `backend/database/migrations/2026_08_14_000001_add_promissory_note_on_file_to_payments_table.php`
- Create: `backend/database/migrations/2026_08_14_000002_create_account_payments_table.php`
- Create: `backend/app/Models/AccountPayment.php`
- Modify: `backend/app/Models/Payment.php`
- Modify: `backend/app/Models/Enrollment.php`
- Modify: `backend/app/Models/StudentProfile.php`
- Modify: `backend/app/Domain/Audit/AuditAction.php`
- Modify: `backend/tests/Feature/Database/EnrollmentRecordsMigrationTest.php`
- Test: `backend/tests/Unit/Models/AccountPaymentTest.php`

**Interfaces:**
- Produces `AccountPayment` with `student_id:int`, `enrollment_id:int`, `received_by:int`, `amount:numeric-string`, and `received_at:CarbonImmutable`.
- Produces `Enrollment::accountPayments(): HasMany` and `StudentProfile::accountPayments(): HasMany`.
- Produces `Payment::$promissory_note_on_file:bool` and `AuditAction::ACCOUNT_PAYMENT_RECORDED`.

- [ ] **Step 1: Write the failing model and migration-contract tests**

```php
public function test_account_payment_preserves_an_exact_decimal_and_its_allocation(): void
{
    $payment = new AccountPayment;
    $payment->forceFill([
        'student_id' => 1,
        'enrollment_id' => 2,
        'received_by' => 3,
        'amount' => '500.00',
        'received_at' => now(),
    ]);

    self::assertSame('500.00', $payment->amount);
    self::assertInstanceOf(CarbonImmutable::class, $payment->received_at);
}

public function test_account_payment_and_promissory_note_columns_exist(): void
{
    $this->assertTrue(Schema::hasColumns('payments', ['promissory_note_on_file']));
    $this->assertTrue(Schema::hasColumns('account_payments', [
        'id', 'student_id', 'enrollment_id', 'received_by', 'amount', 'received_at',
    ]));
}
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
php artisan test --filter='(AccountPaymentTest|EnrollmentRecordsMigrationTest)'
```

Expected: failure because the model/table/column do not exist.

- [ ] **Step 3: Add reversible schema and relationships**

```php
Schema::table('payments', function (Blueprint $table) {
    $table->boolean('promissory_note_on_file')->default(false)->after('amount');
});

Schema::create('account_payments', function (Blueprint $table) {
    $table->id();
    $table->foreignId('student_id')->constrained('student_profiles')->cascadeOnDelete();
    $table->foreignId('enrollment_id')->constrained()->restrictOnDelete();
    $table->foreignId('received_by')->constrained('users')->restrictOnDelete();
    $table->decimal('amount', 10, 2);
    $table->timestamp('received_at');
    $table->timestamps();
    $table->index(['student_id', 'received_at']);
    $table->index('enrollment_id');
});
```

Use `immutable_datetime` for `received_at`; intentionally do not cast `amount` to float. Add inverse `belongsTo` relationships and add `ACCOUNT_PAYMENT_RECORDED` to `AuditAction::values()`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```powershell
php artisan test --filter='(AccountPaymentTest|EnrollmentRecordsMigrationTest)'
```

Expected: PASS.

- [ ] **Step 5: Record the milestone in `PROGRESS.md`**

State the exact test count/output and that migrations are reversible. Do not commit.

---

### Task 2: Build exact, reusable Student-account balance summaries

**Files:**
- Create: `backend/app/Domain/Billing/StudentAccountBalance.php`
- Create: `backend/app/Domain/Billing/StudentAccountBalanceEntry.php`
- Create: `backend/app/Actions/Billing/BuildStudentAccountBalance.php`
- Modify: `backend/app/Models/Enrollment.php`
- Test: `backend/tests/Unit/Actions/Billing/BuildStudentAccountBalanceTest.php`

**Interfaces:**
- Produces `BuildStudentAccountBalance::execute(StudentProfile $student): StudentAccountBalance`.
- `StudentAccountBalance` contains exact-decimal `total_assessed`, `total_paid`, `outstanding_balance`, `prior_balance`, `has_promissory_note_on_file`, and a chronological list of `StudentAccountBalanceEntry` records.
- Every entry contains `enrollment_id`, `academic_term_id`, `academic_term_label`, `assessment_amount`, `confirmed_payment_amount`, `account_payment_amount`, `outstanding_balance`, and `promissory_note_on_file`.

- [ ] **Step 1: Write failing unit tests for calculation and terminal-state exclusion**

```php
public function test_it_sums_prior_and_current_assessments_less_all_payments(): void
{
    [$student, $prior, $current] = $this->studentWithTwoAssessedEnrollments();
    Payment::create([...$this->confirmedPayment($prior, '1000.00')]);
    AccountPayment::create([...$this->accountPayment($student, $prior, '500.00')]);

    $balance = app(BuildStudentAccountBalance::class)->execute($student);

    self::assertSame('6500.00', $balance->totalAssessed);
    self::assertSame('1500.00', $balance->totalPaid);
    self::assertSame('5000.00', $balance->outstandingBalance);
    self::assertSame('3500.00', $balance->priorBalance);
}

public function test_it_excludes_cancelled_rejected_and_withdrawn_assessments(): void
{
    $student = $this->studentWithTerminalAssessedEnrollments();

    $balance = app(BuildStudentAccountBalance::class)->execute($student);

    self::assertSame('0.00', $balance->outstandingBalance);
    self::assertSame([], $balance->entries);
}
```

- [ ] **Step 2: Run the unit test and verify RED**

Run:

```powershell
php artisan test tests/Unit/Actions/Billing/BuildStudentAccountBalanceTest.php
```

Expected: failure because the summary types/action do not exist.

- [ ] **Step 3: Implement the value objects and summary action with `bcmath`**

Load only the Student's nonterminal enrollments that have assessments, including `academicTerm`, `assessment`, `payment`, and `accountPayments`. Order oldest-to-newest by `academic_terms.starts_at`, falling back to assessment time then enrollment id. Compute each entry using `bcadd`, `bcsub`, and `bccomp`; omit zero-balance entries from the returned outstanding list and never return a negative balance. Existing historical overpayments are displayed as a zero outstanding balance rather than being mutated or rejected by a read operation.

```php
$confirmed = $enrollment->payment?->amount ?? '0.00';
$accountPaid = $enrollment->accountPayments
    ->reduce(fn (string $sum, AccountPayment $payment): string => bcadd($sum, $payment->amount, 2), '0.00');
$outstanding = bcsub($enrollment->assessment->total_amount, bcadd($confirmed, $accountPaid, 2), 2);
```

Reject an internal invariant violation rather than silently outputting a negative balance. Flag `promissory_note_on_file` only when that enrollment still has a positive balance and its confirmation payment is marked.

- [ ] **Step 4: Run the unit test and verify GREEN**

Run:

```powershell
php artisan test tests/Unit/Actions/Billing/BuildStudentAccountBalanceTest.php
```

Expected: PASS, including exact decimal outputs and terminal-status exclusion.

- [ ] **Step 5: Record the milestone in `PROGRESS.md`**

Document the summary's excluded statuses and exact-money arithmetic. Do not commit.

---

### Task 3: Expose authorized account summaries and record oldest-balance payments

**Files:**
- Create: `backend/app/Actions/Billing/RecordAccountPayment.php`
- Create: `backend/app/Http/Controllers/Api/V1/StudentAccountController.php`
- Create: `backend/app/Http/Requests/Api/V1/StudentAccount/StoreAccountPaymentRequest.php`
- Create: `backend/app/Http/Resources/Api/V1/StudentAccountResource.php`
- Modify: `backend/app/Policies/StudentProfilePolicy.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/app/Models/StudentProfile.php`
- Test: `backend/tests/Feature/Api/V1/StudentAccountEndpointTest.php`

**Interfaces:**
- `GET /api/v1/student-account` returns the authenticated Student's own `StudentAccountResource`.
- `GET /api/v1/students/{student}/account` is Accounting Staff-only and returns the requested Student's `StudentAccountResource`.
- `POST /api/v1/students/{student}/account-payments` is Accounting Staff-only and accepts `{ amount: number }`; response is the refreshed account resource with `201`.
- `RecordAccountPayment::execute(StudentProfile $student, string $amount, User $actor, AuditRequestContext $context): StudentAccountBalance`.

- [ ] **Step 1: Write failing feature tests for authorization, summary visibility, and oldest allocation**

```php
public function test_a_student_can_read_only_their_own_account_summary(): void
{
    [$student, $otherStudent] = $this->studentsWithBalances();

    $response = $this->withToken($this->tokenFor($student->user))
        ->getJson('/api/v1/student-account');

    $response->assertOk()
        ->assertJsonPath('data.student_number', $student->student_number)
        ->assertJsonPath('data.outstanding_balance', '3500.00');
    $this->withToken($this->tokenFor($student->user))
        ->getJson("/api/v1/students/{$otherStudent->id}/account")
        ->assertForbidden();
}

public function test_accounting_payment_of_500_is_allocated_to_the_oldest_outstanding_enrollment(): void
{
    [$student, $oldest, $newer] = $this->studentWithTwoOutstandingEnrollments();

    $response = $this->withToken($this->accountingToken())
        ->postJson("/api/v1/students/{$student->id}/account-payments", ['amount' => 500]);

    $response->assertCreated()->assertJsonPath('data.outstanding_balance', '6500.00');
    $this->assertDatabaseHas('account_payments', [
        'student_id' => $student->id,
        'enrollment_id' => $oldest->id,
        'amount' => '500.00',
    ]);
    $this->assertDatabaseMissing('account_payments', ['enrollment_id' => $newer->id]);
}
```

Also add cases that reject an unauthorized role, zero/negative amount, excess amount, and a Student with no outstanding active balance. Assert `Cache-Control: no-store, private` for both summary GET endpoints. Assert the account-payment write creates exactly one `ACCOUNT_PAYMENT_RECORDED` audit record and leaves all queue-ticket columns unchanged.

- [ ] **Step 2: Run the feature test and verify RED**

Run:

```powershell
php artisan test tests/Feature/Api/V1/StudentAccountEndpointTest.php
```

Expected: `404`/missing-class failures because routes, policy, and action do not exist.

- [ ] **Step 3: Implement resource, policy, controller, request, and transactional action**

Add narrowly named `viewAccount` and `recordAccountPayment` abilities to
`StudentProfilePolicy`; leave its existing general `view` ability unchanged.
`viewAccount` permits a Student only for their own profile and Accounting Staff
for an account context; `recordAccountPayment` permits Accounting Staff only.
The controller must explicitly authorize these abilities on the routed
`StudentProfile`, so no general Student-profile endpoint gains broader access.

`StudentAccountResource` must return a strict, role-safe summary:

```php
[
    'type' => 'student_account',
    'student_id' => $student->id,
    'student_name' => $student->user->name,
    'student_number' => $student->student_number,
    'year_level' => $student->year_level,
    'currency' => 'PHP',
    'total_assessed' => $balance->totalAssessed,
    'total_paid' => $balance->totalPaid,
    'prior_balance' => $balance->priorBalance,
    'outstanding_balance' => $balance->outstandingBalance,
    'has_promissory_note_on_file' => $balance->hasPromissoryNoteOnFile,
    'entries' => [...],
]
```

Inside `RecordAccountPayment`, start a database transaction, lock the Student profile to serialize Cashier receipts, recompute active balances, reject values greater than the total balance, and create one `AccountPayment` allocation per enrollment as needed in oldest-first order. Record one audit event for the receipt and return a fresh summary. Do not load or update any `QueueTicket`.

- [ ] **Step 4: Run the feature test and verify GREEN**

Run:

```powershell
php artisan test tests/Feature/Api/V1/StudentAccountEndpointTest.php
```

Expected: PASS.

- [ ] **Step 5: Record the milestone in `PROGRESS.md`**

State the policy boundary and database transaction/oldest-allocation coverage. Do not commit.

---

### Task 4: Enforce the enrollment-payment minimum and persist the promissory-note indicator

**Files:**
- Modify: `backend/app/Http/Requests/Api/V1/Enrollment/ConfirmPaymentRequest.php`
- Modify: `backend/app/Actions/Enrollment/ConfirmPayment.php`
- Modify: `backend/app/Http/Resources/Api/V1/PaymentConfirmationResource.php`
- Modify: `backend/tests/Feature/Api/V1/PaymentConfirmationEndpointTest.php`

**Interfaces:**
- Confirmation request supports `promissory_note_on_file: bool`.
- For a new confirmation, supplied `amount` validates as `numeric|between:1000,99999999.99`; an omitted amount still defaults to assessment total/null as existing behavior specifies.
- Payment-confirmation response includes `promissory_note_on_file`.

- [ ] **Step 1: Add failing confirmation regressions**

```php
public function test_an_explicit_enrollment_payment_below_1000_is_rejected_without_side_effects(): void
{
    $enrollment = $this->pendingPaymentEnrollmentWithAssessment('2400.00');

    $response = $this->withToken($this->accountingToken())
        ->postJson("/api/v1/enrollments/{$enrollment->id}/payment", ['amount' => 999.99]);

    $response->assertUnprocessable()->assertJsonValidationErrors('amount');
    $this->assertDatabaseCount('payments', 0);
    $this->assertDatabaseCount('enrollment_documents', 0);
    self::assertSame(EnrollmentStatus::PendingPayment, $enrollment->refresh()->status);
}

public function test_a_1000_enrollment_payment_with_a_promissory_note_finalizes_and_retains_the_balance(): void
{
    $enrollment = $this->pendingPaymentEnrollmentWithAssessment('2400.00');

    $response = $this->withToken($this->accountingToken())
        ->postJson("/api/v1/enrollments/{$enrollment->id}/payment", [
            'amount' => 1000,
            'promissory_note_on_file' => true,
        ]);

    $response->assertCreated()
        ->assertJsonPath('data.enrollment.status', 'enrolled')
        ->assertJsonPath('data.payment.promissory_note_on_file', true)
        ->assertJsonPath('data.document.document_type', 'com');
    $this->assertDatabaseHas('payments', [
        'enrollment_id' => $enrollment->id,
        'amount' => '1000.00',
        'promissory_note_on_file' => true,
    ]);
}
```

Add a repeat-confirmation assertion proving the stored promissory flag and existing document return unchanged.

- [ ] **Step 2: Run the payment endpoint suite and verify RED**

Run:

```powershell
php artisan test tests/Feature/Api/V1/PaymentConfirmationEndpointTest.php
```

Expected: the below-minimum request is accepted and the new flag is absent.

- [ ] **Step 3: Implement the validation and persistence change**

Keep `amount` optional. Apply the PHP 1,000.00 floor only when `amount` is supplied; preserve the existing omitted-amount fallback. Persist `$validated['promissory_note_on_file'] ?? false` only on the first idempotent confirmation. Add the field to the payment-confirmation resource; the dedicated account-summary action reads the persisted payment relationship directly.

- [ ] **Step 4: Run the payment and enrollment endpoint suites and verify GREEN**

Run:

```powershell
php artisan test --filter='(PaymentConfirmationEndpointTest|EnrollmentsEndpointTest)'
```

Expected: PASS, including the existing idempotency contract.

- [ ] **Step 5: Record the milestone in `PROGRESS.md`**

Record the exact threshold behavior and confirmation idempotency result. Do not commit.

---

### Task 5: Add typed client services, Cashier account context, and payment actions

**Files:**
- Create: `frontend/src/features/schemas/student-account-schema.ts`
- Create: `frontend/src/features/services/student-account-service.ts`
- Create: `frontend/src/features/services/student-account-service.test.ts`
- Create: `frontend/src/features/hooks/use-student-account.ts`
- Modify: `frontend/src/features/schemas/enrollment-schema.ts`
- Modify: `frontend/src/features/services/enrollment-service.ts`
- Modify: `frontend/src/features/hooks/use-enrollment.ts`
- Modify: `frontend/src/features/components/portal/accounting-payment-workspace.tsx`
- Modify: `frontend/src/features/components/portal/accounting-payment-workspace.test.tsx`

**Interfaces:**
- `StudentAccount` Zod resource has exact money-string totals, `entries`, and `has_promissory_note_on_file`.
- `getOwnStudentAccount(signal?)`, `getStudentAccount(studentId, signal?)`, and `recordStudentAccountPayment(studentId, { amount })` live only in the service module.
- `useOwnStudentAccountQuery()`, `useStudentAccountQuery(studentId, options)`, and `useRecordStudentAccountPaymentMutation()` encapsulate TanStack Query caching/invalidation.
- `useConfirmPaymentMutation()` accepts optional `promissoryNoteOnFile` and sends `promissory_note_on_file`.

- [ ] **Step 1: Write failing service and Cashier UI tests**

```tsx
it("shows a serving student's cross-term balance and promissory-note state", async () => {
  fetchMock.mockImplementation(routesWithAccount({
    student_name: "Maria Santos",
    student_number: "2026-0001",
    year_level: 3,
    prior_balance: "3500.00",
    outstanding_balance: "4900.00",
    has_promissory_note_on_file: true,
  }))

  renderWithSession(<AccountingPaymentWorkspace />, { session: accountingSession })

  expect(await screen.findByText("Maria Santos")).toBeInTheDocument()
  expect(screen.getByText("Prior balance")).toBeInTheDocument()
  expect(screen.getByText("₱3,500.00")).toBeInTheDocument()
  expect(screen.getByText("Promissory note on file")).toBeInTheDocument()
})

it("records a 500 balance payment without confirming the current enrollment or changing its ticket", async () => {
  const user = userEvent.setup()
  const requests: { account?: RequestInit; enrollment?: RequestInit; queue?: RequestInit } = {}
  fetchMock.mockImplementation(trackAccountPaymentRoutes(requests))

  renderWithSession(<AccountingPaymentWorkspace />, { session: accountingSession })
  await user.click(await screen.findByRole("button", { name: "Record balance payment" }))
  await user.type(screen.getByLabelText("Balance payment amount"), "500")
  await user.click(screen.getByRole("button", { name: "Record payment" }))

  await vi.waitFor(() => expect(requests.account).toBeDefined())
  expect(JSON.parse(requests.account?.body as string)).toEqual({ amount: 500 })
  expect(requests.enrollment).toBeUndefined()
  expect(requests.queue).toBeUndefined()
})
```

Extend the current skipped-ticket regression to assert the requeued ticket still appears in the Waiting table after the account-query refetch, not only immediately after the queue mutation.

- [ ] **Step 2: Run the focused frontend tests and verify RED**

Run:

```powershell
npm test -- --run src/features/services/student-account-service.test.ts src/features/components/portal/accounting-payment-workspace.test.tsx
```

Expected: contract/service imports and Cashier account controls are missing.

- [ ] **Step 3: Implement typed API plumbing and Cashier UI**

Add the strict Zod schemas before UI changes. Each money field stays a string in the contract and is displayed through one local `formatPhp()` helper that uses `Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" })` only for presentation.

In `AccountingPaymentWorkspace`, fetch the serving Student's Account data only when both the role is Accounting Staff and a serving enrollment exists. Render identity and balance context in the Now Serving card. Keep the existing **Confirm payment** action, but add a checkbox labelled **Promissory note on file** in its dialog and pass that value to the mutation.

Add a separate **Record balance payment** dialog with clear copy: “This is applied to the oldest outstanding enrollment and does not confirm the current enrollment.” On success, invalidate both the selected account query and existing queue/enrollment query families. Never call `updateQueueTicket` from this flow.

- [ ] **Step 4: Run focused frontend tests and verify GREEN**

Run:

```powershell
npm test -- --run src/features/services/student-account-service.test.ts src/features/components/portal/accounting-payment-workspace.test.tsx
```

Expected: PASS, including account context, PHP 500.00 account payment request, promissory flag payload, and skipped-ticket visibility.

- [ ] **Step 5: Record the milestone in `PROGRESS.md`**

Record API-contract coverage and the separate-payment/no-queue-mutation invariant. Do not commit.

---

### Task 6: Show the Student's own account balance without payment controls

**Files:**
- Create: `frontend/src/features/components/portal/student-account-balance-panel.tsx`
- Create: `frontend/src/features/components/portal/student-account-balance-panel.test.tsx`
- Modify: `frontend/src/features/components/portal/enrollment-workspace.tsx`
- Modify: `frontend/src/features/components/portal/enrollment-workspace.test.tsx`

**Interfaces:**
- `StudentAccountBalancePanel({ account: StudentAccount }): ReactElement` is read-only.
- `EnrollmentWorkspace` invokes `useOwnStudentAccountQuery({ enabled: authorized })` only for Student sessions.

- [ ] **Step 1: Write failing Student panel and workspace tests**

```tsx
it("shows the student's own total and term balances with the promissory-note indicator", async () => {
  mockOwnAccount({
    outstanding_balance: "4900.00",
    has_promissory_note_on_file: true,
    entries: [{ academic_term_label: "2025-2026 · 2nd", outstanding_balance: "3500.00" }],
  })

  renderWithSession(<EnrollmentWorkspace />, { session: studentSession })

  expect(await screen.findByRole("heading", { name: "Account balance" })).toBeInTheDocument()
  expect(screen.getByText("₱4,900.00")).toBeInTheDocument()
  expect(screen.getByText("2025-2026 · 2nd")).toBeInTheDocument()
  expect(screen.getByText("Promissory note on file")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /record.*payment/i })).not.toBeInTheDocument()
})
```

Also add a test that no account API request is made for an unauthorized non-Student session.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm test -- --run src/features/components/portal/student-account-balance-panel.test.tsx src/features/components/portal/enrollment-workspace.test.tsx
```

Expected: missing component/panel and no Student-account query.

- [ ] **Step 3: Implement the read-only account panel**

Use the existing portal Card/Badge style: total balance is the primary value, then list each outstanding academic term with its remaining amount. Render the promissory-note indicator only when true. Place the panel adjacent to the existing Queue & Payment panel so Students can distinguish enrollment progress from ongoing account balance. Use `AsyncBoundary` for loading/error/retry and do not duplicate Cashier payment actions or account identifiers beyond the Student's own data.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
npm test -- --run src/features/components/portal/student-account-balance-panel.test.tsx src/features/components/portal/enrollment-workspace.test.tsx
```

Expected: PASS, including read-only behavior.

- [ ] **Step 5: Record the milestone in `PROGRESS.md`**

Record Student visibility, no-action boundary, and exact frontend test output. Do not commit.

---

### Task 7: Cross-layer verification and handoff

**Files:**
- Modify: `PROGRESS.md`
- Inspect only: all Task 1–6 changed files

- [ ] **Step 1: Run focused backend suites**

Run:

```powershell
php artisan test --filter='(AccountPaymentTest|BuildStudentAccountBalanceTest|StudentAccountEndpointTest|PaymentConfirmationEndpointTest|QueueTicketsEndpointTest|EnrollmentRecordsMigrationTest)'
```

Expected: PASS. Record the test count and any non-failing baseline warnings exactly.

- [ ] **Step 2: Run focused frontend suites**

Run:

```powershell
npm test -- --run src/features/services/student-account-service.test.ts src/features/components/portal/accounting-payment-workspace.test.tsx src/features/components/portal/student-account-balance-panel.test.tsx src/features/components/portal/enrollment-workspace.test.tsx
```

Expected: PASS. Treat only the known jsdom canvas notice as non-failing if it appears.

- [ ] **Step 3: Run static/format checks for exactly the modified code**

Run:

```powershell
php vendor/bin/pint --test app/Actions/Billing app/Actions/Enrollment/ConfirmPayment.php app/Domain/Billing app/Http/Controllers/Api/V1/StudentAccountController.php app/Http/Requests/Api/V1/Enrollment/ConfirmPaymentRequest.php app/Http/Requests/Api/V1/StudentAccount app/Http/Resources/Api/V1 app/Models/AccountPayment.php app/Models/Enrollment.php app/Models/Payment.php app/Models/StudentProfile.php app/Policies/StudentProfilePolicy.php
php vendor/bin/phpstan analyse --memory-limit=512M app/Actions/Billing app/Actions/Enrollment/ConfirmPayment.php app/Domain/Billing app/Http/Controllers/Api/V1/StudentAccountController.php app/Http/Requests/Api/V1/Enrollment/ConfirmPaymentRequest.php app/Http/Requests/Api/V1/StudentAccount app/Http/Resources/Api/V1 app/Models/AccountPayment.php app/Models/Enrollment.php app/Models/Payment.php app/Models/StudentProfile.php app/Policies/StudentProfilePolicy.php
npm run typecheck
npx eslint src/features/schemas/student-account-schema.ts src/features/services/student-account-service.ts src/features/hooks/use-student-account.ts src/features/components/portal/accounting-payment-workspace.tsx src/features/components/portal/student-account-balance-panel.tsx src/features/components/portal/enrollment-workspace.tsx
npx prettier --check src/features/schemas/student-account-schema.ts src/features/services/student-account-service.ts src/features/hooks/use-student-account.ts src/features/components/portal/accounting-payment-workspace.tsx src/features/components/portal/student-account-balance-panel.tsx src/features/components/portal/enrollment-workspace.tsx
git diff --check
```

Expected: every command exits `0`. If any command exposes an unrelated baseline failure, record its exact file/test/error and do not broaden scope without user direction.

- [ ] **Step 4: Final review and progress handoff**

Re-read the approved spec and this plan against the diff. Verify every requirement: PHP 1,000.00 explicit enrollment floor, PHP 500.00 standalone balance payment, oldest active allocation, terminal exclusion, promissory flag/no file, least privilege, unchanged COM idempotency, and visible requeued ticket. Update `PROGRESS.md` with verified results. Do not commit or push unless the user explicitly authorizes a saving point.
