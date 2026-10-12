# Full-Payment Discount (10%) With a Registrar Head Override — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a student who pays the whole net assessment in one Cashier payment a configurable full-payment discount (10% by default), give installments no discount and no extra fee, and let the Registrar Head edit the percentage and the validity window.

**Architecture:** One single-row settings table (`payment_discount_settings`) read through a pure domain class (`FullPaymentDiscountPolicy`) and one quoting action (`QuoteFullPayment`). The discount is a negative `assessment_items` line (`full_payment_discount`) written **inside the existing payment-confirmation transaction** (returnee, `ApplyFullPaymentDiscount::forCashierPayment`) or **at Registrar approval from the percentage frozen on the student profile** (freshman/transferee, `ApplyFullPaymentDiscount::forHeldCredit`). The Cashier modals read a server-computed quote; a new Registrar Head module edits the setting.

**Tech Stack:** Laravel (PHP, bcmath money strings, Sanctum bearer tokens, Form Requests, Policies, Actions, API Resources, PHPUnit), Next.js client-rendered React with strict TypeScript, TanStack Query, React Hook Form + Zod, Tailwind + shadcn/ui, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-11-full-payment-discount-design.md` (approved by the owner 2026-10-11; corrected 2026-10-12, see its top note). Read it first; this plan implements it task by task.

## Repository rules that override the generic template

- **No commits and no pushes.** `AGENTS.md`: "Do not commit or push unless the user explicitly requests a GitHub saving point." Every task ends with a **Checkpoint** step (narrow checks + a `PROGRESS.md` line) instead of a commit. Never stage the untracked `Subject And Prerequisuite/GradingSheet_*.xlsx`.
- Work directly on `main`. No worktree.
- `AGENTS.md` also requires: update `PROGRESS.md` at the start, after every milestone or failure, and before ending. Another editor can clobber `PROGRESS.md`; after each edit re-run `Grep` for your own entry.
- Edit existing files with the Edit tool, not scripted text-mode rewrites (repo blobs are mostly CRLF; see memory note "Windows EOL gotcha"). New files are written with the Write tool.
- All commands run from the repo root `C:\xampp\htdocs\GRC-ENROLLMENT` in Git Bash unless a step says otherwise. Backend tests: `cd backend && php artisan test --filter=<Name>`. Backend style: `cd backend && vendor/bin/pint <files>`; static analysis: `cd backend && composer analyse`. Frontend: `cd frontend && npx vitest run <path>`, `npm run typecheck`, `npm run lint`.
- **Migrations break the owner's running dev server until they are run.** New migrations are allowed to run on the local dev DB (`cd backend && php artisan migrate`); the final handoff must state the two migration names first.
- Do not touch production, the VPS, or deploy anything.

## Global Constraints

- Money is a `bc*` decimal string, rounded half-up to the cent (`bcadd(..., '0.005', 2)`); never a PHP float or JS float on the server path.
- Percentage: `0` to `100`, **at most one decimal place** (stored in `assessment_items.quantity` `decimal(6,1)`); the seeded default is `10.0` from `config('fees.full_payment_discount_percentage')`.
- Validity: `valid_from` / `valid_until` are `Y-m-d` school-calendar dates in `Asia/Manila`, **both inclusive**, both nullable (null = open-ended). `0` percent means off.
- Only the **Registrar Head** may `PUT /api/v1/payment-discount-settings` (through a Policy). Registrar Head and Accounting Staff may `GET` it.
- Installment: no discount and **no extra fee**. A request with no `payment_type` behaves exactly as today.
- **No stacking:** an assessment with a `scholarship_discount` line gets no full-payment discount.
- Idempotent: payment confirmation, the discount line, the frozen pay-first percentage and the settlement each write at most once.
- Lock order: PROFILE → ENROLLMENT → assessment → assessment items (→ SECTIONS where they already apply).
- API: versioned under `/api/v1`, bearer-token auth only (no cookies, no CSRF), error envelope `error.code = VALIDATION_FAILED` for 422.
- Frontend: strict TypeScript, no `any`; API calls only in `services/`; TanStack Query hooks in `hooks/`; React Hook Form + Zod for forms; shadcn/ui components. A component that calls `useForm` directly and uses `reset`/`register` carries `"use no memo"` as its first statement (memory note "React Compiler hides useForm").
- The untracked `GradingSheet_*.xlsx` must never be committed.

## Review Focus

Inputs and conditions the spec implies but that are easy to miss; each has a test in the named task.

1. **A payment at 00:30 Manila time, which is still "yesterday" in UTC.** A window ending on the Manila day must still be open. (Task 2 `QuoteFullPaymentTest`.)
2. **The Registrar Head edits the percentage between the Cashier opening the modal and pressing Confirm.** The stale `quoted_amount` is refused with 422 and nothing is written. (Task 4.)
3. **A scholar (an existing `scholarship_discount` line) pays in full.** No second discount, the plain net is collected. (Task 4.)
4. **A pay-first student's estimate differs from the real assessment at Registrar approval** (tuition rate changed in between). The held credit no longer covers the discounted net, so no discount is applied, the enrollment still completes, and the frozen percentage is cleared so it can never apply to a later term. (Task 5.)
5. **Repeats:** the same `full` POST twice, the settlement twice, and a Head `PUT` that changes nothing. No second line, payment or audit row. (Tasks 3, 4, 5.)
6. Also pinned: percentage `0` / `100` / `12.5` and half-up rounding (Task 2); `valid_until` before `valid_from` and a missing date key (Task 3); the Cashier modal still works when the quote request fails (Task 8); a full payment with no estimate is refused (Task 5).

## Task order and dependencies

1 → 2 → 3 (backend foundation), 4 needs 2 and 3, 5 needs 4, 6 can follow 5. Frontend: 7 needs 3, 8 needs 4, 9 needs 5, 10 needs 4, 11 last.

## File structure

**Backend — create**
- `backend/database/migrations/2026_10_12_000001_create_payment_discount_settings_table.php`
- `backend/database/migrations/2026_10_12_000002_add_full_payment_discount_percentage_to_student_profiles_table.php`
- `backend/app/Models/PaymentDiscountSetting.php`
- `backend/app/Domain/Billing/FullPaymentDiscountPolicy.php` (pure rules)
- `backend/app/Domain/Billing/FullPaymentQuote.php` (value object)
- `backend/app/Actions/Billing/QuoteFullPayment.php`
- `backend/app/Actions/Billing/ApplyFullPaymentDiscount.php`
- `backend/app/Policies/PaymentDiscountSettingPolicy.php`
- `backend/app/Http/Requests/Api/V1/Billing/UpdatePaymentDiscountSettingRequest.php`
- `backend/app/Http/Resources/Api/V1/Billing/PaymentDiscountSettingResource.php`
- `backend/app/Http/Resources/Api/V1/PaymentQuoteResource.php`
- `backend/app/Http/Controllers/Api/V1/Billing/PaymentDiscountSettingController.php`
- `backend/app/Http/Controllers/Api/V1/EnrollmentPaymentQuoteController.php`
- Tests: `tests/Feature/Database/PaymentDiscountMigrationsTest.php`, `tests/Feature/Models/PaymentDiscountSettingTest.php`, `tests/Unit/Domain/Billing/FullPaymentDiscountPolicyTest.php`, `tests/Feature/Billing/QuoteFullPaymentTest.php`, `tests/Feature/Api/V1/PaymentDiscountSettingEndpointTest.php`, `tests/Feature/Api/V1/FullPaymentDiscountEndpointTest.php`, `tests/Feature/Api/V1/FullPaymentPayFirstTest.php`

**Backend — modify**
- `backend/config/fees.php`, `backend/app/Domain/Billing/AssessmentItemCategory.php`, `backend/app/Domain/Billing/ScholarshipBase.php`, `backend/app/Models/StudentProfile.php`
- `backend/app/Domain/Audit/AuditAction.php`, `backend/app/Domain/Audit/AuditableType.php`
- `backend/app/Actions/Enrollment/ConfirmPayment.php`, `backend/app/Http/Requests/Api/V1/Enrollment/ConfirmPaymentRequest.php`, `backend/app/Actions/Enrollment/BuildCorSnapshot.php`
- `backend/app/Actions/Enrollment/PreviewFreshmanPayment.php`, `backend/app/Domain/Enrollment/FreshmanPaymentPreview.php`, `backend/app/Http/Resources/Api/V1/FreshmanPaymentPreviewResource.php`, `backend/app/Http/Requests/Api/V1/StudentProfile/ConfirmFreshmanPaymentRequest.php`, `backend/app/Actions/Enrollment/ConfirmFreshmanPayment.php`, `backend/app/Actions/Enrollment/FreshmanPaymentRules.php`, `backend/app/Actions/Enrollment/SettleEnrollmentFromAdvanceCredit.php`
- `backend/routes/api.php`, `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`

**Docs — create/modify:** `docs/adr/0046-full-payment-discount.md`, `PRD.md`, `docs/api/openapi.yaml`, `docs/data-dictionary/enrollment-records.md`, `docs/data-dictionary/student-profile-foundation.md`, `PROGRESS.md`

**Frontend — create**
- `frontend/src/features/schemas/payment-discount-schema.ts`, `services/payment-discount-service.ts` (+ `.test.ts`), `hooks/use-payment-discount.ts`, `components/portal/payment-discount-workspace.tsx` (+ `.test.tsx`)

**Frontend — modify**
- `portal/role-capabilities.ts`, `portal/module-registry.tsx` and their three tests (`role-capabilities.test.ts`, `module-registry.test.tsx`, `components/pages/portal-module-page.test.tsx`)
- `schemas/enrollment-schema.ts`, `services/enrollment-service.ts` (+ test), `hooks/use-enrollment.ts`, `components/portal/accounting-payment-workspace.tsx` (+ test)
- `schemas/freshman-schema.ts`, `services/freshman-service.test.ts`, `components/portal/freshman-payment-dialog.tsx`
- `schemas/enrollment-document-schema.ts`, `components/portal/certificate-of-registration-document.tsx` (+ test), `components/portal/statement-of-account-view.tsx` (+ test)

---

### Task 1: Foundation — migrations, setting model, config, discount category

**Files:**
- Create: `backend/database/migrations/2026_10_12_000001_create_payment_discount_settings_table.php`
- Create: `backend/database/migrations/2026_10_12_000002_add_full_payment_discount_percentage_to_student_profiles_table.php`
- Create: `backend/app/Models/PaymentDiscountSetting.php`
- Modify: `backend/config/fees.php`, `backend/app/Domain/Billing/AssessmentItemCategory.php`, `backend/app/Domain/Billing/ScholarshipBase.php`, `backend/app/Models/StudentProfile.php`
- Test: `backend/tests/Feature/Database/PaymentDiscountMigrationsTest.php`, `backend/tests/Feature/Models/PaymentDiscountSettingTest.php`, `backend/tests/Unit/Domain/Billing/ScholarshipTierTest.php` (add one test)

**Interfaces:**
- Produces: table `payment_discount_settings`; column `student_profiles.full_payment_discount_percentage` (`decimal(4,1)` null, cast `decimal:1`); `App\Models\PaymentDiscountSetting::current(): self` (creates the default row on first read); `PaymentDiscountSetting::updater(): BelongsTo`; `AssessmentItemCategory::FullPaymentDiscount` (`full_payment_discount`) and `AssessmentItemCategory::isDiscount(): bool`; `ScholarshipBase::amount()` now skips **both** discount categories.

- [ ] **Step 1: Write the failing migration test**

Create `backend/tests/Feature/Database/PaymentDiscountMigrationsTest.php`:

```php
<?php

namespace Tests\Feature\Database;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\Support\RollsBackThroughMigration;
use Tests\TestCase;

final class PaymentDiscountMigrationsTest extends TestCase
{
    use RefreshDatabase;
    use RollsBackThroughMigration;

    private const SETTINGS_MIGRATION = '2026_10_12_000001_create_payment_discount_settings_table';

    public function test_the_settings_table_and_the_profile_column_exist_and_roll_back(): void
    {
        $this->assertTrue(Schema::hasTable('payment_discount_settings'));
        foreach (['percentage', 'valid_from', 'valid_until', 'updated_by'] as $column) {
            $this->assertTrue(Schema::hasColumn('payment_discount_settings', $column), "Missing {$column}.");
        }
        $this->assertTrue(Schema::hasColumn('student_profiles', 'full_payment_discount_percentage'));

        // The profile-column migration is newer, so rolling back through the settings migration undoes both.
        $this->rollbackThrough(self::SETTINGS_MIGRATION);

        $this->assertFalse(Schema::hasTable('payment_discount_settings'));
        $this->assertFalse(Schema::hasColumn('student_profiles', 'full_payment_discount_percentage'));
    }
}
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd backend && php artisan test --filter=PaymentDiscountMigrationsTest`
Expected: FAIL (`Failed asserting that false is true`, the table does not exist).

- [ ] **Step 3: Create the two migrations**

`backend/database/migrations/2026_10_12_000001_create_payment_discount_settings_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The single row that says how much the full-payment discount is and when it is valid
 * (ADR 0046). `valid_from` and `valid_until` are school-calendar dates (Asia/Manila), both
 * inclusive; NULL means open-ended. The row is created on first read by
 * `PaymentDiscountSetting::current()` rather than here, so a restored older dump cannot
 * leave payment confirmation without a setting.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_discount_settings', function (Blueprint $table) {
            $table->id();
            $table->decimal('percentage', 4, 1);
            $table->date('valid_from')->nullable();
            $table->date('valid_until')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_discount_settings');
    }
};
```

`backend/database/migrations/2026_10_12_000002_add_full_payment_discount_percentage_to_student_profiles_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The full-payment discount percentage quoted to a pay-first student (freshman or
 * transferee) when the Cashier took a full payment (ADR 0046). The money is held as credit
 * before any assessment exists, so the quoted percentage is frozen here and applied when the
 * Registrar approves the enrollment; it is cleared once that settlement has used it.
 * NULL for everyone else and for an installment.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->decimal('full_payment_discount_percentage', 4, 1)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->dropColumn('full_payment_discount_percentage');
        });
    }
};
```

- [ ] **Step 4: Run the migration test and confirm it passes**

Run: `cd backend && php artisan test --filter=PaymentDiscountMigrationsTest`
Expected: PASS (1 test).

- [ ] **Step 5: Write the failing model and category tests**

Create `backend/tests/Feature/Models/PaymentDiscountSettingTest.php`:

```php
<?php

namespace Tests\Feature\Models;

use App\Models\PaymentDiscountSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class PaymentDiscountSettingTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_first_read_creates_the_default_row_once(): void
    {
        self::assertSame(0, PaymentDiscountSetting::query()->count());

        $first = PaymentDiscountSetting::current();
        $second = PaymentDiscountSetting::current();

        self::assertSame('10.0', $first->percentage);
        self::assertNull($first->valid_from);
        self::assertNull($first->valid_until);
        self::assertSame($first->id, $second->id);
        self::assertSame(1, PaymentDiscountSetting::query()->count());
    }

    public function test_the_default_comes_from_the_fees_config(): void
    {
        config(['fees.full_payment_discount_percentage' => '12.5']);

        self::assertSame('12.5', PaymentDiscountSetting::current()->percentage);
    }

    public function test_a_saved_row_wins_over_the_config(): void
    {
        PaymentDiscountSetting::query()->create(['percentage' => '7.5', 'valid_from' => '2026-10-01', 'valid_until' => '2026-10-31']);
        config(['fees.full_payment_discount_percentage' => '12.5']);

        $setting = PaymentDiscountSetting::current();

        self::assertSame('7.5', $setting->percentage);
        self::assertSame('2026-10-01', $setting->valid_from?->toDateString());
        self::assertSame('2026-10-31', $setting->valid_until?->toDateString());
    }
}
```

Append this test to `backend/tests/Unit/Domain/Billing/ScholarshipTierTest.php` (inside the class, before its closing brace):

```php
    public function test_the_base_skips_both_discount_lines(): void
    {
        $items = [
            new AssessmentItem(['category' => 'tuition', 'amount' => '750.00']),
            new AssessmentItem(['category' => 'miscellaneous', 'amount' => '300.00']),
            new AssessmentItem(['category' => 'scholarship_discount', 'amount' => '-420.00']),
            new AssessmentItem(['category' => 'full_payment_discount', 'amount' => '-105.00']),
        ];

        self::assertSame('1050.00', ScholarshipBase::amount($items));
        self::assertTrue(AssessmentItemCategory::FullPaymentDiscount->isDiscount());
        self::assertTrue(AssessmentItemCategory::ScholarshipDiscount->isDiscount());
        self::assertFalse(AssessmentItemCategory::Tuition->isDiscount());
    }
```

- [ ] **Step 6: Run them and confirm they fail**

Run: `cd backend && php artisan test --filter="PaymentDiscountSettingTest|ScholarshipTierTest"`
Expected: FAIL (`Class "App\Models\PaymentDiscountSetting" not found`; `Undefined constant ...FullPaymentDiscount`).

- [ ] **Step 7: Implement the model, config, enum case and base change**

Create `backend/app/Models/PaymentDiscountSetting.php`:

```php
<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The one row that configures the full-payment discount (ADR 0046): its percentage and the
 * school-calendar dates between which it is valid (both inclusive, NULL = open-ended).
 * Only the Registrar Head changes it. Read it with `current()`, never with a bare query, so
 * a database that has never saved one still has the configured default.
 *
 * @property int $id
 * @property numeric-string $percentage
 * @property ?CarbonImmutable $valid_from
 * @property ?CarbonImmutable $valid_until
 * @property ?int $updated_by
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read ?User $updater
 */
final class PaymentDiscountSetting extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'percentage',
        'valid_from',
        'valid_until',
        'updated_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'percentage' => 'decimal:1',
            'valid_from' => 'immutable_date',
            'valid_until' => 'immutable_date',
        ];
    }

    /**
     * The setting, created on first use from `config('fees.full_payment_discount_percentage')`.
     * Two requests racing on the very first read could create two rows; both then read the
     * lowest id, so they still agree.
     */
    public static function current(): self
    {
        $existing = self::query()->orderBy('id')->first();

        if ($existing instanceof self) {
            return $existing;
        }

        return self::query()->create([
            'percentage' => bcadd((string) config('fees.full_payment_discount_percentage', '10.0'), '0', 1),
        ]);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
```

Edit `backend/config/fees.php` — replace the line

```php
    'tuition_per_unit' => env('FEES_TUITION_PER_UNIT', '200.00'),
```

with

```php
    'tuition_per_unit' => env('FEES_TUITION_PER_UNIT', '200.00'),

    /**
     * ADR 0046: the starting full-payment discount, used only when the
     * `payment_discount_settings` row does not exist yet. After that, the percentage the
     * Registrar Head saved is what counts. One decimal place at most.
     */
    'full_payment_discount_percentage' => env('FEES_FULL_PAYMENT_DISCOUNT_PERCENTAGE', '10.0'),
```

Edit `backend/app/Domain/Billing/AssessmentItemCategory.php` — replace the whole `enum` body (from `enum AssessmentItemCategory: string` to the closing brace) with:

```php
enum AssessmentItemCategory: string
{
    case Tuition = 'tuition';
    case Miscellaneous = 'miscellaneous';
    case ScholarshipDiscount = 'scholarship_discount';
    case FullPaymentDiscount = 'full_payment_discount';

    public function label(): string
    {
        return match ($this) {
            self::Tuition => 'Tuition',
            self::Miscellaneous => 'Miscellaneous',
            self::ScholarshipDiscount => 'Scholarship discount',
            self::FullPaymentDiscount => 'Full-payment discount',
        };
    }

    /** A negative line that reduces the assessment: never part of the base a discount is taken from. */
    public function isDiscount(): bool
    {
        return $this === self::ScholarshipDiscount || $this === self::FullPaymentDiscount;
    }
}
```

and extend the enum's docblock by adding, before the closing `*/`:

```
 * `FullPaymentDiscount` is the second such decision (ADR 0046 — the Cashier's
 * full-payment discount, a negative line written at payment confirmation).
```

Edit `backend/app/Domain/Billing/ScholarshipBase.php` — replace

```php
            if ($item->category === AssessmentItemCategory::ScholarshipDiscount) {
                continue;
            }
```

with

```php
            if ($item->category->isDiscount()) {
                continue;
            }
```

and update the docblock sentence "every line except an existing scholarship line" to "every line except an existing discount line (scholarship or full-payment)". Remove the now-unused `use App\Domain\Billing\AssessmentItemCategory;` only if the file has no other reference (it is in the same namespace, so there is no `use` line to remove).

Edit `backend/app/Models/StudentProfile.php`: add a `@property` line after the `freshman_payment_confirmed_at` one:

```
 * @property ?numeric-string $full_payment_discount_percentage
```

and add to the `casts()` array, after `'freshman_payment_confirmed_at' => 'immutable_datetime',`:

```php
            'full_payment_discount_percentage' => 'decimal:1',
```

(Do not add it to `$fillable`; it is only ever written with `forceFill`.)

- [ ] **Step 8: Run the tests and confirm they pass**

Run: `cd backend && php artisan test --filter="PaymentDiscountMigrationsTest|PaymentDiscountSettingTest|ScholarshipTierTest"`
Expected: PASS.

- [ ] **Step 9: Checkpoint (no commit)**

Run: `cd backend && vendor/bin/pint app/Models/PaymentDiscountSetting.php app/Models/StudentProfile.php app/Domain/Billing database/migrations/2026_10_12_000001_create_payment_discount_settings_table.php database/migrations/2026_10_12_000002_add_full_payment_discount_percentage_to_student_profiles_table.php tests/Feature/Database/PaymentDiscountMigrationsTest.php tests/Feature/Models/PaymentDiscountSettingTest.php tests/Unit/Domain/Billing/ScholarshipTierTest.php`
Then `cd backend && php artisan migrate` (local dev DB) and `php artisan test --filter=AssessmentComputationTest` to confirm nothing else moved. Add a one-line milestone to the top `PROGRESS.md` entry ("Task 1 done: tables, model, category") and `Grep` that the entry is still there.

---

### Task 2: Pure rules and the quote action

**Files:**
- Create: `backend/app/Domain/Billing/FullPaymentDiscountPolicy.php`, `backend/app/Domain/Billing/FullPaymentQuote.php`, `backend/app/Actions/Billing/QuoteFullPayment.php`
- Modify: `backend/app/Models/PaymentDiscountSetting.php` (add `toPolicy()`)
- Test: `backend/tests/Unit/Domain/Billing/FullPaymentDiscountPolicyTest.php`, `backend/tests/Feature/Billing/QuoteFullPaymentTest.php`

**Interfaces:**
- Consumes: `PaymentDiscountSetting::current()`, `AssessmentItemCategory::isDiscount()`, `ScholarshipBase::amount()` (Task 1).
- Produces:
  - `new FullPaymentDiscountPolicy(string $percentage, ?string $validFrom = null, ?string $validUntil = null)`; `status(string $day): string` returning one of `FullPaymentDiscountPolicy::OFF|SCHEDULED|ACTIVE|EXPIRED` (`'off'|'scheduled'|'active'|'expired'`); `discountFor(string $base): string`; `static formatPercentage(string $percentage): string` (`'10.0'` → `'10'`, `'12.5'` → `'12.5'`); `static today(): string` (Manila `Y-m-d`).
  - `FullPaymentQuote` (readonly): `?string $baseTotal`, `?string $percentage`, `?string $discountAmount`, `?string $netTotal` (what a full payment collects), `?string $reason`; `applies(): bool`; named constructors `applied(base, percentage, discount, net)`, `notApplied(total, reason)`, `unavailable()`; constants `REASON_SCHOLAR = 'scholar'`, `REASON_NO_ESTIMATE = 'no_estimate'`. A non-applying quote's `reason` is `off|scheduled|expired|scholar|no_estimate`.
  - `PaymentDiscountSetting::toPolicy(): FullPaymentDiscountPolicy`.
  - `QuoteFullPayment::forAssessment(Assessment $assessment, ?FullPaymentDiscountPolicy $policy = null): FullPaymentQuote` (needs `$assessment->items` loaded) and `QuoteFullPayment::forEstimate(?string $estimatedTotal, ?FullPaymentDiscountPolicy $policy = null): FullPaymentQuote`.

- [ ] **Step 1: Write the failing pure-rule test**

Create `backend/tests/Unit/Domain/Billing/FullPaymentDiscountPolicyTest.php`:

```php
<?php

namespace Tests\Unit\Domain\Billing;

use App\Domain\Billing\FullPaymentDiscountPolicy;
use PHPUnit\Framework\TestCase;

final class FullPaymentDiscountPolicyTest extends TestCase
{
    public function test_it_is_active_with_no_dates(): void
    {
        self::assertSame('active', (new FullPaymentDiscountPolicy('10.0'))->status('2026-10-12'));
    }

    public function test_zero_percent_is_off_even_inside_the_window(): void
    {
        self::assertSame('off', (new FullPaymentDiscountPolicy('0.0', '2026-10-01', '2026-10-31'))->status('2026-10-12'));
    }

    public function test_both_window_ends_are_inclusive(): void
    {
        $policy = new FullPaymentDiscountPolicy('10.0', '2026-10-10', '2026-10-20');

        self::assertSame('scheduled', $policy->status('2026-10-09'));
        self::assertSame('active', $policy->status('2026-10-10'));
        self::assertSame('active', $policy->status('2026-10-20'));
        self::assertSame('expired', $policy->status('2026-10-21'));
    }

    public function test_a_single_date_leaves_the_other_side_open(): void
    {
        $from = new FullPaymentDiscountPolicy('10.0', '2026-10-10', null);
        self::assertSame('scheduled', $from->status('2026-10-09'));
        self::assertSame('active', $from->status('2030-01-01'));

        $until = new FullPaymentDiscountPolicy('10.0', null, '2026-10-20');
        self::assertSame('active', $until->status('2000-01-01'));
        self::assertSame('expired', $until->status('2026-10-21'));
    }

    public function test_the_discount_is_the_percentage_of_the_base_rounded_half_up(): void
    {
        $ten = new FullPaymentDiscountPolicy('10.0');

        self::assertSame('105.00', $ten->discountFor('1050.00'));
        self::assertSame('0.00', $ten->discountFor('0.00'));
        // 10% of 333.35 is 33.335, which rounds up to 33.34.
        self::assertSame('33.34', $ten->discountFor('333.35'));
        // 12.5% of 100.10 is 12.5125, which rounds down to 12.51.
        self::assertSame('12.51', (new FullPaymentDiscountPolicy('12.5'))->discountFor('100.10'));
        self::assertSame('1050.00', (new FullPaymentDiscountPolicy('100.0'))->discountFor('1050.00'));
    }

    public function test_the_percentage_reads_without_a_trailing_zero(): void
    {
        self::assertSame('10', FullPaymentDiscountPolicy::formatPercentage('10.0'));
        self::assertSame('12.5', FullPaymentDiscountPolicy::formatPercentage('12.5'));
        self::assertSame('100', FullPaymentDiscountPolicy::formatPercentage('100.0'));
    }
}
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd backend && php artisan test --filter=FullPaymentDiscountPolicyTest`
Expected: FAIL (`Class "App\Domain\Billing\FullPaymentDiscountPolicy" not found`).

- [ ] **Step 3: Implement the pure rules and the quote value object**

Create `backend/app/Domain/Billing/FullPaymentDiscountPolicy.php`:

```php
<?php

namespace App\Domain\Billing;

/**
 * The rules of the full-payment discount (ADR 0046), with no database and no framework
 * state: a percentage (0 to 100, one decimal) and an optional school-calendar window.
 * Dates are `Y-m-d` strings in the school's calendar (Asia/Manila), both ends inclusive,
 * compared as strings, which is exact for that format.
 */
final readonly class FullPaymentDiscountPolicy
{
    public const OFF = 'off';

    public const SCHEDULED = 'scheduled';

    public const ACTIVE = 'active';

    public const EXPIRED = 'expired';

    private const TIMEZONE = 'Asia/Manila';

    /**
     * @param  numeric-string  $percentage  one decimal place, 0 to 100
     */
    public function __construct(
        public string $percentage,
        public ?string $validFrom = null,
        public ?string $validUntil = null,
    ) {}

    /** Today's date in the school's calendar, not the server's (UTC). */
    public static function today(): string
    {
        return now(self::TIMEZONE)->toDateString();
    }

    /**
     * @return 'off'|'scheduled'|'active'|'expired'
     */
    public function status(string $day): string
    {
        if (bccomp($this->percentage, '0', 1) <= 0) {
            return self::OFF;
        }

        if ($this->validFrom !== null && $day < $this->validFrom) {
            return self::SCHEDULED;
        }

        if ($this->validUntil !== null && $day > $this->validUntil) {
            return self::EXPIRED;
        }

        return self::ACTIVE;
    }

    /**
     * The amount taken off `$base`, a positive two-decimal string rounded half-up to the
     * cent like every other assessment amount.
     *
     * @param  numeric-string  $base
     * @return numeric-string
     */
    public function discountFor(string $base): string
    {
        return bcadd(bcdiv(bcmul($base, $this->percentage, 6), '100', 6), '0.005', 2);
    }

    /** "10" for 10.0 and "12.5" for 12.5: the percentage as it reads on a line label. */
    public static function formatPercentage(string $percentage): string
    {
        $normalized = bcadd($percentage, '0', 1);

        return str_ends_with($normalized, '.0') ? substr($normalized, 0, -2) : $normalized;
    }
}
```

Create `backend/app/Domain/Billing/FullPaymentQuote.php`:

```php
<?php

namespace App\Domain\Billing;

/**
 * What paying in full would collect right now (ADR 0046). `netTotal` is always the amount a
 * full payment collects: the discounted amount when a discount applies, otherwise the plain
 * total. When no discount applies, `reason` says why (`off`, `scheduled`, `expired`,
 * `scholar` or `no_estimate`). Only `no_estimate` leaves every amount null: a pay-first
 * student with nothing to estimate from yet.
 */
final readonly class FullPaymentQuote
{
    public const REASON_SCHOLAR = 'scholar';

    public const REASON_NO_ESTIMATE = 'no_estimate';

    private function __construct(
        public ?string $baseTotal,
        public ?string $percentage,
        public ?string $discountAmount,
        public ?string $netTotal,
        public ?string $reason,
    ) {}

    /**
     * @param  numeric-string  $base
     * @param  numeric-string  $percentage
     * @param  numeric-string  $discountAmount
     * @param  numeric-string  $netTotal
     */
    public static function applied(string $base, string $percentage, string $discountAmount, string $netTotal): self
    {
        return new self($base, $percentage, $discountAmount, $netTotal, null);
    }

    /**
     * @param  numeric-string  $total
     */
    public static function notApplied(string $total, string $reason): self
    {
        return new self($total, null, null, $total, $reason);
    }

    public static function unavailable(): self
    {
        return new self(null, null, null, null, self::REASON_NO_ESTIMATE);
    }

    public function applies(): bool
    {
        return $this->reason === null;
    }
}
```

Add to `backend/app/Models/PaymentDiscountSetting.php` (new `use` and method):

```php
use App\Domain\Billing\FullPaymentDiscountPolicy;
```

```php
    public function toPolicy(): FullPaymentDiscountPolicy
    {
        return new FullPaymentDiscountPolicy(
            $this->percentage,
            $this->valid_from?->toDateString(),
            $this->valid_until?->toDateString(),
        );
    }
```

- [ ] **Step 4: Run the pure-rule test and confirm it passes**

Run: `cd backend && php artisan test --filter=FullPaymentDiscountPolicyTest`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the failing quote-action test**

Create `backend/tests/Feature/Billing/QuoteFullPaymentTest.php`:

```php
<?php

namespace Tests\Feature\Billing;

use App\Actions\Billing\QuoteFullPayment;
use App\Domain\Billing\FullPaymentDiscountPolicy;
use App\Domain\Billing\FullPaymentQuote;
use App\Models\Assessment;
use App\Models\AssessmentItem;
use Carbon\Carbon;
use Tests\TestCase;

/**
 * No database: assessments are built in memory and the policy is passed in.
 */
final class QuoteFullPaymentTest extends TestCase
{
    /**
     * @param  list<array<string, string>>  $lines
     */
    private function assessment(array $lines, string $total): Assessment
    {
        $assessment = new Assessment(['total_amount' => $total]);
        $assessment->setRelation('items', collect(array_map(fn (array $line): AssessmentItem => new AssessmentItem($line), $lines)));

        return $assessment;
    }

    /** @return list<array<string, string>> */
    private function plainLines(): array
    {
        return [
            ['category' => 'tuition', 'label' => 'Tuition', 'amount' => '750.00'],
            ['category' => 'miscellaneous', 'label' => 'Registration', 'amount' => '300.00'],
        ];
    }

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo(Carbon::parse('2026-10-12 09:00:00', 'Asia/Manila'));
    }

    public function test_an_active_discount_is_taken_from_the_whole_assessment(): void
    {
        $quote = (new QuoteFullPayment)->forAssessment(
            $this->assessment($this->plainLines(), '1050.00'),
            new FullPaymentDiscountPolicy('10.0'),
        );

        self::assertTrue($quote->applies());
        self::assertSame('1050.00', $quote->baseTotal);
        self::assertSame('10.0', $quote->percentage);
        self::assertSame('105.00', $quote->discountAmount);
        self::assertSame('945.00', $quote->netTotal);
        self::assertNull($quote->reason);
    }

    public function test_a_scholar_gets_no_second_discount_and_pays_the_net_they_already_owe(): void
    {
        $lines = [...$this->plainLines(), ['category' => 'scholarship_discount', 'label' => 'Scholarship discount (40%)', 'quantity' => '40.0', 'amount' => '-420.00']];

        $quote = (new QuoteFullPayment)->forAssessment($this->assessment($lines, '630.00'), new FullPaymentDiscountPolicy('10.0'));

        self::assertFalse($quote->applies());
        self::assertSame(FullPaymentQuote::REASON_SCHOLAR, $quote->reason);
        self::assertSame('630.00', $quote->netTotal);
        self::assertNull($quote->discountAmount);
    }

    public function test_a_closed_off_or_not_yet_open_discount_collects_the_plain_total_and_says_why(): void
    {
        $assessment = $this->assessment($this->plainLines(), '1050.00');
        $action = new QuoteFullPayment;

        $expired = $action->forAssessment($assessment, new FullPaymentDiscountPolicy('10.0', '2026-10-01', '2026-10-11'));
        $scheduled = $action->forAssessment($assessment, new FullPaymentDiscountPolicy('10.0', '2026-10-13', null));
        $off = $action->forAssessment($assessment, new FullPaymentDiscountPolicy('0.0'));

        self::assertSame('expired', $expired->reason);
        self::assertSame('scheduled', $scheduled->reason);
        self::assertSame('off', $off->reason);
        foreach ([$expired, $scheduled, $off] as $quote) {
            self::assertFalse($quote->applies());
            self::assertSame('1050.00', $quote->netTotal);
        }
    }

    public function test_the_window_is_read_in_manila_time_not_utc(): void
    {
        // 00:30 on 12 October in Manila is still 11 October in UTC; a window ending on the 12th is open.
        $this->travelTo(Carbon::parse('2026-10-12 00:30:00', 'Asia/Manila'));

        self::assertSame('2026-10-12', FullPaymentDiscountPolicy::today());
        $quote = (new QuoteFullPayment)->forAssessment(
            $this->assessment($this->plainLines(), '1050.00'),
            new FullPaymentDiscountPolicy('10.0', '2026-10-12', '2026-10-12'),
        );
        self::assertTrue($quote->applies());
    }

    public function test_an_estimate_is_quoted_the_same_way(): void
    {
        $quote = (new QuoteFullPayment)->forEstimate('4700.00', new FullPaymentDiscountPolicy('10.0'));

        self::assertTrue($quote->applies());
        self::assertSame('470.00', $quote->discountAmount);
        self::assertSame('4230.00', $quote->netTotal);
    }

    public function test_no_estimate_means_no_quote(): void
    {
        $quote = (new QuoteFullPayment)->forEstimate(null, new FullPaymentDiscountPolicy('10.0'));

        self::assertFalse($quote->applies());
        self::assertSame(FullPaymentQuote::REASON_NO_ESTIMATE, $quote->reason);
        self::assertNull($quote->netTotal);
        self::assertNull($quote->baseTotal);
    }
}
```

- [ ] **Step 6: Run it and confirm it fails**

Run: `cd backend && php artisan test --filter=QuoteFullPaymentTest`
Expected: FAIL (`Class "App\Actions\Billing\QuoteFullPayment" not found`).

- [ ] **Step 7: Implement the quote action**

Create `backend/app/Actions/Billing/QuoteFullPayment.php`:

```php
<?php

namespace App\Actions\Billing;

use App\Domain\Billing\AssessmentItemCategory;
use App\Domain\Billing\FullPaymentDiscountPolicy;
use App\Domain\Billing\FullPaymentQuote;
use App\Domain\Billing\ScholarshipBase;
use App\Models\Assessment;
use App\Models\AssessmentItem;
use App\Models\PaymentDiscountSetting;

/**
 * What a full payment would collect right now (ADR 0046). The framework boundary of the
 * pure `FullPaymentDiscountPolicy`: it loads the saved setting when none is passed, reads
 * the school's calendar day, and adds the two reasons the pure class cannot know — a
 * scholarship already on the assessment, and a pay-first student with nothing to estimate
 * from. Writes nothing.
 */
final readonly class QuoteFullPayment
{
    /**
     * For an assessment that already exists (`$assessment->items` must be loaded).
     */
    public function forAssessment(Assessment $assessment, ?FullPaymentDiscountPolicy $policy = null): FullPaymentQuote
    {
        $items = $assessment->items;
        $total = (string) $assessment->total_amount;

        $hasScholarship = $items->contains(
            fn (AssessmentItem $item): bool => $item->category === AssessmentItemCategory::ScholarshipDiscount,
        );

        if ($hasScholarship) {
            return FullPaymentQuote::notApplied($total, FullPaymentQuote::REASON_SCHOLAR);
        }

        return $this->quote(ScholarshipBase::amount($items), $total, $policy);
    }

    /**
     * For a pay-first student, from the estimated total of the assessment they will get.
     *
     * @param  numeric-string|null  $estimatedTotal
     */
    public function forEstimate(?string $estimatedTotal, ?FullPaymentDiscountPolicy $policy = null): FullPaymentQuote
    {
        if ($estimatedTotal === null) {
            return FullPaymentQuote::unavailable();
        }

        return $this->quote($estimatedTotal, $estimatedTotal, $policy);
    }

    /**
     * @param  numeric-string  $base
     * @param  numeric-string  $total
     */
    private function quote(string $base, string $total, ?FullPaymentDiscountPolicy $policy): FullPaymentQuote
    {
        $policy ??= PaymentDiscountSetting::current()->toPolicy();
        $status = $policy->status(FullPaymentDiscountPolicy::today());

        if ($status !== FullPaymentDiscountPolicy::ACTIVE) {
            return FullPaymentQuote::notApplied($total, $status);
        }

        $discount = $policy->discountFor($base);

        return FullPaymentQuote::applied($base, $policy->percentage, $discount, bcsub($base, $discount, 2));
    }
}
```

- [ ] **Step 8: Run the quote test and confirm it passes**

Run: `cd backend && php artisan test --filter="QuoteFullPaymentTest|FullPaymentDiscountPolicyTest"`
Expected: PASS (12 tests).

- [ ] **Step 9: Checkpoint (no commit)**

Run `cd backend && vendor/bin/pint app/Domain/Billing app/Actions/Billing/QuoteFullPayment.php app/Models/PaymentDiscountSetting.php tests/Unit/Domain/Billing/FullPaymentDiscountPolicyTest.php tests/Feature/Billing/QuoteFullPaymentTest.php` and `cd backend && composer analyse`. Fix any `numeric-string` complaints with `@param`/`@return numeric-string` docblocks or an explicit `/** @var numeric-string $x */` on the variable, not with casts that change values. Add a `PROGRESS.md` milestone line.

---

### Task 3: Settings API, policy, audit and the Registrar Head override

**Files:**
- Modify: `backend/app/Domain/Audit/AuditAction.php`, `backend/app/Domain/Audit/AuditableType.php`, `backend/routes/api.php`, `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`
- Create: `backend/app/Policies/PaymentDiscountSettingPolicy.php`, `backend/app/Http/Requests/Api/V1/Billing/UpdatePaymentDiscountSettingRequest.php`, `backend/app/Http/Resources/Api/V1/Billing/PaymentDiscountSettingResource.php`, `backend/app/Http/Controllers/Api/V1/Billing/PaymentDiscountSettingController.php`
- Test: `backend/tests/Feature/Api/V1/PaymentDiscountSettingEndpointTest.php`

**Interfaces:**
- Consumes: `PaymentDiscountSetting::current()`, `->toPolicy()`, `FullPaymentDiscountPolicy::today()` and `->status()` (Tasks 1–2).
- Produces: `AuditAction::PAYMENT_DISCOUNT_SETTING_UPDATED = 'payment_discount.updated'`; `AuditAction::ASSESSMENT_FULL_PAYMENT_DISCOUNT_APPLIED = 'assessment.full_payment_discount_applied'` (used in Tasks 4–5); `AuditableType::PAYMENT_DISCOUNT_SETTING = 'payment_discount_setting'`; routes `GET|PUT /api/v1/payment-discount-settings` returning `{data: {type: 'payment_discount_setting', percentage: '10.0', valid_from: ?'Y-m-d', valid_until: ?'Y-m-d', status: 'active'|'scheduled'|'expired'|'off', updated_by: ?string, updated_at: ?'...Z'}}`.

- [ ] **Step 1: Add the audit constants**

Edit `backend/app/Domain/Audit/AuditAction.php`: after `public const ASSESSMENT_SCHOLARSHIP_REMOVED = 'assessment.scholarship_removed';` add

```php

    public const ASSESSMENT_FULL_PAYMENT_DISCOUNT_APPLIED = 'assessment.full_payment_discount_applied';

    public const PAYMENT_DISCOUNT_SETTING_UPDATED = 'payment_discount.updated';
```

and in the `values()` list, after `self::ASSESSMENT_SCHOLARSHIP_REMOVED,` add

```php
            self::ASSESSMENT_FULL_PAYMENT_DISCOUNT_APPLIED,
            self::PAYMENT_DISCOUNT_SETTING_UPDATED,
```

Edit `backend/app/Domain/Audit/AuditableType.php`: after `public const FEE_SCHEDULE = 'fee_schedule';` add

```php

    public const PAYMENT_DISCOUNT_SETTING = 'payment_discount_setting';
```

and in its list, after `self::FEE_SCHEDULE,` add `self::PAYMENT_DISCOUNT_SETTING,`.

- [ ] **Step 2: Write the failing endpoint test**

Create `backend/tests/Feature/Api/V1/PaymentDiscountSettingEndpointTest.php`:

```php
<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Audit\AuditAction;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Models\AuditLog;
use App\Models\PaymentDiscountSetting;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class PaymentDiscountSettingEndpointTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/payment-discount-settings';

    private function actAs(UserRole $role): User
    {
        $user = User::create([
            'name' => 'Test '.$role->value, 'email' => 'actor.'.$role->value.'.discount@grc.test', 'password' => 'secret-password-1',
            'role' => $role, 'status' => UserStatus::Active,
        ]);
        $this->app['auth']->forgetGuards();
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_anonymous_requests_are_unauthenticated(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        $this->putJson(self::URL, ['percentage' => 10, 'valid_from' => null, 'valid_until' => null])->assertUnauthorized();
    }

    public function test_other_roles_can_neither_read_nor_change_it(): void
    {
        foreach ([UserRole::Student, UserRole::RegistrarStaff, UserRole::Dean, UserRole::ProgramChair, UserRole::ItAdmin] as $role) {
            $this->actAs($role);
            $this->getJson(self::URL)->assertForbidden();
            $this->putJson(self::URL, ['percentage' => 50, 'valid_from' => null, 'valid_until' => null])->assertForbidden();
        }

        self::assertSame(0, PaymentDiscountSetting::query()->count());
    }

    public function test_accounting_staff_may_read_but_not_change_it(): void
    {
        $this->actAs(UserRole::AccountingStaff);

        $this->getJson(self::URL)->assertOk()->assertJsonPath('data.percentage', '10.0');
        $this->putJson(self::URL, ['percentage' => 50, 'valid_from' => null, 'valid_until' => null])->assertForbidden();
        self::assertSame('10.0', PaymentDiscountSetting::current()->percentage);
    }

    public function test_the_registrar_head_reads_the_default_ten_percent_with_no_dates(): void
    {
        $this->actAs(UserRole::RegistrarHead);

        $this->getJson(self::URL)
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.type', 'payment_discount_setting')
            ->assertJsonPath('data.percentage', '10.0')
            ->assertJsonPath('data.valid_from', null)
            ->assertJsonPath('data.valid_until', null)
            ->assertJsonPath('data.status', 'active');
    }

    public function test_the_registrar_head_changes_the_percentage_and_the_window_and_it_is_audited(): void
    {
        $head = $this->actAs(UserRole::RegistrarHead);

        $this->putJson(self::URL, ['percentage' => 12.5, 'valid_from' => '2026-10-01', 'valid_until' => '2026-12-31'])
            ->assertOk()
            ->assertJsonPath('data.percentage', '12.5')
            ->assertJsonPath('data.valid_from', '2026-10-01')
            ->assertJsonPath('data.valid_until', '2026-12-31')
            ->assertJsonPath('data.updated_by', $head->name);

        $setting = PaymentDiscountSetting::current();
        self::assertSame('12.5', $setting->percentage);
        self::assertSame($head->id, $setting->updated_by);

        $log = AuditLog::query()->where('action', AuditAction::PAYMENT_DISCOUNT_SETTING_UPDATED)->sole();
        self::assertSame($head->id, $log->actor_user_id);
        self::assertSame('10.0', $log->before_values['percentage']);
        self::assertSame('12.5', $log->after_values['percentage']);
        self::assertSame('2026-12-31', $log->after_values['valid_until']);
    }

    public function test_saving_the_same_values_writes_no_audit_row(): void
    {
        $this->actAs(UserRole::RegistrarHead);

        $this->putJson(self::URL, ['percentage' => 10, 'valid_from' => null, 'valid_until' => null])->assertOk();
        $this->putJson(self::URL, ['percentage' => 10.0, 'valid_from' => null, 'valid_until' => null])->assertOk();

        self::assertSame(0, AuditLog::query()->where('action', AuditAction::PAYMENT_DISCOUNT_SETTING_UPDATED)->count());
    }

    public function test_the_status_follows_the_window_and_zero_turns_it_off(): void
    {
        $this->travelTo(Carbon::parse('2026-10-12 09:00:00', 'Asia/Manila'));
        $this->actAs(UserRole::RegistrarHead);

        $this->putJson(self::URL, ['percentage' => 10, 'valid_from' => '2026-10-13', 'valid_until' => null])
            ->assertOk()->assertJsonPath('data.status', 'scheduled');
        $this->putJson(self::URL, ['percentage' => 10, 'valid_from' => null, 'valid_until' => '2026-10-11'])
            ->assertOk()->assertJsonPath('data.status', 'expired');
        $this->putJson(self::URL, ['percentage' => 0, 'valid_from' => null, 'valid_until' => null])
            ->assertOk()->assertJsonPath('data.status', 'off');
    }

    public function test_invalid_input_is_refused_and_nothing_changes(): void
    {
        $this->actAs(UserRole::RegistrarHead);
        PaymentDiscountSetting::current();

        $invalid = [
            'a negative percentage' => ['percentage' => -1, 'valid_from' => null, 'valid_until' => null, 'field' => 'percentage'],
            'over one hundred' => ['percentage' => 100.1, 'valid_from' => null, 'valid_until' => null, 'field' => 'percentage'],
            'two decimals' => ['percentage' => '10.55', 'valid_from' => null, 'valid_until' => null, 'field' => 'percentage'],
            'not a number' => ['percentage' => 'ten', 'valid_from' => null, 'valid_until' => null, 'field' => 'percentage'],
            'a bad date' => ['percentage' => 10, 'valid_from' => '12/10/2026', 'valid_until' => null, 'field' => 'valid_from'],
            'an impossible date' => ['percentage' => 10, 'valid_from' => '2026-02-30', 'valid_until' => null, 'field' => 'valid_from'],
            'an end before the start' => ['percentage' => 10, 'valid_from' => '2026-10-20', 'valid_until' => '2026-10-10', 'field' => 'valid_until'],
        ];

        foreach ($invalid as $label => $case) {
            $field = $case['field'];
            unset($case['field']);

            $this->putJson(self::URL, $case)
                ->assertUnprocessable()
                ->assertJsonPath('error.code', 'VALIDATION_FAILED');
            self::assertArrayHasKey($field, $this->putJson(self::URL, $case)->json('error.errors'), $label);
        }

        // Both date keys must be present (null clears a date); omitting one is a mistake, not "no change".
        $this->putJson(self::URL, ['percentage' => 10])->assertUnprocessable();

        self::assertSame('10.0', PaymentDiscountSetting::current()->percentage);
        self::assertSame(0, AuditLog::query()->where('action', AuditAction::PAYMENT_DISCOUNT_SETTING_UPDATED)->count());
    }
}
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `cd backend && php artisan test --filter=PaymentDiscountSettingEndpointTest`
Expected: FAIL (404 for the unknown route).

- [ ] **Step 4: Implement the policy, request, resource and controller**

Create `backend/app/Policies/PaymentDiscountSettingPolicy.php`:

```php
<?php

namespace App\Policies;

use App\Domain\Identity\UserRole;
use App\Models\User;

/**
 * ADR 0046. The Registrar Head owns the full-payment discount (every Accounting user is staff
 * and Accounting has no head). Accounting Staff may read it, so the Cashier can be told what
 * is on offer, but never change it.
 */
final class PaymentDiscountSettingPolicy
{
    public function view(User $user): bool
    {
        return in_array($user->role, [UserRole::RegistrarHead, UserRole::AccountingStaff], true);
    }

    public function update(User $user): bool
    {
        return $user->role === UserRole::RegistrarHead;
    }
}
```

Create `backend/app/Http/Requests/Api/V1/Billing/UpdatePaymentDiscountSettingRequest.php`:

```php
<?php

namespace App\Http\Requests\Api\V1\Billing;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The Registrar Head's edit of the full-payment discount (ADR 0046). The percentage has at most
 * one decimal place because it is stored in an assessment line's `quantity` (`decimal(6,1)`).
 * Both date keys must be sent: `null` clears a date, so leaving one out is a mistake rather than
 * "keep what is there".
 */
final class UpdatePaymentDiscountSettingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'percentage' => ['required', 'numeric', 'min:0', 'max:100', 'decimal:0,1'],
            'valid_from' => ['present', 'nullable', 'date_format:Y-m-d'],
            'valid_until' => ['present', 'nullable', 'date_format:Y-m-d'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $from = $this->input('valid_from');
            $until = $this->input('valid_until');

            if (is_string($from) && is_string($until) && $until < $from) {
                $validator->errors()->add('valid_until', 'The end date cannot be before the start date.');
            }
        });
    }
}
```

Create `backend/app/Http/Resources/Api/V1/Billing/PaymentDiscountSettingResource.php`:

```php
<?php

namespace App\Http\Resources\Api\V1\Billing;

use App\Domain\Billing\FullPaymentDiscountPolicy;
use App\Models\PaymentDiscountSetting;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @property-read PaymentDiscountSetting $resource */
final class PaymentDiscountSettingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $setting = $this->resource;

        return [
            'type' => 'payment_discount_setting',
            'percentage' => (string) $setting->percentage,
            'valid_from' => $setting->valid_from?->toDateString(),
            'valid_until' => $setting->valid_until?->toDateString(),
            'status' => $setting->toPolicy()->status(FullPaymentDiscountPolicy::today()),
            'updated_by' => $setting->updater?->name,
            'updated_at' => $setting->updated_at?->utc()->format('Y-m-d\TH:i:s\Z'),
        ];
    }
}
```

Create `backend/app/Http/Controllers/Api/V1/Billing/PaymentDiscountSettingController.php`:

```php
<?php

namespace App\Http\Controllers\Api\V1\Billing;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Billing\UpdatePaymentDiscountSettingRequest;
use App\Http\Resources\Api\V1\Billing\PaymentDiscountSettingResource;
use App\Models\PaymentDiscountSetting;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use App\Support\Audit\AuditRequestContextFactory;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The full-payment discount's percentage and validity (ADR 0046). The Registrar Head edits it;
 * Accounting Staff may read it (`PaymentDiscountSettingPolicy`).
 */
final class PaymentDiscountSettingController extends Controller
{
    /** @throws AuthenticationException */
    public function show(Request $request): JsonResponse
    {
        $this->authenticatedUser($request);
        $this->authorize('view', PaymentDiscountSetting::class);

        return $this->noStore(PaymentDiscountSettingResource::make(PaymentDiscountSetting::current()->load('updater'))->response($request));
    }

    /** @throws AuthenticationException */
    public function update(
        UpdatePaymentDiscountSettingRequest $request,
        AuditRecorder $auditRecorder,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);
        $this->authorize('update', PaymentDiscountSetting::class);
        $validated = $request->validated();

        $setting = DB::transaction(function () use ($validated, $actor, $auditRecorder, $contextFactory, $request): PaymentDiscountSetting {
            PaymentDiscountSetting::current();
            $setting = PaymentDiscountSetting::query()->orderBy('id')->lockForUpdate()->firstOrFail();

            $before = self::snapshot($setting);
            $after = [
                'percentage' => bcadd((string) $validated['percentage'], '0', 1),
                'valid_from' => $validated['valid_from'],
                'valid_until' => $validated['valid_until'],
            ];

            // A save that changes nothing leaves no audit record (like FeeScheduleController).
            if ($before === $after) {
                return $setting;
            }

            $setting->forceFill([...$after, 'updated_by' => $actor->id])->save();
            $setting->refresh();

            $auditRecorder->record(
                $actor,
                AuditAction::PAYMENT_DISCOUNT_SETTING_UPDATED,
                AuditableType::PAYMENT_DISCOUNT_SETTING,
                $setting->id,
                $before,
                self::snapshot($setting),
                null,
                $contextFactory->fromRequest($request),
            );

            return $setting;
        });

        return $this->noStore(PaymentDiscountSettingResource::make($setting->load('updater'))->response($request));
    }

    /**
     * @return array{percentage: string, valid_from: ?string, valid_until: ?string}
     */
    private static function snapshot(PaymentDiscountSetting $setting): array
    {
        return [
            'percentage' => bcadd((string) $setting->percentage, '0', 1),
            'valid_from' => $setting->valid_from?->toDateString(),
            'valid_until' => $setting->valid_until?->toDateString(),
        ];
    }

    /** @throws AuthenticationException */
    private function authenticatedUser(Request $request): User
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        return $user;
    }

    private function noStore(JsonResponse $response): JsonResponse
    {
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
```

- [ ] **Step 5: Register the routes and the API-surface entries**

Edit `backend/routes/api.php`: add the import next to the other `Billing` controller import (`use App\Http\Controllers\Api\V1\Billing\FeeScheduleController;`):

```php
use App\Http\Controllers\Api\V1\Billing\PaymentDiscountSettingController;
```

and after the `fee-schedules.update` route add:

```php
        // ADR 0046: the full-payment discount's percentage and validity. The Registrar Head edits it
        // (PaymentDiscountSettingPolicy); Accounting Staff may read it. No `role:` middleware.
        Route::get('/payment-discount-settings', [PaymentDiscountSettingController::class, 'show'])->name('payment-discount-settings.show');
        Route::put('/payment-discount-settings', [PaymentDiscountSettingController::class, 'update'])->name('payment-discount-settings.update');
```

Edit `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`: add `'GET|HEAD api/v1/payment-discount-settings',` and `'PUT api/v1/payment-discount-settings',` to the expected route list in the position the test's existing ordering expects (run the test once; its failure message shows the exact expected order).

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `cd backend && php artisan test --filter="PaymentDiscountSettingEndpointTest|ApiSurfaceTest"`
Expected: PASS. If `ApiSurfaceTest` fails only on ordering, move the two lines to where the diff says.

- [ ] **Step 7: Checkpoint (no commit)**

Run `cd backend && vendor/bin/pint app/Policies/PaymentDiscountSettingPolicy.php app/Http app/Domain/Audit routes/api.php tests/Feature/Api/V1/PaymentDiscountSettingEndpointTest.php tests/Feature/Api/V1/ApiSurfaceTest.php` and `composer analyse`. Run `php artisan test --filter=Audit` to confirm no audit-enum test (for example one that counts `AuditAction::values()`) broke; if one did, update its expected list for the two new actions. Add a `PROGRESS.md` milestone line.

---

### Task 4: Returnee — payment quote, Pay in full, COR snapshot

**Files:**
- Create: `backend/app/Actions/Billing/ApplyFullPaymentDiscount.php`, `backend/app/Http/Controllers/Api/V1/EnrollmentPaymentQuoteController.php`, `backend/app/Http/Resources/Api/V1/PaymentQuoteResource.php`
- Modify: `backend/app/Actions/Enrollment/ConfirmPayment.php`, `backend/app/Http/Requests/Api/V1/Enrollment/ConfirmPaymentRequest.php`, `backend/app/Actions/Enrollment/BuildCorSnapshot.php`, `backend/routes/api.php`, `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`
- Test: `backend/tests/Feature/Api/V1/FullPaymentDiscountEndpointTest.php`

**Interfaces:**
- Consumes: `QuoteFullPayment::forAssessment()` (Task 2), `AuditAction::ASSESSMENT_FULL_PAYMENT_DISCOUNT_APPLIED` (Task 3), `FullPaymentDiscountPolicy` (Task 2).
- Produces:
  - `ApplyFullPaymentDiscount::forCashierPayment(Assessment $assessment, string $quotedAmount, User $actor, AuditRequestContext $context): string` — call inside the payment transaction with the enrollment and assessment locked; writes the line when a discount applies, returns the amount to collect, throws `ValidationException` on `quoted_amount` when it no longer equals what a full payment collects.
  - `ApplyFullPaymentDiscount::forHeldCredit(Assessment $assessment, string $frozenPercentage, string $heldCredit, User $actor, AuditRequestContext $context): bool` — used by Task 5.
  - `GET /api/v1/enrollments/{enrollment}/payment-quote` → `{data: {type: 'payment_quote', total_amount, full_payment: {applies, percentage, discount_amount, net_total, reason}}}`.
  - `POST /api/v1/enrollments/{enrollment}/payment` accepts `payment_type` (`full`|`installment`) and `quoted_amount`.
  - COR snapshot `fees.full_payment_discount` (list of `{label, quantity, unit_amount, amount}`) and `fees.total_full_payment_discount`.

- [ ] **Step 1: Write the failing endpoint test**

Create `backend/tests/Feature/Api/V1/FullPaymentDiscountEndpointTest.php`:

```php
<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Audit\AuditAction;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\ProgramStatus;
use App\Models\AcademicTerm;
use App\Models\Assessment;
use App\Models\AssessmentItem;
use App\Models\AuditLog;
use App\Models\Curriculum;
use App\Models\Enrollment;
use App\Models\EnrollmentDocument;
use App\Models\Payment;
use App\Models\PaymentDiscountSetting;
use App\Models\Program;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * ADR 0046 for a student who already has an assessment: the Cashier's payment quote and
 * "Pay in full". The assessment is 1,050.00 (750.00 tuition plus 300.00 miscellaneous), so a 10%
 * discount is 105.00 and the net is 945.00.
 */
final class FullPaymentDiscountEndpointTest extends TestCase
{
    use RefreshDatabase;

    private Enrollment $enrollment;

    private Assessment $assessment;

    protected function setUp(): void
    {
        parent::setUp();

        $term = AcademicTerm::create(['school_year' => '2026-2027', 'semester' => '1st', 'status' => AcademicTermStatus::SemesterOngoing]);
        $program = Program::create(['code' => 'BSCS', 'name' => 'BS Computer Science', 'status' => ProgramStatus::Active]);
        $curriculum = Curriculum::create([
            'program_id' => $program->id, 'name' => 'BSCS', 'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Active,
        ]);
        $user = User::create([
            'name' => 'Test Student', 'email' => 'student.fullpay@grc.test', 'password' => 'secret-password-1',
            'role' => UserRole::Student, 'status' => UserStatus::Active,
        ]);
        $student = StudentProfile::create([
            'user_id' => $user->id, 'student_number' => '2026-0001', 'program_id' => $program->id,
            'curriculum_id' => $curriculum->id, 'year_level' => 1,
            'admission_status' => AdmissionStatus::Admitted, 'academic_standing' => AcademicStanding::Good,
        ]);
        $this->enrollment = Enrollment::create([
            'student_id' => $student->id, 'academic_term_id' => $term->id,
            'status' => EnrollmentStatus::PendingPayment, 'total_units' => 3, 'submitted_at' => now(),
        ]);
        $this->assessment = Assessment::create([
            'enrollment_id' => $this->enrollment->id, 'total_amount' => '1050.00', 'currency' => 'PHP', 'assessed_at' => now(),
        ]);
        AssessmentItem::create([
            'assessment_id' => $this->assessment->id, 'category' => 'tuition', 'label' => 'Tuition',
            'quantity' => '3.0', 'unit_amount' => '250.00', 'amount' => '750.00',
        ]);
        AssessmentItem::create([
            'assessment_id' => $this->assessment->id, 'category' => 'miscellaneous', 'label' => 'Registration', 'amount' => '300.00',
        ]);
    }

    private function actAs(UserRole $role): User
    {
        $user = User::create([
            'name' => 'Test '.$role->value, 'email' => 'actor.'.$role->value.'.fullpay@grc.test', 'password' => 'secret-password-1',
            'role' => $role, 'status' => UserStatus::Active,
        ]);
        $this->app['auth']->forgetGuards();
        Sanctum::actingAs($user);

        return $user;
    }

    private function quoteUrl(): string
    {
        return "/api/v1/enrollments/{$this->enrollment->id}/payment-quote";
    }

    private function payUrl(): string
    {
        return "/api/v1/enrollments/{$this->enrollment->id}/payment";
    }

    /** @return list<array<string, mixed>> */
    private function discountLines(): array
    {
        return array_values(array_filter(
            $this->assessment->refresh()->items->map->toArray()->all(),
            fn (array $item): bool => $item['category'] === 'full_payment_discount',
        ));
    }

    private function addScholarship(): void
    {
        AssessmentItem::create([
            'assessment_id' => $this->assessment->id, 'category' => 'scholarship_discount', 'label' => 'Scholarship discount (40%)',
            'quantity' => '40.0', 'amount' => '-420.00',
        ]);
        $this->assessment->update(['total_amount' => '630.00']);
    }

    // --- The quote ---------------------------------------------------------

    public function test_the_quote_offers_the_discount_on_the_whole_assessment(): void
    {
        $this->actAs(UserRole::AccountingStaff);

        $this->getJson($this->quoteUrl())
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.type', 'payment_quote')
            ->assertJsonPath('data.total_amount', '1050.00')
            ->assertJsonPath('data.full_payment.applies', true)
            ->assertJsonPath('data.full_payment.percentage', '10.0')
            ->assertJsonPath('data.full_payment.discount_amount', '105.00')
            ->assertJsonPath('data.full_payment.net_total', '945.00')
            ->assertJsonPath('data.full_payment.reason', null);
    }

    public function test_the_quote_says_why_a_scholar_gets_no_discount(): void
    {
        $this->addScholarship();
        $this->actAs(UserRole::AccountingStaff);

        $this->getJson($this->quoteUrl())
            ->assertOk()
            ->assertJsonPath('data.total_amount', '630.00')
            ->assertJsonPath('data.full_payment.applies', false)
            ->assertJsonPath('data.full_payment.reason', 'scholar')
            ->assertJsonPath('data.full_payment.net_total', '630.00')
            ->assertJsonPath('data.full_payment.discount_amount', null);
    }

    public function test_the_quote_says_when_the_window_has_closed(): void
    {
        PaymentDiscountSetting::current()->update(['valid_until' => '2000-01-01']);
        $this->actAs(UserRole::AccountingStaff);

        $this->getJson($this->quoteUrl())
            ->assertOk()
            ->assertJsonPath('data.full_payment.applies', false)
            ->assertJsonPath('data.full_payment.reason', 'expired')
            ->assertJsonPath('data.full_payment.net_total', '1050.00');
    }

    public function test_only_accounting_staff_may_ask_for_a_quote(): void
    {
        $this->getJson($this->quoteUrl())->assertUnauthorized();

        foreach ([UserRole::Student, UserRole::RegistrarHead, UserRole::RegistrarStaff, UserRole::Dean] as $role) {
            $this->actAs($role);
            $this->getJson($this->quoteUrl())->assertForbidden();
        }
    }

    public function test_a_quote_is_refused_once_the_enrollment_is_no_longer_pending_payment(): void
    {
        $this->enrollment->update(['status' => EnrollmentStatus::Enrolled]);
        $this->actAs(UserRole::AccountingStaff);

        $this->getJson($this->quoteUrl())->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    // --- Pay in full -------------------------------------------------------

    public function test_paying_in_full_takes_the_discount_and_collects_the_net(): void
    {
        $actor = $this->actAs(UserRole::AccountingStaff);

        $this->postJson($this->payUrl(), ['payment_type' => 'full', 'quoted_amount' => '945.00'])->assertCreated();

        $payment = Payment::query()->where('enrollment_id', $this->enrollment->id)->sole();
        self::assertSame('945.00', $payment->amount);
        self::assertFalse($payment->promissory_note_on_file);
        self::assertSame('945.00', $this->assessment->refresh()->total_amount);
        self::assertSame(EnrollmentStatus::Enrolled, $this->enrollment->refresh()->status);

        $lines = $this->discountLines();
        self::assertCount(1, $lines);
        self::assertSame('Full-payment discount (10%)', $lines[0]['label']);
        self::assertSame('-105.00', $lines[0]['amount']);
        self::assertSame('10.0', $lines[0]['quantity']);
        // Tuition and miscellaneous are untouched.
        $this->assertDatabaseHas('assessment_items', ['assessment_id' => $this->assessment->id, 'category' => 'tuition', 'amount' => '750.00']);
        $this->assertDatabaseHas('assessment_items', ['assessment_id' => $this->assessment->id, 'category' => 'miscellaneous', 'amount' => '300.00']);

        $audit = AuditLog::query()->where('action', AuditAction::ASSESSMENT_FULL_PAYMENT_DISCOUNT_APPLIED)->sole();
        self::assertSame($actor->id, $audit->actor_user_id);
        self::assertSame($this->assessment->id, $audit->auditable_id);
        self::assertSame('1050.00', $audit->before_values['total_amount']);
        self::assertSame('945.00', $audit->after_values['total_amount']);
        self::assertSame('10.0', $audit->after_values['percentage']);
        self::assertSame('105.00', $audit->after_values['discount_amount']);
        self::assertSame('cashier_payment', $audit->after_values['source']);
    }

    public function test_the_cor_snapshot_lists_the_discount_and_the_net_grand_total(): void
    {
        $this->actAs(UserRole::AccountingStaff);

        $this->postJson($this->payUrl(), ['payment_type' => 'full', 'quoted_amount' => '945.00'])->assertCreated();

        $fees = EnrollmentDocument::query()->where('enrollment_id', $this->enrollment->id)->sole()->snapshot['fees'];
        self::assertSame('-105.00', $fees['full_payment_discount'][0]['amount']);
        self::assertSame('Full-payment discount (10%)', $fees['full_payment_discount'][0]['label']);
        self::assertSame('-105.00', $fees['total_full_payment_discount']);
        self::assertSame('945.00', $fees['grand_total']);
        self::assertSame('full_payment', $fees['payment_status']);
        self::assertSame('0.00', $fees['remaining_balance']);
        // tuition + other fees + the discount add up to the grand total.
        self::assertSame($fees['grand_total'], bcadd(bcadd($fees['total_tuition'], $fees['total_other_fees'], 2), $fees['total_full_payment_discount'], 2));
    }

    public function test_paying_in_full_outside_the_window_collects_the_plain_total(): void
    {
        PaymentDiscountSetting::current()->update(['valid_until' => '2000-01-01']);
        $this->actAs(UserRole::AccountingStaff);

        $this->postJson($this->payUrl(), ['payment_type' => 'full', 'quoted_amount' => '1050.00'])->assertCreated();

        self::assertSame('1050.00', Payment::query()->where('enrollment_id', $this->enrollment->id)->sole()->amount);
        self::assertSame([], $this->discountLines());
        self::assertSame('1050.00', $this->assessment->refresh()->total_amount);
        self::assertSame(0, AuditLog::query()->where('action', AuditAction::ASSESSMENT_FULL_PAYMENT_DISCOUNT_APPLIED)->count());
    }

    public function test_a_scholar_paying_in_full_gets_no_second_discount(): void
    {
        $this->addScholarship();
        $this->actAs(UserRole::AccountingStaff);

        $this->postJson($this->payUrl(), ['payment_type' => 'full', 'quoted_amount' => '630.00'])->assertCreated();

        self::assertSame('630.00', Payment::query()->where('enrollment_id', $this->enrollment->id)->sole()->amount);
        self::assertSame([], $this->discountLines());
        self::assertSame('630.00', $this->assessment->refresh()->total_amount);
    }

    public function test_a_quote_the_cashier_saw_that_is_no_longer_true_is_refused_and_writes_nothing(): void
    {
        $this->actAs(UserRole::AccountingStaff);
        // The Registrar Head raised the discount after the Cashier opened the modal at 945.00.
        PaymentDiscountSetting::current()->update(['percentage' => '20.0']);

        $this->postJson($this->payUrl(), ['payment_type' => 'full', 'quoted_amount' => '945.00'])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');

        self::assertSame(0, Payment::query()->count());
        self::assertSame([], $this->discountLines());
        self::assertSame('1050.00', $this->assessment->refresh()->total_amount);
        self::assertSame(EnrollmentStatus::PendingPayment, $this->enrollment->refresh()->status);
    }

    public function test_confirming_again_changes_nothing(): void
    {
        $this->actAs(UserRole::AccountingStaff);
        $this->postJson($this->payUrl(), ['payment_type' => 'full', 'quoted_amount' => '945.00'])->assertCreated();

        // A repeat is idempotent even though the discount has moved on since (the quote no longer matches).
        PaymentDiscountSetting::current()->update(['percentage' => '20.0']);
        $this->postJson($this->payUrl(), ['payment_type' => 'full', 'quoted_amount' => '945.00'])->assertOk();

        self::assertSame(1, Payment::query()->count());
        self::assertCount(1, $this->discountLines());
        self::assertSame('945.00', $this->assessment->refresh()->total_amount);
        self::assertSame(1, AuditLog::query()->where('action', AuditAction::ASSESSMENT_FULL_PAYMENT_DISCOUNT_APPLIED)->count());
    }

    public function test_a_full_payment_needs_the_quoted_amount_and_may_not_carry_an_amount(): void
    {
        $this->actAs(UserRole::AccountingStaff);

        $this->postJson($this->payUrl(), ['payment_type' => 'full'])->assertUnprocessable();
        // An amount that is otherwise valid (at least 1,000) is still refused: a full payment collects the quoted net.
        $this->postJson($this->payUrl(), ['payment_type' => 'full', 'quoted_amount' => '945.00', 'amount' => '1050.00'])->assertUnprocessable();
        self::assertSame(0, Payment::query()->count());
    }

    // --- Installment and legacy requests -----------------------------------

    public function test_an_installment_has_no_discount_and_no_extra_fee(): void
    {
        $this->actAs(UserRole::AccountingStaff);

        $this->postJson($this->payUrl(), ['payment_type' => 'installment', 'amount' => '1000.00', 'promissory_note_on_file' => true])->assertCreated();

        self::assertSame('1000.00', Payment::query()->where('enrollment_id', $this->enrollment->id)->sole()->amount);
        self::assertSame('1050.00', $this->assessment->refresh()->total_amount);
        self::assertSame([], $this->discountLines());
        // Still exactly the two original lines: no fee or surcharge line was added.
        self::assertSame(2, $this->assessment->items()->count());
    }

    public function test_an_installment_still_needs_a_promissory_note_below_the_total(): void
    {
        $this->actAs(UserRole::AccountingStaff);

        $this->postJson($this->payUrl(), ['payment_type' => 'installment', 'amount' => '1000.00'])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');
        $this->postJson($this->payUrl(), ['payment_type' => 'installment'])->assertUnprocessable();
        self::assertSame(0, Payment::query()->count());
    }

    public function test_a_request_without_a_payment_type_behaves_as_before(): void
    {
        $this->actAs(UserRole::AccountingStaff);

        $this->postJson($this->payUrl(), [])->assertCreated();

        self::assertSame('1050.00', Payment::query()->where('enrollment_id', $this->enrollment->id)->sole()->amount);
        self::assertSame([], $this->discountLines());
    }
}
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd backend && php artisan test --filter=FullPaymentDiscountEndpointTest`
Expected: FAIL (404 on `payment-quote`; payments with `payment_type` ignore it).

- [ ] **Step 3: Implement `ApplyFullPaymentDiscount`**

Create `backend/app/Actions/Billing/ApplyFullPaymentDiscount.php`:

```php
<?php

namespace App\Actions\Billing;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Billing\AssessmentItemCategory;
use App\Domain\Billing\FullPaymentDiscountPolicy;
use App\Domain\Billing\ScholarshipBase;
use App\Models\Assessment;
use App\Models\AssessmentItem;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Validation\ValidationException;

/**
 * Writes the full-payment discount (ADR 0046) as one negative assessment line and lowers the
 * assessment's total to the net. Both entry points must run inside the caller's database
 * transaction with the assessment row already locked; they lock the items themselves.
 *
 * The discount is only ever written when money is collected (never on an assessment that is
 * still being corrected), so it needs no recomputation and is never edited by hand.
 */
final readonly class ApplyFullPaymentDiscount
{
    public function __construct(
        private QuoteFullPayment $quoteFullPayment,
        private AuditRecorder $auditRecorder,
    ) {}

    /**
     * The Cashier's Pay in full for an enrollment that already has an assessment. Returns the
     * amount this payment collects: the discounted net when a discount applies, otherwise the
     * plain total.
     *
     * @return numeric-string
     *
     * @throws ValidationException when `$quotedAmount` is no longer what a full payment collects
     */
    public function forCashierPayment(Assessment $assessment, string $quotedAmount, User $actor, AuditRequestContext $context): string
    {
        $assessment->setRelation('items', $assessment->items()->lockForUpdate()->get());
        $quote = $this->quoteFullPayment->forAssessment($assessment);

        if ($quote->netTotal === null || bccomp(bcadd($quotedAmount, '0', 2), $quote->netTotal, 2) !== 0) {
            throw ValidationException::withMessages([
                'quoted_amount' => 'The amount due changed. Review the new amount and confirm again.',
            ]);
        }

        if ($quote->applies() && $quote->baseTotal !== null && $quote->percentage !== null && $quote->discountAmount !== null) {
            $this->writeLine($assessment, $quote->percentage, $quote->discountAmount, $quote->netTotal, 'cashier_payment', $actor, $context);
        }

        return $quote->netTotal;
    }

    /**
     * A pay-first student's Registrar approval (ADR 0046): the percentage frozen when the Cashier
     * took their full payment is applied to the real assessment, but only if the credit they
     * hold covers the discounted net. Otherwise nothing is written and the payment simply
     * stays an installment. The saved window is deliberately not rechecked: the student was
     * promised this percentage when they paid.
     *
     * @param  numeric-string  $frozenPercentage
     * @param  numeric-string  $heldCredit
     */
    public function forHeldCredit(Assessment $assessment, string $frozenPercentage, string $heldCredit, User $actor, AuditRequestContext $context): bool
    {
        $items = $assessment->items()->lockForUpdate()->get();
        $assessment->setRelation('items', $items);

        if ($items->contains(fn (AssessmentItem $item): bool => $item->category->isDiscount())) {
            return false;
        }

        $base = ScholarshipBase::amount($items);
        $policy = new FullPaymentDiscountPolicy($frozenPercentage);
        $discount = $policy->discountFor($base);
        $net = bcsub($base, $discount, 2);

        if (bccomp($heldCredit, $net, 2) === -1) {
            return false;
        }

        $this->writeLine($assessment, $frozenPercentage, $discount, $net, 'held_credit_settlement', $actor, $context);

        return true;
    }

    /**
     * @param  numeric-string  $percentage
     * @param  numeric-string  $discount
     * @param  numeric-string  $net
     */
    private function writeLine(Assessment $assessment, string $percentage, string $discount, string $net, string $source, User $actor, AuditRequestContext $context): void
    {
        // A discount of nothing (a zero-fee assessment) leaves no line and no audit row.
        if (bccomp($discount, '0', 2) !== 1) {
            return;
        }

        $before = (string) $assessment->total_amount;

        $assessment->items()->create([
            'category' => AssessmentItemCategory::FullPaymentDiscount,
            'label' => 'Full-payment discount ('.FullPaymentDiscountPolicy::formatPercentage($percentage).'%)',
            'quantity' => bcadd($percentage, '0', 1),
            'unit_amount' => null,
            'amount' => bcmul($discount, '-1', 2),
        ]);
        $assessment->update(['total_amount' => $net]);

        $this->auditRecorder->record(
            $actor,
            AuditAction::ASSESSMENT_FULL_PAYMENT_DISCOUNT_APPLIED,
            AuditableType::ASSESSMENT,
            $assessment->id,
            ['total_amount' => $before],
            ['total_amount' => $net, 'percentage' => bcadd($percentage, '0', 1), 'discount_amount' => $discount, 'source' => $source],
            null,
            $context,
        );
    }
}
```

- [ ] **Step 4: Change `ConfirmPayment`**

Edit `backend/app/Actions/Enrollment/ConfirmPayment.php`.

Add the import `use App\Actions\Billing\ApplyFullPaymentDiscount;` (keep imports alphabetical, above the `App\Domain\Audit` ones).

Replace the constructor

```php
    public function __construct(
        private AuditRecorder $auditRecorder,
        private BuildCorSnapshot $buildCorSnapshot,
    ) {}
```

with

```php
    public function __construct(
        private AuditRecorder $auditRecorder,
        private BuildCorSnapshot $buildCorSnapshot,
        private ApplyFullPaymentDiscount $applyFullPaymentDiscount,
    ) {}
```

Replace

```php
            $assessment = Assessment::query()->where('enrollment_id', $lockedEnrollment->id)->first();
            $amount = $validated['amount'] ?? $assessment?->total_amount;
            $promissoryNoteOnFile = (bool) ($validated['promissory_note_on_file'] ?? false);
```

with

```php
            $assessment = Assessment::query()->where('enrollment_id', $lockedEnrollment->id)->lockForUpdate()->first();
            $amount = $validated['amount'] ?? $assessment?->total_amount;

            // ADR 0046: Pay in full. Any discount is written here, in the same transaction, so the
            // payment, the assessment and the COR snapshot below all agree on the net. A stale
            // `quoted_amount` throws before anything is written. An installment, and a request with
            // no `payment_type`, are not touched: no discount and no extra fee.
            if (($validated['payment_type'] ?? null) === 'full' && ! $freshmanFirstPayment && $assessment instanceof Assessment) {
                $amount = $this->applyFullPaymentDiscount->forCashierPayment(
                    $assessment,
                    (string) $validated['quoted_amount'],
                    $actor,
                    $context,
                );
            }

            $promissoryNoteOnFile = (bool) ($validated['promissory_note_on_file'] ?? false);
```

Also extend the class docblock with one paragraph:

```
 * ADR 0046: `payment_type` `full` (with the `quoted_amount` the Cashier was shown) takes the
 * full-payment discount, when one applies, before the payment row and the COR are written.
```

Check for any place that builds `ConfirmPayment` by hand: `grep -rn "new ConfirmPayment(" backend` must find nothing (the container resolves the new dependency).

- [ ] **Step 5: Change `ConfirmPaymentRequest`**

Edit `backend/app/Http/Requests/Api/V1/Enrollment/ConfirmPaymentRequest.php`.

Add `use Illuminate\Validation\Rule;`.

Replace `rules()` with:

```php
    public function rules(): array
    {
        return [
            'external_reference' => ['sometimes', 'nullable', 'string'],
            'amount' => ['sometimes', 'nullable', 'numeric', 'min:1000', 'max:99999999.99'],
            'promissory_note_on_file' => ['sometimes', 'boolean'],
            // ADR 0046. Absent keeps today's behavior exactly (no discount).
            'payment_type' => ['sometimes', 'string', Rule::in(['full', 'installment'])],
            'quoted_amount' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:99999999.99'],
        ];
    }
```

In `withValidator`, directly after the `$amount`/`$promissoryNoteOnFile`/`$totalDue` lines and before the existing partial-payment `if`, add:

```php
            $paymentType = $this->input('payment_type');

            if ($paymentType === 'full') {
                if ($amount !== null) {
                    $validator->errors()->add('amount', 'Do not send an amount with a full payment; it collects the quoted net.');
                }

                if ($this->input('quoted_amount') === null) {
                    $validator->errors()->add('quoted_amount', 'Send the net amount the Cashier was shown.');
                }
            }

            if ($paymentType === 'installment' && $amount === null) {
                $validator->errors()->add('amount', 'Enter the amount received for an installment.');
            }
```

and extend the class docblock: "A `payment_type` of `full` carries the `quoted_amount` and no `amount`; `installment` carries an `amount` (ADR 0046)."

- [ ] **Step 6: Change `BuildCorSnapshot`**

Edit `backend/app/Actions/Enrollment/BuildCorSnapshot.php`. After the `$scholarshipDiscount = array_values(...)` statement add:

```php
        // ADR 0046: the full-payment discount is a second negative line, written at payment
        // confirmation. Empty when there is none.
        $fullPaymentDiscount = array_values($items
            ->filter(fn ($item): bool => $item->category === AssessmentItemCategory::FullPaymentDiscount)
            ->map(fn ($item): array => $this->feeItem($item))
            ->all());
```

and in the `'fees'` array, after `'total_scholarship_discount' => ...,` add

```php
                'full_payment_discount' => $fullPaymentDiscount,
                'total_full_payment_discount' => $this->sum($fullPaymentDiscount),
```

Update the comment above `$scholarshipDiscount` to say "tuition + other fees + the two discount sums always add up to the grand total".

- [ ] **Step 7: Implement the quote endpoint**

Create `backend/app/Http/Resources/Api/V1/PaymentQuoteResource.php`:

```php
<?php

namespace App\Http\Resources\Api\V1;

use App\Domain\Billing\FullPaymentQuote;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * What the Cashier's payment modal needs to offer Pay in full (ADR 0046). `net_total` is always
 * what a full payment collects, whether or not a discount applies.
 *
 * @property-read FullPaymentQuote $resource
 */
final class PaymentQuoteResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $quote = $this->resource;

        return [
            'type' => 'payment_quote',
            'total_amount' => $quote->baseTotal,
            'full_payment' => [
                'applies' => $quote->applies(),
                'percentage' => $quote->percentage,
                'discount_amount' => $quote->discountAmount,
                'net_total' => $quote->netTotal,
                'reason' => $quote->reason,
            ],
        ];
    }
}
```

Create `backend/app/Http/Controllers/Api/V1/EnrollmentPaymentQuoteController.php`:

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Billing\QuoteFullPayment;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\PaymentQuoteResource;
use App\Models\Assessment;
use App\Models\Enrollment;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * The Cashier's read-only quote for an enrollment's payment (ADR 0046): the amount due and what
 * paying in full would collect. Authorized like confirming the payment (Accounting Staff).
 */
final class EnrollmentPaymentQuoteController extends Controller
{
    /** @throws AuthenticationException */
    public function __invoke(Request $request, Enrollment $enrollment, QuoteFullPayment $quoteFullPayment): JsonResponse
    {
        if (! $request->user() instanceof User) {
            throw new AuthenticationException;
        }

        $this->authorize('confirmPayment', Enrollment::class);

        $assessment = Assessment::query()->where('enrollment_id', $enrollment->id)->with('items')->first();

        if ($enrollment->status !== EnrollmentStatus::PendingPayment || ! $assessment instanceof Assessment) {
            throw ValidationException::withMessages([
                'enrollment' => 'A payment quote is only available for an enrollment that is pending payment and has an assessment.',
            ]);
        }

        $response = PaymentQuoteResource::make($quoteFullPayment->forAssessment($assessment))->response($request);
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
```

Edit `backend/routes/api.php`: add `use App\Http\Controllers\Api\V1\EnrollmentPaymentQuoteController;` with the other controller imports, and after the `enrollments.payment` route add:

```php
        // ADR 0046: what the Cashier's modal quotes before confirming (amount due and what paying in full collects).
        Route::get('/enrollments/{enrollment}/payment-quote', EnrollmentPaymentQuoteController::class)->name('enrollments.payment-quote.show');
```

Edit `ApiSurfaceTest.php`: add `'GET|HEAD api/v1/enrollments/{enrollment}/payment-quote',` in the position its ordering expects.

- [ ] **Step 8: Run the tests and confirm they pass**

Run: `cd backend && php artisan test --filter="FullPaymentDiscountEndpointTest|ApiSurfaceTest"`
Expected: PASS.

Then the neighbours that share the changed code: `cd backend && php artisan test --filter="PaymentConfirmationEndpointTest|ScholarshipDiscountEndpointTest|CorSnapshot|EnrollmentDocument|PaymentsEndpointTest"`. If a COR-snapshot test compares the whole `fees` array and now misses the two new keys, add `'full_payment_discount' => []` and `'total_full_payment_discount' => '0.00'` to that expectation (the keys are always present, like the scholarship ones).

- [ ] **Step 9: Checkpoint (no commit)**

Run `cd backend && vendor/bin/pint app/Actions app/Http routes/api.php tests/Feature/Api/V1/FullPaymentDiscountEndpointTest.php` and `composer analyse`. Add a `PROGRESS.md` milestone line.

---

### Task 5: Freshman and transferee — preview quote, full payment, settlement

**Files:**
- Modify: `backend/app/Domain/Enrollment/FreshmanPaymentPreview.php`, `backend/app/Actions/Enrollment/PreviewFreshmanPayment.php`, `backend/app/Http/Resources/Api/V1/FreshmanPaymentPreviewResource.php`, `backend/app/Http/Requests/Api/V1/StudentProfile/ConfirmFreshmanPaymentRequest.php`, `backend/app/Actions/Enrollment/FreshmanPaymentRules.php`, `backend/app/Actions/Enrollment/ConfirmFreshmanPayment.php`, `backend/app/Actions/Enrollment/SettleEnrollmentFromAdvanceCredit.php`
- Test: `backend/tests/Feature/Api/V1/FullPaymentPayFirstTest.php`

**Interfaces:**
- Consumes: `QuoteFullPayment::forEstimate()` (Task 2), `ApplyFullPaymentDiscount::forHeldCredit()` (Task 4), `student_profiles.full_payment_discount_percentage` (Task 1).
- Produces: preview JSON gains `data.full_payment` = `{applies, percentage, discount_amount, net_total, reason}` (all five keys always present; for `no_estimate` the amounts are null); `POST …/freshman-payment` accepts `payment_type` (`full`|`installment`); the profile's `full_payment_discount_percentage` is set by a discounted full payment and cleared by the settlement that uses it.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/Feature/Api/V1/FullPaymentPayFirstTest.php`:

```php
<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Billing\FullPaymentDiscountPolicy;
use App\Domain\Identity\StudentType;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Models\AccountPayment;
use App\Models\Assessment;
use App\Models\Enrollment;
use App\Models\EnrollmentDocument;
use App\Models\FeeSchedule;
use App\Models\Payment;
use App\Models\PaymentDiscountSetting;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Support\BuildsBlockSections;
use Tests\Support\BuildsFreshmen;
use Tests\TestCase;

/**
 * ADR 0046 for a pay-first student: the Cashier quotes the discounted estimate, the percentage
 * is frozen on the profile, and the Registrar's approval applies it to the real assessment only
 * if the held credit covers it.
 */
final class FullPaymentPayFirstTest extends TestCase
{
    use BuildsBlockSections;
    use BuildsFreshmen;
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    protected function setUp(): void
    {
        parent::setUp();

        Mail::fake();
        config(['app.frontend_url' => 'https://www.grc-enrollment.tech']);
    }

    /** @return array{0: StudentProfile} */
    private function scenario(): array
    {
        $profile = $this->freshmanProfile();
        $term = $this->ongoingTerm();
        $plan = $this->yearOnePlan($term, $profile->curriculum);
        $this->blockSection($term, $plan, 'IT101', 'ITP1');
        $this->issueFreshmanTicket($profile);

        return [$profile];
    }

    private function tokenFor(UserRole $role, string $email): string
    {
        User::query()->where('email', $email)->first() ?? User::create([
            'name' => 'Test '.$role->value, 'email' => $email, 'password' => self::PASSWORD,
            'role' => $role, 'status' => UserStatus::Active, 'last_otp_verified_at' => now(),
        ]);
        $this->app['auth']->forgetGuards();

        return (string) $this->postJson('/api/v1/auth/login', ['email' => $email, 'password' => self::PASSWORD])->json('data.token');
    }

    private function cashier(): string
    {
        return $this->tokenFor(UserRole::AccountingStaff, 'cashier@grc.test');
    }

    /** @return array{estimate: string, discount: string, net: string} */
    private function quoteFor(StudentProfile $profile): array
    {
        $estimate = (string) $this->withToken($this->cashier())
            ->getJson("/api/v1/student-profiles/{$profile->id}/freshman-payment-preview")
            ->assertOk()
            ->json('data.estimated_total');
        $discount = (new FullPaymentDiscountPolicy('10.0'))->discountFor($estimate);

        return ['estimate' => $estimate, 'discount' => $discount, 'net' => bcsub($estimate, $discount, 2)];
    }

    private function approve(Enrollment $enrollment): void
    {
        $registrar = $this->tokenFor(UserRole::RegistrarStaff, 'registrar.staff@grc.test');
        $this->withToken($registrar)
            ->patchJson("/api/v1/enrollments/{$enrollment->id}", ['action' => 'registrar_approve'])
            ->assertOk()
            ->assertJsonPath('data.status', 'enrolled');
    }

    public function test_the_preview_offers_the_discounted_estimate(): void
    {
        [$profile] = $this->scenario();
        $quote = $this->quoteFor($profile);

        $this->withToken($this->cashier())
            ->getJson("/api/v1/student-profiles/{$profile->id}/freshman-payment-preview")
            ->assertOk()
            ->assertJsonPath('data.full_payment.applies', true)
            ->assertJsonPath('data.full_payment.percentage', '10.0')
            ->assertJsonPath('data.full_payment.discount_amount', $quote['discount'])
            ->assertJsonPath('data.full_payment.net_total', $quote['net'])
            ->assertJsonPath('data.full_payment.reason', null);
    }

    public function test_a_full_payment_freezes_the_percentage_and_the_registrar_approval_applies_it(): void
    {
        [$profile] = $this->scenario();
        $quote = $this->quoteFor($profile);

        $this->withToken($this->cashier())
            ->postJson("/api/v1/student-profiles/{$profile->id}/freshman-payment", ['payment_type' => 'full', 'amount' => $quote['net']])
            ->assertCreated()
            ->assertJsonPath('data.held_amount', $quote['net']);

        self::assertSame('10.0', $profile->refresh()->full_payment_discount_percentage);
        self::assertSame($quote['net'], AccountPayment::query()->sole()->amount);

        // The Head lowers the discount afterwards; the student keeps what they were quoted.
        PaymentDiscountSetting::current()->update(['percentage' => '0.0']);

        $enrollment = Enrollment::query()->sole();
        $this->approve($enrollment);

        $assessment = Assessment::query()->where('enrollment_id', $enrollment->id)->sole();
        self::assertSame($quote['net'], $assessment->total_amount);
        $line = $assessment->items()->where('category', 'full_payment_discount')->sole();
        self::assertSame(bcmul($quote['discount'], '-1', 2), $line->amount);
        self::assertSame('Full-payment discount (10%)', $line->label);
        self::assertSame(1, Payment::query()->where('enrollment_id', $enrollment->id)->count());
        self::assertSame('0.00', Payment::query()->where('enrollment_id', $enrollment->id)->sole()->amount);

        $fees = EnrollmentDocument::query()->where('enrollment_id', $enrollment->id)->sole()->snapshot['fees'];
        self::assertSame(bcmul($quote['discount'], '-1', 2), $fees['total_full_payment_discount']);
        self::assertSame($quote['net'], $fees['grand_total']);
        self::assertSame('0.00', $fees['remaining_balance']);

        // The frozen percentage is used once and cleared, so it can never apply to a later term.
        self::assertNull($profile->refresh()->full_payment_discount_percentage);
    }

    public function test_a_stale_amount_is_refused_and_records_nothing(): void
    {
        [$profile] = $this->scenario();
        $quote = $this->quoteFor($profile);
        PaymentDiscountSetting::current()->update(['percentage' => '20.0']);

        $this->withToken($this->cashier())
            ->postJson("/api/v1/student-profiles/{$profile->id}/freshman-payment", ['payment_type' => 'full', 'amount' => $quote['net']])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');

        self::assertSame(0, AccountPayment::query()->count());
        self::assertNull($profile->refresh()->freshman_payment_confirmed_at);
        self::assertNull($profile->full_payment_discount_percentage);
    }

    public function test_an_installment_freezes_nothing_and_gets_no_discount(): void
    {
        [$profile] = $this->scenario();

        $this->withToken($this->cashier())
            ->postJson("/api/v1/student-profiles/{$profile->id}/freshman-payment", ['payment_type' => 'installment', 'amount' => '1000.00'])
            ->assertCreated();

        self::assertNull($profile->refresh()->full_payment_discount_percentage);

        $enrollment = Enrollment::query()->sole();
        $this->approve($enrollment);

        $assessment = Assessment::query()->where('enrollment_id', $enrollment->id)->sole();
        self::assertSame(0, $assessment->items()->where('category', 'full_payment_discount')->count());
    }

    public function test_when_the_real_assessment_costs_more_than_the_estimate_no_discount_is_given_and_the_enrollment_still_completes(): void
    {
        [$profile] = $this->scenario();
        $quote = $this->quoteFor($profile);

        $this->withToken($this->cashier())
            ->postJson("/api/v1/student-profiles/{$profile->id}/freshman-payment", ['payment_type' => 'full', 'amount' => $quote['net']])
            ->assertCreated();

        // Tuition goes up before the Registrar approves, so the credit no longer covers the discounted net.
        FeeSchedule::create(['category' => 'tuition', 'label' => 'Tuition Rate Per Unit', 'amount' => '500.00', 'is_active' => true, 'sort_order' => 1]);

        $enrollment = Enrollment::query()->sole();
        $this->approve($enrollment);

        $assessment = Assessment::query()->where('enrollment_id', $enrollment->id)->sole();
        self::assertSame(0, $assessment->items()->where('category', 'full_payment_discount')->count());
        self::assertSame(1, Payment::query()->where('enrollment_id', $enrollment->id)->count());
        self::assertNull($profile->refresh()->full_payment_discount_percentage);
        // The assessment is the full, undiscounted amount at the new rate, so it is higher than
        // what was paid; the student owes the difference exactly as an installment would.
        self::assertSame(1, bccomp($assessment->total_amount, $quote['net'], 2));
    }

    public function test_a_student_with_nothing_to_estimate_cannot_pay_in_full(): void
    {
        $profile = $this->freshmanProfile('2026-10-00002', StudentType::Freshman, 'irregular');
        $this->ongoingTerm();
        $this->issueFreshmanTicket($profile);

        $this->withToken($this->cashier())
            ->getJson("/api/v1/student-profiles/{$profile->id}/freshman-payment-preview")
            ->assertOk()
            ->assertJsonPath('data.full_payment.applies', false)
            ->assertJsonPath('data.full_payment.reason', 'no_estimate')
            ->assertJsonPath('data.full_payment.net_total', null);

        $this->withToken($this->cashier())
            ->postJson("/api/v1/student-profiles/{$profile->id}/freshman-payment", ['payment_type' => 'full', 'amount' => '5000.00'])
            ->assertUnprocessable();
        self::assertSame(0, AccountPayment::query()->count());
    }

    public function test_confirming_a_full_payment_again_changes_nothing(): void
    {
        [$profile] = $this->scenario();
        $quote = $this->quoteFor($profile);
        $token = $this->cashier();
        $body = ['payment_type' => 'full', 'amount' => $quote['net']];

        $this->withToken($token)->postJson("/api/v1/student-profiles/{$profile->id}/freshman-payment", $body)->assertCreated();
        $this->withToken($token)->postJson("/api/v1/student-profiles/{$profile->id}/freshman-payment", $body)->assertOk();

        self::assertSame(1, AccountPayment::query()->count());
        self::assertSame('10.0', $profile->refresh()->full_payment_discount_percentage);
    }
}
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd backend && php artisan test --filter=FullPaymentPayFirstTest`
Expected: FAIL (`full_payment` missing from the preview, `payment_type` ignored).

- [ ] **Step 3: Extend the preview**

Edit `backend/app/Domain/Enrollment/FreshmanPaymentPreview.php`: add `use App\Domain\Billing\FullPaymentQuote;` and a last constructor parameter

```php
        public ?Enrollment $enrollment = null,
        public ?FullPaymentQuote $fullPayment = null,
```

(keep the existing parameters as they are; only append `fullPayment`).

Edit `backend/app/Actions/Enrollment/PreviewFreshmanPayment.php`: add `use App\Actions\Billing\QuoteFullPayment;`, add `private QuoteFullPayment $quoteFullPayment,` to the constructor after `$assessEnrollment`, and replace the `return new FreshmanPaymentPreview(` call with

```php
        return new FreshmanPaymentPreview(
            $profile,
            $profile->queueTicket?->ticket_number,
            FreshmanPaymentRules::minimumAmount(),
            $profile->freshman_payment_confirmed_at !== null,
            $block,
            $estimatedTotal,
            $enrollment,
            $this->quoteFullPayment->forEstimate($estimatedTotal),
        );
```

Edit `backend/app/Http/Resources/Api/V1/FreshmanPaymentPreviewResource.php`: after `'estimated_total' => $preview->estimatedTotal,` add

```php
            // ADR 0046: what paying in full collects. All keys are always present; with no
            // estimate yet (`no_estimate`) the amounts are null and a full payment is refused.
            'full_payment' => [
                'applies' => $preview->fullPayment?->applies() ?? false,
                'percentage' => $preview->fullPayment?->percentage,
                'discount_amount' => $preview->fullPayment?->discountAmount,
                'net_total' => $preview->fullPayment?->netTotal,
                'reason' => $preview->fullPayment?->reason,
            ],
```

- [ ] **Step 4: Extend the request and the rules**

Edit `backend/app/Http/Requests/Api/V1/StudentProfile/ConfirmFreshmanPaymentRequest.php`: add `use Illuminate\Validation\Rule;` and add to `rules()`:

```php
            // ADR 0046. `full` pays the discounted estimate; `amount` must equal the quote the
            // Cashier was shown. Absent or `installment` is the existing minimum-payment rule.
            'payment_type' => ['sometimes', 'string', Rule::in(['full', 'installment'])],
```

(the `amount` rule stays `required`).

Edit `backend/app/Actions/Enrollment/FreshmanPaymentRules.php`: add the method

```php
    /**
     * A full payment's received amount (ADR 0046): the discounted estimate, so the first-payment
     * minimum does not apply, but it must be a positive amount that fits the column.
     *
     * @return numeric-string
     */
    public static function normalizeFullAmount(mixed $amount): string
    {
        if (! is_numeric($amount) || bccomp((string) $amount, '99999999.99', 2) === 1 || bccomp((string) $amount, '0', 2) !== 1) {
            throw ValidationException::withMessages(['amount' => 'Enter the amount received.']);
        }

        return bcadd((string) $amount, '0', 2);
    }
```

- [ ] **Step 5: Change `ConfirmFreshmanPayment`**

Edit `backend/app/Actions/Enrollment/ConfirmFreshmanPayment.php`.

Add the constructor dependency (after `$blockPool`): `private PreviewFreshmanPayment $previewFreshmanPayment,`.

Replace

```php
        $amount = FreshmanPaymentRules::normalizeAmount($validated['amount'] ?? null);

        return DB::transaction(function () use ($profile, $validated, $cashier, $context, $amount): FreshmanPaymentResult {
```

with

```php
        $isFullPayment = ($validated['payment_type'] ?? null) === 'full';
        $amount = $isFullPayment
            ? FreshmanPaymentRules::normalizeFullAmount($validated['amount'] ?? null)
            : FreshmanPaymentRules::normalizeAmount($validated['amount'] ?? null);

        return DB::transaction(function () use ($profile, $validated, $cashier, $context, $amount, $isFullPayment): FreshmanPaymentResult {
```

Directly after the repeat check

```php
            if ($locked->freshman_payment_confirmed_at !== null) {
                return $this->existingResult($locked, $amount);
            }
```

and before `$this->holdAsCredit(...)`, add:

```php
            // ADR 0046: a full payment is re-quoted under the profile lock. The amount the Cashier was
            // shown must still be what a full payment collects, and the percentage that applied is
            // frozen on the profile for the Registrar's approval to use.
            $frozenPercentage = null;

            if ($isFullPayment) {
                $quote = $this->previewFreshmanPayment->execute($locked)->fullPayment;

                if ($quote === null || $quote->netTotal === null) {
                    throw ValidationException::withMessages([
                        'payment_type' => 'A full payment cannot be quoted yet. Take an installment instead.',
                    ]);
                }

                if (bccomp($amount, $quote->netTotal, 2) !== 0) {
                    throw ValidationException::withMessages([
                        'amount' => 'The amount due changed. Review the new amount and confirm again.',
                    ]);
                }

                $frozenPercentage = $quote->applies() ? $quote->percentage : null;
            }
```

Replace `$locked->forceFill(['freshman_payment_confirmed_at' => now()])->save();` with

```php
            $locked->forceFill([
                'freshman_payment_confirmed_at' => now(),
                'full_payment_discount_percentage' => $frozenPercentage,
            ])->save();
```

and in the audit `after` array add

```php
                    'payment_type' => $isFullPayment ? 'full' : 'installment',
                    'full_payment_discount_percentage' => $frozenPercentage,
```

Add to the class docblock: "ADR 0046: `payment_type` `full` collects the discounted estimate and freezes the quoted percentage on the profile."

- [ ] **Step 6: Change `SettleEnrollmentFromAdvanceCredit`**

Edit `backend/app/Actions/Enrollment/SettleEnrollmentFromAdvanceCredit.php`.

Add imports `use App\Actions\Billing\ApplyFullPaymentDiscount;` and `use App\Models\Assessment;`. Replace the constructor with:

```php
    public function __construct(
        private ConfirmPayment $confirmPayment,
        private ApplyFullPaymentDiscount $applyFullPaymentDiscount,
    ) {}
```

Replace the block from `$cashier = User::query()->find(...)` through the `ConfirmPayment` call so it reads:

```php
            $cashier = User::query()->find($held->first()->received_by) ?? $fallbackActor;

            // ADR 0046: the percentage frozen when the Cashier took a full payment is applied to the
            // real assessment now, only if the held credit covers the discounted net. It is used
            // once either way (cleared below), so it can never apply to a later term.
            $frozen = $student->full_payment_discount_percentage;
            if ($frozen !== null) {
                $assessment = Assessment::query()->where('enrollment_id', $enrollment->id)->lockForUpdate()->first();

                if ($assessment instanceof Assessment) {
                    $this->applyFullPaymentDiscount->forHeldCredit($assessment, $frozen, $total, $fallbackActor, $context);
                }

                $student->forceFill(['full_payment_discount_percentage' => null])->save();
            }

            AccountPayment::query()->whereKey($held->modelKeys())->update(['enrollment_id' => $enrollment->id]);

            $this->confirmPayment->execute(
                $enrollment,
                ['amount' => '0.00', 'promissory_note_on_file' => false],
                $cashier,
                $context,
                freshmanFirstPayment: true,
            );

            return true;
```

Extend the docblock: "ADR 0046: a frozen full-payment percentage is applied to the assessment first, when the credit covers the discounted net."

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `cd backend && php artisan test --filter="FullPaymentPayFirstTest|FreshmanPaymentEndpointTest|FreshmanPayFirstJourneyTest|TransfereePayFirst|FreshmanEnrolleesEndpointTest"`
Expected: PASS. If a transferee pay-first test file has a different name, run `php artisan test --filter=Transferee` as well.

- [ ] **Step 8: Checkpoint (no commit)**

Run `cd backend && vendor/bin/pint app/Actions/Enrollment app/Domain/Enrollment app/Http tests/Feature/Api/V1/FullPaymentPayFirstTest.php` and `composer analyse`. Add a `PROGRESS.md` milestone line.

---

### Task 6: Documentation — ADR 0046, PRD, OpenAPI, data dictionary

**Files:**
- Create: `docs/adr/0046-full-payment-discount.md`
- Modify: `PRD.md`, `docs/api/openapi.yaml`, `docs/data-dictionary/enrollment-records.md`, `docs/data-dictionary/student-profile-foundation.md`

**Interfaces:** documents everything produced by Tasks 1–5 (no code).

- [ ] **Step 1: Write the ADR**

Create `docs/adr/0046-full-payment-discount.md`:

```markdown
# ADR 0046 — Full-Payment Discount With a Registrar Head Override

**Status:** Accepted
**Date:** 2026-10-12
**Related:** ADR 0025 (scholarship discount as an assessment line), ADR 0043 (freshman and transferee pay-first). Spec: `docs/superpowers/specs/2026-10-11-full-payment-discount-design.md`.

## Context

The owner asked for a 10% discount for students who pay in full. An installment gets no discount and no extra fee. The percentage and its validity must be editable, and the control belongs to the Registrar Head because every Accounting user is staff and Accounting has no head. PRD FR-FIN-007 to FR-FIN-009 (payment confirmation, COM, idempotency) say nothing about discounts, and ADR 0025 had already established that a discount is a negative assessment line.

## Decisions

1. **"Full payment" is the whole net assessment collected in one Cashier payment.** Anything less is an installment, which has no discount and no extra fee. A request with no `payment_type` behaves exactly as before.
2. **The discount is a negative line** (`full_payment_discount`, percentage in `quantity`) written at payment confirmation, never earlier, inside the confirmation transaction. The base is tuition plus miscellaneous (`ScholarshipBase`), the same as a scholarship. It is rounded half-up to the cent.
3. **No stacking.** An assessment with a scholarship line gets no full-payment discount.
4. **Settings:** one row, `payment_discount_settings` (`percentage` 0 to 100 with one decimal, `valid_from` and `valid_until` as inclusive `Asia/Manila` dates, either may be null). Created on first read at the configured default, 10.0. A percentage of 0, or a window that has passed, turns the discount off.
5. **Who edits it:** the Registrar Head only (`PaymentDiscountSettingPolicy`), through a new "Payment Discount" module. Accounting Staff may read it. Every change is audited (`payment_discount.updated`) and a save that changes nothing writes no audit row. Editing never changes an assessment, payment or COR that already exists.
6. **Returnee / continuing students:** `GET /enrollments/{enrollment}/payment-quote` returns what a full payment collects. `POST /enrollments/{enrollment}/payment` with `payment_type: full` carries the `quoted_amount` the Cashier was shown; if the server's figure differs (the Head edited the setting, or a fee was corrected) the request is refused with 422 and nothing is written.
7. **Pay-first students (freshman, transferee):** their money is held as credit before any assessment exists. A full payment collects the discounted *estimate* (`PreviewFreshmanPayment`), and the quoted percentage is frozen on `student_profiles.full_payment_discount_percentage`. At Registrar approval, after the assessment is built, the discount line is written from the frozen percentage only if the held credit covers the discounted net of the *actual* assessment; otherwise the payment is treated as an installment. The percentage is cleared once used.
8. **Cashier UI:** Pay in full / Installment is offered only when a discount applies. Otherwise the modal is unchanged, so nothing about taking a payment depends on this feature being reachable.
9. **COR:** the snapshot gains `fees.full_payment_discount` and `fees.total_full_payment_discount`; `grand_total` is the net. Snapshots made earlier are untouched.

## Alternatives considered

- **Apply the discount when the assessment is built.** Rejected: the student may never pay in full, and ADR 0025's lesson is that the assessment must read the truth at every point.
- **Store the discount in `fee_schedules`.** Rejected: that table has no validity dates and is Accounting's.
- **A toggle that is always shown.** Rejected: with no discount on offer it does nothing and adds a step to every payment.
- **Honor the frozen percentage even when the credit is short.** Rejected: it would give a discount the money does not cover.

## Consequences

- Two new migrations: `2026_10_12_000001_create_payment_discount_settings_table` and `2026_10_12_000002_add_full_payment_discount_percentage_to_student_profiles_table`. Until they run, payment screens return 500.
- A student who pays the discounted amount and later withdraws or is voided keeps the discount on the paid assessment. There is no refund or clawback rule; that is an open institutional decision (PRD §17), not invented here.
- If GRC wants a different base or stacking rule, change `ApplyFullPaymentDiscount` and `QuoteFullPayment`; existing lines keep their stored amount and percentage.
- Tests: `FullPaymentDiscountPolicyTest`, `QuoteFullPaymentTest`, `PaymentDiscountSettingEndpointTest`, `FullPaymentDiscountEndpointTest`, `FullPaymentPayFirstTest`, `PaymentDiscountMigrationsTest`, `ApiSurfaceTest`.
```

- [ ] **Step 2: Amend the PRD**

Edit `PRD.md`: after the line `- **FR-FIN-010:** Allow the student to view and print/download the authorized COM.` add

```
- **FR-FIN-011:** Offer a full-payment discount (10% of tuition plus miscellaneous fees by default) when the Cashier collects the whole net assessment in one payment. An installment carries no discount and no extra fee, and the discount does not stack with a scholarship (ADR 0046).
- **FR-FIN-012:** Let the Registrar Head set the discount percentage and its validity window (valid-from and valid-until dates). Every change is audited and never alters an issued COR (ADR 0046).
```

and in §17 (the open-questions list) add a line recording the open item: "Refund or clawback of the full-payment discount when a fully paid student withdraws or is voided."  Find the list with `grep -n "^## 17\|PRD §17\|### 17" PRD.md` and follow the style of its neighbours.

- [ ] **Step 3: Amend the OpenAPI file**

Edit `docs/api/openapi.yaml`:

1. After the `/api/v1/enrollments/{enrollment}/payment:` path (before `/api/v1/enrollments/{enrollment}/cor-preview:`), add the quote path, following the style of its neighbour:

```yaml
  /api/v1/enrollments/{enrollment}/payment-quote:
    get:
      operationId: getEnrollmentPaymentQuote
      summary: Quote what paying in full would collect
      description: >
        Accounting Staff only (ADR 0046). For an enrollment that is `pending_payment` and has an
        assessment: the amount due and what a full payment collects. `net_total` is always what a
        full payment collects, discounted when `applies` is true. `reason` is one of `off`,
        `scheduled`, `expired`, `scholar` when no discount applies. Writes nothing. Refused (422)
        for any other enrollment state.
      security:
        - bearerAuth: []
      tags:
        - Payments
      parameters:
        - $ref: "#/components/parameters/RequestId"
        - name: enrollment
          in: path
          required: true
          description: Enrollment ID.
          schema:
            type: integer
      responses:
        "200":
          description: The quote.
          headers:
            X-Request-ID:
              $ref: "#/components/headers/RequestId"
            Cache-Control:
              $ref: "#/components/headers/NoStorePrivate"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PaymentQuoteResponse"
        "401":
          $ref: "#/components/responses/Unauthenticated"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          description: No enrollment exists with the given ID.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "422":
          description: The enrollment is not pending payment or has no assessment.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "429":
          $ref: "#/components/responses/TooManyRequests"
        "500":
          $ref: "#/components/responses/InternalError"
  /api/v1/payment-discount-settings:
    get:
      operationId: getPaymentDiscountSettings
      summary: Read the full-payment discount setting
      description: >
        Registrar Head and Accounting Staff (ADR 0046). The one setting row, created at the
        configured default (10.0%) on first read.
      security:
        - bearerAuth: []
      tags:
        - Payments
      parameters:
        - $ref: "#/components/parameters/RequestId"
      responses:
        "200":
          description: The setting.
          headers:
            X-Request-ID:
              $ref: "#/components/headers/RequestId"
            Cache-Control:
              $ref: "#/components/headers/NoStorePrivate"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PaymentDiscountSettingResponse"
        "401":
          $ref: "#/components/responses/Unauthenticated"
        "403":
          $ref: "#/components/responses/Forbidden"
        "429":
          $ref: "#/components/responses/TooManyRequests"
        "500":
          $ref: "#/components/responses/InternalError"
    put:
      operationId: putPaymentDiscountSettings
      summary: Change the full-payment discount percentage and validity
      description: >
        Registrar Head only (ADR 0046). `percentage` is 0 to 100 with at most one decimal; 0 turns
        the discount off. `valid_from` and `valid_until` are inclusive `Y-m-d` dates in the school's
        calendar (Asia/Manila); both keys must be sent and `null` clears a date. Audited as
        `payment_discount.updated`; a save that changes nothing writes no audit row. Existing
        assessments, payments and CORs are never changed.
      security:
        - bearerAuth: []
      tags:
        - Payments
      parameters:
        - $ref: "#/components/parameters/RequestId"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/UpdatePaymentDiscountSettingRequest"
      responses:
        "200":
          description: The saved setting.
          headers:
            X-Request-ID:
              $ref: "#/components/headers/RequestId"
            Cache-Control:
              $ref: "#/components/headers/NoStorePrivate"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PaymentDiscountSettingResponse"
        "401":
          $ref: "#/components/responses/Unauthenticated"
        "403":
          $ref: "#/components/responses/Forbidden"
        "422":
          description: Invalid percentage or dates.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "429":
          $ref: "#/components/responses/TooManyRequests"
        "500":
          $ref: "#/components/responses/InternalError"
```

2. In `components/schemas`, extend `ConfirmPaymentRequest` (its `properties:` block) with:

```yaml
        payment_type:
          type: string
          enum: ["full", "installment"]
          description: >
            ADR 0046. `full` takes the full-payment discount when one applies and requires
            `quoted_amount` and no `amount`. `installment` requires `amount` and takes no
            discount and no extra fee. Absent behaves as before.
        quoted_amount:
          type: ["number", "string", "null"]
          description: >
            With `full`: the net the Cashier was shown. If the server's figure differs, 422 on
            `quoted_amount` and nothing is written.
```

and add the new schemas next to it:

```yaml
    PaymentQuoteResponse:
      type: object
      additionalProperties: false
      required: [data]
      properties:
        data:
          type: object
          additionalProperties: false
          required: [type, total_amount, full_payment]
          properties:
            type:
              type: string
              enum: [payment_quote]
            total_amount:
              type: string
            full_payment:
              type: object
              additionalProperties: false
              required: [applies, percentage, discount_amount, net_total, reason]
              properties:
                applies:
                  type: boolean
                percentage:
                  type: ["string", "null"]
                discount_amount:
                  type: ["string", "null"]
                net_total:
                  type: string
                reason:
                  type: ["string", "null"]
                  enum: [off, scheduled, expired, scholar, null]
    PaymentDiscountSettingResponse:
      type: object
      additionalProperties: false
      required: [data]
      properties:
        data:
          type: object
          additionalProperties: false
          required: [type, percentage, valid_from, valid_until, status, updated_by, updated_at]
          properties:
            type:
              type: string
              enum: [payment_discount_setting]
            percentage:
              type: string
            valid_from:
              type: ["string", "null"]
              format: date
            valid_until:
              type: ["string", "null"]
              format: date
            status:
              type: string
              enum: [active, scheduled, expired, off]
            updated_by:
              type: ["string", "null"]
            updated_at:
              type: ["string", "null"]
              format: date-time
    UpdatePaymentDiscountSettingRequest:
      type: object
      additionalProperties: false
      required: [percentage, valid_from, valid_until]
      properties:
        percentage:
          type: number
          minimum: 0
          maximum: 100
          multipleOf: 0.1
        valid_from:
          type: ["string", "null"]
          format: date
        valid_until:
          type: ["string", "null"]
          format: date
```

3. In the freshman preview response schema (`FreshmanPaymentPreviewResponse`'s `data` properties), add a required `full_payment` object with the same five keys as the quote (`applies`, `percentage`, `discount_amount`, `net_total` nullable, `reason` also allowing `no_estimate`). Add `payment_type` (enum `full`, `installment`) to the freshman payment request schema, with the note that for `full` the `amount` must equal the previewed `net_total`.

Verify the YAML still parses: `cd frontend && node -e "require('yaml').parse(require('fs').readFileSync('../docs/api/openapi.yaml','utf8'))"` (if the `yaml` package is not installed, use `python -c "import yaml,sys; yaml.safe_load(open('docs/api/openapi.yaml', encoding='utf-8'))"`). Expected: no error.

- [ ] **Step 4: Amend the data dictionary**

Append to `docs/data-dictionary/enrollment-records.md` a new section `## payment_discount_settings` (table of columns `id`, `percentage` `DECIMAL(4,1)`, `valid_from` `DATE` null, `valid_until` `DATE` null, `updated_by` FK `users` null `ON DELETE SET NULL`, timestamps; notes: one row, created on first read, inclusive `Asia/Manila` dates, ADR 0046) and, in the existing `## assessment_items` section, add the category `full_payment_discount` (negative `amount`, the percentage in `quantity`, written only at payment confirmation or Registrar settlement). In `docs/data-dictionary/student-profile-foundation.md`, add a row after `freshman_payment_confirmed_at`:

```
| `full_payment_discount_percentage` | `DECIMAL(4,1)` | nullable | The full-payment discount percentage quoted to a pay-first student (freshman or transferee) when the Cashier took a full payment (ADR 0046); applied to the assessment by the Registrar's approval only if the held credit covers the discounted net, then cleared | `NULL` for everyone else and for an installment. |
```

- [ ] **Step 5: Checkpoint (no commit)**

Re-read each doc edit once against the code (percentage format `10.0`, reason names, route paths). Add a `PROGRESS.md` milestone line.

---

### Task 7: Frontend — Registrar Head "Payment Discount" module

**Files:**
- Create: `frontend/src/features/schemas/payment-discount-schema.ts`, `frontend/src/features/services/payment-discount-service.ts`, `frontend/src/features/services/payment-discount-service.test.ts`, `frontend/src/features/hooks/use-payment-discount.ts`, `frontend/src/features/components/portal/payment-discount-workspace.tsx`, `frontend/src/features/components/portal/payment-discount-workspace.test.tsx`
- Modify: `frontend/src/features/portal/role-capabilities.ts`, `frontend/src/features/portal/module-registry.tsx`, `frontend/src/features/portal/role-capabilities.test.ts`, `frontend/src/features/portal/module-registry.test.tsx`, `frontend/src/features/components/pages/portal-module-page.test.tsx`

**Interfaces:**
- Consumes: `GET|PUT /api/v1/payment-discount-settings` (Task 3).
- Produces: `PaymentDiscountSetting` type; `getPaymentDiscountSetting(signal?)`, `updatePaymentDiscountSetting(input)`; hooks `usePaymentDiscountQuery(enabled?)` and `useUpdatePaymentDiscountMutation()`; query key `["payment-discount", userId]`; module id `payment-discount`.

- [ ] **Step 1: Write the schema and a failing service test**

Create `frontend/src/features/schemas/payment-discount-schema.ts`:

```ts
import { z } from "zod"

const percentagePattern = /^\d{1,3}(\.\d)?$/
const datePattern = /^\d{4}-\d{2}-\d{2}$/

export const paymentDiscountStatusSchema = z.enum([
  "active",
  "scheduled",
  "expired",
  "off",
])

/** The full-payment discount setting as the API returns it (ADR 0046). */
export const paymentDiscountSettingSchema = z
  .object({
    type: z.literal("payment_discount_setting"),
    percentage: z.string().regex(percentagePattern),
    valid_from: z.string().regex(datePattern).nullable(),
    valid_until: z.string().regex(datePattern).nullable(),
    status: paymentDiscountStatusSchema,
    updated_by: z.string().nullable(),
    updated_at: z.iso.datetime().nullable(),
  })
  .strict()

export const paymentDiscountEnvelopeSchema = z
  .object({ data: paymentDiscountSettingSchema })
  .strict()

/** What the form holds: dates are "" while empty. */
export const paymentDiscountFormSchema = z
  .object({
    percentage: z
      .string()
      .trim()
      .regex(
        percentagePattern,
        "Enter a percentage with at most one decimal, for example 10 or 12.5.",
      )
      .refine((value) => Number(value) <= 100, "The percentage cannot be more than 100."),
    valid_from: z
      .string()
      .refine((value) => value === "" || datePattern.test(value), "Pick a valid date."),
    valid_until: z
      .string()
      .refine((value) => value === "" || datePattern.test(value), "Pick a valid date."),
  })
  .refine(
    (values) =>
      values.valid_from === "" ||
      values.valid_until === "" ||
      values.valid_until >= values.valid_from,
    { path: ["valid_until"], message: "The end date cannot be before the start date." },
  )

/** What is sent: an empty date becomes null, which clears it. */
export const updatePaymentDiscountInputSchema = z
  .object({
    percentage: z.string().regex(percentagePattern),
    valid_from: z.string().regex(datePattern).nullable(),
    valid_until: z.string().regex(datePattern).nullable(),
  })
  .strict()

export type PaymentDiscountSetting = z.infer<typeof paymentDiscountSettingSchema>
export type PaymentDiscountFormValues = z.infer<typeof paymentDiscountFormSchema>
export type UpdatePaymentDiscountInput = z.input<typeof updatePaymentDiscountInputSchema>
```

Create `frontend/src/features/services/payment-discount-service.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  getPaymentDiscountSetting,
  updatePaymentDiscountSetting,
} from "@/features/services/payment-discount-service"

const setting = {
  type: "payment_discount_setting",
  percentage: "10.0",
  valid_from: null,
  valid_until: "2026-12-31",
  status: "active",
  updated_by: "Registrar Head",
  updated_at: "2026-10-12T01:00:00Z",
} as const

describe("payment-discount-service", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it("reads the setting from the versioned endpoint", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: setting })))

    await expect(getPaymentDiscountSetting()).resolves.toEqual(setting)
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/v1/payment-discount-settings")
  })

  it("sends the percentage and both dates, with null clearing a date", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: setting })))

    await updatePaymentDiscountSetting({
      percentage: "12.5",
      valid_from: null,
      valid_until: "2026-12-31",
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain("/api/v1/payment-discount-settings")
    expect(init?.method).toBe("PUT")
    expect(JSON.parse(init?.body as string)).toEqual({
      percentage: "12.5",
      valid_from: null,
      valid_until: "2026-12-31",
    })
  })

  it("rejects a response that does not match the contract", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { ...setting, status: "maybe" } })),
    )

    await expect(getPaymentDiscountSetting()).rejects.toThrow(/published v1 contract/)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd frontend && npx vitest run src/features/services/payment-discount-service.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the service and the hook**

Create `frontend/src/features/services/payment-discount-service.ts`:

```ts
import {
  paymentDiscountEnvelopeSchema,
  updatePaymentDiscountInputSchema,
  type PaymentDiscountSetting,
  type UpdatePaymentDiscountInput,
} from "@/features/schemas/payment-discount-schema"
import {
  ApiClientError,
  getAuthenticatedJson,
  putAuthenticatedJson,
} from "@/features/services/api-client"

export const PAYMENT_DISCOUNT_PATH = "/api/v1/payment-discount-settings"

function parse<T>(
  schema: {
    safeParse: (
      value: unknown,
    ) => { success: true; data: T } | { success: false; error: unknown }
  },
  value: unknown,
  label: string,
): T {
  const result = schema.safeParse(value)
  if (result.success) return result.data
  throw new ApiClientError({
    kind: "contract",
    message: `The API responded, but its ${label} did not match the published v1 contract.`,
    cause: result.error,
  })
}

/** The full-payment discount's percentage and validity (ADR 0046). */
export async function getPaymentDiscountSetting(
  signal?: AbortSignal,
): Promise<PaymentDiscountSetting> {
  return parse(
    paymentDiscountEnvelopeSchema,
    await getAuthenticatedJson(PAYMENT_DISCOUNT_PATH, signal),
    "payment discount setting",
  ).data
}

/** Registrar Head only. Both dates are always sent: null clears one. */
export async function updatePaymentDiscountSetting(
  input: UpdatePaymentDiscountInput,
): Promise<PaymentDiscountSetting> {
  const body = parse(
    updatePaymentDiscountInputSchema,
    input,
    "payment discount request",
  )
  return parse(
    paymentDiscountEnvelopeSchema,
    await putAuthenticatedJson(PAYMENT_DISCOUNT_PATH, body),
    "saved payment discount setting",
  ).data
}
```

Create `frontend/src/features/hooks/use-payment-discount.ts`:

```ts
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import type { UpdatePaymentDiscountInput } from "@/features/schemas/payment-discount-schema"
import {
  getPaymentDiscountSetting,
  updatePaymentDiscountSetting,
} from "@/features/services/payment-discount-service"

export const paymentDiscountQueryKey = (userId: string | null) =>
  ["payment-discount", userId] as const

export function usePaymentDiscountQuery(enabled = true) {
  const { session } = useAuth()

  return useQuery({
    queryKey: paymentDiscountQueryKey(session?.userId ?? null),
    queryFn: ({ signal }) => getPaymentDiscountSetting(signal),
    enabled: enabled && session !== null,
  })
}

export function useUpdatePaymentDiscountMutation() {
  const queryClient = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: (input: UpdatePaymentDiscountInput) =>
      updatePaymentDiscountSetting(input),
    onSuccess: (saved) => {
      queryClient.setQueryData(
        paymentDiscountQueryKey(session?.userId ?? null),
        saved,
      )
      // The Cashier's quote depends on this setting.
      void queryClient.invalidateQueries({ queryKey: ["payment-quote"] })
    },
  })
}
```

- [ ] **Step 4: Run the service test and confirm it passes**

Run: `cd frontend && npx vitest run src/features/services/payment-discount-service.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing workspace test**

Create `frontend/src/features/components/portal/payment-discount-workspace.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PaymentDiscountWorkspace } from "@/features/components/portal/payment-discount-workspace"
import { renderWithSession } from "@/tests/render-app"

const registrarHead = {
  userId: "head-1",
  displayName: "Registrar Head",
  role: "registrar_head" as const,
  signedInAt: "2026-10-12T00:00:00Z",
}

const setting = {
  type: "payment_discount_setting",
  percentage: "10.0",
  valid_from: null,
  valid_until: null,
  status: "active",
  updated_by: null,
  updated_at: null,
} as const

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

describe("PaymentDiscountWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  const puts = () =>
    (fetchMock.mock.calls as [RequestInfo | URL, RequestInit | undefined][]).filter(
      ([input, init]) =>
        requestUrl(input).includes("/payment-discount-settings") && init?.method === "PUT",
    )

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockImplementation((input, init) => {
      if (requestUrl(input).includes("/payment-discount-settings")) {
        if (init?.method === "PUT") {
          const sent = JSON.parse(init.body as string) as Record<string, unknown>
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: { ...setting, ...sent, status: "active", updated_by: "Registrar Head", updated_at: "2026-10-12T01:00:00Z" },
              }),
            ),
          )
        }
        return Promise.resolve(new Response(JSON.stringify({ data: setting })))
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })
  })
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it("shows the current percentage and an Active badge, with Save disabled until something changes", async () => {
    renderWithSession(<PaymentDiscountWorkspace />, { session: registrarHead })

    expect(await screen.findByLabelText("Discount percentage")).toHaveValue("10.0")
    expect(screen.getByText("Active")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save discount" })).toBeDisabled()
  })

  it("saves a new percentage and window, sending an empty date as null", async () => {
    const user = userEvent.setup()
    renderWithSession(<PaymentDiscountWorkspace />, { session: registrarHead })

    const percentage = await screen.findByLabelText("Discount percentage")
    await user.clear(percentage)
    await user.type(percentage, "12.5")
    await user.type(screen.getByLabelText("Valid until"), "2026-12-31")
    await user.click(screen.getByRole("button", { name: "Save discount" }))

    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(JSON.parse(puts()[0][1]?.body as string)).toEqual({
      percentage: "12.5",
      valid_from: null,
      valid_until: "2026-12-31",
    })
    expect(await screen.findByText(/Discount saved/)).toBeInTheDocument()
  })

  it("refuses a percentage over 100 or with two decimals and an end date before the start", async () => {
    const user = userEvent.setup()
    renderWithSession(<PaymentDiscountWorkspace />, { session: registrarHead })

    const percentage = await screen.findByLabelText("Discount percentage")
    await user.clear(percentage)
    await user.type(percentage, "100.5")
    await user.click(screen.getByRole("button", { name: "Save discount" }))
    expect(await screen.findByText(/cannot be more than 100|at most one decimal/)).toBeInTheDocument()

    await user.clear(percentage)
    await user.type(percentage, "10")
    await user.type(screen.getByLabelText("Valid from"), "2026-10-20")
    await user.type(screen.getByLabelText("Valid until"), "2026-10-10")
    await user.click(screen.getByRole("button", { name: "Save discount" }))
    expect(await screen.findByText("The end date cannot be before the start date.")).toBeInTheDocument()

    expect(puts()).toHaveLength(0)
  })

  it("is only for the Registrar Head and makes no request for another role", () => {
    renderWithSession(<PaymentDiscountWorkspace />, {
      session: { ...registrarHead, role: "accounting_staff" },
    })

    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Run it and confirm it fails**

Run: `cd frontend && npx vitest run src/features/components/portal/payment-discount-workspace.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 7: Implement the workspace**

Create `frontend/src/features/components/portal/payment-discount-workspace.tsx`:

```tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, Percent } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
import {
  usePaymentDiscountQuery,
  useUpdatePaymentDiscountMutation,
} from "@/features/hooks/use-payment-discount"
import {
  paymentDiscountFormSchema,
  type PaymentDiscountFormValues,
  type PaymentDiscountSetting,
} from "@/features/schemas/payment-discount-schema"

const STATUS_LABEL: Record<PaymentDiscountSetting["status"], string> = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired",
  off: "Off",
}

const STATUS_VARIANT: Record<
  PaymentDiscountSetting["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  scheduled: "secondary",
  expired: "outline",
  off: "outline",
}

function toFormValues(setting: PaymentDiscountSetting): PaymentDiscountFormValues {
  return {
    percentage: setting.percentage,
    valid_from: setting.valid_from ?? "",
    valid_until: setting.valid_until ?? "",
  }
}

function PaymentDiscountForm({ setting }: { setting: PaymentDiscountSetting }) {
  // `useForm` is called directly here and the form is reset after a save: compiled by the React
  // Compiler, the memoized `register()` props would keep stale ref callbacks after `reset`.
  "use no memo"

  const mutation = useUpdatePaymentDiscountMutation()
  const [saved, setSaved] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<PaymentDiscountFormValues>({
    resolver: zodResolver(paymentDiscountFormSchema),
    defaultValues: toFormValues(setting),
  })

  const submit = handleSubmit((values) => {
    setSaved(false)
    mutation.mutate(
      {
        percentage: values.percentage,
        valid_from: values.valid_from === "" ? null : values.valid_from,
        valid_until: values.valid_until === "" ? null : values.valid_until,
      },
      {
        onSuccess: (updated) => {
          reset(toFormValues(updated))
          setSaved(true)
        },
      },
    )
  })

  return (
    <div className="grid gap-6">
      {saved && (
        <Alert className="border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle>Discount saved</AlertTitle>
          <AlertDescription>
            New full payments use these settings. Payments and Certificates of
            Registration that already exist are not changed.
          </AlertDescription>
        </Alert>
      )}
      {mutation.isError && (
        <Alert variant="destructive">
          <AlertTitle>The discount could not be saved</AlertTitle>
          <AlertDescription>
            {mutation.error instanceof Error
              ? mutation.error.message
              : "Check the connection and try again."}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Percent className="size-5 text-primary" />
              <CardTitle level={2}>Full-payment discount</CardTitle>
            </div>
            <Badge variant={STATUS_VARIANT[setting.status]}>
              {STATUS_LABEL[setting.status]}
            </Badge>
          </div>
          <CardDescription>
            Students who pay their whole assessment in one payment get this
            percentage off tuition and miscellaneous fees. An installment has no
            discount and no extra fee. A scholar does not get it on top of their
            scholarship.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => void submit(event)} noValidate>
            <FieldGroup>
              <Field data-invalid={errors.percentage !== undefined}>
                <FieldLabel htmlFor="discount-percentage">
                  Discount percentage
                </FieldLabel>
                <Input
                  id="discount-percentage"
                  inputMode="decimal"
                  aria-invalid={errors.percentage !== undefined}
                  className="max-w-[160px] font-mono"
                  {...register("percentage")}
                />
                <FieldDescription>
                  From 0 to 100, with at most one decimal. Enter 0 to turn the
                  discount off.
                </FieldDescription>
                {errors.percentage && (
                  <FieldError>{errors.percentage.message}</FieldError>
                )}
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={errors.valid_from !== undefined}>
                  <FieldLabel htmlFor="discount-valid-from">Valid from</FieldLabel>
                  <Input
                    id="discount-valid-from"
                    type="date"
                    aria-invalid={errors.valid_from !== undefined}
                    {...register("valid_from")}
                  />
                  <FieldDescription>
                    Leave empty for no start date. This day is included.
                  </FieldDescription>
                  {errors.valid_from && (
                    <FieldError>{errors.valid_from.message}</FieldError>
                  )}
                </Field>
                <Field data-invalid={errors.valid_until !== undefined}>
                  <FieldLabel htmlFor="discount-valid-until">Valid until</FieldLabel>
                  <Input
                    id="discount-valid-until"
                    type="date"
                    aria-invalid={errors.valid_until !== undefined}
                    {...register("valid_until")}
                  />
                  <FieldDescription>
                    Leave empty for no end date. This day is included.
                  </FieldDescription>
                  {errors.valid_until && (
                    <FieldError>{errors.valid_until.message}</FieldError>
                  )}
                </Field>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={!isDirty || mutation.isPending}>
                  {mutation.isPending ? "Saving discount" : "Save discount"}
                </Button>
                {setting.updated_by && setting.updated_at && (
                  <span className="text-xs text-muted-foreground">
                    Last changed by {setting.updated_by}
                  </span>
                )}
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export function PaymentDiscountWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "registrar_head"
  const query = usePaymentDiscountQuery(authorized)

  // The form is deliberately not keyed on the saved values: a key change would remount it after a
  // save and lose its "Discount saved" notice. `reset(updated)` re-seeds it instead.
  return (
    <WorkspacePage
      title="Payment Discount"
      description="Set the discount for students who pay in full, and the dates it is valid. Changes apply to new payments only."
      unauthorized={!authorized}
      lastUpdated={query.dataUpdatedAt}
    >
      <AsyncBoundary query={query} loadingLabel="Loading the payment discount…">
        {(setting) => <PaymentDiscountForm setting={setting} />}
      </AsyncBoundary>
    </WorkspacePage>
  )
}
```

- [ ] **Step 8: Register the module**

Edit `frontend/src/features/portal/role-capabilities.ts`: import an icon already used elsewhere in the file (for example `Percent` from `lucide-react`, adding it to the existing `lucide-react` import list in alphabetical position), and in the `registrar_head` module list, after the `enrollment-dashboard` module and before `audit-logs`, add:

```ts
      portalModule(
        "payment-discount",
        "Payment Discount",
        "Set the discount for students who pay in full, and the dates it is valid.",
        Percent,
      ),
```

Edit `frontend/src/features/portal/module-registry.tsx`: next to the `FeeSettingsWorkspace` lazy declaration add

```tsx
const PaymentDiscountWorkspace = lazyWorkspace(
  () => import("@/features/components/portal/payment-discount-workspace"),
  "PaymentDiscountWorkspace",
)
```

add `| "payment-discount"` after `| "fee-settings"` in the module-id union, add `"payment-discount",` after `"fee-settings",` in the id array, and add `"payment-discount": PaymentDiscountWorkspace,` after `"fee-settings": FeeSettingsWorkspace,` in the component map.

Edit the three tests so they know the new module: in `frontend/src/features/portal/role-capabilities.test.ts` add `"payment-discount",` to the `registrar_head` array, between `"enrollment-dashboard"` and `"audit-logs"`; in `frontend/src/features/portal/module-registry.test.tsx` and `frontend/src/features/components/pages/portal-module-page.test.tsx` add `"payment-discount": "Payment Discount",` after the `"fee-settings": "Fee Settings",` line.

- [ ] **Step 9: Run the tests and confirm they pass**

Run: `cd frontend && npx vitest run src/features/components/portal/payment-discount-workspace.test.tsx src/features/services/payment-discount-service.test.ts src/features/portal src/features/components/pages/portal-module-page.test.tsx`
Expected: PASS. If the module-registry test names its expected region differently, align the new entry with the `<h1>`/region name `WorkspacePage` renders for the title "Payment Discount".

- [ ] **Step 10: Checkpoint (no commit)**

Run `cd frontend && npm run typecheck && npx eslint src/features/components/portal/payment-discount-workspace.tsx src/features/hooks/use-payment-discount.ts src/features/services/payment-discount-service.ts src/features/schemas/payment-discount-schema.ts src/features/portal --max-warnings=0`. Add a `PROGRESS.md` milestone line.

---

### Task 8: Frontend — Cashier modal for a returnee

**Files:**
- Modify: `frontend/src/features/schemas/enrollment-schema.ts`, `frontend/src/features/services/enrollment-service.ts`, `frontend/src/features/services/enrollment-service.test.ts`, `frontend/src/features/hooks/use-enrollment.ts`, `frontend/src/features/components/portal/accounting-payment-workspace.tsx`, `frontend/src/features/components/portal/accounting-payment-workspace.test.tsx`

**Interfaces:**
- Consumes: `GET /enrollments/{id}/payment-quote` and `POST /enrollments/{id}/payment` with `payment_type`/`quoted_amount` (Task 4).
- Produces: `paymentQuoteSchema`, type `PaymentQuote`; `getPaymentQuote(id, signal?)`; `usePaymentQuoteQuery(enrollmentId, { enabled })` with key `["payment-quote", userId, id]`; `useConfirmPaymentMutation` now also accepts `paymentType?: "full" | "installment"` and `quotedAmount?: string`; assessment-item category `"full_payment_discount"`.

- [ ] **Step 1: Write the failing schema/service tests**

Append to `frontend/src/features/services/enrollment-service.test.ts` (inside the existing top-level `describe`, using that file's existing `fetchMock`/helpers — read the file's first 40 lines and reuse its names):

```ts
  it("reads the payment quote for an enrollment", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            type: "payment_quote",
            total_amount: "1050.00",
            full_payment: {
              applies: true,
              percentage: "10.0",
              discount_amount: "105.00",
              net_total: "945.00",
              reason: null,
            },
          },
        }),
      ),
    )

    const quote = await getPaymentQuote(9)

    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/v1/enrollments/9/payment-quote")
    expect(quote.full_payment.net_total).toBe("945.00")
  })

  it("sends a full payment with its quoted amount and no amount", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }))

    await confirmPayment(9, { payment_type: "full", quoted_amount: "945.00" }).catch(() => undefined)

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init?.body as string)).toEqual({
      payment_type: "full",
      quoted_amount: "945.00",
    })
  })
```

(import `getPaymentQuote` and `confirmPayment` into that test's existing import from `@/features/services/enrollment-service` if they are not already imported.)

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd frontend && npx vitest run src/features/services/enrollment-service.test.ts`
Expected: FAIL (`getPaymentQuote is not a function`; the strict input schema rejects `payment_type`).

- [ ] **Step 3: Extend the schema, service and hooks**

Edit `frontend/src/features/schemas/enrollment-schema.ts`:

1. In `assessmentItemSchema`, change the category to
   `category: z.enum(["tuition", "miscellaneous", "scholarship_discount", "full_payment_discount"]),`
2. Replace `confirmPaymentInputSchema` with
```ts
export const confirmPaymentInputSchema = z
  .object({
    external_reference: z.string().optional(),
    amount: z.number().min(1000).optional(),
    promissory_note_on_file: z.boolean().optional(),
    // ADR 0046: `full` carries the net the Cashier was shown and no amount.
    payment_type: z.enum(["full", "installment"]).optional(),
    quoted_amount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .optional(),
  })
  .strict()

/** What a full payment collects for an enrollment right now (ADR 0046). */
export const paymentQuoteSchema = z
  .object({
    type: z.literal("payment_quote"),
    total_amount: z.string().min(1),
    full_payment: z
      .object({
        applies: z.boolean(),
        percentage: z.string().nullable(),
        discount_amount: z.string().nullable(),
        net_total: z.string().min(1),
        reason: z
          .enum(["off", "scheduled", "expired", "scholar"])
          .nullable(),
      })
      .strict(),
  })
  .strict()

export const paymentQuoteEnvelopeSchema = z
  .object({ data: paymentQuoteSchema })
  .strict()

export type PaymentQuote = z.infer<typeof paymentQuoteSchema>
```

Edit `frontend/src/features/services/enrollment-service.ts`: import `paymentQuoteEnvelopeSchema` and `type PaymentQuote` from the schema module, and add (next to `getCorPreview`):

```ts
/**
 * ADR 0046: what paying in full collects for a pending-payment enrollment, computed by the API
 * so the browser never disagrees with it on rounding.
 */
export async function getPaymentQuote(
  enrollmentId: number,
  signal?: AbortSignal,
): Promise<PaymentQuote> {
  const payload = await getAuthenticatedJson(
    `${ENROLLMENTS_PATH}/${enrollmentId}/payment-quote`,
    signal,
  )
  return parse(paymentQuoteEnvelopeSchema, payload, "payment quote").data
}
```

Edit `frontend/src/features/hooks/use-enrollment.ts`:

1. Import `getPaymentQuote` from the service.
2. In `useConfirmPaymentMutation`, replace the variables type and the call with:

```ts
    mutationFn: ({
      id,
      externalReference,
      amount,
      promissoryNoteOnFile,
      paymentType,
      quotedAmount,
    }: {
      id: number
      externalReference?: string
      amount?: number
      promissoryNoteOnFile?: boolean
      paymentType?: "full" | "installment"
      quotedAmount?: string
    }) =>
      confirmPayment(id, {
        external_reference: externalReference,
        amount,
        promissory_note_on_file: promissoryNoteOnFile,
        payment_type: paymentType,
        quoted_amount: quotedAmount,
      }),
```

3. Add after `useCorPreviewQuery`:

```ts
/**
 * The Cashier's quote for the serving enrollment (ADR 0046). Read while the payment steps are
 * open and kept fresh, because the Registrar Head can change the discount at any moment.
 */
export function usePaymentQuoteQuery(
  enrollmentId: number | null,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: ["payment-quote", session?.userId ?? null, enrollmentId],
    queryFn: ({ signal }) => getPaymentQuote(enrollmentId!, signal),
    enabled:
      enabled && session?.role === "accounting_staff" && enrollmentId !== null,
    staleTime: 0,
    refetchInterval: 15_000,
  })
}
```

4. In `useInvalidateEnrollmentQueries`, add to the `Promise.all` list:

```ts
      queryClient.invalidateQueries({ queryKey: ["payment-quote"] }),
```

- [ ] **Step 4: Run the service tests and confirm they pass**

Run: `cd frontend && npx vitest run src/features/services/enrollment-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the quote route to the cashier test helpers (before changing the component)**

Edit `frontend/src/features/components/portal/accounting-payment-workspace.test.tsx`.

Add after the `studentAccount` constant:

```tsx
/** What the API says when no full-payment discount applies (the quote's default in these tests). */
const noDiscountQuote = {
  type: "payment_quote",
  total_amount: "5775.00",
  full_payment: {
    applies: false,
    percentage: null,
    discount_amount: null,
    net_total: "5775.00",
    reason: "off",
  },
} as const

const discountQuote = {
  type: "payment_quote",
  total_amount: "5775.00",
  full_payment: {
    applies: true,
    percentage: "10.0",
    discount_amount: "577.50",
    net_total: "5197.50",
    reason: null,
  },
} as const
```

In `mockRoutes`, add `quote?: unknown | "fail"` to the `overrides` type, and add this branch right after the `/students/4/account` branch:

```tsx
    if (target.includes("/enrollments/9/payment-quote"))
      return Promise.resolve(
        overrides.quote === "fail"
          ? new Response(
              JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found.", request_id: "r1" } }),
              { status: 404 },
            )
          : new Response(JSON.stringify({ data: overrides.quote ?? noDiscountQuote })),
      )
```

Then run the existing file once to make sure the helper change alone breaks nothing:
`cd frontend && npx vitest run src/features/components/portal/accounting-payment-workspace.test.tsx`
Expected: PASS (the component does not read the quote yet).

- [ ] **Step 6: Write the failing component tests**

Append a new `describe` block inside the top-level `describe("AccountingPaymentWorkspace", ...)` of the same file (after the last `it`):

```tsx
  describe("full-payment discount (ADR 0046)", () => {
    let paymentBody: unknown

    function routesWith(quote: unknown) {
      return (input: RequestInfo | URL, init?: RequestInit) => {
        if (url(input).includes("/enrollments/9/payment") && !url(input).includes("quote") && init?.method === "POST") {
          paymentBody = JSON.parse(init.body as string)
        }
        return mockRoutes({ quote })(input, init)
      }
    }

    beforeEach(() => {
      paymentBody = undefined
    })

    it("offers Pay in full and Installment when a discount applies, and pays the quoted net", async () => {
      const user = userEvent.setup()
      fetchMock.mockImplementation(routesWith(discountQuote))
      renderWithSession(<AccountingPaymentWorkspace />, { session: accountingSession })

      await screen.findByText("Q001")
      await continueAsRegularPayee(user)
      const dialog = await screen.findByRole("alertdialog")

      const choice = await within(dialog).findByRole("group", { name: "Payment type" })
      expect(within(choice).getByRole("button", { name: /Pay in full/ })).toHaveAttribute("aria-pressed", "true")
      expect(within(dialog).getByLabelText("Amount")).toHaveValue("5197.50")
      expect(within(dialog).getByLabelText("Amount")).toHaveAttribute("readonly")
      expect(within(dialog).getByText(/Full-payment discount \(10%\)/)).toBeInTheDocument()
      expect(within(dialog).getByText("-₱577.50")).toBeInTheDocument()
      // Paying in full is never a partial payment: no promissory note, no partial-payment warning.
      expect(within(dialog).queryByLabelText("Promissory note on file")).not.toBeInTheDocument()
      expect(within(dialog).queryByText(/Partial payment detected/)).not.toBeInTheDocument()

      await user.click(within(dialog).getByRole("button", { name: "Confirm payment" }))

      expect((await screen.findAllByText(/COR000009/)).length).toBeGreaterThan(0)
      expect(paymentBody).toEqual({ payment_type: "full", quoted_amount: "5197.50" })
    })

    it("keeps today's amount, minimum and promissory note for an installment and sends no discount", async () => {
      const user = userEvent.setup()
      fetchMock.mockImplementation(routesWith(discountQuote))
      renderWithSession(<AccountingPaymentWorkspace />, { session: accountingSession })

      await screen.findByText("Q001")
      await continueAsRegularPayee(user)
      const dialog = await screen.findByRole("alertdialog")
      await user.click(await within(dialog).findByRole("button", { name: /Installment/ }))

      const amount = within(dialog).getByLabelText("Amount")
      expect(amount).not.toHaveAttribute("readonly")
      expect(amount).toHaveValue("5775.00")
      await user.clear(amount)
      await user.type(amount, "1000")
      await user.click(within(dialog).getByLabelText("Promissory note on file"))
      await user.click(within(dialog).getByRole("button", { name: "Confirm payment" }))

      expect((await screen.findAllByText(/COR000009/)).length).toBeGreaterThan(0)
      expect(paymentBody).toEqual({ amount: 1000, promissory_note_on_file: true })
    })

    it("leaves the modal as it is and says so when no discount is active", async () => {
      const user = userEvent.setup()
      fetchMock.mockImplementation(
        routesWith({
          ...noDiscountQuote,
          full_payment: { ...noDiscountQuote.full_payment, reason: "expired" },
        }),
      )
      renderWithSession(<AccountingPaymentWorkspace />, { session: accountingSession })

      await screen.findByText("Q001")
      await continueAsRegularPayee(user)
      const dialog = await screen.findByRole("alertdialog")

      expect(await within(dialog).findByText("No full-payment discount is active.")).toBeInTheDocument()
      expect(within(dialog).queryByRole("group", { name: "Payment type" })).not.toBeInTheDocument()
      expect(within(dialog).getByLabelText("Amount")).toHaveValue("5775.00")
    })

    it("says nothing about a discount for a scholar", async () => {
      const user = userEvent.setup()
      fetchMock.mockImplementation(
        routesWith({
          ...noDiscountQuote,
          full_payment: { ...noDiscountQuote.full_payment, reason: "scholar" },
        }),
      )
      renderWithSession(<AccountingPaymentWorkspace />, { session: accountingSession })

      await screen.findByText("Q001")
      await continueAsRegularPayee(user)
      const dialog = await screen.findByRole("alertdialog")

      await within(dialog).findByLabelText("Amount")
      expect(within(dialog).queryByText("No full-payment discount is active.")).not.toBeInTheDocument()
      expect(within(dialog).queryByRole("group", { name: "Payment type" })).not.toBeInTheDocument()
    })

    it("still lets the Cashier take the payment when the quote cannot be read", async () => {
      const user = userEvent.setup()
      fetchMock.mockImplementation(routesWith("fail"))
      renderWithSession(<AccountingPaymentWorkspace />, { session: accountingSession })

      await screen.findByText("Q001")
      await continueAsRegularPayee(user)
      const dialog = await screen.findByRole("alertdialog")

      expect(await within(dialog).findByText(/could not be checked/)).toBeInTheDocument()
      await user.click(within(dialog).getByLabelText("Promissory note on file"))
      await user.click(within(dialog).getByRole("button", { name: "Confirm payment" }))

      expect((await screen.findAllByText(/COR000009/)).length).toBeGreaterThan(0)
      expect(paymentBody).toEqual({ amount: 5775, promissory_note_on_file: true })
    })

    it("shows the new amount when the discount changed under the Cashier", async () => {
      const user = userEvent.setup()
      fetchMock.mockImplementation((input, init) => {
        if (url(input).endsWith("/enrollments/9/payment") && init?.method === "POST") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                error: {
                  code: "VALIDATION_FAILED",
                  message: "Validation failed.",
                  errors: { quoted_amount: ["The amount due changed. Review the new amount and confirm again."] },
                  request_id: "r1",
                },
              }),
              { status: 422 },
            ),
          )
        }
        return mockRoutes({ quote: discountQuote })(input, init)
      })
      renderWithSession(<AccountingPaymentWorkspace />, { session: accountingSession })

      await screen.findByText("Q001")
      await continueAsRegularPayee(user)
      const dialog = await screen.findByRole("alertdialog")
      await within(dialog).findByRole("group", { name: "Payment type" })
      await user.click(within(dialog).getByRole("button", { name: "Confirm payment" }))

      expect(await within(dialog).findByText(/The amount due changed/)).toBeInTheDocument()
      // The dialog stays open so the Cashier can review the refreshed quote.
      expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    })
  })
```

- [ ] **Step 7: Run them and confirm they fail**

Run: `cd frontend && npx vitest run src/features/components/portal/accounting-payment-workspace.test.tsx -t "full-payment discount"`
Expected: FAIL (no `Payment type` group; the body does not contain `payment_type`).

- [ ] **Step 8: Change the Cashier workspace**

Edit `frontend/src/features/components/portal/accounting-payment-workspace.tsx`. Make these edits in order (each `old` string appears once in the file as read on 2026-10-12; if an anchor has moved, search for its first line):

1. Add `usePaymentQuoteQuery` to the existing import from `@/features/hooks/use-enrollment` (alphabetical position).

2. After `const [promissoryNoteOnFile, setPromissoryNoteOnFile] = useState(false)` add:

```tsx
  // ADR 0046: with a discount on offer, the Cashier chooses Pay in full (the default) or Installment.
  const [paymentMode, setPaymentMode] = useState<"full" | "installment">("full")
```

3. Directly before `const accountQuery = useStudentAccountQuery(` add:

```tsx
  // Read as soon as the payment steps open, so the quote is already there when the payment modal
  // appears; the Registrar Head can change the discount at any moment, so it is kept fresh.
  const paymentQuoteQuery = usePaymentQuoteQuery(
    nowServing?.enrollment_id ?? null,
    { enabled: authorized && step !== "closed" },
  )
```

4. Replace this block

```tsx
  const fixedAmount = netTotal !== null && netTotal < MIN_FIRST_PAYMENT
  const amount =
    amountOverride ?? (netTotal !== null ? netTotal.toFixed(2) : "")
  const amountBelowMinimum =
    !fixedAmount &&
    amount.trim() !== "" &&
    !(Number(amount) >= MIN_FIRST_PAYMENT)
  const isPartialPayment =
    !amountBelowMinimum &&
    netTotal !== null &&
    Number(amount) > 0 &&
    Number(amount) < netTotal
```

with

```tsx
  // ADR 0046: the discount is on offer only when the API's quote says it applies. Pay in full then
  // collects the quoted net (never typed, never partial); Installment is today's flow unchanged.
  const fullQuote = paymentQuoteQuery.data?.full_payment ?? null
  const discountOffered = fullQuote?.applies === true
  const payInFull = discountOffered && paymentMode === "full"
  // The quote has been asked for but has not arrived yet: do not let a payment go through
  // without the discount the student may be owed.
  const quotePending =
    paymentQuoteQuery.isFetching && paymentQuoteQuery.data === undefined
  const fixedAmount = netTotal !== null && netTotal < MIN_FIRST_PAYMENT
  const amount =
    payInFull && fullQuote
      ? fullQuote.net_total
      : (amountOverride ?? (netTotal !== null ? netTotal.toFixed(2) : ""))
  const amountBelowMinimum =
    !payInFull &&
    !fixedAmount &&
    amount.trim() !== "" &&
    !(Number(amount) >= MIN_FIRST_PAYMENT)
  const isPartialPayment =
    !payInFull &&
    !amountBelowMinimum &&
    netTotal !== null &&
    Number(amount) > 0 &&
    Number(amount) < netTotal
```

5. In `openConfirm`, after `setPromissoryNoteOnFile(false)` add `setPaymentMode("full")`.

6. In `confirmPayment`, replace

```tsx
      const result = await paymentMutation.mutateAsync({
        id: servingEnrollmentId,
        amount: fixedAmount || !amount.trim() ? undefined : Number(amount),
        promissoryNoteOnFile,
      })
```

with

```tsx
      const result = await paymentMutation.mutateAsync(
        payInFull && fullQuote
          ? {
              id: servingEnrollmentId,
              paymentType: "full",
              quotedAmount: fullQuote.net_total,
            }
          : {
              id: servingEnrollmentId,
              amount:
                fixedAmount || !amount.trim() ? undefined : Number(amount),
              promissoryNoteOnFile,
            },
      )
```

and replace the matching `catch` block

```tsx
    } catch {
      setError(
        "The payment could not be confirmed. Check the connection and try again.",
      )
    }
```

with

```tsx
    } catch (confirmError) {
      setError(
        apiMessage(
          confirmError,
          "The payment could not be confirmed. Check the connection and try again.",
        ),
      )
      // A refused quote means the amount due changed: read the new one so the Cashier can review it.
      void paymentQuoteQuery.refetch()
    }
```

(Where the dialog renders `error`, the existing alert already shows it. If the dialog does not render `error`, render it the same way the file renders `stepError`.)

7. In the modal JSX, directly before `<Field data-invalid={amountBelowMinimum}>` (the Amount field) add:

```tsx
            {discountOffered && fullQuote && (
              <div
                role="group"
                aria-label="Payment type"
                className="grid gap-2 sm:grid-cols-2"
              >
                <Button
                  type="button"
                  variant={payInFull ? "default" : "outline"}
                  aria-pressed={payInFull}
                  disabled={paymentMutation.isPending}
                  onClick={() => setPaymentMode("full")}
                >
                  Pay in full ({Number(fullQuote.percentage)}% off)
                </Button>
                <Button
                  type="button"
                  variant={payInFull ? "outline" : "default"}
                  aria-pressed={!payInFull}
                  disabled={paymentMutation.isPending}
                  onClick={() => setPaymentMode("installment")}
                >
                  Installment (no discount)
                </Button>
              </div>
            )}
            {!discountOffered && paymentQuoteQuery.isError && (
              <p className="text-xs text-muted-foreground">
                The full-payment discount could not be checked. The payment can
                still be confirmed without it.
              </p>
            )}
            {!discountOffered &&
              fullQuote !== null &&
              fullQuote.reason !== null &&
              fullQuote.reason !== "scholar" && (
                <p className="text-xs text-muted-foreground">
                  No full-payment discount is active.
                </p>
              )}
```

8. On the Amount `<Input>`, change `readOnly={fixedAmount}` to `readOnly={fixedAmount || payInFull}`, and replace the description branch

```tsx
              {fixedAmount ? (
                <FieldDescription>
                  {netTotal === 0
                    ? "No payment is due: the scholarship covers the whole assessment. Confirming still generates the Certificate of Registration."
                    : "The assessment is below the ₱1,000.00 first-payment minimum, so it is collected in full."}
                </FieldDescription>
              ) : (
```

with

```tsx
              {payInFull ? (
                <FieldDescription>
                  Pay in full collects the net amount after the full-payment
                  discount.
                </FieldDescription>
              ) : fixedAmount ? (
                <FieldDescription>
                  {netTotal === 0
                    ? "No payment is due: the scholarship covers the whole assessment. Confirming still generates the Certificate of Registration."
                    : "The assessment is below the ₱1,000.00 first-payment minimum, so it is collected in full."}
                </FieldDescription>
              ) : (
```

9. In the summary box, directly after the "Current Term Assessment" row (the `<div className="flex justify-between text-muted-foreground"><span>Current Term Assessment:</span>…</div>`), add:

```tsx
                {payInFull && fullQuote?.discount_amount && (
                  <>
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                      <span>
                        Full-payment discount ({Number(fullQuote.percentage)}%):
                      </span>
                      <span className="font-semibold">
                        -{formatPhp(fullQuote.discount_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Net payable:</span>
                      <span className="font-semibold text-foreground">
                        {formatPhp(fullQuote.net_total)}
                      </span>
                    </div>
                  </>
                )}
```

and inside the summary's immediately-invoked function, replace

```tsx
                  const assessed = Number(
                    nowServingEnrollment.assessment.total_amount,
                  )
```

with

```tsx
                  const assessed =
                    payInFull && fullQuote
                      ? Number(fullQuote.net_total)
                      : Number(nowServingEnrollment.assessment.total_amount)
```

and replace

```tsx
                  const overallOutstanding = accountQuery.data
                    ? Number(accountQuery.data.outstanding_balance)
                    : assessed
```

with

```tsx
                  // The discount is not on the account balance until the payment is confirmed.
                  const overallOutstanding = accountQuery.data
                    ? Number(accountQuery.data.outstanding_balance) -
                      (payInFull ? Number(fullQuote?.discount_amount ?? 0) : 0)
                    : assessed
```

10. Wrap the promissory-note `<Field data-invalid={isPartialPayment && !promissoryNoteOnFile}> … </Field>` in `{!payInFull && ( … )}`.

11. On the Confirm button change `disabled={confirmDisabled || amountBelowMinimum}` to `disabled={confirmDisabled || amountBelowMinimum || quotePending}`.

12. Show the error where the Cashier is looking. The page-level `error` alert (near the top of the `WorkspacePage` children, `{error && ( <Alert variant="destructive"> … )}`) sits behind the modal overlay, so a refused payment would look like nothing happened. Change its condition to `{error && !confirming && (` and, inside the payment `AlertDialogContent`, directly after the closing `</FieldGroup>` and before `<AlertDialogFooter>`, add:

```tsx
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
```

(`Alert` and `AlertDescription` are already imported in this file.)

- [ ] **Step 9: Run the cashier tests and confirm they pass**

Run: `cd frontend && npx vitest run src/features/components/portal/accounting-payment-workspace.test.tsx`
Expected: PASS for the whole file (the new tests and every existing one). If an existing test that clicks Confirm right after the dialog opens fails because `quotePending` briefly disables the button, add `await within(dialog).findByLabelText("Amount")` before the click in that test (the quote mock resolves in the same tick as the account query) rather than loosening the production guard.

- [ ] **Step 10: Checkpoint (no commit)**

Run `cd frontend && npm run typecheck && npx eslint src/features/components/portal/accounting-payment-workspace.tsx src/features/hooks/use-enrollment.ts src/features/services/enrollment-service.ts src/features/schemas/enrollment-schema.ts --max-warnings=0`. Add a `PROGRESS.md` milestone line.

---

### Task 9: Frontend — Cashier dialog for a freshman or transferee

**Files:**
- Modify: `frontend/src/features/schemas/freshman-schema.ts`, `frontend/src/features/services/freshman-service.test.ts`, `frontend/src/features/components/portal/freshman-payment-dialog.tsx`, `frontend/src/features/components/portal/accounting-payment-workspace.test.tsx`

**Interfaces:**
- Consumes: preview `data.full_payment` and `payment_type` on `POST …/freshman-payment` (Task 5).
- Produces: `FreshmanPaymentPreview.full_payment` (`applies`, `percentage`, `discount_amount`, `net_total`, `reason`, with a default for older responses); `ConfirmFreshmanPaymentInput.payment_type`.

- [ ] **Step 1: Write the failing schema/service test**

Append to `frontend/src/features/services/freshman-service.test.ts` (inside its top-level `describe`; reuse the file's existing fetch mock and preview fixture names — read the first 60 lines first):

```ts
  it("reads the full-payment quote from the preview, and defaults it for an older response", async () => {
    // A preview with no `full_payment` key (an older server) still parses and offers no discount.
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: previewFixture })),
    )
    const older = await getFreshmanPaymentPreview(77)
    expect(older.full_payment.applies).toBe(false)
    expect(older.full_payment.net_total).toBeNull()

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            ...previewFixture,
            full_payment: {
              applies: true,
              percentage: "10.0",
              discount_amount: "920.00",
              net_total: "8280.00",
              reason: null,
            },
          },
        }),
      ),
    )
    const current = await getFreshmanPaymentPreview(77)
    expect(current.full_payment.net_total).toBe("8280.00")
  })

  it("sends payment_type with a full payment", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }))

    await confirmFreshmanPayment(77, { amount: "8280.00", payment_type: "full" }).catch(() => undefined)

    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      amount: "8280.00",
      payment_type: "full",
    })
  })
```

(`previewFixture` stands for whatever the file already calls its preview payload; if none exists, define one equal to `previewData` in `accounting-payment-workspace.test.tsx` lines 540-558.)

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd frontend && npx vitest run src/features/services/freshman-service.test.ts`
Expected: FAIL (`full_payment` undefined; `payment_type` rejected by the strict schema).

- [ ] **Step 3: Extend the schema**

Edit `frontend/src/features/schemas/freshman-schema.ts`.

In `freshmanPaymentPreviewSchema`, after `estimated_total: z.string().min(1).nullable(),` add:

```ts
    // ADR 0046: what paying in full collects. Defaults so a response from a server that predates it
    // still parses and simply offers no discount.
    full_payment: z
      .object({
        applies: z.boolean(),
        percentage: z.string().nullable(),
        discount_amount: z.string().nullable(),
        net_total: z.string().nullable(),
        reason: z
          .enum(["off", "scheduled", "expired", "scholar", "no_estimate"])
          .nullable(),
      })
      .strict()
      .default({
        applies: false,
        percentage: null,
        discount_amount: null,
        net_total: null,
        reason: null,
      }),
```

In `confirmFreshmanPaymentInputSchema`, add after `external_reference`:

```ts
    // ADR 0046: `full` pays the discounted estimate; `amount` must be the net the Cashier was shown.
    payment_type: z.enum(["full", "installment"]).optional(),
```

- [ ] **Step 4: Run the service tests and confirm they pass**

Run: `cd frontend && npx vitest run src/features/services/freshman-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing dialog tests**

In `frontend/src/features/components/portal/accounting-payment-workspace.test.tsx`, inside `describe("freshman tickets", ...)` after the test "will not confirm an amount below the minimum", add:

```tsx
    const discountedPreview = {
      ...previewData,
      full_payment: {
        applies: true,
        percentage: "10.0",
        discount_amount: "920.00",
        net_total: "8280.00",
        reason: null,
      },
    } as const

    it("offers Pay in full at the discounted estimate and sends it as a full payment", async () => {
      const user = userEvent.setup()
      fetchMock.mockImplementation(mockFreshmanRoutes({ preview: discountedPreview }))
      renderWithSession(<AccountingPaymentWorkspace />, { session: accountingSession })
      const dialog = await openFreshmanDialog(user)

      const choice = await within(dialog).findByRole("group", { name: "Payment type" })
      expect(within(choice).getByRole("button", { name: /Pay in full/ })).toHaveAttribute("aria-pressed", "true")
      expect(within(dialog).getByLabelText("Amount received")).toHaveValue("8280.00")
      expect(within(dialog).getByLabelText("Amount received")).toHaveAttribute("readonly")
      expect(within(dialog).getByText(/Full-payment discount \(10%\)/)).toBeInTheDocument()

      await user.click(within(dialog).getByRole("button", { name: "Confirm first payment" }))

      await screen.findByRole("status")
      const post = fetchMock.mock.calls.find(
        ([input, init]) => url(input).endsWith("/freshman-payment") && init?.method === "POST",
      )
      expect(JSON.parse(post?.[1]?.body as string)).toEqual({
        amount: "8280.00",
        payment_type: "full",
      })
    })

    it("keeps the minimum-payment rule for an installment and sends no payment type", async () => {
      const user = userEvent.setup()
      fetchMock.mockImplementation(mockFreshmanRoutes({ preview: discountedPreview }))
      renderWithSession(<AccountingPaymentWorkspace />, { session: accountingSession })
      const dialog = await openFreshmanDialog(user)

      await user.click(await within(dialog).findByRole("button", { name: /Installment/ }))
      expect(within(dialog).getByLabelText("Amount received")).toHaveValue("1000.00")
      expect(within(dialog).getByLabelText("Amount received")).not.toHaveAttribute("readonly")
      await user.click(within(dialog).getByRole("button", { name: "Confirm first payment" }))

      await screen.findByRole("status")
      const post = fetchMock.mock.calls.find(
        ([input, init]) => url(input).endsWith("/freshman-payment") && init?.method === "POST",
      )
      expect(JSON.parse(post?.[1]?.body as string)).toEqual({ amount: "1000.00" })
    })

    it("shows no payment-type choice when there is nothing to estimate yet", async () => {
      const user = userEvent.setup()
      fetchMock.mockImplementation(
        mockFreshmanRoutes({
          preview: {
            ...previewData,
            can_enroll: false,
            block: null,
            estimated_total: null,
            full_payment: { applies: false, percentage: null, discount_amount: null, net_total: null, reason: "no_estimate" },
          },
        }),
      )
      renderWithSession(<AccountingPaymentWorkspace />, { session: accountingSession })
      const dialog = await openFreshmanDialog(user)

      await within(dialog).findByLabelText("Amount received")
      expect(within(dialog).queryByRole("group", { name: "Payment type" })).not.toBeInTheDocument()
    })
```

- [ ] **Step 6: Run them and confirm they fail**

Run: `cd frontend && npx vitest run src/features/components/portal/accounting-payment-workspace.test.tsx -t "freshman tickets"`
Expected: FAIL (no `Payment type` group).

- [ ] **Step 7: Change the dialog**

Edit `frontend/src/features/components/portal/freshman-payment-dialog.tsx`.

1. Replace this block

```tsx
  const minimum = preview.data?.minimum_amount ?? "1000.00"
  // Pre-filled with the minimum: the Cashier types the amount actually received.
  const amount = amountInput ?? minimum
  const amountIsNumber = amount.trim() !== "" && Number.isFinite(Number(amount))
  const belowMinimum = amountIsNumber && Number(amount) < Number(minimum)
  const invalidAmount = !amountIsNumber || belowMinimum
```

with

```tsx
  const minimum = preview.data?.minimum_amount ?? "1000.00"
  // ADR 0046: with a discount on offer the Cashier chooses Pay in full (the default, at the
  // discounted estimate, never typed) or Installment (today's minimum-payment flow).
  const [mode, setMode] = useState<"full" | "installment">("full")
  const fullQuote = preview.data?.full_payment ?? null
  const discountOffered =
    fullQuote?.applies === true && fullQuote.net_total !== null
  const payInFull = discountOffered && mode === "full"
  // Pre-filled with the minimum: the Cashier types the amount actually received.
  const amount =
    payInFull && fullQuote?.net_total ? fullQuote.net_total : (amountInput ?? minimum)
  const amountIsNumber = amount.trim() !== "" && Number.isFinite(Number(amount))
  const belowMinimum =
    !payInFull && amountIsNumber && Number(amount) < Number(minimum)
  const invalidAmount = !amountIsNumber || belowMinimum
```

2. In `confirm()`, replace the `input` object with:

```tsx
        input: {
          amount: Number(amount).toFixed(2),
          ...(payInFull ? { payment_type: "full" as const } : {}),
          ...(reference.trim() ? { external_reference: reference.trim() } : {}),
        },
```

and change the catch's call to also refresh the preview (a refused quote means the amount due changed):

```tsx
    } catch (confirmError) {
      setError(
        apiMessage(
          confirmError,
          "The payment could not be confirmed. Check the connection and try again.",
        ),
      )
      void preview.refetch()
    }
```

3. In the JSX, directly before the amount `<Field data-invalid={invalidAmount}>` add:

```tsx
          {discountOffered && fullQuote && (
            <div
              role="group"
              aria-label="Payment type"
              className="grid gap-2 sm:grid-cols-2"
            >
              <Button
                type="button"
                variant={payInFull ? "default" : "outline"}
                aria-pressed={payInFull}
                disabled={busy}
                onClick={() => setMode("full")}
              >
                Pay in full ({Number(fullQuote.percentage)}% off)
              </Button>
              <Button
                type="button"
                variant={payInFull ? "outline" : "default"}
                aria-pressed={!payInFull}
                disabled={busy}
                onClick={() => setMode("installment")}
              >
                Installment (no discount)
              </Button>
            </div>
          )}
```

4. On the amount `<Input id="freshman-payment-amount" …>` add `readOnly={payInFull}`. Replace its `<FieldDescription>` ("The first payment must be at least …") with:

```tsx
            <FieldDescription>
              {payInFull && fullQuote?.discount_amount ? (
                <>
                  Full-payment discount ({Number(fullQuote.percentage)}%): −
                  {formatPhp(fullQuote.discount_amount)} off the estimated
                  assessment. Pay in full collects the net.
                </>
              ) : (
                <>
                  The first payment must be at least {formatPhp(minimum)}. The
                  balance stays on the student&apos;s account.
                </>
              )}
            </FieldDescription>
```

- [ ] **Step 8: Run the dialog tests and confirm they pass**

Run: `cd frontend && npx vitest run src/features/components/portal/accounting-payment-workspace.test.tsx src/features/services/freshman-service.test.ts`
Expected: PASS (the new tests and every existing freshman test; the existing preview fixture has no `full_payment`, so it defaults to "no discount" and the dialog is unchanged).

- [ ] **Step 9: Checkpoint (no commit)**

Run `cd frontend && npm run typecheck && npx eslint src/features/components/portal/freshman-payment-dialog.tsx src/features/schemas/freshman-schema.ts --max-warnings=0`. Add a `PROGRESS.md` milestone line.

---

### Task 10: Frontend — show the discount on the COR and the statement

**Files:**
- Modify: `frontend/src/features/schemas/enrollment-document-schema.ts`, `frontend/src/features/components/portal/certificate-of-registration-document.tsx`, `frontend/src/features/components/portal/certificate-of-registration-document.test.tsx`, `frontend/src/features/components/portal/statement-of-account-view.tsx`, `frontend/src/features/components/portal/statement-of-account-workspace.test.tsx`

**Interfaces:**
- Consumes: COR snapshot `fees.full_payment_discount` / `fees.total_full_payment_discount` (Task 4); statement `lines[].category === "full_payment_discount"` (the API already returns every assessment line).

- [ ] **Step 1: Write the failing COR test**

In `frontend/src/features/components/portal/certificate-of-registration-document.test.tsx`, find the existing test that renders a scholarship discount (search for `scholarship_discount`) and copy its fixture setup into a new test:

```tsx
  it("lists the full-payment discount above the grand total, and omits it when there is none", () => {
    const withDiscount = buildCor({
      fees: {
        full_payment_discount: [
          { label: "Full-payment discount (10%)", quantity: "10.0", unit_amount: null, amount: "-105.00" },
        ],
        total_full_payment_discount: "-105.00",
        grand_total: "945.00",
      },
    })
    const { rerender } = render(<CertificateOfRegistrationDocument cor={withDiscount} />)

    const region = screen.getByLabelText("Full-payment discount")
    expect(within(region).getByText("Full-payment discount (10%)")).toBeInTheDocument()
    expect(within(region).getByText(/105\.00/)).toBeInTheDocument()

    rerender(<CertificateOfRegistrationDocument cor={buildCor({})} />)
    expect(screen.queryByLabelText("Full-payment discount")).not.toBeInTheDocument()
  })
```

`buildCor` stands for the test file's own fixture builder. Read the scholarship test in that file and use the same builder or inline object; keep the same assertions.

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd frontend && npx vitest run src/features/components/portal/certificate-of-registration-document.test.tsx`
Expected: FAIL (no "Full-payment discount" region; the strict schema may also reject the new keys).

- [ ] **Step 3: Extend the schema and the document**

Edit `frontend/src/features/schemas/enrollment-document-schema.ts`: after `total_scholarship_discount: z.string().optional(),` add

```ts
        // ADR 0046: the full-payment discount is a second negative line; snapshots made before it
        // have neither field.
        full_payment_discount: z.array(corMoneyItemSchema).optional(),
        total_full_payment_discount: z.string().optional(),
```

Edit `frontend/src/features/components/portal/certificate-of-registration-document.tsx`: after `const scholarshipDiscount = fees.scholarship_discount ?? []` add `const fullPaymentDiscount = fees.full_payment_discount ?? []`, and after the scholarship `{scholarshipDiscount.length > 0 && (...)}` block add:

```tsx
          {fullPaymentDiscount.length > 0 && (
            <div
              className="cor-document__fee-total"
              aria-label="Full-payment discount"
            >
              <FeeRows items={fullPaymentDiscount} currency={fees.currency} />
            </div>
          )}
```

- [ ] **Step 4: Write the failing statement test and change the view**

In `frontend/src/features/components/portal/statement-of-account-workspace.test.tsx`, find the fixture term that has `scholarship_discount: "0.00"` and add a test (reusing that file's render helper and fixtures) that gives the term a line `{ category: "full_payment_discount", label: "Full-payment discount (10%)", quantity: "10.0", unit_amount: null, amount: "-105.00" }` and asserts the amount renders as a credit (the same `text-success` class the scholarship line gets):

```tsx
  it("shows a full-payment discount line as a credit like a scholarship", async () => {
    // … render with the fixture whose term carries the line above …
    const row = (await screen.findByText("Full-payment discount (10%)")).closest("tr") as HTMLElement
    expect(within(row).getByText(/105\.00/).className).toMatch(/text-success/)
  })
```

Edit `frontend/src/features/components/portal/statement-of-account-view.tsx`: replace

```tsx
            const discount = line.category === "scholarship_discount"
```

with

```tsx
            const discount =
              line.category === "scholarship_discount" ||
              line.category === "full_payment_discount"
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `cd frontend && npx vitest run src/features/components/portal/certificate-of-registration-document.test.tsx src/features/components/portal/statement-of-account-workspace.test.tsx src/features/components/portal/enrollment-queue-payment-panel.test.tsx`
Expected: PASS.

- [ ] **Step 6: Checkpoint (no commit)**

Run `cd frontend && npm run typecheck && npx eslint src/features/components/portal/certificate-of-registration-document.tsx src/features/components/portal/statement-of-account-view.tsx src/features/schemas/enrollment-document-schema.ts --max-warnings=0`. Add a `PROGRESS.md` milestone line.

---

### Task 11: Whole-suite verification, real-browser pass and handoff

**Files:** none new. Updates `PROGRESS.md` only.

- [ ] **Step 1: Backend full suite and static checks**

Run from the repo root:
`cd backend && vendor/bin/pint --test && composer analyse && php artisan test`
Expected: Pint clean, PHPStan clean, and every test green. The baseline before this work was 2,569 backend tests, none known-failing, so any failure is a real regression. If the harness reaps the run for low memory, split it by directory as `PROGRESS.md` ("Test baseline — SOLVED") describes. Record the exact counts.

- [ ] **Step 2: Frontend full suite and static checks**

Run: `cd frontend && npm run typecheck && npm run lint && npx vitest run --maxWorkers=6`
Expected: all green (baseline 215 files / 1,760 tests before this work). `--maxWorkers=6` avoids the load-starved timeouts noted in `PROGRESS.md`.

- [ ] **Step 3: Real-browser pass on the private-backend recipe (never the owner's live data)**

Follow the memory note "Browser pass recipe" (private backend on `php -S :8001` over a scratch DB on `:3310`, role-swapping tokens, one tab, `exact: true`, mind the alertdialog and the timeout cap). Walk this journey and record what happened:

1. Registrar Head opens **Payment Discount**: sees 10.0, Active; sets 12.5 and a valid-until date in the future; saves; sees "Discount saved".
2. Accounting Staff serves a returnee: Confirm payment → Regular payee → the modal shows **Pay in full (12.5% off)** with the discounted net, then pays in full; the COR shows the "Full-payment discount" line above the grand total and the net as the total.
3. A second returnee: choose **Installment**, pay ₱1,000 with a promissory note; no discount and no extra line on the COR.
4. A freshman pays in full at the Cashier (discounted estimate); the Registrar approves; the COR shows the discount and the student has no balance.
5. The Head sets 0; the next Cashier modal shows "No full-payment discount is active." and the unchanged flow.

Stop and report instead of retrying if the browser tool fails more than twice (system rule for browser automation).

- [ ] **Step 4: Final `PROGRESS.md` and the handoff**

Replace the 2026-10-11 entry's status line with the real state (what was built, the exact test counts, the browser-pass result, any failure and what was done about it). `Grep` that the entry survived. Then give the owner a short Taglish handoff that, in this order: (1) says **two migrations are new** (`2026_10_12_000001_create_payment_discount_settings_table`, `2026_10_12_000002_add_full_payment_discount_percentage_to_student_profiles_table`) and that the dev server's payment screens 500 until `php artisan migrate` is run (already run locally in Task 1, so state whether it was); (2) lists what changed in plain words; (3) lists the open items (refund/clawback when a fully paid student withdraws; no retroactive discount); (4) says nothing is committed or pushed and offers the GitHub saving point. Do not push without the owner's explicit request.

---

## Self-review (run before handing the plan over)

**Spec coverage.**

| Spec requirement | Task |
|---|---|
| 10% default, one settings row, percentage + validity window, 0/past = off | 1, 2, 3 |
| Registrar Head edits, Accounting reads, audited, no-op writes no audit | 3 |
| New "Payment Discount" Registrar Head module (spec correction) | 7 |
| Discount as negative line, whole-assessment base, half-up | 1, 2, 4 |
| Installment: no discount, no extra fee, unchanged | 4 (test), 8 |
| No stacking with a scholarship | 2, 4 |
| Returnee quote endpoint, `payment_type` / `quoted_amount`, stale-quote 422 | 4 |
| Idempotent confirmation | 4 |
| COR snapshot fields | 4, 10 |
| Pay-first: preview quote, frozen percentage on the profile, settlement only if credit covers, cleared once, no_estimate refused | 5 |
| Cashier UI (returnee) and Freshman dialog, toggle only when a discount applies, muted notes, quote failure does not block | 8, 9 |
| Student/Statement/COR show the new line | 10 |
| ADR 0046, PRD, OpenAPI, data dictionary | 6 |
| Migration rollback tests with the trait | 1 |
| Manila-time window boundary | 2 |
| Real-UI pass, PROGRESS.md, handoff with migrations first | 11 |

**Placeholder scan.** No "TBD"/"TODO". Two steps tell the engineer to read a neighbouring file's fixture names first (Task 8 Step 1, Task 9 Step 1, Task 10 Steps 1 and 4); those test files' helpers were not copied here because they differ per file, and each such step names exactly what to copy and what to assert.

**Type consistency.** `FullPaymentQuote` fields (`baseTotal`, `percentage`, `discountAmount`, `netTotal`, `reason`) are the names used by `QuoteFullPayment`, `ApplyFullPaymentDiscount`, both resources and `PreviewFreshmanPayment`. The JSON keys `applies`, `percentage`, `discount_amount`, `net_total`, `reason` are the same in the quote resource, the preview resource, the Zod schemas and the OpenAPI text. `payment_type` values are `full` and `installment` everywhere. The audit `source` values are `cashier_payment` and `held_credit_settlement`.
