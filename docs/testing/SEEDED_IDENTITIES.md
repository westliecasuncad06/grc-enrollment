# Seeded Development Identities

**Scope:** Local development and automated tests only.
**Sources:** `backend/database/seeders/RoleUserSeeder.php` and
`backend/database/seeders/CollegeProgramChairSeeder.php`

These are **database fixtures**, not production accounts. They exist so every
PRD role can be exercised against real Sanctum authentication during
development. Every synthetic login uses the shared password `password`.

## These are now the only sign-in credentials

A second, UI-only set once existed in `docs/testing/DEMO_CREDENTIALS.md`: nine
hardcoded frontend fixtures with a committed shared password, used when the SPA
ran in a `demo` auth mode without a backend. **Both the file and that auth mode
were deleted in the Next.js migration** (roadmap Phase 3, ADR 0013) — they
predated real Sanctum authentication, and porting their environment guard to
Next.js risked making a committed password valid in a production build.

The identities below are the primary role-based sign-ins.

## The nine identities

One per PRD role. Names and emails are deterministic; reseeding updates these
rows in place rather than creating duplicates.

| Role | Name | Email |
|---|---|---|
| `student` | Seed Student | `student.seed@grc.test` |
| `admission_staff` | Seed Admission Staff | `admission.seed@grc.test` |
| `faculty` | Testing Faculty | `faculty.seed@grc.test` |
| `program_chair` | Seed Program Chair | `chair.seed@grc.test` |
| `dean` | Seed Dean | `dean.seed@grc.test` |
| `executive_director` | Seed Executive Director | `executive.seed@grc.test` |
| `registrar_head` | Seed Registrar Head | `registrar-head.seed@grc.test` |
| `registrar_staff` | Seed Registrar Staff | `registrar-staff.seed@grc.test` |
| `accounting_staff` | Seed Accounting Staff | `accounting.seed@grc.test` |

All are created with status `active`. Emails use the reserved `.test` TLD
(RFC 2606), so they can never resolve to a real mailbox.

## College-specific Program Chair identities

`CollegeProgramChairSeeder` creates one additional active Program Chair for
each supported college. These accounts are additive: the generic
`chair.seed@grc.test` identity above remains available.

| College | Name | Email | Password |
|---|---|---|---|
| College of Computer Studies (CCS) | Seed Program Chair — College of Computer Studies | `chair.ccs@grc.test` | `password` |
| College of Education (COE) | Seed Program Chair — College of Education | `chair.coe@grc.test` | `password` |
| College of Accountancy (COA) | Seed Program Chair — College of Accountancy | `chair.coa@grc.test` | `password` |
| College of Business Administration and Entrepreneurship (CBAE) | Seed Program Chair — College of Business Administration and Entrepreneurship | `chair.cbae@grc.test` | `password` |

All four use the same local/testing-only shared password: `password`.

## The password

All synthetic identities use:

```text
password
```

This deliberately guessable credential is permitted only because
`RoleUserSeeder`, `CollegeProgramChairSeeder`, and `DemoEnrollmentSeeder`
refuse to run outside Laravel's `local` and `testing` environments. Laravel
hashes the value before storing it; the database never contains the plain-text
password.

## Additional student scenarios

**Source:** `backend/database/seeders/DemoEnrollmentSeeder.php`. Eight
student logins with real locked grade history spanning year 1 semester 1
through year 4 semester 2, on a dedicated demo curriculum ("BSIT Grade
History Demo 2026", program `BSIT-DEMO`). `enrollment_category`
(Regular/Irregular) is **never hard-coded** here — every seed run writes the
locked grades, then runs the real `EnrollmentCategoryClassifier` against
them, so the category shown below is the classifier's own verdict, not an
assumption. None of the eight carry an enrollment for the current term —
every one is free to submit a real, fresh enrollment through the UI/API.

| # | Email | Year | Category | Completed semesters | What makes them Irregular |
|---|---|---|---|---|---|
| 0001 | `student.seed@grc.test` | 1st | Regular | 1 | — |
| 0002 | `student2.seed@grc.test` | 2nd | Regular | 3 | — |
| 0003 | `student3.seed@grc.test` | 3rd | Regular | 5 | — |
| 0004 | `student4.seed@grc.test` | 4th | Regular | 7 | — |
| 0005 | `student5.seed@grc.test` | 2nd | Irregular | 3 | `5.00` (Failed) on MATH101 |
| 0006 | `student6.seed@grc.test` | 2nd | Irregular | 3 | `INC` (Incomplete) on CS201 |
| 0007 | `student7.seed@grc.test` | 3rd | Irregular | 5 | `NC` (Not Complete) on LEAD 3 |
| 0008 | `student8.seed@grc.test` | 4th | Irregular | 7 | CS401 never graded (missing required subject) |

All eight use the shared password `password`.

A year-Y student has `(Y-1)*2 + 1` completed curriculum ordinals
(`SemesterSlot::ordinal()`), always right-aligned to the most recent closed
term — a year-4 student's 7 completed ordinals use all 7 non-ongoing terms
1:1; shorter histories use however many of the most recent terms they need.
Every locked grade is recorded with `section_id = null` (no owning section
for historical results).

## 10 connected professor identities

**Source:** `backend/database/seeders/DemoEnrollmentSeeder.php`. Every block
section generated for the four regular seeded students (see above) used to be
owned by the single `faculty.seed@grc.test` account. Since then, each of the
10 distinct subjects those blocks offer (`BLOCK_SUBJECTS_BY_YEAR`) has its own
real professor — a genuine 1:1 mapping, exactly like a real department: one
instructor teaching every block's section of their own course.

| Subject | Name | Email |
|---|---|---|
| CS201 | Ramon Bautista | `prof.bautista@grc.test` |
| MATH102 | Teresa Villanueva | `prof.villanueva@grc.test` |
| GE102 | Christian Dela Cruz | `prof.dela-cruz@grc.test` |
| LEAD 2 | Angelica Reyes | `prof.reyes@grc.test` |
| CS301 | Michael Santos | `prof.santos@grc.test` |
| LEAD 4 | Josephine Mendoza | `prof.mendoza@grc.test` |
| CS303 | Ferdinand Aquino | `prof.aquino@grc.test` |
| LEAD 6 | Grace Manalo | `prof.manalo@grc.test` |
| CS402 | Rafael Torres | `prof.torres@grc.test` |
| LEAD8 | Cecilia Fernandez | `prof.fernandez@grc.test` |

All 10 use the shared password `password`, role `faculty`, college CCS. Each
one also has a declared weekday (Mon–Fri, 08:00–17:00) `FacultyAvailability`
window covering every `BLOCK_SCHEDULES` slot their sections meet at, and a
rank-1 `FacultySubjectPreference` for their own subject — real Faculty Input
rows, not just a `professor_id` pointer, so logging in as any of them shows a
genuine Teaching Schedule, Class Roster, and Grade Submission workspace.

### Why not the whole 211-professor catalog

`CatalogFacultySeeder` seeds 206 real-named faculty from the CCS CSV catalog,
but only a handful of them declare any availability — most render "No
availability declared" in the Faculty Assignment workspace, since that CSV
carries no availability data. The 10 identities above are the ones this
project actually exercises end to end for teaching-side workflows.

### Why a dedicated curriculum (`BSIT-DEMO`)

`CatalogCurriculumPlacementSeeder` dumps the real ~103-subject CCS catalog
onto **every** active curriculum whose program has a college set — that
includes the older synthetic "BSCS Curriculum 2026" and the real "BSIT 2026
Curriculum". An earlier version of this roster lived on a college-bearing
program and every student came back Irregular: the importer had silently
added dozens of ungraded "required" subjects on top of it. The fix is
`BSIT-DEMO`, a deliberately collegeless program (`college = null`), which
the importer skips entirely — its curriculum stays exactly the 22
placements `DemoEnrollmentSeeder` seeds grades for. Renamed from `BSCS-DEMO`
at the product owner's request — the demo roster represents BSIT students,
not BSCS.

## Running the seeder

```powershell
cd backend
php artisan db:seed --class=RoleUserSeeder
```

Seed the four college-specific Program Chair accounts directly:

```powershell
php artisan db:seed --class=CollegeProgramChairSeeder
```

Or seed everything registered in `DatabaseSeeder`:

```powershell
php artisan db:seed
```

## Safety guarantees

The identity seeders are covered by
`backend/tests/Feature/Database/RoleUserSeederTest.php` and
`backend/tests/Feature/Database/CollegeProgramChairSeederTest.php`, which
assert that they:

- create exactly one active user per role, with unique `@grc.test` emails;
- store only a bcrypt hash, never the plain-text password;
- give every synthetic login the shared development password `password`;
- are idempotent — reseeding updates the same rows, creating no duplicates;
- never delete unrelated users;
- throw rather than seeding anything outside the `local` and `testing`
  environments, even when invoked programmatically.

Laravel's own `db:seed` production confirmation prompt provides a second,
independent layer of protection at the command level.

## Seeded programs and academic terms

**Source:** `backend/database/seeders/ProgramSeeder.php` and
`AcademicTermSeeder.php`. Same `local`/`testing`-only guarantee as above, and
covered the same way by
`backend/tests/Feature/Database/ReferenceDataSeederTest.php`. This is a small
**synthetic** catalog for exercising authorization and the reference-data
endpoints — not the real GRC program catalog or term calendar.

| Program code | Name | Status | College |
|---|---|---|---|
| `BSIT` | BS Information Technology | `active` | CCS |
| `BSCS` | BS Computer Science | `active` | CCS |
| `BSCRIM` | BS Criminology | `inactive` | — |
| `BSIT-DEMO` | BS Information Technology (Grade History Demo) | `active` | — (deliberate, see below) |

| School year | Semester | Status |
|---|---|---|
| `2023-2024` | `1st` | `archived` |
| `2023-2024` | `2nd` | `archived` |
| `2024-2025` | `1st` | `archived` |
| `2024-2025` | `2nd` | `archived` |
| `2025-2026` | `1st` | `archived` |
| `2025-2026` | `2nd` | `archived` |
| `2026-2027` | `1st` | `semester_closed` — gives `DemoEnrollmentSeeder` a closed term for the most recent locked grades |
| `2026-2027` | `2nd` | `semester_ongoing` — **the current term.** Every enrollment-audience window (year 1–4, Irregular) is already open (opens a few days in the past, closes about two weeks out), so any seeded student can submit a real fresh enrollment immediately after seeding — no fast-forwarding step required. |

**Amendment to ADR 0018/0020:** a clean seed now leaves the current term
already `semester_ongoing` with published, selectable sections (see
`SectionSeeder`) — not Draft. This was a deliberate priority change for the
grading/enrollment-completion slice: the primary ask was "let me test
enrolling as these students right now," which a Draft term can't satisfy
without extra manual steps. A Registrar Head can still create a fresh Draft
term at any time through the ordinary archive-and-create-next flow to test
the Program Chair schedule-authoring pipeline separately.
