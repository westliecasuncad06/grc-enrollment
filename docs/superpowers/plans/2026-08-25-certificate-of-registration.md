# Certificate of Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Digital COM with a printable immutable Certificate of Registration generated after Cashier payment confirmation and available to its Student, Cashier, and Registrar users.

**Architecture:** Canonicalize the single enrollment document type as `cor`, convert existing COM rows, and persist an immutable JSON snapshot plus a SHA-256 content hash. The existing list endpoint remains lightweight; a policy-protected detail endpoint returns the snapshot for a shared A4 React print component.

**Tech Stack:** Laravel 12, PHP 8.4, MySQL migrations, Sanctum bearer authorization, API Resources, React 19, TypeScript, TanStack Query, Zod, Tailwind CSS, shadcn/ui, Vitest, Playwright/PDF print verification.

**Spec:** `docs/superpowers/specs/2026-08-25-certificate-of-registration-design.md`

## Global constraints

- `cor` and the `COR` number prefix replace `com`; there is no second artifact.
- Only confirmed Cashier payment creates a COR. Draft, Registrar-pending, and unpaid enrollments expose none.
- Each COR has one immutable snapshot and SHA-256 content hash. The historical backfill is explicit and idempotent, and fills converted legacy rows in place rather than duplicating them.
- Students read only their own CORs. Accounting Staff can read COR history. Registrar Head and Registrar Staff retain all-record access.
- Local test fixtures may use `123 Test Drive, Caloocan City`. Production missing data renders `Not provided`.
- Use the supplied withdrawal terms verbatim. Do not add image signatures, upload, PDF storage, or dependencies.
- Preserve `/api/v1`, Sanctum bearer tokens, Form Requests, Policies, API Resources, transactions, and service-only frontend API calls.
- Do not commit or push. Do not modify unrelated dirty-worktree files.

## File map

| File | Responsibility |
| --- | --- |
| `backend/app/Domain/Enrollment/EnrollmentDocumentType.php` | Defines the canonical `cor` document type. |
| `backend/app/Domain/Enrollment/CorTerms.php` | Owns the supplied withdrawal text. |
| `backend/app/Domain/Enrollment/BuildCorSnapshot.php` | Builds stable data from an enrollment and payment. |
| `backend/database/migrations/2026_08_25_000001_convert_com_documents_to_cor_and_add_snapshot.php` | Converts old records and adds nullable JSON snapshot storage. |
| `backend/app/Actions/Enrollment/ConfirmPayment.php` | Creates one COR in the existing payment transaction. |
| `backend/app/Actions/Enrollment/BackfillCertificatesOfRegistration.php` | Safely creates missing historic CORs. |
| `backend/app/Console/Commands/BackfillCertificatesOfRegistrationCommand.php` | Exposes `cor:backfill`. |
| `backend/app/Http/Resources/Api/V1/EnrollmentDocumentDetailResource.php` | Returns the protected immutable snapshot. |
| `frontend/src/features/components/portal/certificate-of-registration-document.tsx` | Renders the two-page A4 COR. |
| `frontend/src/features/components/portal/student-certificate-of-registration-workspace.tsx` | Student history, detail, and print UI. |
| `frontend/src/features/components/portal/cashier-cor-records-workspace.tsx` | Cashier history search, detail, and print UI. |

## Task 1: COR storage and immutable snapshot

**Files:**
- Create: `backend/database/migrations/2026_08_25_000001_convert_com_documents_to_cor_and_add_snapshot.php`
- Create: `backend/app/Domain/Enrollment/CorTerms.php`
- Create: `backend/app/Domain/Enrollment/BuildCorSnapshot.php`
- Modify: `backend/app/Domain/Enrollment/EnrollmentDocumentType.php`
- Modify: `backend/app/Models/EnrollmentDocument.php`
- Test: `backend/tests/Unit/Domain/Enrollment/BuildCorSnapshotTest.php`
- Test: `backend/tests/Feature/Database/CertificateOfRegistrationMigrationTest.php`

**Interfaces:**
- `EnrollmentDocumentType::Cor` has value `cor` and label `Certificate of Registration`.
- `BuildCorSnapshot::execute(Enrollment $enrollment, Payment $payment): array<string,mixed>` returns the exact print payload.
- `EnrollmentDocument` adds an `array`-cast `snapshot` column and stores `content_hash` as SHA-256 canonical JSON.

- [ ] **Step 1: Write the failing migration and snapshot tests**

```php
public function test_it_builds_the_complete_cor_snapshot(): void
{
    $snapshot = app(BuildCorSnapshot::class)->execute($this->enrollment, $this->payment);

    self::assertSame('Certificate of Registration', $snapshot['document_title']);
    self::assertSame('CS101', $snapshot['subjects'][0]['code']);
    self::assertSame('2500.00', $snapshot['fees']['grand_total']);
    self::assertSame(CorTerms::all(), $snapshot['withdrawal_terms']);
}
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `php artisan test tests/Unit/Domain/Enrollment/BuildCorSnapshotTest.php tests/Feature/Database/CertificateOfRegistrationMigrationTest.php`

Expected: failure because the COR enum, migration, terms, and builder do not exist.

- [ ] **Step 3: Implement the smallest storage/domain change**

```php
$table->json('snapshot')->nullable()->after('content_hash');
DB::table('enrollment_documents')->where('document_type', 'com')->orderBy('id')->each(
    fn (object $document) => DB::table('enrollment_documents')->whereKey($document->id)->update([
        'document_type' => 'cor',
        'document_number' => preg_replace('/^COM/', 'COR', $document->document_number),
    ]),
);
```

The builder must eager-load `student.user`, `student.program`, `academicTerm`, `enrollmentSubjects.section.subject`, `assessment.items`, and `payment.confirmer`. It must snapshot institution/title, student/term fields, subjects, total units, admission certification, itemized tuition/other fees/totals, Cashier/Registrar labels, and `CorTerms::all()`. Sort subjects by code and fee items by ID; convert unavailable runtime values to `Not provided`; never use the fixture address except in tests.

- [ ] **Step 4: Run GREEN and inspect rollback**

Run: `php artisan test tests/Unit/Domain/Enrollment/BuildCorSnapshotTest.php tests/Feature/Database/CertificateOfRegistrationMigrationTest.php && php artisan migrate:rollback --step=1 --pretend`

Expected: tests pass and rollback restores `com`/`COM` then removes only the new snapshot column.

## Task 2: Payment generation and historic backfill

**Files:**
- Create: `backend/app/Actions/Enrollment/BackfillCertificatesOfRegistration.php`
- Create: `backend/app/Console/Commands/BackfillCertificatesOfRegistrationCommand.php`
- Modify: `backend/app/Actions/Enrollment/ConfirmPayment.php`
- Modify: `backend/app/Http/Resources/Api/V1/PaymentConfirmationResource.php`
- Test: `backend/tests/Feature/Actions/Enrollment/ConfirmPaymentTest.php`
- Test: `backend/tests/Feature/Actions/Enrollment/BackfillCertificatesOfRegistrationTest.php`

**Interfaces:**
- `BackfillCertificatesOfRegistration::execute(?int $enrollmentId = null): int` returns only the created-row count.
- `cor:backfill {--enrollment-id=}` runs the action safely more than once.

- [ ] **Step 1: Write the failing generation/backfill tests**

```php
public function test_payment_confirmation_creates_one_hashed_cor_snapshot(): void
{
    $this->confirm($this->pendingPaymentEnrollment());
    $document = EnrollmentDocument::query()->sole();

    self::assertSame(EnrollmentDocumentType::Cor, $document->document_type);
    self::assertSame('COR000009', $document->document_number);
    self::assertNotEmpty($document->snapshot);
    self::assertNotNull($document->content_hash);
}

public function test_backfill_creates_only_missing_cors_for_paid_enrollments(): void
{
    self::assertSame(2, app(BackfillCertificatesOfRegistration::class)->execute());
    self::assertSame(0, app(BackfillCertificatesOfRegistration::class)->execute());
}
```

- [ ] **Step 2: Run the tests and confirm RED**

Run: `php artisan test tests/Feature/Actions/Enrollment/ConfirmPaymentTest.php tests/Feature/Actions/Enrollment/BackfillCertificatesOfRegistrationTest.php`

Expected: current payment generation yields `com` without a snapshot and no backfill action exists.

- [ ] **Step 3: Create COR atomically and implement the command**

```php
$snapshot = $this->buildCorSnapshot->execute($lockedEnrollment->fresh($relations), $payment);
$document = EnrollmentDocument::create([
    'enrollment_id' => $lockedEnrollment->id,
    'document_type' => EnrollmentDocumentType::Cor,
    'document_number' => sprintf('COR%06d', $lockedEnrollment->id),
    'snapshot' => $snapshot,
    'content_hash' => $this->buildCorSnapshot->hash($snapshot),
    'storage_path' => null,
    'generated_at' => $confirmedAt,
]);
```

The action selects only `enrolled` enrollments with a payment where the COR is missing or has a null snapshot, locks each row in a transaction, and rechecks its payment/document state. It creates a missing row or updates the converted legacy row in place with one deterministic snapshot. It records an audit event only when it changes a historic COR. Update notification and payment-response copy to Certificate of Registration.

- [ ] **Step 4: Run GREEN and confirm command registration**

Run: `php artisan test tests/Feature/Actions/Enrollment/ConfirmPaymentTest.php tests/Feature/Actions/Enrollment/BackfillCertificatesOfRegistrationTest.php && php artisan list --raw | rg '^cor:backfill$'`

Expected: selected tests pass and exactly one command entry exists.

## Task 3: Authorized COR list, search, and detail API

**Files:**
- Create: `backend/app/Actions/Enrollment/ShowEnrollmentDocument.php`
- Create: `backend/app/Http/Resources/Api/V1/EnrollmentDocumentDetailResource.php`
- Create: `backend/app/Http/Requests/Api/V1/EnrollmentDocument/ShowEnrollmentDocumentRequest.php`
- Modify: `backend/app/Actions/Enrollment/ListEnrollmentDocuments.php`
- Modify: `backend/app/Http/Controllers/Api/V1/EnrollmentDocumentController.php`
- Modify: `backend/app/Http/Resources/Api/V1/EnrollmentDocumentResource.php`
- Modify: `backend/app/Http/Requests/Api/V1/EnrollmentDocument/IndexEnrollmentDocumentRequest.php`
- Modify: `backend/app/Models/EnrollmentDocument.php`
- Modify: `backend/app/Policies/EnrollmentDocumentPolicy.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/Api/V1/EnrollmentDocumentsEndpointTest.php`

**Interfaces:**
- `GET /api/v1/enrollment-documents?student_number=2026-0001` supports exact student-number history lookup.
- `GET /api/v1/enrollment-documents/{enrollmentDocument}` returns `type: certificate_of_registration` with its saved snapshot.

- [ ] **Step 1: Write failing access tests**

```php
public function test_cashier_can_search_and_view_a_students_prior_cor(): void
{
    $cor = $this->makeCorFor($this->student, $this->pastTerm);
    $this->withToken($this->cashierToken)
        ->getJson('/api/v1/enrollment-documents?student_number=2026-0001')
        ->assertOk()->assertJsonPath('data.0.id', $cor->id);
    $this->withToken($this->cashierToken)
        ->getJson("/api/v1/enrollment-documents/{$cor->id}")
        ->assertOk()->assertJsonPath('data.document_number', 'COR000009');
}

public function test_student_cannot_view_another_students_cor(): void
{
    $this->withToken($this->otherStudentToken)
        ->getJson("/api/v1/enrollment-documents/{$this->cor->id}")
        ->assertForbidden();
}
```

- [ ] **Step 2: Run the endpoint test and confirm RED**

Run: `php artisan test tests/Feature/Api/V1/EnrollmentDocumentsEndpointTest.php`

Expected: Accounting is forbidden and the detail route returns 404.

- [ ] **Step 3: Implement policy-scoped read paths**

```php
Route::get('/enrollment-documents/{enrollmentDocument}', [EnrollmentDocumentController::class, 'show'])
    ->name('enrollment-documents.show');
```

`viewAny` and `view` permit Student, Accounting Staff, Registrar Head, and Registrar Staff. `scopeVisibleTo` narrows Students by enrollment owner and returns all records only for the three staff roles. Validate `student_number` as an exact existing string, do not expose email or storage path, and keep the snapshot detail out of list responses.

- [ ] **Step 4: Run GREEN and route verification**

Run: `php artisan test tests/Feature/Api/V1/EnrollmentDocumentsEndpointTest.php && php artisan route:list --path=enrollment-documents`

Expected: ownership, Cashier, Registrar, and forbidden-role cases pass; both GET endpoints are registered.

## Task 4: Strict frontend COR data contract

**Files:**
- Modify: `frontend/src/features/schemas/enrollment-document-schema.ts`
- Modify: `frontend/src/features/services/enrollment-document-service.ts`
- Modify: `frontend/src/features/services/enrollment-document-service.test.ts`
- Modify: `frontend/src/features/hooks/use-enrollment-documents.ts`
- Create: `frontend/src/features/hooks/use-enrollment-documents.test.tsx`

**Interfaces:**
- `getCertificateOfRegistration(id, signal)` requests the detail endpoint.
- `useCertificateOfRegistrationQuery(id, { enabled })` uses `['certificate-of-registration', viewerId, id]`.

- [ ] **Step 1: Write failing contract/service/hook tests**

```ts
it("loads the immutable COR detail for the active viewer", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ data: corDetail }))
  await expect(getCertificateOfRegistration(9)).resolves.toMatchObject({
    document_number: "COR000009",
    snapshot: { document_title: "Certificate of Registration" },
  })
})
```

- [ ] **Step 2: Run the tests and confirm RED**

Run: `npx vitest run src/features/services/enrollment-document-service.test.ts src/features/hooks/use-enrollment-documents.test.tsx --pool=threads --maxWorkers=1 --no-file-parallelism`

Expected: current Zod types allow only `com` and no detail function/hook exists.

- [ ] **Step 3: Add strict schemas and viewer-safe queries**

```ts
export const certificateOfRegistrationSchema = z.object({
  type: z.literal("certificate_of_registration"),
  id: z.number().int().positive(),
  document_number: z.string().regex(/^COR\d+$/),
  generated_at: z.iso.datetime(),
  snapshot: corSnapshotSchema,
}).strict()
```

Use `getAuthenticatedJson` exclusively in the service, preserve no-store private response handling, and use the session viewer ID in all keys.

- [ ] **Step 4: Run GREEN and typecheck**

Run: `npx vitest run src/features/services/enrollment-document-service.test.ts src/features/hooks/use-enrollment-documents.test.tsx --pool=threads --maxWorkers=1 --no-file-parallelism && npx tsc --noEmit`

Expected: selected tests and strict TypeScript pass.

## Task 5: A4 printable COR and role workspaces

**Files:**
- Create: `frontend/src/features/components/portal/certificate-of-registration-document.tsx`
- Create: `frontend/src/features/components/portal/certificate-of-registration-document.test.tsx`
- Create: `frontend/src/features/components/portal/student-certificate-of-registration-workspace.tsx`
- Create: `frontend/src/features/components/portal/student-certificate-of-registration-workspace.test.tsx`
- Create: `frontend/src/features/components/portal/cashier-cor-records-workspace.tsx`
- Create: `frontend/src/features/components/portal/cashier-cor-records-workspace.test.tsx`
- Modify: `frontend/src/features/portal/role-capabilities.ts`
- Modify: `frontend/src/features/portal/module-registry.tsx`
- Modify: `frontend/src/features/components/portal/accounting-payment-workspace.tsx`
- Modify: `frontend/src/app/globals.css`
- Delete: `frontend/src/features/components/portal/student-digital-com-workspace.tsx`
- Delete: `frontend/src/features/components/portal/student-digital-com-workspace.test.tsx`

**Interfaces:**
- Student module ID: `certificate-of-registration`.
- Accounting module ID: `cor-records`.
- `CertificateOfRegistrationDocument({ cor })` renders the shared printable view.

- [ ] **Step 1: Write failing print and workspace tests**

```tsx
it("lets a Cashier find and print a prior COR by student number", async () => {
  renderWithSession(<CashierCorRecordsWorkspace />, { session: cashierSession })
  await user.type(screen.getByLabelText("Student number"), "2026-0001")
  await user.click(screen.getByRole("button", { name: "Search CORs" }))
  await user.click(await screen.findByRole("button", { name: "View COR000009" }))
  expect(await screen.findByRole("heading", { name: "Certificate of Registration" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Print / download" })).toBeInTheDocument()
})
```

The document test must require a title, semantic `Registered subjects` table, Assessment of Fees, total units, total other fees, grand total, Terms and Conditions, Cashier, Registrar, and `axe` with no violations.

- [ ] **Step 2: Run the tests and confirm RED**

Run: `npx vitest run src/features/components/portal/certificate-of-registration-document.test.tsx src/features/components/portal/student-certificate-of-registration-workspace.test.tsx src/features/components/portal/cashier-cor-records-workspace.test.tsx --pool=threads --maxWorkers=1 --no-file-parallelism`

Expected: COR components and workspace modules are absent; current copy remains Digital COM.

- [ ] **Step 3: Implement the shared document and role-correct views**

```tsx
<article aria-label={`Certificate of Registration ${cor.document_number}`} className="cor-document">
  <section className="cor-document__page">{/* header, details, subject table, fees */}</section>
  <section className="cor-document__page">{/* terms and signature lines */}</section>
</article>
```

The component consumes `snapshot` only, formats PHP amounts consistently, renders missing runtime data as `Not provided`, and uses `PrintButton`. Add A4 CSS with `@page { size: A4; margin: 12mm; }`, repeated table headers, `break-inside: avoid` subject rows, and hidden portal controls. Student list reads owned CORs; Cashier search starts disabled until a student number is entered; both load selected detail via the query hook and use `AsyncBoundary` states. Rename all module/payment copy from COM to COR. Do not add COR data to queue kiosk UI.

- [ ] **Step 4: Run GREEN, static checks, and visual print validation**

Run: `npx vitest run src/features/components/portal/certificate-of-registration-document.test.tsx src/features/components/portal/student-certificate-of-registration-workspace.test.tsx src/features/components/portal/cashier-cor-records-workspace.test.tsx --pool=threads --maxWorkers=1 --no-file-parallelism && npx tsc --noEmit && npx eslint src/features/components/portal/certificate-of-registration-document.tsx src/features/components/portal/student-certificate-of-registration-workspace.tsx src/features/components/portal/cashier-cor-records-workspace.tsx --max-warnings=0`

Render a fictional fixture through Playwright print to `output/pdf/certificate-of-registration-fixture.pdf`, convert it with `pdftoppm -png`, and inspect both pages for legibility, page break behavior, aligned totals, and intact signature lines.

## Task 6: Backfill runbook and final verification

**Files:**
- Modify: `PROGRESS.md`
- Test: `backend/tests/Feature/Api/V1/EnrollmentDocumentsEndpointTest.php`

- [ ] **Step 1: Write a failing converted-history integration test**

```php
public function test_a_backfilled_prior_enrollment_is_visible_to_its_student_and_cashier(): void
{
    $this->artisan('cor:backfill')->assertExitCode(0);
    $document = EnrollmentDocument::query()->where('document_type', 'cor')->sole();
    $this->withToken($this->studentToken)->getJson("/api/v1/enrollment-documents/{$document->id}")->assertOk();
    $this->withToken($this->cashierToken)->getJson("/api/v1/enrollment-documents/{$document->id}")->assertOk();
}
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `php artisan test tests/Feature/Api/V1/EnrollmentDocumentsEndpointTest.php --filter=backfilled_prior`

Expected: failure until storage, backfill, and authorization are wired together.

- [ ] **Step 3: Record the authorized operator sequence**

Add to `PROGRESS.md`: run migrations; run `php artisan cor:backfill`; run it again and verify zero rows created; then compare COR count to paid/enrolled enrollment count. Never execute this command against production from this workspace.

- [ ] **Step 4: Run and record final evidence**

Run: `php artisan test tests/Unit/Domain/Enrollment/BuildCorSnapshotTest.php tests/Feature/Actions/Enrollment/ConfirmPaymentTest.php tests/Feature/Actions/Enrollment/BackfillCertificatesOfRegistrationTest.php tests/Feature/Api/V1/EnrollmentDocumentsEndpointTest.php && vendor/bin/pint --test app/Domain/Enrollment app/Actions/Enrollment app/Console/Commands app/Http/Controllers/Api/V1 app/Http/Resources/Api/V1 app/Models/EnrollmentDocument.php app/Policies/EnrollmentDocumentPolicy.php && git diff --check`

Run: `npx vitest run src/features/services/enrollment-document-service.test.ts src/features/hooks/use-enrollment-documents.test.tsx src/features/components/portal/certificate-of-registration-document.test.tsx src/features/components/portal/student-certificate-of-registration-workspace.test.tsx src/features/components/portal/cashier-cor-records-workspace.test.tsx --pool=threads --maxWorkers=1 --no-file-parallelism && npx tsc --noEmit`

Expected: all selected checks pass. Record only command results that actually complete successfully; do not commit or push.
