# MariaDB Identity Foundation + Sanctum Auth Slice

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Use
> `superpowers:test-driven-development` for every behavior change,
> `superpowers:systematic-debugging` for unexpected failures, and
> `superpowers:verification-before-completion` before any completion claim.
> Task 1 (delete `scripts/mysql84/`, ADR 0007, version-compatibility update,
> superseded-doc notices) is complete as of 2026-07-27.

## Context

The previous plan (`docs/superpowers/plans/2026-07-26-mysql84-identity-foundation.md`)
tried to provision an isolated MySQL 8.4.10 instance on port 3307 beside XAMPP.
That effort produced 2,628 lines of PowerShell bootstrap/lifecycle/safety code
across Tasks 2–3, reached four rounds of an independent review loop capped at
five, and **was never executed once** — `C:\xampp\mysql84` does not exist and
port 3307 has no listener. The last three review rounds addressed increasingly
theoretical
failure modes (`#` in directory paths, UTF-16 BOMs in `my.ini`, Windows reserved
device aliases) for a loopback-only developmentf database, while every piece of
actual PRD value stayed blocked behind a script nobody had run.

The user has decided to **use the existing XAMPP MariaDB 10.4.32 instance**
instead, and to **include Sanctum in this slice** so the portal authenticates
against the database rather than frontend fixtures.

Outcome: a real vertical slice — MariaDB-backed identity schema, deterministic
nine-role seeder, Sanctum bearer-token login/logout/me endpoints, and a frontend
that authenticates for real — replacing the UI-only demo gateway as the default.

## Decisions Taken

| Decision | Choice |
|---|---|
| Database | Existing XAMPP MariaDB 10.4.32 on `127.0.0.1:3306` |
| Old MySQL 8.4 scripts | **Delete** `scripts/mysql84/`; drop plan Tasks 2, 3, 5 |
| DB principals | Scoped `grc_app` / `grc_migrator` / `grc_test`; XAMPP config untouched |
| Schema scope | `users`, `programs`, `academic_terms` **+ Sanctum tokens + real auth endpoints** |

## Verified Environment Facts

Probed live against the running instance (PID 12932, port 3306):

- `10.4.32-MariaDB`, `default_storage_engine=InnoDB`,
  `innodb_default_row_format=dynamic` → `VARCHAR(255)` unique indexes are safe;
  no `defaultStringLength(191)` workaround needed.
- `collation_server=utf8mb4_general_ci`. **MySQL 8's `utf8mb4_0900_ai_ci` does
  not exist in MariaDB** — the approved design's collation must become
  `utf8mb4_unicode_ci`.
- `sql_mode` lacks `STRICT_TRANS_TABLES`; `time_zone=SYSTEM`. Both are corrected
  **per-connection by Laravel** (`'strict' => true` in the `mariadb` connection),
  so no XAMPP config file is modified.
- `root` connects with **no password**; server binds `0.0.0.0`. Left as-is per
  the user's decision; noted as a known local-development exposure.
- PHP 8.2.12 with `pdo_mysql` + `mysqlnd` present. MariaDB uses
  `mysql_native_password`, so there is no MySQL 8 `caching_sha2_password`
  client-compatibility issue.
- `laravel/sanctum` v4.3.3 requires `php ^8.2` and `illuminate ^11|^12|^13` —
  compatible with the installed Laravel 12.64 / PHP 8.2.12 bridge.
- `config/database.php` **already contains** a `mariadb` connection block with
  `utf8mb4` / `utf8mb4_unicode_ci` and `'strict' => true`. Use it; do not add a
  new connection.

## Work Location

Continue in the existing worktree
`C:\xampp\htdocs\GRC-ENROLLMENT\.worktrees\mysql84-identity-foundation`
(branch `feat/mysql84-identity-foundation`). Task 1's output is
database-agnostic and carries over unchanged:

- `backend/app/Domain/Identity/UserRole.php` — nine-value backed enum, matches
  the frontend `demoRoles` tuple exactly
- `backend/app/Domain/Identity/UserStatus.php` — `active` / `disabled`
- `backend/app/Models/User.php` — casts `role`/`status` to the enums,
  `password => 'hashed'`, `last_login_at => 'immutable_datetime'`
- `backend/tests/Unit/…` — three passing unit test files

Per `AGENTS.md`: **no commits or pushes** unless explicitly requested.

---

## Task 1: Reset the MySQL 8.4 Approach

- Delete `scripts/mysql84/` entirely (8 files, 2,628 lines). Nothing was ever
  committed, so no history is lost; the SDD reports under
  `.superpowers/sdd/2026-07-26-mysql84-identity-foundation/` retain the record.
- Mark `docs/superpowers/specs/2026-07-26-mysql84-identity-foundation-design.md`
  and the matching plan as **superseded**, with a one-line pointer to this plan.
  Do not delete them.
- Write `docs/adr/0007-mariadb-development-database.md`: why MySQL 8.4 isolation
  was abandoned, the PRD deviation this creates (PRD requires MySQL 8), the
  `utf8mb4_0900_ai_ci` → `utf8mb4_unicode_ci` consequence, that MariaDB 10.4
  reached end-of-life in June 2024, and what a future migration back to MySQL 8
  would need.
- Update `docs/architecture/version-compatibility.md` with the MariaDB row.
- Prune `PROGRESS.md`. The worktree copy has grown to 77 KB (vs 48 KB on
  `main`), and most of the difference narrates the four Task 3 fix rounds on
  scripts this task deletes. Collapse that to a short entry recording that the
  MySQL 8.4 approach was attempted, never executed, and abandoned in favor of
  MariaDB — the detail survives in the SDD reports. Keep every entry that
  describes shipped behavior.
- Record the decision in the `PROGRESS.md` decisions table.

## Task 2: Databases and Scoped Principals — COMPLETE (2026-07-27, adapted)

Run against the **existing** instance as `root`. Creates only databases and
users — touches no XAMPP config file, no `my.ini`, and no existing schema.

**Deviation from the original design, forced by a real incident:** this
MariaDB instance crashes reproducibly (`mysqld.exe`, exception `0xc0000005`
at the identical offset in `VCRUNTIME140.dll`, confirmed twice via Windows
Event Log) on any schema-wildcard `GRANT ... ON db.* TO ...` statement — the
one below never completed. Table-level grants
(`GRANT ... ON db.specific_table TO ...`, routed through the unaffected
`mysql.tables_priv`) do not trigger the crash and were used instead for every
principal. Full incident detail lives in this session's memory
(`mariadb-instability-incident`); the practical consequence is captured here
so a future session doesn't reintroduce the schema-wildcard form. A pre-
existing, unrelated `grc_enrollment` database (18 tables, prototype data from
2026-07-23, predates this repo) was found first, backed up to
`C:\xampp\mysql-backups\grc_enrollment_prototype_backup_20260723.sql`, and
dropped with the user's explicit approval before recreating it fresh.

- Generate three passwords locally from
  `[Security.Cryptography.RandomNumberGenerator]`, base64url alphabet. Never
  echo, log, or write them to Markdown or `PROGRESS.md`.
- Pipe SQL to `mysql.exe` via **stdin** — never pass a password as a
  command-line argument.

```sql
-- Databases and users: unchanged from the original design.
CREATE DATABASE grc_enrollment      CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE grc_enrollment_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'grc_app'@'127.0.0.1'      IDENTIFIED BY '…';
CREATE USER 'grc_migrator'@'127.0.0.1' IDENTIFIED BY '…';
CREATE USER 'grc_test'@'127.0.0.1'     IDENTIFIED BY '…';

-- Grants: table-level, not schema-wildcard. CREATE lets a grant target a
-- table before it exists (standard MySQL/MariaDB behavior); any privilege
-- set WITHOUT CREATE fails with "table doesn't exist" until the table is
-- actually created. grc_migrator/grc_test therefore get every planned table
-- name up front; grc_app's DML-only grants must wait for Task 4.
GRANT CREATE, ALTER, DROP, INDEX, SELECT, INSERT, UPDATE, DELETE
  ON grc_enrollment.migrations              TO 'grc_migrator'@'127.0.0.1';
GRANT CREATE, ALTER, DROP, INDEX, SELECT, INSERT, UPDATE, DELETE
  ON grc_enrollment.users                   TO 'grc_migrator'@'127.0.0.1';
GRANT CREATE, ALTER, DROP, INDEX, SELECT, INSERT, UPDATE, DELETE
  ON grc_enrollment.personal_access_tokens  TO 'grc_migrator'@'127.0.0.1';
GRANT CREATE, ALTER, DROP, INDEX, SELECT, INSERT, UPDATE, DELETE
  ON grc_enrollment.programs                TO 'grc_migrator'@'127.0.0.1';
GRANT CREATE, ALTER, DROP, INDEX, SELECT, INSERT, UPDATE, DELETE
  ON grc_enrollment.academic_terms          TO 'grc_migrator'@'127.0.0.1';

-- grc_test gets the identical set against grc_enrollment_test (5 tables).
-- grc_app's SELECT/INSERT/UPDATE/DELETE-only grants on users,
-- personal_access_tokens, programs, and academic_terms (not migrations)
-- are issued as the first step of Task 4, once those tables exist.
```

- Verified with `SHOW GRANTS FOR 'grc_migrator'@'127.0.0.1'` /
  `'grc_test'@'127.0.0.1'` / `'grc_app'@'127.0.0.1'`: no global (`*.*`) grant
  beyond bare `USAGE` leaked to any principal. Store no output containing
  authentication strings.
- Confirmed the pre-existing MariaDB PID and every other database were
  unchanged, aside from restoring `pma`'s (phpMyAdmin's control user) grant
  on its own `phpmyadmin.*` tables — lost when `REPAIR TABLE mysql.db` reset
  that table to 0 rows during incident triage, restored via the same
  table-level approach across all 19 `phpmyadmin` tables.

## Task 3: Laravel Connection and Environment

- `backend/.env` (gitignored): `DB_CONNECTION=mariadb`, port `3306`,
  `DB_DATABASE=grc_enrollment`, `DB_USERNAME=grc_app`.
- `backend/.env.testing` (gitignored): `DB_DATABASE=grc_enrollment_test`,
  `DB_USERNAME=grc_test`.
- Commit `.env.example` and a new `.env.testing.example` with **empty**
  passwords. Change the existing `.env.example` `DB_CONNECTION=mysql` →
  `mariadb`.
- Migrations run as `grc_migrator` via a separate `mariadb_migrator` connection
  entry, or by a documented one-off `DB_USERNAME` override — pick the
  connection-entry form so `php artisan migrate` needs no manual step.
- `backend/phpunit.xml`: remove the commented sqlite lines. Let `.env.testing`
  supply the connection so no credential enters a tracked file.
- Verify `backend/.gitignore` covers `.env` and `.env.testing`.

**Test:** `tests/Feature/Database/DatabaseConfigurationTest.php` — asserts the
active connection is `mariadb`, charset `utf8mb4`, collation
`utf8mb4_unicode_ci`, strict mode on, and that a live query returns a
`10.4`-prefixed version.

## Task 4: Reversible Migrations

Three tables per the approved design (§Identity Foundation Schema), unchanged
except for collation. `student_profiles` stays deferred — it depends on
unconfirmed institutional policy values.

- `database/migrations/…_create_users_table.php` — `id`, `name`,
  `email` unique, `password`, `role` (string, **not** a MySQL `ENUM`, so roles
  evolve through normal migrations), `status`, `last_login_at` nullable,
  timestamps.
- `…_create_programs_table.php` — `id`, `code` unique, `name`, `status`,
  timestamps.
- `…_create_academic_terms_table.php` — `id`, `school_year`, `semester`,
  four nullable datetimes, `status`, timestamps, unique
  `(school_year, semester)`.
- Publish Sanctum's `personal_access_tokens` migration into the repo rather than
  loading it from the package, so ordering and rollback stay under our control.

No foreign keys in this slice — the three tables are independent until parent
tables and policy fields are approved.

**Tests:** `tests/Feature/Database/IdentityFoundationMigrationTest.php` —
asserts each table/column exists with expected types, the unique constraints
reject duplicates, and `migrate:rollback` drops all four tables cleanly.

## Task 5: Deterministic Nine-Role Seeder

- `database/seeders/RoleUserSeeder.php` — upserts exactly the nine synthetic
  identities from the approved design (`student.seed@grc.test` …
  `accounting.seed@grc.test`), keyed on email so reruns update rather than
  duplicate.
- Password comes from `GRC_SEED_PASSWORD`; **fail closed** when absent. Hash
  through Laravel. Never write it to documentation, logs, or `PROGRESS.md`.
- Abort unless `app()->environment(['local', 'testing'])`.
- Seeds no programs, terms, or profiles. Deletes no unrelated user.
- Register in `DatabaseSeeder`.
- `docs/testing/SEEDED_IDENTITIES.md` — lists the nine emails and roles, states
  the password comes from the environment variable, and marks these as
  development fixtures.

**Tests:** `tests/Feature/Database/RoleUserSeederTest.php` — nine users created,
one per role; rerun is idempotent; missing `GRC_SEED_PASSWORD` throws; a
production environment refuses to seed.

## Task 6: Sanctum Installation and Configuration

- `composer require laravel/sanctum:^4.3` (verified compatible above).
- Add `Laravel\Sanctum\HasApiTokens` to `App\Models\User`.
- `config/auth.php`: add a `sanctum` guard; keep `web` untouched. Do **not**
  enable Sanctum's stateful/SPA cookie middleware — PRD §9.1 forbids
  session-cookie and CSRF-cookie flows.
- Token expiration is a **PRD §17 open institutional decision**. Do not invent a
  value: read it from `SANCTUM_TOKEN_EXPIRATION` with a clearly-labelled
  provisional local default, and flag it in `PROGRESS.md` as awaiting approval.

## Task 7: Auth Endpoints

Three routes, matching PRD §8.4 exactly. `forgot-password` / `reset-password`
are **out of scope** for this slice.

```
POST /api/v1/auth/login    (public,  throttled)
POST /api/v1/auth/logout   (auth:sanctum)
GET  /api/v1/auth/me       (auth:sanctum)
```

Follow the existing layering and envelope conventions already in the codebase:

- **Form Request** `LoginRequest` — validates email/password; normalizes email
  to trimmed lowercase to match the frontend gateway's behavior.
- **Action** `App\Actions\Auth\AuthenticateUser` — verifies the hash, rejects
  `UserStatus::Disabled`, issues the token, updates `last_login_at`.
  Returns one **generic** failure for bad email, bad password, and disabled
  account alike, so the endpoint does not enumerate accounts.
- **Resource** `AuthResource` — the only path a token may leave through, per
  PRD §9.1. Mirror `HealthResource`'s shape: explicit keys plus the
  `Cache-Control: no-store` header set in `withResponse`.
- **Errors** reuse `App\Support\Http\ApiErrorCode` — `UNAUTHENTICATED` for bad
  credentials, `VALIDATION_FAILED` for malformed input, `THROTTLED` for rate
  limits. The existing `ApiExceptionRenderer` already produces the envelope.
- **Rate limit** login per email+IP (a security control, not an institutional
  policy value). Logout revokes only the current token.

**Tests:** `tests/Feature/Api/V1/Auth/…` — valid login returns a token and the
exact envelope; wrong password, unknown email, and disabled user all return the
same generic 401; `me` requires a bearer token; logout revokes it and the same
token then fails; throttling engages; `last_login_at` updates. Extend the
existing `ApiSurfaceTest` route inventory to expect the three new routes.

## Task 8: Frontend Real Authentication

The existing `DemoAuthGateway` interface (`signIn(credentials) => Promise<Session>`)
is already the correct seam — implement a second gateway against it rather than
rewriting the auth layer.

**Assumption to confirm at review:** auth mode becomes
`"api" | "demo" | "disabled"` with **`api` as the default**. `demo` is retained
as an explicit opt-in so the UI still runs offline without XAMPP and Laravel
up, which also preserves the value of the existing 144 passing tests.

- `src/app/auth/auth-token.ts` — **the only** module that reads/writes/removes
  the token, in `localStorage`, per PRD §9.1. Note this differs from the demo
  session's `sessionStorage`; both may coexist, each owned by exactly one module.
- `src/app/services/api-client.ts` — add `postJson`, attach
  `Authorization: Bearer <token>`, and clear the token + route to sign-in on
  `401`. Keep `credentials: "omit"` and `cache: "no-store"`. This must remain
  the only module containing a raw `fetch(`.
- `src/app/services/auth-service.ts` — `login` / `logout` / `me` with strict Zod
  schemas that reject undeclared fields, matching the existing
  `health-service.ts` pattern.
- `src/app/auth/api-auth-gateway.ts` — implements the gateway interface against
  `auth-service`, mapping API errors to the existing user-facing error copy.
- Rename the shared types from `Demo*` to neutral names where they now serve
  both gateways; keep `demo-*` names for genuinely demo-only modules.
- Update `frontend/README.md` and `.env.example` for the new default mode.

**Tests:** extend the existing auth/login/router suites — successful API login
stores the token and routes to the portal; a 401 clears it; logout revokes and
clears; `demo` mode still works unchanged.

## Task 9: Documentation and Verification

- `docs/data-dictionary/identity-foundation.md` — the four tables, columns,
  types, constraints.
- `docs/runbooks/mariadb-local.md` — starting XAMPP MariaDB, creating
  principals, running migrations and the seeder, resetting the test database.
- `docs/api/openapi.yaml` — add the three auth endpoints and the bearer security
  scheme. Re-lint with Redocly.
- `docs/testing/DEMO_CREDENTIALS.md` — state clearly that these are UI-only
  fixtures for `demo` mode and are **not** database accounts; point to
  `SEEDED_IDENTITIES.md` for the real ones.
- Update `PROGRESS.md` and `README.md`.

---

## Verification

**Database and migrations**

```powershell
cd backend
php artisan migrate:fresh      # four tables created
php artisan migrate:rollback   # all dropped cleanly
php artisan migrate
$env:GRC_SEED_PASSWORD = '<generated>'; php artisan db:seed
```

Then confirm via `mysql.exe` that `grc_enrollment` holds nine users with nine
distinct roles, and that XAMPP's other databases and the MariaDB PID are
unchanged.

**Backend gate** (all must pass before any completion claim)

```powershell
composer format:check
composer analyse          # Larastan level 8
composer test             # unit + feature, against grc_enrollment_test
composer audit --locked
php artisan route:list --json   # exactly health + the three auth routes
```

**Live HTTP smoke** — start `php artisan serve`, then:

1. `POST /api/v1/auth/login` with a seeded identity → 200, token in the
   `AuthResource` envelope, `Cache-Control: no-store`
2. `GET /api/v1/auth/me` with that bearer → 200, correct role
3. `POST /api/v1/auth/logout` → 204/200
4. Reuse the revoked token → 401 `UNAUTHENTICATED`
5. Wrong password → 401 with the **same** message as unknown email
6. Repeated bad logins → 429 with `Retry-After`

**Frontend gate**

```powershell
cd frontend
npm run format:check; npm run lint; npm run lint:fast
npm run typecheck; npm test; npm run build
npm audit --audit-level=moderate
```

Run these **sequentially** — `PROGRESS.md` records that running Vitest,
TypeScript, and Prettier concurrently on this Windows worktree starves Vitest's
fork workers into timeout.

**End-to-end browser QA** — the `playwright` MCP server is connected this
session, so the live interaction pass that failed in every prior session
(`"No browser is available"`) should finally be possible. With Laravel and Vite
both running: load `/login`, sign in with a seeded identity, confirm the portal
renders the correct role, reload to confirm the token persists, sign out, and
confirm the protected route bounces back to login. Capture screenshots at
desktop and mobile widths. If the runtime is still unavailable, say so plainly
and claim no visual pass.

## Out of Scope

Password reset endpoints, authorization policies, `student_profiles`,
curricula, institutional term/status vocabularies, business workflow endpoints,
and CI. Institutional policy values from PRD §17 stay unconfirmed and must not
be hardcoded.
