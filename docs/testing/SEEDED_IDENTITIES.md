# Seeded Development Identities

**Scope:** Local development and automated tests only.
**Source:** `backend/database/seeders/RoleUserSeeder.php`

These are **database fixtures**, not production accounts. They exist so every
PRD role can be exercised against real Sanctum authentication during
development.

## These are now the only sign-in credentials

A second, UI-only set once existed in `docs/testing/DEMO_CREDENTIALS.md`: nine
hardcoded frontend fixtures with a committed shared password, used when the SPA
ran in a `demo` auth mode without a backend. **Both the file and that auth mode
were deleted in the Next.js migration** (roadmap Phase 3, ADR 0013) — they
predated real Sanctum authentication, and porting their environment guard to
Next.js risked making a committed password valid in a production build.

The identities below are the only way to sign in. Their password lives in
`GRC_SEED_PASSWORD` and is never committed.

## The nine identities

One per PRD role. Names and emails are deterministic; reseeding updates these
rows in place rather than creating duplicates.

| Role | Name | Email |
|---|---|---|
| `student` | Seed Student | `student.seed@grc.test` |
| `admission_staff` | Seed Admission Staff | `admission.seed@grc.test` |
| `faculty` | Seed Faculty | `faculty.seed@grc.test` |
| `program_chair` | Seed Program Chair | `chair.seed@grc.test` |
| `dean` | Seed Dean | `dean.seed@grc.test` |
| `executive_director` | Seed Executive Director | `executive.seed@grc.test` |
| `registrar_head` | Seed Registrar Head | `registrar-head.seed@grc.test` |
| `registrar_staff` | Seed Registrar Staff | `registrar-staff.seed@grc.test` |
| `accounting_staff` | Seed Accounting Staff | `accounting.seed@grc.test` |

All are created with status `active`. Emails use the reserved `.test` TLD
(RFC 2606), so they can never resolve to a real mailbox.

## The password

**Not recorded in this file, in any commit, or in `PROGRESS.md`.**

The seeder reads `GRC_SEED_PASSWORD` from the environment, hashes it through
Laravel, and **fails closed** if it is absent — it will not fall back to a
default or empty secret. Your local value is in the gitignored
`backend/.env`.

## Running the seeder

```powershell
cd backend
$env:GRC_SEED_PASSWORD = '<your local secret>'
php artisan db:seed --class=RoleUserSeeder
```

Or seed everything registered in `DatabaseSeeder`:

```powershell
php artisan db:seed
```

## Safety guarantees

The seeder is covered by `backend/tests/Feature/Database/RoleUserSeederTest.php`,
which asserts that it:

- creates exactly one active user per role, with unique `@grc.test` emails;
- stores only a bcrypt hash, never the plain-text password;
- is idempotent — reseeding updates the same rows, creating no duplicates;
- never deletes unrelated users;
- throws rather than seeding anything when `GRC_SEED_PASSWORD` is absent;
- throws rather than seeding anything outside the `local` and `testing`
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

| Program code | Name | Status |
|---|---|---|
| `BSIT` | BS Information Technology | `active` |
| `BSCS` | BS Computer Science | `active` |
| `BSCRIM` | BS Criminology | `inactive` |

| School year | Semester | Status |
|---|---|---|
| `2025-2026` | `2nd` | `closed` |
| `2026-2027` | `1st` | `active` |
| `2027-2028` | `1st` | `planning` |

Each table deliberately includes one non-learner-visible row (`inactive`,
`planning`) so `GET /api/v1/programs` and `GET /api/v1/academic-terms` return
observably different results for a learner-scoped role versus a planning
role — see ADR 0008 and
`docs/data-dictionary/identity-foundation.md#authorization`. Both `status`
vocabularies are **provisional** pending PRD §17 approval.
