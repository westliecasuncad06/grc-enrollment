# Enrollment Records Data Dictionary

**Database:** MariaDB 10.4.32 (`grc_enrollment` / `grc_enrollment_test`), per
ADR 0007. Same charset/collation/engine as every other table in this codebase.

Migrations: `backend/database/migrations/2026_07_27_0000{05,10,11,12,13,14,15,16,17}_*.php`.

**Scope note:** this page originally documented schema landed as verified
groundwork alongside the PRD §5.1 faculty-input/section-planning/
approval-workflow slice, with no API layer yet built. Phases 6–7b have since
landed the full API for every table on this page — see each table's own
**API** note for its routes and OpenAPI tag.

## `student_profiles`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | primary key, auto-increment | |
| `user_id` | `BIGINT UNSIGNED` | not null, **unique**, FK → `users.id`, `CASCADE` on delete | One profile per user account |
| `student_number` | `VARCHAR(255)` | not null, **unique** | |
| `program_id` | `BIGINT UNSIGNED` | not null, FK → `programs.id`, `RESTRICT` on delete | |
| `curriculum_id` | `BIGINT UNSIGNED` | not null, FK → `curricula.id`, `RESTRICT` on delete | |
| `year_level` | `TINYINT UNSIGNED` | not null | Cast to `integer` on the model |
| `admission_status` | `VARCHAR(255)` | not null | **Provisional** — see `App\Domain\Identity\AdmissionStatus`; institutional vocabulary unconfirmed (PRD §17) |
| `academic_standing` | `VARCHAR(255)` | not null | **Provisional** — see `App\Domain\Identity\AcademicStanding`; derivation rules (honors cutoff, disqualifying grades) unconfirmed (PRD §17) |
| `created_at`, `updated_at` | `TIMESTAMP` | nullable | |

PRD §10.1's "approved contact fields" are deliberately **not** included —
which contact details GRC authorizes storing is unconfirmed; they arrive with
the approved student-provisioning slice.

## `enrollments`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | primary key, auto-increment | |
| `student_id` | `BIGINT UNSIGNED` | not null, FK → `student_profiles.id`, `CASCADE` on delete | |
| `academic_term_id` | `BIGINT UNSIGNED` | not null, FK → `academic_terms.id`, `RESTRICT` on delete | |
| `status` | `VARCHAR(255)` | not null | **Authoritative** PRD §4.2 lifecycle — see `App\Domain\Enrollment\EnrollmentStatus` |
| `total_units` | `SMALLINT UNSIGNED` | not null, default `0` | |
| `submitted_at`, `registrar_decided_at`, `payment_confirmed_at`, `enrolled_at` | `TIMESTAMP` | nullable | |
| `active_academic_term_id` | `BIGINT UNSIGNED GENERATED ALWAYS AS (...) STORED` | nullable | Mirrors `academic_term_id` while `status` is non-terminal; `NULL` on `rejected`/`cancelled`/`withdrawn` |
| `created_at`, `updated_at` | `TIMESTAMP` | nullable | |
|  |  | **unique** `(student_id, active_academic_term_id)` — `enrollments_unique_active_per_student_term` | Enforces "one active enrollment per student per term" while permitting re-enrollment after a terminal state, because SQL unique indexes ignore `NULL` |

**This generated column is load-bearing — do not refactor it into a plain
column.** The terminal values (`rejected`, `cancelled`, `withdrawn`) are
written as SQL literals in the migration rather than read from
`EnrollmentStatus`, because a migration must stay an immutable snapshot; the
enum's own docblock carries a matching warning that changing its terminal set
requires a new migration to rebuild this column.

**API:** `GET`/`POST /api/v1/enrollments` (Phase 6 — submission, role-scoped
read since Phase 7a Task 1), `PATCH /api/v1/enrollments/{enrollment}` (Phase
7a Task 2 — `registrar_approve`/`registrar_reject`/`void`),
`POST /api/v1/enrollments/{enrollment}/payment` (Phase 7a Task 5 — idempotent
payment confirmation). OpenAPI tag `Enrollment`.

## `enrollment_subjects`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | primary key, auto-increment | |
| `enrollment_id` | `BIGINT UNSIGNED` | not null, FK → `enrollments.id`, `CASCADE` on delete | |
| `section_id` | `BIGINT UNSIGNED` | not null, FK → `sections.id`, `RESTRICT` on delete | |
| `status` | `VARCHAR(255)` | not null | **Provisional** — see `App\Domain\Enrollment\EnrollmentSubjectStatus` |
| `created_at`, `updated_at` | `TIMESTAMP` | nullable | |
|  |  | **unique** `(enrollment_id, section_id)` | PRD §5.3: repeated requests must not duplicate seats |

**API:** written only as part of `POST /api/v1/enrollments` (Phase 6); no
dedicated write route of its own, but read via `GET /api/v1/class-rosters`
(Phase 7b Task 4 — Faculty own sections, Registrar Staff and Registrar Head
all). Also embedded in `EnrollmentResource.subjects`. OpenAPI tag
`Class Rosters`.

## `academic_grades`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | primary key, auto-increment | |
| `student_id` | `BIGINT UNSIGNED` | not null, FK → `student_profiles.id`, `CASCADE` on delete | |
| `subject_id` | `BIGINT UNSIGNED` | not null, FK → `subjects.id`, `RESTRICT` on delete | |
| `section_id` | `BIGINT UNSIGNED` | nullable, FK → `sections.id`, `SET NULL` on delete | Nullable so transferred/historical records are storable without an owning section |
| `academic_term_id` | `BIGINT UNSIGNED` | not null, FK → `academic_terms.id`, `RESTRICT` on delete | |
| `final_grade` | `DECIMAL(5,2)` | nullable | **Not cast to float on the model** — carried as the exact string MySQL returns; grading scale unconfirmed (PRD §17) |
| `remarks` | `TEXT` | nullable | Carries special marks until that vocabulary is confirmed |
| `status` | `VARCHAR(255)` | not null | **Authoritative** PRD §4.3 lifecycle (`draft`→`submitted`→`locked`) — see `App\Domain\Academic\GradeStatus` |
| `encoded_by` | `BIGINT UNSIGNED` | not null, FK → `users.id`, `RESTRICT` on delete | |
| `submitted_at`, `locked_at` | `TIMESTAMP` | nullable | |
| `created_at`, `updated_at` | `TIMESTAMP` | nullable | |
|  |  | **unique** `(student_id, subject_id, academic_term_id)` — `academic_grades_unique_student_subject_term` | |

**API (Phase 7a Task 3):** `GET`/`POST`/`PATCH /api/v1/academic-grades`.
Role-scoped read (Student own, Faculty own sections, Registrar Head and
Registrar Staff all — the latter widened in Phase 7b Task 3); `POST` is
Faculty-only; `PATCH` serves a plain content edit (draft only) or
`action: submit`/`lock`. OpenAPI tag `Academic Records`.

## `queue_tickets`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | primary key, auto-increment | |
| `enrollment_id` | `BIGINT UNSIGNED` | not null, **unique**, FK → `enrollments.id`, `CASCADE` on delete | One ticket per enrollment |
| `ticket_number` | `VARCHAR(255)` | not null, **unique** | Opaque string — numbering scheme, reset cadence, and priority rules unconfirmed (PRD §17) |
| `queue_date` | `DATE` | not null | |
| `status` | `VARCHAR(255)` | not null | **Provisional** — see `App\Domain\Enrollment\QueueTicketStatus` |
| `served_at` | `TIMESTAMP` | nullable | |
| `created_at`, `updated_at` | `TIMESTAMP` | nullable | |

**API (Phase 7a Task 4):** `GET /api/v1/queue-tickets`, `PATCH
/api/v1/queue-tickets/{queueTicket}` (`action: serve`/`complete`). Accounting
Staff only — the one write pair in this document gated by a coarse
`role:accounting_staff` route middleware rather than Policy alone, since
neither transition has a per-ticket ownership dimension. OpenAPI tag
`Payments`.

## `payments`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | primary key, auto-increment | |
| `enrollment_id` | `BIGINT UNSIGNED` | not null, **unique**, FK → `enrollments.id`, `CASCADE` on delete | Enforces FR-FIN-009's idempotent-confirmation requirement |
| `confirmed_by` | `BIGINT UNSIGNED` | not null, FK → `users.id`, `RESTRICT` on delete | |
| `external_reference` | `VARCHAR(255)` | nullable | |
| `amount` | `DECIMAL(10,2)` | nullable | **Not cast to float on the model** — money stays an exact decimal string; currency/rounding rule unconfirmed (PRD §17) |
| `confirmed_at` | `TIMESTAMP` | not null | |
| `created_at`, `updated_at` | `TIMESTAMP` | nullable | |

Records that Accounting confirmed an externally received payment
(FR-FIN-007) — **not** a payment gateway integration; holds no cardholder or
bank data.

**API (Phase 7a Task 5):** written only by
`POST /api/v1/enrollments/{enrollment}/payment` (Accounting only, only from
`pending_payment`); no dedicated read route — surfaced via the payment
confirmation response, not queried separately. Idempotent on
`enrollment_id`'s unique constraint (FR-FIN-009). OpenAPI tag `Payments`.

## `enrollment_documents`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | primary key, auto-increment | |
| `enrollment_id` | `BIGINT UNSIGNED` | not null, FK → `enrollments.id`, `CASCADE` on delete | |
| `document_type` | `VARCHAR(255)` | not null | Deliberately single-valued (`com` only) — see `App\Domain\Enrollment\EnrollmentDocumentType`; whether COR is a distinct artifact is unconfirmed (PRD §17) |
| `document_number` | `VARCHAR(255)` | not null | |
| `storage_path` | `VARCHAR(255)` | nullable | |
| `content_hash` | `VARCHAR(64)` | nullable | |
| `generated_at` | `TIMESTAMP` | not null | |
| `created_at`, `updated_at` | `TIMESTAMP` | nullable | |
|  |  | **unique** `(enrollment_id, document_type)` — `enrollment_documents_unique_type_per_enrollment` | Generating twice must not produce a duplicate document |
|  |  | **unique** `(document_type, document_number)` — `enrollment_documents_unique_number_per_type` | |

**API (Phase 7a Task 5):** `GET /api/v1/enrollment-documents` (Student own,
Registrar Head and Registrar Staff all — the latter widened in Phase 7b
Task 3). Rows are created only as a side effect of payment
confirmation, never directly. `storage_path` stays `null` in this slice — no
PDF pipeline; the Digital COM is served as structured data for the Student
module to render as a print-stylesheet page (FR-FIN-010). OpenAPI tag
`Payments`.

## `transferee_credits`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | primary key, auto-increment | |
| `student_id` | `BIGINT UNSIGNED` | not null, FK → `student_profiles.id`, `CASCADE` on delete | |
| `source_institution`, `source_subject_code`, `source_subject_title` | `VARCHAR(255)` | not null | |
| `source_grade` | `VARCHAR(255)` | nullable | Free string — no equivalence/passing rule encoded (PRD §17) |
| `credited_units` | `TINYINT UNSIGNED` | not null | Cast to `integer` on the model |
| `subject_id` | `BIGINT UNSIGNED` | nullable, FK → `subjects.id`, `SET NULL` on delete | Nullable — a transferred subject may not map onto any local subject |
| `status` | `VARCHAR(255)` | not null | **Provisional** — see `App\Domain\Academic\TransfereeCreditStatus` |
| `processed_by` | `BIGINT UNSIGNED` | nullable, FK → `users.id`, `SET NULL` on delete | |
| `processed_at` | `TIMESTAMP` | nullable | |
| `created_at`, `updated_at` | `TIMESTAMP` | nullable | |

**API (Phase 7b Task 2):** `GET`/`POST`/`PATCH /api/v1/transferee-credits`.
Role-scoped read (Student own, Registrar Staff and Registrar Head all);
`POST` is Registrar-Staff-only; `PATCH` serves a plain content edit
(`pending` only) or `action: approve`/`reject` — every write is audited,
including plain edits (FR-FIN-003). Approved credits are record-only: they
are never read by `BuildEligibleSubjectPool`, since cross-institution grade
equivalence is an open PRD §17 decision. OpenAPI tag `Transferee Credits`.

## `withdrawal_requests`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | primary key, auto-increment | |
| `enrollment_id` | `BIGINT UNSIGNED` | not null, FK → `enrollments.id`, `CASCADE` on delete | |
| `reason` | `TEXT` | not null | PRD §4.2 rule 7 requires a reason for withdrawal — a stated rule, so enforced as `NOT NULL` |
| `status` | `VARCHAR(255)` | not null | **Provisional** — see `App\Domain\Enrollment\WithdrawalStatus` |
| `processed_by` | `BIGINT UNSIGNED` | nullable, FK → `users.id`, `SET NULL` on delete | |
| `processed_at` | `TIMESTAMP` | nullable | |
| `created_at`, `updated_at` | `TIMESTAMP` | nullable | |

Seat-release mechanics (whether an approved withdrawal decrements
`sections.enrolled_count`) are config-flagged —
`config('enrollment.withdrawal.releases_seats')`, default `true` — since
§17 leaves the underlying policy unconfirmed; dropping the affected
`enrollment_subjects` rows to `dropped` happens unconditionally either way.

**API (Phase 7b Task 1):** `POST /api/v1/enrollments/{enrollment}/withdraw`
(Student, own `enrolled` enrollment — creates this row, `pending`), `GET
/api/v1/withdrawal-requests` (Student own, Registrar Staff and Registrar
Head all), `PATCH /api/v1/withdrawal-requests/{withdrawalRequest}`
(Registrar-Staff-only `action: approve`/`reject`). `approve` drops every
still-active `enrollment_subjects` row and, per the config flag above,
releases the section seat exactly once even under a repeated approval
attempt (`withdrawal_requests` carries no unique constraint on
`enrollment_id`, so idempotency is enforced under a row lock in
`App\Actions\Enrollment\TransitionWithdrawalRequest`, not the schema).
OpenAPI tag `Withdrawals`.

## Seeded data

`database/seeders/DemoEnrollmentSeeder.php` seeds four students at different
points of the PRD §4.2 lifecycle (`enrolled`, `pending_registrar_approval`,
`pending_payment`, `withdrawn`), exercising every table on this page plus the
unique-active-enrollment rule. `local`/`testing` environments only; fails
closed outside those environments. Every synthetic student login uses the
shared development password `password`, stored only as a Laravel hash. See
`tests/Feature/Database/DemoEnrollmentSeederTest.php` and
`EnrollmentRecordsMigrationTest.php`.

## Reversibility

Each migration's `down()` drops only its own table; the migrator runs them in
reverse creation order, which also satisfies FK dependency order.
