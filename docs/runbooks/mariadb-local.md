# MariaDB Local Development Runbook

Covers the existing XAMPP MariaDB 10.4.32 instance used for local development
per ADR 0007 — **not** an isolated install. If `C:\xampp\mysql\bin\mysqld.exe`
is not already running, start it from the XAMPP Control Panel first.

## Known instability — read before touching privileges

This instance has crashed twice on this workstation, confirmed via Windows
Application Event Log (`Get-WinEvent -FilterHashtable @{LogName='Application';
ProviderName='Application Error'}`, filtered for `mysqld`):

- once independently, unrelated to any development session;
- once triggered by a schema-wildcard `GRANT ... ON dbname.* TO ...`
  statement, reproducibly, twice in a row, even immediately after a clean
  restart and a clean `CHECK TABLE mysql.db`.

**Use only table-level grants** (`GRANT ... ON dbname.specific_table TO
...`), never `GRANT ... ON dbname.* TO ...`, until this is resolved. Table-
level grants routed through `mysql.tables_priv` have been exercised 20+ times
without incident. Include `CREATE` in a grant to target a table that does not
exist yet — MySQL/MariaDB permits this for `CREATE` specifically; any other
privilege on a nonexistent table fails with `ERROR 1146`.

If MariaDB stops responding mid-command ("Lost connection to MySQL server
during query"), check `netstat -ano | findstr :3306` and the Windows Event Log
before assuming it was just a slow query.

## One-time setup: databases and principals

Run as `root` (no password on this instance; connects over `127.0.0.1:3306`).
Never pass a password as a command-line argument — pipe SQL via stdin.

```powershell
$appPw = <32-byte base64url secret, generated locally>
$migratorPw = <32-byte base64url secret, generated locally>
$testPw = <32-byte base64url secret, generated locally>

@"
CREATE DATABASE grc_enrollment      CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE grc_enrollment_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'grc_app'@'127.0.0.1'      IDENTIFIED BY '$appPw';
CREATE USER 'grc_migrator'@'127.0.0.1' IDENTIFIED BY '$migratorPw';
CREATE USER 'grc_test'@'127.0.0.1'     IDENTIFIED BY '$testPw';
"@ | & 'C:\xampp\mysql\bin\mysql.exe' -u root -h 127.0.0.1 -P 3306
```

Then grant `grc_migrator` and `grc_test` full DDL+DML on every planned table
name (`migrations`, `users`, `personal_access_tokens`, `programs`,
`academic_terms`) in their respective databases — see
`docs/superpowers/plans/2026-07-27-mariadb-identity-sanctum-auth.md` Task 2
for the exact statements. **Do not** grant `grc_app` anything yet; its
DML-only grants can only be issued after the tables exist (next section).

## Running migrations

Migrations run as `grc_migrator` via a dedicated Laravel connection, keeping
the app's default connection (`grc_app`) DML-only:

```powershell
cd backend
php artisan migrate --database=mariadb_migrator --force
```

After the first migration, grant `grc_app` its deferred DML privileges on the
four domain tables (not `migrations`):

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON grc_enrollment.users TO 'grc_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON grc_enrollment.personal_access_tokens TO 'grc_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON grc_enrollment.programs TO 'grc_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON grc_enrollment.academic_terms TO 'grc_app'@'127.0.0.1';
```

Verify: `php artisan tinker --execute="echo DB::table('users')->count();"`
should succeed; a `DB::statement('CREATE TABLE ...')` through the same
connection should fail (least privilege holds).

## Rolling back

```powershell
php artisan migrate:rollback --database=mariadb_migrator
```

Drops all four tables in reverse migration order. Re-run `migrate` to restore
them.

## Seeding the nine role identities

Every synthetic identity uses the shared password `password`. The seeder
refuses to run outside `local`/`testing`, and the password is stored only as a
Laravel hash.

```powershell
php artisan db:seed --class=RoleUserSeeder
```

See `docs/testing/SEEDED_IDENTITIES.md` for the nine emails/roles this
creates. Re-running updates the same nine rows; it does not duplicate or
touch unrelated users.

## Resetting the test database

The test suite uses `grc_enrollment_test` via `grc_test` (already has full
DDL rights on the five planned tables). `RefreshDatabase` in PHPUnit handles
migration/rollback automatically per test run — no manual reset is normally
needed. To force a clean rebuild:

```powershell
php artisan migrate:fresh --env=testing --force
```

## Environment files

- `backend/.env` — `grc_app`/`grc_migrator` credentials, gitignored.
- `backend/.env.testing` — `grc_test` credentials, gitignored.
- `backend/.env.example` / `.env.testing.example` — committed templates with
  empty passwords.

Never write a real password into any committed file, `PROGRESS.md`, or a
chat/log transcript.
