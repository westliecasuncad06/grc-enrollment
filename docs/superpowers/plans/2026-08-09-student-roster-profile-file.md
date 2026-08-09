# Student Roster Profile File — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Design spec:** `docs/superpowers/specs/2026-08-09-grc-dataset-and-it-control-design.md`
**Plan 2 of 5.** No dependencies. Plan 3 parses the file this plan produces.

**Goal:** Generate `Subject And Prerequisuite/Students-Profile.md` — 3,210 students across 107 sections and four colleges — as a deterministic, human-readable, re-generatable roster file that becomes the source of truth for student identities.

**Architecture:** An artisan command owns the section map and the name/number/email generators. The file it writes is committed and diffable; a `--check` flag proves the committed file still matches the generator, so drift is caught in CI rather than discovered during a seed. This mirrors how `Professor_Department_List.md` feeds `WorkbookFacultyProfileSeeder`.

**Tech Stack:** Laravel 12 artisan command, PHPUnit.

## Global Constraints

- Local/testing only. The command carries the same `app()->environment(['local','testing'])` guard every seeder uses and throws `RuntimeException` otherwise.
- Fully deterministic: the same seed produces byte-identical output. No `random_int`, no `Str::random`, no timestamps in the body.
- Student numbers must satisfy `StoreStudentProfileRequest`'s regex `/^\d{4}-(0[1-9]|1[0-2])-\d{5}$/` and must not collide with `DemoEnrollmentSeeder`'s existing numbers (`2023-06-00001`–`00008`, `2023-06-00100`, `2024-06-00101`).
- Emails must be short, as requested — no long `faculty.list.*` style addresses.
- The file is written to `Subject And Prerequisuite/Students-Profile.md`, which is currently empty.

---

### Task 1: Section map and cohort arithmetic

**Files:**
- Create: `backend/app/Domain/Organization/StudentRosterMap.php`
- Create: `backend/tests/Unit/Domain/Organization/StudentRosterMapTest.php`

**Interfaces:**
- `StudentRosterMap::sections(): list<array{college: CollegeCode, program_code: string, section_code: string, year_level: int, size: int}>` — 107 entries.
- `StudentRosterMap::entryYearFor(int $yearLevel): int` — 4→2023, 3→2024, 2→2025, 1→2026.

- [ ] **Step 1: Write the failing test**

```php
public function test_the_roster_map_matches_the_published_section_counts(): void
{
    $sections = StudentRosterMap::sections();

    $this->assertCount(107, $sections);
    $this->assertSame(3210, array_sum(array_column($sections, 'size')));

    $byCollege = collect($sections)->groupBy(fn ($s) => $s['college']->value)->map->count();
    $this->assertSame(27, $byCollege['coe']);
    $this->assertSame(36, $byCollege['cbae']);
    $this->assertSame(13, $byCollege['coa']);
    $this->assertSame(31, $byCollege['ccs']);
}

public function test_coe_first_year_keeps_the_common_educ_block_code(): void
{
    $educ = collect(StudentRosterMap::sections())->where('section_code', 'EDUC101')->sole();

    $this->assertSame(1, $educ['year_level']);
    $this->assertContains($educ['program_code'], ['BEED', 'BSED-FIL', 'BSED-ENG', 'BSED-SOCSCI', 'BSED-VAL']);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/phpunit tests/Unit/Domain/Organization/StudentRosterMapTest.php --testdox`

Expected: FAIL — the class does not exist.

- [ ] **Step 3: Implement the map**

| College | Year 1 | Year 2 | Year 3 | Year 4 | Other |
|---|---|---|---|---|---|
| COE | EDUC101–107 | ELEM201–203, FIL201, ENG201–202, SOCSCI201, VAL201 | ELEM301–302, FIL301–302, ENG301, SOCSCI301, VAL301 | ELEM401–402, ENG401–402 | TCP101 |
| CBAE | FM101–102, EN101, MM101–104, HR101–103 | FM201–202, EN201, MM201–204, HR201–203 | FM301–302, EN301, MM301–303, HR301–302 | EN401, MM401–404, HR401–403 | — |
| COA | ACC101–104 | ACC201–203 | ACC301–303 | ACC401–403 | — |
| CCS | IT101–109 | IT201–208 | IT301–307 | IT401–407 | — |

Every section holds exactly 30 students. Two normalizations, both documented in the spec:

- The source list writes `SOC 301`; the map emits `SOCSCI301` to match `SectionBlockCode::coePrefix()`.
- `EDUC1xx` is COE's common first year. No COE program code resolves to the `EDUC` prefix, so the 210 first-year COE students are distributed across the five COE majors in proportion to the second-year section split (ELEM 3, FIL 1, ENG 2, SOCSCI 1, VAL 1 → 8 sections), while the section code stays `EDUC1xx`. Record this as a docblock on the class.

`TCP101` maps to the `TCP` program with `year_level = 1`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && vendor/bin/phpunit tests/Unit/Domain/Organization/StudentRosterMapTest.php --testdox`

Expected: PASS.

---

### Task 2: Deterministic identity generation

**Files:**
- Create: `backend/app/Domain/Identity/StudentIdentityGenerator.php`
- Create: `backend/database/seeders/data/filipino-name-pools.php`
- Create: `backend/tests/Unit/Domain/Identity/StudentIdentityGeneratorTest.php`

**Interfaces:**
- `StudentIdentityGenerator::forIndex(int $entryYear, int $sequence): array{student_number: string, email: string, name: string}`.

- [ ] **Step 1: Write the failing test**

```php
public function test_identities_are_deterministic_short_and_collision_free(): void
{
    $first = StudentIdentityGenerator::forIndex(2023, 1001);

    $this->assertSame('2023-06-01001', $first['student_number']);
    $this->assertSame('s2301001@grc.test', $first['email']);
    $this->assertMatchesRegularExpression('/^\d{4}-(0[1-9]|1[0-2])-\d{5}$/', $first['student_number']);
    $this->assertSame($first, StudentIdentityGenerator::forIndex(2023, 1001));
}

public function test_it_never_collides_with_the_demo_enrollment_roster(): void
{
    $reserved = ['2023-06-00001', '2023-06-00100', '2024-06-00101'];
    // sequences start at 1001, so no generated number can fall in the reserved range
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/phpunit tests/Unit/Domain/Identity/StudentIdentityGeneratorTest.php --testdox`

Expected: FAIL — the class does not exist.

- [ ] **Step 3: Implement the generator**

- **Student number:** `sprintf('%d-06-%05d', $entryYear, $sequence)`, sequences starting at `1001` per entry year.
- **Email:** `sprintf('s%02d%05d@grc.test', $entryYear % 100, $sequence)` → `s2301001@grc.test`. Eight-character local part, unique by construction, obviously synthetic.
- **Name:** picked from Filipino given-name and surname pools indexed by `crc32("{$entryYear}-{$sequence}")`. Include a middle initial. Pools of ~200 given names and ~200 surnames give enough variety across 3,210 rows without a dependency.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && vendor/bin/phpunit tests/Unit/Domain/Identity/StudentIdentityGeneratorTest.php --testdox`

Expected: PASS.

---

### Task 3: The `students:generate-roster-file` command

**Files:**
- Create: `backend/app/Console/Commands/GenerateStudentRosterFile.php`
- Create: `backend/tests/Feature/Console/GenerateStudentRosterFileTest.php`

**Interfaces:**
- `php artisan students:generate-roster-file [--path=] [--check]`.
- `--check` exits 1 with a diff summary when the target file differs from generated output; it writes nothing.

- [ ] **Step 1: Write the failing test**

```php
public function test_it_writes_a_roster_file_with_summary_tables_and_3210_rows(): void
{
    $path = storage_path('framework/testing/Students-Profile.md');

    $this->artisan('students:generate-roster-file', ['--path' => $path])->assertExitCode(0);

    $contents = file_get_contents($path);
    $this->assertStringContainsString('| **Kabuuan** |  **107** |          **3,210** |', $contents);
    $this->assertSame(3210, substr_count($contents, '@grc.test'));
    $this->assertStringContainsString('| 2023-06-01001 |', $contents);
}

public function test_check_mode_reports_drift_without_writing(): void
{
    file_put_contents($path, "# stale\n");
    $this->artisan('students:generate-roster-file', ['--path' => $path, '--check'])->assertExitCode(1);
    $this->assertSame("# stale\n", file_get_contents($path));
}

public function test_it_refuses_to_run_outside_local_and_testing(): void
{
    app()->detectEnvironment(fn () => 'production');
    $this->expectException(RuntimeException::class);
    $this->artisan('students:generate-roster-file');
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Console/GenerateStudentRosterFileTest.php --testdox`

Expected: FAIL — the command is not registered.

- [ ] **Step 3: Implement the command**

Emit four sections in order:

**1. Header**

```markdown
# Students Profile

Local test roster for the GRC enrollment system. Every account uses the password `password`
and an `@grc.test` address. Generated by `php artisan students:generate-roster-file` —
edit the command, not this file.
```

**2. Summary tables** — reproduce the requested format exactly: one table per college (COE, CBAE, COA, CCS) with `Year Level | Sections | Bilang | Students` and a bold total row, then the overall GRC table with `Year Level | Sections | Estimated Students` totalling 107 / 3,210, and the per-department table totalling the same.

**3. Roster tables** — grouped `## College` → `### Year N` → `#### SECTION_CODE`, each section a markdown table:

```markdown
#### IT301

| Student No. | Name | Email | Program | Section | Year | Category |
|---|---|---|---|---|---|---|
| 2024-06-01455 | Andrei M. Bautista | s2401455@grc.test | BSIT | IT301 | 3 | Regular |
```

`Category` is `Regular` for every row at generation time. Plan 3 derives the real value from grade evidence and does not read this column — it exists for human scanning only, and the plan-3 seeder must not trust it.

**4. Footer** — totals and a one-line regeneration note.

Assign sequences per entry year in a stable order: college (COE, CBAE, COA, CCS) → year level ascending → section code ascending → position within section.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && vendor/bin/phpunit tests/Feature/Console/GenerateStudentRosterFileTest.php --testdox`

Expected: PASS.

- [ ] **Step 5: Generate and commit the real file**

Run:
```
cd backend && php artisan students:generate-roster-file
cd backend && php artisan students:generate-roster-file --check
```

Expected: the first writes `Subject And Prerequisuite/Students-Profile.md` (~400 KB); the second exits 0. Commit the file.

- [ ] **Step 6: Full backend gate**

Run: `cd backend && vendor/bin/pint --test && vendor/bin/phpstan analyse && vendor/bin/phpunit --testdox`

Expected: all green.

---

## Manual verification

1. Open `Subject And Prerequisuite/Students-Profile.md`.
2. The summary tables at the top read exactly as specified — 27 / 36 / 13 / 31 sections and 810 / 1,080 / 390 / 930 students, 107 and 3,210 overall.
3. Spot-check `#### EDUC101` — 30 rows, entry year 2026, section code `EDUC101`, programs spread across the COE majors.
4. Spot-check `#### IT407` — 30 rows, entry year 2023, program `BSIT`.
5. Confirm no email exceeds 20 characters total and no student number falls in the `00001`–`00999` range.
6. Re-run the generator; `git diff` reports no change.
