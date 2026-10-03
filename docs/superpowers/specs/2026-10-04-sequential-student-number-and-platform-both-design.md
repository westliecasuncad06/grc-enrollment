# Sequential Student Number, "Already Has a Student Number", and Platform "Both" — Design Spec

**Status:** Approved by the owner (2026-10-04) and implemented the same day (see `PROGRESS.md` and ADR 0042). Two refinements were made while planning and implementing: the counter row is created lazily from the highest existing number instead of being seeded by the migration, and the skip check is on the suffix across all months of the year.
**Related:** ADR 0041 (Admission chooses category and type), stakeholder Doc 14 (COR platform), PRD §3.2 (provisioning) and the `student_number` unique rule (PRD line ~969). A new ADR 0042 and a PRD amendment come with the implementation.
**Branch:** work happens on `main`. `system-for-defense` stays frozen as the defense snapshot.

## Context

The owner's recommendations (Taglish, paraphrased):

1. In the Registrar's platform picker, add a third option for **Both** Face-to-Face and Online.
2. Student numbers must be **sequential**, generated through the database, and still read **Year-Month-Sequential**. The Generate button must go away because the number is now sequential.
3. In the Admission portal, add an option for a student who **already has a student number**, using the most accurate term and aligned with the rest of the system.

### What exists today (verified in code)

- **Platform:** `academic_terms.enrollment_platform` is a plain nullable string (`VARCHAR(20)`), validated in the application against `App\Domain\Enrollment\EnrollmentPlatform` (`online`, `face_to_face`). The Registrar Head sets one value per term in `enrollment-schedule-card.tsx`; the COR prints `enrollment_platform?->label()` (`BuildCorSnapshot`). It is not the per-section `SectionModality`.
- **Student number:** generated in the **browser** by `frontend/src/features/lib/student-number.ts` as `YYYY-MM-` plus `Math.random()`, so it is not sequential. The Create Account field is read-only with a **Generate** button that re-rolls it. `StoreStudentProfileRequest` requires `student_number`, validates `^\d{4}-(0[1-9]|1[0-2])-\d{5}$` and `unique:student_profiles,student_number`; `ProvisionStudent` writes it unchanged. The browser's local time decides the year and month.
- **Existing numbers** (read from the committed dump, 6,379 rows): 3,219 `YYYY-06-NNNNN` (2023: 00001-01660, 2024: 00101-01750, 2025: 01001-01870, 2026: 01001-01930), 3,000 `HIST-YYYY-NNNNN`, and about 160 `TEST-...`. Every `YYYY-MM-NNNNN` number has month 06.
- **Student types** (ADR 0041): Freshman, Transferee, Returnee, Existing Student. Returnee and Existing Student are the types that "have records at the school".
- The app timezone is `UTC`; the codebase already uses `Asia/Manila` for school-facing dates (`CorDisplay`, `QueueServiceDate`).

## Decisions

| Decision | Choice |
|---|---|
| Sequence scope | **One counter per year**, continuing across months. The month is the month of creation. It restarts at 00001 each January. (Owner picked this over reset-per-month and a single forever counter.) |
| Where the number is made | **The server**, inside the provisioning transaction. The browser never makes a number. |
| Generate button | **Removed entirely**, together with `student-number.ts`. |
| Year and month source | `Asia/Manila` current date, not UTC and not the browser. |
| Existing numbers | **Not renumbered.** They are printed on CORs and grades and used by the defense data. |
| Existing-number option | Allowed only for **Returnee** and **Existing Student** (see "To confirm"). |
| Platform label | `Both (Face-to-Face and Online)`, value `both`. No migration. |

## Change 1 — Platform "Both" (bounded)

- `EnrollmentPlatform` gains `case Both = 'both'` with label `Both (Face-to-Face and Online)`. `Rule::enum(EnrollmentPlatform::class)` in `UpdateEnrollmentScheduleRequest` accepts it automatically; `AcademicTermResource`, `SaveEnrollmentSchedule` and `BuildCorSnapshot` already go through the enum.
- Frontend: the Registrar dropdown in `enrollment-schedule-card.tsx` gets a third `<option value="both">`; the union type there, `enrollment-window-schema.ts` and `reference-data-schema.ts` add `"both"`.
- No migration (`VARCHAR(20)` already fits `both`). The COR line shows the new label. `backfill_academic_term_platform.php` is untouched.

## Change 2 — Sequential student numbers

### Data model

New table `student_number_sequences`: `year` (unsigned smallint, primary key), `last_value` (unsigned int), timestamps. One row per year.

The migration is reversible (`down()` drops the table) and creates the table empty. The row for a year is created **on first use** from the highest existing `YYYY-MM-NNNNN` suffix of that year, so 2026 continues from 01930 and the next number is `2026-10-01931`, and a restored older dump with no counter row cannot cause a collision. `HIST-` and `TEST-` numbers never match the pattern and are ignored. A test uses the `RollsBackThroughMigration` trait.

### Assigning a number

A new action (`AssignStudentNumber`) is called by `ProvisionStudent` inside its existing `DB::transaction`:

1. `year` and `month` come from `now('Asia/Manila')`.
2. Make sure the year's row exists (`insertOrIgnore`), then read it with `lockForUpdate()`, so two Admission staff creating accounts at once get different numbers. Row locks behave the same on local MariaDB and the production MySQL, which is why a native `SEQUENCE` was rejected.
3. Take `last_value + 1`. If that suffix is already used by any student in the same year, in any month (for example a manually entered existing number), take the next one. Save the new `last_value`.
4. If the value would pass 99999, fail with a 422 (`student_number`: the sequence for that year is full) instead of producing a 6-digit suffix.

The rollback of a failed provisioning also rolls back the counter, so no number is burned by a failed create.

### API contract (`POST /api/v1/student-profiles`)

- New boolean `has_existing_student_number` (default `false`).
- `false`: `student_number` is **prohibited** (the server assigns it).
- `true`: `student_number` is required, must match `^\d{4}-(0[1-9]|1[0-2])-\d{5}$`, and must be unique. `student_type` must be `returnee` or `existing_student`, otherwise 422 on `has_existing_student_number`. The counter is not touched.
- Duplicate message: "This student number is already in use." The other student's identity is not revealed.
- The audit record for `STUDENT_PROFILE_PROVISIONED` gains `student_number_source` (`assigned` or `existing`) so a manually entered number can be traced.
- Older frontends that still send a `student_number` without the flag get a 422 until they reload (same consequence as ADR 0041).

### Admission portal (Create a student account)

- The **Generate** button and the "Generated automatically" helper are removed. `student-number.ts` and every import of `generateStudentNumber` are deleted.
- The Student number field is read-only with the text "Assigned automatically when the account is created." The success panel already shows `created.student_number`, so the real number appears right after saving.
- A checkbox **"Student already has a student number"** switches the field to an input labelled **"Existing student number"** with the hint "Enter it exactly as it appears on the student's records (YYYY-MM-NNNNN)." The checkbox is disabled for Freshman and Transferee, and until a type is chosen; changing the type to one of those while it is checked clears and unchecks it.
- `provisionStudentSchema` gets `has_existing_student_number` and a `superRefine`: when true, `student_number` must match the format and the type must be Returnee or Existing Student; when false, no `student_number` is sent. The schema stays `.strict()`.
- `applyApiFieldErrors` already maps server errors onto fields, so the duplicate and type errors surface on the form.

## Out of scope

- Renumbering any of the 6,379 existing students.
- `StudentIdentityGenerator` (the deterministic demo seed) and the locked Student number in the edit dialog.
- Accepting legacy number formats other than `YYYY-MM-NNNNN`. If the school has older numbers in another pattern, the owner supplies the pattern and the rule is widened.
- Running the migration on the dev database or Hostinger. The owner runs it; Claude does not touch production without being told.

## To confirm (changed from the chat design)

In chat the existing-number option was excluded only for Freshman. This spec also excludes **Transferee**, because ADR 0041 groups only Returnee and Existing Student as students with records at the school, and a Transferee's previous number comes from another school, not from GRC. If a Transferee can legitimately already hold a GRC number, say so and the allowed list becomes Returnee, Existing Student and Transferee.

## Testing

- **Backend:** sequence increments by one; continues after the seeded maximum; a new year starts at 00001; month rolls with the Manila date (including a UTC time that is already the next Manila month); skips a taken number; refuses past 99999; counter rolls back with a failed create; existing-number mode (valid, duplicate, malformed, Freshman, Transferee, counter untouched); `student_number` rejected without the flag; audit `student_number_source`; the migration creates and rolls back; a year with no counter row continues after the highest existing number. `StudentProfilesEndpointTest`, `ProvisionStudentAuditTest`, `AdmissionStudentRecordsEndpointTest` and `ApiSurfaceTest` are updated for the new contract. Platform: `both` accepted, shown in the resource and printed on the COR.
- **Frontend:** the form has no Generate button; the checkbox toggles the field; disabled for Freshman and Transferee; format error; server duplicate error shown on the field; the `both` option saves from the Registrar card. `admission-provisioning-workspace.test.tsx` and `enrollment-schedule-card.test.tsx` are updated.
- **Gates:** narrowest tests after each change, then the full backend and frontend suites, `tsc`, ESLint and Pint before calling it done. Backend tests run on the private MariaDB (:3310) with process environment variables, per `docs/runbooks/mariadb-local.md`, because the local :3306 server is down.

## Deployment note

One new migration. The owner must run it on local and on Hostinger before the new Admission form is used, otherwise creating a student fails. The backend should be deployed together with (or just before) the frontend.
