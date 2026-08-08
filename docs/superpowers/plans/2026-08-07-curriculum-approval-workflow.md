# Curriculum Approval Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Program Chair's direct Status dropdown with a real sign-off chain — Program Chair submits → Dean approves → Executive Director approves → curriculum becomes Active — with a required-reason return path back to Draft at either checkpoint, and a new Dean/Executive Director review surface.

**Architecture:** Mirrors the existing `ScheduleProposal` lifecycle machinery almost exactly (`CurriculumStatus` gains two pending states; a new `CurriculumTransitionRules` domain class + `TransitionCurriculum` action apply one transition per request inside a locked-row transaction; a new Policy-per-action endpoint serves Program Chair/Dean/Executive Director from one route, since no single `role:` middleware fits). The existing content-save endpoint (`PATCH /curricula/{id}`) is unchanged in shape but now rejects edits once a curriculum has left `Draft`, and no longer accepts a `status` field at all. A new sidebar module, `curriculum-approvals`, gives Dean and Executive Director a review queue, reusing the `ScheduleDecisionControls`/`ScheduleReviewDialog` UI pattern.

**Tech Stack:** Laravel 11 (PHPUnit feature/unit tests, Eloquent, Sanctum), Next.js/React frontend (TanStack Query, react-hook-form, Zod, shadcn/ui `Tabs`/`Dialog`/`AlertDialog`).

## Global Constraints

- Every new PHP enum case, class, and test follows the existing `final class` / strict-typed style already used throughout `app/Domain`, `app/Actions`, `app/Policies` — copy the shape of the `ScheduleProposal` equivalent exactly rather than inventing a new one.
- Dean and Executive Director authorization is **role-scoped only, not college-scoped** — see `ScheduleProposalPolicy::approveAsDean()`/`approveAsExecutive()` and `NotifyScheduleTransition`'s docblock. Do not add a `college` check to any Dean/Executive Director curriculum ability.
- `dean_return` and `executive_return` require a non-empty `reason`; both land the curriculum back on `Draft`.
- No change to `Archived` or to the View tab.
- This plan does **not** touch the Manage tab's subject-entry mechanism (SearchableCombobox + placement list + Prerequisite graph dialog) beyond locking it outside `Draft` and removing the Status field — the flat-table redesign and inline subject creation are a separate, later plan.
- Frontend: run `npx vitest run <file>` for the specific file(s) you touched after each step that says to; run `npx tsc --noEmit -p tsconfig.json` before every commit that touches a `.ts`/`.tsx` file. Backend: run `php artisan test <path>` (or `./vendor/bin/phpunit <path>`, whichever this repo's `composer.json` `test` script uses — check it once at Task 1) for the specific test file after each step that says to.

---

## Task 1: `CurriculumStatus` gains the two pending states

**Files:**
- Modify: `backend/app/Domain/Curriculum/CurriculumStatus.php`
- Test: `backend/tests/Unit/Domain/Curriculum/CurriculumStatusTest.php`

**Interfaces:**
- Produces: `CurriculumStatus::PendingDeanReview` (`'pending_dean_review'`), `CurriculumStatus::PendingExecutiveReview` (`'pending_executive_review'`) — consumed by every later task in this plan.

- [ ] **Step 1: Read the existing test file to see its current shape**

Run: `cat backend/tests/Unit/Domain/Curriculum/CurriculumStatusTest.php`

- [ ] **Step 2: Add failing assertions for the two new cases**

Append to `backend/tests/Unit/Domain/Curriculum/CurriculumStatusTest.php` (inside the existing test class body):

```php
    public function test_pending_dean_review_has_the_expected_value_and_label(): void
    {
        self::assertSame('pending_dean_review', CurriculumStatus::PendingDeanReview->value);
        self::assertSame('Pending Dean Review', CurriculumStatus::PendingDeanReview->label());
        self::assertFalse(CurriculumStatus::PendingDeanReview->isVisibleToLearners());
    }

    public function test_pending_executive_review_has_the_expected_value_and_label(): void
    {
        self::assertSame('pending_executive_review', CurriculumStatus::PendingExecutiveReview->value);
        self::assertSame('Pending Executive Review', CurriculumStatus::PendingExecutiveReview->label());
        self::assertFalse(CurriculumStatus::PendingExecutiveReview->isVisibleToLearners());
    }
```

- [ ] **Step 3: Run the test file to verify it fails**

Run (from `backend/`): `php artisan test tests/Unit/Domain/Curriculum/CurriculumStatusTest.php`
Expected: FAIL — `Undefined constant App\Domain\Curriculum\CurriculumStatus::PendingDeanReview`.

- [ ] **Step 4: Add the two cases to the enum**

Replace the full contents of `backend/app/Domain/Curriculum/CurriculumStatus.php` with:

```php
<?php

namespace App\Domain\Curriculum;

/**
 * PROVISIONAL VOCABULARY — NOT AN APPROVED INSTITUTIONAL POLICY VALUE.
 *
 * PRD §17 lists institutional status vocabularies as an open decision
 * requiring GRC approval. These values exist only so this slice has
 * something concrete to authorize against; they must be replaced with the
 * confirmed vocabulary via a data migration before any production-like
 * deployment. The `curricula.status` column stays a plain string for exactly
 * this reason.
 *
 * `PendingDeanReview` and `PendingExecutiveReview` are the two checkpoints
 * of the approval chain a Program Chair's `Draft` curriculum passes through
 * before becoming `Active` — see `CurriculumTransitionRules`. Neither is
 * reachable or leavable except through that class's transitions.
 */
enum CurriculumStatus: string
{
    case Draft = 'draft';
    case PendingDeanReview = 'pending_dean_review';
    case PendingExecutiveReview = 'pending_executive_review';
    case Active = 'active';
    case Archived = 'archived';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::PendingDeanReview => 'Pending Dean Review',
            self::PendingExecutiveReview => 'Pending Executive Review',
            self::Active => 'Active',
            self::Archived => 'Archived',
        };
    }

    /**
     * Whether learner-scoped roles (student, faculty, accounting staff) may
     * see this curriculum. A curriculum still being authored — or under
     * review — is not yet learner-facing; active and archived curricula
     * are (students already following an archived curriculum still need to
     * see it). Planning roles always see every curriculum regardless of
     * this value — see Curriculum::scopeVisibleTo().
     */
    public function isVisibleToLearners(): bool
    {
        return match ($this) {
            self::Draft, self::PendingDeanReview, self::PendingExecutiveReview => false,
            self::Active, self::Archived => true,
        };
    }
}
```

- [ ] **Step 5: Run the test file to verify it passes**

Run: `php artisan test tests/Unit/Domain/Curriculum/CurriculumStatusTest.php`
Expected: PASS (all tests in the file, old and new).

- [ ] **Step 6: Commit**

```bash
git add backend/app/Domain/Curriculum/CurriculumStatus.php backend/tests/Unit/Domain/Curriculum/CurriculumStatusTest.php
git commit -m "feat(curriculum): add PendingDeanReview/PendingExecutiveReview statuses"
```

---

## Task 2: Migration — decision columns on `curricula`

**Files:**
- Create: `backend/database/migrations/2026_08_07_000004_add_decision_columns_to_curricula.php`
- Test: none dedicated — exercised by Task 8's endpoint test.

**Interfaces:**
- Produces: `curricula.decided_by` (nullable `unsignedBigInteger`, FK to `users.id`), `curricula.decided_at` (nullable `timestamp`), `curricula.last_decision_reason` (nullable `string`) — consumed by Task 7 (`TransitionCurriculum`).

- [ ] **Step 1: Write the migration**

Create `backend/database/migrations/2026_08_07_000004_add_decision_columns_to_curricula.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Backs the new Draft -> PendingDeanReview -> PendingExecutiveReview ->
 * Active approval chain (see `App\Domain\Curriculum\CurriculumTransitionRules`).
 * `decided_by`/`decided_at` record whoever most recently applied a
 * transition (submit, approve, or return); `last_decision_reason` holds the
 * most recent RETURN reason only — it is not cleared on approve, only
 * overwritten by the next return, so a chair can always see why their
 * curriculum was last sent back even after resubmitting once more without
 * yet hearing back again. All three are nullable: a never-submitted Draft
 * has none of them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('curricula', function (Blueprint $table): void {
            $table->foreignId('decided_by')->nullable()->after('status')->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable()->after('decided_by');
            $table->string('last_decision_reason')->nullable()->after('decided_at');
        });
    }

    public function down(): void
    {
        Schema::table('curricula', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('decided_by');
            $table->dropColumn(['decided_at', 'last_decision_reason']);
        });
    }
};
```

- [ ] **Step 2: Run the migration against the test database and verify it applies cleanly**

Run (from `backend/`): `php artisan migrate --database=grc_test` (use whatever connection name `phpunit.xml`/`.env.testing` configures — check `php artisan test` output the first time; `RefreshDatabase` runs all migrations automatically for feature tests, so this step is really just "does `up()` execute without error").

A quick check: `php artisan migrate:fresh --database=grc_test && php artisan migrate:status --database=grc_test | grep add_decision_columns`
Expected: the migration shows as `Ran`.

- [ ] **Step 3: Commit**

```bash
git add backend/database/migrations/2026_08_07_000004_add_decision_columns_to_curricula.php
git commit -m "feat(curriculum): add decided_by/decided_at/last_decision_reason columns"
```

---

## Task 3: `Curriculum` model exposes the new columns

**Files:**
- Modify: `backend/app/Models/Curriculum.php`

**Interfaces:**
- Consumes: Task 2's columns.
- Produces: `Curriculum::$decided_by` (`?int`), `Curriculum::$decided_at` (`?CarbonImmutable`), `Curriculum::$last_decision_reason` (`?string`), all mass-assignable.

- [ ] **Step 1: Add the three columns to `$fillable` and the `@property` docblock**

In `backend/app/Models/Curriculum.php`, change:

```php
/**
 * @property int $id
 * @property int $program_id
 * @property string $name
 * @property string $effective_school_year
 * @property ?int $effective_start_year
 * @property ?int $effective_end_year
 * @property CurriculumStatus $status
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read Program $program
 * @property-read Collection<int, CurriculumSubject> $subjectPlacements
 */
final class Curriculum extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'program_id',
        'name',
        'effective_school_year',
        'effective_start_year',
        'effective_end_year',
        'status',
    ];
```

to:

```php
/**
 * @property int $id
 * @property int $program_id
 * @property string $name
 * @property string $effective_school_year
 * @property ?int $effective_start_year
 * @property ?int $effective_end_year
 * @property CurriculumStatus $status
 * @property ?int $decided_by
 * @property ?CarbonImmutable $decided_at
 * @property ?string $last_decision_reason
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read Program $program
 * @property-read Collection<int, CurriculumSubject> $subjectPlacements
 */
final class Curriculum extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'program_id',
        'name',
        'effective_school_year',
        'effective_start_year',
        'effective_end_year',
        'status',
        'decided_by',
        'decided_at',
        'last_decision_reason',
    ];
```

- [ ] **Step 2: Add `decided_at` to the casts array**

Change:

```php
    protected function casts(): array
    {
        return [
            'status' => CurriculumStatus::class,
        ];
    }
```

to:

```php
    protected function casts(): array
    {
        return [
            'status' => CurriculumStatus::class,
            'decided_at' => 'immutable_datetime',
        ];
    }
```

- [ ] **Step 3: Verify nothing broke**

Run (from `backend/`): `php artisan test tests/Unit/Models/CurriculumTest.php tests/Feature/Policies/CurriculumPolicyTest.php`
Expected: PASS (unchanged — this step only widens the model, no behavior changed yet).

- [ ] **Step 4: Commit**

```bash
git add backend/app/Models/Curriculum.php
git commit -m "feat(curriculum): expose decision columns on the Curriculum model"
```

---

## Task 4: `CurriculumTransitionRules` domain class

**Files:**
- Create: `backend/app/Domain/Curriculum/CurriculumTransitionRules.php`
- Test: Create `backend/tests/Unit/Domain/Curriculum/CurriculumTransitionRulesTest.php`

**Interfaces:**
- Consumes: `CurriculumStatus` (Task 1).
- Produces: `CurriculumTransitionRules::actions(): list<string>`, `::requiredStatus(string $action): CurriculumStatus`, `::targetStatus(string $action): CurriculumStatus`, `::isReturn(string $action): bool` — consumed by Task 7 (`TransitionCurriculum`) and Task 8 (`CurriculumController`).

- [ ] **Step 1: Write the failing test**

Create `backend/tests/Unit/Domain/Curriculum/CurriculumTransitionRulesTest.php`:

```php
<?php

namespace Tests\Unit\Domain\Curriculum;

use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\CurriculumTransitionRules;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class CurriculumTransitionRulesTest extends TestCase
{
    #[DataProvider('checkpointActions')]
    public function test_checkpoint_actions_use_the_status_the_reviewer_actually_receives(
        string $action,
        CurriculumStatus $required,
        CurriculumStatus $target,
        bool $isReturn,
    ): void {
        self::assertSame($required, CurriculumTransitionRules::requiredStatus($action));
        self::assertSame($target, CurriculumTransitionRules::targetStatus($action));
        self::assertSame($isReturn, CurriculumTransitionRules::isReturn($action));
    }

    /** @return array<string, array{string, CurriculumStatus, CurriculumStatus, bool}> */
    public static function checkpointActions(): array
    {
        return [
            'Chair submits a draft' => ['submit', CurriculumStatus::Draft, CurriculumStatus::PendingDeanReview, false],
            'Dean approves a submission' => ['dean_approve', CurriculumStatus::PendingDeanReview, CurriculumStatus::PendingExecutiveReview, false],
            'Dean returns a submission' => ['dean_return', CurriculumStatus::PendingDeanReview, CurriculumStatus::Draft, true],
            'Executive approves a Dean-approved submission' => ['executive_approve', CurriculumStatus::PendingExecutiveReview, CurriculumStatus::Active, false],
            'Executive returns a Dean-approved submission' => ['executive_return', CurriculumStatus::PendingExecutiveReview, CurriculumStatus::Draft, true],
        ];
    }

    public function test_actions_lists_exactly_the_five_known_actions(): void
    {
        self::assertSame(
            ['submit', 'dean_approve', 'dean_return', 'executive_approve', 'executive_return'],
            CurriculumTransitionRules::actions(),
        );
    }

    public function test_unknown_action_is_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);

        CurriculumTransitionRules::requiredStatus('unknown');
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run (from `backend/`): `php artisan test tests/Unit/Domain/Curriculum/CurriculumTransitionRulesTest.php`
Expected: FAIL — class `App\Domain\Curriculum\CurriculumTransitionRules` not found.

- [ ] **Step 3: Write the implementation**

Create `backend/app/Domain/Curriculum/CurriculumTransitionRules.php`:

```php
<?php

namespace App\Domain\Curriculum;

use InvalidArgumentException;

final class CurriculumTransitionRules
{
    /** @var array<string, CurriculumStatus> */
    private const REQUIRED_STATUS = [
        'submit' => CurriculumStatus::Draft,
        'dean_approve' => CurriculumStatus::PendingDeanReview,
        'dean_return' => CurriculumStatus::PendingDeanReview,
        'executive_approve' => CurriculumStatus::PendingExecutiveReview,
        'executive_return' => CurriculumStatus::PendingExecutiveReview,
    ];

    /** @var array<string, CurriculumStatus> */
    private const TARGET_STATUS = [
        'submit' => CurriculumStatus::PendingDeanReview,
        'dean_approve' => CurriculumStatus::PendingExecutiveReview,
        'dean_return' => CurriculumStatus::Draft,
        'executive_approve' => CurriculumStatus::Active,
        'executive_return' => CurriculumStatus::Draft,
    ];

    /** @return list<string> */
    public static function actions(): array
    {
        return array_keys(self::REQUIRED_STATUS);
    }

    public static function requiredStatus(string $action): CurriculumStatus
    {
        return self::REQUIRED_STATUS[$action]
            ?? throw new InvalidArgumentException('Unknown curriculum transition.');
    }

    public static function targetStatus(string $action): CurriculumStatus
    {
        return self::TARGET_STATUS[$action]
            ?? throw new InvalidArgumentException('Unknown curriculum transition.');
    }

    public static function isReturn(string $action): bool
    {
        return in_array($action, ['dean_return', 'executive_return'], true);
    }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `php artisan test tests/Unit/Domain/Curriculum/CurriculumTransitionRulesTest.php`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Domain/Curriculum/CurriculumTransitionRules.php backend/tests/Unit/Domain/Curriculum/CurriculumTransitionRulesTest.php
git commit -m "feat(curriculum): add CurriculumTransitionRules domain class"
```

---

## Task 5: `NotificationType` gains four curriculum cases

**Files:**
- Modify: `backend/app/Domain/Notifications/NotificationType.php`

**Interfaces:**
- Produces: `NotificationType::CurriculumSubmittedForDean`, `::CurriculumDeanApproved`, `::CurriculumExecutiveApproved`, `::CurriculumReturned` — consumed by Task 6.

- [ ] **Step 1: Add the four cases**

In `backend/app/Domain/Notifications/NotificationType.php`, add these four lines at the end of the enum body (before the closing `}`):

```php
    case CurriculumSubmittedForDean = 'curriculum_submitted_for_dean';
    case CurriculumDeanApproved = 'curriculum_dean_approved';
    case CurriculumExecutiveApproved = 'curriculum_executive_approved';
    case CurriculumReturned = 'curriculum_returned';
```

- [ ] **Step 2: Verify the enum still parses (no PHP syntax test needed — a quick tinker check is enough)**

Run (from `backend/`): `php artisan tinker --execute="echo App\Domain\Notifications\NotificationType::CurriculumReturned->value;"`
Expected output: `curriculum_returned`

- [ ] **Step 3: Commit**

```bash
git add backend/app/Domain/Notifications/NotificationType.php
git commit -m "feat(notifications): add curriculum transition notification types"
```

---

## Task 6: `CurriculumTransitionNotificationPlan` + `NotifyCurriculumTransition`

**Files:**
- Create: `backend/app/Domain/Curriculum/CurriculumTransitionNotificationPlan.php`
- Create: `backend/app/Actions/Curriculum/NotifyCurriculumTransition.php`
- Test: Create `backend/tests/Unit/Domain/Curriculum/CurriculumTransitionNotificationPlanTest.php`

**Interfaces:**
- Consumes: `NotificationType` (Task 5), `App\Support\Notifications\NotificationRecorder` (existing).
- Produces: `NotifyCurriculumTransition::submittedForDean(Curriculum $curriculum): void`, `::deanApproved(Curriculum $curriculum): void`, `::returned(Curriculum $curriculum, UserRole $reviewerRole, string $reason): void`, `::executiveApproved(Curriculum $curriculum): void` — consumed by Task 7.

- [ ] **Step 1: Write the failing test for the pure plan class**

Create `backend/tests/Unit/Domain/Curriculum/CurriculumTransitionNotificationPlanTest.php`:

```php
<?php

namespace Tests\Unit\Domain\Curriculum;

use App\Domain\Curriculum\CurriculumTransitionNotificationPlan;
use App\Domain\Identity\UserRole;
use App\Domain\Notifications\NotificationType;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class CurriculumTransitionNotificationPlanTest extends TestCase
{
    public function test_submitted_for_dean_notifies_every_dean(): void
    {
        $plan = CurriculumTransitionNotificationPlan::forAction('submitted_for_dean', 'BSCS Curriculum 2026-2027', null);

        self::assertSame([
            ['audience' => UserRole::Dean, 'type' => NotificationType::CurriculumSubmittedForDean, 'message' => 'BSCS Curriculum 2026-2027 was submitted for your review.'],
        ], $plan);
    }

    public function test_dean_approve_notifies_the_submitter_and_every_executive_director(): void
    {
        $plan = CurriculumTransitionNotificationPlan::forAction('dean_approve', 'BSCS Curriculum 2026-2027', null);

        self::assertSame([
            ['audience' => 'submitter', 'type' => NotificationType::CurriculumDeanApproved, 'message' => 'BSCS Curriculum 2026-2027 was approved by the Dean.'],
            ['audience' => UserRole::ExecutiveDirector, 'type' => NotificationType::CurriculumDeanApproved, 'message' => 'BSCS Curriculum 2026-2027 was approved by the Dean and is ready for your review.'],
        ], $plan);
    }

    public function test_executive_approve_notifies_the_submitter(): void
    {
        $plan = CurriculumTransitionNotificationPlan::forAction('executive_approve', 'BSCS Curriculum 2026-2027', null);

        self::assertSame([
            ['audience' => 'submitter', 'type' => NotificationType::CurriculumExecutiveApproved, 'message' => 'BSCS Curriculum 2026-2027 was approved and is now Active.'],
        ], $plan);
    }

    public function test_dean_return_notifies_the_submitter_with_the_reason(): void
    {
        $plan = CurriculumTransitionNotificationPlan::forAction('dean_return', 'BSCS Curriculum 2026-2027', 'Missing PATHFIT 2.');

        self::assertSame([
            ['audience' => 'submitter', 'type' => NotificationType::CurriculumReturned, 'message' => 'Dean returned BSCS Curriculum 2026-2027. Reason: Missing PATHFIT 2.'],
        ], $plan);
    }

    public function test_executive_return_notifies_the_submitter_with_the_reason(): void
    {
        $plan = CurriculumTransitionNotificationPlan::forAction('executive_return', 'BSCS Curriculum 2026-2027', 'Units mismatch on ITP2.');

        self::assertSame([
            ['audience' => 'submitter', 'type' => NotificationType::CurriculumReturned, 'message' => 'Executive Director returned BSCS Curriculum 2026-2027. Reason: Units mismatch on ITP2.'],
        ], $plan);
    }

    public function test_unknown_action_is_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);

        CurriculumTransitionNotificationPlan::forAction('unknown', 'BSCS Curriculum 2026-2027', null);
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run (from `backend/`): `php artisan test tests/Unit/Domain/Curriculum/CurriculumTransitionNotificationPlanTest.php`
Expected: FAIL — class not found.

- [ ] **Step 3: Write `CurriculumTransitionNotificationPlan`**

Create `backend/app/Domain/Curriculum/CurriculumTransitionNotificationPlan.php`:

```php
<?php

namespace App\Domain\Curriculum;

use App\Domain\Identity\UserRole;
use App\Domain\Notifications\NotificationType;
use InvalidArgumentException;

/**
 * Pure recipient/message rules for curriculum-transition notifications —
 * mirrors `App\Domain\Scheduling\ScheduleTransitionNotificationPlan`
 * exactly. Recipients are described by audience (`submitter` or a role,
 * meaning "every active user with that role") rather than concrete user
 * IDs; resolving a role to IDs is the caller's job (`NotifyCurriculumTransition`).
 *
 * @phpstan-type NotificationPlanItem array{audience: 'submitter'|UserRole, type: NotificationType, message: string}
 */
final class CurriculumTransitionNotificationPlan
{
    public const SUBMITTED_FOR_DEAN = 'submitted_for_dean';

    /**
     * @return list<array{audience: 'submitter'|UserRole, type: NotificationType, message: string}>
     */
    public static function forAction(string $action, string $curriculumLabel, ?string $reason): array
    {
        return match ($action) {
            self::SUBMITTED_FOR_DEAN => [
                [
                    'audience' => UserRole::Dean,
                    'type' => NotificationType::CurriculumSubmittedForDean,
                    'message' => "{$curriculumLabel} was submitted for your review.",
                ],
            ],
            'dean_approve' => [
                [
                    'audience' => 'submitter',
                    'type' => NotificationType::CurriculumDeanApproved,
                    'message' => "{$curriculumLabel} was approved by the Dean.",
                ],
                [
                    'audience' => UserRole::ExecutiveDirector,
                    'type' => NotificationType::CurriculumDeanApproved,
                    'message' => "{$curriculumLabel} was approved by the Dean and is ready for your review.",
                ],
            ],
            'executive_approve' => [
                [
                    'audience' => 'submitter',
                    'type' => NotificationType::CurriculumExecutiveApproved,
                    'message' => "{$curriculumLabel} was approved and is now Active.",
                ],
            ],
            'dean_return' => [
                [
                    'audience' => 'submitter',
                    'type' => NotificationType::CurriculumReturned,
                    'message' => "Dean returned {$curriculumLabel}. Reason: {$reason}",
                ],
            ],
            'executive_return' => [
                [
                    'audience' => 'submitter',
                    'type' => NotificationType::CurriculumReturned,
                    'message' => "Executive Director returned {$curriculumLabel}. Reason: {$reason}",
                ],
            ],
            default => throw new InvalidArgumentException("Unknown curriculum notification action: {$action}"),
        };
    }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `php artisan test tests/Unit/Domain/Curriculum/CurriculumTransitionNotificationPlanTest.php`
Expected: PASS.

- [ ] **Step 5: Write `NotifyCurriculumTransition`** (no dedicated test — it's a thin DB-resolving wrapper exercised by Task 8's endpoint test, matching how `NotifyScheduleTransition` has no standalone test file either)

Create `backend/app/Actions/Curriculum/NotifyCurriculumTransition.php`:

```php
<?php

namespace App\Actions\Curriculum;

use App\Domain\Curriculum\CurriculumTransitionNotificationPlan;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Models\Curriculum;
use App\Models\User;
use App\Support\Notifications\NotificationRecorder;
use InvalidArgumentException;

/**
 * Resolves `CurriculumTransitionNotificationPlan`'s pure recipient/message
 * rules against the database and writes the resulting notification rows —
 * mirrors `App\Actions\Scheduling\NotifyScheduleTransition`.
 */
final class NotifyCurriculumTransition
{
    public function __construct(private readonly NotificationRecorder $notificationRecorder) {}

    public function submittedForDean(Curriculum $curriculum): void
    {
        $this->apply(CurriculumTransitionNotificationPlan::SUBMITTED_FOR_DEAN, $curriculum, null);
    }

    public function deanApproved(Curriculum $curriculum): void
    {
        $this->apply('dean_approve', $curriculum, null);
    }

    public function executiveApproved(Curriculum $curriculum): void
    {
        $this->apply('executive_approve', $curriculum, null);
    }

    public function returned(Curriculum $curriculum, UserRole $reviewerRole, string $reason): void
    {
        $action = match ($reviewerRole) {
            UserRole::Dean => 'dean_return',
            UserRole::ExecutiveDirector => 'executive_return',
            default => throw new InvalidArgumentException('Only the Dean or Executive Director can return a curriculum.'),
        };

        $this->apply($action, $curriculum, $reason);
    }

    private function apply(string $action, Curriculum $curriculum, ?string $reason): void
    {
        $plan = CurriculumTransitionNotificationPlan::forAction(
            $action,
            "{$curriculum->name}",
            $reason,
        );

        foreach ($plan as $item) {
            $recipientIds = $item['audience'] === 'submitter'
                ? $this->submitterIds($curriculum)
                : $this->activeUserIdsForRole($item['audience']);

            $this->notificationRecorder->recordMany($recipientIds, $item['type'], $item['message']);
        }
    }

    /**
     * @return list<int>
     */
    private function submitterIds(Curriculum $curriculum): array
    {
        return $curriculum->decided_by === null ? [] : [$curriculum->decided_by];
    }

    /**
     * @return list<int>
     */
    private function activeUserIdsForRole(UserRole $role): array
    {
        $ids = User::query()
            ->where('role', $role->value)
            ->where('status', UserStatus::Active->value)
            ->pluck('id')
            ->map(static fn (mixed $id): int => (int) $id)
            ->all();

        return array_values($ids);
    }
}
```

**Note for Task 7:** `submitterIds()` reads `$curriculum->decided_by`, which by the time `apply()` runs must already hold the id of whoever **submitted** the curriculum (not whoever is currently deciding it) — Task 7 must snapshot the submitter's id before overwriting `decided_by` with the current actor, and pass a curriculum row that still carries the *original submitter* id when notifying on `dean_approve`/`executive_approve`/`dean_return`/`executive_return`. See Task 7 Step 3 for exactly how.

- [ ] **Step 6: Commit**

```bash
git add backend/app/Domain/Curriculum/CurriculumTransitionNotificationPlan.php backend/app/Actions/Curriculum/NotifyCurriculumTransition.php backend/tests/Unit/Domain/Curriculum/CurriculumTransitionNotificationPlanTest.php
git commit -m "feat(curriculum): add CurriculumTransitionNotificationPlan and NotifyCurriculumTransition"
```

---

## Task 7: `AuditAction` constants + `CurriculumPolicy` abilities

**Files:**
- Modify: `backend/app/Domain/Audit/AuditAction.php`
- Modify: `backend/app/Policies/CurriculumPolicy.php`
- Test: Modify `backend/tests/Feature/Policies/CurriculumPolicyTest.php`

**Interfaces:**
- Produces: `AuditAction::CURRICULUM_SUBMITTED`, `::CURRICULUM_DEAN_APPROVED`, `::CURRICULUM_DEAN_RETURNED`, `::CURRICULUM_EXECUTIVE_APPROVED`, `::CURRICULUM_EXECUTIVE_RETURNED`; `CurriculumPolicy::submit(User, Curriculum): bool`, `::approveAsDean(User): bool`, `::approveAsExecutive(User): bool` — consumed by Task 8.

- [ ] **Step 1: Add the five audit constants**

In `backend/app/Domain/Audit/AuditAction.php`, add after `public const CURRICULUM_UPDATED = 'curriculum.updated';`:

```php
    public const CURRICULUM_SUBMITTED = 'curriculum.submitted';

    public const CURRICULUM_DEAN_APPROVED = 'curriculum.dean_approved';

    public const CURRICULUM_DEAN_RETURNED = 'curriculum.dean_returned';

    public const CURRICULUM_EXECUTIVE_APPROVED = 'curriculum.executive_approved';

    public const CURRICULUM_EXECUTIVE_RETURNED = 'curriculum.executive_returned';
```

And add the same five `self::CURRICULUM_*` references immediately after `self::CURRICULUM_UPDATED,` inside the `values()` array's `return [...]` list.

- [ ] **Step 2: Write the failing policy tests**

Append to the test class body in `backend/tests/Feature/Policies/CurriculumPolicyTest.php` (reuse its existing `makeUser`/`makeCurriculum` helpers already in the file):

Note: `makeUser()`/`makeCurriculum()` (already in this file, shown above for reference) don't set `college` on either the user or the program — fine for every existing test, but `submit`'s new college check needs both set explicitly, so the test below builds its own `User`/`Program`/`Curriculum` rows directly instead of reusing those two helpers.

```php
    public function test_submit_requires_program_chair_role_and_a_matching_college(): void
    {
        $ccsProgram = Program::create(['code' => 'BSCS', 'name' => 'BS Computer Science', 'college' => CollegeCode::Ccs, 'status' => ProgramStatus::Active]);
        $cbaProgram = Program::create(['code' => 'BSA', 'name' => 'BS Accountancy', 'college' => CollegeCode::Cba, 'status' => ProgramStatus::Active]);
        $ccsCurriculum = Curriculum::create(['program_id' => $ccsProgram->id, 'name' => 'BSCS Curriculum', 'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Draft]);
        $cbaCurriculum = Curriculum::create(['program_id' => $cbaProgram->id, 'name' => 'BSA Curriculum', 'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Draft]);

        $ccsChair = User::create(['name' => 'CCS Chair', 'email' => 'ccs-chair@grc.test', 'password' => 'irrelevant-password', 'role' => UserRole::ProgramChair, 'college' => CollegeCode::Ccs, 'status' => UserStatus::Active]);
        $noCollegeChair = User::create(['name' => 'No College Chair', 'email' => 'no-college-chair@grc.test', 'password' => 'irrelevant-password', 'role' => UserRole::ProgramChair, 'status' => UserStatus::Active]);
        $dean = $this->makeUser(UserRole::Dean);

        self::assertTrue((new CurriculumPolicy)->submit($ccsChair, $ccsCurriculum));
        self::assertFalse((new CurriculumPolicy)->submit($ccsChair, $cbaCurriculum));
        self::assertFalse((new CurriculumPolicy)->submit($noCollegeChair, $ccsCurriculum));
        self::assertFalse((new CurriculumPolicy)->submit($dean, $ccsCurriculum));
    }

    public function test_only_dean_can_approve_as_dean(): void
    {
        $dean = $this->makeUser(UserRole::Dean);
        $chair = $this->makeUser(UserRole::ProgramChair);

        self::assertTrue((new CurriculumPolicy)->approveAsDean($dean));
        self::assertFalse((new CurriculumPolicy)->approveAsDean($chair));
    }

    public function test_only_executive_director_can_approve_as_executive(): void
    {
        $executive = $this->makeUser(UserRole::ExecutiveDirector);
        $dean = $this->makeUser(UserRole::Dean);

        self::assertTrue((new CurriculumPolicy)->approveAsExecutive($executive));
        self::assertFalse((new CurriculumPolicy)->approveAsExecutive($dean));
    }
```

Add `use App\Domain\Organization\CollegeCode;` to the file's imports (it isn't there yet — the file's existing imports are `CurriculumStatus`, `UserRole`, `UserStatus`, `ProgramStatus`, `Curriculum`, `Program`, `User`, `CurriculumPolicy`, `RefreshDatabase`, `TestCase`, per the file read in Step 1; `CurriculumPolicy` itself is already imported, since the file already instantiates it in every existing test).

- [ ] **Step 3: Run the tests to verify they fail**

Run (from `backend/`): `php artisan test tests/Feature/Policies/CurriculumPolicyTest.php`
Expected: FAIL — `Call to undefined method App\Policies\CurriculumPolicy::submit()`.

- [ ] **Step 4: Add the three abilities to `CurriculumPolicy`**

Replace the full contents of `backend/app/Policies/CurriculumPolicy.php` with:

```php
<?php

namespace App\Policies;

use App\Domain\Identity\UserRole;
use App\Models\Curriculum;
use App\Models\User;

/**
 * Read access follows the same shape as ProgramPolicy/AcademicTermPolicy.
 * `create`/`update` are Program-Chair-only by role alone (unchanged — note
 * this means neither actually stops a chair from editing another
 * college's curriculum by id today; that pre-existing gap is out of scope
 * here). The three new abilities below back the approval chain's
 * transition endpoint (CurriculumController::transition): `submit` adds a
 * real college check on top of the role check (see its own docblock) since
 * it starts a chain other people rely on, but `approveAsDean`/
 * `approveAsExecutive` are role-scoped only, NOT college-scoped: per
 * `ScheduleProposalPolicy` and `NotifyScheduleTransition`'s docblock,
 * neither the Dean nor the Executive Director is scoped to a single
 * college in this system — every active Dean/Executive Director is a
 * legitimate reviewer for any college's curriculum.
 */
final class CurriculumPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Curriculum $curriculum): bool
    {
        if (! $user->role->isLearnerScoped()) {
            return true;
        }

        return $curriculum->status->isVisibleToLearners();
    }

    public function create(User $user): bool
    {
        return $user->role === UserRole::ProgramChair;
    }

    public function update(User $user, Curriculum $curriculum): bool
    {
        return $user->role === UserRole::ProgramChair;
    }

    /**
     * Unlike `create`/`update` (Program-Chair-only by role alone — an
     * existing gap this method deliberately does not repeat), `submit` is
     * the first step of a chain other people rely on (Dean review,
     * notifications routed to the submitter), so a role check alone isn't
     * enough: it must also confirm the curriculum's own program actually
     * belongs to the acting chair's college, the same defense-in-depth
     * `AutoAssignSectionScheduleReferences` applies ("the role check alone
     * does not stop one college's Chair from bulk-writing another
     * college's [resource]").
     */
    public function submit(User $user, Curriculum $curriculum): bool
    {
        if ($user->role !== UserRole::ProgramChair) {
            return false;
        }

        return $user->college !== null && $curriculum->program->college === $user->college;
    }

    public function approveAsDean(User $user): bool
    {
        return $user->role === UserRole::Dean;
    }

    public function approveAsExecutive(User $user): bool
    {
        return $user->role === UserRole::ExecutiveDirector;
    }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `php artisan test tests/Feature/Policies/CurriculumPolicyTest.php`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/Domain/Audit/AuditAction.php backend/app/Policies/CurriculumPolicy.php backend/tests/Feature/Policies/CurriculumPolicyTest.php
git commit -m "feat(curriculum): add submit/approveAsDean/approveAsExecutive Policy abilities"
```

---

## Task 8: `TransitionCurriculum` action, `CurriculumController::transition`, route, and endpoint test

This is the core of the feature. No dedicated unit test for `TransitionCurriculum` — like `TransitionScheduleProposal`, it's exercised entirely through the HTTP endpoint test, which is more valuable here since it also proves routing, Policy wiring, and validation together.

**Files:**
- Create: `backend/app/Actions/Curriculum/TransitionCurriculum.php`
- Modify: `backend/app/Http/Controllers/Api/V1/CurriculumController.php`
- Modify: `backend/routes/api.php`
- Create: `backend/tests/Feature/Api/V1/CurriculumTransitionEndpointTest.php`

**Interfaces:**
- Consumes: `CurriculumTransitionRules` (Task 4), `NotifyCurriculumTransition` (Task 6), `CurriculumPolicy` (Task 7), existing `AuditRecorder`, `CurriculumAuditSnapshot`.
- Produces: `PATCH /api/v1/curricula/{curriculum}/transition` — consumed by frontend Tasks 12 and 14.

**Post-Task-8 correction:** the test code below chains `withToken($chairToken)` → `withToken($deanToken)` → `withToken($executiveToken)` for *different* users within single test methods (`test_dean_approves_a_submission...`, `test_dean_return_requires_a_reason...`, `test_executive_approves_and_activates...`). This trips a previously-documented Sanctum guard-caching bug in this exact codebase (see the `schedule-api-layer-completion-slice` memory and `ScheduleProposalsEndpointTest`'s existing convention): the guard resolves and caches the *first* authenticated user for the rest of the test method, so the second/third `withToken()` call doesn't actually switch actors. Task 8's implementer restructured these three methods to one authenticated actor per method, building the "already submitted" precondition directly via Eloquent instead of a prior live HTTP call as a different user — see the actual committed test file for the corrected shape rather than copying the bodies below verbatim.

- [ ] **Step 1: Write the failing endpoint test**

Create `backend/tests/Feature/Api/V1/CurriculumTransitionEndpointTest.php`:

```php
<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Notifications\NotificationType;
use App\Domain\Organization\CollegeCode;
use App\Domain\Organization\ProgramStatus;
use App\Models\AuditLog;
use App\Models\Curriculum;
use App\Models\Notification;
use App\Models\Program;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class CurriculumTransitionEndpointTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    private function tokenFor(UserRole $role, string $email, ?CollegeCode $college = null): string
    {
        User::create([
            'name' => 'Test '.$role->value,
            'email' => $email,
            'password' => self::PASSWORD,
            'role' => $role,
            'college' => $college,
            'status' => UserStatus::Active,
        ]);

        return (string) $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => self::PASSWORD,
        ])->json('data.token');
    }

    private function makeCurriculum(CurriculumStatus $status): Curriculum
    {
        $program = Program::create(['code' => 'BSCS', 'name' => 'BS Computer Science', 'college' => CollegeCode::Ccs, 'status' => ProgramStatus::Active]);

        return Curriculum::create([
            'program_id' => $program->id,
            'name' => 'BSCS Curriculum 2026-2027',
            'effective_school_year' => '2026-2027',
            'status' => $status,
        ]);
    }

    public function test_anonymous_request_is_unauthenticated(): void
    {
        $curriculum = $this->makeCurriculum(CurriculumStatus::Draft);

        $this->patchJson("/api/v1/curricula/{$curriculum->id}/transition", ['action' => 'submit'])
            ->assertUnauthorized();
    }

    public function test_chair_submits_a_draft_for_dean_review_and_every_dean_is_notified(): void
    {
        $chairToken = $this->tokenFor(UserRole::ProgramChair, 'chair@grc.test', CollegeCode::Ccs);
        $deanToken = $this->tokenFor(UserRole::Dean, 'dean1@grc.test');
        $this->tokenFor(UserRole::Dean, 'dean2@grc.test');
        $curriculum = $this->makeCurriculum(CurriculumStatus::Draft);

        $response = $this->withToken($chairToken)->patchJson("/api/v1/curricula/{$curriculum->id}/transition", ['action' => 'submit']);

        $response->assertOk();
        self::assertSame('pending_dean_review', $response->json('data.status'));
        $curriculum->refresh();
        self::assertSame('pending_dean_review', $curriculum->status->value);
        self::assertNotNull($curriculum->decided_at);

        self::assertSame(2, Notification::query()->where('type', NotificationType::CurriculumSubmittedForDean->value)->count());
        self::assertSame(
            1,
            AuditLog::query()->where('action', 'curriculum.submitted')->where('auditable_id', $curriculum->id)->count(),
        );

        // Confirms the deanToken variable is a real, usable credential for the
        // next test's shape (kept unused here beyond this assertion so this
        // test stays focused on submission only).
        self::assertNotSame('', $deanToken);
    }

    public function test_submit_is_rejected_when_the_curriculum_is_not_a_draft(): void
    {
        $chairToken = $this->tokenFor(UserRole::ProgramChair, 'chair@grc.test', CollegeCode::Ccs);
        $curriculum = $this->makeCurriculum(CurriculumStatus::PendingDeanReview);

        $this->withToken($chairToken)
            ->patchJson("/api/v1/curricula/{$curriculum->id}/transition", ['action' => 'submit'])
            ->assertUnprocessable();
    }

    public function test_dean_approves_a_submission_and_every_executive_director_is_notified(): void
    {
        $chairToken = $this->tokenFor(UserRole::ProgramChair, 'chair@grc.test', CollegeCode::Ccs);
        $deanToken = $this->tokenFor(UserRole::Dean, 'dean@grc.test');
        $this->tokenFor(UserRole::ExecutiveDirector, 'exec@grc.test');
        $curriculum = $this->makeCurriculum(CurriculumStatus::Draft);
        $this->withToken($chairToken)->patchJson("/api/v1/curricula/{$curriculum->id}/transition", ['action' => 'submit']);

        $response = $this->withToken($deanToken)->patchJson("/api/v1/curricula/{$curriculum->id}/transition", ['action' => 'dean_approve']);

        $response->assertOk();
        self::assertSame('pending_executive_review', $response->json('data.status'));
        // CurriculumTransitionNotificationPlan::forAction('dean_approve', ...) emits two
        // rows sharing this one NotificationType (submitter + every active Executive
        // Director) — not one. (Corrected post-Task-8: the plan originally asserted 1
        // here, an error caught by Task 8's implementer via direct verification.)
        self::assertSame(2, Notification::query()->where('type', NotificationType::CurriculumDeanApproved->value)->count());
    }

    public function test_dean_return_requires_a_reason_and_sends_the_curriculum_back_to_draft(): void
    {
        $chairToken = $this->tokenFor(UserRole::ProgramChair, 'chair@grc.test', CollegeCode::Ccs);
        $deanToken = $this->tokenFor(UserRole::Dean, 'dean@grc.test');
        $curriculum = $this->makeCurriculum(CurriculumStatus::Draft);
        $this->withToken($chairToken)->patchJson("/api/v1/curricula/{$curriculum->id}/transition", ['action' => 'submit']);

        $this->withToken($deanToken)
            ->patchJson("/api/v1/curricula/{$curriculum->id}/transition", ['action' => 'dean_return'])
            ->assertUnprocessable();

        $response = $this->withToken($deanToken)->patchJson("/api/v1/curricula/{$curriculum->id}/transition", [
            'action' => 'dean_return',
            'reason' => 'Missing PATHFIT 2.',
        ]);

        $response->assertOk();
        self::assertSame('draft', $response->json('data.status'));
        $curriculum->refresh();
        self::assertSame('Missing PATHFIT 2.', $curriculum->last_decision_reason);
    }

    public function test_executive_approves_and_activates_the_curriculum(): void
    {
        $chairToken = $this->tokenFor(UserRole::ProgramChair, 'chair@grc.test', CollegeCode::Ccs);
        $deanToken = $this->tokenFor(UserRole::Dean, 'dean@grc.test');
        $executiveToken = $this->tokenFor(UserRole::ExecutiveDirector, 'exec@grc.test');
        $curriculum = $this->makeCurriculum(CurriculumStatus::Draft);
        $this->withToken($chairToken)->patchJson("/api/v1/curricula/{$curriculum->id}/transition", ['action' => 'submit']);
        $this->withToken($deanToken)->patchJson("/api/v1/curricula/{$curriculum->id}/transition", ['action' => 'dean_approve']);

        $response = $this->withToken($executiveToken)->patchJson("/api/v1/curricula/{$curriculum->id}/transition", ['action' => 'executive_approve']);

        $response->assertOk();
        self::assertSame('active', $response->json('data.status'));
    }

    public function test_a_dean_cannot_perform_an_executive_action(): void
    {
        $deanToken = $this->tokenFor(UserRole::Dean, 'dean@grc.test');
        $curriculum = $this->makeCurriculum(CurriculumStatus::PendingExecutiveReview);

        $this->withToken($deanToken)
            ->patchJson("/api/v1/curricula/{$curriculum->id}/transition", ['action' => 'executive_approve'])
            ->assertForbidden();
    }

    public function test_a_program_chair_from_a_different_college_cannot_submit_someone_elses_curriculum(): void
    {
        // makeCurriculum() builds its Program with CollegeCode::Ccs — a
        // chair whose own college is Cba must be rejected, unlike
        // approveAsDean/approveAsExecutive which are role-only (see
        // CurriculumPolicy::submit()'s docblock).
        $chairToken = $this->tokenFor(UserRole::ProgramChair, 'other-chair@grc.test', CollegeCode::Cba);
        $curriculum = $this->makeCurriculum(CurriculumStatus::Draft);

        $this->withToken($chairToken)
            ->patchJson("/api/v1/curricula/{$curriculum->id}/transition", ['action' => 'submit'])
            ->assertForbidden();
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run (from `backend/`): `php artisan test tests/Feature/Api/V1/CurriculumTransitionEndpointTest.php`
Expected: FAIL — 404s (route doesn't exist yet).

- [ ] **Step 3: Write `TransitionCurriculum`**

Create `backend/app/Actions/Curriculum/TransitionCurriculum.php`:

```php
<?php

namespace App\Actions\Curriculum;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Curriculum\CurriculumTransitionRules;
use App\Domain\Identity\UserRole;
use App\Models\Curriculum;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use App\Support\Audit\CurriculumAuditSnapshot;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Applies one transition in the curriculum approval chain
 * (Draft -> PendingDeanReview -> PendingExecutiveReview -> Active, with a
 * required-reason return to Draft at either checkpoint — see
 * `CurriculumTransitionRules`) and records who decided it and when.
 * Mirrors `App\Actions\Scheduling\TransitionScheduleProposal`'s shape.
 */
final class TransitionCurriculum
{
    /**
     * @var array<string, string>
     */
    private const AUDIT_ACTION = [
        'submit' => AuditAction::CURRICULUM_SUBMITTED,
        'dean_approve' => AuditAction::CURRICULUM_DEAN_APPROVED,
        'dean_return' => AuditAction::CURRICULUM_DEAN_RETURNED,
        'executive_approve' => AuditAction::CURRICULUM_EXECUTIVE_APPROVED,
        'executive_return' => AuditAction::CURRICULUM_EXECUTIVE_RETURNED,
    ];

    public function __construct(
        private readonly AuditRecorder $auditRecorder,
        private readonly CurriculumAuditSnapshot $snapshot,
        private readonly NotifyCurriculumTransition $notifyCurriculumTransition,
    ) {}

    public function execute(
        Curriculum $curriculum,
        string $action,
        User $actingUser,
        ?string $reason,
        AuditRequestContext $context,
    ): Curriculum {
        CurriculumTransitionRules::requiredStatus($action);

        if (
            CurriculumTransitionRules::isReturn($action)
            && ($reason === null || trim($reason) === '')
        ) {
            throw ValidationException::withMessages([
                'reason' => 'A reason is required when returning a curriculum to draft.',
            ]);
        }

        return DB::transaction(function () use ($curriculum, $action, $actingUser, $reason, $context): Curriculum {
            $lockedCurriculum = Curriculum::query()
                ->whereKey($curriculum->id)
                ->lockForUpdate()
                ->firstOrFail();
            $requiredStatus = CurriculumTransitionRules::requiredStatus($action);

            if ($lockedCurriculum->status !== $requiredStatus) {
                throw ValidationException::withMessages([
                    'action' => "This action requires the curriculum to currently be '{$requiredStatus->value}'; ".
                        "it is currently '{$lockedCurriculum->status->value}'.",
                ]);
            }

            $beforeValues = $this->snapshot->capture($lockedCurriculum);
            $isReturn = CurriculumTransitionRules::isReturn($action);
            $decisionReason = $isReturn ? $reason : null;
            // The submitter to notify on every later checkpoint is whoever
            // applied `submit` — capture it before this action's `decided_by`
            // overwrites the column, unless this call *is* the submit.
            $submitterId = $action === 'submit' ? $actingUser->id : $lockedCurriculum->decided_by;

            $lockedCurriculum->update([
                'status' => CurriculumTransitionRules::targetStatus($action),
                'decided_by' => $submitterId,
                'decided_at' => now(),
                'last_decision_reason' => $decisionReason ?? $lockedCurriculum->last_decision_reason,
            ]);
            $lockedCurriculum->refresh();

            $afterValues = $this->snapshot->capture($lockedCurriculum);

            $this->auditRecorder->record(
                $actingUser,
                self::AUDIT_ACTION[$action],
                AuditableType::CURRICULUM,
                $lockedCurriculum->id,
                $beforeValues,
                $afterValues,
                $decisionReason,
                $context,
            );

            match ($action) {
                'submit' => $this->notifyCurriculumTransition->submittedForDean($lockedCurriculum),
                'dean_approve' => $this->notifyCurriculumTransition->deanApproved($lockedCurriculum),
                'executive_approve' => $this->notifyCurriculumTransition->executiveApproved($lockedCurriculum),
                'dean_return' => $this->notifyCurriculumTransition->returned($lockedCurriculum, UserRole::Dean, (string) $decisionReason),
                'executive_return' => $this->notifyCurriculumTransition->returned($lockedCurriculum, UserRole::ExecutiveDirector, (string) $decisionReason),
                default => null,
            };

            return $lockedCurriculum->load(['subjectPlacements.subject', 'subjectPlacements.prerequisites.prerequisiteSubject']);
        });
    }
}
```

**Design note:** `decided_by` is overloaded to mean "the submitter" for notification-routing purposes (see Task 6's note) rather than "whoever most recently decided" — this keeps `NotifyCurriculumTransition::submitterIds()` simple (one column, no join). If a later requirement needs to show *who last decided* (e.g. "returned by Dean Santos") separately from *who submitted*, that's a new column, not a reinterpretation of this one — don't repurpose `decided_by` for that without adding a second column, or every already-written notification/audit call site here breaks its assumption silently.

- [ ] **Step 4: Wire `CurriculumController::transition` and the route**

In `backend/app/Http/Controllers/Api/V1/CurriculumController.php`, add the import `use App\Actions\Curriculum\TransitionCurriculum;` and `use Illuminate\Validation\Rule;`, then add this method (after `update()`, before the `authenticatedUser()` private method):

```php
    /**
     * Which Policy ability governs each transition action — one route
     * serves the Program Chair, Dean, and Executive Director instead of a
     * single `role:` middleware, matching ScheduleProposalController.
     *
     * @var array<string, string>
     */
    private const ABILITY_FOR_ACTION = [
        'submit' => 'submit',
        'dean_approve' => 'approveAsDean',
        'dean_return' => 'approveAsDean',
        'executive_approve' => 'approveAsExecutive',
        'executive_return' => 'approveAsExecutive',
    ];

    /**
     * @throws AuthenticationException
     */
    public function transition(
        Request $request,
        Curriculum $curriculum,
        TransitionCurriculum $action,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $user = $this->authenticatedUser($request);

        $validated = $request->validate([
            'action' => ['required', 'string', Rule::in(array_keys(self::ABILITY_FOR_ACTION))],
            'reason' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);

        $ability = self::ABILITY_FOR_ACTION[$validated['action']];
        $ability === 'submit'
            ? $this->authorize($ability, $curriculum)
            : $this->authorize($ability, Curriculum::class);

        $curriculum = $action->execute(
            $curriculum,
            $validated['action'],
            $user,
            $validated['reason'] ?? null,
            $contextFactory->fromRequest($request),
        );

        return $this->cachePrivateResponse(CurriculumResource::make($curriculum)->response($request));
    }
```

(`approveAsDean`/`approveAsExecutive` take only `User` per Task 7's Policy — call `$this->authorize($ability, Curriculum::class)` for those two, which Laravel resolves against the Policy method that doesn't type-hint a model instance. `submit` takes `(User, Curriculum)`, so it authorizes against the specific `$curriculum` instance.)

In `backend/routes/api.php`, add this route inside the general `auth:sanctum` group, directly after the existing `Route::get('/curricula', ...)` line (same group as `schedule-proposals.update`, not inside `role:program_chair`):

```php
        // Every transition (submit, dean_approve, dean_return,
        // executive_approve, executive_return) needs a *different* role, so
        // a single blanket `role:` middleware doesn't fit this one route —
        // CurriculumPolicy resolves the right ability per request, same
        // shape as schedule-proposals.update. See ADR 0011.
        Route::patch('/curricula/{curriculum}/transition', [CurriculumController::class, 'transition'])->name('curricula.transition');
```

- [ ] **Step 5: Run the endpoint test to verify it passes**

Run (from `backend/`): `php artisan test tests/Feature/Api/V1/CurriculumTransitionEndpointTest.php`
Expected: PASS (all 8 tests).

- [ ] **Step 6: Run the full curriculum-adjacent backend test suite to check for regressions**

Run: `php artisan test tests/Feature/Policies/CurriculumPolicyTest.php tests/Feature/Actions/Curriculum tests/Unit/Domain/Curriculum tests/Feature/Api/V1/CurriculumTransitionEndpointTest.php`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/Actions/Curriculum/TransitionCurriculum.php backend/app/Http/Controllers/Api/V1/CurriculumController.php backend/routes/api.php backend/tests/Feature/Api/V1/CurriculumTransitionEndpointTest.php
git commit -m "feat(curriculum): add the submit/dean/executive transition endpoint"
```

---

## Task 9: Remove `status` from create/update; lock edits outside Draft

**Files:**
- Modify: `backend/app/Http/Requests/Api/V1/Curriculum/StoreCurriculumRequest.php`
- Modify: `backend/app/Http/Requests/Api/V1/Curriculum/UpdateCurriculumRequest.php`
- Modify: `backend/app/Actions/Curriculum/CreateCurriculum.php`
- Modify: `backend/app/Actions/Curriculum/UpdateCurriculum.php`
- Modify: `backend/app/Http/Controllers/Api/V1/CurriculumController.php`
- Test: Create `backend/tests/Feature/Api/V1/CurriculumEndpointLockTest.php`

**Interfaces:**
- Consumes: `CurriculumStatus::Draft` (Task 1).
- Produces: `CreateCurriculum::execute()` no longer takes `status` in `$validatedData`; `UpdateCurriculum::execute()` throws `ValidationException` (422, `status` field) when `$curriculum->status !== Draft`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/Feature/Api/V1/CurriculumEndpointLockTest.php`:

```php
<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\CollegeCode;
use App\Domain\Organization\ProgramStatus;
use App\Models\Curriculum;
use App\Models\Program;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class CurriculumEndpointLockTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    private function chairToken(): string
    {
        User::create([
            'name' => 'Test program_chair',
            'email' => 'chair@grc.test',
            'password' => self::PASSWORD,
            'role' => UserRole::ProgramChair,
            'college' => CollegeCode::Ccs,
            'status' => UserStatus::Active,
        ]);

        return (string) $this->postJson('/api/v1/auth/login', [
            'email' => 'chair@grc.test',
            'password' => self::PASSWORD,
        ])->json('data.token');
    }

    private function makeProgram(): Program
    {
        return Program::create(['code' => 'BSCS', 'name' => 'BS Computer Science', 'college' => CollegeCode::Ccs, 'status' => ProgramStatus::Active]);
    }

    public function test_a_created_curriculum_always_starts_as_draft_even_if_status_is_sent(): void
    {
        $token = $this->chairToken();
        $program = $this->makeProgram();

        $response = $this->withToken($token)->postJson('/api/v1/curricula', [
            'program_id' => $program->id,
            'name' => 'BSCS Curriculum 2026-2027',
            'effective_school_year' => '2026-2027',
            'status' => 'active',
            'subjects' => [],
        ]);

        $response->assertCreated();
        self::assertSame('draft', $response->json('data.status'));
    }

    public function test_update_is_rejected_once_the_curriculum_has_left_draft(): void
    {
        $token = $this->chairToken();
        $program = $this->makeProgram();
        $curriculum = Curriculum::create([
            'program_id' => $program->id,
            'name' => 'BSCS Curriculum 2026-2027',
            'effective_school_year' => '2026-2027',
            'status' => CurriculumStatus::PendingDeanReview,
        ]);

        $response = $this->withToken($token)->patchJson("/api/v1/curricula/{$curriculum->id}", [
            'name' => 'BSCS Curriculum 2026-2027 (edited)',
            'effective_school_year' => '2026-2027',
            'subjects' => [],
        ]);

        $response->assertUnprocessable();
        $curriculum->refresh();
        self::assertSame('BSCS Curriculum 2026-2027', $curriculum->name);
    }

    public function test_update_still_succeeds_while_the_curriculum_is_draft(): void
    {
        $token = $this->chairToken();
        $program = $this->makeProgram();
        $curriculum = Curriculum::create([
            'program_id' => $program->id,
            'name' => 'BSCS Curriculum 2026-2027',
            'effective_school_year' => '2026-2027',
            'status' => CurriculumStatus::Draft,
        ]);

        $response = $this->withToken($token)->patchJson("/api/v1/curricula/{$curriculum->id}", [
            'name' => 'BSCS Curriculum 2026-2027 (edited)',
            'effective_school_year' => '2026-2027',
            'subjects' => [],
        ]);

        $response->assertOk();
        self::assertSame('BSCS Curriculum 2026-2027 (edited)', $response->json('data.name'));
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run (from `backend/`): `php artisan test tests/Feature/Api/V1/CurriculumEndpointLockTest.php`
Expected: FAIL — creating still needs `status` to validate (currently `required`) and the 422-when-not-Draft check doesn't exist yet.

- [ ] **Step 3: Drop `status` from both FormRequests**

In `backend/app/Http/Requests/Api/V1/Curriculum/StoreCurriculumRequest.php`, remove the line `'status' => ['required', Rule::enum(CurriculumStatus::class)],` from `rules()`, and remove the now-unused `use App\Domain\Curriculum\CurriculumStatus;` and `use Illuminate\Validation\Rule;` imports if nothing else in the file uses them (check with `grep -n "Rule::\|CurriculumStatus::" backend/app/Http/Requests/Api/V1/Curriculum/StoreCurriculumRequest.php` — if only that one line used them, remove both `use` statements).

Do the exact same in `backend/app/Http/Requests/Api/V1/Curriculum/UpdateCurriculumRequest.php`.

- [ ] **Step 4: Update `CreateCurriculum` to always create at Draft**

In `backend/app/Actions/Curriculum/CreateCurriculum.php`:

Change the docblock parameter type from `array{program_id: int, name: string, effective_school_year: string, status: string}` to `array{program_id: int, name: string, effective_school_year: string}`, add `use App\Domain\Curriculum\CurriculumStatus;` to the imports, and change:

```php
            $curriculum = Curriculum::create([
                'program_id' => $validatedData['program_id'],
                'name' => $validatedData['name'],
                'effective_school_year' => $validatedData['effective_school_year'],
                'status' => $validatedData['status'],
            ]);
```

to:

```php
            $curriculum = Curriculum::create([
                'program_id' => $validatedData['program_id'],
                'name' => $validatedData['name'],
                'effective_school_year' => $validatedData['effective_school_year'],
                'status' => CurriculumStatus::Draft,
            ]);
```

- [ ] **Step 5: Update `UpdateCurriculum` to drop `status` and reject non-Draft edits**

In `backend/app/Actions/Curriculum/UpdateCurriculum.php`, add `use App\Domain\Curriculum\CurriculumStatus;` and `use Illuminate\Validation\ValidationException;` to the imports. Change the docblock parameter type from `array{name: string, effective_school_year: string, status: string}` to `array{name: string, effective_school_year: string}`. Change:

```php
        return DB::transaction(function () use ($actor, $validatedData, $subjects, $curriculum, $context): Curriculum {
            $beforeValues = $this->snapshot->capture($curriculum);

            $curriculum->update([
                'name' => $validatedData['name'],
                'effective_school_year' => $validatedData['effective_school_year'],
                'status' => $validatedData['status'],
            ]);
```

to:

```php
        return DB::transaction(function () use ($actor, $validatedData, $subjects, $curriculum, $context): Curriculum {
            if ($curriculum->status !== CurriculumStatus::Draft) {
                throw ValidationException::withMessages([
                    'status' => 'Only a Draft curriculum can be edited.',
                ]);
            }

            $beforeValues = $this->snapshot->capture($curriculum);

            $curriculum->update([
                'name' => $validatedData['name'],
                'effective_school_year' => $validatedData['effective_school_year'],
            ]);
```

- [ ] **Step 6: Stop `CurriculumController` from passing `status` through**

In `backend/app/Http/Controllers/Api/V1/CurriculumController.php`, in `store()`, remove the `'status' => $request->validated('status'),` line from the array passed to `$action->execute(...)`. Do the same in `update()`.

- [ ] **Step 7: Run the new tests, then the full curriculum test suite**

Run (from `backend/`):
```
php artisan test tests/Feature/Api/V1/CurriculumEndpointLockTest.php
php artisan test tests/Feature/Actions/Curriculum tests/Feature/Api/V1/CurriculumTransitionEndpointTest.php tests/Feature/Policies/CurriculumPolicyTest.php tests/Feature/Database/CurriculumCatalogMigrationTest.php
```
Expected: PASS across all. If `CurriculumAuditTest.php` (under `tests/Feature/Actions/Curriculum`) fails because it sends `status` in its own request payloads, update those payloads there to drop `status` too (its existing assertions about `name`/`effective_school_year`/`subjects` stay valid — only the request body shape changes).

- [ ] **Step 8: Commit**

```bash
git add backend/app/Http/Requests/Api/V1/Curriculum backend/app/Actions/Curriculum/CreateCurriculum.php backend/app/Actions/Curriculum/UpdateCurriculum.php backend/app/Http/Controllers/Api/V1/CurriculumController.php backend/tests/Feature/Api/V1/CurriculumEndpointLockTest.php backend/tests/Feature/Actions/Curriculum
git commit -m "feat(curriculum): drop chair-settable status; lock edits outside Draft"
```

---

## Task 10: `CurriculumResource` exposes the decision fields

**Files:**
- Modify: `backend/app/Http/Resources/Api/V1/CurriculumResource.php`

**Interfaces:**
- Produces: `CurriculumResource`'s `toArray()` gains `decided_at: ?string` and `last_decision_reason: ?string` — consumed by frontend Task 12.

- [ ] **Step 1: Add the two fields**

In `backend/app/Http/Resources/Api/V1/CurriculumResource.php`, update the return-type docblock to add `decided_at: ?string, last_decision_reason: ?string,` after `status_label: string,`, and update `toArray()`:

```php
    public function toArray(Request $request): array
    {
        return [
            'type' => 'curriculum',
            'id' => $this->resource->id,
            'program_id' => $this->resource->program_id,
            'name' => $this->resource->name,
            'effective_school_year' => $this->resource->effective_school_year,
            'status' => $this->resource->status->value,
            'status_label' => $this->resource->status->label(),
            'decided_at' => $this->resource->decided_at?->toIso8601String(),
            'last_decision_reason' => $this->resource->last_decision_reason,
            'subjects' => array_values($this->resource->subjectPlacements
                ->map(fn (CurriculumSubject $placement): array => $this->placementToArray($placement))
                ->all()),
        ];
    }
```

- [ ] **Step 2: Verify against the existing endpoint tests (they already assert on `data.status`; this step only widens the payload, so nothing should break)**

Run (from `backend/`): `php artisan test tests/Feature/Api/V1/CurriculumTransitionEndpointTest.php tests/Feature/Api/V1/CurriculumEndpointLockTest.php`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/app/Http/Resources/Api/V1/CurriculumResource.php
git commit -m "feat(curriculum): expose decided_at/last_decision_reason on CurriculumResource"
```

---

## Task 11: Frontend — schema and service updates

**Files:**
- Modify: `frontend/src/features/schemas/reference-data-schema.ts`
- Modify: `frontend/src/features/schemas/curriculum-schema.ts`
- Modify: `frontend/src/features/services/curriculum-service.ts`
- Test: Create `frontend/src/features/services/curriculum-service.test.ts` (only if no test file for this service already exists — check with `ls frontend/src/features/services/curriculum-service.test.ts` first; if one exists, add to it instead of creating a new one)

**Interfaces:**
- Consumes: backend Task 10's response shape.
- Produces: `Curriculum["status"]` now includes `"pending_dean_review" | "pending_executive_review"`; `Curriculum["decided_at"]: string | null`, `Curriculum["last_decision_reason"]: string | null`; `curriculumReplacementSchema`/`storeCurriculumInputSchema` no longer have a `status` field; `curriculumTransitionSchema`, `transitionCurriculum(id, {action, reason?})` — consumed by Task 12 and Task 14.

- [ ] **Step 1: Update `curriculumSchema` in `reference-data-schema.ts`**

In `frontend/src/features/schemas/reference-data-schema.ts`, change:

```ts
export const curriculumSchema = z
  .object({
    type: z.literal("curriculum"),
    id: z.number().int().positive(),
    program_id: z.number().int().positive(),
    name: z.string().min(1),
    effective_school_year: z.string().min(1),
    status: z.enum(["draft", "active", "archived"]),
    status_label: z.string().min(1),
    subjects: z.array(curriculumSubjectSchema),
  })
  .strict()
```

to:

```ts
export const curriculumSchema = z
  .object({
    type: z.literal("curriculum"),
    id: z.number().int().positive(),
    program_id: z.number().int().positive(),
    name: z.string().min(1),
    effective_school_year: z.string().min(1),
    status: z.enum([
      "draft",
      "pending_dean_review",
      "pending_executive_review",
      "active",
      "archived",
    ]),
    status_label: z.string().min(1),
    decided_at: z.string().nullable(),
    last_decision_reason: z.string().nullable(),
    subjects: z.array(curriculumSubjectSchema),
  })
  .strict()
```

- [ ] **Step 2: Remove `status` from the input schemas in `curriculum-schema.ts`**

In `frontend/src/features/schemas/curriculum-schema.ts`, remove `status: z.enum(["draft", "active", "archived"]),` from the `replacementShape` object. Then update `curriculumReplacementSchema`'s `superRefine` call and `storeCurriculumInputSchema`'s `superRefine` call — both currently pass `status: value.status` into the nested `curriculumReplacementSchema.safeParse({...})`/build; since `status` no longer exists on `value`, remove that key from both object literals (find `status: value.status,` — there's exactly one occurrence, inside `storeCurriculumInputSchema`'s `superRefine`; remove that line).

Also add, at the bottom of the file, a new schema and type for the transition request:

```ts
export const curriculumTransitionSchema = z
  .object({
    action: z.enum([
      "submit",
      "dean_approve",
      "dean_return",
      "executive_approve",
      "executive_return",
    ]),
    reason: z.string().trim().min(1).optional(),
  })
  .strict()

export type CurriculumTransition = z.infer<typeof curriculumTransitionSchema>
export type CurriculumAction = CurriculumTransition["action"]
```

Update `CurriculumEditorValues`'s `status` field type from `"draft" | "active" | "archived"` to the full five-value union (`"draft" | "pending_dean_review" | "pending_executive_review" | "active" | "archived"`), since it's populated straight from a loaded `Curriculum` (Task 12 needs to read a curriculum's real current status, including the two new pending ones, to decide whether to lock the form).

- [ ] **Step 3: Add `transitionCurriculum()` to `curriculum-service.ts`**

In `frontend/src/features/services/curriculum-service.ts`, add the import `curriculumTransitionSchema` and `type CurriculumTransition` to the existing `from "@/features/schemas/curriculum-schema"` import, then add this function after `replaceCurriculum`:

```ts
export async function transitionCurriculum(
  id: number,
  transition: CurriculumTransition,
): Promise<Curriculum> {
  const payload = await patchAuthenticatedJson(
    `${CURRICULA_PATH}/${id}/transition`,
    parse(curriculumTransitionSchema, transition, "curriculum transition request"),
  )
  return parse(zEnvelope, payload, "transitioned curriculum").data
}
```

- [ ] **Step 4: Run the frontend type-check and existing curriculum tests**

Run (from `frontend/`):
```
npx tsc --noEmit -p tsconfig.json
```
Expected: errors in `curriculum-workspace.tsx` (its Status `<Select>` still references `form.register`/`Controller` for a `status` field that no longer exists on the schema type, and its Manage-tab JSX for the Status dropdown references it) — **this is expected**; Task 12 fixes them. Do not fix them here.

Run: `npx vitest run src/features/schemas`
Expected: PASS (no test files directly target these schema files yet, so this may report "no tests found" — that's fine, this step is really just confirming the schema files themselves have no syntax errors, which `tsc` already covers).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/schemas/reference-data-schema.ts frontend/src/features/schemas/curriculum-schema.ts frontend/src/features/services/curriculum-service.ts
git commit -m "feat(curriculum): add pending-review statuses and transitionCurriculum() to the frontend contract"
```

(Committing here even though `tsc` reports errors in `curriculum-workspace.tsx` is intentional and matches this plan's task boundaries — Task 12 is the very next task and fixes them immediately. If you'd rather keep every commit green, squash Tasks 11 and 12 into one commit instead; either is fine.)

---

## Task 12: Frontend — lock the Manage tab outside Draft, remove Status, add Submit

**Files:**
- Modify: `frontend/src/features/components/portal/curriculum-workspace.tsx`
- Modify: `frontend/src/features/components/portal/curriculum-workspace.test.tsx`

**Interfaces:**
- Consumes: `transitionCurriculum` (Task 11), `CurriculumStatus` values from `Curriculum["status"]`.
- Produces: no new exports — this is a leaf UI change.

- [ ] **Step 1: Read the current full file to confirm line numbers before editing**

Run: `grep -n "curriculum-status\|Status\|saveState\|const mutation\|selectedCurriculum\b" frontend/src/features/components/portal/curriculum-workspace.tsx`

(Line numbers shift slightly between sessions if other tasks touched the file — use this grep's output to locate the exact blocks below rather than trusting hardcoded line numbers.)

- [ ] **Step 2: Add a `selectedCurriculum` lookup and `isLocked` flag**

Near the top of `CurriculumWorkspace()`, right after the existing `edit()` function or near `const catalog = ...`, add:

```ts
  const selectedCurriculum = (curriculaQuery.data ?? []).find(
    (item) => item.id === selectedId,
  )
  const isLocked = selectedId > 0 && selectedCurriculum?.status !== "draft"
```

- [ ] **Step 3: Remove the Status `<Field>` block, replace with a read-only badge + return-reason alert**

Find and delete this whole block:

```tsx
                <Field>
                  <FieldLabel htmlFor="curriculum-status">Status</FieldLabel>
                  <Controller
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          id="curriculum-status"
                          className="w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
```

Replace it with:

```tsx
                {selectedCurriculum && (
                  <Field>
                    <FieldLabel>Status</FieldLabel>
                    <div>
                      <Badge variant={isLocked ? "secondary" : "outline"}>
                        {selectedCurriculum.status_label}
                      </Badge>
                    </div>
                  </Field>
                )}
                {selectedCurriculum?.last_decision_reason &&
                  selectedCurriculum.status === "draft" && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        Returned: {selectedCurriculum.last_decision_reason}
                      </AlertDescription>
                    </Alert>
                  )}
```

(`status` is no longer a form field — remove `status: "draft"` from the `fresh` constant near the top of the file too, and remove `status: curriculum.status,` from `edit()`'s `applyValues({...})` call, since `CurriculumEditorValues`no longer needs it echoed back into the form; if `tsc` still complains that `applyValues`'s argument is missing a required `status` key, that means Task 11's `CurriculumEditorValues` interface still declares `status` as required — go back and remove the `status` line from that interface too, since it's no longer part of what the form itself edits.)

- [ ] **Step 4: Disable every editing control while `isLocked`**

Every interactive element inside the Manage tab that mutates the curriculum needs a `disabled={isLocked}` (or, for the `SearchableCombobox`/`Select`s that don't take `disabled` directly, wrap their `onValueChange` to no-op when locked). Concretely, add `disabled={isLocked}` to:
- the Program `<Select>` (it already has `disabled={selectedId > 0}` — change to `disabled={selectedId > 0 || isLocked}`)
- the `curriculum-name` `<Input>` — add `disabled={isLocked}`
- the `effective-school-year` `<Input>` — add `disabled={isLocked}`
- the "Subject to place" `<Select>` and "Add subject placement" `<Button>` — add `disabled={isLocked}` to both
- the "Prerequisite graph" `<Button>` — add `disabled={isLocked}`
- every per-row remove/edit control inside the placement table (the `<Select>`s for semester/is_required, the prerequisite add/remove `<Button>`s, and any per-row delete button) — add `disabled={isLocked}` to each

Also guard the autosave `useEffect` so it never fires while locked — change its early-return line from:

```ts
    if (!isDirty || isPending) return
```

to:

```ts
    if (!isDirty || isPending || isLocked) return
```

- [ ] **Step 5: Add the Submit button and confirmation dialog**

Add state near the other `useState` calls:

```ts
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const transitionMutation = useMutation({
    mutationFn: (action: "submit") =>
      transitionCurriculum(selectedId, { action }),
    onSuccess: async (updated) => {
      await invalidate()
      applyValues({
        program_id: updated.program_id,
        name: updated.name,
        effective_school_year: updated.effective_school_year,
        subjects: updated.subjects.map(
          ({ subject_id, year_level, semester, is_required, prerequisites }) => ({
            subject_id,
            year_level,
            semester,
            is_required,
            prerequisites: prerequisites.map(
              ({ prerequisite_subject_id, minimum_grade }) => ({
                prerequisite_subject_id,
                minimum_grade,
              }),
            ),
          }),
        ),
      })
      setSubmitDialogOpen(false)
    },
  })
```

Add the import `import { transitionCurriculum } from "@/features/services/curriculum-service"` (merge into the existing `from "@/features/services/curriculum-service"` import line alongside `createCurriculum, replaceCurriculum, toCurriculumReplacement`).

At the end of the `TabsContent value="manage"` block (right before its closing `</TabsContent>`), add:

```tsx
              {selectedCurriculum?.status === "draft" && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => setSubmitDialogOpen(true)}
                    disabled={formSubjects.length === 0}
                  >
                    Submit for Dean Review
                  </Button>
                </div>
              )}
              <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Review before submitting</DialogTitle>
                    <DialogDescription>
                      Every subject below will be sent to the Dean for
                      review. You will not be able to edit this curriculum
                      again until it is approved or returned.
                    </DialogDescription>
                  </DialogHeader>
                  {programsQuery.data && (
                    <CurriculumView
                      programs={programsQuery.data.filter(
                        (program) => program.id === watchedValues.program_id,
                      )}
                      curricula={
                        selectedCurriculum ? [selectedCurriculum] : []
                      }
                    />
                  )}
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSubmitDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={transitionMutation.isPending}
                      onClick={() => transitionMutation.mutate("submit")}
                    >
                      Confirm & Submit
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
```

Add `DialogFooter` to the existing `from "@/features/components/ui/dialog"` import line.

- [ ] **Step 6: Update the existing test file for the removed Status field and new lock/submit behavior**

This file's real helpers/fixtures (confirmed by reading it) are: `renderWorkspace()` (renders `<CurriculumWorkspace />` with a `program_chair` session), `mockApi(onWrite?)` (returns a `fetch` implementation — GET `/programs`/`/subjects`/`/curricula` are canned, everything else routes to `onWrite`), `selectOption(user, labelText, optionName)`, a module-level `fetchMock`, and a `curriculum.data` fixture array (`id: 9` "BSCS 2026" is `draft` with one subject placed; `id: 10` "BSCS 2027" is `draft` with none; `id: 12` "BSCS 2029" is `draft` with all four years placed).

In `frontend/src/features/components/portal/curriculum-workspace.test.tsx`:

1. Search for `"Status"` and `curriculum-status` — remove or rewrite every test that selects/asserts on the old Status `<Select>` (it queried `screen.getByLabelText("Status")` and picked `"Draft"`/`"Active"`/`"Archived"` options; that control no longer exists). Replace any such assertion with `screen.getByText(<expected status label>)` instead, since status is now a read-only `Badge`.

2. Add a fourth curriculum to the `curriculum.data` fixture array (after the `id: 12` entry), already `pending_dean_review` with one subject placed:

```ts
    {
      type: "curriculum",
      id: 13,
      program_id: 1,
      name: "BSCS 2030",
      effective_school_year: "2030-2031",
      status: "pending_dean_review",
      status_label: "Pending Dean Review",
      decided_at: "2026-08-07T00:00:00Z",
      last_decision_reason: null,
      subjects: [
        {
          subject_id: 11,
          code: "CS101",
          title: "Programming 1",
          year_level: 1,
          semester: "1st",
          is_required: true,
          prerequisites: [],
        },
      ],
    },
```

Also add `decided_at: null, last_decision_reason: null,` to the existing three fixture entries (`id: 9`, `10`, `12`), since `curriculumSchema` (Task 11) now requires both fields on every curriculum object via `.strict()`.

3. Add these two tests inside the existing `describe("CurriculumWorkspace", () => { ... })` block, alongside the others (they use the file's real `renderWorkspace`/`mockApi`/`selectOption`/`fetchMock`):

```tsx
  it("locks every editing control once the curriculum is not a draft", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(mockApi())
    renderWorkspace()

    await selectOption(user, "Curriculum", "BSCS 2030")

    expect(await screen.findByText("Pending Dean Review")).toBeInTheDocument()
    expect(screen.getByLabelText("Curriculum name")).toBeDisabled()
    expect(
      screen.queryByRole("button", { name: "Submit for Dean Review" }),
    ).not.toBeInTheDocument()
  })

  it("opens a review dialog and submits a draft with at least one subject", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(
      mockApi((input) =>
        url(input).endsWith("/transition")
          ? new Response(
              JSON.stringify({
                data: { ...curriculum.data[0], status: "pending_dean_review", status_label: "Pending Dean Review" },
              }),
            )
          : new Response(JSON.stringify({ data: curriculum.data[0] })),
      ),
    )
    renderWorkspace()

    await selectOption(user, "Curriculum", "BSCS 2026")
    await user.click(screen.getByRole("button", { name: "Submit for Dean Review" }))

    expect(screen.getByText("Review before submitting")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Confirm & Submit" }))

    expect(await screen.findByText("Pending Dean Review")).toBeInTheDocument()
  })

  it("hides the Submit button for a draft with no subjects placed", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(mockApi())
    renderWorkspace()

    await selectOption(user, "Curriculum", "BSCS 2027")

    expect(
      screen.queryByRole("button", { name: "Submit for Dean Review" }),
    ).not.toBeInTheDocument()
  })
```

(`mockApi`'s `onWrite` callback already receives every non-GET request including the new `PATCH .../transition` call, so no change to `mockApi` itself is needed — only the `onWrite` callback passed in by the second test above needs to branch on the URL, as shown.)

- [ ] **Step 7: Run the test file**

Run (from `frontend/`): `npx vitest run src/features/components/portal/curriculum-workspace.test.tsx`
Expected: PASS. If the one known-flaky timeout test unrelated to this change fails in isolation too, rerun once — if it's still the *only* failure and it's the same test that was already flaky before this plan (`resets the form after confirming a selector switch to new`), that's pre-existing environment flakiness, not a regression; do not treat it as blocking.

- [ ] **Step 8: Type-check and run the curriculum-view test too (its props usage from the Submit dialog must still type-check)**

Run (from `frontend/`):
```
npx tsc --noEmit -p tsconfig.json
npx vitest run src/features/components/portal/curriculum-view.test.tsx
```
Expected: both clean.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/components/portal/curriculum-workspace.tsx frontend/src/features/components/portal/curriculum-workspace.test.tsx
git commit -m "feat(curriculum): remove Status dropdown, lock editing outside Draft, add Submit for Dean Review"
```

---

## Task 13: Frontend — `CurriculumApprovalsWorkspace` for Dean and Executive Director

**Files:**
- Create: `frontend/src/features/components/portal/curriculum-approvals-workspace.tsx`
- Create: `frontend/src/features/components/portal/curriculum-approvals-workspace.test.tsx`

**Interfaces:**
- Consumes: `useCurriculaQuery`, `useProgramsQuery`, `transitionCurriculum` (Task 11), `CurriculumView` (existing).
- Produces: `CurriculumApprovalsWorkspace(): JSX.Element` — consumed by Task 14.

- [ ] **Step 1: Read `schedule-decision-workspace.tsx` in full for the exact pattern being mirrored**

Run: `cat frontend/src/features/components/portal/schedule-decision-workspace.tsx`

- [ ] **Step 2: Write the failing test file**

Create `frontend/src/features/components/portal/curriculum-approvals-workspace.test.tsx`:

```tsx
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

import { CurriculumApprovalsWorkspace } from "@/features/components/portal/curriculum-approvals-workspace"
import { renderWithSession } from "@/tests/render-app"

const fetchMock = vi.fn<typeof fetch>()
beforeEach(() => vi.stubGlobal("fetch", fetchMock))
afterEach(() => vi.unstubAllGlobals())

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

const programs = [
  { type: "program", id: 1, code: "BSCS", name: "BS Computer Science", status: "active", status_label: "Active" },
]

function pendingCurriculum(status: string) {
  return {
    type: "curriculum",
    id: 1,
    program_id: 1,
    name: "BSCS Curriculum 2026-2027",
    effective_school_year: "2026-2027",
    status,
    status_label: status === "pending_dean_review" ? "Pending Dean Review" : "Pending Executive Review",
    decided_at: "2026-08-07T00:00:00Z",
    last_decision_reason: null,
    subjects: [
      {
        subject_id: 1,
        code: "CS101",
        title: "Programming 1",
        units: 3,
        year_level: 1,
        semester: "1st",
        is_required: true,
        prerequisites: [],
      },
    ],
  }
}

function mockList(status: string, transitionResponseStatus: string) {
  fetchMock.mockImplementation((input, init) => {
    const url = requestUrl(input)
    if (url.includes("/programs")) {
      return Promise.resolve(new Response(JSON.stringify({ data: programs })))
    }
    if (url.endsWith("/transition")) {
      return Promise.resolve(
        new Response(JSON.stringify({ data: pendingCurriculum(transitionResponseStatus) })),
      )
    }
    if (url.includes("/curricula")) {
      return Promise.resolve(
        new Response(JSON.stringify({ data: [pendingCurriculum(status)] })),
      )
    }
    return Promise.resolve(new Response(JSON.stringify({ data: [] })))
  })
}

describe("CurriculumApprovalsWorkspace", () => {
  it("lists curricula pending the Dean's review and approves one, advancing it to Pending Executive Review", async () => {
    mockList("pending_dean_review", "pending_executive_review")
    const user = userEvent.setup()
    renderWithSession(<CurriculumApprovalsWorkspace />, {
      session: { userId: "1", displayName: "Dean Test", role: "dean", college: null, signedInAt: "2026-08-07T00:00:00.000Z" },
    })

    expect(await screen.findByText("BSCS Curriculum 2026-2027")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Review" }))
    await user.click(await screen.findByRole("button", { name: "Approve" }))

    await screen.findByText(/no curricula are pending your review/i)
  })

  it("requires a reason to return a curriculum and shows it after returning", async () => {
    mockList("pending_dean_review", "draft")
    const user = userEvent.setup()
    renderWithSession(<CurriculumApprovalsWorkspace />, {
      session: { userId: "1", displayName: "Dean Test", role: "dean", college: null, signedInAt: "2026-08-07T00:00:00.000Z" },
    })

    await user.click(await screen.findByRole("button", { name: "Review" }))
    await user.click(await screen.findByRole("button", { name: "Return with notes" }))
    await user.click(screen.getByRole("button", { name: "Confirm return" }))

    expect(screen.getByText(/reason is required/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/notes for program chair/i), "Missing PATHFIT 2.")
    await user.click(screen.getByRole("button", { name: "Confirm return" }))

    await screen.findByText(/no curricula are pending your review/i)
  })

  it("shows an empty state when nothing is pending", async () => {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes("/programs")) return Promise.resolve(new Response(JSON.stringify({ data: programs })))
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })
    renderWithSession(<CurriculumApprovalsWorkspace />, {
      session: { userId: "2", displayName: "Exec Test", role: "executive_director", college: null, signedInAt: "2026-08-07T00:00:00.000Z" },
    })

    expect(
      await screen.findByText(/no curricula are pending your review/i),
    ).toBeInTheDocument()
  })
})
```

(This test assumes `renderWithSession` accepts a `session.role` of `"dean"`/`"executive_director"` and that it drives which pending-status the component filters for — confirm this against how `schedule-decision-workspace.test.tsx` already tests both roles through the same mechanism, and match its exact fixture/session shape instead of inventing a new one if it differs from what's above.)

- [ ] **Step 3: Run it to verify it fails**

Run (from `frontend/`): `npx vitest run src/features/components/portal/curriculum-approvals-workspace.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Write `CurriculumApprovalsWorkspace`**

Create `frontend/src/features/components/portal/curriculum-approvals-workspace.tsx`:

```tsx
"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { CurriculumView } from "@/features/components/portal/curriculum-view"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/features/components/ui/alert-dialog"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/features/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/features/components/ui/field"
import { Textarea } from "@/features/components/ui/textarea"
import {
  curriculaQueryKey,
  useCurriculaQuery,
} from "@/features/hooks/use-curricula"
import { useProgramsQuery } from "@/features/hooks/use-reference-data"
import { transitionCurriculum } from "@/features/services/curriculum-service"
import type { Curriculum } from "@/features/schemas/reference-data-schema"
import type { CurriculumAction } from "@/features/schemas/curriculum-schema"

const statusForRole = {
  dean: "pending_dean_review",
  executive_director: "pending_executive_review",
} as const

const approveActionForRole = {
  dean: "dean_approve",
  executive_director: "executive_approve",
} as const

const returnActionForRole = {
  dean: "dean_return",
  executive_director: "executive_return",
} as const

export function CurriculumApprovalsWorkspace() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const curriculaQuery = useCurriculaQuery()
  const programsQuery = useProgramsQuery()
  const [reviewing, setReviewing] = useState<Curriculum | null>(null)
  const [returning, setReturning] = useState<Curriculum | null>(null)
  const [reason, setReason] = useState("")
  const [reasonError, setReasonError] = useState("")

  const role = session?.role
  const pendingStatus =
    role === "dean" || role === "executive_director"
      ? statusForRole[role]
      : null

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: curriculaQueryKey(session?.userId ?? null),
      exact: true,
    })

  const mutation = useMutation({
    mutationFn: ({ id, action, reason: mutationReason }: { id: number; action: CurriculumAction; reason?: string }) =>
      transitionCurriculum(id, {
        action,
        ...(mutationReason ? { reason: mutationReason } : {}),
      }),
    onSuccess: async () => {
      await invalidate()
      setReviewing(null)
      setReturning(null)
      setReason("")
      setReasonError("")
    },
  })

  if (!role || (role !== "dean" && role !== "executive_director")) return null

  const pending = (curriculaQuery.data ?? []).filter(
    (item) => item.status === pendingStatus,
  )
  const programFor = (programId: number) =>
    (programsQuery.data ?? []).find((program) => program.id === programId)

  const approve = (curriculum: Curriculum) =>
    mutation.mutate({ id: curriculum.id, action: approveActionForRole[role] })

  const confirmReturn = () => {
    if (!returning) return
    if (!reason.trim()) {
      setReasonError("A reason is required to return this curriculum.")
      return
    }
    mutation.mutate({
      id: returning.id,
      action: returnActionForRole[role],
      reason: reason.trim(),
    })
  }

  const query = {
    isPending: curriculaQuery.isPending || programsQuery.isPending,
    isError: curriculaQuery.isError || programsQuery.isError,
    error: curriculaQuery.error ?? programsQuery.error,
    data: true as const,
    refetch: () => {
      void curriculaQuery.refetch()
      void programsQuery.refetch()
    },
  }

  return (
    <WorkspacePage
      title="Curriculum Approvals"
      description="Review curricula submitted by Program Chairs and record your decision."
      lastUpdated={curriculaQuery.dataUpdatedAt}
    >
      <AsyncBoundary query={query} loadingLabel="Loading pending curricula…">
        {() =>
          pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No curricula are pending your review.
            </p>
          ) : (
            <div className="grid gap-3">
              {pending.map((curriculum) => (
                <Card key={curriculum.id}>
                  <CardHeader>
                    <CardTitle>{curriculum.name}</CardTitle>
                    <CardDescription>
                      {programFor(curriculum.program_id)?.code ?? "—"} ·{" "}
                      {curriculum.effective_school_year}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Button type="button" onClick={() => setReviewing(curriculum)}>
                      Review
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        }
      </AsyncBoundary>

      <Dialog
        open={reviewing !== null}
        onOpenChange={(open) => !open && setReviewing(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{reviewing?.name}</DialogTitle>
            <DialogDescription>
              {reviewing && programFor(reviewing.program_id)?.name} ·{" "}
              {reviewing?.effective_school_year}
            </DialogDescription>
          </DialogHeader>
          {reviewing && programsQuery.data && (
            <CurriculumView
              programs={programsQuery.data.filter(
                (program) => program.id === reviewing.program_id,
              )}
              curricula={[reviewing]}
            />
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setReturning(reviewing)
                setReviewing(null)
              }}
            >
              Return with notes
            </Button>
            <Button
              type="button"
              disabled={mutation.isPending}
              onClick={() => reviewing && approve(reviewing)}
            >
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={returning !== null}
        onOpenChange={(open) => !open && setReturning(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return {returning?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The curriculum goes back to the Program Chair as a Draft.
              Explain what needs to change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field data-invalid={Boolean(reasonError)}>
            <FieldLabel htmlFor="return-reason">
              Notes for Program Chair
            </FieldLabel>
            <Textarea
              id="return-reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
                setReasonError("")
              }}
            />
            <FieldError>{reasonError}</FieldError>
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReturning(null)}>
              Cancel
            </AlertDialogCancel>
            <Button type="button" onClick={confirmReturn}>
              Confirm return
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkspacePage>
  )
}
```

- [ ] **Step 5: Run the test file, adjusting to whatever `renderWithSession`/fixture conventions Step 1's reading actually revealed**

Run (from `frontend/`): `npx vitest run src/features/components/portal/curriculum-approvals-workspace.test.tsx`
Expected: PASS. Iterate on mismatches between this task's test/component code and the real `renderWithSession`/`useCurriculaQuery`/`WorkspacePage`/`AsyncBoundary` signatures (import paths and prop names above are based on Tasks 1–12's confirmed usage elsewhere in this same codebase, but re-check each import against the real file if `tsc`/vitest reports a mismatch).

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/components/portal/curriculum-approvals-workspace.tsx frontend/src/features/components/portal/curriculum-approvals-workspace.test.tsx
git commit -m "feat(portal): add CurriculumApprovalsWorkspace for Dean and Executive Director review"
```

---

## Task 14: Frontend — register the `curriculum-approvals` module

**Files:**
- Modify: `frontend/src/features/portal/role-capabilities.ts`
- Modify: `frontend/src/features/portal/module-registry.tsx`
- Test: Modify `frontend/src/features/portal/module-registry.test.tsx` (add coverage), check `frontend/src/features/components/pages/portal-overview-page.test.tsx` for a role/module-count assertion that needs updating

**Interfaces:**
- Consumes: `CurriculumApprovalsWorkspace` (Task 13).
- Produces: `dean`/`executive_director` role definitions gain a `curriculum-approvals` module.

- [ ] **Step 1: Add the module entry to both roles in `role-capabilities.ts`**

Add `ClipboardList` (or reuse `ClipboardCheck`, already imported) to the `lucide-react` import if not already present, then add this entry to `dean.modules` (right after the existing `"schedule-approvals"` entry) and to `executive_director.modules` (right after its existing `"master-schedule"` entry):

```ts
      portalModule(
        "curriculum-approvals",
        "Curriculum Approvals",
        "Review curricula submitted by Program Chairs and record your decision.",
        ClipboardCheck,
      ),
```

- [ ] **Step 2: Register it in `module-registry.tsx`**

Add `"curriculum-approvals"` to the `ConnectedModuleId` union type and to the `connectedModuleIds` array (in the same relative position, e.g. right after `"schedule-approvals"`). Add the import `import { CurriculumApprovalsWorkspace } from "@/features/components/portal/curriculum-approvals-workspace"`, and add `"curriculum-approvals": CurriculumApprovalsWorkspace,` to the `connectedModuleRegistry` object (right after `"schedule-approvals": ScheduleDecisionWorkspace,`).

- [ ] **Step 3: Run the module-registry test and portal-overview test, fixing any hardcoded module-count assertions**

Run (from `frontend/`): `npx vitest run src/features/portal/module-registry.test.tsx src/features/components/pages/portal-overview-page.test.tsx`

If either fails on a hardcoded count (e.g. `expect(dean.modules).toHaveLength(5)`), update that expected number to account for the new module — do not weaken the assertion to something like `.toBeGreaterThan(4)`, keep it an exact count so a future accidental module removal is still caught.

- [ ] **Step 4: Type-check and run the full frontend curriculum-related suite one more time**

Run (from `frontend/`):
```
npx tsc --noEmit -p tsconfig.json
npx vitest run src/features/components/portal/curriculum-view.test.tsx src/features/components/portal/curriculum-workspace.test.tsx src/features/components/portal/curriculum-approvals-workspace.test.tsx src/features/portal/module-registry.test.tsx src/features/components/pages/portal-overview-page.test.tsx
```
Expected: PASS (aside from the pre-existing known-flaky `curriculum-workspace.test.tsx` timeout, if it recurs in isolation — rerun once to confirm it's the same pre-existing flake, not a new failure).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/portal/role-capabilities.ts frontend/src/features/portal/module-registry.tsx frontend/src/features/portal/module-registry.test.tsx frontend/src/features/components/pages/portal-overview-page.test.tsx
git commit -m "feat(portal): register the Curriculum Approvals module for Dean and Executive Director"
```

---

## Task 15: Full-suite verification and wrap-up

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend suite**

Run (from `backend/`): `php artisan test`
Expected: PASS. Investigate and fix any failure that isn't already-known flakiness from a different, unrelated subsystem.

- [ ] **Step 2: Run the full frontend suite**

Run (from `frontend/`): `npx vitest run`
Expected: PASS, modulo the pre-existing sandbox worker-timeout flakiness already observed on `main` for unrelated files in this environment — if a failure isn't one of those two known categories (this plan's own known-flaky `curriculum-workspace.test.tsx` timeout, or generic "Failed to start forks worker" timeouts on unrelated files), treat it as a real regression and fix it before proceeding.

- [ ] **Step 3: Type-check the whole frontend**

Run (from `frontend/`): `npx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 4: Manually confirm the new columns exist against a real dev database, not just the test database**

Run (from `backend/`): `php artisan migrate` (against whatever connection the dev server actually uses — check `.env`, not `.env.testing`)
Expected: the new `2026_08_07_000004_add_decision_columns_to_curricula` migration applies cleanly with no errors, alongside anything else already pending.

- [ ] **Step 5: Final commit if any stray changes remain**

Run: `git status --short` (from repo root) — if clean, nothing to do; if not, review and commit or stash appropriately per this repo's usual git-safety conventions (never bundle unrelated stray changes into this feature's commits).
