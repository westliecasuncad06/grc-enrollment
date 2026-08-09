# GRC Dataset, Faculty Preference Rework, Enrollment UX, and IT Control Portal — Design

**Date:** 2026-08-09
**Status:** Approved for implementation
**Implementation plans:** five ordered plan documents in `docs/superpowers/plans/` (see [Decomposition](#decomposition))

---

## Problem

Four connected gaps block end-to-end testing of the AI schedule generation and automatic faculty appointment features.

**1. The professor Availability & Preferences workspace is broken.**
`frontend/src/features/schemas/faculty-schema.ts:90` declares `units: z.number().int().positive()` inside `curriculumSubjectSchema`. But `subjects.units` is `decimal(4,1)` cast to `float`, and 32 `LEAD*` catalog subjects carry **1.5 units** across 78 curriculum placements (`backend/database/seeders/data/organizations-subjects-prerequisites.csv`). `FacultyPreferenceCatalogController` emits those verbatim, so `facultyPreferenceCatalogEnvelopeSchema.safeParse` fails and `api-client.ts` raises `ApiClientError{kind:"contract"}`. The workspace then shows the generic "Faculty input could not be loaded." banner, the Curriculum select renders empty, and "Save subject preference" stays disabled. The existing unit test masks this — `faculty-input-workspace.test.tsx:41` mocks `units: 3`.

Two secondary defects compound it:
- `StoreFacultyAvailabilityRequest` applies `Rule::unique('faculty_availabilities')` scoped to `(professor_id, academic_term_id, day_of_week)` without excluding rows the seeders already wrote with `origin='workbook_seeded'`. A professor typing `08:00:00` on a seeded day gets "The starts at time has already been taken."
- The subject-preference form defaults `rank: 1` and resets to `1` after every save, while workbook-seeded rows already occupy ranks 1..N for that `(curriculum, semester)` — another guaranteed 422.
- No `FieldError` element is rendered for `day_of_week`, so a server message for that field is set but invisible.

**2. There is not enough data for predictive analytics.**
Only ~10 students are seeded (`DemoEnrollmentSeeder`). `section_demand_observations` — the sole historical table `GenerateSectionDemandForecasts` reads — is populated purely by synthetic formulas (`SectionDemandObservationSeeder`, `PredictivePlanningInputSeeder`). Nothing derives it from real enrollment records, so the forecasts are not grounded in anything.

**3. The student enrollment view is card-based and preference-blind.**
Regular students pick a block from a vertical list of radio cards (`enrollment-block-choice.tsx`); there is no table, no modal, and no way to express or apply a schedule preference. No student preference model exists anywhere in the schema.

**4. There is no IT control surface.**
Picking a test account means typing a numeric student ID into a text input (`registrar-grades-workspace.tsx`), because no student-list endpoint exists. Walking the full workflow — Program Chair generates → Dean approves → Executive Director publishes → students enroll → Registrar approves → Cashier confirms — requires six separate logins and thousands of clicks.

## Goal

A complete, deterministic local dataset (145 professors with full teaching profiles, 3,210 students with seven terms of real academic history), a fixed and restructured faculty preference workspace, a preference-aware table-driven enrollment UX, and an IT Control portal that can browse accounts and fast-forward the entire enrollment workflow with six buttons.

---

## Decisions

| Area | Decision | Rationale |
|---|---|---|
| Packaging | One spec, five ordered plan docs | Each is independently reviewable and testable; a single mega-plan loses coherence mid-execution |
| Student source of truth | `Subject And Prerequisuite/Students-Profile.md` written first, then parsed by a seeder | Mirrors the established `Professor_Department_List.md` → `WorkbookFacultyProfileSeeder` pattern; the roster stays human-readable and diffable |
| History depth | Full `sections` + `enrollments` + `enrollment_subjects` + `academic_grades` per term | Irregular classification is derived from real marks by `EnrollmentCategoryClassifier`; aggregate-only history cannot produce a genuine per-student backlog |
| History window | Seven terms, 2023-2024 1st through 2026-2027 1st, all populated | 2026-2027 1st has just concluded and stays `semester_closed`; the Registrar Head archives it manually to open 2026-2027 2nd, which is where the IT Control automation runs |
| Availability scoping | Drop `faculty_availabilities.academic_term_id` | Availability becomes a reusable professor profile, consistent with `faculty_curriculum_subject_preferences` which is already term-independent. Otherwise every professor re-enters their windows each semester |
| Weekend | Remove Sunday (`day_of_week = 7`) from availability | GRC does not schedule Sunday classes |
| Teaching capability | New `faculty_specializations` table, `(professor_id, subject_id, proficiency, source)` | Subject-scoped and curriculum-agnostic — this is exactly the question the assignment engine asks: "can this professor teach subject X?" Free-text tags would need a tag→subject mapping layer before the AI could use them |
| Irregular share | ~10% (≈320 students), derived, never hard-coded | `enrollment_category` is documented as automatically derived; writing it directly would desynchronize it from the grade evidence |
| IT portal identity | New `it_admin` role; write endpoints guarded to `local`/`testing` | One role per user (no pivot table); `users.role` is a plain VARCHAR so no migration is needed |

### Cohort mapping

The roster is the student body as of AY 2026-2027, after 2026-2027 1st semester has concluded.

| Year level | Entry year | Completed terms | Range |
|---|---|---|---|
| 4th | 2023-2024 | 7 | 2023-24 1st … 2026-27 1st |
| 3rd | 2024-2025 | 5 | 2024-25 1st … 2026-27 1st |
| 2nd | 2025-2026 | 3 | 2025-26 1st … 2026-27 1st |
| 1st / TCP | 2026-2027 | 1 | 2026-27 1st |

`AcademicTermSeeder` already creates exactly these seven terms. No new term rows are required.

### Section roster (107 sections × 30 students = 3,210)

| College | Year 1 | Year 2 | Year 3 | Year 4 | Other | Total |
|---|---|---|---|---|---|---|
| COE | EDUC101–107 (7) | ELEM201–203, FIL201, ENG201–202, SOCSCI201, VAL201 (8) | ELEM301–302, FIL301–302, ENG301, SOCSCI301, VAL301 (7) | ELEM401–402, ENG401–402 (4) | TCP101 (1) | 27 |
| CBAE | FM101–102, EN101, MM101–104, HR101–103 (10) | FM201–202, EN201, MM201–204, HR201–203 (10) | FM301–302, EN301, MM301–303, HR301–302 (8) | EN401, MM401–404, HR401–403 (8) | — | 36 |
| COA | ACC101–104 (4) | ACC201–203 (3) | ACC301–303 (3) | ACC401–403 (3) | — | 13 |
| CCS | IT101–109 (9) | IT201–208 (8) | IT301–307 (7) | IT401–407 (7) | — | 31 |
| **Total** | **30** | **29** | **25** | **22** | **1** | **107** |

Codes follow `SectionBlockCode::fromProgram()`'s `sprintf('%s%d%02d', $prefix, $yearLevel, $blockOrdinal)` format. Two normalizations apply:

- **`SOC 301` → `SOCSCI301`.** The source list abbreviates it; `SectionBlockCode::coePrefix()` emits `SOCSCI`.
- **`EDUC1xx` is a documented deviation.** COE runs a common first year, but no COE program code resolves to the `EDUC` prefix — `coePrefix()` only falls through to `EDUC` for an unrecognized code. The 210 first-year COE students are therefore distributed across BEED / BSED-FIL / BSED-ENG / BSED-SOCSCI / BSED-VAL in proportion to the second-year section split, while their section codes stay `EDUC101`–`EDUC107`, read verbatim from the roster file rather than computed. Sections for later terms use the computed per-major prefix.

---

## Decomposition

Five plans, executed in order. Plans 3–5 each depend on the one before it.

| # | Plan | Depends on |
|---|---|---|
| 1 | `2026-08-09-faculty-availability-and-subject-preferences-rework.md` | — |
| 2 | `2026-08-09-student-roster-profile-file.md` | — |
| 3 | `2026-08-09-student-accounts-and-academic-history-seed.md` | 1 (specializations pick historical professors), 2 (roster file) |
| 4 | `2026-08-09-student-schedule-preferences-and-enrollment-table-ui.md` | 3 (needs real students to test against) |
| 5 | `2026-08-09-it-control-portal.md` | 3, 4 (button 4 uses the preference scorer) |

---

## Architecture

### Plan 1 — Faculty availability and subject preferences

**Contract fix.** `curriculumSubjectSchema.units` becomes `z.number().nonnegative()`, matching the already-correct `frontend/src/features/schemas/reference-data-schema.ts:59`. A fixture in `faculty-input-workspace.test.tsx` moves to `1.5` so the mask cannot return.

**Availability becomes a profile.** A migration drops `academic_term_id` and its foreign key from `faculty_availabilities`, replaces the unique key `faculty_availability_unique_slot` with `(professor_id, day_of_week, starts_at_time)`, and deletes any `day_of_week = 7` rows. Validation narrows to `between:1,6`. `ScheduleDayParser::TOKENS` keeps its `Sun` entry — that parser reads workbook schedule strings and is unrelated.

**Collision handling.** `CreateFacultyAvailability` upserts over a `workbook_seeded` slot instead of rejecting it; the duplicate check applies only to `origin='declared'` rows. The subject-preference form derives its default rank from `max(rank) + 1` within `(professor, curriculum, semester)` rather than resetting to `1`.

**New capability model.** `faculty_specializations` holds `(professor_id, subject_id, proficiency, source, notes)` with a unique `(professor_id, subject_id)`. It becomes a third signal in `GenerateFacultyAssignmentRecommendations` alongside the existing `availability_match` and `preference_rank`.

**UI split.** `faculty-input-workspace.tsx` (892 lines) becomes a `Tabs` shell over three panels — `faculty-availability-panel.tsx`, `faculty-subject-preference-panel.tsx`, and the existing teaching-history table. Everything about subject preferences — curriculum, semester, subject, rank, proficiency, filter, and the full list — lives inside the second panel. The grey quick-action bar, whose two buttons only move focus, is removed.

**Seeding.** `WorkbookFacultyProfileSeeder` extends to give all 145 professors deterministic availability (full-time: 5 days × 8h; part-time: 3 days × 4h; Mon–Sat only), 5–8 ranked preferences per `(curriculum, semester)` in their college, and 4–10 specializations drawn from `faculty_teaching_histories` evidence where available. The 55 `Coaches` / `Unidentified` entries carry no `CollegeCode` and receive PE / NSTP / general-education subjects only.

### Plan 2 — Roster file

A new artisan command `students:generate-roster-file` writes `Subject And Prerequisuite/Students-Profile.md` deterministically from a hard-coded section map. It is re-runnable and carries the same `local`/`testing` guard every seeder uses. A `--check` flag verifies the committed file matches what the generator produces.

**Identity format.** Student numbers are `YYYY-06-NNNNN`, satisfying `StoreStudentProfileRequest`'s `/^\d{4}-(0[1-9]|1[0-2])-\d{5}$/`, with sequences starting at `01001` so they cannot collide with `DemoEnrollmentSeeder`'s `2023-06-00001..00008`, `2023-06-00100`, or `2024-06-00101`. Emails are `s{yy}{seq5}@grc.test` — an 8-character local part, unique by construction, obviously synthetic, and short as requested. All passwords are `password`, matching `RoleUserSeeder`.

**File layout.** A header, the summary tables (per-college, per-year-level, and the 107/3,210 total), the roster tables grouped College → Year → Section with columns `Student No. | Name | Email | Program | Section | Year | Category`, and a footer. The roster tables are the parse target for Plan 3.

### Plan 3 — Accounts and history

A new `StudentRosterSeeder` parses the roster file and writes, in order:

1. **Accounts.** `users` (role `student`, status `active`) and `student_profiles` with `entry_year`, `year_level`, `program_id`, the active 2024-2029 `curriculum_id`, and `enrollment_category` left null.
2. **Historical sections.** For each of the seven terms, the term's section roster is derived by walking each cohort's year level backwards. Rows land in `academic_term_section_plans` and `sections` (`status=closed`, `is_block_exclusive=true`, `capacity=40`), with professors drawn from `faculty_specializations` so the teaching history is coherent.
3. **Enrollments, subjects, grades.** One `enrollments` row per student per completed term (`status=enrolled`, full timestamp trail), one `enrollment_subjects` row per block subject, and one locked `academic_grades` row per subject.
4. **Irregular derivation.** ≈320 students across 2nd–4th year receive 1–3 `5.00` / `INC` / `NC` / `DRP` marks in completed ordinals. `ReclassifyStudentEnrollmentCategory::executeMany()` then derives `enrollment_category`; it is never written directly.
5. **Real demand observations.** A new `DeriveSectionDemandObservations` action aggregates the seeded enrollments into `section_demand_observations` with `source='derived_from_enrollments'`, upserted over the synthetic rows so `HistoricalCohortResolver` has real history to resolve against.

**Constraints that shape the implementation.** `subjects` is unique on `(college, code)` — 41 general-education codes repeat across colleges, so every subject lookup must be college-scoped or grade history cross-links to the wrong subject and misclassifies students. `enrollments.active_academic_term_id` is a stored generated column and is not fillable. `sections.enrolled_count` is a manually maintained counter and must be recomputed after bulk insertion. Volume is roughly 10k enrollments, 90k enrollment subjects, and 90k grades, so writes use chunked `DB::table()->insert()` rather than Eloquent.

### Plan 4 — Student schedule preferences and enrollment UX

A `student_schedule_preferences` table (one row per student) holds `preferred_days` (JSON, 1–6), `preferred_time_block`, `preferred_modality`, `max_days_on_campus`, `avoid_early_first_class`, and `notes`, exposed as a self-scoped `GET`/`PUT` pair.

`SchedulePreferenceScorer` scores a candidate block or section set against those preferences and returns a numeric score plus human-readable reasons. `BuildEnrollmentBlockPool` and `BuildEligibleSubjectPool` attach `preference_score` and `preference_reasons` as **optional** fields. Preferences rank options; they never gate a seat, and a student with no preferences sees the pool unchanged.

The enrollment workspace becomes table-driven. Regular students see a `DataTable` of sections (Section, Subjects, Units, Days, Time range, Seats, Preference match) and confirm inside a modal that shows the full weekly schedule. Irregular students keep the per-subject pool but gain a filter bar (day, time block, professor, subject). Both paths get an "Apply my preferences" toggle that sorts by `preference_score`.

### Plan 5 — IT Control portal

**Role.** `UserRole::ItAdmin`. Both `label()` and `isLearnerScoped()` are exhaustive `match` expressions and will throw `UnhandledMatchError` without new arms. `RoleUserSeeder::IDENTITIES` is keyed by role slug and fatals on a missing entry. On the frontend, `roles.ts` feeds a `z.enum()` inside a `.strict()` `userSchema` — an unknown role from `/auth/me` is a hard contract violation that blanks the portal, so the mirror must move in lockstep.

**Account browsers.** No student-list endpoint exists (`ApiSurfaceTest` proves the route surface), and `GET /faculty-members` is chair-only, college-scoped, and unpaginated. Two new endpoints — `GET /api/v1/it-control/students` and `GET /api/v1/it-control/faculty` — follow the `ListAuditLogs` shape exactly: an `IndexRequest`, an Action with a `->when()` filter chain, a paginated Resource collection, and `Cache-Control: no-store, private`.

**Workflow automation.** An `it_control_automation_runs` table (mirroring `schedule_generation_runs`) tracks each step's status and counters. `POST /api/v1/it-control/automation-runs` accepts a `step` and dispatches a job; `GET .../{run}` polls it. With `QUEUE_CONNECTION=sync` the job runs inline, so the UI must tolerate both an immediately-complete run and a queued one.

The six steps call the real audited Actions rather than writing statuses directly — unlike `EnrollmentOpenDemoSeeder`, which deliberately skips the approval chain and is explicitly not a substitute for it:

| # | Step | Mechanism |
|---|---|---|
| 1 | Program Chair generates sections | Per college: `POST schedule-generation-runs` → `GenerateSectionDemandForecasts` → `ApplyDemandForecastToDraft` → `GenerateFacultyAssignmentRecommendations`, then `SaveSectionPlan::submit()` |
| 2 | Dean approves all | `dean_approve` on every `draft` proposal |
| 3 | Executive Director publishes all | `publish` on every `dean_approved` proposal. There is no `executive_approve` — it was removed from `ScheduleProposalTransitionRules` |
| 4 | Students auto-enroll | `SubmitEnrollment` with the highest-scoring block (regular) or prerequisite-ranked eligible subjects (irregular) |
| 5 | Registrar Staff approves all | `TransitionEnrollment` `registrar_approve` → queue ticket + `AssessEnrollment` |
| 6 | Cashier confirms all payments | `ConfirmPayment` → `enrolled` + COM document |

**Safety.** Every `it-control/*` write endpoint applies the same `app()->environment(['local','testing'])` guard the seeders use, returning 403 otherwise. Read-only browsers require only `role:it_admin`.

---

## Testing

Each plan carries its own gate: `vendor/bin/phpunit --testdox`, `vendor/bin/pint --test`, `vendor/bin/phpstan analyse` for the backend; `npm run lint`, `npx tsc --noEmit`, `npm run test` for the frontend; Playwright after Plan 5.

Repository conventions that constrain the tests:

- **No Eloquent factories exist.** All fixtures are seeder-based, using `updateOrCreate` and a `local|testing` environment guard.
- **`Sanctum::actingAs` is never used.** Tests mint a real token (`$user->createToken(...)->plainTextToken`) and send it with `withToken()`. `makeUser`/`tokenFor` helpers are private per test file; `tests/TestCase.php` is empty.
- **`ApiSurfaceTest` asserts the exact sorted route list.** Every new endpoint must be registered there.
- **Frontend workspace tests follow a three-test template**: happy path with fetch-URL assertions, unauthorized role rendering the guard with zero fetches, and an axe pass. `renderWithSession` supplies a fixed auth state.
- Role-matrix tests iterate `UserRole::cases()`, so a new role is automatically asserted as forbidden everywhere — the desired default. But `UserRoleTest` and `RoleUserSeederTest` pin the count and must be updated.

End-to-end verification after all five plans:

1. `php artisan migrate:fresh --seed` completes cleanly in under five minutes.
2. `php artisan students:generate-roster-file --check` reports no diff.
3. A professor login reaches `/portal/availability-preferences`, sees three populated tabs with no error banner, and can save a new availability window and a new subject preference without a 422.
4. An `it_admin` login filters Student Information to CCS 3rd-year irregular students and gets rows.
5. As Registrar Head, archiving 2026-2027 1st opens 2026-2027 2nd.
6. As `it_admin`, the six buttons run in sequence and every one of the 3,210 students ends `enrolled` with a COM.
7. A regular student sees a table and a modal picker; an irregular student's filters and preference toggle work.
8. Program Chair predictive section counts trace to `source='derived_from_enrollments'` observations.

## Risks

- **The ML service must be running** at `http://127.0.0.1:8100` (`GRC-ENROLLMENT/ml-service`) before step 1. If it is offline the run must fail cleanly with a readable warning rather than hanging.
- **Seed runtime.** 190k+ rows is the largest write this repository has attempted. If `migrate:fresh --seed` exceeds five minutes, `StudentRosterSeeder` gains a `--chunk` option and the history depth becomes configurable.
- **Working tree.** Twenty-four modified files (curriculum and grades work) are uncommitted. They should be committed or stashed before Plan 1 begins so each plan's diff is reviewable in isolation.
