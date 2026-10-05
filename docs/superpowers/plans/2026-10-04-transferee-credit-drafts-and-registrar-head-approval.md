# Transferee Credit Drafts and Registrar Head Approval Implementation Plan (Slice 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A transferee builds a private list of the subjects they took at another school and sends it to the Program Chair in one step; the **Registrar Head** (not Registrar Staff) approves, rejects or returns the credits the Program Chair endorsed.

**Architecture:** Extend the existing `transferee_credits` table (a new `draft` status and four additive columns) and the existing `UpdateTransfereeCredit` route (a `return` action). Two new Actions (`SubmitTransfereeCredits`, `DeleteTransfereeCreditDraft`). `TransfereeCreditPolicy::decide` moves from Registrar Staff to Registrar Head. On the frontend the student's dialog becomes a draft list with Edit, Remove and Submit, and the Registrar Head gets Approve, Return and Reject on the existing credits table.

**Tech Stack:** Laravel 12, PHPUnit 11, MariaDB; Next.js (client-rendered), TypeScript strict, TanStack Query, Zod, Tailwind, shadcn/ui, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-04-transferee-credit-mapping-pay-first-design.md` (Slice 1 and the Decisions table). ADR 0026 is amended by Task 6.

## Scope and what moved to the next plan

This is Slice 1. Slices 2 to 4 get their own plans (Slice 3 waits for the uncommitted freshman pay-first work to settle; Slice 4 needs sample TORs).

**One deliberate change from the spec's Slice 1 list:** the two **student-level bulk endpoints** (`POST /student-profiles/{id}/transferee-credits/submit-to-registrar-head` for the Program Chair, and `POST /student-profiles/{id}/transferee-credits/approve-all` for the Registrar Head) move to the Slice 2 plan. Their only consumers are the Slice 2 screens, so building them here would ship unused endpoints. Until Slice 2, the Program Chair keeps endorsing row by row (it already works) and the Registrar Head decides row by row on the existing table.

**Copy decision:** the student dialog already says "Program Head" everywhere ("Awaiting Program Head"), so the new strings in it say **Program Head** too (button: "Submit to Program Head"). The spec's "Program Chair" is the role name; the rename of the wording is a separate decision.

## Global Constraints

- **No commits and no pushes.** AGENTS.md: "Do not commit or push unless the user explicitly requests a GitHub saving point." Wherever the usual plan template says "Commit", this plan says **Checkpoint**: run the task's checks and add a line to `PROGRESS.md`. Never record a check as passed unless it ran and passed.
- Bearer-token auth only; every route under `/api/v1`; Form Requests, Policies, Actions, API Resources, database transactions, and a **reversible** migration (AGENTS.md).
- **Never run backend tests against the owner's dev database** (`grc_enrollment` on :3306): `RefreshDatabase` wipes it. Use the private MariaDB from `docs/runbooks/mariadb-local.md` and pass the connection as **process environment variables** (`DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`) in the same command. Run one backend suite at a time, each in its own database.
- `source_grade` stays a free string; no cross-institution grade equivalence or conversion (PRD §17 stays open).
- Authorization is checked before status: a role that may not take a step gets **403**, never a 422 about the credit's status.
- Every credit transition re-checks the status under a row lock (existing rule), so a repeated request changes nothing a second time.
- Resources are built for `preventLazyLoading`: eager-load `student.user` and `subject` (and `student.program` where a Policy or recipient lookup needs it).
- This API's validation errors are `error.errors.<field>`; `assertJsonValidationErrors` does not work. Assert `->assertUnprocessable()` and check the database.
- Every test authenticates as exactly **one** actor (the documented Sanctum gotcha); state a second actor would have produced is seeded through Eloquent.
- Working-tree files are LF. After editing PHP, run `vendor/bin/pint <changed files>`. Prefer the Edit tool over scripted rewrites.
- `PRD.md`, `PROGRESS.md` and other docs have uncommitted edits from other sessions in the working tree: edit only the lines named here and re-check your `PROGRESS.md` entry after any long run (another session once erased one).

## Review Focus

Failure modes the spec implies that no obvious test would exercise (each has its test in the task that owns the code):

1. **Double tap on "Submit to Program Head"** (or two tabs): the second call must change nothing and must not notify the Program Chairs again. (Task 2)
2. **A student's drafts leaking** to a Program Chair, Registrar Staff or Registrar Head through the list, a PATCH by id, or the suggestions endpoint. A draft is private. (Task 2, Task 3)
3. **Touching someone else's draft, or a submitted row:** another student's draft gives 403; the student editing or deleting a row that is no longer a draft gives 422; staff roles cannot edit or delete a draft. (Task 3)
4. **A transferee with only saved drafts must not look "mapping complete"**, on the API gate and on the Enrollment page (`credits.length > 0` with no pending or endorsed row used to read as complete). (Task 5, Task 8)
5. **Rows already `endorsed` and waiting on Registrar Staff when this ships:** the Registrar Head can approve them and Registrar Staff can no longer. (Task 4)
6. **A returned credit comes back to the Program Chair, can be re-mapped and endorsed again, and the return details clear** on the new endorsement. (Task 4)

## File Structure

**Backend (create)**
- `backend/database/migrations/2026_10_04_000004_add_submission_and_return_to_transferee_credits_table.php`: the four columns.
- `backend/app/Actions/Academic/SubmitTransfereeCredits.php`: drafts → pending for the calling student, one notice to the chairs.
- `backend/app/Actions/Academic/DeleteTransfereeCreditDraft.php`: removes a student's own draft.
- `backend/tests/Feature/Database/AddSubmissionAndReturnToTransfereeCreditsTableTest.php`

**Backend (modify)**
- `app/Domain/Academic/TransfereeCreditStatus.php`: `Draft`.
- `app/Domain/Audit/AuditAction.php`: `submitted`, `returned`, `deleted`.
- `app/Domain/Notifications/NotificationType.php`: `TransfereeCreditReturned`.
- `app/Models/TransfereeCredit.php`: columns, casts, relation, draft-hiding scope.
- `app/Actions/Academic/CreateTransfereeCredit.php`: a student's request is a draft and notifies nobody.
- `app/Actions/Academic/UpdateTransfereeCredit.php`: draft editing by the student, `return`, notices to the Head and Chairs.
- `app/Actions/Academic/EvaluateCreditMappingStatus.php`: drafts do not count as submitted.
- `app/Policies/TransfereeCreditPolicy.php`: `submit`, `editDraft`, `deleteDraft`, `decide` → Head.
- `app/Http/Controllers/Api/V1/TransfereeCreditController.php`: `submit`, `destroy`, ability resolution.
- `app/Http/Requests/Api/V1/TransfereeCredit/UpdateTransfereeCreditRequest.php`: student path, `return`.
- `app/Http/Resources/Api/V1/TransfereeCreditResource.php`: `submitted_at`, `returned_at`, `return_reason`.
- `routes/api.php`
- Tests: `tests/Unit/Domain/Academic/TransfereeCreditStatusTest.php`, `tests/Unit/Models/TransfereeCreditTest.php`, `tests/Unit/Actions/Academic/EvaluateCreditMappingStatusTest.php`, `tests/Feature/Api/V1/TransfereeCreditsEndpointTest.php`, `tests/Feature/Api/V1/ApiSurfaceTest.php`, `tests/Unit/Domain/Audit/AuditVocabularyTest.php`, `tests/Unit/Domain/Notifications/NotificationTypeTest.php`.

**Docs (modify):** `docs/adr/0026-credit-mapping-ownership-and-effect.md`, `docs/api/openapi.yaml`, `docs/data-dictionary/enrollment-records.md`, `PRD.md` (four lines).

**Frontend (create):** `frontend/src/features/lib/credit-mapping.ts` and `.test.ts`, `frontend/src/features/schemas/transferee-credit-schema.test.ts`.

**Frontend (modify):** `schemas/transferee-credit-schema.ts`, `services/transferee-credit-service.ts`, `hooks/use-transferee-credits.ts`, `components/portal/student-credit-mapping-dialog.tsx` and `.test.tsx`, `components/portal/enrollment-workspace.tsx`, `components/portal/registrar-records-workspace.tsx` and `.test.tsx`, `portal/role-capabilities.ts` and `.test.ts`, `lib/notification-presentation.ts`, `components/portal/portal-notification-sheet.test.tsx` (all under `frontend/src/features/`).

---

### Task 1: The `draft` status, the four columns, and the new vocabulary

**Files:**
- Create: `backend/database/migrations/2026_10_04_000004_add_submission_and_return_to_transferee_credits_table.php`
- Create: `backend/tests/Feature/Database/AddSubmissionAndReturnToTransfereeCreditsTableTest.php`
- Modify: `backend/app/Domain/Academic/TransfereeCreditStatus.php`
- Modify: `backend/app/Domain/Audit/AuditAction.php` (constants near line 211 and the list near line 409)
- Modify: `backend/app/Domain/Notifications/NotificationType.php`
- Modify: `backend/app/Models/TransfereeCredit.php`
- Test: `backend/tests/Unit/Domain/Academic/TransfereeCreditStatusTest.php`, `backend/tests/Unit/Models/TransfereeCreditTest.php`, `backend/tests/Unit/Domain/Audit/AuditVocabularyTest.php`, `backend/tests/Unit/Domain/Notifications/NotificationTypeTest.php`

**Interfaces:**
- Produces: `TransfereeCreditStatus::Draft` (`'draft'`, label `Draft`, **not** `isOpen()`); `TransfereeCredit` attributes `submitted_at` (`?CarbonImmutable`), `returned_by` (`?int`), `returned_at` (`?CarbonImmutable`), `return_reason` (`?string`), relation `returner(): BelongsTo<User>`; `AuditAction::TRANSFEREE_CREDIT_SUBMITTED` (`'transferee_credit.submitted'`), `::TRANSFEREE_CREDIT_RETURNED` (`'transferee_credit.returned'`), `::TRANSFEREE_CREDIT_DELETED` (`'transferee_credit.deleted'`); `NotificationType::TransfereeCreditReturned` (`'transferee_credit_returned'`).
- Consumes: nothing.

- [ ] **Step 1: Write the failing tests**

Replace `backend/tests/Unit/Domain/Academic/TransfereeCreditStatusTest.php` with:

```php
<?php

namespace Tests\Unit\Domain\Academic;

use App\Domain\Academic\TransfereeCreditStatus;
use PHPUnit\Framework\TestCase;

final class TransfereeCreditStatusTest extends TestCase
{
    public function test_status_values_are_the_five_cases_in_route_order(): void
    {
        // draft (the student's own list, not yet sent) -> pending -> endorsed (by the
        // Program Chair) -> approved | rejected (by the Registrar Head). ADR 0026, amended.
        self::assertSame(
            ['draft', 'pending', 'endorsed', 'approved', 'rejected'],
            array_column(TransfereeCreditStatus::cases(), 'value'),
        );
    }

    public function test_labels_are_stable_and_human_readable(): void
    {
        self::assertSame('Draft', TransfereeCreditStatus::Draft->label());
        self::assertSame('Pending', TransfereeCreditStatus::Pending->label());
        self::assertSame('Endorsed', TransfereeCreditStatus::Endorsed->label());
        self::assertSame('Approved', TransfereeCreditStatus::Approved->label());
        self::assertSame('Rejected', TransfereeCreditStatus::Rejected->label());
    }

    public function test_only_pending_and_endorsed_are_still_moving_through_the_workflow(): void
    {
        // A draft is the student's private list: it is not in the workflow yet.
        self::assertFalse(TransfereeCreditStatus::Draft->isOpen());
        self::assertTrue(TransfereeCreditStatus::Pending->isOpen());
        self::assertTrue(TransfereeCreditStatus::Endorsed->isOpen());
        self::assertFalse(TransfereeCreditStatus::Approved->isOpen());
        self::assertFalse(TransfereeCreditStatus::Rejected->isOpen());
    }
}
```

Create `backend/tests/Feature/Database/AddSubmissionAndReturnToTransfereeCreditsTableTest.php`:

```php
<?php

namespace Tests\Feature\Database;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\Support\RollsBackThroughMigration;
use Tests\TestCase;

final class AddSubmissionAndReturnToTransfereeCreditsTableTest extends TestCase
{
    use RefreshDatabase;
    use RollsBackThroughMigration;

    private const MIGRATION = '2026_10_04_000004_add_submission_and_return_to_transferee_credits_table';

    private const COLUMNS = ['submitted_at', 'returned_by', 'returned_at', 'return_reason'];

    public function test_it_adds_and_removes_the_submission_and_return_columns(): void
    {
        foreach (self::COLUMNS as $column) {
            $this->assertTrue(Schema::hasColumn('transferee_credits', $column), "Missing {$column}.");
        }

        $this->rollbackThrough(self::MIGRATION);

        foreach (self::COLUMNS as $column) {
            $this->assertFalse(Schema::hasColumn('transferee_credits', $column), "{$column} was not dropped.");
        }
    }
}
```

Add to `backend/tests/Unit/Models/TransfereeCreditTest.php`, before the final `}`:

```php
    public function test_submission_and_return_columns_are_fillable_and_cast(): void
    {
        $credit = new TransfereeCredit;
        $credit->fill([
            'status' => 'draft',
            'submitted_at' => '2026-10-04 09:00:00',
            'returned_by' => 7,
            'returned_at' => '2026-10-05 10:30:00',
            'return_reason' => 'Mapped to the wrong subject.',
        ]);

        self::assertSame(TransfereeCreditStatus::Draft, $credit->status);
        self::assertInstanceOf(CarbonImmutable::class, $credit->submitted_at);
        self::assertInstanceOf(CarbonImmutable::class, $credit->returned_at);
        self::assertSame(7, $credit->returned_by);
        self::assertSame('Mapped to the wrong subject.', $credit->return_reason);
    }
```

In `backend/tests/Unit/Domain/Audit/AuditVocabularyTest.php`, find the line `'queue_kiosk.password_changed',` inside the `$expected` array (just before `];` and `$actual = AuditAction::values();`) and add three entries after it:

```php
                'transferee_credit.submitted',
                'transferee_credit.returned',
                'transferee_credit.deleted',
```

In `backend/tests/Unit/Domain/Notifications/NotificationTypeTest.php`, add `'transferee_credit_returned',` after `'transferee_credit_rejected',` in `$expected`.

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `backend/`, with the private-database env vars set, see Global Constraints):
`php artisan test tests/Unit/Domain/Academic/TransfereeCreditStatusTest.php tests/Unit/Models/TransfereeCreditTest.php tests/Unit/Domain/Audit/AuditVocabularyTest.php tests/Unit/Domain/Notifications/NotificationTypeTest.php tests/Feature/Database/AddSubmissionAndReturnToTransfereeCreditsTableTest.php`
Expected: FAIL (`Draft` is not a case, the columns do not exist, the audit and notification values are missing).

- [ ] **Step 3: Write the implementation**

`backend/app/Domain/Academic/TransfereeCreditStatus.php`: replace the enum body (keep the docblock above the enum) with:

```php
enum TransfereeCreditStatus: string
{
    /** The student's own saved list, not yet sent: private to them, grants and notifies nothing. */
    case Draft = 'draft';
    /** Sent by the Student (or recorded by the Program Chair); awaiting the Program Chair's mapping. */
    case Pending = 'pending';
    /** Mapped to a subject and endorsed by the Program Chair; awaiting the Registrar Head. */
    case Endorsed = 'endorsed';
    case Approved = 'approved';
    case Rejected = 'rejected';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Pending => 'Pending',
            self::Endorsed => 'Endorsed',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
        };
    }

    /** Still moving through the workflow: not yet approved or rejected. A draft is not in it yet. */
    public function isOpen(): bool
    {
        return $this === self::Pending || $this === self::Endorsed;
    }
}
```

Create the migration `backend/database/migrations/2026_10_04_000004_add_submission_and_return_to_transferee_credits_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Credit mapping, amended (ADR 0026): a Student now saves their subjects as a
 * private `draft` list and sends it to the Program Chair in one step
 * (`submitted_at`), and the Registrar Head may return an endorsed credit to the
 * Program Chair with a reason (`returned_by`, `returned_at`, `return_reason`).
 * `status` is a plain string, so the new `draft` value needs no change to it.
 * Every column is nullable and additive: existing rows are untouched.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transferee_credits', function (Blueprint $table) {
            $table->timestamp('submitted_at')->nullable()->after('endorsed_at');
            $table->foreignId('returned_by')->nullable()->after('submitted_at')->constrained('users')->nullOnDelete();
            $table->timestamp('returned_at')->nullable()->after('returned_by');
            $table->text('return_reason')->nullable()->after('returned_at');
        });
    }

    public function down(): void
    {
        Schema::table('transferee_credits', function (Blueprint $table) {
            $table->dropConstrainedForeignId('returned_by');
            $table->dropColumn(['return_reason', 'returned_at', 'submitted_at']);
        });
    }
};
```

`backend/app/Domain/Audit/AuditAction.php`: after the line `public const TRANSFEREE_CREDIT_REJECTED = 'transferee_credit.rejected';` add:

```php

    public const TRANSFEREE_CREDIT_SUBMITTED = 'transferee_credit.submitted';

    public const TRANSFEREE_CREDIT_RETURNED = 'transferee_credit.returned';

    public const TRANSFEREE_CREDIT_DELETED = 'transferee_credit.deleted';
```

and in the list returned by `values()`, after `self::TRANSFEREE_CREDIT_REJECTED,` add:

```php
            self::TRANSFEREE_CREDIT_SUBMITTED,
            self::TRANSFEREE_CREDIT_RETURNED,
            self::TRANSFEREE_CREDIT_DELETED,
```

`backend/app/Domain/Notifications/NotificationType.php`: after `case TransfereeCreditEndorsed = 'transferee_credit_endorsed';` add:

```php
    case TransfereeCreditReturned = 'transferee_credit_returned';
```

`backend/app/Models/TransfereeCredit.php`:
1. In the class docblock, after ` * @property ?CarbonImmutable $endorsed_at` add:
```php
 * @property ?CarbonImmutable $submitted_at
 * @property ?int $returned_by
 * @property ?CarbonImmutable $returned_at
 * @property ?string $return_reason
```
and after ` * @property-read ?User $endorser` add ` * @property-read ?User $returner`.
2. In `$fillable`, after `'endorsed_at',` add `'submitted_at', 'returned_by', 'returned_at', 'return_reason',` (one per line, matching the file's style).
3. In `casts()`, after `'endorsed_at' => 'immutable_datetime',` add:
```php
            'submitted_at' => 'immutable_datetime',
            'returned_at' => 'immutable_datetime',
```
4. After the `endorser()` method add:
```php

    /**
     * @return BelongsTo<User, $this>
     */
    public function returner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'returned_by');
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run the same command as Step 2.
Expected: PASS. Then run `vendor/bin/pint --test` on exactly the files this task touched (`app/Domain/Academic/TransfereeCreditStatus.php`, `app/Domain/Audit/AuditAction.php`, `app/Domain/Notifications/NotificationType.php`, `app/Models/TransfereeCredit.php`, the new migration, and the five test files above). It must report no changes needed; run it without `--test` to fix anything it flags in a file this task changed. Do not run Pint over whole directories: it would reformat files other sessions are editing.

- [ ] **Step 5: Checkpoint**

Add a "Slice 1, Task 1 done" line to the top `PROGRESS.md` entry for this work (create the entry if it is the first task), naming the new migration. **Do not commit.** The migration is not applied to any shared database by this task; the owner runs `php artisan migrate`.

---

### Task 2: A student's request is a private draft, drafts stay hidden, and the student submits the list

**Files:**
- Modify: `backend/app/Models/TransfereeCredit.php` (`scopeVisibleTo`)
- Rewrite: `backend/app/Actions/Academic/CreateTransfereeCredit.php`
- Create: `backend/app/Actions/Academic/SubmitTransfereeCredits.php`
- Modify: `backend/app/Policies/TransfereeCreditPolicy.php`
- Modify: `backend/app/Http/Controllers/Api/V1/TransfereeCreditController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/Api/V1/TransfereeCreditsEndpointTest.php`

**Interfaces:**
- Consumes: Task 1's `Draft` status, `submitted_at`, `AuditAction::TRANSFEREE_CREDIT_SUBMITTED`; existing `ProgramChairRecipients::forStudent(StudentProfile): list<int>`, `NotificationRecorder::recordMany(list<int>, NotificationType, string)`, `AuditRecorder::record(User, string, string, ?int, ?array, ?array, ?string, AuditRequestContext)`.
- Produces: `POST /api/v1/transferee-credits/submit` (Student): returns `{ "data": [TransfereeCreditResource, ...] }` with the rows this call moved to `pending` (an empty `data` on a repeat), route name `api.v1.transferee-credits.submit`; `SubmitTransfereeCredits::execute(User $actor, AuditRequestContext $context): Illuminate\Database\Eloquent\Collection<int, TransfereeCredit>`; `TransfereeCreditPolicy::submit(User): bool`; `TransfereeCredit::scopeVisibleTo` hides drafts from everyone except the owning student.

- [ ] **Step 1: Write the failing tests**

In `backend/tests/Feature/Api/V1/TransfereeCreditsEndpointTest.php`:

(a) In `test_a_student_can_request_a_credit_mapping_for_themselves`, change `->assertJsonPath('data.status', 'pending')` to `->assertJsonPath('data.status', 'draft')` and, after `self::assertNull($credit->subject_id);`, add `self::assertNull($credit->submitted_at);`.

(b) Rename `test_submitting_the_same_request_twice_returns_the_open_one_instead_of_a_duplicate` to `test_saving_the_same_subject_twice_returns_the_open_one_instead_of_a_duplicate`, and change its last line from `self::assertSame(1, Notification::query()->where('user_id', $chair->id)->count());` to:

```php
        // Nothing is sent to the Program Chair until the student submits the list.
        self::assertSame(0, Notification::query()->where('user_id', $chair->id)->count());
```

(c) Replace the whole method `test_a_request_notifies_only_the_program_chairs_of_the_students_college` with:

```php
    public function test_a_submission_notifies_only_the_program_chairs_of_the_students_college(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $this->makeCredit($student, null, TransfereeCreditStatus::Draft);
        $ownChair = $this->makeUser(UserRole::ProgramChair, CollegeCode::Ccs);
        $otherChair = $this->makeUser(UserRole::ProgramChair, CollegeCode::Coe);
        $registrar = $this->makeUser(UserRole::RegistrarStaff);

        $this->withToken($this->tokenFor($student->user))
            ->postJson('/api/v1/transferee-credits/submit')
            ->assertOk();

        $notification = Notification::query()->where('user_id', $ownChair->id)->sole();
        self::assertSame(NotificationType::TransfereeCreditRequested, $notification->type);
        self::assertSame(0, Notification::query()->where('user_id', $otherChair->id)->count());
        self::assertSame(0, Notification::query()->where('user_id', $registrar->id)->count());
    }
```

(d) Add these methods before the closing `}` of the class:

```php
    // ------------------------------------------------------- drafts and submission

    public function test_saving_a_draft_notifies_nobody(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $this->makeUser(UserRole::ProgramChair, CollegeCode::Ccs);
        $this->makeUser(UserRole::RegistrarHead);

        $this->withToken($this->tokenFor($student->user))
            ->postJson('/api/v1/transferee-credits', $this->studentRequestPayload())
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft');

        self::assertSame(0, Notification::query()->count());
    }

    public function test_a_student_sees_their_own_drafts(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $this->makeCredit($student, null, TransfereeCreditStatus::Draft);

        $this->withToken($this->tokenFor($student->user))->getJson('/api/v1/transferee-credits')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.status', 'draft');
    }

    public function test_a_program_chair_never_sees_a_students_draft(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $this->makeCredit($student, null, TransfereeCreditStatus::Draft);
        $chair = $this->makeUser(UserRole::ProgramChair, CollegeCode::Ccs);

        $this->withToken($this->tokenFor($chair))->getJson('/api/v1/transferee-credits')
            ->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_registrar_staff_never_see_a_students_draft(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $this->makeCredit($student, null, TransfereeCreditStatus::Draft);
        $staff = $this->makeUser(UserRole::RegistrarStaff);

        $this->withToken($this->tokenFor($staff))->getJson('/api/v1/transferee-credits')
            ->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_the_registrar_head_never_sees_a_students_draft(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $this->makeCredit($student, null, TransfereeCreditStatus::Draft);
        $head = $this->makeUser(UserRole::RegistrarHead);

        $this->withToken($this->tokenFor($head))->getJson('/api/v1/transferee-credits')
            ->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_a_student_sends_every_saved_draft_to_the_program_chair_in_one_call(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $first = $this->makeCredit($student, null, TransfereeCreditStatus::Draft);
        $second = $this->makeCredit($student, null, TransfereeCreditStatus::Draft);
        $chair = $this->makeUser(UserRole::ProgramChair, CollegeCode::Ccs);

        $response = $this->withToken($this->tokenFor($student->user))
            ->postJson('/api/v1/transferee-credits/submit');

        $response->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.0.status', 'pending');
        foreach ([$first, $second] as $credit) {
            $credit->refresh();
            self::assertSame(TransfereeCreditStatus::Pending, $credit->status);
            self::assertNotNull($credit->submitted_at);
        }
        $notification = Notification::query()->where('user_id', $chair->id)->sole();
        self::assertSame(NotificationType::TransfereeCreditRequested, $notification->type);
        self::assertStringContainsString('2 subjects', $notification->message);
        self::assertSame(2, AuditLog::query()->where('action', AuditAction::TRANSFEREE_CREDIT_SUBMITTED)->count());
    }

    public function test_submitting_twice_changes_nothing_the_second_time(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $this->makeCredit($student, null, TransfereeCreditStatus::Draft);
        $chair = $this->makeUser(UserRole::ProgramChair, CollegeCode::Ccs);
        $token = $this->tokenFor($student->user);

        $this->withToken($token)->postJson('/api/v1/transferee-credits/submit')
            ->assertOk()->assertJsonCount(1, 'data');
        $this->withToken($token)->postJson('/api/v1/transferee-credits/submit')
            ->assertOk()->assertJsonCount(0, 'data');

        self::assertSame(1, Notification::query()->where('user_id', $chair->id)->count());
        self::assertSame(1, AuditLog::query()->where('action', AuditAction::TRANSFEREE_CREDIT_SUBMITTED)->count());
    }

    public function test_submitting_with_nothing_saved_is_an_empty_success(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $chair = $this->makeUser(UserRole::ProgramChair, CollegeCode::Ccs);

        $this->withToken($this->tokenFor($student->user))->postJson('/api/v1/transferee-credits/submit')
            ->assertOk()->assertJsonCount(0, 'data');

        self::assertSame(0, Notification::query()->where('user_id', $chair->id)->count());
    }

    public function test_submit_leaves_other_students_drafts_and_the_students_own_sent_rows_alone(): void
    {
        $curriculum = $this->makeCurriculum(CollegeCode::Ccs);
        $student = $this->makeStudent($curriculum);
        $other = $this->makeStudent($curriculum);
        $mine = $this->makeCredit($student, null, TransfereeCreditStatus::Draft);
        $sent = $this->makeCredit($student, null, TransfereeCreditStatus::Endorsed);
        $theirs = $this->makeCredit($other, null, TransfereeCreditStatus::Draft);

        $this->withToken($this->tokenFor($student->user))->postJson('/api/v1/transferee-credits/submit')
            ->assertOk()->assertJsonCount(1, 'data');

        self::assertSame(TransfereeCreditStatus::Pending, $mine->refresh()->status);
        self::assertSame(TransfereeCreditStatus::Endorsed, $sent->refresh()->status);
        self::assertSame(TransfereeCreditStatus::Draft, $theirs->refresh()->status);
    }

    public function test_only_a_student_can_submit_a_list(): void
    {
        $chair = $this->makeUser(UserRole::ProgramChair, CollegeCode::Ccs);

        $this->withToken($this->tokenFor($chair))->postJson('/api/v1/transferee-credits/submit')
            ->assertForbidden();
    }

    public function test_a_program_chair_recorded_credit_is_pending_at_once_not_a_draft(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $chair = $this->makeUser(UserRole::ProgramChair, CollegeCode::Ccs);

        $this->withToken($this->tokenFor($chair))->postJson('/api/v1/transferee-credits', $this->studentRequestPayload([
            'student_id' => $student->id,
        ]))->assertCreated()->assertJsonPath('data.status', 'pending');
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `php artisan test tests/Feature/Api/V1/TransfereeCreditsEndpointTest.php`
Expected: FAIL (the submit route does not exist; a student's request is `pending`; drafts are not hidden).

- [ ] **Step 3: Write the implementation**

`backend/app/Models/TransfereeCredit.php`: replace the whole `scopeVisibleTo` method (and its docblock) with:

```php
    /**
     * Who may see which credits (ADR 0026, amended): the Registrar Head decides
     * credits and Registrar Staff follow them, both reading every credit; a
     * Program Chair reads their own college's students' credits; a Student
     * reads their own.
     *
     * A `draft` is the student's own saved list, not yet sent, and is private to
     * them: no other role sees one, however it asks.
     *
     * An `approved` credit that is mapped to a subject counts as credited for
     * eligibility, standing, promotion and the prospectus (see
     * `App\Actions\Academic\ResolveCreditedSubjectIds`); it carries no GRC
     * grade, so PRD §17's cross-institution grade equivalence stays open and
     * nothing here feeds a GWA.
     *
     * @param  Builder<TransfereeCredit>  $query
     * @return Builder<TransfereeCredit>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        $notDraft = TransfereeCreditStatus::Draft->value;

        if (in_array($user->role, [UserRole::RegistrarStaff, UserRole::RegistrarHead], true)) {
            return $query->where('status', '!=', $notDraft);
        }

        if ($user->role === UserRole::ProgramChair) {
            $query->where('status', '!=', $notDraft);

            if ($user->college !== null) {
                return $query->whereHas(
                    'student.program',
                    fn ($programQuery) => $programQuery->where('college', $user->college->value),
                );
            }

            return $query;
        }

        return $query->whereHas(
            'student',
            fn ($studentQuery) => $studentQuery->where('user_id', $user->id),
        );
    }
```

Replace `backend/app/Actions/Academic/CreateTransfereeCredit.php` entirely with:

```php
<?php

namespace App\Actions\Academic;

use App\Domain\Academic\TransfereeCreditStatus;
use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Identity\UserRole;
use App\Models\StudentProfile;
use App\Models\TransfereeCredit;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Records one credit: saved by the Student for themselves, or recorded by a
 * Program Chair for a student in their college (ADR 0026, amended).
 *
 * A Student's credit starts as a `draft`: it sits in their own list, grants
 * nothing, is seen by nobody else and notifies nobody until they send the whole
 * list (`SubmitTransfereeCredits`). A Program Chair's credit starts `pending`
 * at once, because the Chair is already the one who maps it. Neither is ever
 * mapped to a subject here for a Student: `subject_id` is the Program Chair's
 * decision (`SuggestCreditSubjects` only advises).
 *
 * Who the credit is for is decided here, not by the payload: a Student's
 * `student_id` is pinned to their own profile and anything they send is
 * ignored, and a Program Chair may only name a student in their own college.
 *
 * Saving twice is safe: an identical request (same student, school, subject
 * title and code) that is still in the student's list or in the workflow
 * returns the existing row instead of a duplicate. A Program Chair's request is
 * compared only with rows the Chair can see (not the student's drafts).
 */
final readonly class CreateTransfereeCredit
{
    public function __construct(private AuditRecorder $auditRecorder) {}

    /**
     * @param  array<string, mixed>  $validated
     *
     * @throws AuthorizationException
     */
    public function execute(array $validated, User $actor, AuditRequestContext $context): TransfereeCredit
    {
        $student = $this->resolveStudent($validated, $actor);
        $isStudent = $actor->role === UserRole::Student;

        $institution = trim((string) $validated['source_institution']);
        $title = trim((string) $validated['source_subject_title']);
        $code = trim((string) ($validated['source_subject_code'] ?? ''));

        $reusableStatuses = array_map(
            static fn (TransfereeCreditStatus $status): string => $status->value,
            $isStudent
                ? [TransfereeCreditStatus::Draft, TransfereeCreditStatus::Pending, TransfereeCreditStatus::Endorsed]
                : [TransfereeCreditStatus::Pending, TransfereeCreditStatus::Endorsed],
        );

        return DB::transaction(function () use ($validated, $actor, $context, $student, $isStudent, $institution, $title, $code, $reusableStatuses): TransfereeCredit {
            $existing = TransfereeCredit::query()
                ->where('student_id', $student->id)
                ->whereIn('status', $reusableStatuses)
                ->whereRaw('LOWER(TRIM(source_institution)) = ?', [mb_strtolower($institution)])
                ->whereRaw('LOWER(TRIM(source_subject_title)) = ?', [mb_strtolower($title)])
                ->whereRaw('LOWER(TRIM(source_subject_code)) = ?', [mb_strtolower($code)])
                ->lockForUpdate()
                ->first();

            if ($existing !== null) {
                return $existing->load(['student.user', 'subject']);
            }

            $credit = TransfereeCredit::create([
                'student_id' => $student->id,
                'source_institution' => $institution,
                'source_subject_code' => $code,
                'source_subject_title' => $title,
                'source_grade' => $validated['source_grade'] ?? null,
                'credited_units' => $validated['credited_units'],
                'source_school_year' => $validated['source_school_year'] ?? null,
                'source_semester' => $validated['source_semester'] ?? null,
                'subject_id' => $isStudent ? null : ($validated['subject_id'] ?? null),
                'requested_by' => $actor->id,
                'status' => $isStudent ? TransfereeCreditStatus::Draft : TransfereeCreditStatus::Pending,
            ]);

            $this->auditRecorder->record(
                $actor,
                AuditAction::TRANSFEREE_CREDIT_CREATED,
                AuditableType::TRANSFEREE_CREDIT,
                $credit->id,
                null,
                [
                    'student_id' => $credit->student_id,
                    'subject_id' => $credit->subject_id,
                    'credited_units' => $credit->credited_units,
                    'status' => $credit->status->value,
                ],
                null,
                $context,
            );

            return $credit->refresh()->load(['student.user', 'subject']);
        });
    }

    /**
     * @param  array<string, mixed>  $validated
     *
     * @throws AuthorizationException
     */
    private function resolveStudent(array $validated, User $actor): StudentProfile
    {
        if ($actor->role === UserRole::Student) {
            $profile = StudentProfile::query()->with('program')->where('user_id', $actor->id)->first();

            if ($profile === null) {
                throw ValidationException::withMessages(['student_id' => 'Your student record could not be found.']);
            }

            return $profile;
        }

        $studentId = $validated['student_id'] ?? null;
        if ($studentId === null) {
            throw ValidationException::withMessages(['student_id' => 'Choose the student this credit is for.']);
        }

        $student = StudentProfile::query()->with('program')->findOrFail((int) $studentId);

        if (
            $actor->role === UserRole::ProgramChair
            && $actor->college !== null
            && $student->program->college !== $actor->college
        ) {
            throw new AuthorizationException('This student is not in your college.');
        }

        return $student;
    }
}
```

Create `backend/app/Actions/Academic/SubmitTransfereeCredits.php`:

```php
<?php

namespace App\Actions\Academic;

use App\Domain\Academic\TransfereeCreditStatus;
use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Notifications\NotificationType;
use App\Models\StudentProfile;
use App\Models\TransfereeCredit;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use App\Support\Notifications\NotificationRecorder;
use App\Support\Notifications\ProgramChairRecipients;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A Student sends their whole saved list to the Program Chair (ADR 0026,
 * amended): every `draft` of theirs becomes `pending` with `submitted_at`, and
 * the Program Chairs of the student's college get one notice with the count.
 *
 * Idempotent: the student's profile row is locked first, so two quick taps run
 * one after the other, and the second finds no draft, changes nothing, notifies
 * nobody and returns an empty collection. Only the caller's own drafts are ever
 * touched: the student is pinned to the caller, never read from the payload.
 */
final readonly class SubmitTransfereeCredits
{
    public function __construct(
        private AuditRecorder $auditRecorder,
        private NotificationRecorder $notificationRecorder,
    ) {}

    /**
     * @return Collection<int, TransfereeCredit> the credits this call sent (empty on a repeat)
     */
    public function execute(User $actor, AuditRequestContext $context): Collection
    {
        $student = StudentProfile::query()->with('program')->where('user_id', $actor->id)->first();

        if ($student === null) {
            throw ValidationException::withMessages(['student_id' => 'Your student record could not be found.']);
        }

        return DB::transaction(function () use ($student, $actor, $context): Collection {
            // The profile row is the lock for this student's whole list.
            StudentProfile::query()->whereKey($student->id)->lockForUpdate()->firstOrFail();

            $drafts = TransfereeCredit::query()
                ->where('student_id', $student->id)
                ->where('status', TransfereeCreditStatus::Draft->value)
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            if ($drafts->isEmpty()) {
                return $drafts;
            }

            $submittedAt = now();

            foreach ($drafts as $credit) {
                $before = ['status' => $credit->status->value];

                $credit->forceFill([
                    'status' => TransfereeCreditStatus::Pending,
                    'submitted_at' => $submittedAt,
                ])->save();

                $this->auditRecorder->record(
                    $actor,
                    AuditAction::TRANSFEREE_CREDIT_SUBMITTED,
                    AuditableType::TRANSFEREE_CREDIT,
                    $credit->id,
                    $before,
                    ['status' => TransfereeCreditStatus::Pending->value],
                    null,
                    $context,
                );
            }

            $count = $drafts->count();

            $this->notificationRecorder->recordMany(
                ProgramChairRecipients::forStudent($student),
                NotificationType::TransfereeCreditRequested,
                sprintf(
                    'Student %s submitted %d %s for credit mapping.',
                    $student->student_number,
                    $count,
                    $count === 1 ? 'subject' : 'subjects',
                ),
            );

            return $drafts->load(['student.user', 'subject']);
        });
    }
}
```

`backend/app/Policies/TransfereeCreditPolicy.php`: after the `create` method add:

```php

    /**
     * A Student sends their own saved list to the Program Chair (the Action
     * pins it to the caller).
     */
    public function submit(User $user): bool
    {
        return $user->role === UserRole::Student;
    }
```

`backend/app/Http/Controllers/Api/V1/TransfereeCreditController.php`: add `use App\Actions\Academic\SubmitTransfereeCredits;` after `use App\Actions\Academic\ListTransfereeCredits;`, and insert this method before the `update` method (anchor: the docblock `@throws AuthenticationException` that directly precedes `public function update(`):

```php
    /**
     * A Student sends every credit they have saved to the Program Chair. A
     * repeat finds nothing to send and answers 200 with an empty list.
     *
     * @throws AuthenticationException
     */
    public function submit(
        Request $request,
        SubmitTransfereeCredits $submitter,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);
        $this->authorize('submit', TransfereeCredit::class);

        $credits = $submitter->execute($actor, $contextFactory->fromRequest($request));

        return $this->cachePrivateResponse(TransfereeCreditResource::collection($credits)->response($request));
    }

```

`backend/routes/api.php`: after the line `Route::post('/transferee-credits', [TransfereeCreditController::class, 'store'])->name('transferee-credits.store');` add:

```php
        Route::post('/transferee-credits/submit', [TransfereeCreditController::class, 'submit'])->name('transferee-credits.submit');
```

and update the comment above the credit routes to read (replace the four-line comment that starts `// FR-FIN-003 / PRD §3.8, §10.3:`):

```php
        // FR-FIN-003 / PRD §3.8, §10.3, ADR 0026 (amended): a Student saves their
        // subjects as a private draft list and submits it, the Program Chair maps
        // and endorses, the Registrar Head decides (Registrar Staff read only).
        // No `role:` middleware — TransfereeCreditPolicy resolves every ability
        // per request, the same shape WithdrawalRequestController uses.
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `php artisan test tests/Feature/Api/V1/TransfereeCreditsEndpointTest.php`
Expected: PASS for everything added or edited in this task. Existing Registrar-Staff approval tests still pass at this point (their conversion is Task 4). Then `vendor/bin/pint` on the changed PHP files and `vendor/bin/phpstan analyse --memory-limit=1G` on the new and rewritten Action files (clean).

- [ ] **Step 5: Checkpoint**

Update the `PROGRESS.md` entry (Task 2 done, with the test counts that actually ran). **Do not commit.**

---

### Task 3: The student edits and removes their own drafts

**Files:**
- Modify: `backend/app/Policies/TransfereeCreditPolicy.php`
- Rewrite: `backend/app/Http/Requests/Api/V1/TransfereeCredit/UpdateTransfereeCreditRequest.php`
- Modify: `backend/app/Actions/Academic/UpdateTransfereeCredit.php` (`updateContent`)
- Create: `backend/app/Actions/Academic/DeleteTransfereeCreditDraft.php`
- Modify: `backend/app/Http/Controllers/Api/V1/TransfereeCreditController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/Api/V1/TransfereeCreditsEndpointTest.php`

**Interfaces:**
- Consumes: Task 1's `AuditAction::TRANSFEREE_CREDIT_DELETED`, Task 2's `Draft` creation.
- Produces: `PATCH /api/v1/transferee-credits/{id}` accepted from the owning Student while the row is a `draft` (content fields only; `action` and `subject_id` are prohibited for a Student); `DELETE /api/v1/transferee-credits/{id}` (route name `api.v1.transferee-credits.destroy`, 204); `TransfereeCreditPolicy::editDraft(User, TransfereeCredit): bool`, `::deleteDraft(User, TransfereeCredit): bool`; the Program Chair's `update` ability is **false** for a draft; `DeleteTransfereeCreditDraft::execute(TransfereeCredit, User, AuditRequestContext): void`.

- [ ] **Step 1: Write the failing tests**

Add before the closing `}` of `TransfereeCreditsEndpointTest`:

```php
    // ------------------------------------------------------ editing and removing drafts

    public function test_a_student_edits_their_own_draft(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $credit = $this->makeCredit($student, null, TransfereeCreditStatus::Draft);

        $this->withToken($this->tokenFor($student->user))
            ->patchJson("/api/v1/transferee-credits/{$credit->id}", [
                'source_subject_title' => 'Edited Title',
                'credited_units' => 2.5,
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.source_subject_title', 'Edited Title')
            ->assertJsonPath('data.credited_units', 2.5);

        self::assertSame(
            1,
            AuditLog::query()->where('action', AuditAction::TRANSFEREE_CREDIT_UPDATED)->count(),
        );
    }

    public function test_a_student_cannot_edit_a_credit_that_has_already_been_sent(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $credit = $this->makeCredit($student);

        $this->withToken($this->tokenFor($student->user))
            ->patchJson("/api/v1/transferee-credits/{$credit->id}", ['source_subject_title' => 'Changed'])
            ->assertUnprocessable();

        self::assertSame('Introduction to Programming', $credit->refresh()->source_subject_title);
    }

    public function test_a_student_cannot_edit_another_students_draft(): void
    {
        $curriculum = $this->makeCurriculum(CollegeCode::Ccs);
        $student = $this->makeStudent($curriculum);
        $other = $this->makeStudent($curriculum);
        $credit = $this->makeCredit($other, null, TransfereeCreditStatus::Draft);

        $this->withToken($this->tokenFor($student->user))
            ->patchJson("/api/v1/transferee-credits/{$credit->id}", ['source_subject_title' => 'Changed'])
            ->assertForbidden();
    }

    public function test_a_student_can_neither_map_a_draft_nor_take_a_workflow_step(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $subject = $this->makeSubject('CS101', 'Introduction to Computing');
        $credit = $this->makeCredit($student, null, TransfereeCreditStatus::Draft);
        $token = $this->tokenFor($student->user);

        $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", ['subject_id' => $subject->id])
            ->assertUnprocessable();
        $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", ['action' => 'endorse'])
            ->assertUnprocessable();

        $credit->refresh();
        self::assertNull($credit->subject_id);
        self::assertSame(TransfereeCreditStatus::Draft, $credit->status);
    }

    public function test_a_program_chair_cannot_touch_a_students_draft(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $subject = $this->makeSubject('CS101', 'Introduction to Computing');
        $credit = $this->makeCredit($student, $subject->id, TransfereeCreditStatus::Draft);
        $chair = $this->makeUser(UserRole::ProgramChair, CollegeCode::Ccs);
        $token = $this->tokenFor($chair);

        $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", ['credited_units' => 5])
            ->assertForbidden();
        $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", ['action' => 'endorse'])
            ->assertForbidden();
        $this->withToken($token)->getJson("/api/v1/transferee-credits/{$credit->id}/suggestions")
            ->assertForbidden();

        self::assertSame(TransfereeCreditStatus::Draft, $credit->refresh()->status);
    }

    public function test_a_student_removes_their_own_draft(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $credit = $this->makeCredit($student, null, TransfereeCreditStatus::Draft);

        $this->withToken($this->tokenFor($student->user))
            ->deleteJson("/api/v1/transferee-credits/{$credit->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('transferee_credits', ['id' => $credit->id]);
        self::assertSame(
            1,
            AuditLog::query()->where('action', AuditAction::TRANSFEREE_CREDIT_DELETED)->count(),
        );
    }

    public function test_a_student_cannot_remove_a_credit_that_has_already_been_sent(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $credit = $this->makeCredit($student);

        $this->withToken($this->tokenFor($student->user))
            ->deleteJson("/api/v1/transferee-credits/{$credit->id}")
            ->assertUnprocessable();

        $this->assertDatabaseHas('transferee_credits', ['id' => $credit->id]);
    }

    public function test_a_student_cannot_remove_another_students_draft(): void
    {
        $curriculum = $this->makeCurriculum(CollegeCode::Ccs);
        $student = $this->makeStudent($curriculum);
        $other = $this->makeStudent($curriculum);
        $credit = $this->makeCredit($other, null, TransfereeCreditStatus::Draft);

        $this->withToken($this->tokenFor($student->user))
            ->deleteJson("/api/v1/transferee-credits/{$credit->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('transferee_credits', ['id' => $credit->id]);
    }

    public function test_staff_roles_cannot_remove_a_draft(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $credit = $this->makeCredit($student, null, TransfereeCreditStatus::Draft);
        $head = $this->makeUser(UserRole::RegistrarHead);

        $this->withToken($this->tokenFor($head))
            ->deleteJson("/api/v1/transferee-credits/{$credit->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('transferee_credits', ['id' => $credit->id]);
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `php artisan test tests/Feature/Api/V1/TransfereeCreditsEndpointTest.php --filter=draft`
Expected: FAIL (a student's PATCH is refused, no DELETE route).

- [ ] **Step 3: Write the implementation**

`backend/app/Policies/TransfereeCreditPolicy.php`:
1. Add `use App\Domain\Academic\TransfereeCreditStatus;` above `use App\Domain\Identity\UserRole;`.
2. After the `submit` method (Task 2) add:

```php

    /**
     * A Student edits only their own draft. The Action re-checks that it is still
     * a draft under the row lock.
     */
    public function editDraft(User $user, TransfereeCredit $credit): bool
    {
        if ($user->role !== UserRole::Student) {
            return false;
        }

        $credit->loadMissing('student');

        return $credit->student->user_id === $user->id;
    }

    /**
     * A Student removes only their own draft (`DeleteTransfereeCreditDraft`).
     */
    public function deleteDraft(User $user, TransfereeCredit $credit): bool
    {
        return $this->editDraft($user, $credit);
    }
```

3. In `update`, replace

```php
        if ($user->role !== UserRole::ProgramChair) {
            return false;
        }

        return $credit === null || $this->chairOwns($user, $credit);
```

with

```php
        if ($user->role !== UserRole::ProgramChair) {
            return false;
        }

        // A draft is the student's private list: the Program Chair has no access to one.
        if ($credit !== null && $credit->status === TransfereeCreditStatus::Draft) {
            return false;
        }

        return $credit === null || $this->chairOwns($user, $credit);
```

Replace `backend/app/Http/Requests/Api/V1/TransfereeCredit/UpdateTransfereeCreditRequest.php` entirely with:

```php
<?php

namespace App\Http\Requests\Api\V1\TransfereeCredit;

use App\Domain\Academic\TransfereeCreditStatus;
use App\Domain\Identity\UserRole;
use App\Models\TransfereeCredit;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * One route serves every step after a credit exists, told apart by `action`
 * (ADR 0026; see `UpdateTransfereeCredit`):
 *
 *   - none, by the Student: the student corrects their own `draft`;
 *   - none, by the Program Chair: corrects or maps a `pending` credit;
 *   - `endorse`: the Program Chair endorses a `pending` credit (the request
 *     may carry `subject_id` / `credited_units` to map it in the same step,
 *     and there must be a mapped subject by the end);
 *   - `decline`: the Program Chair rejects a `pending` request, with a reason;
 *   - `approve` / `reject` / `return`: the Registrar Head decides an `endorsed`
 *     credit; `reject` and `return` need a reason, and `return` sends the
 *     credit back to the Program Chair as `pending`.
 *
 * A reason is recorded only in the audit row, since `transferee_credits` has
 * no column of its own for it (mirrors `UpdateWithdrawalRequestRequest`).
 */
final class UpdateTransfereeCreditRequest extends FormRequest
{
    private const PROHIBITS_CONTENT = 'prohibited_if:action,approve,reject,decline';

    private const REASON_REQUIRED_ACTIONS = ['decline', 'reject'];

    /** @var list<string> Actions that need the credit to be `endorsed`. */
    private const NEEDS_ENDORSED = ['approve', 'reject'];

    /**
     * Authorization comes first, so a role that may not take this step gets a
     * 403 rather than a validation message about the credit's status: the
     * Registrar Head decides (`approve`, `reject`, `return`); a Student edits
     * only their own draft; the Program Chair of the student's college does
     * everything else (`TransfereeCreditPolicy`).
     */
    public function authorize(): bool
    {
        $user = $this->user();
        $credit = $this->route('transfereeCredit');

        if ($user === null || ! $credit instanceof TransfereeCredit) {
            return false;
        }

        $action = $this->input('action');

        if (is_string($action) && in_array($action, self::NEEDS_ENDORSED, true)) {
            return $user->can('decide', TransfereeCredit::class);
        }

        return $user->role === UserRole::Student
            ? $user->can('editDraft', $credit)
            : $user->can('update', $credit);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $isStudent = $this->user()?->role === UserRole::Student;

        return [
            // A Student only corrects the content of their own draft: no workflow step, no mapping.
            'action' => $isStudent
                ? ['prohibited']
                : ['sometimes', 'string', Rule::in(['endorse', 'decline', 'approve', 'reject'])],
            'reason' => [
                Rule::requiredIf(fn (): bool => in_array($this->input('action'), self::REASON_REQUIRED_ACTIONS, true)),
                'nullable',
                'string',
                'max:1000',
            ],
            'source_institution' => [self::PROHIBITS_CONTENT, 'sometimes', 'string', 'max:255'],
            'source_subject_code' => [self::PROHIBITS_CONTENT, 'sometimes', 'nullable', 'string', 'max:50'],
            'source_subject_title' => [self::PROHIBITS_CONTENT, 'sometimes', 'string', 'max:255'],
            'source_grade' => [self::PROHIBITS_CONTENT, 'sometimes', 'nullable', 'string', 'max:20'],
            'source_school_year' => [self::PROHIBITS_CONTENT, 'sometimes', 'nullable', 'string', 'max:32'],
            'source_semester' => [self::PROHIBITS_CONTENT, 'sometimes', 'nullable', 'string', 'max:32'],
            'credited_units' => [self::PROHIBITS_CONTENT, 'sometimes', 'decimal:0,1', 'gt:0', 'max:99.9'],
            'subject_id' => $isStudent
                ? ['prohibited']
                : [self::PROHIBITS_CONTENT, 'sometimes', 'nullable', 'integer', 'exists:subjects,id'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            /** @var TransfereeCredit $credit */
            $credit = $this->route('transfereeCredit');
            $action = $this->input('action');

            $required = match (true) {
                is_string($action) && in_array($action, self::NEEDS_ENDORSED, true) => TransfereeCreditStatus::Endorsed,
                $this->user()?->role === UserRole::Student => TransfereeCreditStatus::Draft,
                default => TransfereeCreditStatus::Pending,
            };

            if ($credit->status !== $required) {
                if (is_string($action)) {
                    $validator->errors()->add(
                        'action',
                        "This action requires the transferee credit to currently be '{$required->value}'; ".
                        "it is currently '{$credit->status->value}'.",
                    );
                } else {
                    $validator->errors()->add(
                        'source_institution',
                        "This transferee credit is '{$credit->status->value}' and can no longer be edited directly.",
                    );
                }

                return;
            }

            if ($action === 'endorse') {
                $mapped = $this->has('subject_id') ? $this->input('subject_id') : $credit->subject_id;

                if ($mapped === null) {
                    $validator->errors()->add('subject_id', 'Map this credit to a subject before endorsing it.');
                }
            }
        });
    }
}
```

`backend/app/Actions/Academic/UpdateTransfereeCredit.php`, in `updateContent`, replace

```php
            if ($lockedCredit->status !== TransfereeCreditStatus::Pending) {
                throw ValidationException::withMessages([
                    'source_institution' => "This transferee credit is '{$lockedCredit->status->value}' and can no longer be edited directly.",
                ]);
            }
```

with

```php
            // A Student corrects only their own draft; the Program Chair corrects a pending credit.
            $editable = $actor->role === UserRole::Student
                ? TransfereeCreditStatus::Draft
                : TransfereeCreditStatus::Pending;

            if ($lockedCredit->status !== $editable) {
                throw ValidationException::withMessages([
                    'source_institution' => "This transferee credit is '{$lockedCredit->status->value}' and can no longer be edited directly.",
                ]);
            }
```

Create `backend/app/Actions/Academic/DeleteTransfereeCreditDraft.php`:

```php
<?php

namespace App\Actions\Academic;

use App\Domain\Academic\TransfereeCreditStatus;
use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Models\TransfereeCredit;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A Student removes a subject from their own saved list (ADR 0026, amended).
 * Only a `draft` can go: once the list is sent the row is part of the workflow
 * and a record other people have acted on, so it is never deleted. Whose row it
 * is is `TransfereeCreditPolicy::deleteDraft`; the status is re-checked here
 * under the row lock. The removal is audited (before-values only, no content of
 * a transcript beyond the row's own fields).
 */
final readonly class DeleteTransfereeCreditDraft
{
    public function __construct(private AuditRecorder $auditRecorder) {}

    public function execute(TransfereeCredit $credit, User $actor, AuditRequestContext $context): void
    {
        DB::transaction(function () use ($credit, $actor, $context): void {
            $locked = TransfereeCredit::query()->whereKey($credit->id)->lockForUpdate()->first();

            // Gone already (a double tap that raced this one): nothing left to do.
            if ($locked === null) {
                return;
            }

            if ($locked->status !== TransfereeCreditStatus::Draft) {
                throw ValidationException::withMessages([
                    'status' => "Only a draft can be removed; this credit is '{$locked->status->value}'.",
                ]);
            }

            $before = [
                'status' => $locked->status->value,
                'credited_units' => $locked->credited_units,
                'subject_id' => $locked->subject_id,
            ];

            $locked->delete();

            $this->auditRecorder->record(
                $actor,
                AuditAction::TRANSFEREE_CREDIT_DELETED,
                AuditableType::TRANSFEREE_CREDIT,
                $locked->id,
                $before,
                null,
                null,
                $context,
            );
        });
    }
}
```

`backend/app/Http/Controllers/Api/V1/TransfereeCreditController.php`:
1. Add imports `use App\Actions\Academic\DeleteTransfereeCreditDraft;` (before `ListTransfereeCredits`) and `use App\Domain\Identity\UserRole;` (before `use App\Http\Controllers\Controller;`).
2. In `update`, replace

```php
        $ability = is_string($action) && isset(self::ABILITY_FOR_ACTION[$action])
            ? self::ABILITY_FOR_ACTION[$action]
            : 'update';

        $transfereeCredit->loadMissing('student.program');
        $this->authorize($ability, $ability === 'update' ? $transfereeCredit : TransfereeCredit::class);
```

with

```php
        $ability = is_string($action) && isset(self::ABILITY_FOR_ACTION[$action])
            ? self::ABILITY_FOR_ACTION[$action]
            : ($actor->role === UserRole::Student ? 'editDraft' : 'update');

        $transfereeCredit->loadMissing('student.program');
        $this->authorize($ability, $ability === 'decide' ? TransfereeCredit::class : $transfereeCredit);
```

3. Add this method after `update` (before the `suggestions` docblock):

```php
    /**
     * A Student removes a subject from their own saved list. Only a draft can
     * be removed.
     *
     * @throws AuthenticationException
     */
    public function destroy(
        Request $request,
        TransfereeCredit $transfereeCredit,
        DeleteTransfereeCreditDraft $deleter,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);
        $this->authorize('deleteDraft', $transfereeCredit);

        $deleter->execute($transfereeCredit, $actor, $contextFactory->fromRequest($request));

        return $this->cachePrivateResponse(new JsonResponse(null, 204));
    }

```

`backend/routes/api.php`: after the `transferee-credits.update` line add:

```php
        Route::delete('/transferee-credits/{transfereeCredit}', [TransfereeCreditController::class, 'destroy'])->name('transferee-credits.destroy');
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `php artisan test tests/Feature/Api/V1/TransfereeCreditsEndpointTest.php`
Expected: PASS (the whole file: the earlier Chair tests still pass because the Chair's edits of `pending` credits are unchanged). Then `vendor/bin/pint` on the changed PHP files and `vendor/bin/phpstan analyse --memory-limit=1G` on `DeleteTransfereeCreditDraft.php`, `UpdateTransfereeCreditRequest.php` and the policy.

- [ ] **Step 5: Checkpoint**

`PROGRESS.md`: Task 3 done with the actual counts. **Do not commit.**

---

### Task 4: The Registrar Head decides, and can return a credit to the Program Chair

**Files:**
- Modify: `backend/app/Policies/TransfereeCreditPolicy.php` (`decide`, class docblock)
- Modify: `backend/app/Http/Requests/Api/V1/TransfereeCredit/UpdateTransfereeCreditRequest.php`
- Modify: `backend/app/Actions/Academic/UpdateTransfereeCredit.php`
- Modify: `backend/app/Http/Controllers/Api/V1/TransfereeCreditController.php` (`ABILITY_FOR_ACTION`)
- Modify: `backend/app/Http/Resources/Api/V1/TransfereeCreditResource.php`
- Test: `backend/tests/Feature/Api/V1/TransfereeCreditsEndpointTest.php`

**Interfaces:**
- Consumes: Task 1's `Pending`, `returned_*` columns, `AuditAction::TRANSFEREE_CREDIT_RETURNED`, `NotificationType::TransfereeCreditReturned`; existing `ProgramChairRecipients::forStudent`.
- Produces: `TransfereeCreditPolicy::decide(User): bool` true for **`RegistrarHead` only**; PATCH `{"action": "return", "reason": "<required>"}` (`endorsed` → `pending`, clears `endorsed_by`/`endorsed_at`, sets `returned_by`/`returned_at`/`return_reason`, notifies the Program Chairs of the student's college); endorse notice goes to the `RegistrarHead` role; endorsing again clears the return fields; `TransfereeCreditResource` gains `submitted_at`, `returned_at` (ISO UTC strings or null) and `return_reason` (string or null).

- [ ] **Step 1: Write the failing tests**

In `backend/tests/Feature/Api/V1/TransfereeCreditsEndpointTest.php`:

(a) Replace the whole method `test_a_program_chair_endorses_a_mapped_credit_and_registrar_staff_are_told` with:

```php
    public function test_a_program_chair_endorses_a_mapped_credit_and_the_registrar_head_is_told(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $subject = $this->makeSubject('CS101', 'Introduction to Computing');
        $credit = $this->makeCredit($student, $subject->id);
        $chair = $this->makeUser(UserRole::ProgramChair, CollegeCode::Ccs);
        $staff = $this->makeUser(UserRole::RegistrarStaff);
        $head = $this->makeUser(UserRole::RegistrarHead);

        $response = $this->withToken($this->tokenFor($chair))->patchJson("/api/v1/transferee-credits/{$credit->id}", [
            'action' => 'endorse',
        ]);

        $response->assertOk()->assertJsonPath('data.status', 'endorsed');
        $credit->refresh();
        self::assertSame(TransfereeCreditStatus::Endorsed, $credit->status);
        self::assertSame($chair->id, $credit->endorsed_by);
        self::assertNotNull($credit->endorsed_at);
        self::assertSame(
            AuditAction::TRANSFEREE_CREDIT_ENDORSED,
            AuditLog::query()->where('auditable_type', 'transferee_credit')->sole()->action,
        );
        self::assertSame(NotificationType::TransfereeCreditEndorsed, Notification::query()->where('user_id', $head->id)->sole()->type);
        self::assertSame(0, Notification::query()->where('user_id', $staff->id)->count());
    }
```

(b) In `test_a_program_chair_can_never_approve_or_reject_a_credit`, after the `reject` call and before the final assertion, add:

```php
        $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", ['action' => 'return', 'reason' => 'x'])
            ->assertForbidden();
```

(c) Replace everything from the comment line `// -------------------------------------------------------- registrar decision` through the end of `test_a_registrar_head_cannot_decide_a_transferee_credit` (the method just before `// ---------------------------------------------------------------- visibility`) with:

```php
    // ------------------------------------------------------ registrar head decision

    public function test_the_registrar_head_approves_an_endorsed_credit(): void
    {
        // This also covers a credit the Program Chair endorsed before the approver moved from
        // Registrar Staff to the Registrar Head: an `endorsed` row simply becomes the Head's.
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $subject = $this->makeSubject('CS101', 'Introduction to Computing');
        $credit = $this->makeCredit($student, $subject->id, TransfereeCreditStatus::Endorsed);
        $head = $this->makeUser(UserRole::RegistrarHead);

        $response = $this->withToken($this->tokenFor($head))->patchJson("/api/v1/transferee-credits/{$credit->id}", [
            'action' => 'approve',
        ]);

        $response->assertOk()->assertJsonPath('data.status', 'approved');
        $credit->refresh();
        self::assertSame(TransfereeCreditStatus::Approved, $credit->status);
        self::assertSame($head->id, $credit->processed_by);
        self::assertNotNull($credit->processed_at);
        self::assertSame(
            AuditAction::TRANSFEREE_CREDIT_APPROVED,
            AuditLog::query()->where('auditable_type', 'transferee_credit')->sole()->action,
        );
        self::assertSame(NotificationType::TransfereeCreditApproved, Notification::query()->where('user_id', $student->user_id)->sole()->type);
    }

    public function test_the_registrar_head_cannot_approve_a_credit_the_chair_has_not_endorsed(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $credit = $this->makeCredit($student);
        $head = $this->makeUser(UserRole::RegistrarHead);

        $this->withToken($this->tokenFor($head))->patchJson("/api/v1/transferee-credits/{$credit->id}", [
            'action' => 'approve',
        ])->assertUnprocessable();

        self::assertSame(TransfereeCreditStatus::Pending, $credit->refresh()->status);
    }

    public function test_approving_twice_has_no_second_effect(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $subject = $this->makeSubject('CS101', 'Introduction to Computing');
        $credit = $this->makeCredit($student, $subject->id, TransfereeCreditStatus::Endorsed);
        $head = $this->makeUser(UserRole::RegistrarHead);
        $token = $this->tokenFor($head);

        $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", ['action' => 'approve'])->assertOk();
        $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", ['action' => 'approve'])->assertUnprocessable();

        self::assertSame(1, Notification::query()->where('user_id', $student->user_id)->count());
        self::assertSame(1, AuditLog::query()->where('action', AuditAction::TRANSFEREE_CREDIT_APPROVED)->count());
    }

    public function test_the_registrar_head_rejects_an_endorsed_credit_requiring_a_reason(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $subject = $this->makeSubject('CS101', 'Introduction to Computing');
        $credit = $this->makeCredit($student, $subject->id, TransfereeCreditStatus::Endorsed);
        $head = $this->makeUser(UserRole::RegistrarHead);
        $token = $this->tokenFor($head);

        $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", ['action' => 'reject'])
            ->assertUnprocessable();

        $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", [
            'action' => 'reject', 'reason' => 'Transcript does not match the record.',
        ])->assertOk()->assertJsonPath('data.status', 'rejected');
    }

    public function test_the_registrar_head_returns_an_endorsed_credit_to_the_program_chair_with_a_reason(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $subject = $this->makeSubject('CS101', 'Introduction to Computing');
        $credit = $this->makeCredit($student, $subject->id, TransfereeCreditStatus::Endorsed);
        $credit->forceFill([
            'endorsed_by' => $this->makeUser(UserRole::ProgramChair, CollegeCode::Ccs)->id,
            'endorsed_at' => now(),
        ])->save();
        $chair = $this->makeUser(UserRole::ProgramChair, CollegeCode::Ccs);
        $otherChair = $this->makeUser(UserRole::ProgramChair, CollegeCode::Coe);
        $head = $this->makeUser(UserRole::RegistrarHead);
        $token = $this->tokenFor($head);

        $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", ['action' => 'return'])
            ->assertUnprocessable();

        $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", [
            'action' => 'return', 'reason' => 'Mapped to the wrong subject.',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.return_reason', 'Mapped to the wrong subject.');

        $credit->refresh();
        self::assertSame(TransfereeCreditStatus::Pending, $credit->status);
        self::assertSame($head->id, $credit->returned_by);
        self::assertNotNull($credit->returned_at);
        self::assertSame('Mapped to the wrong subject.', $credit->return_reason);
        self::assertNull($credit->endorsed_by);
        self::assertNull($credit->endorsed_at);
        self::assertSame(
            'Mapped to the wrong subject.',
            AuditLog::query()->where('action', AuditAction::TRANSFEREE_CREDIT_RETURNED)->sole()->reason,
        );
        self::assertSame(NotificationType::TransfereeCreditReturned, Notification::query()->where('user_id', $chair->id)->sole()->type);
        self::assertSame(0, Notification::query()->where('user_id', $otherChair->id)->count());
        self::assertSame(0, Notification::query()->where('user_id', $student->user_id)->count());
    }

    public function test_a_pending_credit_cannot_be_returned(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $credit = $this->makeCredit($student);
        $head = $this->makeUser(UserRole::RegistrarHead);

        $this->withToken($this->tokenFor($head))->patchJson("/api/v1/transferee-credits/{$credit->id}", [
            'action' => 'return', 'reason' => 'Not endorsed yet.',
        ])->assertUnprocessable();

        self::assertNull($credit->refresh()->returned_at);
    }

    public function test_a_returned_credit_can_be_remapped_and_endorsed_again_and_the_return_is_cleared(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $subject = $this->makeSubject('CS101', 'Introduction to Computing');
        $head = $this->makeUser(UserRole::RegistrarHead);
        $credit = $this->makeCredit($student);
        $credit->forceFill([
            'returned_by' => $head->id,
            'returned_at' => now(),
            'return_reason' => 'Mapped to the wrong subject.',
        ])->save();
        $chair = $this->makeUser(UserRole::ProgramChair, CollegeCode::Ccs);

        $this->withToken($this->tokenFor($chair))->patchJson("/api/v1/transferee-credits/{$credit->id}", [
            'action' => 'endorse', 'subject_id' => $subject->id,
        ])->assertOk()->assertJsonPath('data.status', 'endorsed')->assertJsonPath('data.return_reason', null);

        $credit->refresh();
        self::assertSame($subject->id, $credit->subject_id);
        self::assertNull($credit->returned_by);
        self::assertNull($credit->returned_at);
        self::assertNull($credit->return_reason);
    }

    public function test_registrar_staff_can_neither_edit_nor_endorse(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $subject = $this->makeSubject('CS101', 'Introduction to Computing');
        $credit = $this->makeCredit($student, $subject->id);
        $staff = $this->makeUser(UserRole::RegistrarStaff);
        $token = $this->tokenFor($staff);

        $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", ['credited_units' => 5])
            ->assertForbidden();
        $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", ['action' => 'endorse'])
            ->assertForbidden();

        self::assertSame(TransfereeCreditStatus::Pending, $credit->refresh()->status);
    }

    public function test_registrar_staff_can_no_longer_decide_a_transferee_credit(): void
    {
        $student = $this->makeStudent($this->makeCurriculum(CollegeCode::Ccs));
        $subject = $this->makeSubject('CS101', 'Introduction to Computing');
        $credit = $this->makeCredit($student, $subject->id, TransfereeCreditStatus::Endorsed);
        $staff = $this->makeUser(UserRole::RegistrarStaff);
        $token = $this->tokenFor($staff);

        $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", ['action' => 'approve'])
            ->assertForbidden();
        $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", ['action' => 'reject', 'reason' => 'x'])
            ->assertForbidden();
        $this->withToken($token)->patchJson("/api/v1/transferee-credits/{$credit->id}", ['action' => 'return', 'reason' => 'x'])
            ->assertForbidden();

        self::assertSame(TransfereeCreditStatus::Endorsed, $credit->refresh()->status);
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `php artisan test tests/Feature/Api/V1/TransfereeCreditsEndpointTest.php`
Expected: FAIL (Staff still decide, the Head cannot; `return` is not an accepted action; the endorse notice goes to Staff).

- [ ] **Step 3: Write the implementation**

`backend/app/Policies/TransfereeCreditPolicy.php`:
1. Replace the class docblock's first paragraph (the six lines from ` * Credit mapping is the Program Chair's work; Registrar Staff only approve` to ` * visibility it has over enrollments, grades and withdrawals.`) with:

```php
 * Credit mapping is the Program Chair's work; the Registrar Head decides it
 * (ADR 0026, amended; it superseded PRD §3.8's "Registrar Staff process
 * transferee credit mappings"). A Student saves a list and sends it, a Program
 * Chair maps and endorses each credit, and the Registrar Head approves, rejects
 * or returns the endorsed ones. Registrar Staff keep the read-only "keeper of
 * the official record" visibility they have over enrollments, grades and
 * withdrawals.
```

2. Replace the `decide` method and its docblock with:

```php
    /**
     * Approve, reject or return an endorsed credit. The Registrar Head only:
     * never the Program Chair (who endorses) and never Registrar Staff (read-only).
     */
    public function decide(User $user): bool
    {
        return $user->role === UserRole::RegistrarHead;
    }
```

`backend/app/Http/Requests/Api/V1/TransfereeCredit/UpdateTransfereeCreditRequest.php` (the docblocks already describe `return` since Task 3; only the behavior changes here):
1. Replace the three constants with:

```php
    private const PROHIBITS_CONTENT = 'prohibited_if:action,approve,reject,decline,return';

    private const REASON_REQUIRED_ACTIONS = ['decline', 'reject', 'return'];

    /** @var list<string> Actions that need the credit to be `endorsed`. */
    private const NEEDS_ENDORSED = ['approve', 'reject', 'return'];
```

2. In `rules()`, change `Rule::in(['endorse', 'decline', 'approve', 'reject'])` to `Rule::in(['endorse', 'decline', 'approve', 'reject', 'return'])`.

`backend/app/Actions/Academic/UpdateTransfereeCredit.php` (apply as separate Edits):
1. Add `use App\Support\Notifications\ProgramChairRecipients;` after `use App\Support\Notifications\NotificationRecorder;`.
2. In the class docblock replace the `approve` / `reject` bullet (three lines starting ` *   - \`approve\` / \`reject\` (Registrar Staff,`) with:

```php
 *   - `approve` / `reject` (Registrar Head, `endorsed` → `approved` /
 *     `rejected`): `reject` needs a reason. Tells the Student. The Registrar
 *     Head never sees a credit before it is endorsed and never edits one.
 *   - `return` (Registrar Head, `endorsed` → `pending`): needs a reason. Sends
 *     the credit back to the Program Chair, who may change the mapping and
 *     endorse it again. Tells the Program Chairs of the student's college.
```

3. Replace the three lookup constants' last entries. In `AUDIT_ACTION` replace
```php
        'approve' => AuditAction::TRANSFEREE_CREDIT_APPROVED,
        'reject' => AuditAction::TRANSFEREE_CREDIT_REJECTED,
    ];
```
with
```php
        'approve' => AuditAction::TRANSFEREE_CREDIT_APPROVED,
        'reject' => AuditAction::TRANSFEREE_CREDIT_REJECTED,
        'return' => AuditAction::TRANSFEREE_CREDIT_RETURNED,
    ];
```
In `TARGET_STATUS` replace
```php
        'approve' => TransfereeCreditStatus::Approved,
        'reject' => TransfereeCreditStatus::Rejected,
    ];
```
with
```php
        'approve' => TransfereeCreditStatus::Approved,
        'reject' => TransfereeCreditStatus::Rejected,
        'return' => TransfereeCreditStatus::Pending,
    ];
```
In `REQUIRED_CURRENT_STATUS` replace
```php
        'approve' => TransfereeCreditStatus::Endorsed,
        'reject' => TransfereeCreditStatus::Endorsed,
    ];
```
with
```php
        'approve' => TransfereeCreditStatus::Endorsed,
        'reject' => TransfereeCreditStatus::Endorsed,
        'return' => TransfereeCreditStatus::Endorsed,
    ];
```
4. Replace `$lockedCredit->load('student');` with `$lockedCredit->load('student.program');`.
5. Replace

```php
                $lockedCredit->fill(['endorsed_by' => $actor->id, 'endorsed_at' => now()]);
            } else {
                $lockedCredit->fill(['processed_by' => $actor->id, 'processed_at' => now()]);
            }
```

with

```php
                // A fresh endorsement answers any earlier return.
                $lockedCredit->fill([
                    'endorsed_by' => $actor->id,
                    'endorsed_at' => now(),
                    'returned_by' => null,
                    'returned_at' => null,
                    'return_reason' => null,
                ]);
            } elseif ($action === 'return') {
                $lockedCredit->fill([
                    'endorsed_by' => null,
                    'endorsed_at' => null,
                    'returned_by' => $actor->id,
                    'returned_at' => now(),
                    'return_reason' => $reason,
                ]);
            } else {
                $lockedCredit->fill(['processed_by' => $actor->id, 'processed_at' => now()]);
            }
```

6. Replace `in_array($action, ['decline', 'reject'], true) ? $reason : null,` with `in_array($action, ['decline', 'reject', 'return'], true) ? $reason : null,`.
7. Replace the `notify` method's docblock and its `if ($action === 'endorse') { ... }` block (keep the trailing `Notification::create(...)` that follows) with:

```php
    /**
     * The Student hears about a decision on their own request; the Registrar
     * Head hears that a credit is waiting for them; the Program Chairs hear that
     * the Head sent a credit back.
     */
    private function notify(TransfereeCredit $credit, string $action, ?string $reason): void
    {
        if ($action === 'endorse') {
            $this->notificationRecorder->recordManyForRole(
                UserRole::RegistrarHead,
                NotificationType::TransfereeCreditEndorsed,
                "A transferee credit for student {$credit->student->student_number} ".
                "({$credit->source_subject_title}) was endorsed by the Program Head and awaits your approval.",
            );

            return;
        }

        if ($action === 'return') {
            $this->notificationRecorder->recordMany(
                ProgramChairRecipients::forStudent($credit->student),
                NotificationType::TransfereeCreditReturned,
                "The Registrar Head returned a credit for student {$credit->student->student_number} ".
                "({$credit->source_subject_title}). Reason: {$reason}",
            );

            return;
        }
```

(the existing `Notification::create([...])` for approve/decline/reject stays directly after this block, unchanged, and the method's closing brace stays.)

`backend/app/Http/Controllers/Api/V1/TransfereeCreditController.php`: change the `ABILITY_FOR_ACTION` constant and its docblock to:

```php
    /**
     * Which Policy ability governs a PATCH, resolved from the request's
     * `action` field. The Registrar Head decides (`approve`, `reject`,
     * `return`); anything else — a content edit, `endorse`, `decline` — is the
     * Program Chair's `update` (or, for a Student, `editDraft`). Same shape as
     * `AcademicGradeController::ABILITY_FOR_ACTION`.
     *
     * @var array<string, string>
     */
    private const ABILITY_FOR_ACTION = [
        'approve' => 'decide',
        'reject' => 'decide',
        'return' => 'decide',
    ];
```

`backend/app/Http/Resources/Api/V1/TransfereeCreditResource.php`:
1. In the docblock's return shape add, after `endorsed_at: ?string,`: `submitted_at: ?string,`, `returned_at: ?string,`, `return_reason: ?string,`.
2. In `toArray`, after the `'endorsed_at' => ...` line add:

```php
            'submitted_at' => $this->resource->submitted_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'returned_at' => $this->resource->returned_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'return_reason' => $this->resource->return_reason,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `php artisan test tests/Feature/Api/V1/TransfereeCreditsEndpointTest.php tests/Unit/Models/TransfereeCreditTest.php tests/Unit/Domain`
Expected: PASS. Then `vendor/bin/pint` on the changed PHP files and `vendor/bin/phpstan analyse --memory-limit=1G` on `UpdateTransfereeCredit.php`, the policy and the request (clean).

- [ ] **Step 5: Checkpoint**

`PROGRESS.md`: Task 4 done with the actual counts. **Do not commit.**

---

### Task 5: The enrollment gate does not treat saved drafts as submitted

**Files:**
- Rewrite: `backend/app/Actions/Academic/EvaluateCreditMappingStatus.php`
- Test: `backend/tests/Unit/Actions/Academic/EvaluateCreditMappingStatusTest.php`

**Interfaces:**
- Consumes: Task 1's `Draft`.
- Produces: `CreditMappingStatusResult` keeps its fields; `totalCredits` now counts **submitted** rows only (never drafts). A Transferee whose only rows are drafts is `isCompleted: false` with a reason containing `Submit your list`. A Returnee with only drafts and nothing else gets the same hint.

- [ ] **Step 1: Write the failing tests**

Add before the closing `}` of `EvaluateCreditMappingStatusTest`:

```php
    public function test_transferee_with_only_saved_drafts_is_incomplete_and_told_to_submit(): void
    {
        $student = $this->createStudent(StudentType::Transferee);
        $this->createCredit($student, $this->getOrCreateSubject(), TransfereeCreditStatus::Draft);

        $result = $this->action->execute($student);

        $this->assertFalse($result->isCompleted);
        $this->assertTrue($result->requiresCreditMapping);
        $this->assertSame(0, $result->totalCredits);
        $this->assertStringContainsString('Submit your list', (string) $result->reason);
    }

    public function test_a_draft_does_not_count_as_a_credit_in_progress(): void
    {
        $student = $this->createStudent(StudentType::Transferee);
        $subject = $this->getOrCreateSubject();
        $this->createCredit($student, $subject, TransfereeCreditStatus::Pending);
        $this->createCredit($student, $subject, TransfereeCreditStatus::Draft);

        $result = $this->action->execute($student);

        $this->assertFalse($result->isCompleted);
        $this->assertSame(1, $result->totalCredits);
        $this->assertSame(1, $result->pendingCredits);
    }

    public function test_drafts_do_not_hold_back_a_transferee_whose_sent_credits_are_all_decided(): void
    {
        $student = $this->createStudent(StudentType::Transferee);
        $subject = $this->getOrCreateSubject();
        $this->createCredit($student, $subject, TransfereeCreditStatus::Approved);
        $this->createCredit($student, $subject, TransfereeCreditStatus::Draft);

        $result = $this->action->execute($student);

        $this->assertTrue($result->isCompleted);
        $this->assertNull($result->reason);
        $this->assertSame(1, $result->totalCredits);
    }

    public function test_returnee_with_only_saved_drafts_is_told_to_submit(): void
    {
        $student = $this->createStudent(StudentType::Returnee);
        $this->createCredit($student, $this->getOrCreateSubject(), TransfereeCreditStatus::Draft);

        $result = $this->action->execute($student);

        $this->assertFalse($result->isCompleted);
        $this->assertStringContainsString('Submit your list', (string) $result->reason);
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `php artisan test tests/Unit/Actions/Academic/EvaluateCreditMappingStatusTest.php`
Expected: FAIL (a draft counts toward `totalCredits`; the transferee with only drafts reads as complete).

- [ ] **Step 3: Write the implementation**

Replace `backend/app/Actions/Academic/EvaluateCreditMappingStatus.php` entirely with:

```php
<?php

namespace App\Actions\Academic;

use App\Domain\Academic\CreditMappingStatusResult;
use App\Domain\Academic\TransfereeCreditStatus;
use App\Domain\Identity\StudentType;
use App\Models\CurriculumMigration;
use App\Models\StudentProfile;
use App\Models\TransfereeCredit;

final readonly class EvaluateCreditMappingStatus
{
    private const SUBMIT_HINT = 'You have subjects saved but not yet sent. Submit your list to your Program Head to start credit mapping.';

    public function execute(StudentProfile $student): CreditMappingStatusResult
    {
        $studentType = $student->student_type instanceof StudentType
            ? $student->student_type
            : StudentType::tryFrom((string) $student->student_type);

        // An existing student already has a record at the school: nothing to map before enrolling.
        if ($studentType === null || $studentType === StudentType::Freshman || $studentType === StudentType::ExistingStudent) {
            return new CreditMappingStatusResult(
                isCompleted: true,
                requiresCreditMapping: false,
                reason: null,
            );
        }

        $credits = TransfereeCredit::query()
            ->where('student_id', $student->id)
            ->get();

        // A draft is the student's own unsent list (ADR 0026, amended): it is not part of the
        // workflow until it is submitted, so it is never counted as a credit in progress or done.
        $draftCredits = $credits->where('status', TransfereeCreditStatus::Draft)->count();
        $totalCredits = $credits->count() - $draftCredits;
        $pendingCredits = $credits->where('status', TransfereeCreditStatus::Pending)->count();
        $endorsedCredits = $credits->where('status', TransfereeCreditStatus::Endorsed)->count();
        $approvedCredits = $credits->where('status', TransfereeCreditStatus::Approved)->count();
        $rejectedCredits = $credits->where('status', TransfereeCreditStatus::Rejected)->count();

        $hasCurriculumMigration = CurriculumMigration::query()
            ->where('student_id', $student->id)
            ->exists();

        if ($studentType === StudentType::Transferee) {
            if ($totalCredits === 0) {
                return new CreditMappingStatusResult(
                    isCompleted: false,
                    requiresCreditMapping: true,
                    reason: $draftCredits > 0
                        ? self::SUBMIT_HINT
                        : 'Credit mapping has not been submitted or completed yet. Please wait for the Program Head / Registrar to evaluate your credits from your previous school.',
                    totalCredits: 0,
                    pendingCredits: 0,
                    endorsedCredits: 0,
                    approvedCredits: 0,
                    rejectedCredits: 0,
                    hasCurriculumMigration: $hasCurriculumMigration,
                );
            }

            if ($pendingCredits > 0 || $endorsedCredits > 0) {
                return new CreditMappingStatusResult(
                    isCompleted: false,
                    requiresCreditMapping: true,
                    reason: 'Credit mapping is currently in progress. Please wait for the Program Head and Registrar Head to finalize your credit evaluation.',
                    totalCredits: $totalCredits,
                    pendingCredits: $pendingCredits,
                    endorsedCredits: $endorsedCredits,
                    approvedCredits: $approvedCredits,
                    rejectedCredits: $rejectedCredits,
                    hasCurriculumMigration: $hasCurriculumMigration,
                );
            }

            return new CreditMappingStatusResult(
                isCompleted: true,
                requiresCreditMapping: true,
                reason: null,
                totalCredits: $totalCredits,
                pendingCredits: $pendingCredits,
                endorsedCredits: $endorsedCredits,
                approvedCredits: $approvedCredits,
                rejectedCredits: $rejectedCredits,
                hasCurriculumMigration: $hasCurriculumMigration,
            );
        }

        // Returnee logic (remaining case)
        if ($pendingCredits > 0 || $endorsedCredits > 0) {
            return new CreditMappingStatusResult(
                isCompleted: false,
                requiresCreditMapping: true,
                reason: 'Credit mapping is currently in progress. Please wait for the evaluation to be finalized.',
                totalCredits: $totalCredits,
                pendingCredits: $pendingCredits,
                endorsedCredits: $endorsedCredits,
                approvedCredits: $approvedCredits,
                rejectedCredits: $rejectedCredits,
                hasCurriculumMigration: $hasCurriculumMigration,
            );
        }

        if ($hasCurriculumMigration || $approvedCredits > 0) {
            return new CreditMappingStatusResult(
                isCompleted: true,
                requiresCreditMapping: true,
                reason: null,
                totalCredits: $totalCredits,
                pendingCredits: $pendingCredits,
                endorsedCredits: $endorsedCredits,
                approvedCredits: $approvedCredits,
                rejectedCredits: $rejectedCredits,
                hasCurriculumMigration: $hasCurriculumMigration,
            );
        }

        return new CreditMappingStatusResult(
            isCompleted: false,
            requiresCreditMapping: true,
            reason: $draftCredits > 0
                ? self::SUBMIT_HINT
                : 'Your credit mapping or curriculum migration has not been completed yet. Please contact your Program Head or Registrar before enrolling.',
            totalCredits: $totalCredits,
            pendingCredits: $pendingCredits,
            endorsedCredits: $endorsedCredits,
            approvedCredits: $approvedCredits,
            rejectedCredits: $rejectedCredits,
            hasCurriculumMigration: false,
        );
    }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `php artisan test tests/Unit/Actions/Academic tests/Feature/Api/V1/EligibleSubjectsEndpointTest.php tests/Feature/Api/V1/EnrollmentsEndpointTest.php`
Expected: PASS (including the existing `EvaluateCreditMappingStatusTest` cases and the endpoints that call the gate). Then `vendor/bin/pint app/Actions/Academic/EvaluateCreditMappingStatus.php` and `vendor/bin/phpstan analyse --memory-limit=1G app/Actions/Academic/EvaluateCreditMappingStatus.php` (clean).

- [ ] **Step 5: Checkpoint**

`PROGRESS.md`: Task 5 done with the actual counts. **Do not commit.**

---

### Task 6: Route surface, OpenAPI, and the documents that describe the old approver

**Files:**
- Modify: `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`
- Modify: `docs/api/openapi.yaml`
- Modify: `docs/adr/0026-credit-mapping-ownership-and-effect.md`
- Modify: `docs/data-dictionary/enrollment-records.md`
- Modify: `PRD.md` (lines 180, 209, 452 and a new bullet under §3.7)

**Interfaces:**
- Consumes: the routes and names from Tasks 2 and 3 (`api.v1.transferee-credits.submit`, `api.v1.transferee-credits.destroy`).
- Produces: nothing code depends on; the documents match the behavior.

- [ ] **Step 1: Write the failing test (route surface)**

In `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`:
1. In the first sorted list, after `'DELETE api/v1/tor-documents/{torDocument}',` add `'DELETE api/v1/transferee-credits/{transfereeCredit}',`; after `'POST api/v1/transferee-credits',` add `'POST api/v1/transferee-credits/submit',`.
2. In the list that contains `'api.v1.transferee-credits.index'` through `...suggestions` (lines ~288 to 291), add after `'api.v1.transferee-credits.suggestions',`:
```php
            'api.v1.transferee-credits.submit',
            'api.v1.transferee-credits.destroy',
```
3. In `test_transferee_credit_routes_carry_no_role_middleware`, add the same two names after `'api.v1.transferee-credits.suggestions',` and update its docblock sentence `endorses, Registrar Staff approve; ADR 0026)` to `endorses, the Registrar Head decides; ADR 0026, amended)`.

- [ ] **Step 2: Run the test**

Run: `php artisan test tests/Feature/Api/V1/ApiSurfaceTest.php`
Expected: PASS (the routes already exist from Tasks 2 and 3; if a list failed on order, put the new line where the failure diff says).

- [ ] **Step 3: Update the documents**

`docs/api/openapi.yaml` (use the Edit tool; each old string below is unique in that file):

(a) In the `postTransfereeCredit` description, replace
```
        string with no equivalence rule encoded. Always created `pending`;
        the API never guesses `subject_id`. A request identical to a
        still-open one (same student, school, subject title and code)
        returns that row with 200 instead of creating a duplicate. A
        Student's request notifies the Program Chairs of the student's
        college.
```
with
```
        string with no equivalence rule encoded. A Student's request is
        created as a private `draft` (nobody else sees it and nobody is
        notified until `POST /transferee-credits/submit`); a Program Chair's
        is created `pending`. The API never guesses `subject_id`. A request
        identical to one still in the student's list or in the workflow (same
        student, school, subject title and code) returns that row with 200
        instead of creating a duplicate.
```
and replace `description: The recorded, pending transferee credit.` (the 201 response) with `description: The recorded transferee credit (a draft for a Student, pending for a Program Chair).`

(b) Insert this new path immediately before the line `  /api/v1/transferee-credits/{transfereeCredit}:`:

```yaml
  /api/v1/transferee-credits/submit:
    post:
      operationId: postTransfereeCreditsSubmit
      summary: Send the student's saved list to the Program Chair
      description: >
        Student only. Every `draft` credit of the caller becomes `pending`
        (with `submitted_at`) in one transaction, and the Program Chairs of the
        student's college get one notice with the number of subjects. The
        student is always the caller. Idempotent: a repeat finds no draft,
        changes nothing, notifies nobody, and answers 200 with an empty `data`.
        Every credit sent is audited (`transferee_credit.submitted`).
      security:
        - bearerAuth: []
      tags:
        - Transferee Credits
      parameters:
        - $ref: "#/components/parameters/RequestId"
      responses:
        "200":
          description: The credits this call sent (empty when there was nothing to send).
          headers:
            X-Request-ID:
              $ref: "#/components/headers/RequestId"
            Cache-Control:
              $ref: "#/components/headers/NoStorePrivate"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/SubmittedTransfereeCreditsResponse"
        "401":
          $ref: "#/components/responses/Unauthenticated"
        "403":
          $ref: "#/components/responses/Forbidden"
        "422":
          description: The student's record could not be found.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "429":
          $ref: "#/components/responses/TooManyRequests"
        "500":
          $ref: "#/components/responses/InternalError"
```

(c) In the `patchTransfereeCredit` operation replace the `summary:` line with
`      summary: Edit a draft (Student); map, endorse or decline a credit (Program Chair); approve, reject or return it (Registrar Head)`
and replace the description paragraph (from `        No \`role:\` middleware — TransfereeCreditPolicy resolves the ability` through `        GRC grade. Every write is audited (FR-FIN-003).`) with:

```
        No `role:` middleware — TransfereeCreditPolicy resolves the ability
        (ADR 0026, amended). A Student may only correct the content of their
        own `draft` (no `action`, no `subject_id`). A Program Chair may only
        act on a credit of a student in their own college and never sees a
        draft. With no `action`, the Program Chair edits or maps a credit,
        allowed only while it is `pending`. `action: endorse` (Program Chair,
        `pending` → `endorsed`) needs a mapped subject, which the same request
        may set through `subject_id`, notifies the Registrar Head, and clears
        any earlier return. `action: decline` (Program Chair, `pending` →
        `rejected`) requires a reason and notifies the Student. `action:
        approve`, `reject` or `return` is the Registrar Head only and requires
        the credit to currently be `endorsed`; `reject` and `return` require a
        reason. `return` sends the credit back to `pending`, records who, when
        and why, and notifies the Program Chairs of the student's college. A
        reason is recorded in the audit row. Each step re-checks the status
        under a row lock, so a repeated request changes nothing a second time.
        An approved credit that is mapped to a subject counts as credited for
        eligibility, standing, promotion and the prospectus; it carries no
        GRC grade. Every write is audited (FR-FIN-003).
```

(d) Insert this `delete` operation immediately after the `patch` operation's last response (the `"500": $ref: "#/components/responses/InternalError"` line directly before `  /api/v1/transferee-credits/{transfereeCredit}/suggestions:`), at the same indentation as `patch:`:

```yaml
    delete:
      operationId: deleteTransfereeCredit
      summary: Remove a subject from the student's saved list
      description: >
        Student only, and only the student's own credit while it is still a
        `draft`. A credit that has been sent is part of the workflow and is
        never deleted (422). Audited as `transferee_credit.deleted`.
      security:
        - bearerAuth: []
      tags:
        - Transferee Credits
      parameters:
        - $ref: "#/components/parameters/RequestId"
        - name: transfereeCredit
          in: path
          required: true
          description: Transferee credit ID.
          schema:
            type: integer
      responses:
        "204":
          description: The draft was removed.
        "401":
          $ref: "#/components/responses/Unauthenticated"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          description: No transferee credit exists with the given ID.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "422":
          description: The credit is no longer a draft.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "429":
          $ref: "#/components/responses/TooManyRequests"
        "500":
          $ref: "#/components/responses/InternalError"
```

(e) Audit and notification enums. After the line `              - transferee_credit.rejected` add (same 14-space indent):
```
              - transferee_credit.submitted
              - transferee_credit.returned
              - transferee_credit.deleted
```
After the line `            - transferee_credit_endorsed` add (same 12-space indent): `            - transferee_credit_returned`.

(f) Schemas. In `UpdateTransfereeCreditRequest` add `- return` after `            - reject` in the `action` enum; replace `description: Required exactly when action is decline or reject.` with `description: Required exactly when action is decline, reject or return.`; and in that schema replace every `Prohibited when action is approve, reject or decline.` with `Prohibited when action is approve, reject, decline or return.` (use one Edit per occurrence with enough context, or `replace_all` on that exact sentence). Also in `subject_id` there: replace `Prohibited when action is approve, reject or decline. \`endorse\`` with `Prohibited when action is approve, reject, decline or return. \`endorse\``.

In `TransfereeCreditResource`: add `- submitted_at`, `- returned_at`, `- return_reason` to the `required` list (after `- endorsed_at`); in `status` enum add `- draft` before `- pending`; and after the `endorsed_at` property add:

```yaml
        submitted_at:
          type: ["string", "null"]
          format: date-time
          description: When the Student sent the credit to the Program Chair.
        returned_at:
          type: ["string", "null"]
          format: date-time
          description: When the Registrar Head last returned the credit to the Program Chair (cleared when it is endorsed again).
        return_reason:
          type: ["string", "null"]
          description: Why the Registrar Head returned it (cleared when it is endorsed again).
```

Add this schema right after `TransfereeCreditResponse`:

```yaml
    SubmittedTransfereeCreditsResponse:
      type: object
      additionalProperties: false
      required:
        - data
      properties:
        data:
          type: array
          items:
            $ref: "#/components/schemas/TransfereeCreditResource"
```

`docs/adr/0026-credit-mapping-ownership-and-effect.md`: append at the end of the file:

```markdown

## Amendment 2026-10-04 — drafts, the Registrar Head decides, and returns

**Status:** Accepted. Slice 1 of the transferee flow (`docs/superpowers/specs/2026-10-04-transferee-credit-mapping-pay-first-design.md`).

- **A Student saves a private list and sends it.** A Student's credit is created as `draft`: it is visible only to them, grants nothing and notifies nobody. `POST /api/v1/transferee-credits/submit` turns every draft into `pending` (`submitted_at`) and sends the Program Chairs of the student's college one notice with the count; a repeat changes nothing. A Student may edit or remove their own draft (`PATCH`, `DELETE`); a sent credit can no longer be removed. A Program Chair's own recorded credit is still `pending` at once.
- **The Registrar Head, not Registrar Staff, decides.** `decide` (`approve`, `reject`) moves from Registrar Staff to the Registrar Head. Registrar Staff keep read-only visibility of credits that have been sent. Credits already `endorsed` when this ships become the Registrar Head's queue; no data migration is needed.
- **`return`.** The Registrar Head may send an `endorsed` credit back to the Program Chair with a reason (`endorsed` → `pending`; `returned_by`, `returned_at`, `return_reason` recorded; the endorsement is cleared; the Program Chairs are notified). The Head does not edit a mapping. Endorsing again clears the return details.
- **Unchanged:** the Program Chair maps and endorses; suggestions are advice and are never stored; an approved, mapped credit counts as credited without a GRC grade; PRD §17 stays open.
- **Superseded wording:** "Registrar Staff approve or reject an endorsed credit" in Decisions 1 and 3 and in the Consequences about the Registrar Staff workspace now reads Registrar Head; that workspace stays a read-only view for Registrar Staff.
- **Migration:** `2026_10_04_000004_add_submission_and_return_to_transferee_credits_table` (four nullable columns). The owner runs it on the dev database and on Hostinger; it is not applied by the code change.
- **Not in this slice:** the Program Chair's side-by-side mapping screen and bulk "submit to Registrar Head" (Slice 2), the queue number and pay-first enrollment (Slice 3), reading an uploaded TOR (Slice 4).
```

`docs/data-dictionary/enrollment-records.md`: in the `transferee_credits` table, after the `endorsed_at` row add:

```markdown
| `submitted_at` | `TIMESTAMP` | nullable | When the Student sent their saved list to the Program Chair (`draft` → `pending`) |
| `returned_by` | `BIGINT UNSIGNED` | nullable, FK → `users.id`, `SET NULL` on delete | The Registrar Head who last returned the credit to the Program Chair; cleared when it is endorsed again |
| `returned_at` | `TIMESTAMP` | nullable | |
| `return_reason` | `TEXT` | nullable | Why it was returned |
```

and replace the `status` row's note `` `pending` → `endorsed` → `approved` \| `rejected`. **Provisional** `` with `` `draft` (the Student's unsent list) → `pending` → `endorsed` → `approved` \| `rejected`; the Registrar Head may return an `endorsed` credit to `pending`. **Provisional** ``. In the **API** paragraph, replace `Registrar Staff's \`action: approve\` or \`reject\` (\`endorsed\` only).` with `the Registrar Head's \`action: approve\`, \`reject\` or \`return\` (\`endorsed\` only), and add that \`POST /transferee-credits/submit\` sends a Student's drafts and \`DELETE /transferee-credits/{id}\` removes one; Registrar Staff read credits that have been sent but cannot decide them.` (keep the sentence grammatical when editing).

`PRD.md` (Edit tool, exact lines):
- Line 148: `- Request credit mapping for subjects completed at another school, and follow its status.` → `- Save the subjects completed at another school as a list, submit it for credit mapping, and follow its status.`
- Line 180: replace `and endorse them to the Registrar (ADR 0026).` with `and endorse them to the Registrar Head (ADR 0026, amended).`
- Under `### 3.7 Registrar Head`, after the bullet `- Review and approve enrollment submissions, and open a student's profile from the approvals queue.` add: `- Approve, reject or return transferee credit mappings that the Program Chair has endorsed (ADR 0026, amended).`
- Line 209 (Registrar Staff): replace `- Approve or reject transferee credit mappings that the Program Chair has endorsed (ADR 0026).` with `- View transferee credit mappings that have been sent (read-only; the Registrar Head decides them, ADR 0026 amended).`
- FR-FIN-003 (line 452): replace `and Registrar Staff approve; an approved credit counts as credited without a GRC grade (ADR 0026).` with `and the Registrar Head approves, rejects or returns; an approved credit counts as credited without a GRC grade (ADR 0026, amended).`

- [ ] **Step 4: Verify the documents**

Run (from the repo root): `python -c "import yaml,sys; yaml.safe_load(open('docs/api/openapi.yaml', encoding='utf-8')); print('openapi parses')"`
Expected: `openapi parses`. Then `php artisan test tests/Feature/Api/V1/ApiSurfaceTest.php tests/Unit/Contracts` from `backend/` (PASS). Search for leftovers: Grep `Registrar Staff approve` in `docs/api`, `docs/data-dictionary`, `PRD.md` and read each hit: it must be either in the ADR's "Superseded wording" note or about something other than credits.

- [ ] **Step 5: Checkpoint**

`PROGRESS.md`: Task 6 done. Re-grep your entry afterwards (concurrent sessions edit `PROGRESS.md` and `PRD.md`). **Do not commit.**

---

### Task 7: Frontend contract: schema, service, hooks, and the "is mapping incomplete" rule

**Files:**
- Modify: `frontend/src/features/schemas/transferee-credit-schema.ts`
- Modify: `frontend/src/features/services/transferee-credit-service.ts`
- Modify: `frontend/src/features/hooks/use-transferee-credits.ts`
- Create: `frontend/src/features/lib/credit-mapping.ts`
- Test: `frontend/src/features/lib/credit-mapping.test.ts`, `frontend/src/features/schemas/transferee-credit-schema.test.ts`

**Interfaces:**
- Consumes: the API from Tasks 2 to 4.
- Produces: status value `"draft"`; resource fields `submitted_at`, `returned_at`, `return_reason` (all default `null`); action input `{ action: "return", reason: string }` (also accepted by `decideTransfereeCreditInputSchema`); `submitTransfereeCredits(): Promise<TransfereeCredit[]>`; `deleteTransfereeCredit(id: number): Promise<void>`; hooks `useSubmitTransfereeCreditsMutation()` and `useDeleteTransfereeCreditMutation()`; `isCreditMappingIncomplete(credits: readonly { status: TransfereeCreditStatus }[]): boolean`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/lib/credit-mapping.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { isCreditMappingIncomplete } from "@/features/lib/credit-mapping"

describe("isCreditMappingIncomplete", () => {
  it("is incomplete when the student has no credits at all", () => {
    expect(isCreditMappingIncomplete([])).toBe(true)
  })

  it("is incomplete when the student has only saved drafts that were never sent", () => {
    expect(
      isCreditMappingIncomplete([{ status: "draft" }, { status: "draft" }]),
    ).toBe(true)
  })

  it("is incomplete while any sent credit is pending or endorsed", () => {
    expect(
      isCreditMappingIncomplete([{ status: "approved" }, { status: "pending" }]),
    ).toBe(true)
    expect(
      isCreditMappingIncomplete([{ status: "approved" }, { status: "endorsed" }]),
    ).toBe(true)
  })

  it("is complete once every sent credit is decided, whatever drafts remain", () => {
    expect(
      isCreditMappingIncomplete([
        { status: "approved" },
        { status: "rejected" },
        { status: "draft" },
      ]),
    ).toBe(false)
  })
})
```

Create `frontend/src/features/schemas/transferee-credit-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  decideTransfereeCreditInputSchema,
  transfereeCreditActionInputSchema,
  transfereeCreditResourceSchema,
} from "@/features/schemas/transferee-credit-schema"

const credit = {
  type: "transferee_credit",
  id: 1,
  student_id: 4,
  student_number: "2026-0001",
  source_institution: "University of the East",
  source_subject_code: "CS101",
  source_subject_title: "Computer Concepts",
  source_grade: "1.50",
  credited_units: 3,
  subject_id: null,
  subject_code: null,
  status: "draft",
  status_label: "Draft",
  processed_at: null,
  created_at: "2026-08-01T00:00:00Z",
}

describe("transferee credit schema", () => {
  it("parses a draft, defaulting the submission and return fields", () => {
    const parsed = transfereeCreditResourceSchema.parse(credit)

    expect(parsed.status).toBe("draft")
    expect(parsed.submitted_at).toBeNull()
    expect(parsed.returned_at).toBeNull()
    expect(parsed.return_reason).toBeNull()
  })

  it("parses a credit the Registrar Head returned", () => {
    const parsed = transfereeCreditResourceSchema.parse({
      ...credit,
      status: "pending",
      status_label: "Pending",
      submitted_at: "2026-08-02T00:00:00Z",
      returned_at: "2026-08-03T00:00:00Z",
      return_reason: "Mapped to the wrong subject.",
    })

    expect(parsed.return_reason).toBe("Mapped to the wrong subject.")
  })

  it("accepts a return only with a reason", () => {
    expect(
      transfereeCreditActionInputSchema.safeParse({ action: "return" }).success,
    ).toBe(false)
    expect(
      decideTransfereeCreditInputSchema.safeParse({
        action: "return",
        reason: "Wrong subject",
      }).success,
    ).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `frontend/`): `npx vitest run src/features/lib/credit-mapping.test.ts src/features/schemas/transferee-credit-schema.test.ts`
Expected: FAIL (the module does not exist; `draft` is not a status; `return` is not an action).

- [ ] **Step 3: Write the implementation**

`frontend/src/features/schemas/transferee-credit-schema.ts`:
1. Replace the leading docblock and the status list with:

```ts
/**
 * A credit starts as a Student's private `draft`, is sent (`pending`), mapped
 * and endorsed by the Program Chair (`endorsed`), and decided by the Registrar
 * Head (`approved` | `rejected`); the Head may also return an endorsed credit to
 * the Program Chair (`pending` again). See ADR 0026, amended.
 */
const transfereeCreditStatusValues = [
  "draft",
  "pending",
  "endorsed",
  "approved",
  "rejected",
] as const
```

2. In `transfereeCreditResourceSchema`, after `endorsed_at: z.iso.datetime().nullable().default(null),` add:

```ts
    submitted_at: z.iso.datetime().nullable().default(null),
    returned_at: z.iso.datetime().nullable().default(null),
    return_reason: z.string().nullable().default(null),
```

3. After `transfereeCreditEnvelopeSchema` add:

```ts
/** What `POST /transferee-credits/submit` answers: the credits that call sent (empty on a repeat). */
export const submittedTransfereeCreditsEnvelopeSchema = z
  .object({ data: z.array(transfereeCreditResourceSchema) })
  .strict()
```

4. In `transfereeCreditActionInputSchema` add a variant before the closing `])`:

```ts
  z.object({ action: z.literal("return"), reason: z.string().min(1) }).strict(),
```

5. Replace `decideTransfereeCreditInputSchema` and its docblock with:

```ts
/** The Registrar Head's three decisions. */
export const decideTransfereeCreditInputSchema = z.union([
  z.object({ action: z.literal("approve") }).strict(),
  z.object({ action: z.literal("reject"), reason: z.string().min(1) }).strict(),
  z.object({ action: z.literal("return"), reason: z.string().min(1) }).strict(),
])
```

6. Update the comment above `transfereeCreditActionInputSchema` to say "the Registrar Head `approve`s, `reject`s or `return`s an endorsed one".

`frontend/src/features/services/transferee-credit-service.ts`:
1. In the import from the schema add `submittedTransfereeCreditsEnvelopeSchema,` (alphabetical, after `paginatedTransfereeCreditsSchema,`).
2. In the import from `api-client` add `deleteAuthenticatedJson,` after `ApiClientError,`.
3. Replace the comment `/** Endorse / decline (Program Chair) or approve / reject (Registrar Staff). */` with `/** Endorse / decline (Program Chair) or approve / reject / return (Registrar Head). */` and `/** The Registrar's decision on an endorsed credit. */` with `/** The Registrar Head's decision on an endorsed credit. */`.
4. Append at the end of the file:

```ts

/**
 * Sends the student's whole saved list to the Program Chair. Idempotent: a
 * repeat sends nothing and answers an empty list.
 */
export async function submitTransfereeCredits(): Promise<TransfereeCredit[]> {
  return parse(
    submittedTransfereeCreditsEnvelopeSchema,
    await postAuthenticatedJson(`${TRANSFEREE_CREDITS_PATH}/submit`, {}),
    "submitted transferee credits",
  ).data
}

/** Removes one subject from the student's own saved list (only a draft can go). */
export async function deleteTransfereeCredit(id: number): Promise<void> {
  await deleteAuthenticatedJson(`${TRANSFEREE_CREDITS_PATH}/${id}`)
}
```

`frontend/src/features/hooks/use-transferee-credits.ts`:
1. In the service import add `deleteTransfereeCredit,` (after `createTransfereeCredit,`) and `submitTransfereeCredits,` (after `listTransfereeCredits,`).
2. Update the two comments that say "Registrar Staff" (`/** Endorse / decline (Program Chair) or approve / reject (Registrar Staff). */`, `/** The Registrar's decision on an endorsed credit. */`) to "Registrar Head".
3. Append:

```ts

/** The student sends their whole saved list to the Program Chair. */
export function useSubmitTransfereeCreditsMutation() {
  const invalidate = useInvalidateTransfereeCreditQueries()

  return useMutation({
    mutationFn: () => submitTransfereeCredits(),
    onSuccess: () => invalidate(),
  })
}

/** The student removes one subject from their own saved list. */
export function useDeleteTransfereeCreditMutation() {
  const invalidate = useInvalidateTransfereeCreditQueries()

  return useMutation({
    mutationFn: (id: number) => deleteTransfereeCredit(id),
    onSuccess: () => invalidate(),
  })
}
```

Create `frontend/src/features/lib/credit-mapping.ts`:

```ts
import type { TransfereeCreditStatus } from "@/features/schemas/transferee-credit-schema"

/**
 * Whether a transferee's credit mapping still blocks enrollment. It mirrors the
 * API's `EvaluateCreditMappingStatus`: a draft is the student's own unsent list,
 * so it counts for nothing until it is submitted. With no sent credit the
 * mapping has not started; while any sent credit is pending or endorsed it is
 * still in progress.
 */
export function isCreditMappingIncomplete(
  credits: readonly { status: TransfereeCreditStatus }[],
): boolean {
  const sent = credits.filter((credit) => credit.status !== "draft")

  if (sent.length === 0) return true

  return sent.some(
    (credit) => credit.status === "pending" || credit.status === "endorsed",
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/lib/credit-mapping.test.ts src/features/schemas/transferee-credit-schema.test.ts` then `npm run typecheck`.
Expected: the tests PASS; `tsc --noEmit` exits 0 **except** for the places Task 8 and Task 9 still have to update (none should fail yet, because `status` consumers only compare string literals; if `tsc` reports an error in a component, record it and fix it in the task that owns that component). Run `npx prettier --write` on the two new test files and `credit-mapping.ts`.

- [ ] **Step 5: Checkpoint**

`PROGRESS.md`: Task 7 done. **Do not commit.**

---

### Task 8: The student's dialog becomes a draft list; the Enrollment page stops treating drafts as sent

**Files:**
- Rewrite: `frontend/src/features/components/portal/student-credit-mapping-dialog.tsx`
- Rewrite: `frontend/src/features/components/portal/student-credit-mapping-dialog.test.tsx`
- Modify: `frontend/src/features/components/portal/enrollment-workspace.tsx`

**Interfaces:**
- Consumes: Task 7's hooks and `isCreditMappingIncomplete`; existing `StudentTorUpload`.
- Produces: the dialog's visible behavior: **Add Subject to My List** (a `POST` that creates a draft), a "Your list (not yet sent)" section with **Edit** and **Remove** per row and a **Submit to Program Head** button, and a "Your Credited & Pending Subjects" section for rows already sent.

- [ ] **Step 1: Write the failing tests**

Replace `frontend/src/features/components/portal/student-credit-mapping-dialog.test.tsx` entirely with:

```tsx
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { StudentCreditMappingDialog } from "@/features/components/portal/student-credit-mapping-dialog"
import { renderWithSession } from "@/tests/render-app"

const studentSession = {
  userId: "4",
  displayName: "Test Student",
  role: "student",
  signedInAt: "2026-07-29T12:00:00Z",
} as const

const sentCredit = {
  type: "transferee_credit",
  id: 1,
  student_id: 4,
  student_number: "2026-0001",
  source_institution: "University of the East",
  source_subject_code: "CS101",
  source_subject_title: "Computer Concepts",
  source_grade: "1.50",
  credited_units: 3,
  source_school_year: "2023-2024",
  source_semester: "1st Semester",
  subject_id: 10,
  subject_code: "CS101",
  status: "pending",
  status_label: "Pending",
  processed_at: null,
  created_at: "2026-08-01T00:00:00Z",
}

const draftCredit = {
  ...sentCredit,
  id: 5,
  source_subject_code: "MATH101",
  source_subject_title: "College Algebra",
  subject_id: null,
  subject_code: null,
  status: "draft",
  status_label: "Draft",
}

function paginated(credits: unknown[]) {
  return {
    data: credits,
    links: {
      first: "http://localhost/api/v1/transferee-credits?page=1",
      last: "http://localhost/api/v1/transferee-credits?page=1",
      prev: null,
      next: null,
    },
    meta: { current_page: 1, last_page: 1, per_page: 50, total: credits.length },
  }
}

function mockFetch(credits: unknown[] = [sentCredit]) {
  return vi.fn<typeof fetch>().mockImplementation((input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    const method = init?.method ?? "GET"
    const path = new URL(url, "http://localhost").pathname

    if (path.endsWith("/transferee-credits/submit") && method === "POST") {
      return Promise.resolve(
        new Response(JSON.stringify({ data: [{ ...draftCredit, status: "pending" }] })),
      )
    }
    if (path.endsWith("/transferee-credits") && method === "GET") {
      return Promise.resolve(new Response(JSON.stringify(paginated(credits))))
    }
    if (path.endsWith("/transferee-credits") && method === "POST") {
      return Promise.resolve(
        new Response(JSON.stringify({ data: { ...draftCredit, id: 9 } }), { status: 201 }),
      )
    }
    if (/\/transferee-credits\/\d+$/.test(path) && method === "PATCH") {
      return Promise.resolve(new Response(JSON.stringify({ data: draftCredit })))
    }
    if (/\/transferee-credits\/\d+$/.test(path) && method === "DELETE") {
      return Promise.resolve(new Response(null, { status: 204 }))
    }

    return Promise.resolve(new Response(JSON.stringify({ data: [] })))
  })
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Request Credit Mapping/i }))
  await screen.findByRole("heading", { name: "Transferee Credit Mapping" })
}

describe("StudentCreditMappingDialog", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("renders the trigger, opens, and lists the credits that were already sent", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("fetch", mockFetch())
    renderWithSession(<StudentCreditMappingDialog />, { session: studentSession })

    await openDialog(user)

    expect(screen.getByLabelText(/Previous School/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Previous Subject Code/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Subject Title/i)).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: /Your Transcript of Records/i }),
    ).toBeInTheDocument()
    expect(await screen.findByText(/Your Credited & Pending Subjects/i)).toBeInTheDocument()
    expect(await screen.findByText(/CS101 — Computer Concepts/i)).toBeInTheDocument()
    // Nothing is saved yet, so there is no list to send.
    expect(
      screen.queryByRole("button", { name: "Submit to Program Head" }),
    ).not.toBeInTheDocument()
  })

  it("adds a subject to the student's own list without sending it", async () => {
    const user = userEvent.setup()
    const fetchFn = mockFetch([])
    vi.stubGlobal("fetch", fetchFn)
    renderWithSession(<StudentCreditMappingDialog />, { session: studentSession })
    await openDialog(user)

    await user.type(screen.getByLabelText(/Previous School/i), "FEU Tech")
    await user.type(screen.getByLabelText(/Previous Subject Code/i), "PROG101")
    await user.type(screen.getByLabelText(/Subject Title/i), "Computer Programming 1")
    await user.type(screen.getByLabelText(/Grade Obtained/i), "1.25")
    await user.clear(screen.getByLabelText("Units"))
    await user.type(screen.getByLabelText("Units"), "1.5")
    await user.type(screen.getByLabelText("School Year"), "2023-2024")
    await user.type(screen.getByLabelText("Semester"), "1st Semester")

    await user.click(screen.getByRole("button", { name: /Add Subject to My List/i }))

    expect(await screen.findByText(/Saved to your list/i)).toBeInTheDocument()
    const post = fetchFn.mock.calls.find(([, init]) => init?.method === "POST")
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({
      source_institution: "FEU Tech",
      source_subject_code: "PROG101",
      source_subject_title: "Computer Programming 1",
      source_grade: "1.25",
      credited_units: 1.5,
      source_school_year: "2023-2024",
      source_semester: "1st Semester",
    })
    // Adding to the list must never send it to the Program Head by itself.
    expect(
      fetchFn.mock.calls.some(([input]) => String(input).includes("/transferee-credits/submit")),
    ).toBe(false)
  })

  it("does not need a subject code, and asks for the school year and semester the API requires", async () => {
    const user = userEvent.setup()
    const fetchFn = mockFetch([])
    vi.stubGlobal("fetch", fetchFn)
    renderWithSession(<StudentCreditMappingDialog />, { session: studentSession })
    await openDialog(user)
    await user.type(screen.getByLabelText(/Previous School/i), "FEU Tech")
    await user.type(screen.getByLabelText(/Subject Title/i), "Computer Programming 1")

    await user.click(screen.getByRole("button", { name: /Add Subject to My List/i }))
    expect(await screen.findByText(/enter the school year/i)).toBeInTheDocument()
    expect(fetchFn.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false)

    await user.type(screen.getByLabelText("School Year"), "2023-2024")
    await user.click(screen.getByRole("button", { name: /Add Subject to My List/i }))
    expect(await screen.findByText(/enter the semester/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText("Semester"), "2nd")
    await user.click(screen.getByRole("button", { name: /Add Subject to My List/i }))
    expect(await screen.findByText(/Saved to your list/i)).toBeInTheDocument()
  })

  it("shows the saved list with Edit, Remove and a Submit button, apart from what was already sent", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("fetch", mockFetch([draftCredit, sentCredit]))
    renderWithSession(<StudentCreditMappingDialog />, { session: studentSession })
    await openDialog(user)

    expect(await screen.findByText(/Your list \(not yet sent\)/i)).toBeInTheDocument()
    expect(screen.getByText(/MATH101 — College Algebra/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Edit College Algebra" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove College Algebra" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Submit to Program Head" })).toBeInTheDocument()
    expect(screen.getByText(/CS101 — Computer Concepts/i)).toBeInTheDocument()
  })

  it("sends the whole list to the Program Head in one request", async () => {
    const user = userEvent.setup()
    const fetchFn = mockFetch([draftCredit])
    vi.stubGlobal("fetch", fetchFn)
    renderWithSession(<StudentCreditMappingDialog />, { session: studentSession })
    await openDialog(user)

    await user.click(await screen.findByRole("button", { name: "Submit to Program Head" }))

    expect(await screen.findByText(/Your list was sent to your Program Head/i)).toBeInTheDocument()
    const submit = fetchFn.mock.calls.find(([input]) =>
      String(input).endsWith("/transferee-credits/submit"),
    )
    expect(submit?.[1]?.method).toBe("POST")
  })

  it("removes a subject from the list", async () => {
    const user = userEvent.setup()
    const fetchFn = mockFetch([draftCredit])
    vi.stubGlobal("fetch", fetchFn)
    renderWithSession(<StudentCreditMappingDialog />, { session: studentSession })
    await openDialog(user)

    await user.click(await screen.findByRole("button", { name: "Remove College Algebra" }))

    await vi.waitFor(() => {
      const del = fetchFn.mock.calls.find(([, init]) => init?.method === "DELETE")
      expect(String(del?.[0])).toMatch(/\/api\/v1\/transferee-credits\/5$/)
    })
  })

  it("edits a saved subject and saves the change", async () => {
    const user = userEvent.setup()
    const fetchFn = mockFetch([draftCredit])
    vi.stubGlobal("fetch", fetchFn)
    renderWithSession(<StudentCreditMappingDialog />, { session: studentSession })
    await openDialog(user)

    await user.click(await screen.findByRole("button", { name: "Edit College Algebra" }))
    const title = screen.getByLabelText(/Subject Title/i)
    expect(title).toHaveValue("College Algebra")
    await user.clear(title)
    await user.type(title, "College Algebra 1")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(await screen.findByText(/Changes saved to your list/i)).toBeInTheDocument()
    const patch = fetchFn.mock.calls.find(([, init]) => init?.method === "PATCH")
    expect(String(patch?.[0])).toMatch(/\/api\/v1\/transferee-credits\/5$/)
    expect(JSON.parse(patch?.[1]?.body as string)).toMatchObject({
      source_subject_title: "College Algebra 1",
    })
  })

  it("tells the student where each sent request is on its way", async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      "fetch",
      mockFetch([
        { ...sentCredit, id: 1, status: "pending", status_label: "Pending" },
        {
          ...sentCredit,
          id: 2,
          source_subject_title: "Statistics",
          status: "endorsed",
          status_label: "Endorsed",
        },
      ]),
    )
    renderWithSession(<StudentCreditMappingDialog />, { session: studentSession })
    await openDialog(user)

    expect(await screen.findByText("Awaiting Program Head")).toBeInTheDocument()
    expect(screen.getByText("Awaiting Registrar Head")).toBeInTheDocument()
  })

  it("has no detectable accessibility violations when open", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("fetch", mockFetch([draftCredit, sentCredit]))
    const { container } = renderWithSession(<StudentCreditMappingDialog />, {
      session: studentSession,
    })
    await openDialog(user)
    await screen.findByText(/Your list \(not yet sent\)/i)

    expect(await axe(container)).toHaveNoViolations()
  })
})
```

No new test is added to `enrollment-workspace.test.tsx`: the Enrollment page's "is credit mapping incomplete" rule now lives in `isCreditMappingIncomplete`, whose behavior (drafts count for nothing) is pinned by `credit-mapping.test.ts` in Task 7. The page change in Step 3 is a swap to that function, which `tsc` and the existing Enrollment tests exercise.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/components/portal/student-credit-mapping-dialog.test.tsx`
Expected: FAIL (no "Add Subject to My List", no list section).

- [ ] **Step 3: Write the implementation**

Replace `frontend/src/features/components/portal/student-credit-mapping-dialog.tsx` entirely with:

```tsx
"use client"

import { useState } from "react"
import { CheckCircle2, FilePlus2, Pencil, School, Send, Trash2 } from "lucide-react"

import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/features/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
import { StudentTorUpload } from "@/features/components/portal/tor-documents-panel"
import {
  useCreateTransfereeCreditMutation,
  useDeleteTransfereeCreditMutation,
  useSubmitTransfereeCreditsMutation,
  useTransfereeCreditsQuery,
  useUpdateTransfereeCreditMutation,
} from "@/features/hooks/use-transferee-credits"
import type { TransfereeCredit } from "@/features/schemas/transferee-credit-schema"

function creditBadgeVariant(
  status: TransfereeCredit["status"],
): "default" | "destructive" | "outline" | "secondary" {
  if (status === "approved") return "default"
  if (status === "rejected") return "destructive"
  if (status === "endorsed") return "secondary"
  return "outline"
}

/** Where the request is in its route: the student's own words, not the API's. */
function creditStatusLabel(credit: TransfereeCredit): string {
  if (credit.status === "draft") return "Not yet sent"
  if (credit.status === "pending") return "Awaiting Program Head"
  if (credit.status === "endorsed") return "Awaiting Registrar Head"
  return credit.status_label
}

function creditTitle(credit: TransfereeCredit): string {
  return credit.source_subject_code
    ? `${credit.source_subject_code} — ${credit.source_subject_title}`
    : credit.source_subject_title
}

function creditDetails(credit: TransfereeCredit): string {
  return [
    `${credit.source_institution} · ${credit.credited_units} units`,
    credit.source_school_year ? ` · ${credit.source_school_year}` : "",
    credit.source_semester ? ` (${credit.source_semester})` : "",
    credit.source_grade ? ` · Grade: ${credit.source_grade}` : "",
    credit.subject_code ? ` → Mapped to GRC ${credit.subject_code}` : "",
  ].join("")
}

/**
 * The student's own "credit mapping" list. It always acts for the signed-in
 * student (the API pins every request to them and ignores any student id), so it
 * takes no student. The student first saves the subjects they took at another
 * school as a private list (a draft: nobody else sees it), can edit or remove
 * them, and then sends the whole list to the Program Head in one step. Mapping
 * each subject to a GRC subject is the Program Head's decision, and the
 * Registrar Head approves it (ADR 0026, amended).
 */
export function StudentCreditMappingDialog() {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [sourceInstitution, setSourceInstitution] = useState("")
  const [sourceSubjectCode, setSourceSubjectCode] = useState("")
  const [sourceSubjectTitle, setSourceSubjectTitle] = useState("")
  const [sourceGrade, setSourceGrade] = useState("")
  const [creditedUnits, setCreditedUnits] = useState("3")
  const [sourceSchoolYear, setSourceSchoolYear] = useState("")
  const [sourceSemester, setSourceSemester] = useState("")
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const creditsQuery = useTransfereeCreditsQuery(
    { page: 1, per_page: 50 },
    { enabled: open },
  )
  const createMutation = useCreateTransfereeCreditMutation()
  const updateMutation = useUpdateTransfereeCreditMutation()
  const deleteMutation = useDeleteTransfereeCreditMutation()
  const submitMutation = useSubmitTransfereeCreditsMutation()
  const busy =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    submitMutation.isPending

  const resetSubjectFields = () => {
    setEditingId(null)
    setSourceSubjectCode("")
    setSourceSubjectTitle("")
    setSourceGrade("")
    setSourceSchoolYear("")
    setSourceSemester("")
  }

  const startEditing = (credit: TransfereeCredit) => {
    setError("")
    setSuccessMessage("")
    setEditingId(credit.id)
    setSourceInstitution(credit.source_institution)
    setSourceSubjectCode(credit.source_subject_code)
    setSourceSubjectTitle(credit.source_subject_title)
    setSourceGrade(credit.source_grade ?? "")
    setCreditedUnits(String(credit.credited_units))
    setSourceSchoolYear(credit.source_school_year ?? "")
    setSourceSemester(credit.source_semester ?? "")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccessMessage("")

    if (!sourceInstitution.trim()) {
      setError("Please specify the previous school or institution.")
      return
    }
    if (!sourceSubjectTitle.trim()) {
      setError("Please specify the previous subject title.")
      return
    }
    const units = Number.parseFloat(creditedUnits)
    if (Number.isNaN(units) || units <= 0 || units > 99.9) {
      setError("Units must be more than 0 (for example 3 or 1.5).")
      return
    }
    if (!sourceSchoolYear.trim()) {
      setError("Please enter the school year you took the subject.")
      return
    }
    if (!sourceSemester.trim()) {
      setError("Please enter the semester you took the subject.")
      return
    }

    try {
      if (editingId !== null) {
        await updateMutation.mutateAsync({
          id: editingId,
          input: {
            source_institution: sourceInstitution.trim(),
            source_subject_code: sourceSubjectCode.trim().toUpperCase(),
            source_subject_title: sourceSubjectTitle.trim(),
            source_grade: sourceGrade.trim() || null,
            credited_units: units,
            source_school_year: sourceSchoolYear.trim(),
            source_semester: sourceSemester.trim(),
          },
        })
        setSuccessMessage("Changes saved to your list.")
      } else {
        await createMutation.mutateAsync({
          source_institution: sourceInstitution.trim(),
          source_subject_code: sourceSubjectCode.trim().toUpperCase() || undefined,
          source_subject_title: sourceSubjectTitle.trim(),
          source_grade: sourceGrade.trim() || undefined,
          credited_units: units,
          source_school_year: sourceSchoolYear.trim(),
          source_semester: sourceSemester.trim(),
        })
        setSuccessMessage(
          "Saved to your list. It is not sent to your Program Head until you press Submit to Program Head.",
        )
      }
      resetSubjectFields()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save the subject. Please try again.",
      )
    }
  }

  const handleRemove = async (credit: TransfereeCredit) => {
    setError("")
    setSuccessMessage("")
    try {
      await deleteMutation.mutateAsync(credit.id)
      if (editingId === credit.id) resetSubjectFields()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to remove the subject. Please try again.",
      )
    }
  }

  const handleSendList = async () => {
    setError("")
    setSuccessMessage("")
    try {
      await submitMutation.mutateAsync()
      resetSubjectFields()
      setSuccessMessage(
        "Your list was sent to your Program Head. They will map each subject to your curriculum, and the Registrar Head approves it after that.",
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send your list. Please try again.",
      )
    }
  }

  const allCredits = creditsQuery.data?.data ?? []
  const drafts = allCredits.filter((credit) => credit.status === "draft")
  const sentCredits = allCredits.filter((credit) => credit.status !== "draft")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <FilePlus2 className="mr-1.5 size-4" />
          Request Credit Mapping
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <School className="size-5 text-primary" />
            <DialogTitle>Transferee Credit Mapping</DialogTitle>
          </div>
          <DialogDescription>
            List the subjects you completed at another college or university, then
            send the whole list to your Program Head. Your Program Head maps each
            one to a subject in your GRC curriculum, and the Registrar Head
            approves it.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="border-emerald-600/30 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        <StudentTorUpload enabled={open} />

        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-4 py-2">
          <FieldGroup className="grid gap-3 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="source-institution">Previous School / Institution</FieldLabel>
              <Input
                id="source-institution"
                placeholder="e.g. University of the East, TIP, UST"
                value={sourceInstitution}
                onChange={(e) => setSourceInstitution(e.target.value)}
                disabled={busy}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="source-subject-code">Previous Subject Code (optional)</FieldLabel>
              <Input
                id="source-subject-code"
                placeholder="e.g. CS101, ENG01"
                value={sourceSubjectCode}
                onChange={(e) => setSourceSubjectCode(e.target.value)}
                disabled={busy}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="source-units">Units</FieldLabel>
              <Input
                id="source-units"
                type="number"
                min="0.5"
                max="99.9"
                step="0.5"
                value={creditedUnits}
                onChange={(e) => setCreditedUnits(e.target.value)}
                disabled={busy}
              />
            </Field>

            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="source-subject-title">Subject Title / Description</FieldLabel>
              <Input
                id="source-subject-title"
                placeholder="e.g. Introduction to Computer Science"
                value={sourceSubjectTitle}
                onChange={(e) => setSourceSubjectTitle(e.target.value)}
                disabled={busy}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="source-school-year">School Year</FieldLabel>
              <Input
                id="source-school-year"
                placeholder="e.g. 2023-2024"
                value={sourceSchoolYear}
                onChange={(e) => setSourceSchoolYear(e.target.value)}
                disabled={busy}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="source-semester">Semester</FieldLabel>
              <Input
                id="source-semester"
                placeholder="e.g. 1st Semester, 2nd Semester"
                value={sourceSemester}
                onChange={(e) => setSourceSemester(e.target.value)}
                disabled={busy}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="source-grade">Grade Obtained (optional)</FieldLabel>
              <Input
                id="source-grade"
                placeholder="e.g. 1.25, 88%, A"
                value={sourceGrade}
                onChange={(e) => setSourceGrade(e.target.value)}
                disabled={busy}
              />
            </Field>
          </FieldGroup>

          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {editingId !== null ? "Save Changes" : "Add Subject to My List"}
            </Button>
            {editingId !== null && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={resetSubjectFields}
              >
                Cancel edit
              </Button>
            )}
          </div>
        </form>

        {drafts.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <h4 className="text-sm font-semibold text-foreground mb-2">
              Your list (not yet sent) ({drafts.length})
            </h4>
            <div className="grid gap-2">
              {drafts.map((credit) => (
                <div
                  key={credit.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs"
                >
                  <div className="grid gap-0.5">
                    <span className="font-semibold text-foreground">{creditTitle(credit)}</span>
                    <span className="text-muted-foreground">{creditDetails(credit)}</span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      aria-label={`Edit ${credit.source_subject_title}`}
                      onClick={() => startEditing(credit)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      aria-label={`Remove ${credit.source_subject_title}`}
                      onClick={() => void handleRemove(credit)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              className="mt-3"
              disabled={busy}
              onClick={() => void handleSendList()}
            >
              <Send className="mr-1.5 size-4" />
              Submit to Program Head
            </Button>
          </div>
        )}

        {sentCredits.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <h4 className="text-sm font-semibold text-foreground mb-2">
              Your Credited & Pending Subjects
            </h4>
            <div className="grid gap-2">
              {sentCredits.map((credit) => (
                <div
                  key={credit.id}
                  className="flex items-center justify-between rounded-lg border p-2.5 text-xs"
                >
                  <div className="grid gap-0.5">
                    <span className="font-semibold text-foreground">{creditTitle(credit)}</span>
                    <span className="text-muted-foreground">{creditDetails(credit)}</span>
                  </div>
                  <Badge variant={creditBadgeVariant(credit.status)}>
                    {creditStatusLabel(credit)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 border-t pt-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

`frontend/src/features/components/portal/enrollment-workspace.tsx`:
1. After the line `import { useTransfereeCreditsQuery } from "@/features/hooks/use-transferee-credits"` add `import { isCreditMappingIncomplete } from "@/features/lib/credit-mapping"`.
2. Replace the `creditMappingIncomplete` memo (the block from `const creditMappingIncomplete = useMemo(() => {` through its closing `}, [isTransferee, transfereeCreditsQuery.isSuccess, transfereeCreditsQuery.data])`) with:

```tsx
  const creditMappingIncomplete = useMemo(() => {
    if (!isTransferee) return false
    if (!transfereeCreditsQuery.isSuccess) return false
    // Saved drafts count for nothing until the student sends them (`isCreditMappingIncomplete`).
    return isCreditMappingIncomplete(transfereeCreditsQuery.data?.data ?? [])
  }, [isTransferee, transfereeCreditsQuery.isSuccess, transfereeCreditsQuery.data])
```

3. Replace the text `"Credit mapping must be completed and approved by the Program Chair and Registrar before you can submit your enrollment."` with `"Credit mapping must be completed and approved by the Program Chair and Registrar Head before you can submit your enrollment."`.
4. In the Alert paragraph replace `approved by the Program Chair and Registrar before you can select subjects and enroll.` with `approved by the Program Chair and Registrar Head before you can select subjects and enroll.`
5. Replace the second paragraph's lines (the three lines beginning `Upload your Transcript of Records (TOR) and list the subjects you` through `Once that is done you can enroll.`) with:

```tsx
              Upload your Transcript of Records (TOR) and add the subjects you
              took in your previous school to your list, then submit it. Your
              Program Chair reads the TOR, maps each subject to your curriculum,
              and the Registrar Head approves it. Once that is done you can enroll.
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/components/portal/student-credit-mapping-dialog.test.tsx src/features/components/portal/enrollment-workspace.test.tsx src/features/lib/credit-mapping.test.ts` then `npm run typecheck` and `npx eslint src/features/components/portal/student-credit-mapping-dialog.tsx src/features/components/portal/enrollment-workspace.tsx src/features/lib/credit-mapping.ts --max-warnings=0`.
Expected: PASS, `tsc` exit 0, ESLint clean. Run `npx prettier --write` on `student-credit-mapping-dialog.tsx`, its test, and `credit-mapping.ts`; for `enrollment-workspace.tsx` run `npx prettier --check` and, only if it flags the file, check whether `HEAD` was already unformatted (`git show HEAD:frontend/src/features/components/portal/enrollment-workspace.tsx | npx prettier --stdin-filepath enrollment-workspace.tsx --check`) before formatting it.

- [ ] **Step 5: Checkpoint**

`PROGRESS.md`: Task 8 done with the real counts. **Do not commit.**

---

### Task 9: The Registrar Head decides credits; Registrar Staff follow them

**Files:**
- Modify: `frontend/src/features/components/portal/registrar-records-workspace.tsx`
- Modify: `frontend/src/features/components/portal/registrar-records-workspace.test.tsx`
- Modify: `frontend/src/features/portal/role-capabilities.ts`
- Modify: `frontend/src/features/portal/role-capabilities.test.ts`
- Modify: `frontend/src/features/lib/notification-presentation.ts`
- Modify: `frontend/src/features/components/portal/portal-notification-sheet.test.tsx`

**Interfaces:**
- Consumes: Task 7's `decideTransfereeCreditInputSchema` (with `return`) and `useDecideTransfereeCreditMutation`.
- Produces: the `credit-mappings` module is available to `registrar_head` (decisions) as well as `registrar_staff` (read-only); the Head's table shows **Approve**, **Return** and **Reject** on `endorsed` rows; notifications: `transferee_credit_endorsed` opens Credit Mappings for the Registrar Head, and the new `transferee_credit_returned` opens it for the Program Chair.

- [ ] **Step 1: Write the failing tests**

In `registrar-records-workspace.test.tsx`:

(a) After the `registrarSession` constant add:

```tsx
const headSession = {
  ...registrarSession,
  userId: "10",
  displayName: "Registrar Head",
  role: "registrar_head" as const,
}
```

(b) Use one `replace_all` Edit so every credit-mappings render uses the Head. `old_string`:
```
      <RegistrarRecordsWorkspace initialModuleId="credit-mappings" />,
      { session: registrarSession },
```
`new_string`:
```
      <RegistrarRecordsWorkspace initialModuleId="credit-mappings" />,
      { session: headSession },
```
(The first test, which passes `{ ...registrarSession, role: "student" }`, does not match and is unchanged.)

(c) In the test titled `lists endorsed transferee credits with what they will be credited as, and Approve/Reject actions`, rename it to `... and Approve/Return/Reject actions` and, after its `Reject` assertion, add:

```tsx
    expect(
      within(table).getByRole("button", { name: "Return" }),
    ).toBeInTheDocument()
```

(d) Add these tests before the `it("lists pending withdrawal requests"` test:

```tsx
  it("lets Registrar Staff follow credits but not decide them", async () => {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes("/transferee-credits")) {
        return Promise.resolve(
          new Response(JSON.stringify(paginated([endorsedCredit]))),
        )
      }
      return Promise.resolve(new Response(JSON.stringify(paginated([]))))
    })
    renderWithSession(
      <RegistrarRecordsWorkspace initialModuleId="credit-mappings" />,
      { session: registrarSession },
    )

    const table = await screen.findByRole("table", {
      name: "Transferee credits",
    })
    expect(within(table).getByText("MATH101G — Calculus 1")).toBeInTheDocument()
    expect(
      within(table).queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument()
    expect(
      within(table).queryByRole("button", { name: "Return" }),
    ).not.toBeInTheDocument()
    expect(
      within(table).queryByRole("button", { name: "Reject" }),
    ).not.toBeInTheDocument()
  })

  it("keeps every module except credit mappings closed to the Registrar Head", () => {
    renderWithSession(
      <RegistrarRecordsWorkspace initialModuleId="drops-withdrawals" />,
      { session: headSession },
    )

    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns an endorsed credit to the Program Head, with a required reason", async () => {
    let decisionBody: unknown = null
    fetchMock.mockImplementation((input, init) => {
      const url = requestUrl(input)
      if (url.includes("/transferee-credits/3") && init?.method === "PATCH") {
        decisionBody = JSON.parse(init.body as string)
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: { ...endorsedCredit, status: "pending", status_label: "Pending" },
            }),
          ),
        )
      }
      if (url.includes("/transferee-credits")) {
        return Promise.resolve(
          new Response(JSON.stringify(paginated([endorsedCredit]))),
        )
      }
      return Promise.resolve(new Response(JSON.stringify(paginated([]))))
    })
    const user = userEvent.setup()
    renderWithSession(
      <RegistrarRecordsWorkspace initialModuleId="credit-mappings" />,
      { session: headSession },
    )

    const table = await screen.findByRole("table", {
      name: "Transferee credits",
    })
    await user.click(within(table).getByRole("button", { name: "Return" }))

    const dialog = screen.getByRole("alertdialog")
    const confirmButton = within(dialog).getByRole("button", {
      name: "Confirm decision",
    })
    expect(confirmButton).toBeDisabled()
    expect(
      within(dialog).getByText("Reason is required to return."),
    ).toBeInTheDocument()

    await user.type(
      within(dialog).getByLabelText("Reason"),
      "Mapped to the wrong subject.",
    )
    await user.click(confirmButton)

    await vi.waitFor(() =>
      expect(decisionBody).toEqual({
        action: "return",
        reason: "Mapped to the wrong subject.",
      }),
    )
  })
```

In `role-capabilities.test.ts`, in the `registrar_head` array add `"credit-mappings",` after `"freshman-enrollees",`.

In `portal-notification-sheet.test.tsx`, replace the line `["registrar_staff", "transferee_credit_endorsed", "A transferee credit for student 2026-0002 (Intro to Computing) was endorsed by the Program Head and awaits your approval.", "/portal/credit-mappings"],` with:

```tsx
    ["registrar_head", "transferee_credit_endorsed", "A transferee credit for student 2026-0002 (Intro to Computing) was endorsed by the Program Head and awaits your approval.", "/portal/credit-mappings"],
    ["program_chair", "transferee_credit_returned", "The Registrar Head returned a credit for student 2026-0002 (Intro to Computing). Reason: Mapped to the wrong subject.", "/portal/credit-mappings"],
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/components/portal/registrar-records-workspace.test.tsx src/features/portal/role-capabilities.test.ts src/features/components/portal/portal-notification-sheet.test.tsx`
Expected: FAIL (the Head is refused the workspace and has no Return; the role list differs; the notification routes differ).

- [ ] **Step 3: Write the implementation**

`frontend/src/features/components/portal/registrar-records-workspace.tsx` (apply as separate Edits):

1. Replace the `DecisionTarget` interface with:

```tsx
type DecisionTarget =
  | { kind: "credit"; id: number; action: "approve" | "reject" | "return" }
  | { kind: "withdrawal"; id: number; action: "approve" | "reject" }
```

2. Replace the comment and the two lines `const isRegistrarStaff = ...` / `const authorized = isRegistrarStaff` with:

```tsx
  // Credit mapping is the Program Chair's work (`ProgramChairCreditMappingsWorkspace`);
  // the Registrar Head approves, rejects or returns a credit the Chair has endorsed
  // (ADR 0026, amended) and Registrar Staff only follow it. Every other module in
  // this workspace stays Registrar Staff's.
  const isRegistrarStaff = session?.role === "registrar_staff"
  const isRegistrarHead = session?.role === "registrar_head"
  const canDecideCredits = isRegistrarHead
  const authorized =
    isRegistrarStaff ||
    (isRegistrarHead && initialModuleId === "credit-mappings")
```

3. Replace `const reasonRequired = decision?.action === "reject" && !reason.trim()` with:

```tsx
  const reasonRequired =
    (decision?.action === "reject" || decision?.action === "return") &&
    !reason.trim()
```

4. In `confirmDecision`, replace the credit input expression

```tsx
          input:
            decision.action === "approve"
              ? { action: "approve" }
              : { action: "reject", reason: reason.trim() },
```

with

```tsx
          input:
            decision.action === "approve"
              ? { action: "approve" }
              : decision.action === "return"
                ? { action: "return", reason: reason.trim() }
                : { action: "reject", reason: reason.trim() },
```

5. Replace the credits `CardDescription` text (`A credit reaches you once the Program Head has mapped it to a subject and endorsed it. Approve or reject each one.`) with:

```tsx
                {canDecideCredits
                  ? "A credit reaches you once the Program Head has mapped it to a subject and endorsed it. Approve it, return it to the Program Head with a reason, or reject it."
                  : "Credits the Program Head has endorsed. The Registrar Head decides them; you can follow their progress here."}
```

and `emptyMessage="No credit requests have reached the Registrar yet."` with `emptyMessage="No credit requests have reached the Registrar Head yet."`.

6. In the credits actions column replace `isRegistrarStaff &&\n                          credit.status === "endorsed" && (` with `canDecideCredits &&\n                          credit.status === "endorsed" && (` and insert this button between the Approve and Reject buttons:

```tsx
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={deciding}
                                onClick={() => {
                                  setDecision({
                                    kind: "credit",
                                    id: credit.id,
                                    action: "return",
                                  })
                                  setReason("")
                                  setError("")
                                }}
                              >
                                Return
                              </Button>
```

7. In the confirm dialog replace the `AlertDialogDescription` content with:

```tsx
              {decision?.action === "return"
                ? "The credit goes back to the Program Head with your reason. This is recorded in the operational audit log."
                : "This decision is recorded in the operational audit log and notifies the student."}
```

and replace `{decision?.action === "reject" && (` (the reason `Field`) with `{(decision?.action === "reject" || decision?.action === "return") && (`, and the message `Reason is required to reject.` with `Reason is required to {decision?.action}.`

`frontend/src/features/portal/role-capabilities.ts`:
1. In the `registrar_head` modules, after the `freshman-enrollees` module add:

```ts
      portalModule(
        "credit-mappings",
        "Credit Mappings",
        "Approve, reject or return the credit mappings the Program Head has endorsed.",
        Network,
      ),
```

2. In the `registrar_staff` modules replace the description `"Approve or reject the credit mappings the Program Head has endorsed."` with `"Follow the credit mappings the Program Head has endorsed. The Registrar Head decides them."`.
3. Check that `Network` is already imported (it is used by the Staff module); if the import list is shared nothing else changes.

`frontend/src/features/lib/notification-presentation.ts`:
1. Replace the comment above `transferee_credit_requested` (`// A student asked for a credit mapping (to the Program Chair), and the Chair\n  // endorsed one (to Registrar Staff): see ADR 0026.`) with:

```ts
  // A student sent their list for credit mapping (to the Program Chair), the Chair
  // endorsed a credit (to the Registrar Head), and the Head returned one (to the
  // Program Chair): see ADR 0026, amended.
```

2. After the `transferee_credit_endorsed` entry add:

```ts
  transferee_credit_returned: {
    label: "Credit returned",
    tone: "warning",
    icon: FileCheck,
  },
```

3. In the routing `switch`, replace

```ts
    case "transferee_credit_endorsed":
      return role === "registrar_staff" ? "/portal/credit-mappings" : null
```

with

```ts
    case "transferee_credit_endorsed":
      return role === "registrar_head" ? "/portal/credit-mappings" : null
    case "transferee_credit_returned":
      return role === "program_chair" ? "/portal/credit-mappings" : null
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/components/portal/registrar-records-workspace.test.tsx src/features/portal src/features/components/portal/portal-notification-sheet.test.tsx src/features/lib` then `npm run typecheck` and `npx eslint src/features/components/portal/registrar-records-workspace.tsx src/features/portal/role-capabilities.ts src/features/lib/notification-presentation.ts --max-warnings=0`.
Expected: PASS, `tsc` exit 0, ESLint clean. `module-registry.test.tsx` iterates every module of every role: it must still pass (the Head's new `credit-mappings` module routes through `CreditMappingsModuleRouter`, which renders `RegistrarRecordsWorkspace` for any non-chair role). Prettier: same rule as Task 8 (format only files that were clean at `HEAD`).

- [ ] **Step 5: Checkpoint**

`PROGRESS.md`: Task 9 done. **Do not commit.**

---

### Task 10: Verification across both apps, and the hand-off

**Files:** none changed here except `PROGRESS.md` and the memory note.

- [ ] **Step 1: Backend focused set**

Run, from `backend/`, on the private test database (Global Constraints):
`php artisan test tests/Unit/Domain tests/Unit/Models tests/Unit/Actions/Academic tests/Unit/Contracts tests/Feature/Database/AddSubmissionAndReturnToTransfereeCreditsTableTest.php tests/Feature/Database/TransfereeAndWithdrawalMigrationTest.php tests/Feature/Api/V1/TransfereeCreditsEndpointTest.php tests/Feature/Api/V1/ApiSurfaceTest.php tests/Feature/Api/V1/EligibleSubjectsEndpointTest.php tests/Feature/Api/V1/EnrollmentsEndpointTest.php tests/Feature/Api/V1/ProspectusEndpointTest.php tests/Feature/Actions/Academic`
Expected: all PASS. Record the exact counts.

- [ ] **Step 2: Backend full suite (once, alone, on its own private database)**

Run the full suite (`php artisan test`) in a background job on a private database that no other session is using; it takes about 30 minutes (the previous full run was 1,756 s). Expected: 0 failures. If the migration tests that rebuild tables fail only while another session is working in the project, say so and re-run alone; never report a full-suite pass that did not happen.

- [ ] **Step 3: Static checks**

From `backend/`: `vendor/bin/pint --test` on the changed PHP files and `vendor/bin/phpstan analyse --memory-limit=1G` on the new and rewritten Action, Policy and Request files. From `frontend/`: `npm run typecheck`, `npx eslint <changed files> --max-warnings=0`, and the full `npm run test` (about 15 minutes with `--maxWorkers=6` if timeouts appear under load). Record exact results.

- [ ] **Step 4: Real-browser pass (recommended before the owner relies on it)**

Follow the "private backend" recipe in the `browser-pass-recipe` memory (a scratch database on :3310, `php -S` on :8001, a production build on :3100; never the owner's :3000 or :3306). Journey: a Transferee student adds two subjects (one with a mistake), edits one, removes none, presses **Submit to Program Head**; a Program Chair sees both as pending, maps and endorses one and declines the other; the Registrar Head sees the endorsed one, **Returns** it with a reason; the Chair sees it back, re-endorses; the Head **Approves**; the student's list shows "Awaiting Registrar Head" and then the decision; the Enrollment page of a transferee with only saved drafts still says credit mapping is required. Note anything that jsdom could not see.

- [ ] **Step 5: Update PROGRESS.md and the memory note**

Replace the plan-progress lines with the final entry: what was done, the verification actually run with counts, what was not run, and the **owner's next step**: run `php artisan migrate` in `backend/` (new migration `2026_10_04_000004_add_submission_and_return_to_transferee_credits_table`) on the dev database, and on Hostinger before or with any deploy; tell the Registrar Head that rows already `endorsed` are now theirs. Update `transferee-credit-mapping-pay-first-spec.md` in the project memory to say Slice 1 is implemented (uncommitted) and name the plan file. **Do not commit or push**; wait for the owner to ask for a saving point.

---

## Self-review (run against the spec; fixes already applied above)

**Spec coverage (Slice 1):** draft status and columns (Task 1); students save drafts, drafts hidden, `submit` idempotent with one chair notice (Task 2); edit and remove own draft (Task 3); Registrar Head decides, Staff read-only, `return`, endorse notice to the Head, endorsed-row carry-over (Task 4); drafts do not satisfy the gate (Task 5); OpenAPI, ADR 0026 amendment, data dictionary, PRD, route surface (Task 6); student list UI, Head screen, navigation, notifications, Enrollment page (Tasks 7 to 9); verification and hand-off (Task 10). The two student-level bulk endpoints named in the spec's Slice 1 are deliberately in the Slice 2 plan (see "Scope").

**Placeholders:** none. Every code step shows the code; the only "run it" steps name the command and the expected result.

**Type consistency:** `TransfereeCreditStatus::Draft`, `submitted_at`/`returned_by`/`returned_at`/`return_reason`, `AuditAction::TRANSFEREE_CREDIT_SUBMITTED|RETURNED|DELETED`, `NotificationType::TransfereeCreditReturned`, `SubmitTransfereeCredits`, `DeleteTransfereeCreditDraft`, policy abilities `submit`/`editDraft`/`deleteDraft`/`decide`, route names `transferee-credits.submit`/`.destroy`, and the frontend names `submitTransfereeCredits`, `deleteTransfereeCredit`, `useSubmitTransfereeCreditsMutation`, `useDeleteTransfereeCreditMutation`, `isCreditMappingIncomplete`, `return` action are used identically everywhere they appear.
