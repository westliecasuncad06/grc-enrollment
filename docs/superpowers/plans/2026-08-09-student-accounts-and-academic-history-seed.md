# Student Accounts and Academic History Seed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Design spec:** `docs/superpowers/specs/2026-08-09-grc-dataset-and-it-control-design.md`
**Plan 3 of 5.** Depends on Plan 1 (specializations pick historical professors) and Plan 2 (the roster file).

**Goal:** Turn `Students-Profile.md` into 3,210 live accounts with seven terms of real sections, enrollments, and locked grades; derive ~10% irregular students from genuine failing marks; and give the predictive analytics engine real demand observations instead of synthetic formulas.

**Architecture:** A single seeder walks the roster file, then walks each cohort backwards through the seven existing academic terms. Volume (≈190k rows) rules out Eloquent, so writes are chunked `DB::table()->insert()` calls inside one transaction per term. Irregularity is never written directly — failing marks are seeded and `EnrollmentCategoryClassifier` derives the category, keeping the data self-consistent. A new action aggregates the result into `section_demand_observations` so the forecaster reads real history.

**Tech Stack:** Laravel 12, MariaDB, PHPUnit.

## Global Constraints

- Local/testing only, `RuntimeException` otherwise — the same guard every seeder uses.
- **`subjects` is UNIQUE(`college`, `code`).** 41 general-education codes repeat across colleges. Every subject lookup must be college-scoped or grade history cross-links to the wrong `subject_id` and misclassifies students as irregular.
- **`enrollments.active_academic_term_id` is a stored generated column** — it is not fillable and must be omitted from every insert payload.
- **`sections.enrolled_count` is a manually maintained counter** — bulk inserts leave it stale; recompute it explicitly.
- `academic_grades` is UNIQUE(`student_id`, `subject_id`, `academic_term_id`). A repeated subject in a later term is fine; a duplicate within a term is not.
- `enrollments` is UNIQUE(`student_id`, `active_academic_term_id`) — one active enrollment per student per term, DB-enforced.
- Never write `student_profiles.enrollment_category` directly.
- Idempotent: re-running the seeder must not duplicate rows.
- Target runtime under five minutes for `migrate:fresh --seed`.

### Cohort mapping

| Year level | Entry year | Completed terms | Range |
|---|---|---|---|
| 4th | 2023-2024 | 7 | 2023-24 1st … 2026-27 1st |
| 3rd | 2024-2025 | 5 | 2024-25 1st … 2026-27 1st |
| 2nd | 2025-2026 | 3 | 2025-26 1st … 2026-27 1st |
| 1st / TCP | 2026-2027 | 1 | 2026-27 1st |

All seven terms already exist in `AcademicTermSeeder`. 2026-2027 1st stays `semester_closed` and tracked in `academic_term_current_slots` — the Registrar Head archives it manually to open 2026-2027 2nd.

---

### Task 1: Parse the roster file into accounts

**Files:**
- Create: `backend/database/seeders/StudentRosterSeeder.php`
- Create: `backend/tests/Feature/Database/StudentRosterSeederTest.php`
- Create: `backend/tests/fixtures/students-profile-sample.md` (a 3-section trimmed roster)
- Modify: `backend/database/seeders/DatabaseSeeder.php`

**Interfaces:**
- `new StudentRosterSeeder($rosterPath)` — constructor path override for tests, defaulting to `Subject And Prerequisuite/Students-Profile.md`.
- Produces `users` (role `student`, status `active`) and `student_profiles` with `enrollment_category` null.

- [ ] **Step 1: Write the failing test**

```php
public function test_it_creates_accounts_from_the_roster_file(): void
{
    (new StudentRosterSeeder($this->fixturePath()))->run();

    $this->assertDatabaseHas('users', ['email' => 's2401455@grc.test', 'role' => 'student', 'status' => 'active']);
    $this->assertDatabaseHas('student_profiles', [
        'student_number' => '2024-06-01455', 'year_level' => 3, 'entry_year' => 2024, 'enrollment_category' => null,
    ]);
}

public function test_running_twice_does_not_duplicate_accounts(): void
{
    (new StudentRosterSeeder($this->fixturePath()))->run();
    $before = User::where('role', 'student')->count();
    (new StudentRosterSeeder($this->fixturePath()))->run();

    $this->assertSame($before, User::where('role', 'student')->count());
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Database/StudentRosterSeederTest.php --testdox`

Expected: FAIL — the seeder does not exist.

- [ ] **Step 3: Implement roster parsing and account creation**

Parse only the `####` section tables — the summary tables at the top must be ignored. For each row resolve `program_id` by code and `curriculum_id` to that program's Active 2024-2029 curriculum. Set `entry_year` from `StudentRosterMap::entryYearFor($yearLevel)`, `admission_status` and `academic_standing` to their defaults, and leave `enrollment_category` null.

Use chunked `upsert()` on `users` keyed by `email` and on `student_profiles` keyed by `student_number`, 500 rows per chunk. Hash the password once and reuse the hash — 3,210 individual `Hash::make()` calls dominate the runtime otherwise.

Register the seeder in `DatabaseSeeder` after `DemoEnrollmentSeeder` and before `ProgramChairScheduleSampleSeeder`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Database/StudentRosterSeederTest.php --testdox`

Expected: PASS.

---

### Task 2: Build historical sections for all seven terms

**Files:**
- Modify: `backend/database/seeders/StudentRosterSeeder.php`
- Modify: `backend/tests/Feature/Database/StudentRosterSeederTest.php`

**Interfaces:**
- Each `(term, cohort year level)` pair yields `academic_term_section_plans` rows and `sections` rows with `status=closed`, `is_block_exclusive=true`, `capacity=40`, `capacity_source=plan`.

- [ ] **Step 1: Write the failing test**

```php
public function test_it_builds_a_section_history_that_walks_each_cohort_backwards(): void
{
    (new StudentRosterSeeder($this->fixturePath()))->run();

    $current = AcademicTerm::where('school_year', '2026-2027')->where('semester', '1st')->sole();
    $earliest = AcademicTerm::where('school_year', '2023-2024')->where('semester', '1st')->sole();

    // a 4th-year student's block exists in the current term at year 4
    $this->assertDatabaseHas('sections', ['academic_term_id' => $current->id, 'section_code' => 'IT401']);
    // and in the earliest term at year 1
    $this->assertDatabaseHas('sections', ['academic_term_id' => $earliest->id, 'section_code' => 'IT101']);
    // a 1st-year cohort has no section before it entered
    $this->assertDatabaseMissing('sections', ['academic_term_id' => $earliest->id, 'section_code' => 'IT102']);
}

public function test_every_historical_section_has_a_professor(): void
{
    $this->assertSame(0, Section::whereNull('professor_id')->where('status', 'closed')->count());
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Database/StudentRosterSeederTest.php --testdox --filter section`

Expected: FAIL — no historical sections are produced.

- [ ] **Step 3: Implement section history**

For each term, for each cohort, compute that cohort's year level in that term (`currentYearLevel - termsFromNow`), skipping non-positive results. Section codes come from `SectionBlockCode::fromProgram()`, except first-year COE blocks which keep the roster's verbatim `EDUC1xx` code.

Subjects for a block come from `curriculum_subjects` filtered to that `(curriculum, year_level, semester)`, matching `semester` or the composite `'1st|2nd'` value (four subjects use it — see `SemesterCoverage`).

Assign professors from `faculty_specializations` (Plan 1), preferring `primary` proficiency in the section's college, then falling back to `faculty_curriculum_subject_preferences`, then to any faculty in that college. Round-robin so the load spreads and no professor lands two sections in the same day/time slot.

Give each section a deterministic day/time/room drawn from `room_catalog_entries` so the historical schedule is coherent.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Database/StudentRosterSeederTest.php --testdox --filter section`

Expected: PASS.

---

### Task 3: Seed enrollments, enrollment subjects, and locked grades

**Files:**
- Modify: `backend/database/seeders/StudentRosterSeeder.php`
- Modify: `backend/tests/Feature/Database/StudentRosterSeederTest.php`

**Interfaces:**
- One `enrollments` row per `(student, completed term)` with `status=enrolled` and a full timestamp trail.
- One `enrollment_subjects` row per block subject with `status=enrolled`.
- One locked `academic_grades` row per subject.

- [ ] **Step 1: Write the failing test**

```php
public function test_a_fourth_year_student_has_seven_completed_terms_of_locked_grades(): void
{
    (new StudentRosterSeeder($this->fixturePath()))->run();

    $student = StudentProfile::where('student_number', '2023-06-01455')->sole();

    $this->assertSame(7, Enrollment::where('student_id', $student->id)->count());
    $this->assertSame(7, Enrollment::where('student_id', $student->id)->where('status', 'enrolled')->count());
    $this->assertGreaterThan(40, AcademicGrade::where('student_id', $student->id)->where('status', 'locked')->count());
}

public function test_section_enrolled_counts_match_the_enrollment_subject_rows(): void
{
    foreach (Section::where('status', 'closed')->get() as $section) {
        $this->assertSame(
            EnrollmentSubject::where('section_id', $section->id)->where('status', '!=', 'dropped')->count(),
            $section->enrolled_count,
        );
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Database/StudentRosterSeederTest.php --testdox --filter 'locked_grades|enrolled_counts'`

Expected: FAIL — no enrollment or grade rows exist.

- [ ] **Step 3: Implement bulk history writes**

Per term, inside one transaction:

1. Insert `enrollments` in chunks of 1,000. Payload includes `student_id`, `academic_term_id`, `status`, `total_units`, `submitted_at`, `registrar_decided_at`, `payment_confirmed_at`, `enrolled_at`, `created_at`, `updated_at`. **Omit `active_academic_term_id`** — MariaDB computes it.
2. Read back the inserted ids keyed by `student_id`, then insert `enrollment_subjects` in chunks of 2,000.
3. Insert `academic_grades` in chunks of 2,000 with `status='locked'`, `locked_at`, `encoded_by` set to the section's professor, `final_grade`, and `mark`.

Grade distribution, deterministic per `(student_number, subject_id, term)`: roughly 15% at 1.00–1.50, 45% at 1.75–2.25, 30% at 2.50–3.00, 10% marginal. Reuse the existing `GradeMark` domain value object rather than writing raw strings.

After all terms, recompute counters in one statement:

```sql
UPDATE sections s SET enrolled_count = (
  SELECT COUNT(*) FROM enrollment_subjects es
  WHERE es.section_id = s.id AND es.status <> 'dropped'
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Database/StudentRosterSeederTest.php --testdox`

Expected: PASS.

- [ ] **Step 5: Measure the real seed**

Run: `cd backend && php artisan migrate:fresh --seed`

Expected: completes without error. If it exceeds five minutes, add a `--chunk` option and raise the insert chunk sizes before optimizing anything else.

---

### Task 4: Derive ~10% irregular students from real failing marks

**Files:**
- Modify: `backend/database/seeders/StudentRosterSeeder.php`
- Modify: `backend/tests/Feature/Database/StudentRosterSeederTest.php`

**Interfaces:**
- ≈320 students (2nd–4th year only, spread across all four colleges) carry 1–3 `5.00` / `INC` / `NC` / `DRP` marks in completed ordinals.
- `enrollment_category` is derived by `ReclassifyStudentEnrollmentCategory`, never written by the seeder.

- [ ] **Step 1: Write the failing test**

```php
public function test_roughly_a_tenth_of_students_are_derived_as_irregular(): void
{
    (new StudentRosterSeeder($this->fixturePath()))->run();
    app(ReclassifyStudentEnrollmentCategory::class)->executeMany(StudentProfile::pluck('id')->all());

    $total = StudentProfile::count();
    $irregular = StudentProfile::where('enrollment_category', 'irregular')->count();

    $this->assertGreaterThan((int) ($total * 0.07), $irregular);
    $this->assertLessThan((int) ($total * 0.13), $irregular);
}

public function test_no_first_year_student_is_irregular(): void
{
    $this->assertSame(0, StudentProfile::where('year_level', 1)->where('enrollment_category', 'irregular')->count());
}

public function test_every_irregular_student_has_grade_evidence(): void
{
    foreach (StudentProfile::where('enrollment_category', 'irregular')->get() as $student) {
        $this->assertTrue(AcademicGrade::where('student_id', $student->id)
            ->whereIn('mark', ['5.00', 'INC', 'NC', 'DRP'])->exists());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Database/StudentRosterSeederTest.php --testdox --filter irregular`

Expected: FAIL — every seeded grade is passing.

- [ ] **Step 3: Implement irregular seeding**

Select every tenth student in the deterministic ordering, restricted to year levels 2–4, and rewrite 1–3 of their completed-ordinal grades to a failing mark. Vary the mark type so all four classifier branches are exercised, and place at least a few failures in the earliest completed term so a genuine multi-term backlog exists.

Then reclassify. `ReclassifyStudentEnrollmentCategory` requires a `semester_ongoing` term, and `AcademicTermSeeder` leaves none — so the seeder must handle both cases:

- If a `semester_ongoing` term exists, call `executeMany()` directly.
- Otherwise log a clear notice that classification is deferred, and document that `php artisan students:reclassify` must be run once the Registrar Head opens 2026-2027 2nd. The IT Control automation (Plan 5, step 4) also invokes it before enrolling.

The test above must arrange a `semester_ongoing` term so it can assert the derived result.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Database/StudentRosterSeederTest.php --testdox --filter irregular`

Expected: PASS.

---

### Task 5: Derive real section demand observations

Nothing currently populates `section_demand_observations` from real enrollments — only `SectionDemandObservationSeeder` (`source='local_synthetic_aggregate'`) and `PredictivePlanningInputSeeder` (`source='local_synthetic_planning_input'`). `GenerateSectionDemandForecasts` reads this table exclusively, so real students are invisible to the forecaster until this task lands.

**Files:**
- Create: `backend/app/Actions/Analytics/DeriveSectionDemandObservations.php`
- Create: `backend/tests/Feature/Actions/Analytics/DeriveSectionDemandObservationsTest.php`
- Create: `backend/app/Console/Commands/DeriveSectionDemandObservationsCommand.php`
- Modify: `backend/database/seeders/StudentRosterSeeder.php`

**Interfaces:**
- `DeriveSectionDemandObservations::execute(?AcademicTerm $term = null): int` — returns the number of upserted observations.
- `php artisan analytics:derive-demand-observations [--term=]`.

- [ ] **Step 1: Write the failing test**

```php
public function test_it_aggregates_real_enrollments_into_demand_observations(): void
{
    (new StudentRosterSeeder($this->fixturePath()))->run();

    $count = app(DeriveSectionDemandObservations::class)->execute();

    $this->assertGreaterThan(0, $count);
    $observation = SectionDemandObservation::where('source', 'derived_from_enrollments')->first();
    $this->assertNotNull($observation);
    $this->assertSame(
        EnrollmentSubject::whereHas('section', fn ($q) => $q
            ->where('academic_term_id', $observation->academic_term_id)
            ->where('subject_id', $observation->subject_id))->count(),
        $observation->enrolled_count,
    );
}

public function test_it_overwrites_synthetic_observations_for_the_same_key(): void { /* … */ }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Actions/Analytics/DeriveSectionDemandObservationsTest.php --testdox`

Expected: FAIL — the action does not exist.

- [ ] **Step 3: Implement the aggregation**

Group `enrollment_subjects` joined to `sections`, `enrollments`, `student_profiles`, `programs`, and `curricula` by `(academic_term_id, program_id, curriculum_id, subject_id, college, year_level)`, producing:

- `enrolled_count` — distinct students in that subject that term.
- `cohort_size` — distinct students at that `(program, year_level)` that term.
- `section_count` — distinct sections.
- `offered_capacity` — sum of section capacities.
- `source` — `'derived_from_enrollments'`.

Upsert on the existing unique key `(academic_term_id, program_id, curriculum_id, subject_id, year_level)` so derived rows replace synthetic ones. Run it as the last step of `StudentRosterSeeder`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Actions/Analytics/DeriveSectionDemandObservationsTest.php --testdox`

Expected: PASS.

- [ ] **Step 5: Full backend gate**

Run:
```
cd backend && vendor/bin/pint --test && vendor/bin/phpstan analyse && vendor/bin/phpunit --testdox
cd backend && php artisan migrate:fresh --seed
```

Expected: all green; the seed completes in under five minutes.

---

## Manual verification

1. `cd backend && php artisan migrate:fresh --seed`, then in `php artisan tinker`:

```php
StudentProfile::count();                                             // 3210 + 10 demo
User::where('role','student')->count();
Enrollment::count();                                                 // ~10,000
AcademicGrade::where('status','locked')->count();                    // ~90,000
Section::where('status','closed')->count();                          // ~5,000
SectionDemandObservation::where('source','derived_from_enrollments')->count();  // > 0
StudentProfile::where('enrollment_category','irregular')->count();   // ~320, after reclassify
```

2. Sign in as `s2301001@grc.test` / `password` and open the academic record — expect seven terms of locked grades.
3. Sign in as a student the classifier marked irregular and confirm the record shows the failing marks that caused it.
4. Sign in as Registrar Head, archive 2026-2027 1st, and open 2026-2027 2nd. Run `php artisan students:reclassify` and confirm the irregular count settles near 320.
5. As a Program Chair, trigger a schedule generation run and confirm the forecast rationale traces to observations with `source='derived_from_enrollments'`.
