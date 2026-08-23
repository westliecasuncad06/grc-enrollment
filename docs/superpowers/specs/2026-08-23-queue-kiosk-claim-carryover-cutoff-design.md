# Queue kiosk claim, carry-over, and cut-off — backend design

**Date:** 2026-08-23

## Goal

Today, `TransitionEnrollment::execute()` auto-issues a Cashier queue ticket
the instant Registrar Staff approves an enrollment
(`backend/app/Actions/Enrollment/TransitionEnrollment.php:140-149`) — a
student has a queue number before they've left the house. The school's real
process requires the student to be physically at the Cashier. This design
moves ticket issuance to an explicit **claim** (a kiosk, built in a later
slice), and gives the Cashier a **cut-off/resume** operation so an unserved
line survives to the next service day without losing anyone's place or
number.

This document covers the backend only: claim, ordering, cut-off/carry-over,
and the Manila-timezone fix. It does not cover the kiosk's own
authentication (a separate slice) or the student-facing live view (another
separate slice) — both consume the endpoints this design produces.

## The core problem: `queue_date` is the wrong scoping key once lines carry over

Every existing query scopes "the queue" to `queue_date = today`
(`QueueTicket::position()`, `ListQueueTickets`, `TransitionQueueTicket`'s
single-active-serving bulk-complete, `FindCashierPaymentCandidate`). Once an
unserved ticket survives past midnight, that scoping key stops meaning "the
line" — a carried-over ticket's `queue_date` is yesterday, but it is still
in today's line.

## Chosen approach: `queue_cycles`, not a per-day table

A **cycle** is the unit of "one continuous line" — it opens on first claim
and stays open across a cut-off, closing only once it has been fully served
(drained) and at least one calendar day (Asia/Manila) has passed since its
last claim. Modeling the *line* as the row, with cut-off as a status *on*
that row, means carry-over requires zero data movement at midnight: a
carried ticket is already in the cycle, because the cycle never closed.

```php
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

    // Exactly one open cycle, enforced by the database — the same idiom as
    // enrollments.active_academic_term_id (2026_07_27_000010, a STORED
    // generated column that is NULL unless the row is live, backing a
    // UNIQUE index; SQL unique indexes ignore NULLs).
    $table->unsignedTinyInteger('open_marker')
        ->nullable()
        ->storedAs('case when `closed_at` is null then 1 else null end');
    $table->unique('open_marker', 'queue_cycles_single_open_cycle_unique');
});
```

`queue_tickets` gains `queue_cycle_id` (FK) and `ticket_sequence` (int,
`unique(queue_cycle_id, ticket_sequence)`). `ticket_sequence` exists
because `ticket_number` is a display string (`Q001`) — reparsing it to find
"the next number" is fragile (existing fixtures use both `Q001` and
`Q000001` forms) and gives no unique-constraint backstop against a lost
allocation silently producing two `Q056`s.

`queue_date` on each ticket is kept, unchanged in meaning ("the Manila date
this ticket was claimed on") — it stops being a *scope* key and becomes an
*order* key (below). The existing `unique(queue_date, ticket_number)`
constraint is kept too and continues to hold by construction (see the reset
rule).

**Rejected alternative — a `queue_service_days` table, one row per calendar
day, with tickets re-pointed to the next day's row at cut-off/rollover.**
This needs a batch job (nightly, or lazy-on-first-claim) that can fail, run
twice, or not run — and `position()` would have to walk a chain of
`carried_over_from_id` links. The cycle model needs neither.

## The open queue window

**Definition:** the single `queue_cycles` row with `closed_at IS NULL`.
`cut_off_at` being set does **not** close it — a cut-off pauses the line,
it does not end it.

Everywhere `queue_date` was the scope key, `queue_cycle_id` replaces it:
`QueueTicket::position()`, `ListQueueTickets`'s new `cycle=open` filter,
`TransitionQueueTicket`'s serve-time single-active-serving bulk-complete,
and `FindCashierPaymentCandidate`.

### Ordering: `queue_date` moves from scope key to order key

`ListQueueTickets` already orders by `queue_date` first, then
`COALESCE(requeued_at, created_at)`, then the requeued-regime split, then
`id`. `position()` never needed a `queue_date` term — every ticket it ever
compared shared one `queue_date` by definition, since it scoped to that
same date. That symmetry breaks the moment a cycle spans two dates: without
a `queue_date` term, a ticket skipped *today* (its `requeued_at` is a
today-timestamp) can sort *behind* a ticket claimed today that was never
skipped, even when the skipped ticket is a carry-over from yesterday that
rightfully belongs at the front of today's activity. `ListQueueTickets`'s
own docblock promises this never disagrees with `position()` — a promise
this design must keep, not merely preserve by accident.

**Final order chain, identical on both sides:** priority tier → `queue_date`
ASC → `COALESCE(requeued_at, created_at)` ASC → `requeued_at IS NOT NULL`
ASC → `id` ASC.

**Worked example** (Manila = UTC+8; DB columns are UTC). Cycle already at
`last_ticket_sequence` 49, Friday:

| ticket | claimed (PHT) | `queue_date` | `requeued_at` (UTC) | status |
|---|---|---|---|---|
| Q048 | Fri 16:20 | 2026-08-22 | – | waiting |
| Q049 | Fri 16:22, skipped Fri 16:40 | 2026-08-22 | 2026-08-22 08:40Z | waiting |
| Q050 | Sat 08:01 | 2026-08-23 | – | waiting |
| Q051 | Sat 08:02 | 2026-08-23 | – | waiting |

Order: Q048 → Q049 → Q050 → Q051 — carry-overs ahead of Saturday's new
claims, matching the requirement that a carried ticket keeps its place.

**Why the `queue_date` key specifically matters:** if the cashier calls
Q048 Saturday morning and skips it again, its new `requeued_at` (a Saturday
UTC timestamp) is later than Q050/Q051's Friday-vs-Saturday `created_at`
comparison would suggest under the COALESCE chain *alone* — without the
`queue_date` key, the re-skipped Q048 would jump behind Saturday's walk-ins
instead of merely going to the back of *its own* Friday group. With
`queue_date` as the outer key, Q048 goes to the back of the Friday group
only: `Q049, Q048, Q050, Q051`. That is the correct behavior — a skip sends
you to the back of your own line, not to the back of tomorrow's.

## Number allocation

**Locked:** exactly one row — the open `queue_cycles` row —
`SELECT ... FOR UPDATE`. Every concurrent claim contends on that one row;
no lock or scan ever touches `queue_tickets`.

```php
$cycle = QueueCycle::query()->whereNull('closed_at')->lockForUpdate()->first();

if ($cycle !== null && $cycle->last_claimed_on?->toDateString() < $today && $cycle->isDrained()) {
    $cycle->update(['closed_at' => now()]);
    $cycle = null;
}

if ($cycle === null) {
    $cycle = QueueCycle::create(['opened_on' => $today, 'last_ticket_sequence' => 0]);
    $cycle = QueueCycle::query()->whereKey($cycle->id)->lockForUpdate()->firstOrFail();
}

$sequence = $cycle->last_ticket_sequence + 1;
// ... create the ticket with ticket_sequence = $sequence, ticket_number = sprintf('Q%03d', $sequence) ...
$cycle->update(['last_ticket_sequence' => $sequence, 'last_claimed_on' => $today]);
```

**Retry policy.** Two claims that both see no open cycle both `INSERT` a
new `queue_cycles` row — there is no row to lock yet, so `lockForUpdate()`
cannot serialize that specific race. The single-open-cycle generated-column
unique index is what makes the loser's insert throw a `23000` duplicate-key
error; the claim action retries (bounded at 3 attempts, jittered sleep),
and the retry finds and locks the winner's row. The same retry also
covers a genuinely concurrent double-claim on one enrollment (see
`unique(queue_tickets.enrollment_id)` below).

**Rejected alternative — `COALESCE(MAX(ticket_sequence), 0) + 1` under a
`queue_tickets` row lock.** Correctness would depend on staying at
`REPEATABLE READ` and on a specific index existing, and concurrent inserts
into adjacent gaps can deadlock. A single-row counter is the boring,
provably-correct answer, and it also removes the existing unlocked
`COUNT(*) + 1` at `TransitionEnrollment.php:144`, which is doubly broken —
it would reuse a number after any row deletion, independent of the race.

## Reset rule

> The counter resets to `Q001` **only when** the open cycle has no
> outstanding `waiting`/`serving` ticket **and** its last claim happened on
> an earlier Manila service date than today.

The "no outstanding tickets" half is the requirement's stated rule; the
day-boundary half is added because it is what keeps
`unique(queue_date, ticket_number)` satisfied *by construction* — a cycle
boundary can only fall on a Manila date the outgoing cycle issued nothing
on, so two cycles can never claim the same `(queue_date, ticket_number)`
pair. Without it, a line that drains at noon and restarts at Q001 at 1pm
would put two different students on the *same day* holding Q001.

"Outstanding" is defined as `waiting`/`serving` **and** the ticket's
enrollment is still `pending_payment` (`QueueCycle::isDrained()`) — not
merely "not `served`". `ConfirmPayment` never touches the queue ticket
today (confirmed: no `QueueTicket` reference exists anywhere in
`app/Actions/Enrollment/ConfirmPayment.php`), so a student who pays but
whose ticket the Cashier never marks `complete` would otherwise block the
cycle from ever draining, and ticket numbers would climb unbounded over
weeks. This is a read-only predicate — no new write path — and is flagged
here rather than silently worked around, since the durable fix
(`ConfirmPayment` completing the ticket) is out of this slice's scope.

## Cut-off and resume

Cut-off does not close the cycle — it only records that "the Cashier
stopped serving for today," so students can be told, and so the queue
board can show the notice. `cut_off_service_date` scopes that message to
one Manila date; the very next successful claim on a later date resumes
automatically (no "forgot to press resume" failure mode). An explicit
resume exists for "we changed our mind, reopening today."

**Edge case: a ticket left `serving` across a cut-off.** If the Cashier
cuts off mid-transaction, that ticket would otherwise sit in `serving`
forever — invisible to the student (`position()` returns `null` for
anything not `Waiting`) yet still occupying the cycle's single active-serving
slot. Cut-off returns any `serving` ticket to `waiting` **without**
stamping `requeued_at` — they were never actually served, so they keep
their place rather than losing it to the back of the line.

## Manila service date

```php
// config/enrollment.php — NOT config/queue.php, which is Laravel's own
// job-queue config and unrelated to this domain queue.
'queue' => ['timezone' => env('ENROLLMENT_QUEUE_TIMEZONE', 'Asia/Manila')],
```

`QueueServiceDate::today()` wraps
`CarbonImmutable::now($timezone)->toDateString()`. **`config('app.timezone')`
stays `UTC`, untouched.** `created_at` is deliberately absent from
`QueueTicket::casts()` (so it stays a plain UTC-formatted
`Illuminate\Support\Carbon`), and `position()`'s `COALESCE(requeued_at,
created_at)` comparisons depend on every side of that comparison staying
UTC. Flipping `app.timezone` to Asia/Manila would shift every one of those
comparisons by 8 hours against data already written in UTC, silently
reordering the whole queue, and would make every other `now()` call in the
app Manila-local. The fix is a per-call conversion, scoped to `queue_date`
only.

This closes a real, live bug: `TransitionEnrollment.php:140` and
`FindCashierPaymentCandidate.php:27` both call `now()->toDateString()`
(UTC). Between 00:00–08:00 Philippine time, that returns *yesterday's*
date — a ticket claimed at 07:00 PHT (the realistic opening-rush hour once
students self-claim) gets `queue_date` = yesterday and becomes invisible to
any UI filtering on "today."

## Impact on existing files

| File | Change |
|---|---|
| `QueueTicket::position()` | Scope `queue_date` → `queue_cycle_id`; ordering gains the `queue_date` outer key |
| `ListQueueTickets` | New `cycle=open` filter, resolving and scoping to the open cycle; ordering unchanged (already correct) |
| `TransitionQueueTicket` | `serve`'s single-active-serving bulk-complete scope `queue_date` → `queue_cycle_id` (today it can leave two simultaneous `serving` tickets once a carry-over exists — a live "wrong student charged" risk, not cosmetic) |
| `TransitionEnrollment` | Ticket-issuance block removed; the Accounting-Staff broadcast on approval moves to `ClaimQueueTicket` |
| `FindCashierPaymentCandidate` | Scope `queue_date` → open cycle; Manila date; supports a candidate with no ticket yet (Cashier issues one) |
| `EnrollmentPolicy` | New `claimQueueTicket` ability |
| `AuditAction` / `AuditableType` | New: `QUEUE_TICKET_CLAIMED`, `QUEUE_CYCLE_CUT_OFF`, `QUEUE_CYCLE_RESUMED`, `QUEUE_CYCLE_CLOSED`; `AuditableType::QUEUE_CYCLE` |
| `NotificationType` | New: `QueueTicketClaimed`, `QueueCycleCutOff` |

## Known, deliberate scope boundaries

- No skip-count limit (unchanged from the prior slice — PRD §17 leaves this
  provisional).
- No no-show removal path — `QueueTicketStatus::Cancelled` stays
  unreachable (ADR 0022's known gap, not addressed here).
- `ConfirmPayment` still does not complete the queue ticket — flagged
  above, not fixed here.
- Kiosk authentication (who is allowed to call the claim endpoint from a
  front-desk device) and the student-facing live queue view are separate,
  later slices. This slice's claim endpoint is reachable by any
  authenticated Student for their own enrollment, or any Accounting Staff
  member — the kiosk slice adds a further restriction on top, it does not
  loosen this one.

## Test plan

- Migration: `queue_cycles` schema, the single-open-cycle unique, the
  `(queue_cycle_id, ticket_sequence)` unique, backfill lands existing
  tickets in a cycle.
- `ClaimQueueTicket`: numbering continues across a cut-off; resets once
  drained and a day has passed; idempotent on repeat claim; Manila
  boundary; Accounting Staff can claim on a student's behalf.
- `QueueTicket::position()` / `ListQueueTickets`: a carry-over ordering
  scenario proving both agree, including a re-skip case.
- `TransitionQueueTicket`: serving a carry-over does not leave a stale
  Friday ticket `serving` once a Saturday ticket is served.
- `FindCashierPaymentCandidate`: a carried-over ticket is still a valid
  payment candidate; a candidate with no ticket is found separately.
- Cut-off/resume: outstanding count in the confirmation, a `serving`
  ticket returned to `waiting` without `requeued_at`, resume is implicit
  the next service day.
