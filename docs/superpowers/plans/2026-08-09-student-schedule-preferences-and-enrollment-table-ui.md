# Student Schedule Preferences and Table-Driven Enrollment UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Design spec:** `docs/superpowers/specs/2026-08-09-grc-dataset-and-it-control-design.md`
**Plan 4 of 5.** Depends on Plan 3 (needs real students to test against). Plan 5's auto-enroll step consumes the scorer built here.

**Goal:** Let a student record a schedule preference, rank the enrollment options against it, and replace the card-based enrollment view with a table plus a modal section picker for regular students and a filterable list for irregular students.

**Architecture:** Preferences are advisory. `SchedulePreferenceScorer` produces a score and human-readable reasons that ride along on the existing block and eligible-subject pools as optional fields; nothing about seat eligibility, prerequisites, or block exclusivity changes. A student with no preferences sees exactly what they see today, just rendered as a table.

**Tech Stack:** Laravel 12, MariaDB, API Resources / Form Requests / Policies / Actions, Next.js React TypeScript, TanStack Query, React Hook Form, Zod, Tailwind/shadcn, PHPUnit, Vitest + Testing Library + vitest-axe.

## Global Constraints

- Preferences rank; they never gate. A low-scoring block must remain selectable.
- No fetch calls in components — the schema / service / hook trio is mandatory (see `AGENTS.md`).
- Radix `Select` cannot hold `""`; use the `ALL_FILTER_VALUE = "all"` sentinel (ADR 0015).
- Each workspace file stays focused; split rather than growing `enrollment-workspace.tsx` past its current 726 lines.
- Every new endpoint must be added to `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`.
- Follow the three-test workspace template: happy path with fetch-URL assertions, unauthorized role with zero fetches, axe pass.

---

### Task 1: Persist student schedule preferences

**Files:**
- Create: `backend/database/migrations/2026_08_11_000001_create_student_schedule_preferences_table.php`
- Create: `backend/app/Models/StudentSchedulePreference.php`
- Create: `backend/app/Domain/Enrollment/PreferredTimeBlock.php`
- Create: `backend/app/Http/Requests/Api/V1/StudentSchedulePreference/UpdateStudentSchedulePreferenceRequest.php`
- Create: `backend/app/Http/Resources/Api/V1/StudentSchedulePreferenceResource.php`
- Create: `backend/app/Http/Controllers/Api/V1/StudentSchedulePreferenceController.php`
- Create: `backend/app/Policies/StudentSchedulePreferencePolicy.php`
- Create: `backend/app/Actions/Enrollment/SaveStudentSchedulePreference.php`
- Create: `backend/tests/Feature/Api/V1/StudentSchedulePreferencesEndpointTest.php`
- Modify: `backend/routes/api.php`, `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`

**Interfaces:**
- `GET /api/v1/student-schedule-preferences` — the caller's own row, or defaults when unset.
- `PUT /api/v1/student-schedule-preferences` — upsert.
- `PreferredTimeBlock` = `morning | afternoon | evening | any`.

- [ ] **Step 1: Write the failing endpoint test**

```php
public function test_a_student_saves_and_reads_back_their_schedule_preference(): void
{
    $this->withToken($this->tokenFor($studentUser))->putJson('/api/v1/student-schedule-preferences', [
        'preferred_days' => [1, 2, 3],
        'preferred_time_block' => 'morning',
        'max_days_on_campus' => 3,
        'avoid_early_first_class' => true,
    ])->assertOk()->assertJsonPath('data.preferred_time_block', 'morning');

    $this->withToken($this->tokenFor($studentUser))->getJson('/api/v1/student-schedule-preferences')
        ->assertOk()->assertJsonPath('data.max_days_on_campus', 3);
}

public function test_it_rejects_sunday_in_preferred_days(): void
{
    $this->withToken($this->tokenFor($studentUser))->putJson('/api/v1/student-schedule-preferences', [
        'preferred_days' => [7],
    ])->assertStatus(422);
}

public function test_a_student_cannot_read_another_students_preference(): void { /* 403 */ }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Api/V1/StudentSchedulePreferencesEndpointTest.php --testdox`

Expected: FAIL — the route does not exist.

- [ ] **Step 3: Implement the table and API**

```php
Schema::create('student_schedule_preferences', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('student_id')->unique()->constrained('student_profiles')->cascadeOnDelete();
    $table->json('preferred_days')->nullable();          // ISO-8601 1..6
    $table->string('preferred_time_block', 16)->default('any');
    $table->string('preferred_modality', 16)->nullable();
    $table->unsignedTinyInteger('max_days_on_campus')->nullable();
    $table->boolean('avoid_early_first_class')->default(false);
    $table->string('notes')->nullable();
    $table->timestamps();
});
```

Validation: `preferred_days.*` is `integer|between:1,6`; `preferred_modality` uses `Rule::in(SectionModality::values())` — note `online` was retired by `2026_08_09_000004`. Resolve `student_id` from the authenticated user, never from input.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Api/V1/StudentSchedulePreferencesEndpointTest.php tests/Feature/Api/V1/ApiSurfaceTest.php --testdox`

Expected: PASS.

---

### Task 2: Score enrollment options against the preference

**Files:**
- Create: `backend/app/Domain/Enrollment/SchedulePreferenceScorer.php`
- Create: `backend/tests/Unit/Domain/Enrollment/SchedulePreferenceScorerTest.php`
- Modify: `backend/app/Actions/Enrollment/BuildEnrollmentBlockPool.php`
- Modify: `backend/app/Actions/Enrollment/BuildEligibleSubjectPool.php`
- Modify: `backend/app/Http/Resources/Api/V1/EnrollmentBlockResource.php` and the eligible-subject resource
- Modify: `backend/tests/Feature/Api/V1/EnrollmentBlocksEndpointTest.php`, `EligibleSubjectsEndpointTest.php`

**Interfaces:**
- `SchedulePreferenceScorer::score(?StudentSchedulePreference $preference, iterable $sections): array{score: int, reasons: list<string>}` — 0–100, with `reasons` empty when no preference is set.
- `EnrollmentBlockResource` and the eligible-subject resource gain `preference_score` (nullable int) and `preference_reasons` (list of strings).

- [ ] **Step 1: Write the failing unit test**

```php
public function test_it_scores_a_block_that_matches_every_preference_highest(): void
{
    $preference = new StudentSchedulePreference([
        'preferred_days' => [1, 2, 3], 'preferred_time_block' => 'morning',
        'max_days_on_campus' => 3, 'avoid_early_first_class' => true,
    ]);

    $good = $this->sections([[1, '09:00:00'], [2, '10:00:00'], [3, '09:00:00']]);
    $bad  = $this->sections([[4, '17:00:00'], [5, '07:00:00'], [6, '18:00:00']]);

    $this->assertGreaterThan(
        SchedulePreferenceScorer::score($preference, $bad)['score'],
        SchedulePreferenceScorer::score($preference, $good)['score'],
    );
    $this->assertContains('No class before 8:00 AM', SchedulePreferenceScorer::score($preference, $good)['reasons']);
}

public function test_it_returns_a_null_score_when_no_preference_is_set(): void
{
    $this->assertNull(SchedulePreferenceScorer::score(null, $this->sections([[1, '09:00:00']]))['score']);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/phpunit tests/Unit/Domain/Enrollment/SchedulePreferenceScorerTest.php --testdox`

Expected: FAIL — the class does not exist.

- [ ] **Step 3: Implement the scorer and wire it into both pools**

Weighted components, normalized to 0–100: day overlap with `preferred_days` (35), time-block match (30), days-on-campus at or under `max_days_on_campus` (20), no class before 08:00 when `avoid_early_first_class` (10), modality match (5). Each satisfied component contributes a plain-language reason.

In both pool actions, load the caller's preference once and attach `preference_score` / `preference_reasons` per candidate. **Do not** filter, reorder, or change `is_selectable` — those remain driven by seats, prerequisites, and `BlockSectionAccessPolicy`. Ordering is the client's concern.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/phpunit --testdox --filter 'SchedulePreference|EnrollmentBlocks|EligibleSubjects'`

Expected: PASS, including an assertion that a student without a preference still receives every block with `preference_score: null`.

---

### Task 3: Preference panel on the student side

**Files:**
- Create: `frontend/src/features/schemas/student-schedule-preference-schema.ts`
- Create: `frontend/src/features/services/student-schedule-preference-service.ts`
- Create: `frontend/src/features/hooks/use-student-schedule-preference.ts`
- Create: `frontend/src/features/components/portal/student-schedule-preferences-panel.tsx` + `.test.tsx`

**Interfaces:**
- `StudentSchedulePreferencesPanel` renders the form, saves via TanStack mutation, and invalidates the block and eligible-subject queries on success.

- [ ] **Step 1: Write the failing test**

```tsx
it("saves a schedule preference and refreshes the enrollment options", async () => {
  const user = userEvent.setup()
  renderWithSession(<StudentSchedulePreferencesPanel />, { session: studentSession })

  await user.click(await screen.findByRole("checkbox", { name: "Monday" }))
  await user.click(screen.getByRole("button", { name: "Save my schedule preference" }))

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("/api/v1/student-schedule-preferences"),
    expect.objectContaining({ method: "PUT" }),
  )
})
```

Plus the unauthorized-role test and the axe test.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/components/portal/student-schedule-preferences-panel.test.tsx`

Expected: FAIL — the file does not exist.

- [ ] **Step 3: Implement the trio and the panel**

Zod schemas `.strict()`, service builds the request body and parses through a local `parse()` that throws `ApiClientError({kind:"contract"})`, hook keyed `["student-schedule-preference", userId]`. The panel offers Mon–Sat checkboxes, a time-block select, a modality select, a max-days number input, an early-class switch, and a notes field.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/components/portal/student-schedule-preferences-panel.test.tsx`

Expected: PASS.

---

### Task 4: Table view and modal section picker for regular students

The current regular-student path renders a vertical list of radio `Card`s, each embedding its own full weekly schedule table (`enrollment-block-choice.tsx`). Requirement: a table of sections, with selection happening in a modal.

**Files:**
- Create: `frontend/src/features/components/portal/enrollment-section-table.tsx` + `.test.tsx`
- Create: `frontend/src/features/components/portal/enrollment-block-detail-dialog.tsx` + `.test.tsx`
- Delete: `frontend/src/features/components/portal/enrollment-block-choice.tsx` + `.test.tsx`
- Modify: `frontend/src/features/components/portal/enrollment-workspace.tsx` + `.test.tsx`
- Modify: `frontend/src/features/schemas/enrollment-block-schema.ts`

**Interfaces:**
- `EnrollmentSectionTable` — columns Section, Subjects, Units, Days, Time, Seats, Preference match, Action. Reuses the shared `DataTable`.
- `EnrollmentBlockDetailDialog` — full weekly schedule, seat count, blocking reasons, Cancel / Choose this section.

- [ ] **Step 1: Write the failing tests**

```tsx
it("lists sections in a table and opens the picker modal on view", async () => {
  const user = userEvent.setup()
  renderWithSession(<EnrollmentWorkspace />, { session: regularStudentSession })

  const table = await screen.findByRole("table", { name: /available sections/i })
  expect(within(table).getByText("IT301")).toBeInTheDocument()

  await user.click(within(table).getByRole("button", { name: /view IT301/i }))

  const dialog = await screen.findByRole("dialog", { name: /IT301/ })
  expect(within(dialog).getByRole("table", { name: /weekly schedule/i })).toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "Choose this section" }))
})

it("sorts by preference match when preferences are applied", async () => {
  await user.click(screen.getByRole("switch", { name: "Apply my preferences" }))
  const rows = within(await screen.findByRole("table", { name: /available sections/i })).getAllByRole("row")
  expect(within(rows[1]).getByText("IT303")).toBeInTheDocument()   // highest preference_score first
})

it("keeps a low-scoring section selectable", async () => { /* … */ })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/components/portal/enrollment-workspace.test.tsx src/features/components/portal/enrollment-section-table.test.tsx`

Expected: FAIL — no table, no dialog.

- [ ] **Step 3: Implement the table and dialog**

Move the weekly-schedule table out of the card and into the dialog body. The `Preference match` column shows a score badge plus the top reason, or an em dash when `preference_score` is null. The "Apply my preferences" `Switch` sorts by `preference_score` descending; it does not filter. Keep the existing confirm-submission `AlertDialog` — the picker dialog only stages a choice.

Accessibility: the dialog is labelled by the section code, the table has a `caption`, and every row action names its section so the accessible name is unique.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/components/portal --reporter=verbose`

Expected: PASS, axe included.

---

### Task 5: Filters and preference sorting for irregular students

**Files:**
- Create: `frontend/src/features/components/portal/enrollment-subject-filter-bar.tsx` + `.test.tsx`
- Modify: `frontend/src/features/components/portal/enrollment-workspace.tsx` + `.test.tsx`

**Interfaces:**
- `EnrollmentSubjectFilterBar` — Day, Time block, Professor, Subject search. Client-side filtering over the already-fetched pool; no extra requests.

- [ ] **Step 1: Write the failing test**

```tsx
it("filters the irregular subject pool by day without refetching", async () => {
  const user = userEvent.setup()
  renderWithSession(<EnrollmentWorkspace />, { session: irregularStudentSession })

  await screen.findByRole("heading", { name: /eligible subjects/i })
  const callsBefore = fetchMock.mock.calls.length

  await user.selectOptions(screen.getByLabelText("Day"), "2")

  expect(fetchMock.mock.calls).toHaveLength(callsBefore)
  expect(screen.queryByText("IT 305")).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/components/portal/enrollment-workspace.test.tsx --testNamePattern filters`

Expected: FAIL — no filter bar.

- [ ] **Step 3: Implement the filter bar**

Use `ALL_FILTER_VALUE = "all"` for the cleared state of every `Select`. Share the "Apply my preferences" switch with the regular path — for irregular students it sorts each subject's section list by `preference_score`. Announce result counts through the existing `status-region.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/components/portal/enrollment-workspace.test.tsx`

Expected: PASS.

- [ ] **Step 5: Full gates**

Run:
```
cd backend  && vendor/bin/pint --test && vendor/bin/phpstan analyse && vendor/bin/phpunit --testdox
cd frontend && npm run lint && npx tsc --noEmit && npm run test
```

Expected: all green.

---

## Manual verification

Requires an open enrollment term — as Registrar Head, archive 2026-2027 1st and open 2026-2027 2nd first.

1. Sign in as a regular student (any `s26*@grc.test`, password `password`).
2. The enrollment view shows a **table** of sections, not cards. Preference match reads em dash for every row.
3. Open the schedule preference panel, choose Mon/Tue/Wed, morning, max 3 days, avoid early classes, and save.
4. Return to the table — Preference match now shows scores with reasons. Toggle "Apply my preferences" and confirm the order changes while every row stays selectable.
5. Click View on a section — the modal shows the full weekly schedule; Choose this section stages it and the existing confirmation dialog completes the submission.
6. Sign in as an irregular student (one the classifier flagged in Plan 3). Confirm the filter bar narrows the pool without a network call, and that "Apply my preferences" reorders each subject's sections.
7. Sign in as a student with no preferences — behaviour is unchanged apart from the table layout.
