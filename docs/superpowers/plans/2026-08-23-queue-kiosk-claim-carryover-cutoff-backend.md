# Queue kiosk claim, carry-over, and cut-off (backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace auto-issuing a Cashier queue ticket at registrar approval
with an explicit **claim**, and give the Cashier a **cut-off/resume**
operation so an unserved line survives to the next service day without
losing anyone's place or ticket number.

**Architecture:** A new `queue_cycles` table models "one continuous line" —
it opens on first claim and stays open across a cut-off, closing only once
drained and a Manila calendar day has passed since its last claim.
`queue_cycle_id` replaces `queue_date` as the scope key everywhere a query
today says "today's queue"; `queue_date` becomes an ordering key instead.
Numbering is a single locked counter row (the open cycle), not a scan of
`queue_tickets`.

**Tech Stack:** Laravel backend (PHP, Eloquent, MariaDB), PHPUnit. This
plan is backend-only — no frontend consumer exists yet for the new claim/
cut-off endpoints beyond the Cashier's own existing screen (Task 9).

**Spec:** `docs/superpowers/specs/2026-08-23-queue-kiosk-claim-carryover-cutoff-design.md`

## Global Constraints

- New table `queue_cycles`: `opened_on`, `last_claimed_on`, `last_ticket_sequence`, `cut_off_at`, `cut_off_service_date`, `cut_off_by`, `closed_at`, a stored generated `open_marker` column, and `unique(open_marker)` enforcing exactly one open cycle at a time (same idiom as `enrollments.active_academic_term_id`).
- `queue_tickets` gains `queue_cycle_id` (FK, nullable until Task 7) and `ticket_sequence` (int, nullable until Task 7); `unique(queue_cycle_id, ticket_sequence)` added in Task 7. Existing `unique(queue_date, ticket_number)` is kept, unchanged.
- Scope key everywhere a query means "the current line": `queue_cycle_id` of the row with `closed_at IS NULL`. `queue_date` stops being a scope key.
- Ordering everywhere a queue is sorted: priority tier → `queue_date` ASC → `COALESCE(requeued_at, created_at)` ASC → `requeued_at IS NOT NULL` ASC → `id` ASC.
- Reset rule: the counter resets to `Q001` only when the open cycle has no outstanding `waiting`/`serving` ticket whose enrollment is still `pending_payment`, **and** its `last_claimed_on` is an earlier Manila date than today.
- Ticket number format unchanged: `sprintf('Q%03d', $sequence)`.
- Manila service date: `config('enrollment.queue.timezone')`, default `Asia/Manila`, via a new `App\Domain\Enrollment\QueueServiceDate` helper. `config('app.timezone')` stays `UTC` — never touched.
- `QueueTicketPolicy::viewAny`/`update` (Accounting Staff only) are unchanged. The new claim ability is a new `EnrollmentPolicy::claimQueueTicket` method: the owning Student, or any Accounting Staff member.
- No skip-count limit, no no-show removal path, no change to `ConfirmPayment` — all explicitly out of scope (see spec).
- Full spec: `docs/superpowers/specs/2026-08-23-queue-kiosk-claim-carryover-cutoff-design.md`.

---

### Task 1: Schema — `queue_cycles` table, `queue_tickets` new columns, backfill, Manila date helper

**Files:**
- Create: `backend/database/migrations/2026_08_23_000001_create_queue_cycles_and_backfill_ticket_cycles.php`
- Create: `backend/app/Domain/Enrollment/QueueServiceDate.php`
- Create: `backend/tests/Unit/Domain/Enrollment/QueueServiceDateTest.php`
- Create: `backend/tests/Feature/Database/QueueCycleMigrationTest.php`
- Modify: `backend/config/enrollment.php`

**Interfaces:**
- Consumes: nothing (foundational).
- Produces: `queue_cycles` table. `queue_tickets.queue_cycle_id` (nullable FK) and `queue_tickets.ticket_sequence` (nullable int) — both consumed by Task 3 onward. `App\Domain\Enrollment\QueueServiceDate::today(): string` (Manila `Y-m-d`) and `::timezone(): string` — consumed by Task 3 (`ClaimQueueTicket`) and Task 5 (`FindCashierPaymentCandidate`).

- [ ] **Step 1: Write the failing config/helper test first**

Create `backend/tests/Unit/Domain/Enrollment/QueueServiceDateTest.php`:

```php
<?php

namespace Tests\Unit\Domain\Enrollment;

use App\Domain\Enrollment\QueueServiceDate;
use Carbon\CarbonImmutable;
use PHPUnit\Framework\TestCase;

final class QueueServiceDateTest extends TestCase
{
    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_today_uses_manila_time_not_utc(): void
    {
        // 23:30 UTC on the 23rd is already 07:30 on the 24th in Manila (UTC+8).
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-08-23 23:30:00', 'UTC'));

        self::assertSame('2026-08-24', QueueServiceDate::today());
        self::assertNotSame(CarbonImmutable::now('UTC')->toDateString(), QueueServiceDate::today());
    }

    public function test_timezone_defaults_to_asia_manila(): void
    {
        self::assertSame('Asia/Manila', QueueServiceDate::timezone());
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && php artisan test --filter=QueueServiceDateTest`

Expected: FAIL — class `App\Domain\Enrollment\QueueServiceDate` does not exist.

- [ ] **Step 3: Add the Manila timezone config key**

Open `backend/config/enrollment.php`. Add this key to the returned array,
immediately before the final closing `];`:

```php
    // Phase: queue kiosk claim/carry-over/cut-off. The physical
    // front-desk's "today" for queue_tickets.queue_date and the cycle
    // drain/reset rule only — deliberately NOT config('app.timezone')
    // (stays UTC everywhere else). See ADR: docs/superpowers/specs/
    // 2026-08-23-queue-kiosk-claim-carryover-cutoff-design.md.
    'queue' => [
        'timezone' => env('ENROLLMENT_QUEUE_TIMEZONE', 'Asia/Manila'),
    ],
```

- [ ] **Step 4: Create the `QueueServiceDate` helper**

Create `backend/app/Domain/Enrollment/QueueServiceDate.php`:

```php
<?php

namespace App\Domain\Enrollment;

use Carbon\CarbonImmutable;

/**
 * The physical front-desk's "today" — Asia/Manila by default — used only
 * for `queue_tickets.queue_date` and the `QueueCycle` drain/reset rule.
 * Deliberately NOT `config('app.timezone')` (UTC, unchanged everywhere
 * else): every stored timestamp column (`created_at`, `requeued_at`,
 * `served_at`, ...) stays UTC, and `QueueTicket::position()`'s COALESCE
 * ordering depends on comparing them as UTC. Converting `app.timezone`
 * instead would silently shift every one of those comparisons by the UTC
 * offset. See docs/superpowers/specs/
 * 2026-08-23-queue-kiosk-claim-carryover-cutoff-design.md.
 */
final class QueueServiceDate
{
    public static function today(): string
    {
        return CarbonImmutable::now(self::timezone())->toDateString();
    }

    public static function timezone(): string
    {
        return (string) config('enrollment.queue.timezone', 'Asia/Manila');
    }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && php artisan test --filter=QueueServiceDateTest`

Expected: PASS.

- [ ] **Step 6: Write the failing migration test**

Create `backend/tests/Feature/Database/QueueCycleMigrationTest.php`:

```php
<?php

namespace Tests\Feature\Database;

use App\Models\QueueCycle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

final class QueueCycleMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_queue_cycles_table_has_the_expected_columns(): void
    {
        self::assertTrue(Schema::hasColumns('queue_cycles', [
            'id', 'opened_on', 'last_claimed_on', 'last_ticket_sequence',
            'cut_off_at', 'cut_off_service_date', 'cut_off_by', 'closed_at',
            'open_marker', 'created_at', 'updated_at',
        ]));
    }

    public function test_queue_tickets_gained_the_cycle_columns(): void
    {
        self::assertTrue(Schema::hasColumns('queue_tickets', ['queue_cycle_id', 'ticket_sequence']));
    }

    public function test_only_one_open_cycle_is_allowed_at_a_time(): void
    {
        QueueCycle::create(['opened_on' => '2026-08-23', 'last_ticket_sequence' => 0]);

        $this->expectException(\Illuminate\Database\QueryException::class);

        QueueCycle::create(['opened_on' => '2026-08-23', 'last_ticket_sequence' => 0]);
    }

    public function test_a_closed_cycle_does_not_collide_with_a_new_open_one(): void
    {
        QueueCycle::create([
            'opened_on' => '2026-08-20', 'last_ticket_sequence' => 5, 'closed_at' => now(),
        ]);

        $secondCycle = QueueCycle::create(['opened_on' => '2026-08-23', 'last_ticket_sequence' => 0]);

        self::assertNull($secondCycle->closed_at);
        self::assertSame(2, QueueCycle::query()->count());
    }
}
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `cd backend && php artisan test --filter=QueueCycleMigrationTest`

Expected: FAIL — table `queue_cycles` does not exist, class `App\Models\QueueCycle` does not exist.

- [ ] **Step 8: Create the migration**

Create `backend/database/migrations/2026_08_23_000001_create_queue_cycles_and_backfill_ticket_cycles.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Introduces the queue "cycle" — one continuous line, spanning one or more
 * Manila service days once a cut-off carries unserved tickets forward. A
 * cycle opens on first claim and closes only once fully drained and a
 * Manila day has passed since its last claim (see App\Actions\Enrollment\
 * ClaimQueueTicket). `queue_cycle_id` replaces `queue_date` as the scope
 * key everywhere a query means "the current line" — `queue_date` becomes
 * an ordering key instead. See docs/superpowers/specs/
 * 2026-08-23-queue-kiosk-claim-carryover-cutoff-design.md.
 *
 * `open_marker` mirrors `enrollments.active_academic_term_id`
 * (2026_07_27_000010): a STORED generated column that is NULL unless the
 * row is live, backing a UNIQUE index — SQL unique indexes ignore NULLs,
 * so this enforces "at most one open cycle" in the database itself.
 *
 * `queue_tickets.queue_cycle_id`/`ticket_sequence` are added nullable here
 * and backfilled for existing rows; a later migration (once every ticket-
 * issuing code path is cycle-aware) tightens them to NOT NULL and adds
 * `unique(queue_cycle_id, ticket_sequence)` — see Task 7 of this plan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('queue_cycles', function (Blueprint $table) {
            $table->id();
            $table->date('opened_on');
            $table->date('last_claimed_on')->nullable();
            $table->unsignedInteger('last_ticket_sequence')->default(0);
            $table->timestamp('cut_off_at')->nullable();
            $table->date('cut_off_service_date')->nullable();
            $table->foreignId('cut_off_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->unsignedTinyInteger('open_marker')
                ->nullable()
                ->storedAs('case when `closed_at` is null then 1 else null end');

            $table->unique('open_marker', 'queue_cycles_single_open_cycle_unique');
        });

        Schema::table('queue_tickets', function (Blueprint $table) {
            $table->foreignId('queue_cycle_id')->nullable()->after('enrollment_id')
                ->constrained('queue_cycles')->restrictOnDelete();
            $table->unsignedInteger('ticket_sequence')->nullable()->after('ticket_number');
        });

        $this->backfillCycles();
    }

    public function down(): void
    {
        Schema::table('queue_tickets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('queue_cycle_id');
            $table->dropColumn('ticket_sequence');
        });

        Schema::dropIfExists('queue_cycles');
    }

    /**
     * One cycle per distinct existing `queue_date`, in arrival order. Every
     * cycle is closed except the single most recent date that still has an
     * outstanding `waiting`/`serving` ticket — closing that one too would
     * strand a live line across the deploy. If no date has outstanding
     * tickets, every backfilled cycle closes and the next claim opens a
     * fresh one at Q001. `ticket_number` is left exactly as-is on every
     * historical row; only the new internal-only `ticket_sequence` is
     * assigned, by row order within each date — it need not equal the
     * digits inside the old `ticket_number` string (fixture data uses both
     * `Q001` and `Q000001` forms), only be unique per cycle.
     */
    private function backfillCycles(): void
    {
        $dates = DB::table('queue_tickets')->select('queue_date')->distinct()->orderBy('queue_date')->pluck('queue_date');

        if ($dates->isEmpty()) {
            return;
        }

        $lastDateWithOutstandingTickets = DB::table('queue_tickets')
            ->whereIn('status', ['waiting', 'serving'])
            ->max('queue_date');

        foreach ($dates as $date) {
            $ticketsForDate = DB::table('queue_tickets')
                ->where('queue_date', $date)
                ->orderByRaw('COALESCE(requeued_at, created_at)')
                ->orderByRaw('requeued_at IS NOT NULL')
                ->orderBy('id')
                ->get(['id']);

            $cycleId = DB::table('queue_cycles')->insertGetId([
                'opened_on' => $date,
                'last_claimed_on' => $date,
                'last_ticket_sequence' => $ticketsForDate->count(),
                'closed_at' => $date === $lastDateWithOutstandingTickets ? null : now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $sequence = 0;
            foreach ($ticketsForDate as $ticket) {
                $sequence++;
                DB::table('queue_tickets')->where('id', $ticket->id)->update([
                    'queue_cycle_id' => $cycleId,
                    'ticket_sequence' => $sequence,
                ]);
            }
        }
    }
};
```

- [ ] **Step 9: Run the migration**

Run: `cd backend && php artisan migrate --force`

Then also apply it to the testing database (RefreshDatabase runs migrations
against it automatically per-test, but confirm the migration itself is
syntactically sound first):

Run: `cd backend && php artisan migrate --env=testing --force`

- [ ] **Step 10: Create the `QueueCycle` model (minimal — enough for this task's tests; Task 2 adds behavior)**

Create `backend/app/Models/QueueCycle.php`:

```php
<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One continuous Cashier queue line. Opens on first claim, stays open
 * across a cut-off, and closes only once drained and a Manila day has
 * passed since its last claim — see App\Actions\Enrollment\ClaimQueueTicket
 * and docs/superpowers/specs/2026-08-23-queue-kiosk-claim-carryover-cutoff-design.md.
 * `open_marker` (a stored generated column, see the creating migration)
 * backs the database-enforced "at most one open cycle" invariant.
 *
 * @property int $id
 * @property CarbonImmutable $opened_on
 * @property ?CarbonImmutable $last_claimed_on
 * @property int $last_ticket_sequence
 * @property ?CarbonImmutable $cut_off_at
 * @property ?CarbonImmutable $cut_off_service_date
 * @property ?int $cut_off_by
 * @property ?CarbonImmutable $closed_at
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read list<QueueTicket> $tickets
 */
final class QueueCycle extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'opened_on',
        'last_claimed_on',
        'last_ticket_sequence',
        'cut_off_at',
        'cut_off_service_date',
        'cut_off_by',
        'closed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'opened_on' => 'immutable_date',
            'last_claimed_on' => 'immutable_date',
            'cut_off_at' => 'immutable_datetime',
            'cut_off_service_date' => 'immutable_date',
            'closed_at' => 'immutable_datetime',
        ];
    }

    /**
     * @return HasMany<QueueTicket, $this>
     */
    public function tickets(): HasMany
    {
        return $this->hasMany(QueueTicket::class);
    }
}
```

- [ ] **Step 11: Run the migration test to verify it passes**

Run: `cd backend && php artisan test --filter=QueueCycleMigrationTest`

Expected: PASS, all 4 tests.

- [ ] **Step 12: Run the full backend suite to confirm no regressions**

Run: `cd backend && php artisan test`

Expected: every test that passed before this task still passes (the new
columns are nullable and no existing code references them yet, so no
existing `QueueTicket::create()` call site — application or test — needs
any change). The two pre-existing `AuditVocabularyTest` failures noted
below are unrelated to this task and are fixed in Task 2 — confirm they
are the *only* failures, if any.

> **Note for the implementer:** `AuditVocabularyTest` (`backend/tests/Unit/Domain/Audit/AuditVocabularyTest.php`) is failing on `main` before this plan starts — its two expected arrays are stale against the current `AuditAction::values()`/`AuditableType::values()` (missing `faculty_curriculum_subject_preference.*`, `faculty_specialization.*`, `faculty_load_threshold.updated`, `faculty_workforce_profile.updated`, `student_profile.curriculum_migrated`, `student_schedule_preference.saved`, `account_payment`). This is pre-existing and unrelated to this plan; do not attempt to fix it in this task. Task 2 fixes it (it touches the same file to add this plan's own new constants, so the whole file is corrected in one pass).

- [ ] **Step 13: Run PHPStan**

Run: `cd backend && ./vendor/bin/phpstan analyse`

Expected: no new errors (baseline-only, matching the project's current state).

- [ ] **Step 14: Commit**

```bash
cd /c/xampp/htdocs/GRC-ENROLLMENT
git add backend/database/migrations/2026_08_23_000001_create_queue_cycles_and_backfill_ticket_cycles.php backend/app/Models/QueueCycle.php backend/app/Domain/Enrollment/QueueServiceDate.php backend/config/enrollment.php backend/tests/Unit/Domain/Enrollment/QueueServiceDateTest.php backend/tests/Feature/Database/QueueCycleMigrationTest.php
git commit -m "feat(queue): add queue_cycles schema and the Manila service-date helper

Introduces the queue cycle -- one continuous line that can span
multiple Manila service days -- as the foundation for carry-over and
cut-off. queue_tickets gains nullable queue_cycle_id/ticket_sequence
columns, backfilled from existing data. No application code reads
these columns yet; that starts in the next task.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017PdBvDW7rzZNEyJAGqYyya"
```

---

### Task 2: Domain vocabulary — `QueueCycleStatus`, `QueueCycle::isDrained()`, audit/notification constants

**Files:**
- Create: `backend/app/Domain/Enrollment/QueueCycleStatus.php`
- Create: `backend/tests/Unit/Domain/Enrollment/QueueCycleStatusTest.php`
- Create: `backend/tests/Unit/Models/QueueCycleTest.php`
- Modify: `backend/app/Models/QueueCycle.php`
- Modify: `backend/app/Domain/Audit/AuditAction.php`
- Modify: `backend/app/Domain/Audit/AuditableType.php`
- Modify: `backend/app/Domain/Notifications/NotificationType.php`
- Modify: `backend/tests/Unit/Domain/Audit/AuditVocabularyTest.php`

**Interfaces:**
- Consumes: `QueueCycle` model from Task 1 (unchanged fields).
- Produces: `QueueCycle::isDrained(): bool` and `QueueCycle::status(): QueueCycleStatus` — both consumed by Task 3 (`ClaimQueueTicket`) and Task 6 (`TransitionQueueCycle`/`QueueCycleResource`). `AuditAction::QUEUE_TICKET_CLAIMED`, `::QUEUE_CYCLE_CUT_OFF`, `::QUEUE_CYCLE_RESUMED`, `::QUEUE_CYCLE_CLOSED` (string constants) and `AuditableType::QUEUE_CYCLE` — consumed by Tasks 3 and 6. `NotificationType::QueueTicketClaimed` and `::QueueCycleCutOff` — consumed by Tasks 3 and 6.

- [ ] **Step 1: Write the failing tests first**

Create `backend/tests/Unit/Domain/Enrollment/QueueCycleStatusTest.php`:

```php
<?php

namespace Tests\Unit\Domain\Enrollment;

use App\Domain\Enrollment\QueueCycleStatus;
use PHPUnit\Framework\TestCase;

final class QueueCycleStatusTest extends TestCase
{
    public function test_it_has_the_three_provisional_values(): void
    {
        self::assertSame(['open', 'cut_off', 'closed'], array_map(
            fn (QueueCycleStatus $status): string => $status->value,
            QueueCycleStatus::cases(),
        ));
    }

    public function test_every_case_has_a_stable_label(): void
    {
        self::assertSame('Open', QueueCycleStatus::Open->label());
        self::assertSame('Cut off for today', QueueCycleStatus::CutOff->label());
        self::assertSame('Closed', QueueCycleStatus::Closed->label());
    }
}
```

Create `backend/tests/Unit/Models/QueueCycleTest.php`:

```php
<?php

namespace Tests\Unit\Models;

use App\Domain\Enrollment\QueueCycleStatus;
use App\Domain\Enrollment\QueueServiceDate;
use App\Domain\Enrollment\QueueTicketStatus;
use App\Models\QueueCycle;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class QueueCycleTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_a_freshly_opened_cycle_with_no_tickets_is_drained(): void
    {
        $cycle = QueueCycle::create(['opened_on' => QueueServiceDate::today(), 'last_ticket_sequence' => 0]);

        self::assertTrue($cycle->isDrained());
    }

    public function test_status_is_open_by_default(): void
    {
        $cycle = QueueCycle::create(['opened_on' => QueueServiceDate::today(), 'last_ticket_sequence' => 0]);

        self::assertSame(QueueCycleStatus::Open, $cycle->status());
    }

    public function test_status_is_cut_off_only_for_todays_cut_off_service_date(): void
    {
        CarbonImmutable::setTestNow('2026-08-23 09:00:00');
        $cycle = QueueCycle::create([
            'opened_on' => '2026-08-23', 'last_ticket_sequence' => 3,
            'cut_off_at' => now(), 'cut_off_service_date' => '2026-08-23',
        ]);

        self::assertSame(QueueCycleStatus::CutOff, $cycle->status());

        CarbonImmutable::setTestNow('2026-08-24 09:00:00');
        self::assertSame(QueueCycleStatus::Open, $cycle->fresh()->status());
    }

    public function test_status_is_closed_once_closed_at_is_set(): void
    {
        $cycle = QueueCycle::create([
            'opened_on' => '2026-08-20', 'last_ticket_sequence' => 3, 'closed_at' => now(),
        ]);

        self::assertSame(QueueCycleStatus::Closed, $cycle->status());
    }

    public function test_it_is_not_drained_while_a_pending_payment_ticket_is_waiting(): void
    {
        $cycle = QueueCycle::create(['opened_on' => QueueServiceDate::today(), 'last_ticket_sequence' => 1]);
        [, $enrollment] = $this->makeApprovedEnrollment();
        $cycle->tickets()->create([
            'enrollment_id' => $enrollment->id, 'ticket_number' => 'Q001', 'ticket_sequence' => 1,
            'queue_date' => QueueServiceDate::today(), 'status' => QueueTicketStatus::Waiting,
        ]);

        self::assertFalse($cycle->fresh()->isDrained());
    }

    public function test_it_is_drained_once_the_waiting_tickets_enrollment_is_paid(): void
    {
        $cycle = QueueCycle::create(['opened_on' => QueueServiceDate::today(), 'last_ticket_sequence' => 1]);
        [, $enrollment] = $this->makeApprovedEnrollment();
        $ticket = $cycle->tickets()->create([
            'enrollment_id' => $enrollment->id, 'ticket_number' => 'Q001', 'ticket_sequence' => 1,
            'queue_date' => QueueServiceDate::today(), 'status' => QueueTicketStatus::Waiting,
        ]);
        // Left `waiting` even though payment was confirmed -- ConfirmPayment
        // does not touch the queue ticket today (a known, documented gap).
        // isDrained() must not let this block the cycle from ever resetting.
        $enrollment->update(['status' => 'enrolled']);

        self::assertTrue($cycle->fresh()->isDrained());
        self::assertSame('waiting', $ticket->fresh()->status->value);
    }

    /**
     * @return array{\App\Models\StudentProfile, \App\Models\Enrollment}
     */
    private function makeApprovedEnrollment(): array
    {
        $program = \App\Models\Program::create([
            'code' => 'BSCS-QC', 'name' => 'BS Computer Science', 'status' => \App\Domain\Organization\ProgramStatus::Active,
        ]);
        $curriculum = \App\Models\Curriculum::create([
            'program_id' => $program->id, 'name' => 'BSCS Curriculum',
            'effective_school_year' => '2026-2027', 'status' => \App\Domain\Curriculum\CurriculumStatus::Active,
        ]);
        $term = \App\Models\AcademicTerm::create([
            'school_year' => '2026-2027', 'semester' => '1st', 'status' => \App\Domain\Organization\AcademicTermStatus::SemesterOngoing,
        ]);
        $user = \App\Models\User::create([
            'name' => 'Cycle Test Student', 'email' => 'cycle.test.'.uniqid().'@grc.test',
            'password' => 'correct-horse-battery-staple', 'role' => \App\Domain\Identity\UserRole::Student,
            'status' => \App\Domain\Identity\UserStatus::Active,
        ]);
        $student = \App\Models\StudentProfile::create([
            'user_id' => $user->id, 'student_number' => '2026-08-'.random_int(10000, 99999),
            'program_id' => $program->id, 'curriculum_id' => $curriculum->id, 'year_level' => 1,
            'admission_status' => \App\Domain\Identity\AdmissionStatus::Admitted,
            'academic_standing' => \App\Domain\Identity\AcademicStanding::Good,
        ]);
        $enrollment = \App\Models\Enrollment::create([
            'student_id' => $student->id, 'academic_term_id' => $term->id,
            'status' => 'pending_payment', 'total_units' => 3,
        ]);

        return [$student, $enrollment];
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && php artisan test --filter=QueueCycleStatusTest`

Expected: FAIL — class `App\Domain\Enrollment\QueueCycleStatus` does not exist.

Run: `cd backend && php artisan test --filter="QueueCycleTest"`

Expected: FAIL — `QueueCycle::isDrained()`/`::status()` do not exist.

- [ ] **Step 3: Create `QueueCycleStatus`**

Create `backend/app/Domain/Enrollment/QueueCycleStatus.php`:

```php
<?php

namespace App\Domain\Enrollment;

/**
 * A `queue_cycles` row's status is fully derived from its own columns —
 * this enum exists only to give the three derived states stable string
 * values and labels for `QueueCycleResource`. Never stored on the row
 * itself; see `QueueCycle::status()`.
 */
enum QueueCycleStatus: string
{
    case Open = 'open';
    case CutOff = 'cut_off';
    case Closed = 'closed';

    public function label(): string
    {
        return match ($this) {
            self::Open => 'Open',
            self::CutOff => 'Cut off for today',
            self::Closed => 'Closed',
        };
    }
}
```

- [ ] **Step 4: Add `isDrained()` and `status()` to `QueueCycle`**

Open `backend/app/Models/QueueCycle.php`. Add these imports after the
existing `namespace App\Models;` line:

```php
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Enrollment\QueueCycleStatus;
use App\Domain\Enrollment\QueueServiceDate;
use App\Domain\Enrollment\QueueTicketStatus;
```

Add these two methods to the class, after the existing `tickets()` method:

```php
    /**
     * No `waiting`/`serving` ticket remains whose enrollment is still
     * `pending_payment` — the read-only half of the reset rule (see
     * `App\Actions\Enrollment\ClaimQueueTicket`). Scoped to `pending_payment`
     * so a ticket left behind by a payment `ConfirmPayment` confirmed but
     * never marked `complete` on the ticket does not block the cycle from
     * ever draining — a known, documented gap this method deliberately
     * routes around rather than silently inheriting.
     */
    public function isDrained(): bool
    {
        return ! $this->tickets()
            ->whereIn('status', [QueueTicketStatus::Waiting->value, QueueTicketStatus::Serving->value])
            ->whereHas('enrollment', fn ($query) => $query->where('status', EnrollmentStatus::PendingPayment->value))
            ->exists();
    }

    public function status(): QueueCycleStatus
    {
        if ($this->closed_at !== null) {
            return QueueCycleStatus::Closed;
        }

        if ($this->cut_off_service_date !== null
            && $this->cut_off_service_date->toDateString() === QueueServiceDate::today()) {
            return QueueCycleStatus::CutOff;
        }

        return QueueCycleStatus::Open;
    }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && php artisan test --filter=QueueCycleStatusTest`

Expected: PASS.

Run: `cd backend && php artisan test --filter="QueueCycleTest"`

Expected: PASS, all 6 tests.

- [ ] **Step 6: Add the new audit and notification vocabulary**

Open `backend/app/Domain/Audit/AuditAction.php`. Add these four constants
immediately after `public const STUDENT_SCHEDULE_PREFERENCE_SAVED = 'student_schedule_preference.saved';`:

```php

    public const QUEUE_TICKET_CLAIMED = 'queue_ticket.claimed';

    public const QUEUE_CYCLE_CUT_OFF = 'queue_cycle.cut_off';

    public const QUEUE_CYCLE_RESUMED = 'queue_cycle.resumed';

    public const QUEUE_CYCLE_CLOSED = 'queue_cycle.closed';
```

Replace the `values()` method's return array. The current array is stale
against the constants already declared above it (a pre-existing gap, not
caused by this task — see Task 1 Step 12's note); this replacement both
fixes that gap and adds this task's four new constants, all in one pass
since it is the same array:

```php
    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return [
            self::CURRICULUM_CREATED,
            self::CURRICULUM_UPDATED,
            self::SUBJECT_CREATED,
            self::CURRICULUM_SUBMITTED,
            self::CURRICULUM_DEAN_APPROVED,
            self::CURRICULUM_DEAN_RETURNED,
            self::CURRICULUM_EXECUTIVE_APPROVED,
            self::CURRICULUM_EXECUTIVE_RETURNED,
            self::FACULTY_AVAILABILITY_CREATED,
            self::FACULTY_AVAILABILITY_UPDATED,
            self::FACULTY_AVAILABILITY_DELETED,
            self::FACULTY_SUBJECT_PREFERENCE_CREATED,
            self::FACULTY_SUBJECT_PREFERENCE_UPDATED,
            self::FACULTY_SUBJECT_PREFERENCE_DELETED,
            self::FACULTY_CURRICULUM_SUBJECT_PREFERENCE_CREATED,
            self::FACULTY_CURRICULUM_SUBJECT_PREFERENCE_UPDATED,
            self::FACULTY_CURRICULUM_SUBJECT_PREFERENCE_DELETED,
            self::FACULTY_SPECIALIZATION_CREATED,
            self::FACULTY_SPECIALIZATION_DELETED,
            self::SECTION_CREATED,
            self::SECTION_UPDATED,
            self::FACULTY_LOAD_THRESHOLD_UPDATED,
            self::SCHEDULE_PROPOSAL_CREATED,
            self::SCHEDULE_PROPOSAL_DEAN_APPROVED,
            self::SCHEDULE_PROPOSAL_DEAN_RETURNED,
            self::SCHEDULE_PROPOSAL_EXECUTIVE_APPROVED,
            self::SCHEDULE_PROPOSAL_EXECUTIVE_RETURNED,
            self::SCHEDULE_PROPOSAL_PUBLISHED,
            self::SECTION_PUBLISHED,
            self::SCHEDULE_PROPOSAL_CLOSED,
            self::STUDENT_PROFILE_PROVISIONED,
            self::STUDENT_ENROLLMENT_CATEGORY_RECLASSIFIED,
            self::STUDENT_CURRICULUM_MIGRATED,
            self::AUDIT_LOG_LIST_VIEWED,
            self::FACULTY_DIRECTORY_LIST_VIEWED,
            self::FACULTY_WORKFORCE_PROFILE_UPDATED,
            self::ENROLLMENT_SUBMITTED,
            self::ENROLLMENT_REGISTRAR_APPROVED,
            self::ENROLLMENT_REGISTRAR_REJECTED,
            self::ENROLLMENT_VOIDED,
            self::ACADEMIC_GRADE_CREATED,
            self::ACADEMIC_GRADE_UPDATED,
            self::ACADEMIC_GRADE_SUBMITTED,
            self::ACADEMIC_GRADE_LOCKED,
            self::QUEUE_TICKET_SERVING_STARTED,
            self::QUEUE_TICKET_SERVED,
            self::QUEUE_TICKET_SKIPPED,
            self::QUEUE_TICKET_MARKED_PRIORITY,
            self::ENROLLMENT_PAYMENT_CONFIRMED,
            self::ACCOUNT_PAYMENT_RECORDED,
            self::WITHDRAWAL_REQUEST_CREATED,
            self::WITHDRAWAL_REQUEST_APPROVED,
            self::WITHDRAWAL_REQUEST_REJECTED,
            self::TRANSFEREE_CREDIT_CREATED,
            self::TRANSFEREE_CREDIT_UPDATED,
            self::TRANSFEREE_CREDIT_APPROVED,
            self::TRANSFEREE_CREDIT_REJECTED,
            self::ACADEMIC_TERM_CREATED,
            self::SUBJECT_OFFERINGS_REPLACED,
            self::SECTION_PLAN_SUBMITTED,
            self::SECTION_PLAN_AUTO_ASSIGNED,
            self::ACADEMIC_TERM_WORKFLOW_CURRICULUM_STARTED,
            self::ACADEMIC_TERM_WORKFLOW_CURRICULUM_COMPLETED,
            self::ACADEMIC_TERM_WORKFLOW_FACULTY_REVIEWED,
            self::ACADEMIC_TERM_CLOSED,
            self::ACADEMIC_TERM_ARCHIVED,
            self::ACADEMIC_TERM_ENROLLMENT_OPENED,
            self::ACADEMIC_TERM_ENROLLMENT_SCHEDULE_UPDATED,
            self::ENROLLMENT_CHANGE_REQUEST_CREATED,
            self::ENROLLMENT_CHANGE_REQUEST_APPROVED,
            self::ENROLLMENT_CHANGE_REQUEST_REJECTED,
            self::STUDENT_SCHEDULE_PREFERENCE_SAVED,
            self::QUEUE_TICKET_CLAIMED,
            self::QUEUE_CYCLE_CUT_OFF,
            self::QUEUE_CYCLE_RESUMED,
            self::QUEUE_CYCLE_CLOSED,
        ];
    }
```

Open `backend/app/Domain/Audit/AuditableType.php`. Add this constant
immediately after `public const STUDENT_SCHEDULE_PREFERENCE = 'student_schedule_preference';`:

```php

    public const QUEUE_CYCLE = 'queue_cycle';
```

Replace the `values()` method's return array (same reasoning — fixes the
pre-existing gap and adds the one new constant in the same pass):

```php
    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return [
            self::CURRICULUM,
            self::SUBJECT,
            self::FACULTY_AVAILABILITY,
            self::FACULTY_SUBJECT_PREFERENCE,
            self::FACULTY_CURRICULUM_SUBJECT_PREFERENCE,
            self::FACULTY_SPECIALIZATION,
            self::SECTION,
            self::FACULTY_LOAD_THRESHOLD,
            self::SCHEDULE_PROPOSAL,
            self::STUDENT_PROFILE,
            self::AUDIT_LOG,
            self::FACULTY_DIRECTORY,
            self::FACULTY_WORKFORCE_PROFILE,
            self::ENROLLMENT,
            self::ACCOUNT_PAYMENT,
            self::ACADEMIC_GRADE,
            self::QUEUE_TICKET,
            self::WITHDRAWAL_REQUEST,
            self::TRANSFEREE_CREDIT,
            self::ACADEMIC_TERM,
            self::SUBJECT_OFFERING,
            self::ACADEMIC_TERM_WORKFLOW,
            self::SECTION_PLAN,
            self::ACADEMIC_TERM_YEAR_LEVEL_WINDOW,
            self::ENROLLMENT_CHANGE_REQUEST,
            self::STUDENT_SCHEDULE_PREFERENCE,
            self::QUEUE_CYCLE,
        ];
    }
```

Open `backend/app/Domain/Notifications/NotificationType.php`. Add these
two cases immediately after `case CurriculumReturned = 'curriculum_returned';`:

```php
    case QueueTicketClaimed = 'queue_ticket_claimed';
    case QueueCycleCutOff = 'queue_cycle_cut_off';
```

- [ ] **Step 7: Update `AuditVocabularyTest` to match**

Open `backend/tests/Unit/Domain/Audit/AuditVocabularyTest.php`. Replace the
entire file:

```php
<?php

namespace Tests\Unit\Domain\Audit;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use PHPUnit\Framework\TestCase;

final class AuditVocabularyTest extends TestCase
{
    public function test_action_values_include_academic_term_workflow_transitions(): void
    {
        self::assertSame(
            [
                'curriculum.created',
                'curriculum.updated',
                'subject.created',
                'curriculum.submitted',
                'curriculum.dean_approved',
                'curriculum.dean_returned',
                'curriculum.executive_approved',
                'curriculum.executive_returned',
                'faculty_availability.created',
                'faculty_availability.updated',
                'faculty_availability.deleted',
                'faculty_subject_preference.created',
                'faculty_subject_preference.updated',
                'faculty_subject_preference.deleted',
                'faculty_curriculum_subject_preference.created',
                'faculty_curriculum_subject_preference.updated',
                'faculty_curriculum_subject_preference.deleted',
                'faculty_specialization.created',
                'faculty_specialization.deleted',
                'section.created',
                'section.updated',
                'faculty_load_threshold.updated',
                'schedule_proposal.created',
                'schedule_proposal.dean_approved',
                'schedule_proposal.dean_returned',
                'schedule_proposal.executive_approved',
                'schedule_proposal.executive_returned',
                'schedule_proposal.published',
                'section.published',
                'schedule_proposal.closed',
                'student_profile.provisioned',
                'student_profile.enrollment_category_reclassified',
                'student_profile.curriculum_migrated',
                'audit_log.list_viewed',
                'faculty_directory.list_viewed',
                'faculty_workforce_profile.updated',
                'enrollment.submitted',
                'enrollment.registrar_approved',
                'enrollment.registrar_rejected',
                'enrollment.voided',
                'academic_grade.created',
                'academic_grade.updated',
                'academic_grade.submitted',
                'academic_grade.locked',
                'queue_ticket.serving_started',
                'queue_ticket.served',
                'queue_ticket.skipped',
                'queue_ticket.marked_priority',
                'enrollment.payment_confirmed',
                'account_payment.recorded',
                'withdrawal_request.created',
                'withdrawal_request.approved',
                'withdrawal_request.rejected',
                'transferee_credit.created',
                'transferee_credit.updated',
                'transferee_credit.approved',
                'transferee_credit.rejected',
                'academic_term.created',
                'subject_offerings.replaced',
                'section_plan.submitted',
                'section_plan.auto_assigned',
                'academic_term_workflow.curriculum_started',
                'academic_term_workflow.curriculum_completed',
                'academic_term_workflow.faculty_reviewed',
                'academic_term.closed',
                'academic_term.archived',
                'academic_term.enrollment_opened',
                'academic_term.enrollment_schedule_updated',
                'enrollment_change_request.created',
                'enrollment_change_request.approved',
                'enrollment_change_request.rejected',
                'student_schedule_preference.saved',
                'queue_ticket.claimed',
                'queue_cycle.cut_off',
                'queue_cycle.resumed',
                'queue_cycle.closed',
            ],
            AuditAction::values(),
        );
    }

    public function test_auditable_type_values_are_the_approved_subjects(): void
    {
        self::assertSame(
            [
                'curriculum',
                'subject',
                'faculty_availability',
                'faculty_subject_preference',
                'faculty_curriculum_subject_preference',
                'faculty_specialization',
                'section',
                'faculty_load_threshold',
                'schedule_proposal',
                'student_profile',
                'audit_log',
                'faculty_directory',
                'faculty_workforce_profile',
                'enrollment',
                'account_payment',
                'academic_grade',
                'queue_ticket',
                'withdrawal_request',
                'transferee_credit',
                'academic_term',
                'subject_offering',
                'academic_term_workflow',
                'section_plan',
                'academic_term_year_level_window',
                'enrollment_change_request',
                'student_schedule_preference',
                'queue_cycle',
            ],
            AuditableType::values(),
        );
    }
}
```

> **Note for the implementer:** this replaces the test's two expected
> arrays with lists reconstructed from the *actual current* declaration
> order in `AuditAction.php`/`AuditableType.php` (each constant in the
> order it is declared, ending with this task's new ones). If Step 8 below
> fails on an ordering mismatch, the fix is to correct this test's array to
> match the real declaration order in those two files — never reorder the
> declarations themselves to match the test, since other code may already
> depend on the constant *values* (not their declaration order) and
> reordering the source files risks an unrelated diff.

- [ ] **Step 8: Run the vocabulary test to verify it passes**

Run: `cd backend && php artisan test --filter=AuditVocabularyTest`

Expected: PASS, both tests (this also resolves the two pre-existing
failures noted in Task 1).

- [ ] **Step 9: Run the full backend suite to confirm no regressions**

Run: `cd backend && php artisan test`

Expected: every test passes, with zero failures now (the pre-existing
`AuditVocabularyTest` failures are gone).

- [ ] **Step 10: Run PHPStan**

Run: `cd backend && ./vendor/bin/phpstan analyse`

Expected: no new errors.

- [ ] **Step 11: Commit**

```bash
cd /c/xampp/htdocs/GRC-ENROLLMENT
git add backend/app/Domain/Enrollment/QueueCycleStatus.php backend/app/Models/QueueCycle.php backend/app/Domain/Audit/AuditAction.php backend/app/Domain/Audit/AuditableType.php backend/app/Domain/Notifications/NotificationType.php backend/tests/Unit/Domain/Audit/AuditVocabularyTest.php backend/tests/Unit/Domain/Enrollment/QueueCycleStatusTest.php backend/tests/Unit/Models/QueueCycleTest.php
git commit -m "feat(queue): add QueueCycleStatus, isDrained(), and claim/cut-off vocabulary

Adds the derived open/cut_off/closed status and the drain check
ClaimQueueTicket and TransitionQueueCycle need in the next tasks,
plus the new audit and notification constants those actions will
record. Also repairs AuditVocabularyTest, which was already failing
on main against six pre-existing constants its expected arrays never
picked up.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017PdBvDW7rzZNEyJAGqYyya"
```

---

### Task 3: `ClaimQueueTicket` action, cycle-aware ordering, and the claim endpoint

**Files:**
- Create: `backend/app/Actions/Enrollment/ClaimQueueTicket.php`
- Create: `backend/app/Http/Requests/Api/V1/QueueTicket/StoreQueueTicketRequest.php`
- Create: `backend/tests/Feature/Api/V1/ClaimQueueTicketEndpointTest.php`
- Modify: `backend/app/Models/QueueTicket.php` (`position()`)
- Modify: `backend/app/Actions/Enrollment/ListQueueTickets.php`
- Modify: `backend/app/Http/Requests/Api/V1/QueueTicket/IndexQueueTicketRequest.php`
- Modify: `backend/app/Http/Controllers/Api/V1/QueueTicketController.php`
- Modify: `backend/app/Policies/EnrollmentPolicy.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/tests/Feature/Api/V1/QueueTicketsEndpointTest.php` (`makeTicket()` helper only)
- Modify: `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`

**Interfaces:**
- Consumes: `QueueCycle::isDrained()`, `QueueServiceDate::today()`/`::timezone()` (Task 1-2). `AuditRecorder::record(...)`, `NotificationRecorder::recordManyForRole(...)` (existing, unchanged signatures). `AuditAction::QUEUE_TICKET_CLAIMED`, `AuditableType::QUEUE_TICKET`, `AuditableType::QUEUE_CYCLE`, `AuditAction::QUEUE_CYCLE_CLOSED`, `NotificationType::QueueTicketClaimed` (Task 2).
- Produces: `App\Actions\Enrollment\ClaimQueueTicket::execute(Enrollment $enrollment, User $actor, AuditRequestContext $context): QueueTicket` — consumed by Task 9's Cashier "issue on behalf" UI wiring (via the same `POST /queue-tickets` endpoint) and, in a later slice, the kiosk. `EnrollmentPolicy::claimQueueTicket(User $user, Enrollment $enrollment): bool` — consumed nowhere else in this plan but is the permanent authorization surface for claiming. `QueueTicket::position()`'s cycle-aware ordering — consumed by Task 5 (`FindCashierPaymentCandidate` callers), Task 8 (`BuildStudentQueueView`), and `EnrollmentResource` (already calls it, unchanged call site).

- [ ] **Step 1: Write the failing ordering tests first**

Open `backend/tests/Feature/Api/V1/QueueTicketsEndpointTest.php`. Replace
the `makeTicket()` helper (it must now create/attach a `QueueCycle`, since
`queue_cycle_id` is read by the new `position()`/`ListQueueTickets`):

```php
    private function makeTicket(StudentProfile $student, AcademicTerm $term, string $ticketNumber, string $queueDate = '2026-08-01', QueueTicketStatus $status = QueueTicketStatus::Waiting): QueueTicket
    {
        $enrollment = Enrollment::create([
            'student_id' => $student->id,
            'academic_term_id' => $term->id,
            'status' => EnrollmentStatus::PendingPayment,
            'total_units' => 3,
            'submitted_at' => now(),
        ]);
        $cycle = QueueCycle::query()->whereNull('closed_at')->first()
            ?? QueueCycle::create(['opened_on' => $queueDate, 'last_ticket_sequence' => 0]);
        $sequence = $cycle->last_ticket_sequence + 1;
        $cycle->update(['last_ticket_sequence' => $sequence, 'last_claimed_on' => $queueDate]);

        return QueueTicket::create([
            'enrollment_id' => $enrollment->id,
            'queue_cycle_id' => $cycle->id,
            'ticket_sequence' => $sequence,
            'ticket_number' => $ticketNumber,
            'queue_date' => $queueDate,
            'status' => $status,
        ]);
    }
```

Add `use App\Models\QueueCycle;` to the file's imports, immediately after
`use App\Models\Program;`.

Add these two new tests immediately after
`test_a_requeued_priority_ticket_still_precedes_regular_tickets`:

```php
    public function test_a_carry_over_ticket_from_an_earlier_date_stays_ahead_of_todays_new_tickets(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $studentA = $this->makeStudent($curriculum, 'a.carry@grc.test', '2026-1001');
        $studentB = $this->makeStudent($curriculum, 'b.carry@grc.test', '2026-1002');
        $carryOver = $this->makeTicket($studentA, $term, 'Q000048', '2026-08-22');
        $today = $this->makeTicket($studentB, $term, 'Q000050', '2026-08-23');

        self::assertSame($carryOver->queue_cycle_id, $today->queue_cycle_id);
        self::assertSame(0, $carryOver->position());
        self::assertSame(1, $today->position());
    }

    public function test_a_carry_over_ticket_re_skipped_today_stays_ahead_of_todays_new_tickets_only(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $studentA = $this->makeStudent($curriculum, 'a.reskip@grc.test', '2026-1001');
        $studentB = $this->makeStudent($curriculum, 'b.reskip@grc.test', '2026-1002');
        $carryOver = $this->makeTicket($studentA, $term, 'Q000048', '2026-08-22', QueueTicketStatus::Serving);
        $today = $this->makeTicket($studentB, $term, 'Q000050', '2026-08-23');
        $token = $this->tokenForNewUser(UserRole::AccountingStaff, 'accounting.reskip@grc.test');

        $this->withToken($token)->patchJson("/api/v1/queue-tickets/{$carryOver->id}", ['action' => 'skip'])->assertOk();

        // Skipped again today, but it still belongs to Friday's group --
        // it goes to the back of ITS OWN queue_date, not behind Saturday's
        // walk-ins.
        self::assertSame(0, $carryOver->refresh()->position());
        self::assertSame(1, $today->refresh()->position());
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && php artisan test --filter=QueueTicketsEndpointTest`

Expected: FAIL — the two new tests fail (either an assertion mismatch,
since `position()` still scopes by `queue_date` and never compares two
different dates the way these tests need, or a null-`queue_cycle_id`
assertion mismatch since `ClaimQueueTicket` does not exist yet to have
assigned one — `makeTicket()` assigns `queue_cycle_id` itself so this part
already passes; the ordering assertions are what fail). Other tests in the
file should still pass (the helper change is additive and preserves
existing single-date behavior).

- [ ] **Step 3: Fix `QueueTicket::position()`'s scope and ordering**

Open `backend/app/Models/QueueTicket.php`. Replace the entire `position()`
method (everything from `public function position(): ?int` to its closing
`}`):

```php
    /**
     * How many other `waiting` tickets stand ahead of this one in the
     * current open cycle — the whole queue is never exposed to a student
     * (privacy), only their own count. `null` once this ticket has left
     * `waiting`. Priority tickets always precede regular ones within the
     * same cycle; within a tier, ordered by `queue_date` (a cycle can span
     * multiple Manila service days once a cut-off carries tickets forward
     * — a carry-over always sorts ahead of a same-cycle ticket claimed on a
     * later date), then `COALESCE(requeued_at, created_at)` — arrival
     * order for a never-skipped ticket, or the moment it was last requeued
     * for one that was — with `id` as the final tiebreaker for a true
     * timestamp tie. Mirrors `App\Actions\Enrollment\ListQueueTickets`'s
     * ordering exactly; see docs/superpowers/specs/
     * 2026-08-23-queue-kiosk-claim-carryover-cutoff-design.md for why the
     * `queue_date` term is required once a cycle spans multiple dates.
     */
    public function position(): ?int
    {
        if ($this->status !== QueueTicketStatus::Waiting) {
            return null;
        }

        $waitingInCycle = self::query()
            ->where('queue_cycle_id', $this->queue_cycle_id)
            ->where('status', QueueTicketStatus::Waiting);

        $applyOrderedBefore = function ($query): void {
            $selfDate = $this->queue_date->toDateString();
            $effectiveOrder = $this->effectiveOrder()->format('Y-m-d H:i:s');
            $selfWasRequeued = (int) ($this->requeued_at !== null);

            $query->where(function ($query) use ($selfDate, $effectiveOrder, $selfWasRequeued) {
                $query->where('queue_date', '<', $selfDate)
                    ->orWhere(function ($query) use ($selfDate, $effectiveOrder, $selfWasRequeued) {
                        $query->where('queue_date', $selfDate)
                            ->where(function ($query) use ($effectiveOrder, $selfWasRequeued) {
                                $query->whereRaw('COALESCE(requeued_at, created_at) < ?', [$effectiveOrder])
                                    ->orWhere(function ($query) use ($effectiveOrder, $selfWasRequeued) {
                                        $query->whereRaw('COALESCE(requeued_at, created_at) = ?', [$effectiveOrder])
                                            ->where(function ($query) use ($selfWasRequeued) {
                                                $query->whereRaw('(requeued_at IS NOT NULL) < ?', [$selfWasRequeued])
                                                    ->orWhere(function ($query) use ($selfWasRequeued) {
                                                        $query->whereRaw('(requeued_at IS NOT NULL) = ?', [$selfWasRequeued])
                                                            ->where('id', '<', $this->id);
                                                    });
                                            });
                                    });
                            });
                    });
            });
        };

        if ($this->priority === QueueTicketPriority::Priority) {
            $priorityQuery = (clone $waitingInCycle)->where('priority', QueueTicketPriority::Priority);
            $applyOrderedBefore($priorityQuery);

            return $priorityQuery->count();
        }

        $priorityAhead = (clone $waitingInCycle)
            ->where('priority', QueueTicketPriority::Priority)
            ->count();

        $regularQuery = (clone $waitingInCycle)->where('priority', QueueTicketPriority::Regular);
        $applyOrderedBefore($regularQuery);
        $regularAhead = $regularQuery->count();

        return $priorityAhead + $regularAhead;
    }
```

Add `?int $queue_cycle_id` and `?int $ticket_sequence` to the class's
`@property` PHPDoc block, immediately after `@property string $ticket_number`:

```php
 * @property ?int $queue_cycle_id
 * @property ?int $ticket_sequence
```

Add `'queue_cycle_id'` and `'ticket_sequence'` to `$fillable`, immediately
after `'enrollment_id',`:

```php
        'queue_cycle_id',
```

and immediately after `'ticket_number',`:

```php
        'ticket_sequence',
```

- [ ] **Step 4: Fix `ListQueueTickets`**

Open `backend/app/Actions/Enrollment/ListQueueTickets.php`. Replace the
entire file:

```php
<?php

namespace App\Actions\Enrollment;

use App\Models\QueueCycle;
use App\Models\QueueTicket;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * PRD §5.3 FR-FIN-006: Accounting Staff's operational view of the payment
 * queue. `cycle=open` scopes to the single currently-open `queue_cycles`
 * row — the current line, which may span multiple Manila service days
 * once a cut-off has carried tickets forward (see docs/superpowers/specs/
 * 2026-08-23-queue-kiosk-claim-carryover-cutoff-design.md). `queue_date`
 * remains available as an independent "claimed on this date" filter, no
 * longer the scope key.
 *
 * Ordered deterministically by `queue_date` then the ticket's effective
 * order (`COALESCE(requeued_at, created_at)`, then the requeued-regime
 * split, then `id`) -- plain arrival order for a never-skipped ticket, or
 * requeue order for one that was skipped. §17 leaves any reset or priority
 * policy unconfirmed, so no priority-tier ordering is asserted at this
 * list level (the Cashier's own waiting-line display sorts by priority
 * tier itself; see `byQueueOrder` in `accounting-payment-workspace.tsx`).
 *
 * A tie on that effective order (routine under a fast test suite, and not
 * impossible at a real front desk, since `created_at`/`requeued_at` are
 * whole-second columns) can't be broken by `id` alone: a low-id ticket
 * requeued after a higher-id ticket already exists must now sort *after*
 * it, which a plain `id` comparison gets backwards. So the tie first
 * splits on `requeued_at IS NOT NULL` -- never-requeued (arrival order)
 * always precedes requeued (skip moment) -- and only falls back to `id`
 * once both candidates agree on that split. This mirrors
 * `QueueTicket::position()`'s own tie-break exactly, so the two never
 * disagree on the order of the same pair of tickets.
 */
final readonly class ListQueueTickets
{
    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, QueueTicket>
     */
    public function execute(array $filters): LengthAwarePaginator
    {
        $queueDate = isset($filters['queue_date']) ? (string) $filters['queue_date'] : null;
        $status = isset($filters['status']) ? (string) $filters['status'] : null;
        $cycle = isset($filters['cycle']) ? (string) $filters['cycle'] : null;
        $page = isset($filters['page']) ? (int) $filters['page'] : 1;
        $perPage = isset($filters['per_page']) ? (int) $filters['per_page'] : 20;

        $openCycleId = $cycle === 'open' ? QueueCycle::query()->whereNull('closed_at')->value('id') : null;

        return QueueTicket::query()
            ->with(['enrollment.student'])
            ->when($queueDate !== null, fn ($query) => $query->whereDate('queue_date', $queueDate))
            ->when($status !== null, fn ($query) => $query->where('status', $status))
            ->when($cycle === 'open', function ($query) use ($openCycleId) {
                if ($openCycleId === null) {
                    // No open cycle exists (fresh install, or everything has
                    // drained) -- the correct answer is an empty list, never
                    // every historical ticket. `whereRaw` guarantees this
                    // regardless of how Eloquent would otherwise translate a
                    // null comparison.
                    $query->whereRaw('1 = 0');

                    return;
                }

                $query->where('queue_cycle_id', $openCycleId);
            })
            ->orderBy('queue_date')
            ->orderByRaw('COALESCE(requeued_at, created_at)')
            ->orderByRaw('requeued_at IS NOT NULL')
            ->orderBy('id')
            ->paginate($perPage, ['*'], 'page', $page)
            ->withQueryString();
    }
}
```

Open `backend/app/Http/Requests/Api/V1/QueueTicket/IndexQueueTicketRequest.php`.
Add a `cycle` rule to the `rules()` array, immediately after
`'status' => [...]`:

```php
            'cycle' => ['sometimes', Rule::in(['open'])],
```

- [ ] **Step 5: Run the ordering tests to verify they pass**

Run: `cd backend && php artisan test --filter=QueueTicketsEndpointTest`

Expected: PASS, all tests including the two new ones.

- [ ] **Step 6: Write the failing claim endpoint tests**

Create `backend/tests/Feature/Api/V1/ClaimQueueTicketEndpointTest.php`:

```php
<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Audit\AuditAction;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Enrollment\QueueTicketStatus;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\ProgramStatus;
use App\Models\AcademicTerm;
use App\Models\AuditLog;
use App\Models\Curriculum;
use App\Models\Enrollment;
use App\Models\Program;
use App\Models\QueueCycle;
use App\Models\QueueTicket;
use App\Models\StudentProfile;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class ClaimQueueTicketEndpointTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_a_student_can_claim_their_own_ticket(): void
    {
        [$studentToken, $enrollment] = $this->makeApprovedStudent('2026-08-00001');

        $response = $this->withToken($studentToken)->postJson('/api/v1/queue-tickets');

        $response->assertCreated()
            ->assertJsonPath('data.ticket_number', 'Q001')
            ->assertJsonPath('data.status', 'waiting')
            ->assertJsonPath('data.enrollment_id', $enrollment->id);
        self::assertSame(AuditAction::QUEUE_TICKET_CLAIMED, AuditLog::query()->sole()->action);
    }

    public function test_claiming_twice_returns_the_same_ticket(): void
    {
        [$studentToken] = $this->makeApprovedStudent('2026-08-00002');

        $first = $this->withToken($studentToken)->postJson('/api/v1/queue-tickets');
        $second = $this->withToken($studentToken)->postJson('/api/v1/queue-tickets');

        self::assertSame($first->json('data.id'), $second->json('data.id'));
        self::assertSame(1, QueueTicket::query()->count());
    }

    public function test_a_student_with_no_pending_payment_enrollment_cannot_claim(): void
    {
        $token = $this->tokenForNewUser(UserRole::Student, 'no.enrollment@grc.test');

        $this->withToken($token)->postJson('/api/v1/queue-tickets')
            ->assertUnprocessable()
            ->assertJsonPath('error.errors.student_number.0', 'No enrollment pending payment was found for this student.');
    }

    public function test_accounting_staff_can_issue_a_ticket_for_a_student_by_number(): void
    {
        [, $enrollment] = $this->makeApprovedStudent('2026-08-00003');
        $token = $this->tokenForNewUser(UserRole::AccountingStaff, 'issuer@grc.test');

        $this->withToken($token)->postJson('/api/v1/queue-tickets', ['student_number' => '2026-08-00003'])
            ->assertCreated()
            ->assertJsonPath('data.enrollment_id', $enrollment->id);
    }

    public function test_registrar_staff_cannot_claim_for_a_student(): void
    {
        $this->makeApprovedStudent('2026-08-00004');
        $token = $this->tokenForNewUser(UserRole::RegistrarStaff, 'registrar@grc.test');

        $this->withToken($token)->postJson('/api/v1/queue-tickets', ['student_number' => '2026-08-00004'])
            ->assertForbidden();
    }

    public function test_numbering_continues_across_a_cut_off_carry_over(): void
    {
        $cycle = QueueCycle::create(['opened_on' => '2026-08-22', 'last_ticket_sequence' => 47, 'last_claimed_on' => '2026-08-22']);
        [$studentToken] = $this->makeApprovedStudent('2026-08-00005');
        CarbonImmutable::setTestNow('2026-08-23 01:00:00'); // 09:00 PHT

        $this->withToken($studentToken)->postJson('/api/v1/queue-tickets')
            ->assertCreated()
            ->assertJsonPath('data.ticket_number', 'Q048');
        self::assertSame($cycle->id, QueueTicket::query()->sole()->queue_cycle_id);
    }

    public function test_numbering_resets_once_the_cycle_is_fully_drained_on_an_earlier_date(): void
    {
        QueueCycle::create([
            'opened_on' => '2026-08-20', 'last_ticket_sequence' => 12, 'last_claimed_on' => '2026-08-20',
        ]);
        [$studentToken] = $this->makeApprovedStudent('2026-08-00006');
        CarbonImmutable::setTestNow('2026-08-23 01:00:00'); // 09:00 PHT, no outstanding tickets anywhere

        $this->withToken($studentToken)->postJson('/api/v1/queue-tickets')
            ->assertCreated()
            ->assertJsonPath('data.ticket_number', 'Q001');
        self::assertSame(2, QueueCycle::query()->count());
        self::assertNotNull(QueueCycle::query()->where('opened_on', '2026-08-20')->sole()->closed_at);
    }

    public function test_queue_date_uses_manila_time_not_utc(): void
    {
        [$studentToken] = $this->makeApprovedStudent('2026-08-00007');
        // 23:30 UTC on the 22nd is 07:30 on the 23rd in Manila.
        CarbonImmutable::setTestNow('2026-08-22 23:30:00');

        $this->withToken($studentToken)->postJson('/api/v1/queue-tickets')->assertCreated();

        self::assertSame('2026-08-23', QueueTicket::query()->sole()->queue_date->toDateString());
    }

    /**
     * @return array{string, Enrollment}
     */
    private function makeApprovedStudent(string $studentNumber): array
    {
        $term = AcademicTerm::query()->firstOrCreate(
            ['school_year' => '2026-2027', 'semester' => '1st'],
            ['status' => AcademicTermStatus::SemesterOngoing],
        );
        $program = Program::create(['code' => 'BSCS-'.$studentNumber, 'name' => 'BS Computer Science', 'status' => ProgramStatus::Active]);
        $curriculum = Curriculum::create([
            'program_id' => $program->id, 'name' => 'BSCS Curriculum',
            'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Active,
        ]);
        $user = User::create([
            'name' => 'Claim Test Student', 'email' => 'claim.'.$studentNumber.'@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::Student, 'status' => UserStatus::Active,
        ]);
        $student = StudentProfile::create([
            'user_id' => $user->id, 'student_number' => $studentNumber,
            'program_id' => $program->id, 'curriculum_id' => $curriculum->id, 'year_level' => 1,
            'admission_status' => AdmissionStatus::Admitted, 'academic_standing' => AcademicStanding::Good,
        ]);
        $enrollment = Enrollment::create([
            'student_id' => $student->id, 'academic_term_id' => $term->id,
            'status' => EnrollmentStatus::PendingPayment, 'total_units' => 3,
        ]);

        $token = (string) $this->postJson('/api/v1/auth/login', [
            'email' => $user->email, 'password' => self::PASSWORD,
        ])->json('data.token');

        return [$token, $enrollment];
    }

    private function tokenForNewUser(UserRole $role, string $email): string
    {
        User::create([
            'name' => 'Test '.$role->value, 'email' => $email,
            'password' => self::PASSWORD, 'role' => $role, 'status' => UserStatus::Active,
        ]);

        return (string) $this->postJson('/api/v1/auth/login', [
            'email' => $email, 'password' => self::PASSWORD,
        ])->json('data.token');
    }
}
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `cd backend && php artisan test --filter=ClaimQueueTicketEndpointTest`

Expected: FAIL — `POST /api/v1/queue-tickets` does not exist yet (404).

- [ ] **Step 8: Create `ClaimQueueTicket`**

Create `backend/app/Actions/Enrollment/ClaimQueueTicket.php`:

```php
<?php

namespace App\Actions\Enrollment;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Enrollment\QueueServiceDate;
use App\Domain\Enrollment\QueueTicketPriority;
use App\Domain\Enrollment\QueueTicketStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Notifications\NotificationType;
use App\Models\Enrollment;
use App\Models\QueueCycle;
use App\Models\QueueTicket;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use App\Support\Notifications\NotificationRecorder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Issues the one queue ticket an approved (`pending_payment`) enrollment
 * may ever hold (`unique(enrollment_id)` on `queue_tickets` makes this
 * idempotent by construction — a repeat claim returns the existing ticket
 * rather than erroring). Replaces the old registrar-approval-time
 * auto-issue (see `TransitionEnrollment`): a student now has no queue
 * number until they claim one, or Accounting Staff issues one on their
 * behalf.
 *
 * Numbering is scoped to the single open `queue_cycles` row, not the
 * calendar day — a cycle can span multiple service days once a cut-off
 * carries unserved tickets forward (see `QueueCycle`). Allocation locks
 * that one row (`lockForUpdate`), never `queue_tickets`, so concurrent
 * claims serialize on a single integer bump rather than a table scan. See
 * docs/superpowers/specs/2026-08-23-queue-kiosk-claim-carryover-cutoff-design.md.
 */
final readonly class ClaimQueueTicket
{
    private const MAX_ALLOCATION_ATTEMPTS = 3;

    public function __construct(
        private AuditRecorder $auditRecorder,
        private NotificationRecorder $notificationRecorder,
    ) {}

    public function execute(Enrollment $enrollment, User $actor, AuditRequestContext $context): QueueTicket
    {
        $existing = QueueTicket::query()->where('enrollment_id', $enrollment->id)->first();

        if ($existing !== null) {
            return $existing;
        }

        for ($attempt = 1; ; $attempt++) {
            try {
                return DB::transaction(fn (): QueueTicket => $this->allocate($enrollment, $actor, $context));
            } catch (QueryException $exception) {
                // The only unique constraints reachable inside allocate()
                // are queue_cycles_single_open_cycle_unique and
                // (queue_cycle_id, ticket_sequence) — queue_tickets'
                // pre-check above means a duplicate-enrollment collision is
                // also always this: any 23000 here is an allocation
                // collision from a concurrent claim, safe to retry.
                if ($attempt >= self::MAX_ALLOCATION_ATTEMPTS || $exception->getCode() !== '23000') {
                    throw $exception;
                }

                usleep(random_int(2_000, 20_000));
            }
        }
    }

    private function allocate(Enrollment $enrollment, User $actor, AuditRequestContext $context): QueueTicket
    {
        // Re-check inside the transaction: a concurrent claim for the same
        // enrollment may have committed between the pre-check in execute()
        // and this attempt starting.
        $existing = QueueTicket::query()->where('enrollment_id', $enrollment->id)->first();

        if ($existing !== null) {
            return $existing;
        }

        $today = QueueServiceDate::today();
        $cycle = QueueCycle::query()->whereNull('closed_at')->lockForUpdate()->first();

        if ($cycle !== null
            && $cycle->last_claimed_on !== null
            && $cycle->last_claimed_on->toDateString() < $today
            && $cycle->isDrained()) {
            $cycle->update(['closed_at' => now()]);
            $this->auditRecorder->record(
                $actor,
                AuditAction::QUEUE_CYCLE_CLOSED,
                AuditableType::QUEUE_CYCLE,
                $cycle->id,
                ['closed_at' => null],
                ['closed_at' => now()->utc()->format('Y-m-d\TH:i:s\Z')],
                null,
                $context,
            );
            $cycle = null;
        }

        if ($cycle === null) {
            // RACE: two claims can both see no open cycle and both INSERT.
            // There is no row to lock, so lockForUpdate() cannot serialize
            // this specific case — the single-open-cycle generated-column
            // unique index is what makes the loser's insert throw 23000;
            // execute()'s retry then finds and locks the winner's row.
            $cycle = QueueCycle::create(['opened_on' => $today, 'last_ticket_sequence' => 0]);
            $cycle = QueueCycle::query()->whereKey($cycle->id)->lockForUpdate()->firstOrFail();
        }

        $sequence = $cycle->last_ticket_sequence + 1;

        $ticket = QueueTicket::create([
            'enrollment_id' => $enrollment->id,
            'queue_cycle_id' => $cycle->id,
            'ticket_sequence' => $sequence,
            'ticket_number' => sprintf('Q%03d', $sequence),
            'queue_date' => $today,
            'status' => QueueTicketStatus::Waiting,
            'priority' => QueueTicketPriority::Regular,
        ]);

        $cycle->update(['last_ticket_sequence' => $sequence, 'last_claimed_on' => $today]);

        $this->auditRecorder->record(
            $actor,
            AuditAction::QUEUE_TICKET_CLAIMED,
            AuditableType::QUEUE_TICKET,
            $ticket->id,
            null,
            ['ticket_number' => $ticket->ticket_number, 'queue_cycle_id' => $cycle->id],
            null,
            $context,
        );

        $this->notificationRecorder->recordManyForRole(
            UserRole::AccountingStaff,
            NotificationType::QueueTicketClaimed,
            "{$enrollment->student->student_number} claimed queue ticket {$ticket->ticket_number}.",
        );

        return $ticket->load(['enrollment.student']);
    }
}
```

- [ ] **Step 9: Create `StoreQueueTicketRequest`**

Create `backend/app/Http/Requests/Api/V1/QueueTicket/StoreQueueTicketRequest.php`:

```php
<?php

namespace App\Http\Requests\Api\V1\QueueTicket;

use Illuminate\Foundation\Http\FormRequest;

/**
 * `student_number` is required only when Accounting Staff issues a ticket
 * on a student's behalf at the front desk; a Student claiming their own
 * ticket sends an empty body. `EnrollmentPolicy::claimQueueTicket` and
 * `QueueTicketController::resolveEnrollment` are what actually enforce
 * which caller may omit it — this request only validates shape.
 */
final class StoreQueueTicketRequest extends FormRequest
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
            'student_number' => ['sometimes', 'string', 'max:255'],
        ];
    }
}
```

- [ ] **Step 10: Add `claimQueueTicket` to `EnrollmentPolicy`**

Open `backend/app/Policies/EnrollmentPolicy.php`. Add this method at the
end of the class, immediately before the final closing `}`:

```php

    /**
     * The queue kiosk claim (a later slice adds the kiosk's own
     * authentication on top of this — this ability is the permanent
     * "who may ever produce this enrollment's one queue ticket" rule):
     * the owning Student, or any Accounting Staff member issuing on a
     * student's behalf at the front desk. Same ownership shape as
     * `withdraw`/`requestChange`, plus the front-desk override — see
     * `App\Actions\Enrollment\ClaimQueueTicket`.
     */
    public function claimQueueTicket(User $user, Enrollment $enrollment): bool
    {
        return ($user->role === UserRole::Student && $enrollment->student->user_id === $user->id)
            || $user->role === UserRole::AccountingStaff;
    }
```

- [ ] **Step 11: Add `store()` to `QueueTicketController`**

Open `backend/app/Http/Controllers/Api/V1/QueueTicketController.php`.
Replace the file's imports (everything between `namespace` and the class
declaration):

```php
namespace App\Http\Controllers\Api\V1;

use App\Actions\Enrollment\ClaimQueueTicket;
use App\Actions\Enrollment\ListQueueTickets;
use App\Actions\Enrollment\TransitionQueueTicket;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Organization\AcademicTermStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\QueueTicket\IndexQueueTicketRequest;
use App\Http\Requests\Api\V1\QueueTicket\StoreQueueTicketRequest;
use App\Http\Requests\Api\V1\QueueTicket\UpdateQueueTicketRequest;
use App\Http\Resources\Api\V1\QueueTicketResource;
use App\Models\AcademicTerm;
use App\Models\Enrollment;
use App\Models\QueueTicket;
use App\Models\StudentProfile;
use App\Models\User;
use App\Support\Audit\AuditRequestContextFactory;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
```

Add this `store()` method to the class, immediately after `index()` and
before `update()`:

```php
    /**
     * @throws AuthenticationException
     */
    public function store(
        StoreQueueTicketRequest $request,
        ClaimQueueTicket $claimQueueTicket,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);
        $enrollment = $this->resolveEnrollment($actor, $request->validated('student_number'));

        $this->authorize('claimQueueTicket', $enrollment);

        $ticket = $claimQueueTicket->execute($enrollment, $actor, $contextFactory->fromRequest($request));

        $response = QueueTicketResource::make($ticket)->response($request)->setStatusCode(201);

        return $this->cachePrivateResponse($response);
    }
```

Add this private method, immediately after `authenticatedUser()`:

```php
    private function resolveEnrollment(User $actor, ?string $studentNumber): Enrollment
    {
        $term = AcademicTerm::query()->where('status', AcademicTermStatus::SemesterOngoing)->first();

        if ($term === null) {
            throw ValidationException::withMessages([
                'student_number' => 'No academic term is currently open for enrollment.',
            ]);
        }

        if ($actor->role === UserRole::AccountingStaff) {
            if ($studentNumber === null) {
                throw ValidationException::withMessages(['student_number' => 'A student number is required.']);
            }

            $student = StudentProfile::query()->where('student_number', $studentNumber)->first();
        } else {
            $student = StudentProfile::query()->where('user_id', $actor->id)->first();
        }

        $enrollment = $student === null ? null : Enrollment::query()
            ->where('student_id', $student->id)
            ->where('academic_term_id', $term->id)
            ->where('status', EnrollmentStatus::PendingPayment)
            ->first();

        if ($enrollment === null) {
            throw ValidationException::withMessages([
                'student_number' => 'No enrollment pending payment was found for this student.',
            ]);
        }

        return $enrollment;
    }
```

- [ ] **Step 12: Add the route**

Open `backend/routes/api.php`. Add this route immediately after the
`enrollments/{enrollment}/change-requests` route block (the group of
routes ending around what is currently line 210, right before the "Role-scoped
read (Student own, Registrar Head and Registrar Staff" comment):

```php

        // FR-FIN-006 (queue kiosk claim): Student claims their own ticket,
        // or Accounting Staff issues one on a student's behalf at the
        // front desk. No `role:` middleware — EnrollmentPolicy::
        // claimQueueTicket resolves both cases; see ClaimQueueTicket. Sits
        // outside the accounting-only queue-tickets group below since a
        // Student must also reach it.
        Route::post('/queue-tickets', [QueueTicketController::class, 'store'])->name('queue-tickets.store');
```

- [ ] **Step 13: Update `ApiSurfaceTest`**

Open `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`. Find the routes
list containing `'PATCH api/v1/queue-tickets/{queueTicket}',` (around line
92) and add immediately before it:

```php
            'POST api/v1/queue-tickets',
```

Find the route-names list containing `'api.v1.queue-tickets.index',` and
`'api.v1.queue-tickets.update',` (around lines 176-177) and add between
them:

```php
            'api.v1.queue-tickets.store',
```

- [ ] **Step 14: Run all new and touched tests**

Run: `cd backend && php artisan test --filter=ClaimQueueTicketEndpointTest`

Expected: PASS, all 9 tests.

Run: `cd backend && php artisan test --filter=ApiSurfaceTest`

Expected: PASS.

- [ ] **Step 15: Run the full backend suite**

Run: `cd backend && php artisan test`

Expected: all tests pass.

- [ ] **Step 16: Run PHPStan**

Run: `cd backend && ./vendor/bin/phpstan analyse`

Expected: no new errors.

- [ ] **Step 17: Commit**

```bash
cd /c/xampp/htdocs/GRC-ENROLLMENT
git add backend/app/Actions/Enrollment/ClaimQueueTicket.php backend/app/Actions/Enrollment/ListQueueTickets.php backend/app/Models/QueueTicket.php backend/app/Http/Requests/Api/V1/QueueTicket/StoreQueueTicketRequest.php backend/app/Http/Requests/Api/V1/QueueTicket/IndexQueueTicketRequest.php backend/app/Http/Controllers/Api/V1/QueueTicketController.php backend/app/Policies/EnrollmentPolicy.php backend/routes/api.php backend/tests/Feature/Api/V1/ClaimQueueTicketEndpointTest.php backend/tests/Feature/Api/V1/QueueTicketsEndpointTest.php backend/tests/Feature/Api/V1/ApiSurfaceTest.php
git commit -m "feat(queue): add the claim endpoint and cycle-aware queue ordering

A Student can now claim their own queue ticket (or Accounting Staff
can issue one on their behalf) via POST /queue-tickets, allocated
against the single open queue_cycles row instead of the calendar
day. QueueTicket::position() and ListQueueTickets both gain a
queue_date ordering term so a carried-over ticket correctly stays
ahead of same-cycle tickets claimed on a later date -- the two were
previously guaranteed to agree only because every ticket shared one
queue_date by construction.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017PdBvDW7rzZNEyJAGqYyya"
```

---

### Task 4: `TransitionQueueTicket` — cycle-scoped single-active-serving, blocked while cut off

**Files:**
- Modify: `backend/app/Models/QueueTicket.php` (add `cycle()` relation)
- Modify: `backend/app/Actions/Enrollment/TransitionQueueTicket.php`
- Modify: `backend/tests/Feature/Api/V1/QueueTicketsEndpointTest.php`

**Interfaces:**
- Consumes: `QueueCycle` model (Task 1), `QueueCycleStatus`/`QueueCycle::status()` (Task 2).
- Produces: no new public interface — `TransitionQueueTicket::execute()` keeps its existing signature. `QueueTicket::cycle(): BelongsTo<QueueCycle, $this>` — consumed by any future caller that has a `QueueTicket` and needs its cycle without a second lookup (Task 6's own tests use it directly).

- [ ] **Step 1: Write the failing tests first**

Open `backend/tests/Feature/Api/V1/QueueTicketsEndpointTest.php`. Add these
two tests immediately after
`test_serving_a_new_ticket_completes_whatever_was_already_being_served_that_day`
(find it by searching the file — it asserts the existing single-active-serving
bulk-complete behavior):

```php
    public function test_serving_a_new_ticket_completes_a_carry_over_still_serving_from_an_earlier_date(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $studentA = $this->makeStudent($curriculum, 'a.carryserve@grc.test', '2026-1001');
        $studentB = $this->makeStudent($curriculum, 'b.carryserve@grc.test', '2026-1002');
        $carryOver = $this->makeTicket($studentA, $term, 'Q000048', '2026-08-22', QueueTicketStatus::Serving);
        $today = $this->makeTicket($studentB, $term, 'Q000050', '2026-08-23');
        $token = $this->tokenForNewUser(UserRole::AccountingStaff, 'accounting.carryserve@grc.test');

        $this->withToken($token)->patchJson("/api/v1/queue-tickets/{$today->id}", ['action' => 'serve'])->assertOk();

        // Before this fix, the bulk-complete was scoped to queue_date, so a
        // carry-over `serving` ticket from an earlier date was left
        // serving forever -- two simultaneous "now serving" tickets.
        self::assertSame('served', $carryOver->refresh()->status->value);
        self::assertSame('serving', $today->refresh()->status->value);
    }

    public function test_serve_is_blocked_while_the_cycle_is_cut_off_for_today(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum, 'a.cutoffserve@grc.test', '2026-1001');
        $ticket = $this->makeTicket($student, $term, 'Q000001');
        $ticket->cycle->update(['cut_off_at' => now(), 'cut_off_service_date' => \App\Domain\Enrollment\QueueServiceDate::today()]);
        $token = $this->tokenForNewUser(UserRole::AccountingStaff, 'accounting.cutoffserve@grc.test');

        $this->withToken($token)->patchJson("/api/v1/queue-tickets/{$ticket->id}", ['action' => 'serve'])
            ->assertUnprocessable()
            ->assertJsonPath('error.errors.action.0', "The queue is cut off for today. Resume it before serving another ticket.");
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && php artisan test --filter=QueueTicketsEndpointTest`

Expected: FAIL — the carry-over test fails because the bulk-complete still
scopes by `queue_date` (the carry-over ticket stays `serving`); the
cut-off test fails because no such guard exists yet, so the `serve`
succeeds (200, not 422).

- [ ] **Step 3: Add the `cycle()` relation**

Open `backend/app/Models/QueueTicket.php`. Add this import immediately
after `use App\Domain\Enrollment\QueueTicketStatus;`:

```php
use Illuminate\Database\Eloquent\Relations\BelongsTo;
```

(This import already exists in the file for the `enrollment()`/`server()`
relations — confirm it is not duplicated.) Add this relation immediately
after the existing `enrollment()` method:

```php
    /**
     * @return BelongsTo<QueueCycle, $this>
     */
    public function cycle(): BelongsTo
    {
        return $this->belongsTo(QueueCycle::class, 'queue_cycle_id');
    }
```

- [ ] **Step 4: Fix the bulk-complete scope and add the cut-off guard**

Open `backend/app/Actions/Enrollment/TransitionQueueTicket.php`. Add these
imports immediately after `use App\Domain\Enrollment\QueueTicketStatus;`:

```php
use App\Domain\Enrollment\QueueCycleStatus;
use App\Models\QueueCycle;
```

Replace the class docblock's second paragraph (the one starting "§17
leaves reset cadence..."):

```php
 * §17 leaves reset cadence and priority eligibility unconfirmed — this
 * Action enforces only the three-step order (`waiting` → `serving` →
 * `served`, with `skip` as a `waiting` re-entry — stamping `requeued_at`
 * to push the ticket to the back of its own priority tier, see
 * `QueueTicket::position()` — from either `waiting` or `serving`) and a
 * single-active-serving rule, never any numbering or eligibility policy.
 * The single-active-serving rule (and `serve`'s cut-off guard below) is
 * scoped to the ticket's `queue_cycle_id`, not `queue_date` — a cycle can
 * span multiple Manila service days once a cut-off carries tickets
 * forward, and a stale `queue_date` scope would leave a carry-over ticket
 * `serving` forever once a later-dated ticket in the same cycle is served.
 * No skip-count limit is enforced: PRD §17 leaves this whole area
 * provisional, and a cap would be inventing policy, not implementing an
 * approved one. No notification is sent: calling, completing, or skipping
 * a ticket is Accounting's own operational action, with no live-queue
 * display this slice implements to make a push notification meaningful yet.
```

Replace the body of `execute()`'s `DB::transaction` callback in full:

```php
        return DB::transaction(function () use ($ticket, $action, $actor, $context): QueueTicket {
            $lockedTicket = QueueTicket::query()
                ->whereKey($ticket->id)
                ->lockForUpdate()
                ->firstOrFail();
            $requiredStatuses = self::REQUIRED_CURRENT_STATUS[$action];

            if (! in_array($lockedTicket->status, $requiredStatuses, true)) {
                $expected = implode("' or '", array_map(
                    fn (QueueTicketStatus $status): string => $status->value,
                    $requiredStatuses,
                ));
                throw ValidationException::withMessages([
                    'action' => "This action requires the ticket to currently be '{$expected}'; ".
                        "it is currently '{$lockedTicket->status->value}'.",
                ]);
            }

            if ($action === 'serve') {
                $cycle = QueueCycle::query()->whereKey($lockedTicket->queue_cycle_id)->first();

                if ($cycle !== null && $cycle->status() === QueueCycleStatus::CutOff) {
                    throw ValidationException::withMessages([
                        'action' => 'The queue is cut off for today. Resume it before serving another ticket.',
                    ]);
                }
            }

            $beforeValues = self::snapshot($lockedTicket);
            $targetStatus = self::TARGET_STATUS[$action];

            if ($action === 'serve') {
                // Single-active-serving: calling a new number implicitly
                // completes whatever was already being served in this
                // cycle, rather than requiring the cashier to complete it
                // first. Scoped to queue_cycle_id, not queue_date -- see
                // this class's docblock. Not separately audited -- the
                // same bulk-update-without-per-row-audit precedent
                // ConfirmPayment already uses for EnrollmentSubject
                // transitions.
                QueueTicket::query()
                    ->where('queue_cycle_id', $lockedTicket->queue_cycle_id)
                    ->where('status', QueueTicketStatus::Serving)
                    ->whereKeyNot($lockedTicket->id)
                    ->update(['status' => QueueTicketStatus::Served, 'served_at' => now()]);
            }

            $lockedTicket->update([
                'status' => $targetStatus,
                'served_at' => $targetStatus === QueueTicketStatus::Served ? now() : $lockedTicket->served_at,
                'served_by' => $action === 'serve' ? $actor->id : $lockedTicket->served_by,
                'requeued_at' => $action === 'skip' ? now() : $lockedTicket->requeued_at,
            ]);
            $lockedTicket->refresh();

            $this->auditRecorder->record(
                $actor,
                self::AUDIT_ACTION[$action],
                AuditableType::QUEUE_TICKET,
                $lockedTicket->id,
                $beforeValues,
                self::snapshot($lockedTicket),
                null,
                $context,
            );

            return $lockedTicket->refresh()->load(['enrollment.student']);
        });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && php artisan test --filter=QueueTicketsEndpointTest`

Expected: PASS, all tests including the two new ones.

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && php artisan test`

Expected: all tests pass.

- [ ] **Step 7: Run PHPStan**

Run: `cd backend && ./vendor/bin/phpstan analyse`

Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
cd /c/xampp/htdocs/GRC-ENROLLMENT
git add backend/app/Models/QueueTicket.php backend/app/Actions/Enrollment/TransitionQueueTicket.php backend/tests/Feature/Api/V1/QueueTicketsEndpointTest.php
git commit -m "fix(queue): scope single-active-serving to the cycle, block serve while cut off

serve's bulk-complete was scoped to queue_date, so a carry-over
ticket left serving from an earlier date was never completed once a
later-dated ticket in the same cycle was served -- two simultaneous
'serving' tickets, with the Cashier UI free to pick either as 'now
serving' and confirm payment against the wrong one. Also blocks serve
outright while the cycle is cut off for today, since resuming is the
explicit signal that the Cashier is serving again.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017PdBvDW7rzZNEyJAGqYyya"
```

---

### Task 5: `FindCashierPaymentCandidate` — carry-over lookup and no-ticket-yet candidates

**Files:**
- Modify: `backend/app/Domain/Billing/CashierPaymentCandidate.php`
- Modify: `backend/app/Actions/Billing/FindCashierPaymentCandidate.php`
- Modify: `backend/app/Http/Resources/Api/V1/CashierPaymentCandidateResource.php`
- Modify: `backend/tests/Feature/Api/V1/CashierPaymentCandidateEndpointTest.php`

**Interfaces:**
- Consumes: `EnrollmentStatus::PendingPayment`, `QueueTicketStatus::Waiting`/`::Serving` (existing enums, unchanged).
- Produces: `CashierPaymentCandidate.ticket` becomes `?QueueTicket` (was `QueueTicket`) — the only consumer, `CashierPaymentCandidateResource`, is updated in this same task. `FindCashierPaymentCandidate::execute()` keeps its existing signature (`string $studentNumber): CashierPaymentCandidate`) but now also matches a `pending_payment` enrollment with **no** ticket at all, and a ticket from **any** date as long as its status is still `waiting`/`serving` — this is what makes Task 9's "Issue queue ticket" Cashier affordance possible.

- [ ] **Step 1: Write the failing tests first**

Open `backend/tests/Feature/Api/V1/CashierPaymentCandidateEndpointTest.php`.
Replace the `test_lookup_hides_missing_non_pending_completed_and_other_day_records`
test (it currently asserts that a ticket from an earlier `queue_date` is
hidden — that assertion describes the exact bug this task fixes, so it is
replaced rather than kept):

```php
    public function test_lookup_hides_missing_non_pending_and_completed_records(): void
    {
        $missingToken = $this->tokenFor(UserRole::AccountingStaff, 'accounting.missing.lookup@grc.test');
        $this->withToken($missingToken)
            ->getJson('/api/v1/cashier-payment-candidates?student_number=2026-06-09999')
            ->assertNotFound();

        [$completedStudent] = $this->makeCandidate(
            studentNumber: '2026-06-01002',
            enrollmentStatus: EnrollmentStatus::Enrolled,
        );
        [$servedStudent] = $this->makeCandidate(
            studentNumber: '2026-06-01003',
            status: QueueTicketStatus::Served,
        );

        foreach ([$completedStudent, $servedStudent] as $student) {
            $this->withToken($missingToken)
                ->getJson('/api/v1/cashier-payment-candidates?student_number='.$student->student_number)
                ->assertNotFound();
        }
    }

    public function test_lookup_finds_a_carried_over_ticket_from_an_earlier_date(): void
    {
        [$student, $enrollment, $ticket] = $this->makeCandidate(
            studentNumber: '2026-06-01005',
            queueDate: '2026-08-12', // three days before the frozen "today" (2026-08-14)
        );
        $token = $this->tokenFor(UserRole::AccountingStaff, 'accounting.carrylookup@grc.test');

        $this->withToken($token)
            ->getJson('/api/v1/cashier-payment-candidates?student_number='.$student->student_number)
            ->assertOk()
            ->assertJsonPath('data.enrollment_id', $enrollment->id)
            ->assertJsonPath('data.ticket.id', $ticket->id);
    }

    public function test_lookup_finds_a_pending_payment_student_with_no_ticket_yet(): void
    {
        [$student, $enrollment] = $this->makeCandidate(studentNumber: '2026-06-01006', withTicket: false);
        $token = $this->tokenFor(UserRole::AccountingStaff, 'accounting.noticketlookup@grc.test');

        $this->withToken($token)
            ->getJson('/api/v1/cashier-payment-candidates?student_number='.$student->student_number)
            ->assertOk()
            ->assertJsonPath('data.enrollment_id', $enrollment->id)
            ->assertJsonPath('data.ticket', null);
    }
```

Replace the `makeCandidate()` helper to support omitting the ticket:

```php
    /**
     * @return array{StudentProfile, Enrollment, ?QueueTicket}
     */
    private function makeCandidate(
        string $studentNumber = '2026-06-01001',
        EnrollmentStatus $enrollmentStatus = EnrollmentStatus::PendingPayment,
        QueueTicketStatus $status = QueueTicketStatus::Waiting,
        string $queueDate = '2026-08-14',
        bool $withTicket = true,
    ): array {
        $term = AcademicTerm::query()->firstOrCreate([
            'school_year' => '2026-2027',
            'semester' => '1st',
        ], [
            'status' => AcademicTermStatus::SemesterOngoing,
        ]);
        $program = Program::create([
            'code' => 'BSIT'.str_replace('-', '', $studentNumber),
            'name' => 'BS Information Technology',
            'status' => ProgramStatus::Active,
        ]);
        $curriculum = Curriculum::create([
            'program_id' => $program->id,
            'name' => 'BSIT Curriculum',
            'effective_school_year' => '2026-2027',
            'status' => CurriculumStatus::Active,
        ]);
        $studentUser = User::create([
            'name' => 'Student '.$studentNumber,
            'email' => 'student.'.$studentNumber.'@grc.test',
            'password' => self::PASSWORD,
            'role' => UserRole::Student,
            'status' => UserStatus::Active,
        ]);
        $student = StudentProfile::create([
            'user_id' => $studentUser->id,
            'student_number' => $studentNumber,
            'program_id' => $program->id,
            'curriculum_id' => $curriculum->id,
            'year_level' => 2,
            'admission_status' => AdmissionStatus::Admitted,
            'academic_standing' => AcademicStanding::Good,
        ]);
        $enrollment = Enrollment::create([
            'student_id' => $student->id,
            'academic_term_id' => $term->id,
            'status' => $enrollmentStatus,
            'total_units' => 6,
        ]);

        $ticket = null;
        if ($withTicket) {
            $cycle = QueueCycle::query()->whereNull('closed_at')->first()
                ?? QueueCycle::create(['opened_on' => $queueDate, 'last_ticket_sequence' => 0]);
            $sequence = $cycle->last_ticket_sequence + 1;
            $cycle->update(['last_ticket_sequence' => $sequence, 'last_claimed_on' => $queueDate]);
            $ticket = QueueTicket::create([
                'enrollment_id' => $enrollment->id,
                'queue_cycle_id' => $cycle->id,
                'ticket_sequence' => $sequence,
                'ticket_number' => 'Q'.str_pad((string) $student->id, 3, '0', STR_PAD_LEFT),
                'queue_date' => $queueDate,
                'status' => $status,
                'priority' => QueueTicketPriority::Regular,
                'served_at' => $status === QueueTicketStatus::Served ? now() : null,
            ]);
        }

        return [$student->load('user'), $enrollment, $ticket];
    }
```

Add `use App\Models\QueueCycle;` and `use App\Models\QueueTicket;` (the
latter for the return-type PHPDoc) to the file's imports if not already
present — `QueueTicket` is already imported; add `QueueCycle` immediately
after `use App\Models\Program;`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && php artisan test --filter=CashierPaymentCandidateEndpointTest`

Expected: FAIL — `test_lookup_finds_a_carried_over_ticket_from_an_earlier_date`
gets a 404 (the current `whereDate('queue_date', $queueDate)` scope still
excludes it); `test_lookup_finds_a_pending_payment_student_with_no_ticket_yet`
gets a 404 (the current query requires `whereHas('queueTicket', ...)`, so no
ticket means no match).

- [ ] **Step 3: Make `CashierPaymentCandidate.ticket` nullable**

Open `backend/app/Domain/Billing/CashierPaymentCandidate.php`. Replace the
entire file:

```php
<?php

namespace App\Domain\Billing;

use App\Models\Enrollment;
use App\Models\QueueTicket;
use App\Models\StudentProfile;

/**
 * The exact existing record a Cashier may bring into the payment workflow.
 * The lookup never creates, serves, skips, or confirms anything; it merely
 * returns the loaded records needed for the UI to decide whether the
 * existing queue transition can be offered. `ticket` is null when the
 * student is approved (`pending_payment`) but has not yet claimed a queue
 * ticket — the UI offers "Issue queue ticket" instead of "Serve" in that
 * case (see `App\Actions\Enrollment\ClaimQueueTicket`).
 */
final readonly class CashierPaymentCandidate
{
    public function __construct(
        public StudentProfile $student,
        public Enrollment $enrollment,
        public ?QueueTicket $ticket,
    ) {}
}
```

- [ ] **Step 4: Fix `FindCashierPaymentCandidate`**

Open `backend/app/Actions/Billing/FindCashierPaymentCandidate.php`. Replace
the entire file:

```php
<?php

namespace App\Actions\Billing;

use App\Domain\Billing\CashierPaymentCandidate;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Enrollment\QueueTicketStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Models\AcademicTerm;
use App\Models\Enrollment;
use Illuminate\Database\Eloquent\Builder;

/**
 * Restricts lookup to a Student who is actionable in the Cashier's current
 * queue. Keeping this a read-only query ensures finding a student can never
 * silently alter ticket order or enrollment/payment state.
 *
 * A candidate's ticket may be from any `queue_date`, not just today's —
 * once a cut-off carries an unserved ticket forward (see `QueueCycle`), the
 * ticket's original claim date no longer means "not currently in the
 * line"; its `status` (`waiting`/`serving`) is what does. A candidate may
 * also have no ticket at all: any `pending_payment` enrollment is a valid
 * lookup result, so Accounting Staff can issue a first ticket on a
 * student's behalf (`App\Actions\Enrollment\ClaimQueueTicket`) instead of
 * only ever serving an existing one.
 */
final readonly class FindCashierPaymentCandidate
{
    public function execute(string $studentNumber): CashierPaymentCandidate
    {
        $term = AcademicTerm::query()
            ->where('status', AcademicTermStatus::SemesterOngoing)
            ->firstOrFail();

        $enrollment = Enrollment::query()
            ->with(['student.user', 'queueTicket'])
            ->where('academic_term_id', $term->id)
            ->where('status', EnrollmentStatus::PendingPayment)
            ->whereHas('student', fn (Builder $query) => $query->where('student_number', $studentNumber))
            ->where(function (Builder $query) {
                $query->whereDoesntHave('queueTicket')
                    ->orWhereHas('queueTicket', fn (Builder $query) => $query->whereIn('status', [
                        QueueTicketStatus::Waiting->value,
                        QueueTicketStatus::Serving->value,
                    ]));
            })
            ->firstOrFail();

        return new CashierPaymentCandidate($enrollment->student, $enrollment, $enrollment->queueTicket);
    }
}
```

Note this removes the `LogicException` guard that previously asserted the
ticket was always present — it no longer is, by design.

- [ ] **Step 5: Update `CashierPaymentCandidateResource`**

Open `backend/app/Http/Resources/Api/V1/CashierPaymentCandidateResource.php`.
Replace the entire file:

```php
<?php

namespace App\Http\Resources\Api\V1;

use App\Domain\Billing\CashierPaymentCandidate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read CashierPaymentCandidate $resource
 */
final class CashierPaymentCandidateResource extends JsonResource
{
    /**
     * @return array{type: string, student_id: int, student_name: string, student_number: string, year_level: int, enrollment_id: int, ticket: ?array{id: int, ticket_number: string, status: string}}
     */
    public function toArray(Request $request): array
    {
        $ticket = $this->resource->ticket;

        return [
            'type' => 'cashier_payment_candidate',
            'student_id' => $this->resource->student->id,
            'student_name' => $this->resource->student->user->name,
            'student_number' => $this->resource->student->student_number,
            'year_level' => $this->resource->student->year_level,
            'enrollment_id' => $this->resource->enrollment->id,
            'ticket' => $ticket === null ? null : [
                'id' => $ticket->id,
                'ticket_number' => $ticket->ticket_number,
                'status' => $ticket->status->value,
            ],
        ];
    }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && php artisan test --filter=CashierPaymentCandidateEndpointTest`

Expected: PASS, all tests.

- [ ] **Step 7: Run the full backend suite**

Run: `cd backend && php artisan test`

Expected: all tests pass.

- [ ] **Step 8: Run PHPStan**

Run: `cd backend && ./vendor/bin/phpstan analyse`

Expected: no new errors.

- [ ] **Step 9: Commit**

```bash
cd /c/xampp/htdocs/GRC-ENROLLMENT
git add backend/app/Domain/Billing/CashierPaymentCandidate.php backend/app/Actions/Billing/FindCashierPaymentCandidate.php backend/app/Http/Resources/Api/V1/CashierPaymentCandidateResource.php backend/tests/Feature/Api/V1/CashierPaymentCandidateEndpointTest.php
git commit -m "fix(queue): let the Cashier find carried-over and not-yet-claimed candidates

FindCashierPaymentCandidate previously required a ticket claimed on
exactly today's queue_date -- a carried-over student was 404 to the
one lookup that exists to bring them back into the payment flow.
Status (waiting/serving) now decides eligibility instead of the
claim date. A pending_payment student with no ticket at all is also
now a valid result (ticket: null), so Accounting Staff can issue one
on their behalf via the existing claim endpoint.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017PdBvDW7rzZNEyJAGqYyya"
```

---

### Task 6: Cut-off / resume — `TransitionQueueCycle`, `QueueCycleController`, routes

**Files:**
- Create: `backend/app/Actions/Enrollment/TransitionQueueCycle.php`
- Create: `backend/app/Http/Resources/Api/V1/QueueCycleResource.php`
- Create: `backend/app/Http/Controllers/Api/V1/QueueCycleController.php`
- Create: `backend/tests/Feature/Api/V1/QueueCycleEndpointTest.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`

**Interfaces:**
- Consumes: `QueueCycle::status()`/`QueueCycleStatus` (Task 2), `AuditRecorder`/`NotificationRecorder` (existing), `AuditAction::QUEUE_CYCLE_CUT_OFF`/`::QUEUE_CYCLE_RESUMED`, `NotificationType::QueueCycleCutOff` (Task 2), `QueueTicketPolicy::viewAny`/`::update` (existing, reused rather than a new Policy class since both are the same accounting-only, no-ownership-dimension rule).
- Produces: `App\Actions\Enrollment\TransitionQueueCycle::cutOff(User $actor, AuditRequestContext $context): QueueCycle` and `::resume(...): QueueCycle` — consumed by Task 9's Cashier UI. `GET /api/v1/queue-cycle`, `POST /api/v1/queue-cycle/cut-off`, `POST /api/v1/queue-cycle/resume` — all consumed by Task 9.

- [ ] **Step 1: Write the failing tests first**

Create `backend/tests/Feature/Api/V1/QueueCycleEndpointTest.php`:

```php
<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Audit\AuditAction;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Enrollment\QueueServiceDate;
use App\Domain\Enrollment\QueueTicketStatus;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\ProgramStatus;
use App\Models\AcademicTerm;
use App\Models\AuditLog;
use App\Models\Curriculum;
use App\Models\Enrollment;
use App\Models\Notification;
use App\Models\Program;
use App\Models\QueueCycle;
use App\Models\QueueTicket;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class QueueCycleEndpointTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    public function test_show_returns_null_when_no_cycle_is_open(): void
    {
        $token = $this->tokenFor(UserRole::AccountingStaff, 'show.none@grc.test');

        $this->withToken($token)->getJson('/api/v1/queue-cycle')
            ->assertOk()
            ->assertJsonPath('data', null);
    }

    public function test_show_returns_the_open_cycle(): void
    {
        QueueCycle::create(['opened_on' => QueueServiceDate::today(), 'last_ticket_sequence' => 3]);
        $token = $this->tokenFor(UserRole::AccountingStaff, 'show.open@grc.test');

        $this->withToken($token)->getJson('/api/v1/queue-cycle')
            ->assertOk()
            ->assertJsonPath('data.status', 'open');
    }

    public function test_accounting_staff_can_cut_off_the_open_queue(): void
    {
        QueueCycle::create(['opened_on' => QueueServiceDate::today(), 'last_ticket_sequence' => 3]);
        $token = $this->tokenFor(UserRole::AccountingStaff, 'cutoff.ok@grc.test');

        $this->withToken($token)->postJson('/api/v1/queue-cycle/cut-off')
            ->assertOk()
            ->assertJsonPath('data.status', 'cut_off');
        self::assertSame(AuditAction::QUEUE_CYCLE_CUT_OFF, AuditLog::query()->sole()->action);
    }

    public function test_cutting_off_returns_a_serving_ticket_to_waiting_without_requeuing(): void
    {
        [, , $servingTicket] = $this->makeTicket(status: QueueTicketStatus::Serving);
        $token = $this->tokenFor(UserRole::AccountingStaff, 'cutoff.serving@grc.test');

        $this->withToken($token)->postJson('/api/v1/queue-cycle/cut-off')->assertOk();

        $servingTicket->refresh();
        self::assertSame('waiting', $servingTicket->status->value);
        self::assertNull($servingTicket->requeued_at);
    }

    public function test_cutting_off_notifies_every_waiting_student(): void
    {
        [$student] = $this->makeTicket(status: QueueTicketStatus::Waiting);
        $token = $this->tokenFor(UserRole::AccountingStaff, 'cutoff.notify@grc.test');

        $this->withToken($token)->postJson('/api/v1/queue-cycle/cut-off')->assertOk();

        self::assertSame(1, Notification::query()->where('user_id', $student->user_id)->count());
    }

    public function test_cannot_cut_off_twice_in_one_day(): void
    {
        $this->makeTicket();
        $token = $this->tokenFor(UserRole::AccountingStaff, 'cutoff.twice@grc.test');
        $this->withToken($token)->postJson('/api/v1/queue-cycle/cut-off')->assertOk();

        $this->withToken($token)->postJson('/api/v1/queue-cycle/cut-off')
            ->assertUnprocessable()
            ->assertJsonPath('error.errors.cycle.0', 'The queue is already cut off for today.');
    }

    public function test_cannot_cut_off_when_no_cycle_is_open(): void
    {
        $token = $this->tokenFor(UserRole::AccountingStaff, 'cutoff.none@grc.test');

        $this->withToken($token)->postJson('/api/v1/queue-cycle/cut-off')
            ->assertUnprocessable()
            ->assertJsonPath('error.errors.cycle.0', 'No queue is currently open.');
    }

    public function test_accounting_staff_can_resume_a_cut_off_cycle(): void
    {
        $this->makeTicket();
        $token = $this->tokenFor(UserRole::AccountingStaff, 'resume.ok@grc.test');
        $this->withToken($token)->postJson('/api/v1/queue-cycle/cut-off')->assertOk();

        $this->withToken($token)->postJson('/api/v1/queue-cycle/resume')
            ->assertOk()
            ->assertJsonPath('data.status', 'open');
        self::assertSame(AuditAction::QUEUE_CYCLE_RESUMED, AuditLog::query()->latest('id')->first()->action);
    }

    public function test_cannot_resume_when_not_cut_off(): void
    {
        QueueCycle::create(['opened_on' => QueueServiceDate::today(), 'last_ticket_sequence' => 1]);
        $token = $this->tokenFor(UserRole::AccountingStaff, 'resume.notcutoff@grc.test');

        $this->withToken($token)->postJson('/api/v1/queue-cycle/resume')
            ->assertUnprocessable()
            ->assertJsonPath('error.errors.cycle.0', 'The queue is not currently cut off.');
    }

    public function test_a_non_accounting_role_cannot_cut_off(): void
    {
        $this->makeTicket();
        $token = $this->tokenFor(UserRole::RegistrarStaff, 'cutoff.forbidden@grc.test');

        $this->withToken($token)->postJson('/api/v1/queue-cycle/cut-off')->assertForbidden();
    }

    /**
     * @return array{StudentProfile, Enrollment, QueueTicket}
     */
    private function makeTicket(QueueTicketStatus $status = QueueTicketStatus::Waiting): array
    {
        $term = AcademicTerm::query()->firstOrCreate(
            ['school_year' => '2026-2027', 'semester' => '1st'],
            ['status' => AcademicTermStatus::SemesterOngoing],
        );
        $program = Program::create(['code' => 'BSCS-QCT'.uniqid(), 'name' => 'BS Computer Science', 'status' => ProgramStatus::Active]);
        $curriculum = Curriculum::create([
            'program_id' => $program->id, 'name' => 'BSCS Curriculum',
            'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Active,
        ]);
        $user = User::create([
            'name' => 'Cycle Ticket Student', 'email' => 'cycleticket.'.uniqid().'@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::Student, 'status' => UserStatus::Active,
        ]);
        $student = StudentProfile::create([
            'user_id' => $user->id, 'student_number' => '2026-08-'.random_int(10000, 99999),
            'program_id' => $program->id, 'curriculum_id' => $curriculum->id, 'year_level' => 1,
            'admission_status' => AdmissionStatus::Admitted, 'academic_standing' => AcademicStanding::Good,
        ]);
        $enrollment = Enrollment::create([
            'student_id' => $student->id, 'academic_term_id' => $term->id,
            'status' => EnrollmentStatus::PendingPayment, 'total_units' => 3,
        ]);
        $cycle = QueueCycle::query()->whereNull('closed_at')->first()
            ?? QueueCycle::create(['opened_on' => QueueServiceDate::today(), 'last_ticket_sequence' => 0]);
        $sequence = $cycle->last_ticket_sequence + 1;
        $cycle->update(['last_ticket_sequence' => $sequence, 'last_claimed_on' => QueueServiceDate::today()]);
        $ticket = QueueTicket::create([
            'enrollment_id' => $enrollment->id, 'queue_cycle_id' => $cycle->id, 'ticket_sequence' => $sequence,
            'ticket_number' => sprintf('Q%03d', $sequence), 'queue_date' => QueueServiceDate::today(), 'status' => $status,
        ]);

        return [$student, $enrollment, $ticket];
    }

    private function tokenFor(UserRole $role, string $email): string
    {
        User::create([
            'name' => 'Test '.$role->value, 'email' => $email,
            'password' => self::PASSWORD, 'role' => $role, 'status' => UserStatus::Active,
        ]);

        return (string) $this->postJson('/api/v1/auth/login', [
            'email' => $email, 'password' => self::PASSWORD,
        ])->json('data.token');
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && php artisan test --filter=QueueCycleEndpointTest`

Expected: FAIL — none of the three routes exist yet (404s).

- [ ] **Step 3: Create `TransitionQueueCycle`**

Create `backend/app/Actions/Enrollment/TransitionQueueCycle.php`:

```php
<?php

namespace App\Actions\Enrollment;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Enrollment\QueueServiceDate;
use App\Domain\Enrollment\QueueTicketStatus;
use App\Domain\Notifications\NotificationType;
use App\Models\QueueCycle;
use App\Models\QueueTicket;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use App\Support\Notifications\NotificationRecorder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Cut-off/resume for the single open queue cycle (PRD §5.3 FR-FIN-006).
 * Cutting off does NOT close the cycle — it only records that Accounting
 * Staff stopped serving for today, so the student-facing queue view can
 * show a notice and `TransitionQueueTicket::execute()`'s `serve` guard can
 * block further calls. The very next successful claim on a later Manila
 * service date resumes automatically (see `ClaimQueueTicket`), so this
 * `resume` exists only for "we changed our mind, reopening today."
 *
 * A ticket left `serving` across a cut-off is returned to `waiting`
 * WITHOUT stamping `requeued_at`: it was never actually served, so it
 * keeps its place rather than losing it to the back of the line. See
 * docs/superpowers/specs/2026-08-23-queue-kiosk-claim-carryover-cutoff-design.md.
 */
final readonly class TransitionQueueCycle
{
    public function __construct(
        private AuditRecorder $auditRecorder,
        private NotificationRecorder $notificationRecorder,
    ) {}

    public function cutOff(User $actor, AuditRequestContext $context): QueueCycle
    {
        return DB::transaction(function () use ($actor, $context): QueueCycle {
            $cycle = QueueCycle::query()->whereNull('closed_at')->lockForUpdate()->first();

            if ($cycle === null) {
                throw ValidationException::withMessages(['cycle' => 'No queue is currently open.']);
            }

            $today = QueueServiceDate::today();

            if ($cycle->cut_off_service_date !== null && $cycle->cut_off_service_date->toDateString() === $today) {
                throw ValidationException::withMessages(['cycle' => 'The queue is already cut off for today.']);
            }

            $beforeValues = self::snapshot($cycle);

            QueueTicket::query()
                ->where('queue_cycle_id', $cycle->id)
                ->where('status', QueueTicketStatus::Serving)
                ->update(['status' => QueueTicketStatus::Waiting]);

            $cycle->update([
                'cut_off_at' => now(),
                'cut_off_service_date' => $today,
                'cut_off_by' => $actor->id,
            ]);
            $cycle->refresh();

            $this->auditRecorder->record(
                $actor,
                AuditAction::QUEUE_CYCLE_CUT_OFF,
                AuditableType::QUEUE_CYCLE,
                $cycle->id,
                $beforeValues,
                self::snapshot($cycle),
                null,
                $context,
            );

            $waitingStudentUserIds = QueueTicket::query()
                ->where('queue_cycle_id', $cycle->id)
                ->where('status', QueueTicketStatus::Waiting)
                ->with('enrollment.student')
                ->get()
                ->map(fn (QueueTicket $ticket): int => $ticket->enrollment->student->user_id)
                ->all();

            $this->notificationRecorder->recordMany(
                $waitingStudentUserIds,
                NotificationType::QueueCycleCutOff,
                'The Cashier has closed the queue for today. Your place in line is saved -- you do not need to claim a new ticket.',
            );

            return $cycle;
        });
    }

    public function resume(User $actor, AuditRequestContext $context): QueueCycle
    {
        return DB::transaction(function () use ($actor, $context): QueueCycle {
            $cycle = QueueCycle::query()->whereNull('closed_at')->lockForUpdate()->first();

            if ($cycle === null || $cycle->cut_off_service_date === null) {
                throw ValidationException::withMessages(['cycle' => 'The queue is not currently cut off.']);
            }

            $beforeValues = self::snapshot($cycle);

            $cycle->update(['cut_off_at' => null, 'cut_off_service_date' => null, 'cut_off_by' => null]);
            $cycle->refresh();

            $this->auditRecorder->record(
                $actor,
                AuditAction::QUEUE_CYCLE_RESUMED,
                AuditableType::QUEUE_CYCLE,
                $cycle->id,
                $beforeValues,
                self::snapshot($cycle),
                null,
                $context,
            );

            return $cycle;
        });
    }

    /**
     * @return array{cut_off_at: ?string, cut_off_service_date: ?string}
     */
    private static function snapshot(QueueCycle $cycle): array
    {
        return [
            'cut_off_at' => $cycle->cut_off_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'cut_off_service_date' => $cycle->cut_off_service_date?->toDateString(),
        ];
    }
}
```

- [ ] **Step 4: Create `QueueCycleResource`**

Create `backend/app/Http/Resources/Api/V1/QueueCycleResource.php`:

```php
<?php

namespace App\Http\Resources\Api\V1;

use App\Models\QueueCycle;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read QueueCycle $resource
 */
final class QueueCycleResource extends JsonResource
{
    /**
     * @return array{type: string, id: int, opened_on: string, status: string, status_label: string, cut_off_at: ?string, cut_off_service_date: ?string}
     */
    public function toArray(Request $request): array
    {
        return [
            'type' => 'queue_cycle',
            'id' => $this->resource->id,
            'opened_on' => $this->resource->opened_on->toDateString(),
            'status' => $this->resource->status()->value,
            'status_label' => $this->resource->status()->label(),
            'cut_off_at' => $this->resource->cut_off_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'cut_off_service_date' => $this->resource->cut_off_service_date?->toDateString(),
        ];
    }
}
```

- [ ] **Step 5: Create `QueueCycleController`**

Create `backend/app/Http/Controllers/Api/V1/QueueCycleController.php`:

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Enrollment\TransitionQueueCycle;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\QueueCycleResource;
use App\Models\QueueCycle;
use App\Models\QueueTicket;
use App\Models\User;
use App\Support\Audit\AuditRequestContextFactory;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * PRD §5.3 FR-FIN-006. Reuses `QueueTicketPolicy::viewAny`/`::update`
 * rather than a new Policy class — both cut-off/resume and the existing
 * queue-ticket transitions are the exact same rule (Accounting Staff only,
 * no per-record ownership dimension), applied as defense in depth under
 * the route-level `role:accounting_staff` gate (see `routes/api.php`).
 */
final class QueueCycleController extends Controller
{
    /**
     * @throws AuthenticationException
     */
    public function show(Request $request): JsonResponse
    {
        $this->authenticatedUser($request);
        $this->authorize('viewAny', QueueTicket::class);

        $cycle = QueueCycle::query()->whereNull('closed_at')->first();
        $response = response()->json([
            'data' => $cycle === null ? null : (new QueueCycleResource($cycle))->resolve($request),
        ]);

        return $this->cachePrivateResponse($response);
    }

    /**
     * @throws AuthenticationException
     */
    public function cutOff(Request $request, TransitionQueueCycle $transitioner, AuditRequestContextFactory $contextFactory): JsonResponse
    {
        $actor = $this->authenticatedUser($request);
        $this->authorize('update', QueueTicket::class);

        $cycle = $transitioner->cutOff($actor, $contextFactory->fromRequest($request));

        return $this->cachePrivateResponse(QueueCycleResource::make($cycle)->response($request));
    }

    /**
     * @throws AuthenticationException
     */
    public function resume(Request $request, TransitionQueueCycle $transitioner, AuditRequestContextFactory $contextFactory): JsonResponse
    {
        $actor = $this->authenticatedUser($request);
        $this->authorize('update', QueueTicket::class);

        $cycle = $transitioner->resume($actor, $contextFactory->fromRequest($request));

        return $this->cachePrivateResponse(QueueCycleResource::make($cycle)->response($request));
    }

    /**
     * @throws AuthenticationException
     */
    private function authenticatedUser(Request $request): User
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        return $user;
    }

    private function cachePrivateResponse(JsonResponse $response): JsonResponse
    {
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
```

- [ ] **Step 6: Add the routes**

Open `backend/routes/api.php`. Add the `QueueCycleController` import
alongside the existing `use App\Http\Controllers\Api\V1\QueueTicketController;`
line (immediately after it, alphabetically adjacent).

Replace the existing accounting-only queue-tickets route group:

```php
        Route::middleware('role:accounting_staff')->group(function (): void {
            Route::get('/queue-tickets', [QueueTicketController::class, 'index'])->name('queue-tickets.index');
            Route::patch('/queue-tickets/{queueTicket}', [QueueTicketController::class, 'update'])->name('queue-tickets.update');
        });
```

with:

```php
        Route::middleware('role:accounting_staff')->group(function (): void {
            Route::get('/queue-tickets', [QueueTicketController::class, 'index'])->name('queue-tickets.index');
            Route::patch('/queue-tickets/{queueTicket}', [QueueTicketController::class, 'update'])->name('queue-tickets.update');
            Route::get('/queue-cycle', [QueueCycleController::class, 'show'])->name('queue-cycle.show');
            Route::post('/queue-cycle/cut-off', [QueueCycleController::class, 'cutOff'])->name('queue-cycle.cut-off');
            Route::post('/queue-cycle/resume', [QueueCycleController::class, 'resume'])->name('queue-cycle.resume');
        });
```

- [ ] **Step 7: Update `ApiSurfaceTest`**

Open `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`. Add these three
routes to the routes list, immediately after
`'PATCH api/v1/queue-tickets/{queueTicket}',`:

```php
            'GET|HEAD api/v1/queue-cycle',
            'POST api/v1/queue-cycle/cut-off',
            'POST api/v1/queue-cycle/resume',
```

Add these three route names to the route-names list, immediately after
`'api.v1.queue-tickets.update',`:

```php
            'api.v1.queue-cycle.show',
            'api.v1.queue-cycle.cut-off',
            'api.v1.queue-cycle.resume',
```

If the file separately asserts the accounting-only role gate for the
existing two queue-tickets route names (the `foreach (['api.v1.queue-tickets.index', 'api.v1.queue-tickets.update'] as $name)`
loop noted in this plan's exploration), extend that array to also include
the three new route names, so the same role-gate assertion covers them:

```php
        foreach ([
            'api.v1.queue-tickets.index',
            'api.v1.queue-tickets.update',
            'api.v1.queue-cycle.show',
            'api.v1.queue-cycle.cut-off',
            'api.v1.queue-cycle.resume',
        ] as $name) {
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd backend && php artisan test --filter=QueueCycleEndpointTest`

Expected: PASS, all 10 tests.

Run: `cd backend && php artisan test --filter=ApiSurfaceTest`

Expected: PASS.

- [ ] **Step 9: Run the full backend suite**

Run: `cd backend && php artisan test`

Expected: all tests pass.

- [ ] **Step 10: Run PHPStan**

Run: `cd backend && ./vendor/bin/phpstan analyse`

Expected: no new errors.

- [ ] **Step 11: Commit**

```bash
cd /c/xampp/htdocs/GRC-ENROLLMENT
git add backend/app/Actions/Enrollment/TransitionQueueCycle.php backend/app/Http/Resources/Api/V1/QueueCycleResource.php backend/app/Http/Controllers/Api/V1/QueueCycleController.php backend/routes/api.php backend/tests/Feature/Api/V1/QueueCycleEndpointTest.php backend/tests/Feature/Api/V1/ApiSurfaceTest.php
git commit -m "feat(queue): add cut-off/resume for the open queue cycle

Accounting Staff can now declare the queue cut off for today (any
ticket still serving returns to waiting, keeping its place, not
requeued to the back) and resume it. Cutting off does not close the
cycle -- the next claim on a later service day picks it back up
automatically, carrying every still-waiting ticket forward with it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017PdBvDW7rzZNEyJAGqYyya"
```

---

### Task 7: Remove the old auto-issue; tighten `queue_tickets` to NOT NULL

**Files:**
- Modify: `backend/app/Actions/Enrollment/TransitionEnrollment.php`
- Create: `backend/database/migrations/2026_08_23_000002_finalize_queue_ticket_cycle_columns_not_null.php`
- Modify: `backend/tests/Feature/Database/QueueCycleMigrationTest.php`
- Modify: `backend/tests/Feature/Api/V1/EnrollmentsEndpointTest.php`
- Modify: `frontend/src/features/portal/role-capabilities.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `queue_tickets.queue_cycle_id`/`ticket_sequence` become NOT NULL with `unique(queue_cycle_id, ticket_sequence)` — the final schema state every remaining task (8, 9) can rely on without a nullable check. `TransitionEnrollment::execute()` keeps its existing signature; its behavior no longer creates a `QueueTicket` under any action.

- [ ] **Step 1: Write the failing tests first**

Open `backend/tests/Feature/Api/V1/EnrollmentsEndpointTest.php`. Replace
lines 928-931 (the "Cashier queue ticket is issued exactly at this
checkpoint" block inside
`test_registrar_approve_transitions_a_pending_approval_enrollment_to_pending_payment`):

```php
        // The Cashier queue ticket is no longer issued at this checkpoint
        // -- only at claim (App\Actions\Enrollment\ClaimQueueTicket).
        $response->assertJsonPath('data.queue_ticket', null);
        $this->assertDatabaseCount('queue_tickets', 0);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && php artisan test --filter=test_registrar_approve_transitions_a_pending_approval_enrollment_to_pending_payment`

Expected: FAIL — `data.queue_ticket` is still non-null and
`queue_tickets` still has 1 row (the old auto-issue is still in place).

- [ ] **Step 3: Write the failing schema-tightening tests**

Open `backend/tests/Feature/Database/QueueCycleMigrationTest.php`. Add
these two tests at the end of the class, immediately before the final
closing `}`:

```php

    public function test_queue_cycle_id_and_ticket_sequence_are_required(): void
    {
        $this->expectException(\Illuminate\Database\QueryException::class);

        \Illuminate\Support\Facades\DB::table('queue_tickets')->insert([
            'enrollment_id' => null, 'ticket_number' => 'QZZZ', 'queue_date' => '2026-08-23',
            'status' => 'waiting', 'priority' => 'regular', 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_ticket_sequence_is_unique_within_a_cycle(): void
    {
        $cycle = QueueCycle::create(['opened_on' => '2026-08-23', 'last_ticket_sequence' => 1]);
        \Illuminate\Support\Facades\DB::table('queue_tickets')->insert([
            'enrollment_id' => null, 'queue_cycle_id' => $cycle->id, 'ticket_sequence' => 1,
            'ticket_number' => 'Q001', 'queue_date' => '2026-08-23', 'status' => 'waiting',
            'priority' => 'regular', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->expectException(\Illuminate\Database\QueryException::class);

        \Illuminate\Support\Facades\DB::table('queue_tickets')->insert([
            'enrollment_id' => null, 'queue_cycle_id' => $cycle->id, 'ticket_sequence' => 1,
            'ticket_number' => 'Q002', 'queue_date' => '2026-08-23', 'status' => 'waiting',
            'priority' => 'regular', 'created_at' => now(), 'updated_at' => now(),
        ]);
    }
```

> **Note for the implementer:** these two tests use raw `DB::table()`
> inserts with `enrollment_id => null` specifically to isolate the
> assertion to the `queue_cycle_id`/`ticket_sequence` constraints without
> needing a real `Enrollment` fixture — `enrollment_id` itself stays
> nullable-in-name only (it is a required FK in practice, enforced by
> every real writer, never by a NOT NULL constraint) so this insert will
> reach the constraint under test rather than failing earlier on
> `enrollment_id`.

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd backend && php artisan test --filter=QueueCycleMigrationTest`

Expected: FAIL — both new tests fail because no exception is thrown yet
(the columns are still nullable and unconstrained).

- [ ] **Step 5: Remove the auto-issue from `TransitionEnrollment`**

Open `backend/app/Actions/Enrollment/TransitionEnrollment.php`. Replace the
imports block in full:

```php
<?php

namespace App\Actions\Enrollment;

use App\Actions\Billing\AssessEnrollment;
use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Notifications\NotificationType;
use App\Models\Assessment;
use App\Models\Enrollment;
use App\Models\Notification;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
```

Replace the class docblock's third paragraph (the one starting
"`registrar_approve` also issues the one Cashier queue ticket..."):

```php
 * `registrar_approve` no longer issues a Cashier queue ticket — that moved
 * to `App\Actions\Enrollment\ClaimQueueTicket`, triggered by the student's
 * own claim (or Accounting Staff issuing one on their behalf) once they
 * are physically at the Cashier, matching the real front-desk process
 * (see docs/superpowers/specs/
 * 2026-08-23-queue-kiosk-claim-carryover-cutoff-design.md). This action
 * only opens the door: `pending_payment` plus an `Assessment`. The
 * Accounting-Staff-facing notification that used to fire here on approval
 * moved with it — `ClaimQueueTicket` fires it at the moment a student
 * actually joins the line, a more useful trigger than the moment they
 * merely become eligible to.
 */
```

Replace the constructor:

```php
    public function __construct(
        private readonly AuditRecorder $auditRecorder,
        private readonly AssessEnrollment $assessEnrollment,
    ) {}
```

Replace the entire `execute()` method body (everything from `return DB::transaction(` to its matching closing `});`):

```php
        return DB::transaction(function () use ($enrollment, $action, $actingUser, $reason, $context): Enrollment {
            $lockedEnrollment = Enrollment::query()
                ->whereKey($enrollment->id)
                ->lockForUpdate()
                ->firstOrFail();
            $requiredStatus = self::REQUIRED_CURRENT_STATUS[$action];

            if ($lockedEnrollment->status !== $requiredStatus) {
                throw ValidationException::withMessages([
                    'action' => "This action requires the enrollment to currently be '{$requiredStatus->value}'; ".
                        "it is currently '{$lockedEnrollment->status->value}'.",
                ]);
            }

            $beforeValues = self::snapshot($lockedEnrollment);

            $lockedEnrollment->update([
                'status' => self::TARGET_STATUS[$action],
                'registrar_decided_at' => now(),
            ]);
            $lockedEnrollment->refresh();

            $afterValues = self::snapshot($lockedEnrollment);
            $auditReason = in_array($action, self::REASON_REQUIRED_ACTIONS, true) ? $reason : null;

            // PRD §5.3 process 3.3 "computes the approved assessment" --
            // done in the same transaction as the status change above, so
            // nothing may reach `pending_payment` without one. Folded into
            // this same audit row's after_values below, not a second row
            // -- see AssessEnrollment's own docblock for why.
            $assessment = $action === 'registrar_approve'
                ? $this->assessEnrollment->execute($lockedEnrollment)
                : null;

            $this->auditRecorder->record(
                $actingUser,
                self::AUDIT_ACTION[$action],
                AuditableType::ENROLLMENT,
                $lockedEnrollment->id,
                $beforeValues,
                self::auditAfterValues($afterValues, $assessment),
                $auditReason,
                $context,
            );

            Notification::create([
                'user_id' => $lockedEnrollment->student->user_id,
                'type' => self::NOTIFICATION_TYPE[$action],
                'message' => self::notificationMessage($action, $lockedEnrollment, $reason),
            ]);

            return $lockedEnrollment->refresh()->load([
                'student', 'enrollmentSubjects.section.subject', 'queueTicket', 'assessment.items',
            ]);
        });
```

Replace the `auditAfterValues()` method:

```php
    /**
     * @param  array{student_id: int, academic_term_id: int, status: string, registrar_decided_at: ?string}  $afterValues
     * @return array<string, mixed>
     */
    private static function auditAfterValues(array $afterValues, ?Assessment $assessment): array
    {
        if ($assessment !== null) {
            $afterValues = [...$afterValues, 'assessment_total_amount' => $assessment->total_amount, 'assessment_item_count' => $assessment->items->count()];
        }

        return $afterValues;
    }
```

Replace the `notificationMessage()` method:

```php
    private static function notificationMessage(string $action, Enrollment $enrollment, ?string $reason): string
    {
        return match ($action) {
            'registrar_approve' => 'Your enrollment has been approved by the Registrar and is now pending payment. Visit the Cashier to claim your queue ticket.',
            'registrar_reject' => "Your enrollment was rejected by the Registrar. Reason: {$reason}",
            'void' => "Your enrollment has been voided by the Registrar. Reason: {$reason}",
            default => 'Your enrollment status has changed.',
        };
    }
```

- [ ] **Step 6: Create the tightening migration**

Create `backend/database/migrations/2026_08_23_000002_finalize_queue_ticket_cycle_columns_not_null.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Every ticket-issuing code path is now cycle-aware -- ClaimQueueTicket is
 * the only one left, since this plan's prior task removed
 * TransitionEnrollment's old registrar-approval-time auto-issue.
 * `queue_cycle_id`/`ticket_sequence` (added nullable in this plan's first
 * migration and backfilled) can now be required, and get their own
 * uniqueness guarantee.
 *
 * Uses a raw ALTER TABLE for the NOT NULL tightening rather than
 * `Blueprint::change()`, which this project would otherwise need
 * `doctrine/dbal` for -- a dependency nothing else in the project
 * requires.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE queue_tickets MODIFY queue_cycle_id BIGINT UNSIGNED NOT NULL');
        DB::statement('ALTER TABLE queue_tickets MODIFY ticket_sequence INT UNSIGNED NOT NULL');

        Schema::table('queue_tickets', function (Blueprint $table) {
            $table->unique(['queue_cycle_id', 'ticket_sequence']);
        });
    }

    public function down(): void
    {
        Schema::table('queue_tickets', function (Blueprint $table) {
            $table->dropUnique(['queue_cycle_id', 'ticket_sequence']);
        });

        DB::statement('ALTER TABLE queue_tickets MODIFY queue_cycle_id BIGINT UNSIGNED NULL');
        DB::statement('ALTER TABLE queue_tickets MODIFY ticket_sequence INT UNSIGNED NULL');
    }
};
```

- [ ] **Step 7: Run the migration**

Run: `cd backend && php artisan migrate --force`

If this fails because a pre-existing row has `queue_cycle_id`/`ticket_sequence`
still null (only possible if Task 1's backfill was skipped or the local
database has drifted), first run
`cd backend && php artisan migrate:fresh --seed` in local development —
never on a database with real data the team needs — and re-run.

- [ ] **Step 8: Update the frontend module description**

Open `frontend/src/features/portal/role-capabilities.ts`. Find the
`enrollment-approvals` module (Registrar Staff) and replace its
description:

```ts
        "Approve or reject enrollment submissions pending registrar review. Approved students claim their Cashier queue number at the front desk.",
```

(replacing the current
`"Approve or reject enrollment submissions pending registrar review. Approving issues the Cashier queue number."`)

- [ ] **Step 9: Run all touched tests**

Run: `cd backend && php artisan test --filter=QueueCycleMigrationTest`

Expected: PASS, all 6 tests.

Run: `cd backend && php artisan test --filter=EnrollmentsEndpointTest`

Expected: PASS.

- [ ] **Step 10: Run the full backend suite**

Run: `cd backend && php artisan test`

Expected: all tests pass.

- [ ] **Step 11: Run PHPStan**

Run: `cd backend && ./vendor/bin/phpstan analyse`

Expected: no new errors (the removed `NotificationRecorder`/`UserRole`/
`QueueTicket`/`QueueTicketPriority`/`QueueTicketStatus` imports from
`TransitionEnrollment` must not leave any now-undefined reference —
PHPStan level 8 will catch this if a reference was missed).

- [ ] **Step 12: Run the frontend typecheck**

Run: `cd frontend && npm run typecheck`

Expected: no errors.

- [ ] **Step 13: Commit**

```bash
cd /c/xampp/htdocs/GRC-ENROLLMENT
git add backend/app/Actions/Enrollment/TransitionEnrollment.php backend/database/migrations/2026_08_23_000002_finalize_queue_ticket_cycle_columns_not_null.php backend/tests/Feature/Database/QueueCycleMigrationTest.php backend/tests/Feature/Api/V1/EnrollmentsEndpointTest.php frontend/src/features/portal/role-capabilities.ts
git commit -m "feat(queue): stop auto-issuing a ticket at registrar approval

registrar_approve now only opens pending_payment + an Assessment --
the queue ticket comes from the student's own claim (or Accounting
Staff issuing on their behalf), completing the move started in
Tasks 1-6. queue_cycle_id/ticket_sequence are now required columns
with their own uniqueness guarantee, closing the transitional
nullable window Task 1 opened.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017PdBvDW7rzZNEyJAGqYyya"
```

---

### Task 8: `BuildStudentQueueView` — the student's own read-only queue status

**Files:**
- Create: `backend/app/Domain/Enrollment/StudentQueueView.php`
- Create: `backend/app/Actions/Enrollment/BuildStudentQueueView.php`
- Create: `backend/app/Http/Resources/Api/V1/StudentQueueViewResource.php`
- Create: `backend/app/Http/Controllers/Api/V1/StudentQueueViewController.php`
- Create: `backend/tests/Feature/Api/V1/StudentQueueViewEndpointTest.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`

**Interfaces:**
- Consumes: `QueueCycle::status()` (Task 2), `QueueTicket::position()` cycle-aware ordering (Task 3), `EnrollmentStatus` (existing).
- Produces: `GET /api/v1/queue-status` — the endpoint a later, separate frontend slice (the student's live queue view) consumes. Response shape: `{"data": {"type": "student_queue_view", "stage": "no_active_enrollment"|"pending_registrar_approval"|"pending_payment"|"enrolled", "can_claim": bool, "ticket": null|{ticket_number, status, status_label, priority, priority_label, position}, "now_serving_ticket_number": ?string, "upcoming_ticket_numbers": list<string>, "cut_off_today": bool}}`. `upcoming_ticket_numbers` is deliberately ticket numbers only — never another student's identity.

- [ ] **Step 1: Write the failing tests first**

Create `backend/tests/Feature/Api/V1/StudentQueueViewEndpointTest.php`:

```php
<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Enrollment\QueueServiceDate;
use App\Domain\Enrollment\QueueTicketPriority;
use App\Domain\Enrollment\QueueTicketStatus;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\ProgramStatus;
use App\Models\AcademicTerm;
use App\Models\Curriculum;
use App\Models\Enrollment;
use App\Models\Program;
use App\Models\QueueCycle;
use App\Models\QueueTicket;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class StudentQueueViewEndpointTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    public function test_anonymous_request_is_unauthenticated(): void
    {
        $this->getJson('/api/v1/queue-status')->assertUnauthorized();
    }

    public function test_a_non_student_role_is_forbidden(): void
    {
        $token = $this->tokenFor(UserRole::AccountingStaff, 'accounting.viewstatus@grc.test');

        $this->withToken($token)->getJson('/api/v1/queue-status')->assertForbidden();
    }

    public function test_a_student_with_no_enrollment_this_term_sees_no_active_enrollment(): void
    {
        $this->makeTerm();
        $token = $this->makeStudentToken('2026-08-90001');

        $this->withToken($token)->getJson('/api/v1/queue-status')
            ->assertOk()
            ->assertJsonPath('data.stage', 'no_active_enrollment')
            ->assertJsonPath('data.can_claim', false)
            ->assertJsonPath('data.ticket', null);
    }

    public function test_a_student_awaiting_registrar_approval_cannot_claim_yet(): void
    {
        [$token] = $this->makeStudentWithEnrollment('2026-08-90002', EnrollmentStatus::PendingRegistrarApproval);

        $this->withToken($token)->getJson('/api/v1/queue-status')
            ->assertOk()
            ->assertJsonPath('data.stage', 'pending_registrar_approval')
            ->assertJsonPath('data.can_claim', false);
    }

    public function test_an_approved_student_with_no_ticket_yet_can_claim(): void
    {
        [$token] = $this->makeStudentWithEnrollment('2026-08-90003', EnrollmentStatus::PendingPayment);

        $this->withToken($token)->getJson('/api/v1/queue-status')
            ->assertOk()
            ->assertJsonPath('data.stage', 'pending_payment')
            ->assertJsonPath('data.can_claim', true)
            ->assertJsonPath('data.ticket', null);
    }

    public function test_an_enrolled_student_cannot_claim(): void
    {
        [$token] = $this->makeStudentWithEnrollment('2026-08-90004', EnrollmentStatus::Enrolled);

        $this->withToken($token)->getJson('/api/v1/queue-status')
            ->assertOk()
            ->assertJsonPath('data.stage', 'enrolled')
            ->assertJsonPath('data.can_claim', false);
    }

    public function test_a_student_with_a_ticket_sees_it_and_their_position(): void
    {
        [$token, $enrollment] = $this->makeStudentWithEnrollment('2026-08-90005', EnrollmentStatus::PendingPayment);
        $cycle = QueueCycle::create(['opened_on' => QueueServiceDate::today(), 'last_ticket_sequence' => 0]);
        QueueTicket::create([
            'enrollment_id' => $enrollment->id, 'queue_cycle_id' => $cycle->id, 'ticket_sequence' => 1,
            'ticket_number' => 'Q001', 'queue_date' => QueueServiceDate::today(), 'status' => QueueTicketStatus::Waiting,
        ]);

        $this->withToken($token)->getJson('/api/v1/queue-status')
            ->assertOk()
            ->assertJsonPath('data.can_claim', false)
            ->assertJsonPath('data.ticket.ticket_number', 'Q001')
            ->assertJsonPath('data.ticket.position', 0);
    }

    public function test_the_board_shows_now_serving_and_the_first_ten_waiting_by_number_only(): void
    {
        [$token, $enrollment] = $this->makeStudentWithEnrollment('2026-08-90006', EnrollmentStatus::PendingPayment);
        $cycle = QueueCycle::create(['opened_on' => QueueServiceDate::today(), 'last_ticket_sequence' => 0]);
        $servingTicket = QueueTicket::create([
            'enrollment_id' => $enrollment->id, 'queue_cycle_id' => $cycle->id, 'ticket_sequence' => 1,
            'ticket_number' => 'Q001', 'queue_date' => QueueServiceDate::today(), 'status' => QueueTicketStatus::Serving,
        ]);
        $otherEnrollment = $this->makeAnotherPendingPaymentEnrollment('2026-08-90007');
        QueueTicket::create([
            'enrollment_id' => $otherEnrollment->id, 'queue_cycle_id' => $cycle->id, 'ticket_sequence' => 2,
            'ticket_number' => 'Q002', 'queue_date' => QueueServiceDate::today(), 'status' => QueueTicketStatus::Waiting,
        ]);

        $response = $this->withToken($token)->getJson('/api/v1/queue-status')->assertOk();

        $response->assertJsonPath('data.now_serving_ticket_number', 'Q001');
        $response->assertJsonPath('data.upcoming_ticket_numbers', ['Q002']);
        self::assertStringNotContainsString('2026-08-90007', $response->getContent());
    }

    public function test_priority_tickets_appear_first_on_the_board(): void
    {
        [$token, $enrollment] = $this->makeStudentWithEnrollment('2026-08-90008', EnrollmentStatus::PendingPayment);
        $cycle = QueueCycle::create(['opened_on' => QueueServiceDate::today(), 'last_ticket_sequence' => 0]);
        QueueTicket::create([
            'enrollment_id' => $enrollment->id, 'queue_cycle_id' => $cycle->id, 'ticket_sequence' => 1,
            'ticket_number' => 'Q001', 'queue_date' => QueueServiceDate::today(), 'status' => QueueTicketStatus::Waiting,
            'priority' => QueueTicketPriority::Regular,
        ]);
        $otherEnrollment = $this->makeAnotherPendingPaymentEnrollment('2026-08-90009');
        QueueTicket::create([
            'enrollment_id' => $otherEnrollment->id, 'queue_cycle_id' => $cycle->id, 'ticket_sequence' => 2,
            'ticket_number' => 'Q002', 'queue_date' => QueueServiceDate::today(), 'status' => QueueTicketStatus::Waiting,
            'priority' => QueueTicketPriority::Priority,
        ]);

        $this->withToken($token)->getJson('/api/v1/queue-status')
            ->assertOk()
            ->assertJsonPath('data.upcoming_ticket_numbers', ['Q002', 'Q001']);
    }

    public function test_cut_off_today_is_true_while_the_open_cycle_is_cut_off(): void
    {
        [$token] = $this->makeStudentWithEnrollment('2026-08-90010', EnrollmentStatus::PendingPayment);
        QueueCycle::create([
            'opened_on' => QueueServiceDate::today(), 'last_ticket_sequence' => 0,
            'cut_off_at' => now(), 'cut_off_service_date' => QueueServiceDate::today(),
        ]);

        $this->withToken($token)->getJson('/api/v1/queue-status')
            ->assertOk()
            ->assertJsonPath('data.cut_off_today', true);
    }

    private function makeTerm(): AcademicTerm
    {
        return AcademicTerm::query()->firstOrCreate(
            ['school_year' => '2026-2027', 'semester' => '1st'],
            ['status' => AcademicTermStatus::SemesterOngoing],
        );
    }

    /**
     * @return array{string, Enrollment}
     */
    private function makeStudentWithEnrollment(string $studentNumber, EnrollmentStatus $status): array
    {
        $enrollment = $this->makeAnotherPendingPaymentEnrollment($studentNumber, $status);
        $token = (string) $this->postJson('/api/v1/auth/login', [
            'email' => 'student.'.$studentNumber.'@grc.test', 'password' => self::PASSWORD,
        ])->json('data.token');

        return [$token, $enrollment];
    }

    private function makeAnotherPendingPaymentEnrollment(string $studentNumber, EnrollmentStatus $status = EnrollmentStatus::PendingPayment): Enrollment
    {
        $term = $this->makeTerm();
        $program = Program::create(['code' => 'BSCS-SQV'.$studentNumber, 'name' => 'BS Computer Science', 'status' => ProgramStatus::Active]);
        $curriculum = Curriculum::create([
            'program_id' => $program->id, 'name' => 'BSCS Curriculum',
            'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Active,
        ]);
        $user = User::create([
            'name' => 'Queue View Student', 'email' => 'student.'.$studentNumber.'@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::Student, 'status' => UserStatus::Active,
        ]);
        $student = StudentProfile::create([
            'user_id' => $user->id, 'student_number' => $studentNumber,
            'program_id' => $program->id, 'curriculum_id' => $curriculum->id, 'year_level' => 1,
            'admission_status' => AdmissionStatus::Admitted, 'academic_standing' => AcademicStanding::Good,
        ]);

        return Enrollment::create([
            'student_id' => $student->id, 'academic_term_id' => $term->id,
            'status' => $status, 'total_units' => 3,
        ]);
    }

    private function makeStudentToken(string $studentNumber): string
    {
        $user = User::create([
            'name' => 'No Enrollment Student', 'email' => 'noenroll.'.$studentNumber.'@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::Student, 'status' => UserStatus::Active,
        ]);
        StudentProfile::create([
            'user_id' => $user->id, 'student_number' => $studentNumber,
            'program_id' => Program::create(['code' => 'BSCS-NE'.$studentNumber, 'name' => 'BS Computer Science', 'status' => ProgramStatus::Active])->id,
            'curriculum_id' => Curriculum::create([
                'program_id' => Program::query()->latest('id')->first()->id, 'name' => 'BSCS Curriculum',
                'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Active,
            ])->id,
            'year_level' => 1, 'admission_status' => AdmissionStatus::Admitted, 'academic_standing' => AcademicStanding::Good,
        ]);

        return (string) $this->postJson('/api/v1/auth/login', [
            'email' => $user->email, 'password' => self::PASSWORD,
        ])->json('data.token');
    }

    private function tokenFor(UserRole $role, string $email): string
    {
        User::create([
            'name' => 'Test '.$role->value, 'email' => $email,
            'password' => self::PASSWORD, 'role' => $role, 'status' => UserStatus::Active,
        ]);

        return (string) $this->postJson('/api/v1/auth/login', [
            'email' => $email, 'password' => self::PASSWORD,
        ])->json('data.token');
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && php artisan test --filter=StudentQueueViewEndpointTest`

Expected: FAIL — `GET /api/v1/queue-status` does not exist yet (404).

- [ ] **Step 3: Create the `StudentQueueView` value object**

Create `backend/app/Domain/Enrollment/StudentQueueView.php`:

```php
<?php

namespace App\Domain\Enrollment;

use App\Models\QueueTicket;

/**
 * Read-only aggregate behind the student's own "where am I in the queue"
 * view (PRD §5.3 FR-FIN-006) — see
 * `App\Actions\Enrollment\BuildStudentQueueView`.
 */
final readonly class StudentQueueView
{
    /**
     * @param  list<string>  $upcomingTicketNumbers
     */
    public function __construct(
        public string $stage,
        public bool $canClaim,
        public ?QueueTicket $ticket,
        public ?string $nowServingTicketNumber,
        public array $upcomingTicketNumbers,
        public bool $cutOffToday,
    ) {}
}
```

- [ ] **Step 4: Create `BuildStudentQueueView`**

Create `backend/app/Actions/Enrollment/BuildStudentQueueView.php`:

```php
<?php

namespace App\Actions\Enrollment;

use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Enrollment\QueueCycleStatus;
use App\Domain\Enrollment\QueueTicketPriority;
use App\Domain\Enrollment\QueueTicketStatus;
use App\Domain\Enrollment\StudentQueueView;
use App\Domain\Organization\AcademicTermStatus;
use App\Models\AcademicTerm;
use App\Models\Enrollment;
use App\Models\QueueCycle;
use App\Models\QueueTicket;
use App\Models\StudentProfile;
use App\Models\User;

/**
 * Read-only aggregate for the student's own "where am I in the queue" view
 * (PRD §5.3 FR-FIN-006). `upcomingTicketNumbers` never exposes another
 * student's identity — only ticket numbers, the same privacy convention
 * `QueueTicket::position()` already follows for "how many ahead of me".
 */
final readonly class BuildStudentQueueView
{
    private const UPCOMING_LIMIT = 10;

    public function execute(User $actor): StudentQueueView
    {
        $student = StudentProfile::query()->where('user_id', $actor->id)->first();
        $term = AcademicTerm::query()->where('status', AcademicTermStatus::SemesterOngoing)->first();

        $enrollment = ($student === null || $term === null) ? null : Enrollment::query()
            ->with('queueTicket')
            ->where('student_id', $student->id)
            ->where('academic_term_id', $term->id)
            ->orderByDesc('id')
            ->first();

        $stage = $this->stageFor($enrollment);
        $ticket = $enrollment?->queueTicket;
        $canClaim = $stage === 'pending_payment' && $ticket === null;

        $openCycle = QueueCycle::query()->whereNull('closed_at')->first();

        $nowServingTicketNumber = $openCycle === null ? null : QueueTicket::query()
            ->where('queue_cycle_id', $openCycle->id)
            ->where('status', QueueTicketStatus::Serving)
            ->value('ticket_number');

        $upcomingTicketNumbers = $openCycle === null ? [] : $this->upcomingTicketNumbers($openCycle->id);
        $cutOffToday = $openCycle !== null && $openCycle->status() === QueueCycleStatus::CutOff;

        return new StudentQueueView($stage, $canClaim, $ticket, $nowServingTicketNumber, $upcomingTicketNumbers, $cutOffToday);
    }

    private function stageFor(?Enrollment $enrollment): string
    {
        if ($enrollment === null) {
            return 'no_active_enrollment';
        }

        return match ($enrollment->status) {
            EnrollmentStatus::Draft, EnrollmentStatus::PendingRegistrarApproval => 'pending_registrar_approval',
            EnrollmentStatus::PendingPayment => 'pending_payment',
            EnrollmentStatus::Enrolled => 'enrolled',
            EnrollmentStatus::Rejected, EnrollmentStatus::Cancelled, EnrollmentStatus::Withdrawn => 'no_active_enrollment',
        };
    }

    /**
     * @return list<string>
     */
    private function upcomingTicketNumbers(int $openCycleId): array
    {
        $orderedWaiting = fn (QueueTicketPriority $priority) => QueueTicket::query()
            ->where('queue_cycle_id', $openCycleId)
            ->where('status', QueueTicketStatus::Waiting)
            ->where('priority', $priority)
            ->orderBy('queue_date')
            ->orderByRaw('COALESCE(requeued_at, created_at)')
            ->orderByRaw('requeued_at IS NOT NULL')
            ->orderBy('id');

        $priorityNumbers = $orderedWaiting(QueueTicketPriority::Priority)
            ->limit(self::UPCOMING_LIMIT)
            ->pluck('ticket_number')
            ->all();

        $remaining = self::UPCOMING_LIMIT - count($priorityNumbers);

        $regularNumbers = $remaining > 0
            ? $orderedWaiting(QueueTicketPriority::Regular)->limit($remaining)->pluck('ticket_number')->all()
            : [];

        return [...$priorityNumbers, ...$regularNumbers];
    }
}
```

- [ ] **Step 5: Create `StudentQueueViewResource`**

Create `backend/app/Http/Resources/Api/V1/StudentQueueViewResource.php`:

```php
<?php

namespace App\Http\Resources\Api\V1;

use App\Domain\Enrollment\StudentQueueView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read StudentQueueView $resource
 */
final class StudentQueueViewResource extends JsonResource
{
    /**
     * @return array{
     *     type: string,
     *     stage: string,
     *     can_claim: bool,
     *     ticket: ?array{ticket_number: string, status: string, status_label: string, priority: string, priority_label: string, position: ?int},
     *     now_serving_ticket_number: ?string,
     *     upcoming_ticket_numbers: list<string>,
     *     cut_off_today: bool
     * }
     */
    public function toArray(Request $request): array
    {
        $ticket = $this->resource->ticket;

        return [
            'type' => 'student_queue_view',
            'stage' => $this->resource->stage,
            'can_claim' => $this->resource->canClaim,
            'ticket' => $ticket === null ? null : [
                'ticket_number' => $ticket->ticket_number,
                'status' => $ticket->status->value,
                'status_label' => $ticket->status->label(),
                'priority' => $ticket->priority->value,
                'priority_label' => $ticket->priority->label(),
                'position' => $ticket->position(),
            ],
            'now_serving_ticket_number' => $this->resource->nowServingTicketNumber,
            'upcoming_ticket_numbers' => $this->resource->upcomingTicketNumbers,
            'cut_off_today' => $this->resource->cutOffToday,
        ];
    }
}
```

- [ ] **Step 6: Create `StudentQueueViewController`**

Create `backend/app/Http/Controllers/Api/V1/StudentQueueViewController.php`:

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Enrollment\BuildStudentQueueView;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\StudentQueueViewResource;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * PRD §5.3 FR-FIN-006: the student's own read-only "where am I in the
 * queue" view. Gated entirely by the route's `role:student` middleware —
 * there is no per-record ownership dimension to check beyond "you are the
 * signed-in student", the same shape as the Dean's `stuck-enrollments`
 * single-action endpoint.
 */
final class StudentQueueViewController extends Controller
{
    /**
     * @throws AuthenticationException
     */
    public function show(Request $request, BuildStudentQueueView $buildStudentQueueView): JsonResponse
    {
        $actor = $this->authenticatedUser($request);

        $view = $buildStudentQueueView->execute($actor);

        $response = (new StudentQueueViewResource($view))->response($request);
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }

    /**
     * @throws AuthenticationException
     */
    private function authenticatedUser(Request $request): User
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        return $user;
    }
}
```

- [ ] **Step 7: Add the route**

Open `backend/routes/api.php`. Add the `StudentQueueViewController` import
alongside the other `Api\V1\*Controller` imports. Add this route
immediately after the `queue-tickets.store` route added in Task 3:

```php

        // PRD §5.3 FR-FIN-006: the student's own read-only queue status —
        // stage, own ticket + position, and the board (now serving, next
        // up). No per-record ownership dimension beyond "you are the
        // signed-in student", so the route-level role gate is enough.
        Route::middleware('role:student')->group(function (): void {
            Route::get('/queue-status', [StudentQueueViewController::class, 'show'])->name('queue-status.show');
        });
```

- [ ] **Step 8: Update `ApiSurfaceTest`**

Open `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`. Add the new route
to the routes list, immediately after `'POST api/v1/queue-tickets',`:

```php
            'GET|HEAD api/v1/queue-status',
```

Add the new route name to the route-names list, immediately after
`'api.v1.queue-tickets.store',`:

```php
            'api.v1.queue-status.show',
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `cd backend && php artisan test --filter=StudentQueueViewEndpointTest`

Expected: PASS, all 10 tests.

Run: `cd backend && php artisan test --filter=ApiSurfaceTest`

Expected: PASS.

- [ ] **Step 10: Run the full backend suite**

Run: `cd backend && php artisan test`

Expected: all tests pass.

- [ ] **Step 11: Run PHPStan**

Run: `cd backend && ./vendor/bin/phpstan analyse`

Expected: no new errors.

- [ ] **Step 12: Commit**

```bash
cd /c/xampp/htdocs/GRC-ENROLLMENT
git add backend/app/Domain/Enrollment/StudentQueueView.php backend/app/Actions/Enrollment/BuildStudentQueueView.php backend/app/Http/Resources/Api/V1/StudentQueueViewResource.php backend/app/Http/Controllers/Api/V1/StudentQueueViewController.php backend/routes/api.php backend/tests/Feature/Api/V1/StudentQueueViewEndpointTest.php backend/tests/Feature/Api/V1/ApiSurfaceTest.php
git commit -m "feat(queue): add the student's own read-only queue status endpoint

GET /api/v1/queue-status tells a student what stage their enrollment
is at, whether they can claim a ticket yet, their own ticket and
position if they have one, and a small board (now serving, next up
by ticket number only -- never another student's identity), plus
whether the queue is cut off for today. This is the read side a
later, separate frontend slice builds the live view on top of; no
frontend consumes it yet.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017PdBvDW7rzZNEyJAGqYyya"
```

---

### Task 9: Frontend — Cashier UI: cycle-aware queue, cut-off/resume, issue ticket

**Files:**
- Create: `frontend/src/features/schemas/queue-cycle-schema.ts`
- Create: `frontend/src/features/services/queue-cycle-service.ts`
- Create: `frontend/src/features/hooks/use-queue-cycle.ts`
- Create: `frontend/src/features/services/queue-cycle-service.test.ts`
- Modify: `frontend/src/features/schemas/queue-ticket-schema.ts`
- Modify: `frontend/src/features/schemas/cashier-transaction-schema.ts`
- Modify: `frontend/src/features/services/queue-ticket-service.ts`
- Modify: `frontend/src/features/hooks/use-queue-tickets.ts`
- Modify: `frontend/src/features/components/portal/accounting-payment-workspace.tsx`
- Modify: `frontend/src/features/components/portal/accounting-payment-workspace.test.tsx`
- Modify: `frontend/src/features/services/queue-ticket-service.test.ts`

**Interfaces:**
- Consumes: `GET /api/v1/queue-cycle`, `POST /api/v1/queue-cycle/cut-off`, `POST /api/v1/queue-cycle/resume` (Task 6); `POST /api/v1/queue-tickets` (Task 3); `ListQueueTickets`'s `cycle=open` filter (Task 3); `CashierPaymentCandidateResource`'s now-nullable `ticket` (Task 5).
- Produces: `QueueCycle` type + `useQueueCycleQuery`/`useCutOffQueueMutation`/`useResumeQueueMutation` — used only within this task's own component change, no further consumer in this plan. `useClaimQueueTicketMutation` — likewise.

- [ ] **Step 1: Write the failing tests first**

Open `frontend/src/features/components/portal/accounting-payment-workspace.test.tsx`.
Add these two fixtures immediately after the `cashierPaymentCandidate` const:

```tsx
const cashierPaymentCandidateNoTicket = {
  ...cashierPaymentCandidate,
  ticket: null,
} as const

const openCycle = {
  type: "queue_cycle",
  id: 1,
  opened_on: "2026-07-30",
  status: "open",
  status_label: "Open",
  cut_off_at: null,
  cut_off_service_date: null,
} as const

const cutOffCycle = {
  ...openCycle,
  status: "cut_off",
  status_label: "Cut off for today",
  cut_off_at: "2026-07-30T09:00:00Z",
  cut_off_service_date: "2026-07-30",
} as const
```

Replace the `mockRoutes()` function to add `/queue-cycle` and the claim
`POST /queue-tickets` handling:

```tsx
function mockRoutes(
  overrides: {
    tickets?: readonly unknown[]
    candidate?: typeof cashierPaymentCandidate | typeof cashierPaymentCandidateNoTicket
    cycle?: typeof openCycle | typeof cutOffCycle | null
  } = {},
) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const target = url(input)
    if (target.includes("/cashier-payment-candidates"))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: overrides.candidate ?? cashierPaymentCandidate,
          }),
        ),
      )
    if (target.includes("/queue-cycle/cut-off"))
      return Promise.resolve(
        new Response(JSON.stringify({ data: overrides.cycle ?? cutOffCycle })),
      )
    if (target.includes("/queue-cycle/resume"))
      return Promise.resolve(
        new Response(JSON.stringify({ data: overrides.cycle ?? openCycle })),
      )
    if (target.includes("/queue-cycle"))
      return Promise.resolve(
        new Response(JSON.stringify({ data: overrides.cycle ?? null })),
      )
    if (target.includes("/queue-tickets") && init?.method === "POST")
      return Promise.resolve(
        new Response(JSON.stringify({ data: waitingTicket }), { status: 201 }),
      )
    if (target.includes("/queue-tickets"))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: overrides.tickets ?? [servingTicket, waitingTicket],
            links: paginationLinks,
            meta: paginationMeta,
          }),
        ),
      )
    if (target.includes("/students/4/account"))
      return Promise.resolve(
        new Response(JSON.stringify({ data: studentAccount })),
      )
    if (target.includes("/enrollments") && init?.method === "POST")
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              enrollment: { ...pendingPaymentEnrollment, status: "enrolled" },
              payment: {
                external_reference: null,
                amount: "5775.00",
                promissory_note_on_file: false,
                confirmed_at: "2026-07-30T00:00:00Z",
              },
              document: {
                document_type: "com",
                document_number: "COM000009",
                generated_at: "2026-07-30T00:00:00Z",
              },
            },
          }),
          { status: 201 },
        ),
      )
    if (target.includes("/enrollments"))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [pendingPaymentEnrollment],
            links: paginationLinks,
            meta: paginationMeta,
          }),
        ),
      )
    return Promise.resolve(new Response(JSON.stringify({ data: [] })))
  }
}
```

Add these four tests immediately after the `"shows the currently serving
ticket with its amount due"` test:

```tsx
  it("shows a cut-off banner and lets the cashier resume the queue", async () => {
    fetchMock.mockImplementation(mockRoutes({ cycle: cutOffCycle }))
    const user = userEvent.setup()
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    expect(
      await screen.findByText(/cut off for today/i),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Resume queue" }))

    expect(
      await screen.findByRole("button", { name: "Cut off for today" }),
    ).toBeInTheDocument()
  })

  it("lets the cashier cut off the queue for today", async () => {
    fetchMock.mockImplementation(mockRoutes({ cycle: openCycle }))
    const user = userEvent.setup()
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    await user.click(
      await screen.findByRole("button", { name: "Cut off for today" }),
    )
    await user.click(screen.getByRole("button", { name: "Confirm cut-off" }))

    expect(
      await screen.findByText(/cut off for today/i),
    ).toBeInTheDocument()
  })

  it("shows an Issue queue ticket button when the candidate has no ticket yet", async () => {
    fetchMock.mockImplementation(
      mockRoutes({ candidate: cashierPaymentCandidateNoTicket }),
    )
    const user = userEvent.setup()
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    await user.type(
      screen.getByLabelText("Find student number"),
      "2026-0002",
    )
    await user.click(screen.getByRole("button", { name: "Find student" }))

    const issueButton = await screen.findByRole("button", {
      name: "Issue queue ticket",
    })
    await user.click(issueButton)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/queue-tickets"),
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("sorts a carry-over ticket from an earlier date ahead of a later one", async () => {
    const carryOver = { ...waitingTicket, id: 3, ticket_number: "Q000", queue_date: "2026-07-29", created_at: "2026-07-29T23:00:00Z" }
    fetchMock.mockImplementation(
      mockRoutes({ tickets: [servingTicket, carryOver, waitingTicket] }),
    )
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    const table = await screen.findByRole("table", { name: "Waiting" })
    const rows = await within(table).findAllByRole("row")
    // Q000's queue_date (07-29) is earlier than Q002's (07-30) despite a
    // LATER created_at timestamp -- proving queue_date, not just the
    // COALESCE effective-order, decides the tiebreak.
    expect(within(rows[1]).getByText("Q000")).toBeInTheDocument()
    expect(within(rows[2]).getByText("Q002")).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/components/portal/accounting-payment-workspace.test.tsx`

Expected: FAIL — the three new interactive tests fail because no
"Cut off for today"/"Resume queue"/"Issue queue ticket" controls exist
yet; the carry-over sort test fails because `byQueueOrder` does not yet
compare `queue_date`.

- [ ] **Step 3: Add the `cycle` filter to the queue-ticket schema**

Open `frontend/src/features/schemas/queue-ticket-schema.ts`. Replace the
`queueTicketFiltersSchema` definition:

```ts
export const queueTicketFiltersSchema = z
  .object({
    queue_date: z.iso.date().optional(),
    status: z.enum(queueTicketStatusValues).optional(),
    cycle: z.literal("open").optional(),
    page: z.number().int().positive().default(1),
    per_page: z.number().int().min(1).max(100).default(20),
  })
  .strict()
```

- [ ] **Step 4: Make the cashier candidate's `ticket` nullable**

Open `frontend/src/features/schemas/cashier-transaction-schema.ts`.
Replace the `ticket` field inside `cashierPaymentCandidateSchema`:

```ts
    ticket: z
      .object({
        id: z.number().int().positive(),
        ticket_number: z.string().min(1),
        status: z.enum(["waiting", "serving"]),
      })
      .strict()
      .nullable(),
```

- [ ] **Step 5: Add `claimQueueTicket` to the queue-ticket service**

Open `frontend/src/features/services/queue-ticket-service.ts`. Replace the
import line for `api-client`:

```ts
import {
  ApiClientError,
  getAuthenticatedJson,
  patchAuthenticatedJson,
  postAuthenticatedJson,
} from "@/features/services/api-client"
```

Add this function at the end of the file:

```ts
export async function claimQueueTicket(
  studentNumber?: string,
): Promise<QueueTicket> {
  const payload = await postAuthenticatedJson(
    QUEUE_TICKETS_PATH,
    studentNumber ? { student_number: studentNumber } : undefined,
  )
  return parse(queueTicketEnvelopeSchema, payload, "claimed queue ticket")
    .data
}
```

- [ ] **Step 6: Create the queue-cycle schema**

Create `frontend/src/features/schemas/queue-cycle-schema.ts`:

```ts
import { z } from "zod"

const queueCycleStatusValues = ["open", "cut_off", "closed"] as const

export const queueCycleResourceSchema = z
  .object({
    type: z.literal("queue_cycle"),
    id: z.number().int().positive(),
    opened_on: z.iso.date(),
    status: z.enum(queueCycleStatusValues),
    status_label: z.string().min(1),
    cut_off_at: z.iso.datetime().nullable(),
    cut_off_service_date: z.iso.date().nullable(),
  })
  .strict()

export const queueCycleEnvelopeSchema = z
  .object({ data: queueCycleResourceSchema })
  .strict()

export const nullableQueueCycleEnvelopeSchema = z
  .object({ data: queueCycleResourceSchema.nullable() })
  .strict()

export type QueueCycle = z.infer<typeof queueCycleResourceSchema>
```

- [ ] **Step 7: Create the queue-cycle service**

Create `frontend/src/features/services/queue-cycle-service.ts`:

```ts
import {
  nullableQueueCycleEnvelopeSchema,
  queueCycleEnvelopeSchema,
  type QueueCycle,
} from "@/features/schemas/queue-cycle-schema"
import {
  ApiClientError,
  getAuthenticatedJson,
  postAuthenticatedJson,
} from "@/features/services/api-client"

export const QUEUE_CYCLE_PATH = "/api/v1/queue-cycle"

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

export async function getQueueCycle(
  signal?: AbortSignal,
): Promise<QueueCycle | null> {
  const envelope = parse(
    nullableQueueCycleEnvelopeSchema,
    await getAuthenticatedJson(QUEUE_CYCLE_PATH, signal),
    "queue cycle",
  )
  return envelope.data
}

export async function cutOffQueueCycle(): Promise<QueueCycle> {
  const envelope = parse(
    queueCycleEnvelopeSchema,
    await postAuthenticatedJson(`${QUEUE_CYCLE_PATH}/cut-off`),
    "cut-off queue cycle",
  )
  return envelope.data
}

export async function resumeQueueCycle(): Promise<QueueCycle> {
  const envelope = parse(
    queueCycleEnvelopeSchema,
    await postAuthenticatedJson(`${QUEUE_CYCLE_PATH}/resume`),
    "resume queue cycle",
  )
  return envelope.data
}
```

Create `frontend/src/features/services/queue-cycle-service.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  cutOffQueueCycle,
  getQueueCycle,
  resumeQueueCycle,
} from "@/features/services/queue-cycle-service"
import { setAuthTokenProvider } from "@/features/services/api-client"

const cycle = {
  type: "queue_cycle",
  id: 1,
  opened_on: "2026-08-23",
  status: "open",
  status_label: "Open",
  cut_off_at: null,
  cut_off_service_date: null,
} as const

describe("queue-cycle-service", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    setAuthTokenProvider(() => "test-token")
  })
  afterEach(() => vi.unstubAllGlobals())

  it("returns null when no cycle is open", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: null })))

    await expect(getQueueCycle()).resolves.toBeNull()
  })

  it("returns the open cycle", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: cycle })))

    await expect(getQueueCycle()).resolves.toEqual(cycle)
  })

  it("cuts off the queue", async () => {
    const cutOff = { ...cycle, status: "cut_off" as const }
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: cutOff })))

    await expect(cutOffQueueCycle()).resolves.toEqual(cutOff)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/queue-cycle/cut-off"),
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("resumes the queue", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: cycle })))

    await expect(resumeQueueCycle()).resolves.toEqual(cycle)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/queue-cycle/resume"),
      expect.objectContaining({ method: "POST" }),
    )
  })
})
```

- [ ] **Step 8: Create the queue-cycle hook**

Create `frontend/src/features/hooks/use-queue-cycle.ts`:

```ts
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import {
  cutOffQueueCycle,
  getQueueCycle,
  resumeQueueCycle,
} from "@/features/services/queue-cycle-service"

export const queueCycleQueryKey = (userId: string | null) =>
  ["queue-cycle", userId] as const

/**
 * Polls at the same 5s cadence as `useQueueTicketsQuery` on the same
 * screen — cut-off/resume is a Cashier action another window or another
 * accounting staff member may take, and the cut-off banner needs to
 * reflect that without a manual reload.
 */
export function useQueueCycleQuery({
  enabled = true,
}: { enabled?: boolean } = {}) {
  const { session } = useAuth()

  return useQuery({
    queryKey: queueCycleQueryKey(session?.userId ?? null),
    queryFn: ({ signal }) => getQueueCycle(signal),
    enabled: enabled && session !== null,
    refetchInterval: 5_000,
    refetchOnWindowFocus: "always",
  })
}

export function useCutOffQueueMutation() {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: cutOffQueueCycle,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queueCycleQueryKey(session?.userId ?? null),
      })
      queryClient.invalidateQueries({
        queryKey: ["queue-tickets", session?.userId ?? null],
      })
    },
  })
}

export function useResumeQueueMutation() {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: resumeQueueCycle,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queueCycleQueryKey(session?.userId ?? null),
      })
      queryClient.invalidateQueries({
        queryKey: ["queue-tickets", session?.userId ?? null],
      })
    },
  })
}
```

- [ ] **Step 9: Add `useClaimQueueTicketMutation`**

Open `frontend/src/features/hooks/use-queue-tickets.ts`. Add
`claimQueueTicket` to the existing service import:

```ts
import {
  claimQueueTicket,
  listQueueTickets,
  updateQueueTicket,
} from "@/features/services/queue-ticket-service"
```

Add this function at the end of the file:

```ts
export function useClaimQueueTicketMutation() {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (studentNumber?: string) => claimQueueTicket(studentNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["queue-tickets", session?.userId ?? null],
      })
      queryClient.invalidateQueries({
        queryKey: ["cashier-payment-candidate", session?.userId ?? null],
      })
    },
  })
}
```

- [ ] **Step 10: Fix `byQueueOrder` and the tickets-query filter**

Open `frontend/src/features/components/portal/accounting-payment-workspace.tsx`.
Delete the `todayIsoDate` function (lines 55-57) — it becomes unused.

Replace the `byQueueOrder` function's docblock and body:

```ts
/**
 * Priority tickets always precede regular ones; within a tier, ordered by
 * `queue_date` (the Cashier's queue can span multiple Manila service days
 * once a cut-off carries tickets forward — a carry-over always sorts ahead
 * of a ticket claimed on a later date, even if the carry-over's own
 * `requeued_at` is a later raw timestamp than the newer ticket's
 * `created_at`), then effective order — `requeued_at` if the ticket was
 * ever skipped, otherwise `created_at`.
 *
 * `created_at`/`requeued_at` are whole-second timestamps, so an exact tie
 * on that effective order is routine, not a rare edge case. `id` can't be
 * the *whole* tiebreak for that tie: a low-id ticket requeued after a
 * higher-id ticket already exists must now sort *after* it, which a plain
 * `id` comparison gets backwards. So a tie first splits on whether the
 * ticket was ever requeued — never-requeued (arrival order) always
 * precedes requeued (skip moment) — and only falls back to `id` once both
 * candidates agree on that split, i.e. a true same-instant tie within one
 * regime. Mirrors `QueueTicket::position()`/`ListQueueTickets` server-side
 * exactly (`queue_date`, then effective order, then the `requeued_at IS
 * NOT NULL` regime split, then `id`).
 */
function byQueueOrder(a: QueueTicket, b: QueueTicket): number {
  if (a.priority !== b.priority) return a.priority === "priority" ? -1 : 1
  if (a.queue_date !== b.queue_date) return a.queue_date < b.queue_date ? -1 : 1
  const aOrder = a.requeued_at ?? a.created_at
  const bOrder = b.requeued_at ?? b.created_at
  if (aOrder !== bOrder) return aOrder < bOrder ? -1 : 1
  const aRequeued = a.requeued_at !== null
  const bRequeued = b.requeued_at !== null
  if (aRequeued !== bRequeued) return aRequeued ? 1 : -1
  return a.id - b.id
}
```

Replace the `useQueueTicketsQuery` import and its two new sibling hook
imports:

```ts
import {
  useClaimQueueTicketMutation,
  useQueueTicketsQuery,
  useUpdateQueueTicketMutation,
} from "@/features/hooks/use-queue-tickets"
import {
  useCutOffQueueMutation,
  useQueueCycleQuery,
  useResumeQueueMutation,
} from "@/features/hooks/use-queue-cycle"
```

Replace the `ticketsQuery` call:

```ts
  const ticketsQuery = useQueueTicketsQuery(
    { cycle: "open", page: 1, per_page: 100 },
    { enabled: authorized },
  )
```

- [ ] **Step 11: Add cycle state, mutations, and the cut-off/resume UI**

Still in `accounting-payment-workspace.tsx`, add these hooks and state
variables immediately after the existing `const accountPaymentMutation = ...`
line:

```ts
  const cycleQuery = useQueueCycleQuery({ enabled: authorized })
  const cutOffMutation = useCutOffQueueMutation()
  const resumeMutation = useResumeQueueMutation()
  const claimMutation = useClaimQueueTicketMutation()
  const [cuttingOff, setCuttingOff] = useState(false)
```

Add this handler immediately after the existing `serveSelectedStudent`
function:

```ts
  const issueTicketForCandidate = () => {
    const candidate = candidateQuery.data
    if (!candidate) return
    claimMutation.mutate(candidate.student_number)
  }
```

Replace the `<Card>` block titled "Find student" — inside its
`{candidateQuery.data && (...)}` block, replace the ternary chain that
currently starts `{candidateQuery.data.ticket.status === "serving" ...}`:

```tsx
              {candidateQuery.data.ticket === null ? (
                <Button
                  type="button"
                  disabled={claimMutation.isPending}
                  onClick={issueTicketForCandidate}
                >
                  Issue queue ticket
                </Button>
              ) : candidateQuery.data.ticket.status === "serving" ? (
                <p className="font-medium">This student is now serving.</p>
              ) : nowServing ? (
                <p className="text-muted-foreground">
                  Skip the current ticket before serving this student.
                </p>
              ) : (
                <Button
                  type="button"
                  disabled={ticketMutation.isPending}
                  onClick={serveSelectedStudent}
                >
                  Serve selected student
                </Button>
              )}
```

Also replace the candidate summary line just above it, which currently
always reads the ticket number unconditionally:

```tsx
                <p className="text-muted-foreground">
                  {candidateQuery.data.student_number} · Year{" "}
                  {candidateQuery.data.year_level}
                  {candidateQuery.data.ticket
                    ? ` · ${candidateQuery.data.ticket.ticket_number}`
                    : ""}
                </p>
```

Replace `serveSelectedStudent` itself to guard the now-nullable ticket:

```ts
  const serveSelectedStudent = () => {
    const candidate = candidateQuery.data
    if (!candidate || !candidate.ticket || nowServing) return

    ticketMutation.mutate({ id: candidate.ticket.id, action: "serve" })
  }
```

Add a new Card for queue status, immediately after the "Find student"
`<Card>` block and before the `<AsyncBoundary ...>` block:

```tsx
      <Card>
        <CardHeader>
          <CardTitle level={2}>Queue status</CardTitle>
          <CardDescription>
            {cycleQuery.data?.status === "cut_off"
              ? "The queue is cut off for today. Waiting tickets are saved and the queue resumes automatically on the next service day."
              : "The queue is open."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cycleQuery.data?.status === "cut_off" ? (
            <Button
              type="button"
              variant="outline"
              disabled={resumeMutation.isPending}
              onClick={() => resumeMutation.mutate()}
            >
              Resume queue
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={cutOffMutation.isPending}
              onClick={() => setCuttingOff(true)}
            >
              Cut off for today
            </Button>
          )}
        </CardContent>
      </Card>
```

Add a confirm dialog for cut-off, immediately after the existing
`recordingBalance` `<AlertDialog>` block and before the closing
`</WorkspacePage>`:

```tsx
      <AlertDialog
        open={cuttingOff}
        onOpenChange={(open) => {
          if (!open && !cutOffMutation.isPending) setCuttingOff(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cut off the queue for today?</AlertDialogTitle>
            <AlertDialogDescription>
              {waiting.length > 0
                ? `${waiting.length} student${waiting.length === 1 ? "" : "s"} still waiting will keep their place and are carried forward automatically — they do not need a new ticket.`
                : "The queue will resume automatically on the next service day."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cutOffMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={cutOffMutation.isPending}
              onClick={async () => {
                await cutOffMutation.mutateAsync()
                setCuttingOff(false)
              }}
            >
              Confirm cut-off
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
```

Finally, extend the `lastUpdated` prop on `<WorkspacePage>` to include the
cycle query:

```tsx
      lastUpdated={Math.max(
        ticketsQuery.dataUpdatedAt,
        pendingPaymentQuery.dataUpdatedAt,
        accountQuery.dataUpdatedAt,
        cycleQuery.dataUpdatedAt,
      )}
```

- [ ] **Step 12: Update the remaining fixture for schema compliance**

Open `frontend/src/features/services/queue-ticket-service.test.ts`. If it
constructs a `QueueTicketFilters` object anywhere with an explicit key
list (rather than spreading), confirm `cycle` is optional there too — no
change should be needed since `cycle` is `.optional()`. Add a small test
for the new `claimQueueTicket` function, matching the file's existing
style for `updateQueueTicket`:

```ts
  it("claims a queue ticket for the signed-in student", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: ticket }), { status: 201 }),
    )

    await expect(claimQueueTicket()).resolves.toEqual(ticket)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/queue-tickets"),
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("claims a queue ticket for a student by number", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: ticket }), { status: 201 }),
    )

    await claimQueueTicket("2026-08-00001")

    const [, init] = fetchMock.mock.calls[0] ?? []
    expect(JSON.parse(String(init?.body))).toEqual({
      student_number: "2026-08-00001",
    })
  })
```

Add `claimQueueTicket` to that file's existing import from
`@/features/services/queue-ticket-service`.

- [ ] **Step 13: Run the new and touched tests**

Run: `cd frontend && npx vitest run src/features/components/portal/accounting-payment-workspace.test.tsx src/features/services/queue-cycle-service.test.ts src/features/services/queue-ticket-service.test.ts`

Expected: PASS, all tests in all three files.

- [ ] **Step 14: Run the full frontend suite**

Run: `cd frontend && npm test`

Expected: all tests pass.

- [ ] **Step 15: Run TypeScript and lint checks**

Run: `cd frontend && npm run typecheck && npm run lint`

Expected: no errors.

- [ ] **Step 16: Commit**

```bash
cd /c/xampp/htdocs/GRC-ENROLLMENT
git add frontend/src/features/schemas/queue-cycle-schema.ts frontend/src/features/services/queue-cycle-service.ts frontend/src/features/services/queue-cycle-service.test.ts frontend/src/features/hooks/use-queue-cycle.ts frontend/src/features/schemas/queue-ticket-schema.ts frontend/src/features/schemas/cashier-transaction-schema.ts frontend/src/features/services/queue-ticket-service.ts frontend/src/features/services/queue-ticket-service.test.ts frontend/src/features/hooks/use-queue-tickets.ts frontend/src/features/components/portal/accounting-payment-workspace.tsx frontend/src/features/components/portal/accounting-payment-workspace.test.tsx
git commit -m "feat(portal): wire cut-off/resume and ticket issuance into the Cashier screen

The Cashier's queue list now scopes to the open cycle (cycle=open)
instead of today's queue_date, so carried-over tickets stay visible;
byQueueOrder gains the matching queue_date tiebreak. Adds a queue
status card (cut off / open, with a confirm dialog showing how many
waiting students carry forward), a resume action, and an 'Issue
queue ticket' button in Find Student for a pending_payment
candidate with no ticket yet.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017PdBvDW7rzZNEyJAGqYyya"
```

---

## Self-Review

**Spec coverage:** Every mechanism in the design spec has a task: the
`queue_cycles` table and its single-open-cycle invariant (Task 1); Manila
service date (Task 1); `QueueCycleStatus`/`isDrained()` and the audit/
notification vocabulary (Task 2); the claim endpoint, idempotency, and the
`queue_date`-as-order-key fix to `position()`/`ListQueueTickets` (Task 3);
single-active-serving's cycle scope and the cut-off `serve` guard (Task 4);
`FindCashierPaymentCandidate`'s carry-over and no-ticket-yet lookup (Task
5); cut-off/resume including the abandoned-`serving`-ticket recovery (Task
6); removing the old auto-issue and tightening the schema (Task 7); the
student's own read-only queue-status view (Task 8); and the Cashier UI
consuming all of it (Task 9). Explicitly out of scope per the spec (kiosk
authentication, the student-facing live view's UI, Web Push, a no-show
removal path, `ConfirmPayment` completing the ticket) has no task —
correctly, since each is named as a separate, later slice or a known,
deliberate gap.

**Placeholder scan:** No TBD/TODO. Every step carries literal code, exact
test assertions, and exact commands.

**Type consistency:** `QueueTicket::position(): ?int` keeps its signature
across Tasks 3-4. `ClaimQueueTicket::execute(Enrollment, User,
AuditRequestContext): QueueTicket` (Task 3) is never called from any other
task in this plan except via the shared `POST /queue-tickets` endpoint
(Task 9's Cashier "Issue ticket" button uses the endpoint, not the Action
directly). `TransitionQueueCycle::cutOff()`/`::resume()` both return
`QueueCycle` (Task 6), matching `QueueCycleResource`'s constructor
expectation and `QueueCycleController`'s return type. `StudentQueueView`'s
constructor parameter order (Task 8) matches every call site (only
`BuildStudentQueueView::execute()`). Frontend: `QueueTicket` gains no new
required field in this plan (`queue_date` already existed); `QueueCycle`
(Task 9) matches the backend `QueueCycleResource` field-for-field.
`CashierPaymentCandidate.ticket` becomes nullable identically on both
backend (Task 5) and frontend (Task 9) — verified against `FindCashier
PaymentCandidate`'s new return value and `CashierPaymentCandidateResource`'s
new `ticket === null` branch.
