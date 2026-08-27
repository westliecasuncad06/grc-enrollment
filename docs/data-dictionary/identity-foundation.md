# Identity Foundation Data Dictionary

**Database:** MariaDB 10.4.32 (`grc_enrollment` / `grc_enrollment_test`), per
ADR 0007. Character set `utf8mb4`, collation `utf8mb4_unicode_ci`, storage
engine InnoDB, strict SQL mode enforced per-connection.

Migrations: `backend/database/migrations/2026_07_26_00000{1,2,3,4}_*.php`.

## `users`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | primary key, auto-increment | |
| `name` | `VARCHAR(255)` | not null | Composed display name ("First M. Last Suffix"). Kept in sync with the four fields below by `App\Domain\Identity\PersonName::compose()` whenever any of them is written through the Student provisioning/correction/change-request flows; never edited directly by those flows. |
| `first_name` | `VARCHAR(255)` | nullable | Added `2026_08_26_000003`. Nullable at the DB level only so pre-split seeders/roles without a name-collecting form (e.g. Faculty, still seeder-only) keep working; required by every Form Request that actually collects a name. |
| `middle_initial` | `VARCHAR(10)` | nullable | Added `2026_08_26_000003`. An initial (e.g. `M`), not a full middle name — always optional. |
| `last_name` | `VARCHAR(255)` | nullable | Added `2026_08_26_000003`. Same nullability rationale as `first_name`. |
| `suffix` | `VARCHAR(20)` | nullable | Added `2026_08_26_000003`. Free text (`Jr.`, `Sr.`, `III`, …), always optional. |
| `email` | `VARCHAR(255)` | not null, **unique** | Normalized (trimmed, lowercased) by the application before validation, not by the database |
| `password` | `VARCHAR(255)` | not null | bcrypt hash via Laravel's `hashed` cast; never stored or returned in plain text |
| `role` | `VARCHAR(255)` | not null | Application-backed string, not a MySQL `ENUM`, so new roles need only a normal migration. Exact values: `student`, `admission_staff`, `faculty`, `program_chair`, `dean`, `executive_director`, `registrar_head`, `registrar_staff`, `accounting_staff` — see `App\Domain\Identity\UserRole` |
| `status` | `VARCHAR(255)` | not null | `active` or `disabled` — see `App\Domain\Identity\UserStatus` |
| `last_login_at` | `TIMESTAMP` | nullable | Set on every successful login; UTC |
| `created_at`, `updated_at` | `TIMESTAMP` | nullable | Laravel timestamps |

No foreign keys in this slice. `student_profiles`, which would reference
`users`, is deliberately deferred until its institutional policy fields
(admission status, academic standing, approved contact fields) are confirmed.

**Name-split backfill (`2026_08_26_000003`):** every pre-existing `users` row
was parsed best-effort into `first_name`/`middle_initial`/`last_name`/`suffix`
from its existing `name` string (comma-formatted "SURNAME,GIVEN NAME" faculty
CSV artifacts, trailing `Jr./Sr./II/III/IV/V` suffixes, and single-token names
are all handled explicitly). `name` itself is never rewritten by the backfill
— it stays exactly what it already was for every existing account, so the
migration carries zero display-regression risk. The split columns are
best-effort structured metadata for existing rows; they become the source of
truth (with `name` recomposed from them) only once a row is next edited
through the Student provisioning/correction/change-request flows.

## `programs`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | primary key, auto-increment | |
| `code` | `VARCHAR(255)` | not null, **unique** | |
| `name` | `VARCHAR(255)` | not null | |
| `status` | `VARCHAR(255)` | not null | Application-backed string. **Provisional** values `active`/`inactive` — see `App\Domain\Organization\ProgramStatus`; the institutional vocabulary itself remains unconfirmed (PRD §17) |
| `created_at`, `updated_at` | `TIMESTAMP` | nullable | |

## `academic_terms`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | primary key, auto-increment | |
| `school_year` | `VARCHAR(255)` | not null | Canonical form e.g. `2026-2027` |
| `semester` | `VARCHAR(255)` | not null | |
| `starts_at` | `DATETIME` | nullable | |
| `ends_at` | `DATETIME` | nullable | |
| `enrollment_opens_at` | `DATETIME` | nullable | |
| `enrollment_closes_at` | `DATETIME` | nullable | |
| `add_drop_deadline_at` | `DATETIME` | nullable | |
| `grading_deadline_at` | `DATETIME` | nullable | |
| `closed_at` | `DATETIME` | nullable | Set once by Registrar close action |
| `archived_at` | `DATETIME` | nullable | Set once by Registrar archive action |
| `status` | `VARCHAR(255)` | not null | `draft`, `for_dean_approval`, `semester_ongoing`, `semester_closed`, or `archived` — see `App\Domain\Organization\AcademicTermStatus` |
| `created_at`, `updated_at` | `TIMESTAMP` | nullable | |
|  |  | **unique** `(school_year, semester)` | |

## `personal_access_tokens`

Laravel Sanctum's standard schema (`vendor/laravel/sanctum`), published
unmodified into this repository's migrations for ordering/rollback control.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | primary key, auto-increment | |
| `tokenable_type`, `tokenable_id` | polymorphic pair | indexed (`morphs`) | Always `App\Models\User` in this slice |
| `name` | `TEXT` | not null | Set to `spa-{ip}` by `AuthenticateUser` |
| `token` | `VARCHAR(64)` | not null, **unique** | SHA-256 hash of the token; the plain-text value is returned exactly once, at login, and never stored |
| `abilities` | `TEXT` | nullable | `["*"]` in this slice — no scoped-ability policy exists yet |
| `last_used_at` | `TIMESTAMP` | nullable | |
| `expires_at` | `TIMESTAMP` | nullable, indexed | See token expiration note below |
| `created_at`, `updated_at` | `TIMESTAMP` | nullable | |

## Reversibility

Rollback (`php artisan migrate:rollback`) drops the four tables in reverse
migration order. The tables are independent of each other in this slice (no
foreign keys), so rollback order does not matter functionally; migration
timestamp order controls it regardless.

## Token expiration — provisional, not an institutional decision

PRD §9.1 requires "an approved expiration policy"; PRD §17 lists the
session/token lifetime as an open institutional decision that authorized GRC
stakeholders have not yet confirmed. `config/sanctum.php`'s `expiration` key
reads `SANCTUM_TOKEN_EXPIRATION` with a **provisional** 480-minute (8 hour)
local default — explicitly documented as not an approved value in that file,
`.env.example`, and `docs/api/openapi.yaml`. Replace it with the approved
value before any production-like deployment.

## Authorization

`GET /api/v1/programs` and `GET /api/v1/academic-terms` are readable by every
role once authenticated. `ProgramPolicy`/`AcademicTermPolicy` govern the
endpoint and single-record decision; each model's `scopeVisibleTo()` filters
list results so learner-scoped roles (`student`, `faculty`,
`accounting_staff` — see `App\Domain\Identity\UserRole::isLearnerScoped()`)
receive only learner-visible rows, while the remaining six roles receive every
row regardless of status. See ADR 0008 for the full rationale.

## Seeded data

Exactly nine synthetic identities, one per role, are seeded by
`backend/database/seeders/RoleUserSeeder.php` in `local`/`testing`
environments only. `backend/database/seeders/ProgramSeeder.php` and
`AcademicTermSeeder.php` seeds six archived historical semesters (both
semesters of 2020–2021 through 2022–2023) and no current term. The clean
manual-test seed therefore lets Registrar Head create the next semester
explicitly; sections and demo enrollments are no-ops until an ongoing term
exists. None of this is the real GRC catalog.
See `docs/testing/SEEDED_IDENTITIES.md` for the full list and safety
guarantees.
