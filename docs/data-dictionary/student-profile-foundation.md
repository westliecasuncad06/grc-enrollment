# Student Profile Foundation Data Dictionary

**Database:** MariaDB 10.4.32 (`grc_enrollment` / `grc_enrollment_test`), per
ADR 0007.

Schema: `student_profiles` (see `docs/data-dictionary/enrollment-records.md`
for the column-level table — it landed in the schema-foundation task). This
slice adds the first API layer over that table: provisioning and
self-service reads (PRD §5.2, DFD 2.1).

## Provisioning transaction

`App\Actions\Identity\ProvisionStudent` creates the `User` (role `student`,
status `active`) and the `StudentProfile` together inside one
`DB::transaction()`. A `StudentProfile` must never exist without its `User`,
or vice versa — there is no two-step "create the account, then create the
profile" flow, matching PRD §3.2's "create new student accounts *and*
initial profiles" as one Admission Staff action, not two calls against two
endpoints.

`admission_status` is always set to `AdmissionStatus::Admitted` and
`academic_standing` to `AcademicStanding::Good` on provisioning — a new
account is only ever created because the student *was* admitted, and a
brand-new student has no academic history yet to reflect anything else.
Both enums are pre-existing provisional vocabulary from the schema-foundation
task (PRD §17 unconfirmed); this slice introduces no new vocabulary.

`StoreStudentProfileRequest::withValidator()` cross-checks that the
submitted `curriculum_id` actually belongs to the submitted `program_id`,
rejecting the mismatch as a 422 before the transaction ever opens — nothing
enforced this at the data layer before, and enrolling a student under a
curriculum from a different program would be a silent data-integrity bug.

Admission Staff sets the student's initial password directly in the request
(the same fail-closed, no-default-credential pattern as
`RoleUserSeeder`/`DemoEnrollmentSeeder`); no invitation-email flow exists in
this codebase, and building one is out of scope for this slice. The response
never echoes the password back — `StudentProfileResource`'s key set is
fixed and excludes it, even though the caller already knows the value they
just submitted.

## Authorization — own-record only, no broader role visibility

Unlike Faculty Input (own-record for Faculty, but every planning role sees
every professor's rows — see `docs/data-dictionary/faculty-input.md`),
**no role** gets broad read access to student profiles in this slice.
`StudentProfilePolicy::view()` checks only `$user->id === $profile->user_id`.
`GET /api/v1/student-profile` takes no path parameter — it resolves
"whose profile is this" from the authenticated token exactly like
`GET /api/v1/auth/me`, not from a route-supplied ID. A 404 (not a 500) is
returned when the authenticated user has no profile, e.g. a non-student role
or a student account that was never provisioned through this endpoint.

`StudentProfilePolicy::create()` restricts provisioning to
`UserRole::AdmissionStaff`, re-checking the route's `role:admission_staff`
middleware as defense in depth — the same two-layer pattern as every other
write-gated resource in this API (ADR 0008).

## Seeded data

`student_profiles.is_demo_account` is a non-null boolean, defaulting to
`false`. It distinguishes the legacy local QA student profiles from the
structured roster used for local factual attrition scenarios. Analytics and
honors reports exclude demo accounts; it is private operational provenance
and is never serialized by the student-profile API.

None. No acceptance criterion required seeded fixtures for this sub-project;
tests create records directly.
