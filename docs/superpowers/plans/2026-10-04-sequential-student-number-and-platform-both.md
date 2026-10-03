# Sequential Student Number, "Already Has a Student Number", and Platform "Both" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Registrar pick "Both" as a term's platform, make student numbers server-assigned and sequential (`YYYY-MM-NNNNN`, one running counter per year), remove the Generate button for good, and let Admission keep the number a Returnee or Existing Student already has.

**Architecture:** A new `student_number_sequences` table (one row per year) is locked and incremented by a new `AssignStudentNumber` action inside the provisioning transaction. `POST /student-profiles` gains `has_existing_student_number`; the browser no longer makes numbers. "Both" is a third `EnrollmentPlatform` enum case on a plain string column, so no migration is needed for it.

**Tech Stack:** Laravel (PHP, PHPUnit, Pint), MariaDB locally and MySQL on Hostinger, Next.js client-rendered React, strict TypeScript, React Hook Form + Zod 4, TanStack Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-04-sequential-student-number-and-platform-both-design.md` (owner approved 2026-10-04). Two refinements made while planning, applied to the spec in Task 6: (1) the counter row for a year is created lazily from the highest existing number instead of being seeded by the migration, so a restored older dump cannot make it collide; (2) when skipping a taken number, the check is on the suffix across **all months of that year**, not only the current month.

## Global Constraints

- Student number format is exactly `YYYY-MM-NNNNN`, validated by `^\d{4}-(0[1-9]|1[0-2])-\d{5}$`. The 5-digit suffix never exceeds `99999`.
- The year and month come from `Asia/Manila` (the app timezone is `UTC`); never from the browser and never from UTC.
- One counter per year; it continues across months and restarts at `00001` each January.
- Existing students (6,379 numbers) are **not** renumbered. `StudentIdentityGenerator` (demo seed) and the locked Student number in the edit dialog are untouched.
- The existing-number option is allowed only for `returnee` and `existing_student`; `freshman` and `transferee` always get an assigned number.
- Platform value `both`, label `Both (Face-to-Face and Online)`. No migration for it.
- Work on `main`. `system-for-defense` stays frozen. **Do not commit or push** unless the owner asks for a GitHub saving point (AGENTS.md); where the generic plan template says "commit", this plan says "checkpoint" and runs the checks only.
- AGENTS.md rules apply: Form Requests, Actions, DB transactions, reversible migrations, API Resources; strict TypeScript, React Hook Form, Zod, API calls only in service modules; bearer-token auth only; update `PROGRESS.md` at session start, after each task, and before ending; never record a check as passed unless it ran.
- Do not run anything against the shared dev MariaDB on `:3306` or against production. Backend tests run on a private MariaDB on `:3310` with process environment variables (Task 0). The owner runs the new migration on local and Hostinger.
- Repo blobs are mostly CRLF: use the Edit tool for edits, not Python text-mode rewrites. Before editing a file, Read it.
- Commands below run from the repo root `C:\xampp\htdocs\GRC-ENROLLMENT` in Git Bash unless a `cd` is shown.

## Review Focus

These are the inputs most likely to bite a person that no ordinary happy-path test would catch; each has a named test below.

1. **Month boundary in UTC vs Manila:** 17:30 UTC on 31 Aug is already 1 Sep in Manila; the number must say `-09-`. (Task 3, `test_the_month_follows_the_manila_calendar_not_utc`.)
2. **Year rollover:** the last number of 31 Dec and the first of 1 Jan must be different years' counters, the new year starting at `00001`. (Task 3.)
3. **A manually entered number in another month of the same year:** `2027-05-00002` exists, the counter reaches 2 in August; the suffix must be skipped so no two students share a suffix in a year. (Task 3.)
4. **An old frontend still sends its own random `student_number`:** it must get a clean 422 naming `student_number`, not a silently ignored or duplicated number. (Task 4.)
5. **Admission ticks "already has a number", types one, then switches the type to Freshman:** the stale number must be cleared and never sent. (Task 5.)

Also covered: counter rolls back with a failed create (Task 4), 99999 exhaustion (Task 3), and a restored dump with no counter row continuing from the highest existing number (Task 3).

---

## Task 0: Preflight (read, private test database, baseline)

**Files:** none changed except `PROGRESS.md`.

- [ ] **Step 1: Read what AGENTS.md requires**

Read `PRD.md` in full. Read `PROGRESS.md` in chunks (`Read` with `offset`/`limit`, about 500 lines each; it is about 3,900 lines). If context gets tight, read at least the first 400 lines in full plus `Grep` for `student number`, `platform`, `Doc 17`, `Doc 20`, `ADR 0041`, `Sanctum` (multi-user test quirk), and write in `PROGRESS.md` exactly what was and was not read.

- [ ] **Step 2: Add a start-of-task note to PROGRESS.md**

Under the existing `## 2026-10-04 — Sequential student numbers…` entry, change the status line from "SPEC WRITTEN; awaiting owner review" to "PLAN WRITTEN; implementing" and add a bullet "Implementation started: <what was read>". Use the Edit tool.

- [ ] **Step 3: Start a private MariaDB on :3310 (never touch :3306)**

Use the session scratchpad directory as `<SCRATCH>` (it is shown in the environment block). In Git Bash:

```bash
SCRATCH="<paste the scratchpad path>"
mkdir -p "$SCRATCH/mariadb-test"
"/c/xampp/mysql/bin/mysql_install_db.exe" --datadir="$(cygpath -w "$SCRATCH/mariadb-test/data")" --port=3310
```

Expected: ends with a success message and no `ERROR`. Then start the server in the background (use the Bash tool's `run_in_background`):

```bash
"/c/xampp/mysql/bin/mysqld.exe" --datadir="$(cygpath -w "$SCRATCH/mariadb-test/data")" --port=3310 --bind-address=127.0.0.1 --console
```

Then confirm it answers and create the test schema:

```bash
/c/xampp/mysql/bin/mysqladmin.exe -h127.0.0.1 -P3310 -uroot ping
/c/xampp/mysql/bin/mysql.exe -h127.0.0.1 -P3310 -uroot -e "CREATE DATABASE IF NOT EXISTS grc_enrollment_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
```

Expected: `mysqld is alive`. If install or start fails, follow `docs/runbooks/mariadb-local.md` and `mariadb-instability-incident` memory; do not "fix" the shared instance.

- [ ] **Step 4: Baseline run (must be green before changing anything)**

```bash
cd backend && DB_HOST=127.0.0.1 DB_PORT=3310 DB_USERNAME=root DB_PASSWORD= DB_DATABASE=grc_enrollment_test php artisan test --filter=StudentProfilesEndpointTest
```

Expected: all tests PASS. If the connection fails, check `.env.testing` keys (names only; never print values) and that the environment variables above are being passed; process env vars override `.env.testing`.

Define this shell prefix once and reuse it as `$T` below:

```bash
T="DB_HOST=127.0.0.1 DB_PORT=3310 DB_USERNAME=root DB_PASSWORD= DB_DATABASE=grc_enrollment_test"
```

(Each Bash call is a new shell, so retype the variables inline each time, e.g. `cd backend && DB_HOST=127.0.0.1 DB_PORT=3310 DB_USERNAME=root DB_PASSWORD= DB_DATABASE=grc_enrollment_test php artisan test --filter=...`.)

---

## Task 1: Platform "Both" — backend

**Files:**
- Modify: `backend/app/Domain/Enrollment/EnrollmentPlatform.php`
- Test: `backend/tests/Feature/Api/V1/EnrollmentScheduleEndpointTest.php` (add after line 508)
- Test: `backend/tests/Feature/Api/V1/EnrollmentDocumentsEndpointTest.php` (add after line 647)

**Interfaces:**
- Produces: `EnrollmentPlatform::Both` (value `'both'`, label `'Both (Face-to-Face and Online)'`). Task 2 relies on the value `"both"` coming back from `GET /academic-terms` as `enrollment_platform`.

- [ ] **Step 1: Write the failing tests**

In `EnrollmentScheduleEndpointTest.php`, add after `test_the_platform_is_audited_and_reaches_the_term_resource`:

```php
    public function test_registrar_head_can_set_the_platform_to_both(): void
    {
        $term = AcademicTerm::create(['school_year' => '2028-2029', 'semester' => '1st', 'status' => AcademicTermStatus::Draft]);
        $token = $this->tokenFor(UserRole::RegistrarHead, 'registrar-head.platform.both@grc.test');

        $this->withToken($token)->patchJson(
            "/api/v1/academic-terms/{$term->id}/enrollment-schedule",
            $this->platformSchedulePayload(['enrollment_platform' => 'both']),
        )->assertOk();

        self::assertSame('both', $term->refresh()->enrollment_platform?->value);

        $row = collect($this->withToken($token)->getJson('/api/v1/academic-terms')->assertOk()->json('data'))
            ->firstWhere('id', $term->id);
        self::assertSame('both', $row['enrollment_platform']);
        self::assertSame('Both (Face-to-Face and Online)', $row['enrollment_platform_label']);
    }
```

In `EnrollmentDocumentsEndpointTest.php`, first confirm the student number is free: `grep -n "2026-0304" backend/tests/Feature/Api/V1/EnrollmentDocumentsEndpointTest.php` (expected: no output; if it is used, pick the next free `2026-03NN`). Then add after `test_a_cor_prints_the_platform_the_registrar_set_for_the_term`:

```php
    public function test_a_cor_prints_both_when_the_registrar_set_both_platforms(): void
    {
        $term = $this->makeTerm();
        $term->update(['enrollment_platform' => 'both']);
        $curriculum = $this->makeCurriculum();
        $student = $this->makeStudent($curriculum, 'student.bothplatform@grc.test', '2026-0304');
        $document = $this->makeDocument($student, $term);

        $snapshot = $this->withToken($this->tokenFor($student->user))
            ->getJson("/api/v1/enrollment-documents/{$document->id}")
            ->assertOk()
            ->json('data.snapshot');

        $this->assertSame('Both (Face-to-Face and Online)', $snapshot['student']['platform']);
    }
```

- [ ] **Step 2: Run them to verify they fail**

```bash
cd backend && DB_HOST=127.0.0.1 DB_PORT=3310 DB_USERNAME=root DB_PASSWORD= DB_DATABASE=grc_enrollment_test php artisan test --filter="test_registrar_head_can_set_the_platform_to_both|test_a_cor_prints_both_when_the_registrar_set_both_platforms"
```

Expected: both FAIL (the first with a 422 where 200 is expected; the second because `both` cannot be cast to the enum).

- [ ] **Step 3: Add the enum case**

Replace the whole body of `backend/app/Domain/Enrollment/EnrollmentPlatform.php` after the namespace with:

```php
/**
 * How classes are delivered for a term's enrollees, as printed on the
 * Certificate of Registration (stakeholder Doc 14). Students have no platform
 * of their own, so the Registrar Head sets one value for the whole enrolling
 * population of a term (`academic_terms.enrollment_platform`); it is not the
 * per-section `SectionModality` (HyFlex / F2F). `Both` is for a term where
 * classes meet face-to-face and online.
 */
enum EnrollmentPlatform: string
{
    case Online = 'online';
    case FaceToFace = 'face_to_face';
    case Both = 'both';

    public function label(): string
    {
        return match ($this) {
            self::Online => 'Online',
            self::FaceToFace => 'Face-to-Face',
            self::Both => 'Both (Face-to-Face and Online)',
        };
    }
}
```

- [ ] **Step 4: Run to verify they pass, plus the neighbours**

```bash
cd backend && DB_HOST=127.0.0.1 DB_PORT=3310 DB_USERNAME=root DB_PASSWORD= DB_DATABASE=grc_enrollment_test php artisan test --filter="EnrollmentScheduleEndpointTest|EnrollmentDocumentsEndpointTest|AcademicTermsEndpointTest"
```

Expected: all PASS. `test_an_unknown_platform_is_rejected` still passes because `hybrid` is not a case.

- [ ] **Step 5: Checkpoint (no commit)**

```bash
cd backend && vendor/bin/pint --test app/Domain/Enrollment/EnrollmentPlatform.php tests/Feature/Api/V1/EnrollmentScheduleEndpointTest.php tests/Feature/Api/V1/EnrollmentDocumentsEndpointTest.php
```

Expected: `PASS`. Add a one-line "Task 1 done" bullet to the PROGRESS.md entry.

---

## Task 2: Platform "Both" — frontend

**Files:**
- Modify: `frontend/src/features/schemas/reference-data-schema.ts:33-36`
- Modify: `frontend/src/features/schemas/enrollment-window-schema.ts:111-114`
- Modify: `frontend/src/features/components/portal/enrollment-schedule-card.tsx:69` and `:585`
- Test: `frontend/src/features/components/portal/enrollment-schedule-card.test.tsx` (add after line 235)

**Interfaces:**
- Consumes: the value `"both"` from Task 1.
- Produces: the Registrar `<select id="schedule-enrollment_platform">` offers `both`.

- [ ] **Step 1: Write the failing test**

Add after the test `shows the term's current platform and saves the one the Registrar picks`:

```tsx
  it("lets the Registrar pick Both Face-to-Face and Online", async () => {
    const user = userEvent.setup()
    let savedBody: Record<string, unknown> | null = null
    fetchMock.mockImplementation((input, init) => {
      if (url(input).includes("/schedule-proposals"))
        return Promise.resolve(new Response(JSON.stringify({ data: [] })))
      if (
        init?.method === "PATCH" &&
        url(input).includes("enrollment-schedule")
      ) {
        savedBody =
          typeof init.body === "string"
            ? (JSON.parse(init.body) as Record<string, unknown>)
            : null
        return Promise.resolve(new Response(JSON.stringify(scheduleFixture())))
      }
      return Promise.resolve(new Response(JSON.stringify(scheduleFixture())))
    })

    renderWithSession(
      <EnrollmentScheduleCard
        currentTerm={{
          ...draftTerm,
          enrollment_platform: "online",
          enrollment_platform_label: "Online",
        }}
      />,
      { session: registrarSession() },
    )

    const platform = await screen.findByLabelText("Platform for this term")
    await waitFor(() => expect(platform).toHaveValue("online"))
    expect(
      screen.getByRole("option", { name: "Both (Face-to-Face and Online)" }),
    ).toBeInTheDocument()

    await user.selectOptions(platform, "both")
    await user.click(
      screen.getByRole("button", { name: "Save enrollment schedule" }),
    )

    await waitFor(() => expect(savedBody?.enrollment_platform).toBe("both"))
  })
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd frontend && npx vitest run src/features/components/portal/enrollment-schedule-card.test.tsx -t "Both Face-to-Face and Online"
```

Expected: FAIL (no option named "Both (Face-to-Face and Online)").

- [ ] **Step 3: Implement**

`reference-data-schema.ts` (lines 33-36) and `enrollment-window-schema.ts` (lines 111-114): change `.enum(["online", "face_to_face"])` to `.enum(["online", "face_to_face", "both"])` in both.

`enrollment-schedule-card.tsx` line 69:

```ts
  enrollment_platform: "" | "online" | "face_to_face" | "both"
```

and after the `<option value="face_to_face">Face-to-Face</option>` line (585) add:

```tsx
                      <option value="both">Both (Face-to-Face and Online)</option>
```

- [ ] **Step 4: Run to verify it passes, then type-check**

```bash
cd frontend && npx vitest run src/features/components/portal/enrollment-schedule-card.test.tsx src/features/schemas
cd frontend && npx tsc --noEmit
```

Expected: tests PASS, `tsc` prints nothing. If `tsc` reports an exhaustive-union error elsewhere for the platform type, add `"both"` there too (earlier search found no other uses).

- [ ] **Step 5: Checkpoint (no commit)**

```bash
cd frontend && npx eslint src/features/components/portal/enrollment-schedule-card.tsx src/features/components/portal/enrollment-schedule-card.test.tsx src/features/schemas --max-warnings=0
cd frontend && npx prettier --check src/features/components/portal/enrollment-schedule-card.tsx src/features/components/portal/enrollment-schedule-card.test.tsx src/features/schemas/reference-data-schema.ts src/features/schemas/enrollment-window-schema.ts
```

Expected: clean. Add "Task 2 done" to PROGRESS.md.

---

## Task 3: Student number sequence table and `AssignStudentNumber`

**Files:**
- Create: `backend/database/migrations/2026_10_04_000001_create_student_number_sequences_table.php`
- Create: `backend/app/Actions/Identity/AssignStudentNumber.php`
- Test: `backend/tests/Feature/Actions/Identity/AssignStudentNumberTest.php`
- Test: `backend/tests/Feature/Database/CreateStudentNumberSequencesTableTest.php`

**Interfaces:**
- Produces: `App\Actions\Identity\AssignStudentNumber::handle(): string` — returns the next `YYYY-MM-NNNNN`, runs its own `DB::transaction` (so it is safe on its own and joins the caller's transaction as a savepoint), throws `Illuminate\Validation\ValidationException` keyed `student_number` when a year's 99999 numbers are used.
- Produces: table `student_number_sequences(year smallint unsigned PK, last_value int unsigned default 0, created_at, updated_at)`.

- [ ] **Step 1: Write the failing action tests**

Create `backend/tests/Feature/Actions/Identity/AssignStudentNumberTest.php`:

```php
<?php

namespace Tests\Feature\Actions\Identity;

use App\Actions\Identity\AssignStudentNumber;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\ProgramStatus;
use App\Models\Curriculum;
use App\Models\Program;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Tests\TestCase;

final class AssignStudentNumberTest extends TestCase
{
    use RefreshDatabase;

    private function manila(string $dateTime): void
    {
        $this->travelTo(Carbon::parse($dateTime, 'Asia/Manila'));
    }

    private function profileWithNumber(string $studentNumber): StudentProfile
    {
        $program = Program::query()->first()
            ?? Program::create(['code' => 'BSCS', 'name' => 'BS Computer Science', 'status' => ProgramStatus::Active]);
        $curriculum = Curriculum::query()->first()
            ?? Curriculum::create([
                'program_id' => $program->id, 'name' => 'BSCS Curriculum',
                'effective_school_year' => '2026-2027', 'effective_start_year' => 2026,
                'effective_end_year' => 2030, 'status' => CurriculumStatus::Active,
            ]);
        $user = User::create([
            'name' => 'Seed '.$studentNumber,
            'email' => "seed.{$studentNumber}@grc.test",
            'password' => 'irrelevant-password',
            'role' => UserRole::Student,
            'status' => UserStatus::Active,
        ]);

        return StudentProfile::create([
            'user_id' => $user->id, 'student_number' => $studentNumber,
            'program_id' => $program->id, 'curriculum_id' => $curriculum->id, 'year_level' => 1,
            'admission_status' => 'admitted', 'academic_standing' => 'good',
        ]);
    }

    public function test_the_first_number_of_a_year_is_00001_and_each_call_adds_one(): void
    {
        $this->manila('2027-08-15 10:00:00');
        $action = app(AssignStudentNumber::class);

        self::assertSame('2027-08-00001', $action->handle());
        self::assertSame('2027-08-00002', $action->handle());
        $this->assertDatabaseHas('student_number_sequences', ['year' => 2027, 'last_value' => 2]);
    }

    public function test_a_year_with_no_counter_row_continues_after_the_highest_existing_number(): void
    {
        // A restored dump: students exist but the counter table has no row for the year.
        $this->profileWithNumber('2027-06-01001');
        $this->profileWithNumber('2027-06-01930');
        $this->profileWithNumber('HIST-2027-99999');
        $this->profileWithNumber('TEST-REG-Y1-01');
        $this->profileWithNumber('2026-06-05000');
        $this->manila('2027-08-15 10:00:00');

        self::assertSame('2027-08-01931', app(AssignStudentNumber::class)->handle());
    }

    public function test_the_counter_continues_when_the_month_changes(): void
    {
        $action = app(AssignStudentNumber::class);

        $this->manila('2027-08-15 10:00:00');
        self::assertSame('2027-08-00001', $action->handle());

        $this->manila('2027-09-02 09:00:00');
        self::assertSame('2027-09-00002', $action->handle());
    }

    public function test_a_new_year_restarts_at_00001(): void
    {
        $action = app(AssignStudentNumber::class);

        $this->manila('2027-12-31 23:30:00');
        self::assertSame('2027-12-00001', $action->handle());
        self::assertSame('2027-12-00002', $action->handle());

        $this->manila('2028-01-01 00:30:00');
        self::assertSame('2028-01-00001', $action->handle());
    }

    public function test_the_month_follows_the_manila_calendar_not_utc(): void
    {
        // 17:30 UTC on 31 Aug is 01:30 on 1 Sep in Manila.
        $this->travelTo(Carbon::parse('2027-08-31 17:30:00', 'UTC'));

        self::assertSame('2027-09-00001', app(AssignStudentNumber::class)->handle());
    }

    public function test_a_suffix_already_used_in_another_month_of_the_year_is_skipped(): void
    {
        DB::table('student_number_sequences')->insert([
            'year' => 2027, 'last_value' => 0, 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->profileWithNumber('2027-05-00002');
        $this->manila('2027-08-15 10:00:00');
        $action = app(AssignStudentNumber::class);

        self::assertSame('2027-08-00001', $action->handle());
        self::assertSame('2027-08-00003', $action->handle());
        $this->assertDatabaseHas('student_number_sequences', ['year' => 2027, 'last_value' => 3]);
    }

    public function test_a_year_with_every_number_used_fails_cleanly_and_leaves_the_counter_alone(): void
    {
        DB::table('student_number_sequences')->insert([
            'year' => 2027, 'last_value' => 99999, 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->manila('2027-08-15 10:00:00');

        try {
            app(AssignStudentNumber::class)->handle();
            self::fail('A year with all 99999 numbers used must not hand out a sixth digit.');
        } catch (ValidationException $exception) {
            self::assertArrayHasKey('student_number', $exception->errors());
        }

        $this->assertDatabaseHas('student_number_sequences', ['year' => 2027, 'last_value' => 99999]);
    }

    public function test_a_failed_outer_transaction_gives_the_number_back(): void
    {
        $this->manila('2027-08-15 10:00:00');
        $action = app(AssignStudentNumber::class);

        try {
            DB::transaction(function () use ($action): void {
                $action->handle();
                throw new RuntimeException('Provisioning failed after the number was taken.');
            });
        } catch (RuntimeException) {
            // expected
        }

        $this->assertDatabaseCount('student_number_sequences', 0);
        self::assertSame('2027-08-00001', $action->handle());
    }
}
```

Create `backend/tests/Feature/Database/CreateStudentNumberSequencesTableTest.php`:

```php
<?php

namespace Tests\Feature\Database;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\Support\RollsBackThroughMigration;
use Tests\TestCase;

final class CreateStudentNumberSequencesTableTest extends TestCase
{
    use RefreshDatabase;
    use RollsBackThroughMigration;

    public function test_it_creates_and_removes_the_student_number_sequences_table(): void
    {
        $this->assertTrue(Schema::hasTable('student_number_sequences'));
        $this->assertTrue(Schema::hasColumns('student_number_sequences', ['year', 'last_value', 'created_at', 'updated_at']));

        $this->rollbackThrough('2026_10_04_000001_create_student_number_sequences_table');

        $this->assertFalse(Schema::hasTable('student_number_sequences'));
    }
}
```

- [ ] **Step 2: Run them to verify they fail**

```bash
cd backend && DB_HOST=127.0.0.1 DB_PORT=3310 DB_USERNAME=root DB_PASSWORD= DB_DATABASE=grc_enrollment_test php artisan test --filter="AssignStudentNumberTest|CreateStudentNumberSequencesTableTest"
```

Expected: FAIL (class `AssignStudentNumber` not found; table missing).

- [ ] **Step 3: Create the migration**

`backend/database/migrations/2026_10_04_000001_create_student_number_sequences_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The running counter behind sequential student numbers (`YYYY-MM-NNNNN`,
 * ADR 0042): one row per calendar year holding the last suffix handed out. The
 * row for a year is created on first use from the highest number already in
 * `student_profiles`, so it never needs seeding and a restored older dump
 * cannot make it hand out a number that is already taken.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_number_sequences', function (Blueprint $table) {
            $table->unsignedSmallInteger('year')->primary();
            $table->unsignedInteger('last_value')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_number_sequences');
    }
};
```

- [ ] **Step 4: Create the action**

`backend/app/Actions/Identity/AssignStudentNumber.php`:

```php
<?php

namespace App\Actions\Identity;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Hands out the next student number, `YYYY-MM-NNNNN` (ADR 0042): the year and
 * month in the school's calendar (Asia/Manila, not the app's UTC), then a
 * running 5-digit number from one counter per year. The counter continues
 * across months and restarts at 00001 each January.
 *
 * The year's counter row is locked for the rest of the transaction, so two
 * Admission staff creating accounts at the same moment get different numbers.
 * A suffix already used by any student that year (for example a number entered
 * by hand for a Returnee) is skipped, so no two students share a suffix in a
 * year. Calling this inside a failed outer transaction gives the number back.
 */
final class AssignStudentNumber
{
    private const TIMEZONE = 'Asia/Manila';

    private const MAX_SUFFIX = 99999;

    public function handle(): string
    {
        return DB::transaction(function (): string {
            $now = now(self::TIMEZONE);
            $year = $now->year;

            $this->ensureCounterRow($year);

            $next = (int) DB::table('student_number_sequences')
                ->where('year', $year)
                ->lockForUpdate()
                ->value('last_value');

            do {
                $next++;

                if ($next > self::MAX_SUFFIX) {
                    throw ValidationException::withMessages([
                        'student_number' => "All student numbers for {$year} are already in use.",
                    ]);
                }
            } while ($this->suffixIsUsed($year, $next));

            DB::table('student_number_sequences')
                ->where('year', $year)
                ->update(['last_value' => $next, 'updated_at' => now()]);

            return sprintf('%04d-%02d-%05d', $year, $now->month, $next);
        });
    }

    private function ensureCounterRow(int $year): void
    {
        if (DB::table('student_number_sequences')->where('year', $year)->exists()) {
            return;
        }

        // `insertOrIgnore`: two first-of-the-year requests may both get here; the
        // loser's insert is ignored and both then wait on the same locked row.
        DB::table('student_number_sequences')->insertOrIgnore([
            'year' => $year,
            'last_value' => $this->highestSuffixInUse($year),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /** Highest `NNNNN` among `YYYY-MM-NNNNN` numbers of the year; `HIST-` and `TEST-` numbers never match. */
    private function highestSuffixInUse(int $year): int
    {
        return (int) DB::table('student_profiles')
            ->where('student_number', 'like', sprintf('%04d-__-_____', $year))
            ->whereRaw('CHAR_LENGTH(student_number) = 13')
            ->max(DB::raw('CAST(SUBSTRING(student_number, 9) AS UNSIGNED)'));
    }

    private function suffixIsUsed(int $year, int $suffix): bool
    {
        return DB::table('student_profiles')
            ->where('student_number', 'like', sprintf('%04d-__-%05d', $year, $suffix))
            ->exists();
    }
}
```

- [ ] **Step 5: Run to verify they pass**

```bash
cd backend && DB_HOST=127.0.0.1 DB_PORT=3310 DB_USERNAME=root DB_PASSWORD= DB_DATABASE=grc_enrollment_test php artisan test --filter="AssignStudentNumberTest|CreateStudentNumberSequencesTableTest"
```

Expected: 9 tests PASS. If `travelTo` does not affect `now('Asia/Manila')`, confirm `Carbon::setTestNow` is active (Laravel's `travelTo` sets it) and that the action uses the `now()` helper rather than `CarbonImmutable::now()`.

- [ ] **Step 6: Checkpoint (no commit)**

```bash
cd backend && vendor/bin/pint --test app/Actions/Identity/AssignStudentNumber.php database/migrations/2026_10_04_000001_create_student_number_sequences_table.php tests/Feature/Actions/Identity/AssignStudentNumberTest.php tests/Feature/Database/CreateStudentNumberSequencesTableTest.php
```

Expected: `PASS`. Add "Task 3 done" to PROGRESS.md, including that the migration is not yet applied to the dev or Hostinger databases.

---

## Task 4: Provisioning uses the sequence; existing-number mode; update the old tests

**Files:**
- Modify: `backend/app/Domain/Identity/StudentType.php`
- Modify: `backend/app/Http/Requests/Api/V1/StudentProfile/StoreStudentProfileRequest.php`
- Modify: `backend/app/Http/Controllers/Api/V1/StudentProfileController.php:46-62`
- Modify: `backend/app/Actions/Identity/ProvisionStudent.php`
- Test: `backend/tests/Feature/Api/V1/StudentProfilesEndpointTest.php`
- Test: `backend/tests/Feature/Actions/Identity/ProvisionStudentAuditTest.php`

**Interfaces:**
- Consumes: `AssignStudentNumber::handle(): string` (Task 3).
- Produces: `StudentType::canHaveExistingStudentNumber(): bool`; request field `has_existing_student_number` (boolean, default false); audit `after_values.student_number_source` (`'assigned'` | `'existing'`). Task 5's frontend sends exactly `has_existing_student_number` and, only when true, `student_number`.

- [ ] **Step 1: Update the old tests to the new contract (they will fail first)**

In `StudentProfilesEndpointTest.php`:

1. Add `use Illuminate\Support\Carbon;` to the imports.
2. **Remove** the `'student_number' => '…',` line from the request body in each of these tests, and the identical line in `provisionPayload()` (line 163): `test_admission_staff_can_provision_a_student`, `provisionPayload`, `test_provisioning_normalizes_name_casing_regardless_of_how_admission_typed_it`, `test_provisioning_requires_verified_requirements_and_an_address`, `test_provisioning_rejects_client_overrides_of_server_controlled_fields`, `test_student_activates_the_pending_account_with_the_emailed_one_time_code`, `test_an_expired_or_invalid_setup_code_cannot_activate_the_account`, `test_mail_failure_keeps_one_pending_account_and_exposes_a_resendable_delivery_state`, `test_financial_status_is_accepted_and_defaults_to_null` (two bodies), `test_enrollment_category_and_student_type_are_what_admission_chose`, `test_a_non_admission_staff_role_cannot_provision_a_student`, `test_provisioning_fails_cleanly_when_no_curriculum_covers_the_entry_year`, `test_provisioning_resolves_the_curriculum_from_the_current_terms_entry_year`, `test_provisioning_fails_cleanly_when_no_academic_term_is_ongoing`, `test_duplicate_email_is_rejected`. Leave the `StudentProfile::create([... 'student_number' => 'STU-…'])` rows in the read-your-own-profile tests alone.
3. In `test_admission_staff_can_provision_a_student`, pin the clock **before** creating the token and assert the assigned number:

```php
        $this->travelTo(Carbon::parse('2027-08-15 10:00:00', 'Asia/Manila'));
        [$program, $curriculum] = $this->makeProgramAndCurriculum();
```

   and replace `$response->assertJsonPath('data.student_number', '2027-08-10001');` with `$response->assertJsonPath('data.student_number', '2027-08-00001');` and the `assertDatabaseHas('student_profiles', ['student_number' => '2027-08-10001', …])` value with `'2027-08-00001'`.
4. Replace `test_student_number_must_match_the_yyyy_mm_nnnnn_format` with:

```php
    public function test_an_existing_student_number_must_match_the_yyyy_mm_nnnnn_format(): void
    {
        [$program] = $this->makeProgramAndCurriculum();
        $this->setCurrentTerm('2027-2028');
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.badformat@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            ...$this->provisionPayload($program, 'badformat.student@grc.test', [], 1, 'returnee'),
            'has_existing_student_number' => true,
            'student_number' => 'STU-2027-0001',
        ]);

        $response->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
        self::assertArrayHasKey('student_number', $response->json('error.errors'));
        $this->assertDatabaseMissing('users', ['email' => 'badformat.student@grc.test']);
    }
```

In `ProvisionStudentAuditTest.php`:

1. Add `use Illuminate\Support\Carbon;`.
2. `test_provisioning_records_only_the_exact_safe_student_profile_audit`: add `$this->travelTo(Carbon::parse('2027-08-15 10:00:00', 'Asia/Manila'));` as the first line; remove `'student_number' => '2027-08-30001',` from the body; add `'student_number_source' => 'assigned',` as the last entry of the expected `after_values` array (after `'financial_status' => null,`); replace `self::assertStringNotContainsString('2027-08-30001', $serializedAudit);` with:

```php
        self::assertSame('2027-08-00001', $response->json('data.student_number'));
        self::assertStringNotContainsString('2027-08-00001', $serializedAudit);
```

3. `test_audit_failure_rolls_back_both_user_and_student_profile`: remove `'student_number' => '2027-08-30002',` from the body and replace `$this->assertDatabaseMissing('student_profiles', ['student_number' => '2027-08-30002']);` with:

```php
        $this->assertDatabaseCount('student_profiles', 0);
        // The number taken inside the failed transaction is given back.
        $this->assertDatabaseCount('student_number_sequences', 0);
```

- [ ] **Step 2: Add the new endpoint tests (append to `StudentProfilesEndpointTest.php`, before `test_a_non_admission_staff_role_cannot_provision_a_student`)**

```php
    public function test_the_server_assigns_the_next_student_number_in_the_manila_year_and_month(): void
    {
        $this->travelTo(Carbon::parse('2027-08-15 10:00:00', 'Asia/Manila'));
        [$program] = $this->makeProgramAndCurriculum();
        $this->setCurrentTerm('2027-2028');
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.sequence@grc.test');
        Mail::fake();

        $first = $this->withToken($token)->postJson(
            '/api/v1/student-profiles',
            $this->provisionPayload($program, 'sequence.one@grc.test', []),
        );
        $second = $this->withToken($token)->postJson(
            '/api/v1/student-profiles',
            $this->provisionPayload($program, 'sequence.two@grc.test', []),
        );

        $first->assertCreated()->assertJsonPath('data.student_number', '2027-08-00001');
        $second->assertCreated()->assertJsonPath('data.student_number', '2027-08-00002');
        $this->assertDatabaseHas('student_number_sequences', ['year' => 2027, 'last_value' => 2]);
    }

    public function test_a_student_number_sent_without_the_existing_number_option_is_refused(): void
    {
        [$program] = $this->makeProgramAndCurriculum();
        $this->setCurrentTerm('2027-2028');
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.oldclient@grc.test');

        // An older frontend still sends the random number it made itself.
        $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            ...$this->provisionPayload($program, 'oldclient.student@grc.test', []),
            'student_number' => '2027-08-12345',
        ]);

        $response->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
        self::assertArrayHasKey('student_number', $response->json('error.errors'));
        $this->assertDatabaseMissing('users', ['email' => 'oldclient.student@grc.test']);
        $this->assertDatabaseCount('student_number_sequences', 0);
    }

    public function test_a_returnee_or_an_existing_student_can_keep_the_number_they_already_have(): void
    {
        $this->travelTo(Carbon::parse('2027-08-15 10:00:00', 'Asia/Manila'));
        [$program] = $this->makeProgramAndCurriculum();
        $this->setCurrentTerm('2027-2028');
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.existingnumber@grc.test');
        Mail::fake();

        foreach ([['returnee', '2026-06-00123'], ['existing_student', '2026-06-00124']] as $index => [$type, $number]) {
            $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
                ...$this->provisionPayload($program, "existing-number-{$index}@grc.test", [], 1, $type),
                'has_existing_student_number' => true,
                'student_number' => $number,
            ]);

            $response->assertCreated()->assertJsonPath('data.student_number', $number);
        }

        // The running counter was never asked for a number.
        $this->assertDatabaseCount('student_number_sequences', 0);
        $sources = AuditLog::query()
            ->where('action', AuditAction::STUDENT_PROFILE_PROVISIONED)
            ->get()
            ->map(fn (AuditLog $audit): mixed => $audit->after_values['student_number_source'])
            ->all();
        self::assertSame(['existing', 'existing'], $sources);
    }

    public function test_an_existing_student_number_is_refused_for_a_freshman_or_a_transferee(): void
    {
        [$program] = $this->makeProgramAndCurriculum();
        $this->setCurrentTerm('2027-2028');
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.existingrefused@grc.test');

        foreach (['freshman', 'transferee'] as $type) {
            $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
                ...$this->provisionPayload($program, "refused-{$type}@grc.test", [], 1, $type),
                'has_existing_student_number' => true,
                'student_number' => '2026-06-00200',
            ]);

            $response->assertUnprocessable()->assertJsonPath(
                'error.errors.has_existing_student_number.0',
                'Only a Returnee or an Existing Student can already have a student number.',
            );
            $this->assertDatabaseMissing('users', ['email' => "refused-{$type}@grc.test"]);
        }
    }

    public function test_an_existing_student_number_that_is_already_in_use_is_refused(): void
    {
        [$program, $curriculum] = $this->makeProgramAndCurriculum();
        $this->setCurrentTerm('2027-2028');
        $owner = User::create(['name' => 'Owner', 'email' => 'owner.number@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Student, 'status' => UserStatus::Active]);
        StudentProfile::create([
            'user_id' => $owner->id, 'student_number' => '2026-06-00300', 'program_id' => $program->id,
            'curriculum_id' => $curriculum->id, 'year_level' => 1,
            'admission_status' => 'admitted', 'academic_standing' => 'good',
        ]);
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.existingduplicate@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            ...$this->provisionPayload($program, 'duplicate.number@grc.test', [], 1, 'returnee'),
            'has_existing_student_number' => true,
            'student_number' => '2026-06-00300',
        ]);

        $response->assertUnprocessable()->assertJsonPath(
            'error.errors.student_number.0',
            'This student number is already in use.',
        );
        $this->assertDatabaseMissing('users', ['email' => 'duplicate.number@grc.test']);
    }

    public function test_the_existing_number_option_needs_the_number(): void
    {
        [$program] = $this->makeProgramAndCurriculum();
        $this->setCurrentTerm('2027-2028');
        $token = $this->tokenFor(UserRole::AdmissionStaff, 'admission.existingmissing@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/student-profiles', [
            ...$this->provisionPayload($program, 'missing.number@grc.test', [], 1, 'existing_student'),
            'has_existing_student_number' => true,
        ]);

        $response->assertUnprocessable();
        self::assertArrayHasKey('student_number', $response->json('error.errors'));
    }
```

- [ ] **Step 3: Run to verify the failures**

```bash
cd backend && DB_HOST=127.0.0.1 DB_PORT=3310 DB_USERNAME=root DB_PASSWORD= DB_DATABASE=grc_enrollment_test php artisan test --filter="StudentProfilesEndpointTest|ProvisionStudentAuditTest"
```

Expected: many FAIL (422 `student_number` required; unknown field handling) — that is the red state.

- [ ] **Step 4: `StudentType` helper**

In `backend/app/Domain/Identity/StudentType.php`, add after `label()`:

```php
    /**
     * Whether Admission may enter a student number the student already has
     * instead of getting a new one (ADR 0042). Only a Returnee and an Existing
     * Student have records at the school; a Freshman has no number yet and a
     * Transferee's number belongs to the school they came from.
     */
    public function canHaveExistingStudentNumber(): bool
    {
        return $this === self::Returnee || $this === self::ExistingStudent;
    }
```

- [ ] **Step 5: `StoreStudentProfileRequest`**

Replace the `student_number` rule block (the comment and rule at lines 44-48) with the flag and a conditional rule. In `rules()` start with `$hasExistingNumber = $this->boolean('has_existing_student_number');` and use:

```php
            // The server assigns the number (ADR 0042). Admission may instead enter the number a
            // Returnee or an Existing Student already has: then it is required, in the same
            // YYYY-MM-NNNNN format, and unique. Otherwise a client-sent number is refused rather
            // than quietly ignored, so an older frontend that still makes its own number is told.
            'has_existing_student_number' => ['sometimes', 'boolean'],
            'student_number' => $hasExistingNumber
                ? ['required', 'string', 'max:255', 'regex:/^\d{4}-(0[1-9]|1[0-2])-\d{5}$/', 'unique:student_profiles,student_number']
                : ['prohibited'],
```

Add a `messages()` method:

```php
    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'student_number.unique' => 'This student number is already in use.',
            'student_number.regex' => 'Student number must be in YYYY-MM-NNNNN format (e.g. 2026-08-07107).',
            'student_number.prohibited' => 'A student number is assigned automatically. Tick "Student already has a student number" to enter one.',
        ];
    }
```

In `withValidator()`, call a new private method at the top of the `after` closure, and add the method:

```php
        $validator->after(function (Validator $validator): void {
            $this->validateExistingNumberType($validator);
            // ... existing body unchanged ...
        });
```

```php
    private function validateExistingNumberType(Validator $validator): void
    {
        if (! $this->boolean('has_existing_student_number') || $validator->errors()->has('student_type')) {
            return;
        }

        $studentType = StudentType::tryFrom((string) $this->input('student_type'));

        if ($studentType !== null && ! $studentType->canHaveExistingStudentNumber()) {
            $validator->errors()->add(
                'has_existing_student_number',
                'Only a Returnee or an Existing Student can already have a student number.',
            );
        }
    }
```

- [ ] **Step 6: Controller**

In `StudentProfileController::store`, add the flag next to `student_number` (line 53):

```php
            'has_existing_student_number' => $request->boolean('has_existing_student_number'),
            'student_number' => $request->validated('student_number'),
```

- [ ] **Step 7: `ProvisionStudent`**

Add the import `use App\Actions\Identity\AssignStudentNumber;` is not needed (same namespace). Update the constructor and docblock, assign the number, and audit the source:

```php
    public function __construct(
        private readonly AuditRecorder $auditRecorder,
        private readonly ListApplicableAdmissionRequirements $applicableRequirements,
        private readonly AssignStudentNumber $assignStudentNumber,
    ) {}
```

Change the `@param` shape: replace `student_number: string,` with `has_existing_student_number?: bool, student_number?: ?string,`.

Immediately before `$profile = StudentProfile::create([` (after `$requirementsComplete`), add:

```php
            // Admission typed the number a Returnee or an Existing Student already has, or the
            // next sequential number is taken inside this transaction (ADR 0042).
            $hasExistingNumber = (bool) ($data['has_existing_student_number'] ?? false);
            $studentNumber = $hasExistingNumber
                ? (string) $data['student_number']
                : $this->assignStudentNumber->handle();
```

Change `'student_number' => $data['student_number'],` to `'student_number' => $studentNumber,`, and add as the last entry of the audit `after_values` array (after `'financial_status' => ...`):

```php
                    'student_number_source' => $hasExistingNumber ? 'existing' : 'assigned',
```

- [ ] **Step 8: Run to verify everything passes**

```bash
cd backend && DB_HOST=127.0.0.1 DB_PORT=3310 DB_USERNAME=root DB_PASSWORD= DB_DATABASE=grc_enrollment_test php artisan test --filter="StudentProfilesEndpointTest|ProvisionStudentAuditTest|AdmissionStudentRecordsEndpointTest|ApiSurfaceTest|AssignStudentNumberTest"
```

Expected: all PASS. If a test still posts `student_number` without the flag, it was missed in Step 1; remove the line. If the time-pinned tests fail at login, pin the clock **before** `tokenFor()` (user, OTP and token must all see the same frozen time).

- [ ] **Step 9: Checkpoint (no commit)**

```bash
cd backend && vendor/bin/pint --test app/Domain/Identity/StudentType.php app/Http app/Actions/Identity tests/Feature/Api/V1/StudentProfilesEndpointTest.php tests/Feature/Actions/Identity
```

Expected: `PASS`. Add "Task 4 done" to PROGRESS.md.

---

## Task 5: Admission portal form — no Generate, existing-number option

**Files:**
- Modify: `frontend/src/features/schemas/admission-schema.ts:39-68`
- Modify: `frontend/src/features/components/portal/student-records-workspace.tsx` (imports ~80-82, line 109, defaultValues ~121-133, after line 137, reset ~166-179, field block 273-299)
- Delete: `frontend/src/features/lib/student-number.ts`
- Test: `frontend/src/features/services/admission-service.test.ts`
- Test: `frontend/src/features/components/portal/admission-provisioning-workspace.test.tsx`

**Interfaces:**
- Consumes: the backend contract from Task 4 (`has_existing_student_number`, `student_number` only when true).
- Produces: exports from `admission-schema.ts`: `STUDENT_NUMBER_PATTERN`, `studentTypeCanHaveExistingNumber(studentType)`; `ProvisionStudentInput` now has `has_existing_student_number: boolean` and optional `student_number?: string`.

- [ ] **Step 1: Write the failing tests**

`admission-service.test.ts`: change the `input` fixture (lines 12-23) to drop the number and add the flag, and give the profile a fixed number:

```ts
const input: ProvisionStudentInput = {
  first_name: "Amina",
  middle_initial: "S",
  last_name: "Santos",
  email: "amina.santos@grc.test",
  address: "123 Mabini Street, Caloocan City",
  has_existing_student_number: false,
  program_id: 11,
  year_level: 1,
  enrollment_category: "regular",
  student_type: "transferee",
}
```

In the `profile` fixture replace `student_number: input.student_number,` with `student_number: "2027-08-00001",`. In the first test add `expect(body).not.toHaveProperty("student_number")`. Then add after the first test:

```ts
  it("sends the number the student already has when the existing-number option is ticked", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: profile }), { status: 201 }),
    )
    const existing: ProvisionStudentInput = {
      ...input,
      student_type: "returnee",
      has_existing_student_number: true,
      student_number: "2024-06-00123",
    }

    await provisionStudent(existing)
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body =
      typeof request.body === "string"
        ? (JSON.parse(request.body) as Record<string, unknown>)
        : {}

    expect(body).toEqual(existing)
  })

  it("refuses an existing student number for a Freshman or Transferee before calling the API", async () => {
    for (const studentType of ["freshman", "transferee"] as const) {
      await expect(
        provisionStudent({
          ...input,
          student_type: studentType,
          has_existing_student_number: true,
          student_number: "2024-06-00123",
        }),
      ).rejects.toThrow()
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("refuses a student number sent without the existing-number option", async () => {
    await expect(
      provisionStudent({ ...input, student_number: "2024-06-00123" }),
    ).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })
```

`admission-provisioning-workspace.test.tsx`:

1. Add two helpers after `renderWorkspace()`:

```tsx
async function fillAccountBasics(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("First name"), profile.first_name)
  await user.type(screen.getByLabelText("Last name"), profile.last_name)
  await user.type(screen.getByLabelText("Email address"), profile.email)
  await user.type(screen.getByLabelText("Complete address"), profile.address)
  await user.click(screen.getByLabelText("Program"))
  await user.click(
    await screen.findByRole("option", {
      name: "BSIT — Bachelor of Science in Information Technology",
    }),
  )
  await user.click(screen.getByLabelText("Enrollment category"))
  await user.click(await screen.findByRole("option", { name: "Regular" }))
}

async function chooseStudentType(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(screen.getByLabelText("Student type"))
  await user.click(await screen.findByRole("option", { name }))
}

function provisioningBody(): Record<string, unknown> {
  const call = fetchMock.mock.calls.find(
    ([input, init]) =>
      urlOf(input).endsWith("/api/v1/student-profiles") &&
      init?.method === "POST",
  )
  return bodyOf(call?.[1])
}
```

   `fetchMock` is declared inside the `describe`; move `provisioningBody` inside the `describe` (after `afterEach`) so it can see it.

2. In the first test (`uses one three-part workspace…`): after `expect(studentNumberField).toHaveAttribute("readonly")` add `expect(screen.queryByRole("button", { name: "Generate" })).not.toBeInTheDocument()` and `expect(studentNumberField).toHaveAttribute("placeholder", "Assigned automatically")`. In the final `toMatchObject` add `has_existing_student_number: false,` and after it add `expect(body).not.toHaveProperty("student_number")`. After the `Awaiting setup` assertion add `expect(screen.getByText(profile.student_number)).toBeInTheDocument()` (the success panel shows the number the server assigned).

3. Add these tests inside the `describe`, after `never offers a program that is switched off…`:

```tsx
  it("only lets a Returnee or an Existing Student say the student already has a student number", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    const checkbox = screen.getByRole("checkbox", {
      name: "Student already has a student number",
    })
    expect(checkbox).toBeDisabled()
    expect(
      screen.queryByRole("button", { name: "Generate" }),
    ).not.toBeInTheDocument()

    await chooseStudentType(user, "Freshman")
    expect(checkbox).toBeDisabled()
    await chooseStudentType(user, "Transferee")
    expect(checkbox).toBeDisabled()
    await chooseStudentType(user, "Returnee")
    expect(checkbox).toBeEnabled()
    await chooseStudentType(user, "Existing Student")
    expect(checkbox).toBeEnabled()
  })

  it("sends the number the student already has instead of a new one", async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await fillAccountBasics(user)
    await chooseStudentType(user, "Returnee")

    await user.click(
      screen.getByRole("checkbox", {
        name: "Student already has a student number",
      }),
    )
    const field = screen.getByLabelText("Existing student number")
    expect(field).not.toHaveAttribute("readonly")
    await user.type(field, "2024-06-00123")
    await user.click(
      screen.getByRole("button", { name: "Create account and email setup" }),
    )

    expect(await screen.findByText("Awaiting setup")).toBeInTheDocument()
    expect(provisioningBody()).toMatchObject({
      student_type: "returnee",
      has_existing_student_number: true,
      student_number: "2024-06-00123",
    })
  })

  it("stops an existing student number in the wrong format before calling the API", async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await fillAccountBasics(user)
    await chooseStudentType(user, "Existing Student")
    await user.click(
      screen.getByRole("checkbox", {
        name: "Student already has a student number",
      }),
    )
    await user.type(screen.getByLabelText("Existing student number"), "2024-6-123")
    await user.click(
      screen.getByRole("button", { name: "Create account and email setup" }),
    )

    expect(
      await screen.findByText(
        "Student number must be in YYYY-MM-NNNNN format (e.g. 2026-08-07107).",
      ),
    ).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          urlOf(input).endsWith("/api/v1/student-profiles") &&
          init?.method === "POST",
      ),
    ).toBe(false)
  })

  it("drops a typed existing number when the type changes to one that gets a new number", async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await fillAccountBasics(user)
    await chooseStudentType(user, "Returnee")
    const checkbox = screen.getByRole("checkbox", {
      name: "Student already has a student number",
    })
    await user.click(checkbox)
    await user.type(screen.getByLabelText("Existing student number"), "2024-06-00123")

    await chooseStudentType(user, "Freshman")

    await waitFor(() => expect(checkbox).not.toBeChecked())
    expect(checkbox).toBeDisabled()
    expect(screen.getByLabelText("Student number")).toHaveValue("")
    await user.click(
      screen.getByRole("button", { name: "Create account and email setup" }),
    )
    expect(await screen.findByText("Awaiting setup")).toBeInTheDocument()
    const body = provisioningBody()
    expect(body).toMatchObject({
      student_type: "freshman",
      has_existing_student_number: false,
    })
    expect(body).not.toHaveProperty("student_number")
  })

  it("shows the server's message on the field when the existing number is already in use", async () => {
    const user = userEvent.setup()
    const defaultImplementation = fetchMock.getMockImplementation()
    fetchMock.mockImplementation((input, init) => {
      if (
        urlOf(input).endsWith("/api/v1/student-profiles") &&
        init?.method === "POST"
      ) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "VALIDATION_FAILED",
                message: "The given data was invalid.",
                errors: {
                  student_number: ["This student number is already in use."],
                },
              },
            }),
            { status: 422 },
          ),
        )
      }
      return defaultImplementation!(input, init)
    })
    renderWorkspace()
    await fillAccountBasics(user)
    await chooseStudentType(user, "Returnee")
    await user.click(
      screen.getByRole("checkbox", {
        name: "Student already has a student number",
      }),
    )
    await user.type(screen.getByLabelText("Existing student number"), "2024-06-00123")
    await user.click(
      screen.getByRole("button", { name: "Create account and email setup" }),
    )

    expect(
      await screen.findByText("This student number is already in use."),
    ).toBeInTheDocument()
  })
```

   If the error envelope schema in `api-client.ts` also requires `request_id`, add `request_id: "test-request"` to the `error` object.

- [ ] **Step 2: Run them to verify they fail**

```bash
cd frontend && npx vitest run src/features/services/admission-service.test.ts src/features/components/portal/admission-provisioning-workspace.test.tsx
```

Expected: FAIL (schema has no `has_existing_student_number`; no such checkbox).

- [ ] **Step 3: Schema**

In `admission-schema.ts`, replace the `student_number` block (lines 44-50) with the flag and an optional number, and add the helpers above `provisionStudentSchema`:

```ts
/** `YYYY-MM-NNNNN`: the year and month the account was created in, then a 5-digit running number. */
export const STUDENT_NUMBER_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-\d{5}$/
const STUDENT_NUMBER_FORMAT_MESSAGE =
  "Student number must be in YYYY-MM-NNNNN format (e.g. 2026-08-07107)."
const EXISTING_NUMBER_TYPE_MESSAGE =
  "Only a Returnee or an Existing Student can already have a student number."

/**
 * Only these types can already hold a GRC student number (ADR 0042): a Freshman
 * has none yet and a Transferee's number belongs to the school they came from.
 */
export function studentTypeCanHaveExistingNumber(
  studentType: string | null | undefined,
): boolean {
  return studentType === "returnee" || studentType === "existing_student"
}
```

```ts
    // `false`: the server assigns the next number and none is sent. `true`: Admission types the
    // number a Returnee or an Existing Student already has.
    has_existing_student_number: z.boolean(),
    student_number: z.string().trim().optional(),
```

Replace the closing `.strict()` of `provisionStudentSchema` with:

```ts
  .strict()
  .superRefine((value, ctx) => {
    if (!value.has_existing_student_number) {
      if (value.student_number) {
        ctx.addIssue({
          code: "custom",
          path: ["student_number"],
          message: "A new student number is assigned automatically.",
        })
      }
      return
    }

    if (!studentTypeCanHaveExistingNumber(value.student_type)) {
      ctx.addIssue({
        code: "custom",
        path: ["has_existing_student_number"],
        message: EXISTING_NUMBER_TYPE_MESSAGE,
      })
    }

    if (!value.student_number) {
      ctx.addIssue({
        code: "custom",
        path: ["student_number"],
        message: "Enter the student's existing student number.",
      })
    } else if (!STUDENT_NUMBER_PATTERN.test(value.student_number)) {
      ctx.addIssue({
        code: "custom",
        path: ["student_number"],
        message: STUDENT_NUMBER_FORMAT_MESSAGE,
      })
    }
  })
```

- [ ] **Step 4: The form (`student-records-workspace.tsx`)**

Imports: delete `import { generateStudentNumber } from "@/features/lib/student-number"` (line 80) and add `studentTypeCanHaveExistingNumber` to the existing import list from `@/features/schemas/admission-schema` (next to `provisionStudentSchema`).

Delete line 109 (`const [initialStudentNumber] = useState(generateStudentNumber)`). Add `clearErrors` to the `useForm` destructuring. In `defaultValues` replace `student_number: initialStudentNumber,` with `has_existing_student_number: false,`.

After `const checkedIds = watch("requirement_type_ids")` add:

```tsx
  const hasExistingNumber = watch("has_existing_student_number")
  const canHaveExistingNumber = studentTypeCanHaveExistingNumber(studentType)

  // A Freshman or a Transferee gets a new number: drop the option, and any number typed for it,
  // as soon as the type changes to one of those.
  useEffect(() => {
    if (hasExistingNumber && !canHaveExistingNumber) {
      setValue("has_existing_student_number", false)
      setValue("student_number", undefined)
      clearErrors(["student_number", "has_existing_student_number"])
    }
  }, [canHaveExistingNumber, clearErrors, hasExistingNumber, setValue])
```

In `submit`'s `reset({...})` replace `student_number: generateStudentNumber(),` with:

```tsx
        has_existing_student_number: false,
        student_number: undefined,
```

Replace the whole student-number `<Field>` (lines 273-299) with:

```tsx
                <Field data-invalid={Boolean(errors.student_number)}>
                  <FieldLabel htmlFor="record-number">
                    {hasExistingNumber
                      ? "Existing student number"
                      : "Student number"}
                  </FieldLabel>
                  {hasExistingNumber ? (
                    <Input
                      id="record-number"
                      autoComplete="off"
                      placeholder="YYYY-MM-NNNNN"
                      aria-invalid={Boolean(errors.student_number)}
                      {...register("student_number")}
                    />
                  ) : (
                    <Input
                      id="record-number"
                      readOnly
                      value=""
                      placeholder="Assigned automatically"
                    />
                  )}
                  <FieldDescription>
                    {hasExistingNumber
                      ? "Enter it exactly as it appears on the student's records (YYYY-MM-NNNNN)."
                      : "Assigned in order (Year-Month-Sequence) when the account is created."}
                  </FieldDescription>
                  <FieldError>{errors.student_number?.message}</FieldError>
                  <div className="flex items-start gap-2 pt-1">
                    <Controller
                      control={control}
                      name="has_existing_student_number"
                      render={({ field }) => (
                        <Checkbox
                          id="record-has-number"
                          checked={field.value}
                          disabled={!canHaveExistingNumber}
                          onCheckedChange={(value) => {
                            const checked = value === true
                            field.onChange(checked)
                            if (!checked) {
                              setValue("student_number", undefined)
                              clearErrors("student_number")
                            }
                          }}
                        />
                      )}
                    />
                    <FieldLabel
                      htmlFor="record-has-number"
                      className="font-normal"
                    >
                      Student already has a student number
                    </FieldLabel>
                  </div>
                  <FieldDescription>
                    Only for a Returnee or an Existing Student. Everyone else
                    gets a new number.
                  </FieldDescription>
                  <FieldError>
                    {errors.has_existing_student_number?.message}
                  </FieldError>
                </Field>
```

Delete the now-unused file:

```bash
rm frontend/src/features/lib/student-number.ts
```

- [ ] **Step 5: Run to verify they pass**

```bash
cd frontend && npx vitest run src/features/services/admission-service.test.ts src/features/components/portal/admission-provisioning-workspace.test.tsx
```

Expected: all PASS. Likely snags: (a) `useState` may now be unused in the file's import (leave it if other code uses it; remove only if ESLint reports it); (b) Radix Select needs the option text to match exactly ("Existing Student"); (c) if the 422 test fails, add `request_id` to the mocked envelope.

- [ ] **Step 6: Type-check, lint, format**

```bash
cd frontend && npx tsc --noEmit
cd frontend && npx eslint src/features/schemas/admission-schema.ts src/features/components/portal/student-records-workspace.tsx src/features/components/portal/admission-provisioning-workspace.test.tsx src/features/services/admission-service.test.ts --max-warnings=0
cd frontend && npx prettier --check src/features/schemas/admission-schema.ts src/features/components/portal/student-records-workspace.tsx src/features/components/portal/admission-provisioning-workspace.test.tsx src/features/services/admission-service.test.ts
```

Expected: no output from `tsc`; ESLint and Prettier clean (run `npx prettier --write` on those files if only formatting is flagged). `grep -rn "generateStudentNumber\|lib/student-number" frontend/src` must return nothing. Add "Task 5 done" to PROGRESS.md.

---

## Task 6: Docs, spec refinements, and full verification

**Files:**
- Create: `docs/adr/0042-sequential-student-numbers.md`
- Modify: `PRD.md` (the `student_profiles` data-model block near line 966)
- Modify: `docs/superpowers/specs/2026-10-04-sequential-student-number-and-platform-both-design.md`
- Modify: `PROGRESS.md`

- [ ] **Step 1: ADR 0042**

Create `docs/adr/0042-sequential-student-numbers.md` in the format of ADR 0041 (Status, Date 2026-10-04, Amends/Related, Context, Decisions, Consequences) covering: the number is assigned by the server from `student_number_sequences`; format `YYYY-MM-NNNNN`; one counter per year continuing across months, restarting each January, year and month in `Asia/Manila`; the counter row is created lazily from the highest existing number; a used suffix is skipped across all months of the year; 99999 cap; the Generate button and the browser-made number are gone; `has_existing_student_number` for Returnee and Existing Student only; existing numbers not renumbered; audit gains `student_number_source`; platform `both` added without a migration (one line, since it shares the release). Consequences: one migration to run on local and Hostinger; older frontends get a 422 on `student_number` until reloaded; legacy number formats other than `YYYY-MM-NNNNN` are not accepted for the existing-number option; not decided: whether a Transferee who already holds a GRC number should be allowed.

- [ ] **Step 2: PRD amendment**

In `PRD.md`, change the line `  - \`student_number\` unique` (line 969) to:

```
  - `student_number` unique; assigned by the server as `YYYY-MM-NNNNN` from a per-year running counter, or entered by Admission for a Returnee or Existing Student who already has one (ADR 0042)
```

and add a new data-model entry immediately after the `student_profiles` block:

```
- `student_number_sequences`
  - `year` primary key
  - `last_value` (last 5-digit suffix handed out that year)
  - timestamps
```

(Read the lines around 966-990 first and match that block's indentation and blank-line style.)

- [ ] **Step 3: Apply the two refinements to the spec**

In the spec's "Data model" section replace the paragraph beginning "The migration is reversible…" with: "The migration is reversible (`down()` drops the table) and creates the table empty. The row for a year is created **on first use** from the highest existing `YYYY-MM-NNNNN` suffix of that year, so 2026 continues from 01930 and the next number is `2026-10-01931`, and a restored older dump with no counter row cannot cause a collision. `HIST-` and `TEST-` numbers never match the pattern and are ignored. A test uses the `RollsBackThroughMigration` trait." In "Assigning a number", step 3, replace "If that exact `YYYY-MM-NNNNN` is already used (for example a manually entered existing number), take the next one." with "If that suffix is already used by any student in the same year, in any month (for example a manually entered existing number), take the next one." Add a line under the spec status: "Plan refinements: lazy counter creation and a year-wide suffix check (see the plan)."

- [ ] **Step 4: PROGRESS.md**

Update the entry's status to implemented and verified (only after Step 5 passes) with: what changed (files by area), the exact test counts that ran, the commands, that the migration `2026_10_04_000001_create_student_number_sequences_table` must be run by the owner on local and on Hostinger, that nothing was committed or pushed, that the real-browser pass was or was not done, and the two spec refinements. Re-grep your own entry afterwards (concurrent agents have clobbered PROGRESS.md before).

- [ ] **Step 5: Full verification (record real results only)**

Backend (full suite, on the private DB; keep RAM in view because the seeder tests are heavy):

```bash
cd backend && DB_HOST=127.0.0.1 DB_PORT=3310 DB_USERNAME=root DB_PASSWORD= DB_DATABASE=grc_enrollment_test php artisan test
cd backend && vendor/bin/pint --test
```

Frontend:

```bash
cd frontend && npx vitest run
cd frontend && npx tsc --noEmit
cd frontend && npx eslint . --max-warnings=0
cd frontend && npx prettier --check src
```

Expected: everything green (the last recorded baseline was backend 2078/2078 and frontend 1394/1394, so any failure is a regression from this work). If something fails, use superpowers:systematic-debugging; do not mark a check as passed unless it ran and passed.

- [ ] **Step 6: Optional real-browser pass**

Only if the private MariaDB is migrated and seeded enough to sign in as an Admission Staff user and the Registrar Head: confirm there is no Generate button, the checkbox gating by type, a Returnee number is saved as typed, an auto account shows `YYYY-MM-NNNNN` in the success panel, and the Registrar term card offers "Both (Face-to-Face and Online)". If this is not done, say so in PROGRESS.md and the final report.

- [ ] **Step 7: Report**

Tell the owner: what changed, the verification results, the migration they must run, that nothing was committed, and that a GitHub saving point is theirs to request (the work is on `main`; `system-for-defense` was not touched).
