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

## Server will not start — Aria checkpoint/recovery failure

A **different** failure mode from the GRANT crash above: `mysqld` aborts on
every startup attempt, with `mysql_error.log` showing this exact cascade
(read bottom-up — it is one fault, not several):

```
Cannot find checkpoint record at LSN (1,0x......)
[ERROR] mysqld.exe: Aria recovery failed. Please run aria_chk -r on all Aria
        tables and delete all aria_log.######## files
[ERROR] Plugin 'Aria' registration as a STORAGE ENGINE failed.
[ERROR] Could not open mysql.plugin table. Some plugins may be not loaded
[ERROR] Failed to initialize plugins.
[ERROR] Aborting
```

The Aria transaction log's control file points at a checkpoint record that is
no longer in the log (e.g. after an unclean shutdown). Since every table in
the `mysql` system schema is Aria, the engine failing to register means
`mysql.plugin` can't open and the whole server aborts. **This does not
threaten `grc_enrollment` data** — it is InnoDB, and InnoDB recovers
independently of the Aria log.

Confirm `mysqld` is fully stopped (`Get-Process mysqld`, `netstat -ano |
findstr :3306`) before touching anything below.

1. **Back up outside the data directory** (MariaDB treats every subdirectory
   under `data\` as a schema, so a backup placed inside it becomes a bogus
   database): copy `C:\xampp\mysql\data\mysql\` and both `aria_log*` files to
   e.g. `C:\xampp\mysql\data_backup_<date>\`.
2. **Repair every `.MAI` file in `C:\xampp\mysql\data\mysql\`**, always with
   `--datadir=C:\xampp\mysql\data --require-control-file` (see gotcha below):
   ```powershell
   cd C:\xampp\mysql\data\mysql
   Get-ChildItem *.MAI | ForEach-Object {
     & C:\xampp\mysql\bin\aria_chk.exe --datadir=C:\xampp\mysql\data --require-control-file -r $_.Name
   }
   ```
3. **Delete `C:\xampp\mysql\data\aria_log.00000001` and
   `C:\xampp\mysql\data\aria_log_control`.** Both regenerate on next startup.
   Leaving `aria_log_control` behind makes the server hunt for the same
   missing checkpoint again.
4. **Start MySQL** (XAMPP Control Panel, or `C:\xampp\mysql_start.bat` — note
   that script's window sometimes doesn't launch mysqld reliably; if the error
   log shows no new timestamp after a start attempt, invoke
   `mysqld.exe --defaults-file=mysql\bin\my.ini --standalone` directly instead).

### Gotcha: `--datadir` is required, or repair silently fails to re-stamp tables

Running `aria_chk -r` from *inside* `data\mysql\` with a bare relative
filename (`aria_chk -r plugin.MAI`) makes it look for `.\aria_log_control` —
i.e. `data\mysql\aria_log_control` — which does not exist (the real one is one
level up, in `data\`). It prints `Got error 'Can't find file' when trying to
use aria control file '.\aria_log_control'` and still exits 0, having repaired
the table *without* consulting the log. The result: `mysqld` starts and the
table looks intact (`SHOW GRANTS`, `SELECT` all work), but
`CHECK TABLE mysql.<table>` reports:

```
Table is from another system and must be zerofilled or repaired to be usable on this system
Corrupt
```

This hit exactly the privilege tables (`plugin`, `db`, `global_priv`,
`tables_priv`, `columns_priv`, `procs_priv`) after a checkpoint-recovery
incident — the ones stamped with an LSN from before the log was reset. Fix:

```powershell
cd C:\xampp\mysql\data\mysql
& C:\xampp\mysql\bin\aria_chk.exe --datadir=C:\xampp\mysql\data --require-control-file -z <table>.MAI
```
`-z` (`--zerofill`) is what actually clears the stale cross-system stamp;
plain `-r` repair alone does not, even once `--datadir` is fixed.
`--require-control-file` makes `aria_chk` abort loudly instead of silently
degrading if it still can't find the log — use it on every invocation during
this recovery. Restart `mysqld` and re-run `CHECK TABLE` after zerofilling; it
should report `OK`. Re-run `SHOW GRANTS FOR '<user>'@'<host>';` for `grc_app`,
`grc_migrator`, `grc_test`, and `pma` afterward to confirm privileges survived.

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

### Gotcha: every new table needs its own grant, or `grc_app` gets a silent 500

Each migration that adds a table requires its own follow-up `GRANT SELECT,
INSERT, UPDATE, DELETE ON grc_enrollment.<table> TO 'grc_app'@'127.0.0.1';` —
there is no wildcard grant (see the crash history above), so this is easy to
forget on a table added late in a slice. The failure mode is a plain HTTP 500
from the API (`SQLSTATE[42000]... SELECT command denied to user 'grc_app'`),
which looks like an application bug until you check `SHOW GRANTS FOR
'grc_app'@'127.0.0.1'`. `enrollment_change_requests` (added in the Phase 7
add/drop slice) missed this step and stayed 500 until caught during the Phase
10 live walkthrough; its grant was added the same way as the four above.

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
