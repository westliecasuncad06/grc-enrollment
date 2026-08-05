# Cashier queue live refresh and skip-requeue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Cashier's queue screen refresh live, and change "Skip" so
a skipped student is requeued to the back of the waiting line instead of
being permanently cancelled and made invisible everywhere in the app.

**Architecture:** Part A (Task 1) adds the same active-tab polling already
used elsewhere in this app to `useQueueTicketsQuery`. Part B (Tasks 2-3)
changes what `skip` means end to end: a new nullable `requeued_at` column
on `queue_tickets` replaces raw `id` as the ordering tiebreaker everywhere
a queue is sorted, so a skipped ticket can be moved to "the back" without
losing its place in the priority tier or its ticket number.

**Tech Stack:** Laravel backend (PHP, Eloquent, MariaDB), Next.js frontend
(TanStack Query, Zod), PHPUnit, Vitest + Testing Library.

## Global Constraints

- 5-second poll interval (`refetchInterval: 5_000`) + `refetchOnWindowFocus: "always"` for `useQueueTicketsQuery`, matching `useEnrollmentsListQuery`'s existing configuration exactly.
- `skip`'s target status changes from `QueueTicketStatus::Cancelled` to `QueueTicketStatus::Waiting`. `serve`, `complete`, and `mark_priority` are unchanged.
- Ordering tiebreaker everywhere a queue is sorted (`QueueTicket::position()`, `ListQueueTickets`, the frontend's `byQueueOrder`) changes from raw `id` to `COALESCE(requeued_at, created_at)` ascending, with `id` retained only as the final tiebreaker for a true timestamp tie.
- A skipped **Priority** ticket stays Priority — it goes to the back of its own priority tier, never behind a Regular ticket.
- No skip-count limit is added (explicitly out of scope — PRD §17 marks this queue-policy area provisional).
- No change to `QueueTicketPolicy` or any authorization rule.
- Full spec: `docs/superpowers/specs/2026-08-05-cashier-queue-live-refresh-and-skip-requeue-design.md`.

---

### Task 1: Poll `useQueueTicketsQuery` (Part A)

**Files:**
- Modify: `frontend/src/features/hooks/use-queue-tickets.ts:17-28` (the `useQueueTicketsQuery` function)
- Modify: `frontend/src/features/components/portal/accounting-payment-workspace.test.tsx` (add one test, extend `afterEach`, extend the `@testing-library/react` import)

**Interfaces:**
- Consumes: `useQueueTicketsQuery(filters: QueueTicketFilters, { enabled })` — existing signature, unchanged. `AccountingPaymentWorkspace` (existing component, unchanged) is the test's render target.
- Produces: nothing new is exported. The hook's return type is unchanged — only its runtime polling behavior changes.

- [ ] **Step 1: Write the failing regression test**

Open `frontend/src/features/components/portal/accounting-payment-workspace.test.tsx`.
Change the top `@testing-library/react` import to include `act`:

```tsx
import { act, screen, within } from "@testing-library/react"
```

Change the `afterEach` (currently `afterEach(() => vi.unstubAllGlobals())`)
to also reset real timers:

```tsx
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
```

Add this test right after the `"shows the currently serving ticket with its
amount due"` test (immediately before the `"shows the student's financial
status as a badge when set"` test):

```tsx
  it("refreshes the waiting list when a new ticket appears without a page reload", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let ticketIssued = false
    fetchMock.mockImplementation((input, init) => {
      const target = url(input)
      if (target.includes("/queue-tickets"))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: ticketIssued ? [waitingTicket] : [],
              links: paginationLinks,
              meta: paginationMeta,
            }),
          ),
        )
      return mockRoutes()(input, init)
    })

    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    const table = await screen.findByRole("table", { name: "Waiting" })
    expect(within(table).queryByText("Q002")).not.toBeInTheDocument()

    ticketIssued = true
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })

    expect(await within(table).findByText("Q002")).toBeInTheDocument()
  })
```

This reuses the file's existing `waitingTicket`, `paginationLinks`,
`paginationMeta`, `accountingSession`, `url`, and `mockRoutes` — no new
fixtures needed.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/components/portal/accounting-payment-workspace.test.tsx -t "refreshes the waiting list"`

Expected: FAIL. The initial empty Waiting table renders, but after
`advanceTimersByTimeAsync(5_000)` the query never refetches (no
`refetchInterval` is set yet), so `Q002` never appears and the test times
out waiting for `within(table).findByText("Q002")`.

- [ ] **Step 3: Add polling to the hook**

Open `frontend/src/features/hooks/use-queue-tickets.ts`. Replace the current
`useQueueTicketsQuery` function (lines 17-28):

```ts
export function useQueueTicketsQuery(
  filters: QueueTicketFilters,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: queueTicketsQueryKey(session?.userId ?? null, filters),
    queryFn: ({ signal }) => listQueueTickets(filters, signal),
    enabled: enabled && session !== null,
  })
}
```

with:

```ts
/**
 * Polls every 5s so the Cashier's own queue stays current without a
 * manual reload — this hook drives `nowServing`/`waiting`/`servedToday`
 * directly in `AccountingPaymentWorkspace`, unlike `useEnrollmentsListQuery`
 * on the same screen, which only enriches ticket rows with payment data
 * (see that hook's own JSDoc). Matches the interval already used for the
 * schedule-proposals queue, the notification bell, and
 * `useEnrollmentsListQuery` (see
 * docs/superpowers/specs/2026-08-03-realtime-schedule-refresh-design.md and
 * docs/superpowers/specs/2026-08-05-realtime-enrollment-queue-refresh-design.md).
 * Refetches immediately on window focus. TanStack Query pauses polling in
 * hidden tabs by default (`refetchIntervalInBackground` is not set).
 */
export function useQueueTicketsQuery(
  filters: QueueTicketFilters,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: queueTicketsQueryKey(session?.userId ?? null, filters),
    queryFn: ({ signal }) => listQueueTickets(filters, signal),
    enabled: enabled && session !== null,
    refetchInterval: 5_000,
    refetchOnWindowFocus: "always",
  })
}
```

- [ ] **Step 4: Run the new test to verify it passes**

Run: `cd frontend && npx vitest run src/features/components/portal/accounting-payment-workspace.test.tsx -t "refreshes the waiting list"`

Expected: PASS.

- [ ] **Step 5: Run the full file to confirm no regressions**

Run: `cd frontend && npx vitest run src/features/components/portal/accounting-payment-workspace.test.tsx`

Expected: PASS, all tests in the file.

- [ ] **Step 6: Run TypeScript and lint checks**

Run: `cd frontend && npm run typecheck && npx eslint src/features/hooks/use-queue-tickets.ts src/features/components/portal/accounting-payment-workspace.test.tsx --max-warnings=0`

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /c/xampp/htdocs/GRC-ENROLLMENT
git add frontend/src/features/hooks/use-queue-tickets.ts frontend/src/features/components/portal/accounting-payment-workspace.test.tsx
git commit -m "feat(portal): poll the Cashier queue so new tickets appear live

useQueueTicketsQuery -- the hook that actually drives the Cashier's
Now Serving/Waiting/Served Today lists -- never refreshed automatically,
unlike useEnrollmentsListQuery on the same screen. Applies the same 5s
active-tab polling already used elsewhere in this app.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012RAC8uSdnwSc6kVkSTCQ44"
```

---

### Task 2: Backend — skip requeues instead of cancelling

**Files:**
- Create: `backend/database/migrations/2026_08_06_000006_add_requeued_at_to_queue_tickets.php`
- Modify: `backend/app/Models/QueueTicket.php`
- Modify: `backend/app/Actions/Enrollment/TransitionQueueTicket.php`
- Modify: `backend/app/Actions/Enrollment/ListQueueTickets.php`
- Modify: `backend/app/Http/Resources/Api/V1/QueueTicketResource.php`
- Modify: `backend/tests/Feature/Database/EnrollmentRecordsMigrationTest.php:54-56`
- Modify: `backend/tests/Feature/Api/V1/QueueTicketsEndpointTest.php`

**Interfaces:**
- Consumes: `QueueTicket` model (`App\Models\QueueTicket`), `QueueTicketStatus`/`QueueTicketPriority` enums (unchanged member sets), `TransitionQueueTicket::execute(QueueTicket $ticket, string $action, User $actor, AuditRequestContext $context): QueueTicket` (unchanged signature).
- Produces: `QueueTicket` gains a `requeued_at` attribute (nullable `Carbon`/`CarbonImmutable`) and `created_at` becomes part of its public API contract via `QueueTicketResource`. `QueueTicketResource::toArray()` now returns `created_at` and `requeued_at` (both `?string`, ISO 8601 UTC, `Y-m-d\TH:i:s\Z`) in addition to its existing keys — Task 3's frontend schema must add both.

- [ ] **Step 1: Write the failing migration/model tests first**

Open `backend/tests/Feature/Database/EnrollmentRecordsMigrationTest.php`. Find
this line (around line 54-56):

```php
        $this->assertTrue(Schema::hasColumns('queue_tickets', [
            'id', 'enrollment_id', 'ticket_number', 'queue_date', 'status', 'priority', 'served_at', 'served_by',
        ]));
```

Replace it with:

```php
        $this->assertTrue(Schema::hasColumns('queue_tickets', [
            'id', 'enrollment_id', 'ticket_number', 'queue_date', 'status', 'priority', 'served_at', 'served_by', 'requeued_at',
        ]));
```

Open `backend/tests/Feature/Api/V1/QueueTicketsEndpointTest.php`. Add
`QueueTicketPriority` to the imports (after the existing
`use App\Domain\Enrollment\QueueTicketStatus;` line):

```php
use App\Domain\Enrollment\QueueTicketPriority;
```

Replace `test_skip_cancels_a_waiting_ticket` (currently around line 199-211)
with:

```php
    public function test_skip_requeues_a_waiting_ticket_to_the_back_of_line(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $ticket = $this->makeTicket($student, $term, 'Q000001');
        $token = $this->tokenForNewUser(UserRole::AccountingStaff, 'accounting.skipwaiting@grc.test');

        $response = $this->withToken($token)->patchJson("/api/v1/queue-tickets/{$ticket->id}", ['action' => 'skip']);

        $response->assertOk()->assertJsonPath('data.status', 'waiting');
        $ticket->refresh();
        self::assertSame('waiting', $ticket->status->value);
        self::assertNotNull($ticket->requeued_at);
        self::assertSame(AuditAction::QUEUE_TICKET_SKIPPED, AuditLog::query()->sole()->action);
    }
```

Replace `test_skip_cancels_a_serving_ticket` (currently around line
213-224) with:

```php
    public function test_skip_requeues_a_serving_ticket_to_the_back_of_line(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum);
        $ticket = $this->makeTicket($student, $term, 'Q000001', '2026-08-01', QueueTicketStatus::Serving);
        $token = $this->tokenForNewUser(UserRole::AccountingStaff, 'accounting.skipserving@grc.test');

        $response = $this->withToken($token)->patchJson("/api/v1/queue-tickets/{$ticket->id}", ['action' => 'skip']);

        $response->assertOk()->assertJsonPath('data.status', 'waiting');
        self::assertNotNull($ticket->refresh()->requeued_at);
    }
```

Leave `test_skip_cannot_be_performed_from_served` exactly as-is (skip from
`served` stays blocked; unaffected by this change).

Add these two new tests immediately after
`test_skip_requeues_a_serving_ticket_to_the_back_of_line`:

```php
    public function test_a_requeued_ticket_moves_behind_tickets_with_a_higher_id(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $studentA = $this->makeStudent($curriculum, 'a.queue@grc.test', '2026-1001');
        $studentB = $this->makeStudent($curriculum, 'b.queue@grc.test', '2026-1002');
        $studentC = $this->makeStudent($curriculum, 'c.queue@grc.test', '2026-1003');
        $ticketA = $this->makeTicket($studentA, $term, 'Q000001');
        $ticketB = $this->makeTicket($studentB, $term, 'Q000002', '2026-08-01', QueueTicketStatus::Serving);
        $ticketC = $this->makeTicket($studentC, $term, 'Q000003');
        $token = $this->tokenForNewUser(UserRole::AccountingStaff, 'accounting.requeueorder@grc.test');

        self::assertSame(0, $ticketA->position());
        self::assertSame(1, $ticketC->position());

        $this->withToken($token)->patchJson("/api/v1/queue-tickets/{$ticketB->id}", ['action' => 'skip'])->assertOk();

        // B re-enters waiting behind C, even though B's id predates C's --
        // proving ordering now follows the requeue moment, not id.
        self::assertSame(0, $ticketA->refresh()->position());
        self::assertSame(1, $ticketC->refresh()->position());
        self::assertSame(2, $ticketB->refresh()->position());
    }

    public function test_a_requeued_priority_ticket_still_precedes_regular_tickets(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $studentA = $this->makeStudent($curriculum, 'a.queue@grc.test', '2026-1001');
        $studentB = $this->makeStudent($curriculum, 'b.queue@grc.test', '2026-1002');
        $ticketA = $this->makeTicket($studentA, $term, 'Q000001');
        $ticketB = $this->makeTicket($studentB, $term, 'Q000002', '2026-08-01', QueueTicketStatus::Serving);
        $ticketB->update(['priority' => QueueTicketPriority::Priority]);
        $token = $this->tokenForNewUser(UserRole::AccountingStaff, 'accounting.requeuepriority@grc.test');

        $this->withToken($token)->patchJson("/api/v1/queue-tickets/{$ticketB->id}", ['action' => 'skip'])->assertOk();

        // B is Priority; even requeued to the back of ITS tier, it still
        // precedes every Regular ticket, including A which never left waiting.
        self::assertSame(0, $ticketB->refresh()->position());
        self::assertSame(1, $ticketA->refresh()->position());
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && php artisan test --filter=QueueTicketsEndpointTest`

Expected: FAIL. `test_skip_requeues_a_waiting_ticket_to_the_back_of_line`
and its `_serving_` sibling fail with `Unknown column 'requeued_at'` (the
migration doesn't exist yet) or an assertion mismatch (`skip` still targets
`cancelled`). The two new ordering tests fail the same way.

Run: `cd backend && php artisan test --filter=EnrollmentRecordsMigrationTest`

Expected: FAIL — `requeued_at` is not yet a column on `queue_tickets`.

- [ ] **Step 3: Create the migration**

Create `backend/database/migrations/2026_08_06_000006_add_requeued_at_to_queue_tickets.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Skip no longer cancels a ticket (see `TransitionQueueTicket`) -- it
 * requeues the ticket to the back of its priority tier instead. Ordering
 * is otherwise purely `id`-based (immutable, monotonic), so there is no
 * way to "move a ticket to the back" without a new sortable marker. This
 * nullable timestamp is that marker: null for a never-skipped ticket
 * (which sorts by `created_at`, unchanged), set to the skip moment for a
 * requeued one, so it naturally sorts after every ticket issued or last
 * requeued before it. See `QueueTicket::position()` and `ListQueueTickets`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('queue_tickets', function (Blueprint $table) {
            $table->timestamp('requeued_at')->nullable()->after('served_by');
        });
    }

    public function down(): void
    {
        Schema::table('queue_tickets', function (Blueprint $table) {
            $table->dropColumn('requeued_at');
        });
    }
};
```

Run the migration:

Run: `cd backend && php artisan migrate --database=mariadb_migrator --force`

Then grant `grc_app` access to the (already-existing, now-altered)
`queue_tickets` table if the schema-level grant from the 2026-08-05
recovery does not already cover it: `SHOW GRANTS FOR 'grc_app'@'127.0.0.1';`
should already list `queue_tickets` under a schema-wide
`grc_enrollment.*` grant — if instead you see per-table grants without one
for `queue_tickets`, add it per `docs/runbooks/mariadb-local.md`.

Run also for the test database: `cd backend && php artisan migrate --database=mariadb_migrator --env=testing --force`

- [ ] **Step 4: Update the `QueueTicket` model**

Open `backend/app/Models/QueueTicket.php`. Add `?CarbonImmutable
$requeued_at` to the class's `@property` PHPDoc block, right after
`@property ?int $served_by`:

```php
 * @property ?CarbonImmutable $requeued_at
```

Add `'requeued_at'` to `$fillable`, right after `'served_by'`:

```php
    protected $fillable = [
        'enrollment_id',
        'ticket_number',
        'queue_date',
        'status',
        'priority',
        'served_at',
        'served_by',
        'requeued_at',
    ];
```

Add `'requeued_at' => 'immutable_datetime'` to `casts()`, right after
`'served_at' => 'immutable_datetime'`:

```php
    protected function casts(): array
    {
        return [
            'status' => QueueTicketStatus::class,
            'priority' => QueueTicketPriority::class,
            'queue_date' => 'immutable_date',
            'served_at' => 'immutable_datetime',
            'requeued_at' => 'immutable_datetime',
        ];
    }
```

Replace the entire `position()` method with:

```php
    /**
     * How many other `waiting` tickets stand ahead of this one today — the
     * whole queue is never exposed to a student (privacy), only their own
     * count. `null` once this ticket has left `waiting` (position no
     * longer means anything for a ticket already being served or done).
     * Priority tickets always precede regular ones within the same day;
     * within a tier, ordered by `COALESCE(requeued_at, created_at)` --
     * arrival order for a never-skipped ticket, or the moment it was last
     * requeued for one that was -- with `id` as the final tiebreaker for a
     * true timestamp tie.
     */
    public function position(): ?int
    {
        if ($this->status !== QueueTicketStatus::Waiting) {
            return null;
        }

        $waitingOnSameDay = self::query()
            ->where('queue_date', $this->queue_date)
            ->where('status', QueueTicketStatus::Waiting);

        $applyOrderedBefore = function ($query): void {
            $effectiveOrder = ($this->requeued_at ?? $this->created_at)->format('Y-m-d H:i:s');

            $query->where(function ($query) use ($effectiveOrder) {
                $query->whereRaw('COALESCE(requeued_at, created_at) < ?', [$effectiveOrder])
                    ->orWhere(function ($query) use ($effectiveOrder) {
                        $query->whereRaw('COALESCE(requeued_at, created_at) = ?', [$effectiveOrder])
                            ->where('id', '<', $this->id);
                    });
            });
        };

        if ($this->priority === QueueTicketPriority::Priority) {
            $priorityQuery = (clone $waitingOnSameDay)->where('priority', QueueTicketPriority::Priority);
            $applyOrderedBefore($priorityQuery);

            return $priorityQuery->count();
        }

        $priorityAhead = (clone $waitingOnSameDay)
            ->where('priority', QueueTicketPriority::Priority)
            ->count();

        $regularQuery = (clone $waitingOnSameDay)->where('priority', QueueTicketPriority::Regular);
        $applyOrderedBefore($regularQuery);
        $regularAhead = $regularQuery->count();

        return $priorityAhead + $regularAhead;
    }
```

- [ ] **Step 5: Update `TransitionQueueTicket`**

Open `backend/app/Actions/Enrollment/TransitionQueueTicket.php`.

Replace the class docblock's second paragraph (the one starting "§17 leaves
reset cadence..."):

```php
 * §17 leaves reset cadence and priority eligibility unconfirmed — this
 * Action enforces only the three-step order (`waiting` → `serving` →
 * `served`, with `skip` as a `cancelled` exit from either `waiting` or
 * `serving`) and a single-active-serving rule, never any numbering or
 * eligibility policy. No notification is sent: calling, completing, or
 * skipping a ticket is Accounting's own operational action, with no
 * live-queue display this slice implements to make a push notification
 * meaningful yet.
```

with:

```php
 * §17 leaves reset cadence and priority eligibility unconfirmed — this
 * Action enforces only the three-step order (`waiting` → `serving` →
 * `served`, with `skip` as a `waiting` re-entry — stamping `requeued_at`
 * to push the ticket to the back of its own priority tier, see
 * `QueueTicket::position()` — from either `waiting` or `serving`) and a
 * single-active-serving rule, never any numbering or eligibility policy.
 * No skip-count limit is enforced: PRD §17 leaves this whole area
 * provisional, and a cap would be inventing policy, not implementing an
 * approved one. No notification is sent: calling, completing, or skipping
 * a ticket is Accounting's own operational action, with no live-queue
 * display this slice implements to make a push notification meaningful yet.
```

Replace `TARGET_STATUS`:

```php
    private const TARGET_STATUS = [
        'serve' => QueueTicketStatus::Serving,
        'complete' => QueueTicketStatus::Served,
        'skip' => QueueTicketStatus::Waiting,
    ];
```

Replace the ticket-update call inside `execute()`:

```php
            $lockedTicket->update([
                'status' => $targetStatus,
                'served_at' => $targetStatus === QueueTicketStatus::Served ? now() : $lockedTicket->served_at,
                'served_by' => $action === 'serve' ? $actor->id : $lockedTicket->served_by,
                'requeued_at' => $action === 'skip' ? now() : $lockedTicket->requeued_at,
            ]);
```

Replace `snapshot()`'s return type PHPDoc and body:

```php
    /**
     * @return array{status: string, priority: string, served_at: ?string, requeued_at: ?string}
     */
    private static function snapshot(QueueTicket $ticket): array
    {
        return [
            'status' => $ticket->status->value,
            'priority' => $ticket->priority->value,
            'served_at' => $ticket->served_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'requeued_at' => $ticket->requeued_at?->utc()->format('Y-m-d\TH:i:s\Z'),
        ];
    }
```

- [ ] **Step 6: Update `ListQueueTickets`**

Open `backend/app/Actions/Enrollment/ListQueueTickets.php`. Replace the
class docblock:

```php
/**
 * PRD §5.3 FR-FIN-006: Accounting Staff's operational view of the payment
 * queue, ordered deterministically by `queue_date` then the ticket's
 * effective order (`COALESCE(requeued_at, created_at)`, then `id`) --
 * plain arrival order for a never-skipped ticket, or requeue order for one
 * that was skipped. §17 leaves any reset or priority policy unconfirmed,
 * so no priority-tier ordering is asserted at this list level (the
 * Cashier's own waiting-line display sorts by priority tier itself; see
 * `byQueueOrder` in `accounting-payment-workspace.tsx`).
 */
```

Replace the `orderBy` chain inside `execute()`:

```php
        return QueueTicket::query()
            ->with(['enrollment.student'])
            ->when($queueDate !== null, fn ($query) => $query->whereDate('queue_date', $queueDate))
            ->when($status !== null, fn ($query) => $query->where('status', $status))
            ->orderBy('queue_date')
            ->orderByRaw('COALESCE(requeued_at, created_at)')
            ->orderBy('id')
            ->paginate($perPage, ['*'], 'page', $page)
            ->withQueryString();
```

- [ ] **Step 7: Update `QueueTicketResource`**

Open `backend/app/Http/Resources/Api/V1/QueueTicketResource.php`. Replace
the `@return array{...}` PHPDoc:

```php
    /**
     * Exact key set. `student_number` (never email or name) lets Accounting
     * identify whose ticket this is, matching `EnrollmentResource`'s
     * precedent. `served_by` is deliberately absent — actor identity is
     * never rendered to students, and Accounting identifies its own staff
     * from context, not this response. `created_at` is exposed so the
     * frontend can reproduce this same `COALESCE(requeued_at, created_at)`
     * ordering locally rather than guessing at it independently.
     *
     * @return array{
     *     type: string,
     *     id: int,
     *     enrollment_id: int,
     *     student_number: string,
     *     ticket_number: string,
     *     queue_date: string,
     *     status: string,
     *     status_label: string,
     *     priority: string,
     *     priority_label: string,
     *     created_at: ?string,
     *     served_at: ?string,
     *     requeued_at: ?string
     * }
     */
```

Replace the `toArray()` body:

```php
    public function toArray(Request $request): array
    {
        return [
            'type' => 'queue_ticket',
            'id' => $this->resource->id,
            'enrollment_id' => $this->resource->enrollment_id,
            'student_number' => $this->resource->enrollment->student->student_number,
            'ticket_number' => $this->resource->ticket_number,
            'queue_date' => $this->resource->queue_date->toDateString(),
            'status' => $this->resource->status->value,
            'status_label' => $this->resource->status->label(),
            'priority' => $this->resource->priority->value,
            'priority_label' => $this->resource->priority->label(),
            'created_at' => $this->resource->created_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'served_at' => $this->resource->served_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'requeued_at' => $this->resource->requeued_at?->utc()->format('Y-m-d\TH:i:s\Z'),
        ];
    }
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd backend && php artisan test --filter=QueueTicketsEndpointTest`

Expected: PASS, all tests including the two new ones.

Run: `cd backend && php artisan test --filter=EnrollmentRecordsMigrationTest`

Expected: PASS.

- [ ] **Step 9: Run the full backend suite to confirm no regressions**

Run: `cd backend && php artisan test`

Expected: all tests pass (this project was at 1048 passing before this
slice; expect that count plus the 2 new tests from Step 1, i.e. 1050,
modulo any other in-flight work in the tree).

- [ ] **Step 10: Commit**

```bash
cd /c/xampp/htdocs/GRC-ENROLLMENT
git add backend/database/migrations/2026_08_06_000006_add_requeued_at_to_queue_tickets.php backend/app/Models/QueueTicket.php backend/app/Actions/Enrollment/TransitionQueueTicket.php backend/app/Actions/Enrollment/ListQueueTickets.php backend/app/Http/Resources/Api/V1/QueueTicketResource.php backend/tests/Feature/Database/EnrollmentRecordsMigrationTest.php backend/tests/Feature/Api/V1/QueueTicketsEndpointTest.php
git commit -m "feat(queue): skip requeues a ticket instead of cancelling it

Skip used to set a ticket to Cancelled, a terminal status no screen in
the app ever displays -- a skipped student simply vanished from the
queue with no way to recall them. Skip now returns the ticket to
Waiting and stamps requeued_at, which every ordering site (position(),
ListQueueTickets, and the frontend's byQueueOrder in the next commit)
uses ahead of raw id, so the ticket lands at the back of its own
priority tier instead of losing its place entirely.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012RAC8uSdnwSc6kVkSTCQ44"
```

---

### Task 3: Frontend — skip requeues instead of cancelling

**Files:**
- Modify: `frontend/src/features/schemas/queue-ticket-schema.ts`
- Modify: `frontend/src/features/components/portal/accounting-payment-workspace.tsx:49-53` (the `byQueueOrder` function)
- Modify: `frontend/src/features/components/portal/accounting-payment-workspace.test.tsx` (fixtures + rewrite the skip test)
- Modify: `frontend/src/features/services/queue-ticket-service.test.ts` (fixture)

**Interfaces:**
- Consumes: `QueueTicketResource`'s now-larger field set from Task 2
  (`created_at: ?string`, `requeued_at: ?string`, both ISO 8601 UTC or
  `null`).
- Produces: `QueueTicket` (the Zod-inferred type from
  `queue-ticket-schema.ts`) gains `created_at: string` (non-nullable —
  every ticket has one) and `requeued_at: string | null`. Every other
  consumer of this type in the frontend (`accounting-payment-workspace.tsx`)
  is updated in this task; no other file references `QueueTicket` fields
  directly enough to need changes.

- [ ] **Step 1: Update the Zod schema**

Open `frontend/src/features/schemas/queue-ticket-schema.ts`. Replace the
`queueTicketResourceSchema` definition:

```ts
export const queueTicketResourceSchema = z
  .object({
    type: z.literal("queue_ticket"),
    id: z.number().int().positive(),
    enrollment_id: z.number().int().positive(),
    student_number: z.string().min(1),
    ticket_number: z.string().min(1),
    queue_date: z.iso.date(),
    status: z.enum(queueTicketStatusValues),
    status_label: z.string().min(1),
    priority: z.enum(queueTicketPriorityValues),
    priority_label: z.string().min(1),
    created_at: z.iso.datetime(),
    served_at: z.iso.datetime().nullable(),
    requeued_at: z.iso.datetime().nullable(),
  })
  .strict()
```

- [ ] **Step 2: Write the failing regression test**

Open `frontend/src/features/components/portal/accounting-payment-workspace.test.tsx`.

Add `created_at` and `requeued_at` to the `servingTicket` fixture:

```tsx
const servingTicket = {
  type: "queue_ticket",
  id: 1,
  enrollment_id: 9,
  student_number: "2026-0001",
  ticket_number: "Q001",
  queue_date: "2026-07-30",
  status: "serving",
  status_label: "Serving",
  priority: "regular",
  priority_label: "Regular",
  created_at: "2026-07-30T00:05:00Z",
  served_at: null,
  requeued_at: null,
} as const
```

And to `waitingTicket` (which spreads `servingTicket`, so only its own
overrides need the later `created_at`):

```tsx
const waitingTicket = {
  ...servingTicket,
  id: 2,
  enrollment_id: 10,
  student_number: "2026-0002",
  ticket_number: "Q002",
  status: "waiting",
  status_label: "Waiting",
  created_at: "2026-07-30T00:10:00Z",
} as const
```

Replace the `"skips the currently serving ticket"` test (which sends the
PATCH but never checks what the UI does afterward) with:

```tsx
  it("requeues the currently serving ticket to the back of the waiting line", async () => {
    const user = userEvent.setup()
    let skipped = false
    const requeuedTicket = {
      ...servingTicket,
      status: "waiting",
      status_label: "Waiting",
      requeued_at: "2026-07-30T01:00:00Z",
    }
    fetchMock.mockImplementation((input, init) => {
      const target = url(input)
      if (target.includes("/queue-tickets/1") && init?.method === "PATCH") {
        skipped = true
        return Promise.resolve(
          new Response(JSON.stringify({ data: requeuedTicket })),
        )
      }
      if (target.includes("/queue-tickets"))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: skipped ? [waitingTicket, requeuedTicket] : [servingTicket, waitingTicket],
              links: paginationLinks,
              meta: paginationMeta,
            }),
          ),
        )
      return mockRoutes()(input, init)
    })
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    await screen.findByText("Q001")
    await user.click(screen.getByRole("button", { name: "Skip" }))

    const table = await screen.findByRole("table", { name: "Waiting" })
    const rows = await within(table).findAllByRole("row")
    // header row, then Q002 (never requeued) ahead of Q001 (just
    // requeued) -- proving the skipped ticket lands at the back, not
    // simply back in the list in its old (lower-id) position.
    expect(within(rows[1]).getByText("Q002")).toBeInTheDocument()
    expect(within(rows[2]).getByText("Q001")).toBeInTheDocument()
  })
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/components/portal/accounting-payment-workspace.test.tsx -t "requeues the currently serving ticket"`

Expected: FAIL. `byQueueOrder` still sorts by raw `id`, so Q001 (id 1)
sorts ahead of Q002 (id 2) even after being requeued — the assertion on
`rows[1]`/`rows[2]` fails (or the schema parse itself fails first, since
`created_at`/`requeued_at` are now required by the schema but
`byQueueOrder` hasn't been touched yet — either failure mode confirms the
fix is still needed).

- [ ] **Step 4: Update `byQueueOrder`**

Open `frontend/src/features/components/portal/accounting-payment-workspace.tsx`.
Replace the `byQueueOrder` function (lines 49-53):

```ts
/**
 * Priority tickets always precede regular ones; within a tier, ordered by
 * effective order — `requeued_at` if the ticket was ever skipped,
 * otherwise `created_at`. A skipped ticket's `requeued_at` is stamped at
 * the moment it was skipped, so it naturally sorts after every ticket that
 * already existed then, landing at the back of its own tier. Mirrors
 * `QueueTicket::position()`/`ListQueueTickets` server-side exactly.
 */
function byQueueOrder(a: QueueTicket, b: QueueTicket): number {
  if (a.priority !== b.priority) return a.priority === "priority" ? -1 : 1
  const aOrder = a.requeued_at ?? a.created_at
  const bOrder = b.requeued_at ?? b.created_at
  if (aOrder !== bOrder) return aOrder < bOrder ? -1 : 1
  return a.id - b.id
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/components/portal/accounting-payment-workspace.test.tsx -t "requeues the currently serving ticket"`

Expected: PASS.

- [ ] **Step 6: Update the remaining fixture for schema compliance**

Open `frontend/src/features/services/queue-ticket-service.test.ts`. Replace
the `ticket` fixture:

```ts
const ticket = {
  type: "queue_ticket",
  id: 1,
  enrollment_id: 9,
  student_number: "2026-0001",
  ticket_number: "Q000009",
  queue_date: "2026-07-30",
  status: "waiting",
  status_label: "Waiting",
  priority: "regular",
  priority_label: "Regular",
  created_at: "2026-07-30T00:00:00Z",
  served_at: null,
  requeued_at: null,
} as const
```

- [ ] **Step 7: Run the full affected test files to confirm no regressions**

Run: `cd frontend && npx vitest run src/features/components/portal/accounting-payment-workspace.test.tsx src/features/services/queue-ticket-service.test.ts`

Expected: PASS, all tests in both files.

- [ ] **Step 8: Run the full frontend suite**

Run: `cd frontend && npm test`

Expected: all tests pass (533 passing before this slice per the prior
realtime-enrollment-queue slice; expect that count plus the 2 new tests
from Task 1 Step 1 and this task's Step 2, i.e. 535, modulo any other
in-flight work in the tree).

- [ ] **Step 9: Run TypeScript and lint checks**

Run: `cd frontend && npm run typecheck && npx eslint src/features/schemas/queue-ticket-schema.ts src/features/components/portal/accounting-payment-workspace.tsx src/features/components/portal/accounting-payment-workspace.test.tsx src/features/services/queue-ticket-service.test.ts --max-warnings=0`

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
cd /c/xampp/htdocs/GRC-ENROLLMENT
git add frontend/src/features/schemas/queue-ticket-schema.ts frontend/src/features/components/portal/accounting-payment-workspace.tsx frontend/src/features/components/portal/accounting-payment-workspace.test.tsx frontend/src/features/services/queue-ticket-service.test.ts
git commit -m "feat(portal): sort the Cashier waiting list by requeue order, not id

Completes the skip-requeue change: the frontend's byQueueOrder now
mirrors the backend's COALESCE(requeued_at, created_at) ordering
exactly, so a skipped ticket visibly lands at the back of the waiting
line instead of just reappearing in its old (lower-id) position.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012RAC8uSdnwSc6kVkSTCQ44"
```

---

## Self-Review

**Spec coverage:** Part A (poll `useQueueTicketsQuery`) is fully implemented
in Task 1. Part B's every stated mechanism — the new `requeued_at` column,
`skip`'s target status change, all three ordering sites switching from
raw `id` to `COALESCE(requeued_at, created_at)` + `id` tiebreak, and
Priority preservation on skip — is implemented across Tasks 2-3, each with
a test proving it (including the two new backend ordering tests and the
rewritten frontend skip test that asserts row order, not just that a PATCH
request was sent). The spec's "known limitation, deliberately not solved"
(no skip-count cap) has no corresponding task, correctly — it is explicitly
out of scope, and Task 2 Step 5 documents that in the code itself so it
isn't rediscovered as a gap later.

**Placeholder scan:** No TBD/TODO. Every step has literal, complete code —
full function/method bodies, full test bodies, exact commands.

**Type consistency:** `QueueTicket::position(): ?int` keeps its existing
signature across Task 2. `TransitionQueueTicket::execute()` keeps its
existing signature. `QueueTicketResource::toArray()` keeps its existing
key set plus two additions, consumed correctly by Task 3's schema (which
adds exactly those two keys, `created_at` non-nullable and `requeued_at`
nullable, matching the resource's `?string` vs its own non-nullable
`created_at`). `byQueueOrder(a: QueueTicket, b: QueueTicket): number`
keeps its existing signature in Task 3 — verified against its only call
site (`accounting-payment-workspace.tsx`'s `waiting` array `.sort()`),
which needs no change since the function's contract is unchanged.
