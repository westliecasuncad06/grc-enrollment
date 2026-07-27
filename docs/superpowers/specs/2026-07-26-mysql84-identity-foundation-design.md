# MySQL 8.4 Identity Foundation Design

**Status:** Superseded on 2026-07-27. The isolated MySQL 8.4 instance was
never provisioned (`C:\xampp\mysql84` was never created, port 3307 never
listened) after four rounds of independent review on the lifecycle scripts
alone. The user chose to use the existing XAMPP MariaDB 10.4.32 instance
instead. See `docs/adr/0007-mariadb-development-database.md` for the
rationale and `docs/superpowers/plans/2026-07-27-mariadb-identity-sanctum-auth.md`
for the replacement plan, which also folds in the Sanctum auth vertical
slice. This document is retained for historical record only; do not
implement against it.  
**Date:** 2026-07-26  
**Scope:** Phase 0 database foundation and deterministic nine-role identity
seed data

## Decision Summary

Provision MySQL Community Server 8.4.10 LTS as an isolated, portable Windows
installation beside XAMPP. It will listen only on `127.0.0.1:3307`; the
existing XAMPP MariaDB instance remains unchanged on port `3306`.

The repository will gain reproducible PowerShell lifecycle scripts, Laravel
connection examples, reversible identity-foundation migrations, a PHP-backed
role enum, and an idempotent development/test seeder with exactly one synthetic
user for each PRD role. The seed password must be supplied through an ignored
environment file and will never be committed or printed.

This slice deliberately stops before Sanctum, login APIs, authorization
policies, or production-like user provisioning. The current frontend demo
login remains a separate synthetic UI test harness until the real
authentication vertical slice is implemented.

## Evidence and Compatibility

- The official [MySQL Community Server download
  page](https://dev.mysql.com/downloads/mysql/8.4.html) identifies 8.4.10 as the
  current Windows x64 LTS ZIP and publishes MD5
  `150f12262df6ac88d43862a0e683eb81`.
- The official [MySQL 8.4 release
  notes](https://dev.mysql.com/doc/relnotes/mysql/8.4/en/news-8-4-10.html)
  identify 8.4.10 as the 2026-06-16 release.
- The official [Windows ZIP installation
  guidance](https://dev.mysql.com/doc/refman/8.4/en/windows-install-archive.html)
  supports a no-install archive with explicit base and data directories.
- The PRD requires supported MySQL 8 LTS, InnoDB, `utf8mb4`, strict SQL mode,
  UTC operation, reversible migrations, and MySQL-backed tests.
- The current workstation has XAMPP MariaDB 10.4.32 on port `3306`; that
  service is not a valid substitute for the PRD database target and must not
  be modified by this work.

## Goals

1. Establish an exact, supported MySQL 8.4 runtime without disrupting XAMPP.
2. Make startup, shutdown, status checks, and verification reproducible.
3. Create separate development and test databases with least-privileged
   accounts.
4. Add the minimum coherent relational identity schema needed for the next
   real-authentication slice.
5. Seed exactly one safe synthetic user for every PRD role.
6. Verify forward migration, rollback, reseeding, constraints, and MySQL-only
   test execution.
7. Document the installation, schema, credentials procedure, and handoff in
   `PROGRESS.md`.

## Non-Goals

- Replacing, upgrading, stopping, or reconfiguring XAMPP MariaDB.
- Exposing MySQL to the LAN or internet.
- Installing MySQL as an automatically starting Windows service.
- Committing server binaries, database files, logs, or secrets.
- Adding Sanctum, login/logout endpoints, authorization policies, or browser
  sessions.
- Implementing admissions, curriculum approvals, enrollment, billing,
  payments, posting, or reporting workflows.
- Seeding real student, employee, program, curriculum, or term data.
- Treating the current frontend demo accounts as database-authenticated users.

## Approaches Considered

### A. Portable MySQL 8.4 ZIP beside XAMPP — selected

The official ZIP is checksum-verified and extracted to an isolated directory.
Its own option file, data directory, log directory, port, and process lifecycle
keep it independent of XAMPP.

This has the smallest blast radius, preserves the existing local stack, pins
the exact supported version, and can be removed later without changing the
XAMPP installation.

### B. MySQL Installer/MSI Windows service

This is vendor-supported but adds global service registration and machine-wide
state. It raises the chance of port, startup, PATH, or operator confusion with
XAMPP. It is unnecessary for the local Phase 0 baseline.

### C. Continue on XAMPP MariaDB

This is operationally convenient but fails the PRD requirement and cannot prove
MySQL 8.4 compatibility. SQL modes, collation behavior, constraints, and other
engine behavior can differ.

## Runtime Topology

The local layout outside the repository will be:

```text
C:\xampp\mysql84\
├── server\       # extracted MySQL 8.4.10 binaries
├── data\         # initialized database files
├── logs\         # error and process logs
├── secrets\      # current-user DPAPI administrator credential
└── my.ini        # instance-specific configuration
```

The instance configuration will enforce:

```ini
[mysqld]
basedir=C:/xampp/mysql84/server
datadir=C:/xampp/mysql84/data
bind-address=127.0.0.1
port=3307
default-storage-engine=INNODB
character-set-server=utf8mb4
collation-server=utf8mb4_0900_ai_ci
default-time-zone=+00:00
sql-mode=STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
log-error=C:/xampp/mysql84/logs/mysql84-error.log
```

The implementation will validate accepted server variables after startup and
adjust only if MySQL 8.4 rejects a setting. It will not weaken strict mode or
UTC operation.

The MySQL process will be started explicitly from the pinned binary with the
instance option file. It will not be added to the machine `PATH` and will not
be registered as an automatic service. The start script will use a hidden
background process and refuse to start when port `3307` belongs to another
process.

The post-initialization administrator password is stored only as a Windows
DPAPI-encrypted `PSCredential` under the external `secrets` directory. Its ACL
is restricted to the current Windows user, it is not copied into Laravel, and
the lifecycle scripts never print it. Losing the Windows profile or moving the
encrypted file to another machine requires the documented MySQL administrator
recovery procedure.

## Download, Initialization, and Secret Handling

1. Download `mysql-8.4.10-winx64.zip` from the official MySQL distribution
   endpoint into a temporary directory.
2. Verify its MD5 against the official published value before extraction.
3. Extract to `C:\xampp\mysql84\server`.
4. Initialize a fresh data directory with MySQL's secure initialization path,
   which generates a temporary root password.
5. Start the server bound only to loopback, replace the expired temporary
   password, and create scoped database principals.
6. Do not include root or application passwords in command output, committed
   scripts, example files, Markdown, or `PROGRESS.md`.
7. Store local connection secrets only in ignored Laravel environment files.

If initialization fails, the scripts stop without changing XAMPP. They do not
automatically delete a partially initialized data directory; recovery or
removal requires an explicit, separately verified action.

## Database and Principal Model

Two databases will be created:

- `grc_enrollment` for local development.
- `grc_enrollment_test` for automated backend tests.

Three non-root principals keep runtime and schema-changing responsibilities
separate:

| Principal | Scope | Intended privileges |
| --- | --- | --- |
| `grc_app` | `grc_enrollment` | Runtime `SELECT`, `INSERT`, `UPDATE`, and `DELETE` |
| `grc_migrator` | `grc_enrollment` | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP`, `INDEX`, `REFERENCES`, and `CREATE TEMPORARY TABLES` |
| `grc_test` | `grc_enrollment_test` | The same migration and DML privileges, limited to the disposable test database |

All principals use a `127.0.0.1` host restriction. The root account is reserved
for instance administration. Laravel's normal application runtime uses
`grc_app`; migration commands use an explicitly named migration connection
whose credentials come from an ignored local environment file. Tests use only
`grc_test`.

The implementation must inspect effective grants and prove that `grc_app`
cannot create or drop tables after the schema exists.

## Repository Operations

The repository will add a focused `scripts/mysql84/` operator surface:

- `bootstrap.ps1` verifies prerequisites, obtains the official archive,
  verifies its checksum, initializes the instance, and creates the local
  databases and principals.
- `start.ps1` validates the paths and port before starting the pinned server.
- `stop.ps1` performs an authenticated graceful shutdown of this instance only.
- `status.ps1` reports the instance process, port, version, and health without
  exposing credentials.
- `README.md` documents prerequisites, expected paths, environment inputs,
  recovery, and verification.

Scripts will use explicit resolved paths, avoid broad recursive filesystem
operations, and never stop a process solely by executable name. Shutdown must
identify the MySQL 8.4 instance through its configured port and option file.

Bootstrap accepts secrets only through process-scoped environment variables:

- `GRC_MYSQL84_ADMIN_PASSWORD`
- `GRC_DB_APP_PASSWORD`
- `GRC_DB_MIGRATOR_PASSWORD`
- `GRC_DB_TEST_PASSWORD`
- `GRC_SEED_PASSWORD`

The script validates that each required secret is non-empty, avoids command-line
password arguments, and passes credentials through access-restricted temporary
client option files. Temporary credential files are removed immediately after
the relevant command and never placed inside the repository. Root credentials
remain an operator secret and are not copied into Laravel environment files.

The Laravel environment examples will document:

```dotenv
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3307
DB_DATABASE=grc_enrollment
DB_USERNAME=grc_app
DB_PASSWORD=
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_0900_ai_ci
```

Testing examples will point to `grc_enrollment_test` and `grc_test`. Migration
and seed commands will use separate ignored credentials. Example files keep
password values empty.

## Identity Foundation Schema

The first migration group contains three unambiguous PRD §10.1 base tables.
`student_profiles` is deliberately deferred because it depends on
`curricula`, approved contact fields, admission-status values, and
academic-standing values that are not yet confirmed. This prevents the
foundation from encoding unstated institutional policy. The deferred migration
will be designed together with the first authorized student-provisioning
slice.

### `users`

- `id`: unsigned big integer primary key.
- `name`: required display name.
- `email`: required, normalized by the application, globally unique.
- `password`: required password hash.
- `role`: required string backed by the application role enum.
- `status`: required string with the initial technical states `active` and
  `disabled`.
- `last_login_at`: nullable UTC timestamp.
- created and updated timestamps.

Roles remain application-backed strings rather than a MySQL `ENUM` so later
role evolution uses normal migrations and domain validation. The exact role
set is:

1. `student`
2. `admission_staff`
3. `faculty`
4. `program_chair`
5. `dean`
6. `executive_director`
7. `registrar_head`
8. `registrar_staff`
9. `accounting_staff`

### `programs`

- `id`: unsigned big integer primary key.
- `code`: required, globally unique.
- `name`: required.
- `status`: required string. Institutional program status values remain
  unconstrained until confirmed; no program is seeded in this slice.
- created and updated timestamps.

### `academic_terms`

- `id`: unsigned big integer primary key.
- `school_year`: required canonical string such as `2026-2027`.
- `semester`: required string.
- `starts_at`: nullable UTC datetime.
- `ends_at`: nullable UTC datetime.
- `enrollment_opens_at`: nullable UTC datetime.
- `enrollment_closes_at`: nullable UTC datetime.
- `status`: required string.
- created and updated timestamps.
- unique `(school_year, semester)`.

The schema stores term labels without asserting an institutional semester or
status vocabulary. Those policy values will be confirmed before term workflow
implementation. No term is seeded in this slice.

The three tables are independent in this slice. Later migrations will add
foreign keys only when their parent tables and policy fields are approved.
Rollback drops the three tables in reverse migration order.

## Application Types

`App\Domain\Identity\UserRole` will be a backed PHP enum containing exactly the
nine PRD roles. It will provide labels for internal display without embedding
authorization rules.

The `User` model will cast `role` to `UserRole` and use an explicit status
representation. Role checks remain value comparisons in this phase; policies
arrive with the real authentication vertical slice.

## Deterministic Seeder

The development/test seeder will upsert exactly these synthetic identities:

| Role | Email |
| --- | --- |
| Student | `student.seed@grc.test` |
| Admission | `admission.seed@grc.test` |
| Faculty | `faculty.seed@grc.test` |
| Chair | `chair.seed@grc.test` |
| Dean | `dean.seed@grc.test` |
| Executive | `executive.seed@grc.test` |
| Registrar Head | `registrar-head.seed@grc.test` |
| Registrar Staff | `registrar-staff.seed@grc.test` |
| Accounting | `accounting.seed@grc.test` |

Names and emails are deterministic; passwords come from
`GRC_SEED_PASSWORD`, are hashed through Laravel, and are never written to
documentation or logs. Seeding fails closed when the variable is absent.
Execution is allowed only in `local` and `testing` environments.

Re-running the seeder updates the nine matching synthetic identities without
creating duplicates. It neither deletes unrelated users nor creates programs,
academic terms, curricula, or student profiles. The seeded `student` identity
therefore has no profile until a later approved migration and development
fixture explicitly create one.

These accounts are database fixtures, not working portal credentials until the
Sanctum slice connects the frontend to Laravel. The existing
`docs/testing/DEMO_CREDENTIALS.md` continues to document the UI-only demo
accounts.

## Test-Driven Implementation Boundary

Implementation starts with failing tests for:

1. The role enum contains exactly the nine PRD values.
2. Each migration creates the expected columns and indexes on MySQL.
3. User email, program code, and term identity constraints reject duplicates.
4. The seeder requires an environment password and rejects unsafe
   environments.
5. One seed run creates exactly one active user per role.
6. Repeated seed runs remain idempotent.
7. Migration rollback and re-migration succeed in dependency-safe order.
8. The test connection reports MySQL 8.4, InnoDB defaults, `utf8mb4`, strict
   mode, and UTC.
9. The runtime principal cannot perform schema DDL.

The acceptance gate will run:

```powershell
php artisan migrate:fresh --seed
php artisan migrate:rollback
php artisan migrate
php artisan test
composer validate --strict
```

Connection-sensitive commands must explicitly prove they target port `3307`
and the expected database before mutation. SQLite is not an accepted
substitute for these integration tests.

## Documentation Changes

Implementation will update:

- `backend/.env.example` and a safe testing environment example.
- `backend/README.md` with MySQL 8.4 setup and migration commands.
- `docs/architecture/version-compatibility.md` with the exact local baseline.
- The schema/data-dictionary documentation for these three tables.
- `docs/testing/DEMO_CREDENTIALS.md` with a clear boundary between UI-only
  demo accounts and future database-authenticated identities.
- `PROGRESS.md` after each completed implementation checkpoint.

No Markdown file will contain a real root, migrator, application, test, or seed
password.

## Failure and Recovery Behavior

- A checksum mismatch stops before extraction.
- An occupied port stops before starting MySQL.
- A version mismatch stops before database creation or migration.
- A failed initialization leaves diagnostic logs but does not alter MariaDB.
- A failed migration rolls back its transaction where MySQL permits and reports
  the exact migration; it does not automatically drop existing databases.
- A failed seed does not delete existing users.
- Stopping MySQL 8.4 does not stop XAMPP services.

Removal is intentionally manual: stop and verify the MySQL 8.4 instance first,
then preserve or back up its data before any deletion. No uninstall or cleanup
command is part of the normal setup workflow.

## Acceptance Criteria

The slice is complete when:

- MySQL 8.4.10 answers on `127.0.0.1:3307`.
- XAMPP MariaDB remains available on its original port and configuration.
- Server queries prove InnoDB, `utf8mb4`, strict mode, and UTC settings.
- Development and test databases exist with inspected scoped grants.
- The three migrations run forward, roll back, and run forward again.
- The enum and seeder produce exactly the nine PRD roles.
- Repeated seeding produces no duplicates and exposes no password.
- Laravel integration tests use MySQL 8.4 and pass.
- The runtime principal is denied schema-changing operations.
- Documentation and `PROGRESS.md` accurately describe the verified state.
- No real authentication functionality is claimed until the subsequent
  Sanctum slice is completed.

## Next Slice

After this foundation passes its acceptance gate, the next design and plan will
cover one real Sanctum bearer-authentication vertical slice: login, current
user, logout, server-side role authorization, stable `401`/`403` envelopes, and
frontend replacement of the synthetic session adapter. It will reuse the
database role enum and seeded local identities defined here.
