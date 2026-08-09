# Faculty Availability and Subject Preferences Rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Design spec:** `docs/superpowers/specs/2026-08-09-grc-dataset-and-it-control-design.md`
**Plan 1 of 5.** No dependencies. Plan 3 depends on Task 5 of this plan.

**Goal:** Fix the broken professor Availability & Preferences workspace, make availability a reusable term-independent profile without Sunday, add a subject-level teaching-capability model, split the UI into separate Availability and Subject Preference areas, and seed complete profiles for all 145 professors.

**Architecture:** Availability stops being term-scoped and becomes a professor profile, matching `faculty_curriculum_subject_preferences` which is already term-independent. Teaching capability gets its own subject-scoped table rather than being inferred from preferences, so `GenerateFacultyAssignmentRecommendations` can ask "can this professor teach subject X?" directly. The workspace becomes a `Tabs` shell over independent panels.

**Tech Stack:** Laravel 12, Sanctum bearer tokens, MariaDB migrations, API Resources / Form Requests / Policies / Actions, Next.js React TypeScript, TanStack Query, React Hook Form, Zod, Tailwind/shadcn, PHPUnit, Vitest + Testing Library + vitest-axe.

## Global Constraints

- All accounts and reference data stay local/test-only with `@grc.test` addresses. Every seeder keeps its `app()->environment(['local','testing'])` guard.
- Never write `professor_id` from client input — the controller sets it from the authenticated actor.
- `subjects` is UNIQUE(`college`, `code`); 41 general-education codes repeat across colleges. Every subject lookup must be college-scoped.
- Do not touch `app/Domain/Scheduling/ScheduleDayParser.php` — its `Sun` token parses workbook schedule strings and is unrelated to availability.
- Do not commit raw workbooks, generated account reports, or unrelated working-tree changes.
- `backend/tests/Feature/Api/V1/ApiSurfaceTest.php` asserts the exact sorted route list. Any new endpoint must be added there in the same commit.

---

### Task 1: Fix the catalog contract bug that breaks the workspace

**Root cause:** `curriculumSubjectSchema` requires integer units, but 32 `LEAD*` subjects carry 1.5 units across 78 curriculum placements. The parse failure surfaces as a generic "Faculty input could not be loaded." banner with an empty Curriculum select and a permanently disabled Save button.

**Files:**
- Modify: `frontend/src/features/schemas/faculty-schema.ts`
- Modify: `frontend/src/features/components/portal/faculty-input-workspace.test.tsx`
- Modify: `backend/tests/Feature/Api/V1/FacultyPreferenceCatalogEndpointTest.php`

**Interfaces:**
- `curriculumSubjectSchema.units` accepts fractional non-negative values.

- [ ] **Step 1: Write the failing frontend test**

Change the fixture at `faculty-input-workspace.test.tsx:41` so a catalog subject carries fractional units, and assert the curriculum select is populated rather than showing the error banner.

```tsx
subjects: [
  { id: 501, code: "LEAD 1", title: "Leadership Seminar 1", units: 1.5 },
  { id: 502, code: "IT 101", title: "Introduction to Computing", units: 3 },
],
```

```tsx
expect(await screen.findByRole("combobox", { name: /curriculum/i })).toBeEnabled()
expect(screen.queryByText(/Faculty input could not be loaded/i)).not.toBeInTheDocument()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/components/portal/faculty-input-workspace.test.tsx`

Expected: FAIL — the envelope parse rejects `units: 1.5` and the workspace renders the error alert.

- [ ] **Step 3: Widen the schema**

`frontend/src/features/schemas/faculty-schema.ts:90`, matching the already-correct `reference-data-schema.ts:59`:

```ts
units: z.number().nonnegative(),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/components/portal/faculty-input-workspace.test.tsx`

Expected: PASS.

- [ ] **Step 5: Add the backend regression test**

Add a case to `FacultyPreferenceCatalogEndpointTest` that seeds a 1.5-unit subject into a curriculum and asserts the endpoint emits it verbatim, so the two sides stay in agreement.

Run: `cd backend && vendor/bin/phpunit tests/Feature/Api/V1/FacultyPreferenceCatalogEndpointTest.php --testdox`

Expected: PASS.

---

### Task 2: Make availability term-independent and drop Sunday

**Files:**
- Create: `backend/database/migrations/2026_08_10_000001_make_faculty_availabilities_term_independent.php`
- Modify: `backend/app/Models/FacultyAvailability.php`
- Modify: `backend/app/Http/Requests/Api/V1/FacultyAvailability/StoreFacultyAvailabilityRequest.php`
- Modify: `backend/app/Http/Requests/Api/V1/FacultyAvailability/UpdateFacultyAvailabilityRequest.php`
- Modify: `backend/app/Http/Resources/Api/V1/FacultyAvailabilityResource.php`
- Modify: `backend/app/Actions/Faculty/CreateFacultyAvailability.php`, `UpdateFacultyAvailability.php`, `DeleteFacultyAvailability.php`
- Modify consumers: `backend/app/Actions/Scheduling/GenerateFacultyAssignmentRecommendations.php`, `backend/app/Domain/Scheduling/FacultyLoadPlanner.php`
- Modify seeders: `WorkbookFacultyProfileSeeder.php`, `DemoEnrollmentSeeder.php`, `PredictivePlanningInputSeeder.php`, `ProgramChairScheduleSampleSeeder.php`
- Modify: `backend/tests/Feature/Api/V1/FacultyAvailabilitiesEndpointTest.php`

**Interfaces:**
- `faculty_availabilities` loses `academic_term_id`; unique key becomes `(professor_id, day_of_week, starts_at_time)`.
- `day_of_week` accepts 1–6 (Mon–Sat) only.

- [ ] **Step 1: Write the failing endpoint tests**

```php
public function test_it_stores_an_availability_window_without_an_academic_term(): void
{
    $response = $this->withToken($this->tokenFor($professor))->postJson('/api/v1/faculty-availabilities', [
        'day_of_week' => 2, 'starts_at_time' => '09:00:00', 'ends_at_time' => '12:00:00',
    ]);

    $response->assertCreated();
    $this->assertDatabaseHas('faculty_availabilities', [
        'professor_id' => $professor->id, 'day_of_week' => 2, 'origin' => 'declared',
    ]);
}

public function test_it_rejects_sunday(): void
{
    $this->withToken($this->tokenFor($professor))->postJson('/api/v1/faculty-availabilities', [
        'day_of_week' => 7, 'starts_at_time' => '09:00:00', 'ends_at_time' => '12:00:00',
    ])->assertStatus(422)->assertJsonPath('error.code', 'VALIDATION_FAILED');
}
```

Also update the existing `test_declaring_the_same_slot_twice_is_rejected_with_a_clean_422` to drop its `academic_term_id` payload.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Api/V1/FacultyAvailabilitiesEndpointTest.php --testdox`

Expected: FAIL — `academic_term_id` is still required and Sunday is still accepted.

- [ ] **Step 3: Write the migration**

```php
public function up(): void
{
    DB::table('faculty_availabilities')->where('day_of_week', 7)->delete();

    Schema::table('faculty_availabilities', function (Blueprint $table): void {
        $table->dropUnique('faculty_availability_unique_slot');
        $table->dropForeign(['academic_term_id']);
        $table->dropColumn('academic_term_id');
        $table->unique(['professor_id', 'day_of_week', 'starts_at_time'], 'faculty_availability_unique_slot');
    });
}
```

`down()` restores the column as nullable, backfills it with the current term id, and rebuilds the original unique key.

- [ ] **Step 4: Update the request, resource, model, and actions**

Remove `academic_term_id` from both FormRequests' rules and from `FacultyAvailabilityResource`'s keyset and `@return array{...}` docblock. Narrow both requests:

```php
'day_of_week' => ['required', 'integer', 'between:1,6'],
'starts_at_time' => ['required', 'date_format:H:i:s', Rule::unique('faculty_availabilities')
    ->where('professor_id', $this->user()->id)
    ->where('day_of_week', $this->integer('day_of_week'))
    ->where('origin', 'declared')],
```

- [ ] **Step 5: Update consumers and seeders**

Remove every `academic_term_id` reference in `GenerateFacultyAssignmentRecommendations`, `FacultyLoadPlanner`, and the four seeders. Availability queries become plain `where('professor_id', …)` lookups.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && vendor/bin/phpunit --testdox --filter 'FacultyAvailabilit|FacultyLoad|Scheduling'`

Expected: PASS across availability endpoints, load planning, and scheduling recommendations.

- [ ] **Step 7: Remove Sunday from the frontend**

`frontend/src/features/components/portal/faculty-input-workspace.tsx:84-92` — drop the Sunday entry from `weekdays`. Remove `academic_term_id` from `faculty-schema.ts`'s availability input/resource schemas, from `faculty-service.ts`'s request body, and from `use-faculty-input.ts`.

Run: `cd frontend && npx tsc --noEmit`

Expected: no type errors.

---

### Task 3: Stop the 422 collisions professors hit on first use

**Files:**
- Modify: `backend/app/Actions/Faculty/CreateFacultyAvailability.php`
- Modify: `backend/app/Http/Requests/Api/V1/FacultyCurriculumSubjectPreference/StoreFacultyCurriculumSubjectPreferenceRequest.php`
- Modify: `backend/app/Actions/Faculty/CreateFacultyCurriculumSubjectPreference.php`
- Modify: `frontend/src/features/components/portal/faculty-input-workspace.tsx` (will move to the preference panel in Task 6)
- Modify: `backend/tests/Feature/Api/V1/FacultyCurriculumSubjectPreferencesEndpointTest.php`

**Interfaces:**
- Declaring a window that overlaps a `workbook_seeded` slot replaces it instead of erroring.
- Omitting `rank` assigns `max(rank) + 1` within `(professor, curriculum, semester)`.

- [ ] **Step 1: Write the failing tests**

```php
public function test_declaring_over_a_seeded_slot_replaces_it(): void
{
    FacultyAvailability::create([...'origin' => 'workbook_seeded', 'day_of_week' => 1, 'starts_at_time' => '08:00:00']);

    $this->withToken($this->tokenFor($professor))->postJson('/api/v1/faculty-availabilities', [
        'day_of_week' => 1, 'starts_at_time' => '08:00:00', 'ends_at_time' => '17:00:00',
    ])->assertCreated();

    $this->assertDatabaseCount('faculty_availabilities', 1);
    $this->assertDatabaseHas('faculty_availabilities', ['day_of_week' => 1, 'origin' => 'declared']);
}

public function test_omitting_rank_appends_after_the_seeded_preferences(): void
{
    // three workbook_seeded rows already occupy ranks 1..3
    $response = $this->withToken($this->tokenFor($professor))
        ->postJson('/api/v1/faculty-curriculum-subject-preferences', [
            'curriculum_id' => $curriculum->id, 'semester' => '1st', 'subject_id' => $subject->id,
        ]);

    $response->assertCreated()->assertJsonPath('data.rank', 4);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/phpunit --testdox --filter 'seeded_slot|omitting_rank'`

Expected: FAIL with 422 "has already been taken" on both.

- [ ] **Step 3: Implement the fixes**

In `CreateFacultyAvailability`, inside the existing transaction, delete any `origin='workbook_seeded'` row matching `(professor_id, day_of_week, starts_at_time)` before insert. In the preference request, make `rank` `sometimes` and resolve the default in the Action:

```php
$rank = $attributes['rank'] ?? (FacultyCurriculumSubjectPreference::query()
    ->where('professor_id', $actor->id)
    ->where('curriculum_id', $attributes['curriculum_id'])
    ->where('semester', $attributes['semester'])
    ->max('rank') + 1);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/phpunit --testdox --filter 'FacultyAvailabilit|FacultyCurriculumSubjectPreference'`

Expected: PASS.

- [ ] **Step 5: Render the invisible field error**

Add a `FieldError` element for `day_of_week` in the availability form. `applyApiFieldErrors` already maps it — there is simply no element to display it.

---

### Task 4: Add the `faculty_specializations` capability model

**Files:**
- Create: `backend/database/migrations/2026_08_10_000002_create_faculty_specializations_table.php`
- Create: `backend/app/Models/FacultySpecialization.php`
- Create: `backend/app/Domain/Faculty/SpecializationProficiency.php`
- Create: `backend/app/Http/Requests/Api/V1/FacultySpecialization/StoreFacultySpecializationRequest.php`
- Create: `backend/app/Http/Resources/Api/V1/FacultySpecializationResource.php`
- Create: `backend/app/Http/Controllers/Api/V1/FacultySpecializationController.php`
- Create: `backend/app/Policies/FacultySpecializationPolicy.php`
- Create: `backend/app/Actions/Faculty/CreateFacultySpecialization.php`, `DeleteFacultySpecialization.php`
- Create: `backend/tests/Feature/Api/V1/FacultySpecializationsEndpointTest.php`
- Modify: `backend/routes/api.php`, `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`

**Interfaces:**
- `GET|POST /api/v1/faculty-specializations`, `DELETE /api/v1/faculty-specializations/{facultySpecialization}`.
- `SpecializationProficiency` = `primary | secondary`.

- [ ] **Step 1: Write the failing endpoint test**

```php
public function test_a_professor_declares_and_lists_their_teaching_specializations(): void
{
    $this->withToken($this->tokenFor($professor))->postJson('/api/v1/faculty-specializations', [
        'subject_id' => $subject->id, 'proficiency' => 'primary',
    ])->assertCreated()->assertJsonPath('data.type', 'faculty-specialization');

    $this->withToken($this->tokenFor($professor))->getJson('/api/v1/faculty-specializations')
        ->assertOk()->assertJsonCount(1, 'data');
}

public function test_it_rejects_a_duplicate_subject(): void { /* second POST → 422 */ }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Api/V1/FacultySpecializationsEndpointTest.php --testdox`

Expected: FAIL — route does not exist.

- [ ] **Step 3: Implement migration, model, and API**

```php
Schema::create('faculty_specializations', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('professor_id')->constrained('users')->cascadeOnDelete();
    $table->foreignId('subject_id')->constrained('subjects')->restrictOnDelete();
    $table->string('proficiency', 16)->default('secondary');
    $table->string('source', 32)->default('declared');   // declared | seeded
    $table->string('notes')->nullable();
    $table->timestamps();
    $table->unique(['professor_id', 'subject_id'], 'faculty_specialization_unique_subject');
    $table->index(['professor_id', 'proficiency'], 'faculty_specialization_prof_prof_idx');
});
```

Routes go inside the existing `Route::middleware('role:faculty')` group for writes, with a read route alongside `GET /faculty-availabilities` and `GET /faculty-subject-preferences` (line ~97) for planning roles. Follow the `FacultyCurriculumSubjectPreference` files as the template throughout — same Action/Policy/Resource shape, same `AuditRecorder` usage.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Api/V1/FacultySpecializationsEndpointTest.php --testdox`

Expected: PASS.

- [ ] **Step 5: Register the routes in `ApiSurfaceTest`**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Api/V1/ApiSurfaceTest.php --testdox`

Expected: PASS.

---

### Task 5: Feed specializations into the assignment recommender

**Files:**
- Modify: `backend/app/Actions/Scheduling/GenerateFacultyAssignmentRecommendations.php`
- Modify: `backend/database/migrations` — add `specialization_match` to `faculty_assignment_recommendations` (new migration, do not edit `2026_08_09_000005_add_faculty_loading_and_forecast_detail.php`)
- Modify: `backend/app/Http/Resources/Api/V1/FacultyAssignmentRecommendationResource.php`
- Modify: `backend/tests/Feature/Api/V1/FacultyAssignmentRecommendationsEndpointTest.php`

**Interfaces:**
- A recommendation exposes `specialization_match` alongside the existing `availability_match` and `preference_rank`.

- [ ] **Step 1: Write the failing test**

```php
public function test_a_primary_specialization_outranks_a_bare_preference(): void
{
    // professorA: preference rank 1, no specialization
    // professorB: preference rank 3, primary specialization on the same subject
    $recommendations = $this->generateFor($section);

    $this->assertSame($professorB->id, $recommendations->first()->professor_id);
    $this->assertSame('primary', $recommendations->first()->specialization_match);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Api/V1/FacultyAssignmentRecommendationsEndpointTest.php --testdox`

Expected: FAIL — no `specialization_match` column and the ranking ignores specializations.

- [ ] **Step 3: Implement the scoring change**

Eager-load specializations per candidate professor, keyed by `subject_id`. Score contribution: `primary` outweighs any preference rank; `secondary` breaks ties between equal preference ranks; absent leaves the existing score unchanged so behaviour is unchanged for professors without specializations.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && vendor/bin/phpunit --testdox --filter 'FacultyAssignmentRecommendation'`

Expected: PASS.

---

### Task 6: Split the workspace into separate Availability and Subject Preference areas

The current single page mixes both concerns in a two-column grid, with a grey bar whose two buttons only call `document.getElementById(...)?.focus()`. Requirement: the Availability window and Subject Preferences must be visually and structurally separate, and everything about subject preferences — including the full list — must live inside the Subject Preferences area rather than behind an "Add subject preference" affordance.

**Files:**
- Create: `frontend/src/features/components/portal/faculty-availability-panel.tsx` + `.test.tsx`
- Create: `frontend/src/features/components/portal/faculty-subject-preference-panel.tsx` + `.test.tsx`
- Modify: `frontend/src/features/components/portal/faculty-input-workspace.tsx` + `.test.tsx`
- Modify: `frontend/src/features/hooks/use-faculty-input.ts`, `frontend/src/features/services/faculty-service.ts`, `frontend/src/features/schemas/faculty-schema.ts`
- Reuse: `frontend/src/features/components/ui/tabs.tsx`, `data-table.tsx`, `async-boundary.tsx`, `workspace-page.tsx`

**Interfaces:**
- `FacultyInputWorkspace` renders a `Tabs` shell with three tabs: `Availability window`, `Subject preferences`, `Teaching history`.
- `FacultyAvailabilityPanel` and `FacultySubjectPreferencePanel` each own their form, list, and delete dialog.

- [ ] **Step 1: Write the failing panel tests**

Follow the three-test template used by every workspace (`audit-logs-workspace.test.tsx` is the canonical example): happy path with fetch-URL assertions, unauthorized role rendering the guard with zero fetches, and an axe pass.

```tsx
it("keeps availability and subject preferences on separate tabs", async () => {
  const user = userEvent.setup()
  renderWithSession(<FacultyInputWorkspace />, { session: facultySession })

  expect(await screen.findByRole("tab", { name: "Availability window" })).toBeInTheDocument()
  await user.click(screen.getByRole("tab", { name: "Subject preferences" }))

  expect(await screen.findByRole("table", { name: /subject preferences/i })).toBeInTheDocument()
  expect(screen.queryByLabelText(/^Day$/)).not.toBeInTheDocument()
})

it("lists declared specializations inside the subject preferences tab", async () => { /* … */ })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/components/portal/faculty-input-workspace.test.tsx src/features/components/portal/faculty-availability-panel.test.tsx src/features/components/portal/faculty-subject-preference-panel.test.tsx`

Expected: FAIL — the panel files do not exist and there are no tabs.

- [ ] **Step 3: Extract the panels**

`faculty-availability-panel.tsx` — the Day / Start / End form and the saved-window table with Edit and Remove. No academic term select, no Sunday.

`faculty-subject-preference-panel.tsx` — Curriculum, Semester (`1st` / `2nd` toggle), `SearchableCombobox` subject picker, optional Rank, and a **Proficiency** select writing to `faculty-specializations`; plus the filter input and the full preference table with Rank / Subject / Proficiency / Source / Actions.

`faculty-input-workspace.tsx` becomes a shell: `WorkspacePage` → `Tabs` → the two panels plus the existing read-only teaching-history table. Delete the grey quick-action bar (current lines 311–327).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/components/portal --reporter=verbose`

Expected: PASS, including the axe assertions.

- [ ] **Step 5: Full frontend gate**

Run: `cd frontend && npm run lint && npx tsc --noEmit && npm run test`

Expected: all green. Each new file stays under ~400 lines.

---

### Task 7: Seed complete profiles for all 145 professors

`WorkbookFacultyProfileSeeder` already reads `Subject And Prerequisuite/Professor_Department_List.md` and synchronizes the directory. Extend it — do not add a parallel seeder.

**Files:**
- Modify: `backend/database/seeders/WorkbookFacultyProfileSeeder.php`
- Modify: `backend/tests/Feature/Database/WorkbookFacultyProfileSeederTest.php`

**Interfaces:**
- Every faculty user ends with ≥1 availability window, ≥1 ranked curriculum subject preference (where their college has a curriculum), and ≥4 specializations.

- [ ] **Step 1: Write the failing seeder test**

```php
public function test_every_professor_receives_availability_preferences_and_specializations(): void
{
    (new WorkbookFacultyProfileSeeder($fixturePath))->run();

    $professors = User::where('role', UserRole::Faculty)->pluck('id');
    $this->assertGreaterThanOrEqual(145, $professors->count());

    foreach ($professors as $id) {
        $this->assertGreaterThan(0, FacultyAvailability::where('professor_id', $id)->count());
        $this->assertGreaterThanOrEqual(4, FacultySpecialization::where('professor_id', $id)->count());
    }

    $this->assertSame(0, FacultyAvailability::where('day_of_week', 7)->count());
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Database/WorkbookFacultyProfileSeederTest.php --testdox`

Expected: FAIL — the 55 Coaches/Unidentified entries have no profile data.

- [ ] **Step 3: Implement deterministic profile seeding**

Derive everything from `crc32($email)` so runs are reproducible:

- **Availability** — full-time: 5 weekdays, 08:00:00–17:00:00. Part-time: 3 days chosen from Mon–Sat, 4-hour windows. `origin => 'workbook_seeded'`.
- **Preferences** — 5–8 ranked rows per `(curriculum, semester)` for curricula in the professor's college, drawn from `curriculum_subjects` for that semester. Ranks are contiguous from 1. `origin => 'workbook_seeded'`.
- **Specializations** — 4–10 subjects. Prefer subjects with `faculty_teaching_histories` evidence (those become `primary`); fill the rest from the college curriculum as `secondary`. `source => 'seeded'`.
- **Coaches / Unidentified** — `CollegeCode::tryFrom()` returns null for these 55 entries. Give them PE, NSTP, and general-education subjects only, and skip curriculum preferences entirely.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Database/WorkbookFacultyProfileSeederTest.php --testdox`

Expected: PASS.

- [ ] **Step 5: Full backend gate and a live seed**

Run:
```
cd backend && vendor/bin/pint --test && vendor/bin/phpstan analyse && vendor/bin/phpunit --testdox
cd backend && php artisan migrate:fresh --seed
```

Expected: all green; the seed completes without error.

---

## Manual verification

1. `cd backend && php artisan serve` and `cd frontend && npm run dev`.
2. Sign in as any professor from `Subject And Prerequisuite/Professor_Department_List.md` with password `password`.
3. Open `/portal/availability-preferences`. Expected: three tabs, no error banner, a populated Curriculum select, and a populated preference table.
4. On **Availability window**: no Academic term field, no Sunday option. Add `Monday 08:00:00–17:00:00` over a seeded slot — expect success, not "already been taken".
5. On **Subject preferences**: add a subject without touching Rank — expect it to append at the end, not 422. Set proficiency to `primary` and confirm it appears in the list.
6. Sign in as a Program Chair, open the faculty loading workspace, and confirm recommendations now show a specialization signal.
