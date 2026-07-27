# MySQL 8.4 Identity Foundation Implementation Plan

> **SUPERSEDED on 2026-07-27.** Tasks 1-2 (identity enums, User model,
> PowerShell safety library) completed. Task 3 entered a four-round
> independent review loop over lifecycle-script hardening without ever
> executing the scripts once; `C:\xampp\mysql84` was never created. The user
> chose to use the existing XAMPP MariaDB 10.4.32 instance instead of an
> isolated MySQL 8.4 install. Tasks 2, 3, and 5 (PowerShell bootstrap/
> lifecycle/provisioning) are dropped entirely; Tasks 1, 4, 6-9 carry
> forward, adapted for MariaDB, under
> `docs/superpowers/plans/2026-07-27-mariadb-identity-sanctum-auth.md`, which
> also adds the Sanctum authentication vertical slice. Do not execute
> anything below this notice.

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Use
> `superpowers:test-driven-development` for every behavior change,
> `superpowers:systematic-debugging` for unexpected failures, and
> `superpowers:verification-before-completion` before any completion claim.
> Do not delegate unless the user explicitly authorizes subagents.

**Goal:** Provision a loopback-only MySQL 8.4.10 LTS instance beside XAMPP and
deliver the first reversible, MySQL-tested Laravel identity foundation with one
safe seeded account for every GRC role.

**Architecture:** An official portable MySQL ZIP is checksum-verified and
operated through repository-owned PowerShell scripts while its binaries, data,
logs, configuration, and secrets remain outside Git. Laravel uses separate
runtime, migration, and disposable-test principals. Three PRD §10.1 tables and
a canonical nine-role PHP enum provide the smallest coherent foundation for
the later Sanctum vertical slice.

**Tech Stack:** Windows PowerShell 5.1+, MySQL Community Server 8.4.10 LTS,
InnoDB, `utf8mb4_0900_ai_ci`, PHP 8.2.12 compatibility bridge, Laravel 12.64,
Eloquent, PHPUnit 11.5, Laravel Pint, and Larastan/PHPStan level 8.

**Approved design:**
`docs/superpowers/specs/2026-07-26-mysql84-identity-foundation-design.md`

## Global Constraints

- Read `AGENTS.md`, `PRD.md`, the approved design, and all of `PROGRESS.md`
  before execution.
- Update `PROGRESS.md` before every substantial task, after every meaningful
  milestone or failure, and before ending.
- Work in an isolated worktree created with
  `superpowers:using-git-worktrees`; preserve the current dirty `main`
  checkout and its verified login correction.
- Do not commit or push. `AGENTS.md` requires explicit user authorization,
  which has not been provided for this implementation.
- Do not stop, reconfigure, overwrite, upgrade, or delete
  `C:\xampp\mysql`, XAMPP MariaDB, or its data.
- Pin MySQL to official Windows x64 ZIP `mysql-8.4.10-winx64.zip`; require MD5
  `150f12262df6ac88d43862a0e683eb81` before extraction.
- Use `C:\xampp\mysql84` for the isolated instance and
  `127.0.0.1:3307` for TCP. Never bind to `0.0.0.0`.
- Do not register an automatic Windows service and do not add MySQL to the
  machine `PATH`.
- Keep server binaries, archives, `my.ini`, data, logs, generated client option
  files, the DPAPI-protected administrator credential, `.env`, `.env.testing`,
  and every password outside version control.
- Never pass a password as a command-line argument, print it, include it in a
  Markdown file, or record it in `PROGRESS.md`.
- Generate local secrets with a cryptographically secure random source and
  restrict them to the base64url alphabet `[A-Za-z0-9_-]`.
- Keep XAMPP MariaDB on port `3306`; abort if port `3307` belongs to any
  unrelated process.
- Use database `grc_enrollment` for local development and
  `grc_enrollment_test` for tests.
- Use `grc_app@127.0.0.1` for runtime DML, `grc_migrator@127.0.0.1` for
  development DDL/DML, and `grc_test@127.0.0.1` for disposable-test DDL/DML.
- Store UTC, enable strict SQL mode, use InnoDB and `utf8mb4`, and run
  database integration tests only against MySQL 8.4.
- Canonical role values are exactly `student`, `admission_staff`, `faculty`,
  `program_chair`, `dean`, `executive_director`, `registrar_head`,
  `registrar_staff`, and `accounting_staff`.
- Do not introduce Sanctum, login/logout APIs, bearer tokens, policies,
  student profiles, curricula, institutional term/status vocabularies, or any
  workflow endpoint in this slice.
- The frontend `docs/testing/DEMO_CREDENTIALS.md` accounts remain UI-only and
  must not share a password with database seed identities.

## Planned File Map

```text
scripts/mysql84/MySql84.Common.ps1
scripts/mysql84/bootstrap.ps1
scripts/mysql84/start.ps1
scripts/mysql84/status.ps1
scripts/mysql84/stop.ps1
scripts/mysql84/README.md
scripts/mysql84/tests/MySql84.Common.Tests.ps1
scripts/mysql84/tests/ScriptSafety.Scan.ps1

backend/.env.example
backend/.env.testing.example
backend/.gitignore
backend/config/database.php
backend/config/grc.php
backend/phpunit.xml
backend/app/Domain/Identity/UserRole.php
backend/app/Domain/Identity/UserStatus.php
backend/app/Models/User.php
backend/database/migrations/2026_07_26_000001_create_users_table.php
backend/database/migrations/2026_07_26_000002_create_programs_table.php
backend/database/migrations/2026_07_26_000003_create_academic_terms_table.php
backend/database/seeders/RoleUserSeeder.php
backend/database/seeders/DatabaseSeeder.php
backend/tests/Unit/Domain/Identity/UserRoleTest.php
backend/tests/Unit/Domain/Identity/UserStatusTest.php
backend/tests/Unit/Models/UserTest.php
backend/tests/Feature/Database/DatabaseConfigurationTest.php
backend/tests/Feature/Database/IdentityFoundationMigrationTest.php
backend/tests/Feature/Database/RoleUserSeederTest.php
backend/tests/Feature/Database/MySql84EnvironmentTest.php
backend/tests/Feature/Database/RuntimeDatabasePrivilegeTest.php
backend/README.md

docs/architecture/version-compatibility.md
docs/data-dictionary/identity-foundation.md
docs/runbooks/mysql84-local.md
docs/testing/DEMO_CREDENTIALS.md
docs/testing/SEEDED_IDENTITIES.md
PROGRESS.md
```

## Task 1: Canonical Identity Types and User Model

**Files:**

- Create: `backend/app/Domain/Identity/UserRole.php`
- Create: `backend/app/Domain/Identity/UserStatus.php`
- Create: `backend/app/Models/User.php`
- Create: `backend/tests/Unit/Domain/Identity/UserRoleTest.php`
- Create: `backend/tests/Unit/Domain/Identity/UserStatusTest.php`
- Create: `backend/tests/Unit/Models/UserTest.php`
- Modify: `PROGRESS.md`

**Interfaces:**

- Produces: `App\Domain\Identity\UserRole: string`
- Produces: `App\Domain\Identity\UserStatus: string`
- Produces: `App\Models\User extends Illuminate\Foundation\Auth\User`
- `User::$casts` maps `role` to `UserRole`, `status` to `UserStatus`, and
  `last_login_at` to `immutable_datetime`.

- [ ] **Step 1: Record Task 1 start in `PROGRESS.md`**

State that the task is database-independent, that no schema exists yet, and
that only canonical technical identity types are being added.

- [ ] **Step 2: Write the failing role tests**

```php
<?php

namespace Tests\Unit\Domain\Identity;

use App\Domain\Identity\UserRole;
use PHPUnit\Framework\TestCase;

final class UserRoleTest extends TestCase
{
    public function test_role_values_match_the_nine_prd_actors(): void
    {
        self::assertSame([
            'student',
            'admission_staff',
            'faculty',
            'program_chair',
            'dean',
            'executive_director',
            'registrar_head',
            'registrar_staff',
            'accounting_staff',
        ], array_column(UserRole::cases(), 'value'));
    }

    public function test_role_labels_are_stable_and_human_readable(): void
    {
        self::assertSame('Program Chair', UserRole::ProgramChair->label());
        self::assertSame('Accounting Staff', UserRole::AccountingStaff->label());
    }
}
```

```php
<?php

namespace Tests\Unit\Domain\Identity;

use App\Domain\Identity\UserStatus;
use PHPUnit\Framework\TestCase;

final class UserStatusTest extends TestCase
{
    public function test_account_statuses_are_only_technical_access_states(): void
    {
        self::assertSame(
            ['active', 'disabled'],
            array_column(UserStatus::cases(), 'value'),
        );
    }
}
```

```php
<?php

namespace Tests\Unit\Models;

use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Models\User;
use PHPUnit\Framework\TestCase;

final class UserTest extends TestCase
{
    public function test_identity_attributes_use_the_canonical_enum_casts(): void
    {
        $user = new User();
        $user->forceFill([
            'role' => 'program_chair',
            'status' => 'active',
        ]);

        self::assertSame(UserRole::ProgramChair, $user->role);
        self::assertSame(UserStatus::Active, $user->status);
        self::assertContains('password', $user->getHidden());
    }
}
```

- [ ] **Step 3: Run the tests and confirm the expected failure**

Run from `backend/`:

```powershell
php artisan test tests/Unit/Domain/Identity/UserRoleTest.php tests/Unit/Domain/Identity/UserStatusTest.php tests/Unit/Models/UserTest.php
```

Expected: failure because `UserRole` and `UserStatus` do not exist.

- [ ] **Step 4: Implement the two backed enums**

```php
<?php

namespace App\Domain\Identity;

enum UserRole: string
{
    case Student = 'student';
    case AdmissionStaff = 'admission_staff';
    case Faculty = 'faculty';
    case ProgramChair = 'program_chair';
    case Dean = 'dean';
    case ExecutiveDirector = 'executive_director';
    case RegistrarHead = 'registrar_head';
    case RegistrarStaff = 'registrar_staff';
    case AccountingStaff = 'accounting_staff';

    public function label(): string
    {
        return match ($this) {
            self::Student => 'Student',
            self::AdmissionStaff => 'Admission Staff',
            self::Faculty => 'Professor / Faculty',
            self::ProgramChair => 'Program Chair',
            self::Dean => 'Dean',
            self::ExecutiveDirector => 'Executive Director',
            self::RegistrarHead => 'Registrar Head',
            self::RegistrarStaff => 'Registrar Staff',
            self::AccountingStaff => 'Accounting Staff',
        };
    }
}
```

```php
<?php

namespace App\Domain\Identity;

enum UserStatus: string
{
    case Active = 'active';
    case Disabled = 'disabled';
}
```

- [ ] **Step 5: Add the narrow Eloquent user model**

```php
<?php

namespace App\Models;

use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use Illuminate\Foundation\Auth\User as Authenticatable;

final class User extends Authenticatable
{
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'status',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'role' => UserRole::class,
            'status' => UserStatus::class,
            'last_login_at' => 'immutable_datetime',
        ];
    }
}
```

Do not add `HasApiTokens`; Sanctum is outside this slice.

- [ ] **Step 6: Run focused and static checks**

```powershell
php artisan test tests/Unit/Domain/Identity/UserRoleTest.php tests/Unit/Domain/Identity/UserStatusTest.php tests/Unit/Models/UserTest.php
composer format:check
composer analyse
```

Expected: both unit files pass; Pint and PHPStan exit zero.

- [ ] **Step 7: Record the Task 1 checkpoint**

Update `PROGRESS.md` with the exact checks and results. Do not commit.

## Task 2: PowerShell Safety Library

**Files:**

- Create: `scripts/mysql84/MySql84.Common.ps1`
- Create: `scripts/mysql84/tests/MySql84.Common.Tests.ps1`
- Modify: `PROGRESS.md`

**Interfaces:**

- Produces:
  `Get-GrcMySql84Layout -InstanceRoot $absolutePath -> PSCustomObject`
- Produces: `Assert-GrcMySql84PortIsFree -Port $tcpPort -> void`
- Produces: `Get-GrcRequiredSecret -Name $environmentName -> string`
- Produces:
  `New-GrcMySqlClientOptionFile -User $name -Password $secret -> string`
- Produces: `Remove-GrcSecretFile -LiteralPath $absolutePath -> void`
- Produces:
  `Set-GrcEnvironmentValue -LiteralPath $file -Name $name -Value $value`
- Produces:
  `Save-GrcAdminCredential -LiteralPath $file -Password $secret -> void`
- Produces:
  `Get-GrcAdminCredential -LiteralPath $file -> PSCredential`

- [ ] **Step 1: Record Task 2 start in `PROGRESS.md`**

Document that the repository script library is being tested before any
download, process start, or external directory creation.

- [ ] **Step 2: Write a dependency-free failing PowerShell test harness**

The test file dot-sources the common library and uses explicit throwing
assertions:

```powershell
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot '..\MySql84.Common.ps1')

function Assert-GrcEqual {
    param([object] $Expected, [object] $Actual, [string] $Message)
    if ($Expected -ne $Actual) {
        throw "$Message Expected '$Expected' but received '$Actual'."
    }
}

$layout = Get-GrcMySql84Layout -InstanceRoot 'C:\xampp\mysql84'
Assert-GrcEqual 'C:\xampp\mysql84\server' $layout.ServerRoot 'server root'
Assert-GrcEqual 'C:\xampp\mysql84\data' $layout.DataRoot 'data root'
Assert-GrcEqual 'C:\xampp\mysql84\logs' $layout.LogRoot 'log root'
Assert-GrcEqual 'C:\xampp\mysql84\my.ini' $layout.OptionFile 'option file'

$secretA = -join ('A' * 43)
$secretB = -join ('B' * 43)
$secretC = -join ('C' * 43)

$env:GRC_TEST_SECRET = $secretA
try {
    Assert-GrcEqual $secretA (Get-GrcRequiredSecret -Name 'GRC_TEST_SECRET') 'secret'
} finally {
    Remove-Item Env:\GRC_TEST_SECRET
}

$missingSecretFailed = $false
try {
    Get-GrcRequiredSecret -Name 'GRC_TEST_SECRET'
} catch {
    $missingSecretFailed = $true
}
Assert-GrcEqual $true $missingSecretFailed 'missing secret must fail closed'

$optionFile = New-GrcMySqlClientOptionFile -User 'grc_test' -Password $secretB
try {
    $content = [IO.File]::ReadAllText($optionFile)
    Assert-GrcEqual $true ($content.Contains('user=grc_test')) 'client user'
    Assert-GrcEqual $true ($content.Contains('password=')) 'client password entry'
} finally {
    Remove-GrcSecretFile -LiteralPath $optionFile
}
Assert-GrcEqual $false (Test-Path -LiteralPath $optionFile) 'secret file removal'

$credentialTestRoot = Join-Path (
    [IO.Path]::GetTempPath()
) "grc-mysql-admin-test-$([guid]::NewGuid().ToString('N'))"
$credentialSecretsRoot = Join-Path $credentialTestRoot 'secrets'
$credentialPath = Join-Path $credentialSecretsRoot 'mysql84-admin.credential'
try {
    Save-GrcAdminCredential -LiteralPath $credentialPath -Password $secretC
    $credential = Get-GrcAdminCredential -LiteralPath $credentialPath
    Assert-GrcEqual 'root' $credential.UserName 'administrator user'
    Assert-GrcEqual $secretC $credential.GetNetworkCredential().Password 'DPAPI round trip'
} finally {
    if (Test-Path -LiteralPath $credentialPath) {
        Remove-GrcSecretFile -LiteralPath $credentialPath
    }
    if (
        (Test-Path -LiteralPath $credentialSecretsRoot) -and
        @(Get-ChildItem -LiteralPath $credentialSecretsRoot -Force).Count -eq 0
    ) {
        Remove-Item -LiteralPath $credentialSecretsRoot
    }
    if (
        (Test-Path -LiteralPath $credentialTestRoot) -and
        @(Get-ChildItem -LiteralPath $credentialTestRoot -Force).Count -eq 0
    ) {
        Remove-Item -LiteralPath $credentialTestRoot
    }
}
```

- [ ] **Step 3: Run the harness and confirm failure**

Run from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mysql84/tests/MySql84.Common.Tests.ps1
```

Expected: failure because `MySql84.Common.ps1` does not exist.

- [ ] **Step 4: Implement the common safety functions**

The common file must:

```powershell
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-GrcMySql84Layout {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string] $InstanceRoot)

    $resolvedRoot = [IO.Path]::GetFullPath($InstanceRoot)
    [pscustomobject]@{
        InstanceRoot = $resolvedRoot
        ServerRoot = Join-Path $resolvedRoot 'server'
        DataRoot = Join-Path $resolvedRoot 'data'
        LogRoot = Join-Path $resolvedRoot 'logs'
        OptionFile = Join-Path $resolvedRoot 'my.ini'
        MySqlExe = Join-Path $resolvedRoot 'server\bin\mysql.exe'
        MySqlAdminExe = Join-Path $resolvedRoot 'server\bin\mysqladmin.exe'
        MySqlServerExe = Join-Path $resolvedRoot 'server\bin\mysqld.exe'
    }
}

function Get-GrcRequiredSecret {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string] $Name)

    $value = [Environment]::GetEnvironmentVariable($Name, 'Process')
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Required process environment variable '$Name' is missing."
    }
    if ($value -notmatch '^[A-Za-z0-9_-]{43}$') {
        throw "'$Name' must be a 43-character base64url secret."
    }
    $value
}

function Assert-GrcMySql84PortIsFree {
    [CmdletBinding()]
    param([Parameter(Mandatory)][ValidateRange(1, 65535)][int] $Port)

    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
    if ($listeners.Count -gt 0) {
        throw "TCP port $Port already has a listener."
    }
}
```

`New-GrcMySqlClientOptionFile` must create a uniquely named file in the Windows
temporary directory, escape backslashes and double quotes for MySQL option-file
syntax, write only a `[client]` section with user/password/host/port/protocol,
and restrict its ACL to the current Windows identity.
`Remove-GrcSecretFile` must resolve the exact file, verify it is under the
Windows temporary directory, then remove only that file with `-LiteralPath`.

`Set-GrcEnvironmentValue` must update one exact `NAME=value` line or append it,
use `[IO.File]::WriteAllLines`, and never return or log the value.

`Save-GrcAdminCredential` must create the exact parent `secrets` directory,
convert the administrator password to `SecureString`, export a `PSCredential`
for user `root` through Windows DPAPI with `Export-Clixml`, and restrict both
that dedicated directory and the file ACLs to the current Windows identity.
It must never change the ACL of the shared Windows temporary directory; tests
use a unique temporary child directory whose immediate parent is `secrets`.
`Get-GrcAdminCredential` must use `Import-Clixml`, require a
`PSCredential`, and reject a user other than `root`. The encrypted file is
usable only by the same Windows user on the same machine.

- [ ] **Step 5: Add failure-path assertions**

Extend the harness to prove:

- a 42-character secret is rejected;
- punctuation outside base64url is rejected;
- a client option file resolves under `[IO.Path]::GetTempPath()`;
- `Remove-GrcSecretFile` rejects a path outside the temp directory;
- environment-value replacement leaves unrelated lines byte-for-byte equal.

Use these exact checks:

```powershell
foreach ($invalid in @((-join ('A' * 42)), ((-join ('A' * 42)) + '!'))) {
    $env:GRC_TEST_SECRET = $invalid
    $failed = $false
    try {
        Get-GrcRequiredSecret -Name 'GRC_TEST_SECRET'
    } catch {
        $failed = $true
    } finally {
        Remove-Item Env:\GRC_TEST_SECRET -ErrorAction SilentlyContinue
    }
    Assert-GrcEqual $true $failed 'invalid secret rejection'
}

$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
Assert-GrcEqual $true (
    [IO.Path]::GetFullPath($optionFile).StartsWith(
        $tempRoot,
        [StringComparison]::OrdinalIgnoreCase
    )
) 'client option file location'

$outsideRemovalFailed = $false
try {
    Remove-GrcSecretFile -LiteralPath $PSCommandPath
} catch {
    $outsideRemovalFailed = $true
}
Assert-GrcEqual $true $outsideRemovalFailed 'outside-temp removal rejection'

$environmentFile = Join-Path $tempRoot 'grc-env-update-test.env'
try {
    [IO.File]::WriteAllLines($environmentFile, @('KEEP=unchanged', 'TARGET=old'))
    Set-GrcEnvironmentValue -LiteralPath $environmentFile -Name 'TARGET' -Value 'new'
    Assert-GrcEqual 'KEEP=unchanged|TARGET=new' (
        [IO.File]::ReadAllLines($environmentFile) -join '|'
    ) 'environment update'
} finally {
    Remove-GrcSecretFile -LiteralPath $environmentFile
}
```

- [ ] **Step 6: Run the safety harness twice**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mysql84/tests/MySql84.Common.Tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mysql84/tests/MySql84.Common.Tests.ps1
```

Expected: both runs exit zero and leave no `grc-mysql-client-*.cnf` test file.

- [ ] **Step 7: Record the Task 2 checkpoint**

Record both harness runs and any recovered failure in `PROGRESS.md`. Do not
commit.

## Task 3: MySQL Bootstrap and Lifecycle Scripts

**Files:**

- Create: `scripts/mysql84/bootstrap.ps1`
- Create: `scripts/mysql84/start.ps1`
- Create: `scripts/mysql84/status.ps1`
- Create: `scripts/mysql84/stop.ps1`
- Create: `scripts/mysql84/tests/ScriptSafety.Scan.ps1`
- Create: `scripts/mysql84/README.md`
- Modify: `PROGRESS.md`

**Interfaces:**

- `bootstrap.ps1 -InstanceRoot C:\xampp\mysql84 -BackendPath (Resolve-Path .\backend).Path`
- `start.ps1 -InstanceRoot C:\xampp\mysql84`
- `status.ps1 -InstanceRoot C:\xampp\mysql84`
- `stop.ps1 -InstanceRoot C:\xampp\mysql84`
- Bootstrap consumes process secrets
  `GRC_MYSQL84_ADMIN_PASSWORD`, `GRC_DB_APP_PASSWORD`,
  `GRC_DB_MIGRATOR_PASSWORD`, `GRC_DB_TEST_PASSWORD`, and
  `GRC_SEED_PASSWORD`.
- Bootstrap writes local ignored `.env` and `.env.testing` values without
  printing any secret.

- [ ] **Step 1: Record Task 3 start**

State in `PROGRESS.md` that script-contract tests precede network download and
that the scripts must preserve MariaDB.

- [ ] **Step 2: Create the static script-safety lint gate**

```powershell
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$required = @('bootstrap.ps1', 'start.ps1', 'status.ps1', 'stop.ps1')

foreach ($name in $required) {
    $path = Join-Path $scriptRoot $name
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Missing lifecycle script: $name"
    }

    $source = [IO.File]::ReadAllText($path)
    if ($source -match '--password=') {
        throw "$name exposes a password argument."
    }
    if ($source -match 'Stop-Process\s+-Name') {
        throw "$name may not stop MySQL by executable name."
    }
    if ($source -match 'Remove-Item[^\r\n]+-Recurse') {
        throw "$name may not recursively remove instance paths."
    }
    if ($source -match '0\.0\.0\.0') {
        throw "$name may not expose the database beyond loopback."
    }
}
```

- [ ] **Step 3: Run the safety lint and confirm missing scripts are rejected**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mysql84/tests/ScriptSafety.Scan.ps1
```

Expected: nonzero exit listing the first missing lifecycle script. This is a
static security lint result, not behavioral test evidence. Task 5 performs the
real start/status/stop and isolation behavior verification.

- [ ] **Step 4: Implement `bootstrap.ps1` with exact guarded phases**

The script uses `SupportsShouldProcess` and performs these phases in order:

```powershell
[CmdletBinding(SupportsShouldProcess)]
param(
    [string] $InstanceRoot = 'C:\xampp\mysql84',
    [Parameter(Mandatory)][string] $BackendPath
)

$downloadUri = 'https://dev.mysql.com/get/Downloads/MySQL-8.4/mysql-8.4.10-winx64.zip'
$expectedMd5 = '150f12262df6ac88d43862a0e683eb81'
$port = 3307
$layout = Get-GrcMySql84Layout -InstanceRoot $InstanceRoot
```

1. Resolve `InstanceRoot` and `BackendPath`; require that the backend path
   contains `artisan`, `.env.example`, and `.env.testing.example`.
2. Reject an instance root equal to or nested beneath `C:\xampp\mysql`.
3. Require all five process secrets through `Get-GrcRequiredSecret`.
4. Require port `3307` to be free.
5. Download the exact ZIP to a unique temporary path.
6. Compute MD5 and stop before extraction unless it equals the pinned value.
7. Extract into a unique staging directory; require exactly one
   `mysql-8.4.10-winx64\bin\mysqld.exe`.
8. Create the four isolated directories and move only the verified extracted
   server directory into `server`.
9. Write `my.ini` with:

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

10. Run
    `mysqld.exe --defaults-file=C:\xampp\mysql84\my.ini --initialize --console`.
11. Read the temporary root password only from the exact instance error log.
12. Start this exact instance through `start.ps1`.
13. Use an ACL-restricted temporary client option file plus
    `--connect-expired-password` to change the root password.
14. Execute SQL whose interpolated secrets have already passed the base64url
    guard:

```powershell
$provisionSql = @"
CREATE DATABASE grc_enrollment
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE grc_enrollment_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'grc_app'@'127.0.0.1' IDENTIFIED BY '$appPassword';
CREATE USER 'grc_migrator'@'127.0.0.1' IDENTIFIED BY '$migratorPassword';
CREATE USER 'grc_test'@'127.0.0.1' IDENTIFIED BY '$testPassword';
GRANT SELECT, INSERT, UPDATE, DELETE
  ON grc_enrollment.* TO 'grc_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX,
  REFERENCES, CREATE TEMPORARY TABLES
  ON grc_enrollment.* TO 'grc_migrator'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX,
  REFERENCES, CREATE TEMPORARY TABLES
  ON grc_enrollment_test.* TO 'grc_test'@'127.0.0.1';
"@
```

15. Save the new administrator password through
    `Save-GrcAdminCredential` at
    `C:\xampp\mysql84\secrets\mysql84-admin.credential`; never persist it as
    plaintext.
16. Copy safe examples to ignored `.env`/`.env.testing` only when the targets
    are absent, then use `Set-GrcEnvironmentValue` for the exact database and
    seed variables.
17. Remove each temporary plaintext credential option file in `finally`.
18. Report only phase names, version, paths, database names, and principal
    names.
19. If `server`, `data`, `my.ini`, or the administrator credential already
    exists, stop with a recovery
    message rather than overwrite or delete it.

The exact ignored-environment mapping is:

```text
backend/.env
  DB_HOST=127.0.0.1
  DB_PORT=3307
  DB_DATABASE=grc_enrollment
  DB_USERNAME=grc_app
  DB_PASSWORD=$appPassword
  DB_MIGRATOR_HOST=127.0.0.1
  DB_MIGRATOR_PORT=3307
  DB_MIGRATOR_DATABASE=grc_enrollment
  DB_MIGRATOR_USERNAME=grc_migrator
  DB_MIGRATOR_PASSWORD=$migratorPassword
  GRC_SEED_PASSWORD=$seedPassword

backend/.env.testing
  DB_HOST=127.0.0.1
  DB_PORT=3307
  DB_DATABASE=grc_enrollment_test
  DB_USERNAME=grc_test
  DB_PASSWORD=$testPassword
  DB_RUNTIME_HOST=127.0.0.1
  DB_RUNTIME_PORT=3307
  DB_RUNTIME_DATABASE=grc_enrollment
  DB_RUNTIME_USERNAME=grc_app
  DB_RUNTIME_PASSWORD=$appPassword
  GRC_SEED_PASSWORD=$seedPassword
```

- [ ] **Step 5: Implement start, status, and stop**

`start.ps1` validates `mysqld.exe`, `my.ini`, and the data directory; refuses an
unrelated `3307` listener; then uses:

```powershell
Start-Process `
    -FilePath $layout.MySqlServerExe `
    -ArgumentList "--defaults-file=$($layout.OptionFile)" `
    -WindowStyle Hidden `
    -PassThru
```

It waits up to 30 seconds using short polls and requires this exact executable
path plus option-file argument before reporting ready.

`status.ps1` verifies the expected process identity, imports the current-user
DPAPI administrator credential, then calls the pinned `mysql.exe` with a
temporary client option file and reports only:
`VERSION()`, `@@port`, `@@bind_address`, `@@default_storage_engine`,
`@@character_set_server`, `@@collation_server`, `@@global.time_zone`, and
`@@global.sql_mode`.

`stop.ps1` verifies the same process identity, imports the DPAPI administrator
credential, uses a temporary client option file and pinned
`mysqladmin.exe shutdown`, waits for only that PID to exit, and never calls
`Stop-Process` as a normal shutdown path.

- [ ] **Step 6: Complete the operator README**

Document:

- exact external layout and port;
- five required process environment variables;
- bootstrap/start/status/stop commands;
- expected non-secret output;
- occupied-port, checksum, partial-directory, and failed-initialization
  recovery;
- explicit assurance that no script changes MariaDB;
- manual data preservation/removal boundary;
- DPAPI credential ownership/recovery behavior;
- the rule that root secrets never belong in backend environment files.

- [ ] **Step 7: Run script tests and parse every PowerShell file**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mysql84/tests/MySql84.Common.Tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mysql84/tests/ScriptSafety.Scan.ps1
Get-ChildItem scripts/mysql84 -Filter *.ps1 -Recurse | ForEach-Object {
    $tokens = $null
    $errors = $null
    [Management.Automation.Language.Parser]::ParseFile(
        $_.FullName,
        [ref] $tokens,
        [ref] $errors
    ) | Out-Null
    if ($errors.Count -gt 0) { throw "$($_.Name) has parser errors." }
}
```

Expected: the common-library behavior harness, static script-safety lint, and
parser audit exit zero.

- [ ] **Step 8: Record the Task 3 checkpoint**

Record script checks and confirm that no download or instance mutation has
occurred yet. Do not commit.

## Task 4: Laravel MySQL Configuration

**Files:**

- Modify: `backend/.env.example`
- Create: `backend/.env.testing.example`
- Modify: `backend/.gitignore`
- Modify: `backend/config/database.php`
- Create: `backend/config/grc.php`
- Modify: `backend/phpunit.xml`
- Create: `backend/tests/Feature/Database/DatabaseConfigurationTest.php`
- Modify: `PROGRESS.md`

**Interfaces:**

- Default `mysql` connection is runtime/test depending on environment.
- `mysql_migrator` consumes `DB_MIGRATOR_*`.
- `mysql_runtime` consumes `DB_RUNTIME_*` only for least-privilege verification
  while PHPUnit's default connection uses `grc_test`.
- `config('grc.seed_password')` reads `GRC_SEED_PASSWORD`.

- [ ] **Step 1: Record Task 4 start**

State that configuration examples remain password-empty and that no connection
will target `3306`.

- [ ] **Step 2: Write the failing configuration test**

```php
<?php

namespace Tests\Feature\Database;

use Tests\TestCase;

final class DatabaseConfigurationTest extends TestCase
{
    public function test_mysql_connections_are_strict_utf8mb4_and_isolated(): void
    {
        self::assertSame('mysql', config('database.default'));
        self::assertSame('3307', (string) config('database.connections.mysql.port'));
        self::assertSame('utf8mb4', config('database.connections.mysql.charset'));
        self::assertSame(
            'utf8mb4_0900_ai_ci',
            config('database.connections.mysql.collation'),
        );
        self::assertTrue(config('database.connections.mysql.strict'));

        self::assertSame(
            'mysql',
            config('database.connections.mysql_migrator.driver'),
        );
        self::assertSame(
            'mysql',
            config('database.connections.mysql_runtime.driver'),
        );
    }
}
```

- [ ] **Step 3: Run the test and confirm failure**

```powershell
php artisan test tests/Feature/Database/DatabaseConfigurationTest.php
```

Expected: failure because the default fallback/port/collation and named
connections are not yet configured.

- [ ] **Step 4: Implement configuration and safe examples**

Set the MySQL fallback values to:

```php
'default' => env('DB_CONNECTION', 'mysql'),
'host' => env('DB_HOST', '127.0.0.1'),
'port' => env('DB_PORT', '3307'),
'database' => env('DB_DATABASE', 'grc_enrollment'),
'username' => env('DB_USERNAME', 'grc_app'),
'charset' => env('DB_CHARSET', 'utf8mb4'),
'collation' => env('DB_COLLATION', 'utf8mb4_0900_ai_ci'),
'strict' => true,
```

Add explicit `mysql_migrator` and `mysql_runtime` arrays with the same driver,
host, port, charset, collation, strict mode, PDO options, and their own
environment prefixes.

`backend/.env.example` documents runtime and migrator keys with empty
passwords. `backend/.env.testing.example` documents:

```dotenv
APP_ENV=testing
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3307
DB_DATABASE=grc_enrollment_test
DB_USERNAME=grc_test
DB_PASSWORD=
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_0900_ai_ci
DB_RUNTIME_HOST=127.0.0.1
DB_RUNTIME_PORT=3307
DB_RUNTIME_DATABASE=grc_enrollment
DB_RUNTIME_USERNAME=grc_app
DB_RUNTIME_PASSWORD=
GRC_SEED_PASSWORD=
```

Ensure `backend/.gitignore` ignores `.env.*` while explicitly allowing
`.env.example` and `.env.testing.example`.

`backend/phpunit.xml` fixes non-secret test coordinates—connection, host,
port, database, username, charset, and collation—while leaving passwords to
ignored `.env.testing`.

`backend/config/grc.php` returns:

```php
<?php

return [
    'seed_password' => env('GRC_SEED_PASSWORD'),
];
```

- [ ] **Step 5: Run focused configuration and secret-example checks**

```powershell
php artisan test tests/Feature/Database/DatabaseConfigurationTest.php
composer format:check
composer analyse
rg -n 'DB_.*PASSWORD=.+|GRC_SEED_PASSWORD=.+' backend/.env.example backend/.env.testing.example
```

Expected: PHPUnit, Pint, and PHPStan pass; `rg` returns no matches.

- [ ] **Step 6: Record the Task 4 checkpoint**

Update `PROGRESS.md` with exact results and note that the real instance is
still unprovisioned. Do not commit.

## Task 5: Provision and Verify the Isolated MySQL Instance

**Files:**

- Runtime-only: `C:\xampp\mysql84\...`
- Runtime-only: ignored `backend/.env`
- Runtime-only: ignored `backend/.env.testing`
- Modify: `PROGRESS.md`

**Interfaces:**

- Consumes all Task 2/3 scripts and Task 4 environment contracts.
- Produces a running MySQL 8.4.10 instance and the three scoped principals.

- [ ] **Step 1: Record Task 5 start before the long/network operation**

Capture current time, intended target paths, port, official version/checksum,
and the no-change boundary for MariaDB.

- [ ] **Step 2: Capture a read-only preflight**

```powershell
& 'C:\xampp\mysql\bin\mysql.exe' --version
php -m | Select-String -Pattern '^pdo_mysql$'
Get-NetTCPConnection -State Listen -LocalPort 3306,3307 -ErrorAction SilentlyContinue |
    Select-Object LocalAddress, LocalPort, OwningProcess
Test-Path -LiteralPath 'C:\xampp\mysql84'
```

Record the MariaDB version/listener and whether the target directory is absent.
If `C:\xampp\mysql84` exists, inspect it and stop; do not overwrite it.

- [ ] **Step 3: Generate process-scoped secrets without output**

```powershell
function New-GrcLocalSecret {
    $bytes = New-Object byte[] 32
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    } finally {
        $generator.Dispose()
    }
    [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$secretNames = @(
    'GRC_MYSQL84_ADMIN_PASSWORD',
    'GRC_DB_APP_PASSWORD',
    'GRC_DB_MIGRATOR_PASSWORD',
    'GRC_DB_TEST_PASSWORD',
    'GRC_SEED_PASSWORD'
)

foreach ($name in $secretNames) {
    [Environment]::SetEnvironmentVariable($name, (New-GrcLocalSecret), 'Process')
}
```

Do not echo, select, serialize, or log the variables.

- [ ] **Step 4: Run bootstrap and clear process secrets in `finally`**

```powershell
try {
    & .\scripts\mysql84\bootstrap.ps1 `
        -InstanceRoot 'C:\xampp\mysql84' `
        -BackendPath (Resolve-Path .\backend).Path
} finally {
    foreach ($name in $secretNames) {
        Remove-Item "Env:\$name" -ErrorAction SilentlyContinue
    }
}
```

Expected: checksum verified, initialization completed, three principals
created, ignored environment files updated, and the instance running on 3307.

- [ ] **Step 5: Verify runtime identity and server variables**

```powershell
& .\scripts\mysql84\status.ps1 -InstanceRoot 'C:\xampp\mysql84'
Get-NetTCPConnection -State Listen -LocalPort 3306,3307 |
    Select-Object LocalAddress, LocalPort, OwningProcess
```

Expected status:

- version begins `8.4.10`;
- port is `3307`;
- bind address is `127.0.0.1`;
- storage engine is `InnoDB`;
- character set is `utf8mb4`;
- collation is `utf8mb4_0900_ai_ci`;
- global time zone is `+00:00`;
- SQL mode contains `STRICT_TRANS_TABLES`;
- the preflight MariaDB listener/process remains unchanged.

- [ ] **Step 6: Inspect grants without exposing authentication data**

Use ACL-restricted temporary client option files and run `SHOW GRANTS FOR
CURRENT_USER` as each principal. Verify exact database scope and absence of
global grants. Store no grant output containing authentication strings.

- [ ] **Step 7: Exercise graceful stop/start**

```powershell
& .\scripts\mysql84\stop.ps1 -InstanceRoot 'C:\xampp\mysql84'
Get-NetTCPConnection -State Listen -LocalPort 3307 -ErrorAction SilentlyContinue
& .\scripts\mysql84\start.ps1 -InstanceRoot 'C:\xampp\mysql84'
& .\scripts\mysql84\status.ps1 -InstanceRoot 'C:\xampp\mysql84'
```

Expected: only 3307 closes and reopens; MariaDB remains unchanged.

- [ ] **Step 8: Record the Task 5 checkpoint**

Record non-secret paths, version, ports, variable results, principal names,
grant scope, and lifecycle outcome in `PROGRESS.md`. Do not record passwords or
commit.

## Task 6: Reversible Identity and Organization Migrations

**Files:**

- Create:
  `backend/database/migrations/2026_07_26_000001_create_users_table.php`
- Create:
  `backend/database/migrations/2026_07_26_000002_create_programs_table.php`
- Create:
  `backend/database/migrations/2026_07_26_000003_create_academic_terms_table.php`
- Create:
  `backend/tests/Feature/Database/IdentityFoundationMigrationTest.php`
- Modify: `PROGRESS.md`

**Interfaces:**

- Produces `users`, `programs`, and `academic_terms`.
- All three tables use InnoDB, `utf8mb4`, and `utf8mb4_0900_ai_ci`.
- No foreign key is introduced in this slice.

- [ ] **Step 1: Record Task 6 start**

State the exact three-table boundary and why `student_profiles`/`curricula`
remain deferred.

- [ ] **Step 2: Write the failing migration test**

```php
<?php

namespace Tests\Feature\Database;

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

final class IdentityFoundationMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_identity_foundation_tables_match_the_prd_columns(): void
    {
        self::assertTrue(Schema::hasColumns('users', [
            'id', 'name', 'email', 'password', 'role', 'status',
            'last_login_at', 'created_at', 'updated_at',
        ]));
        self::assertTrue(Schema::hasColumns('programs', [
            'id', 'code', 'name', 'status', 'created_at', 'updated_at',
        ]));
        self::assertTrue(Schema::hasColumns('academic_terms', [
            'id', 'school_year', 'semester', 'starts_at', 'ends_at',
            'enrollment_opens_at', 'enrollment_closes_at', 'status',
            'created_at', 'updated_at',
        ]));
    }

    public function test_user_email_is_unique(): void
    {
        $record = [
            'name' => 'Synthetic User',
            'email' => 'unique.user@grc.test',
            'password' => 'test-hash',
            'role' => 'student',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ];
        DB::table('users')->insert($record);

        $this->expectException(QueryException::class);
        DB::table('users')->insert($record);
    }

    public function test_program_code_is_unique(): void
    {
        $record = [
            'code' => 'SYN',
            'name' => 'Synthetic Program',
            'status' => 'unconfirmed',
            'created_at' => now(),
            'updated_at' => now(),
        ];
        DB::table('programs')->insert($record);

        $this->expectException(QueryException::class);
        DB::table('programs')->insert($record);
    }

    public function test_school_year_and_semester_are_unique_together(): void
    {
        $record = [
            'school_year' => '2026-2027',
            'semester' => 'Synthetic Term',
            'status' => 'unconfirmed',
            'created_at' => now(),
            'updated_at' => now(),
        ];
        DB::table('academic_terms')->insert($record);

        $this->expectException(QueryException::class);
        DB::table('academic_terms')->insert($record);
    }
}
```

- [ ] **Step 3: Run the test and confirm failure**

```powershell
php artisan test tests/Feature/Database/IdentityFoundationMigrationTest.php
```

Expected: failure because the three migrations/tables do not exist.

- [ ] **Step 4: Implement the users migration**

```php
Schema::create('users', function (Blueprint $table): void {
    $table->engine = 'InnoDB';
    $table->charset = 'utf8mb4';
    $table->collation = 'utf8mb4_0900_ai_ci';

    $table->id();
    $table->string('name');
    $table->string('email', 254)->unique();
    $table->string('password');
    $table->string('role', 64)->index();
    $table->string('status', 32)->index();
    $table->timestamp('last_login_at')->nullable();
    $table->timestamps();
});
```

The `down()` method drops only `users`.

- [ ] **Step 5: Implement programs and academic terms**

Programs:

```php
$table->id();
$table->string('code', 32)->unique();
$table->string('name');
$table->string('status', 64)->index();
$table->timestamps();
```

Academic terms:

```php
$table->id();
$table->string('school_year', 9);
$table->string('semester', 64);
$table->dateTime('starts_at')->nullable();
$table->dateTime('ends_at')->nullable();
$table->dateTime('enrollment_opens_at')->nullable();
$table->dateTime('enrollment_closes_at')->nullable();
$table->string('status', 64)->index();
$table->timestamps();
$table->unique(['school_year', 'semester']);
```

Set the same explicit engine, charset, and collation on both tables. Each
`down()` drops only its own table.

- [ ] **Step 6: Run focused migration tests**

```powershell
php artisan test tests/Feature/Database/IdentityFoundationMigrationTest.php
composer format:check
composer analyse
```

Expected: migration constraints, Pint, and PHPStan pass.

- [ ] **Step 7: Prove forward/rollback/forward on development**

Run from `backend/`, with the ignored local environment loaded:

```powershell
php artisan migrate:fresh --database=mysql_migrator --force
php artisan migrate:rollback --database=mysql_migrator --force
php artisan migrate --database=mysql_migrator --force
php artisan migrate:status --database=mysql_migrator
```

Expected: three migrations apply, all three roll back, and all three apply
again. Confirm the target is `grc_enrollment` on port `3307` before the first
mutation.

- [ ] **Step 8: Record the Task 6 checkpoint**

Record the migration/test counts and rollback result in `PROGRESS.md`. Do not
commit.

## Task 7: Guarded Nine-Role Seeder

**Files:**

- Create: `backend/database/seeders/RoleUserSeeder.php`
- Create: `backend/database/seeders/DatabaseSeeder.php`
- Create: `backend/tests/Feature/Database/RoleUserSeederTest.php`
- Create: `docs/testing/SEEDED_IDENTITIES.md`
- Modify: `docs/testing/DEMO_CREDENTIALS.md`
- Modify: `PROGRESS.md`

**Interfaces:**

- `RoleUserSeeder::run(): void`
- Consumes `config('grc.seed_password')`.
- Upserts by email and never deletes unrelated users.
- Fails unless environment is `local` or `testing`.

- [ ] **Step 1: Record Task 7 start**

Document that seed records are database fixtures, remain unusable for login
until Sanctum, and use a password distinct from the UI-only demo password.

- [ ] **Step 2: Write failing seeder tests**

```php
<?php

namespace Tests\Feature\Database;

use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Models\User;
use Database\Seeders\RoleUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Tests\TestCase;

final class RoleUserSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_creates_one_active_identity_per_role(): void
    {
        $this->seed(RoleUserSeeder::class);

        self::assertSame(9, User::query()->count());
        self::assertSame(
            collect(UserRole::cases())->pluck('value')->sort()->values()->all(),
            User::query()
                ->get()
                ->map(fn (User $user): string => $user->role->value)
                ->sort()
                ->values()
                ->all(),
        );
        self::assertTrue(
            User::query()->get()->every(
                fn (User $user): bool =>
                    $user->status === UserStatus::Active
                    && Hash::check((string) config('grc.seed_password'), $user->password),
            ),
        );
    }

    public function test_repeated_seeding_is_idempotent_and_preserves_other_users(): void
    {
        User::query()->create([
            'name' => 'Unrelated Synthetic User',
            'email' => 'unrelated@grc.test',
            'password' => 'local-test-only',
            'role' => UserRole::Student,
            'status' => UserStatus::Disabled,
        ]);

        $this->seed(RoleUserSeeder::class);
        $this->seed(RoleUserSeeder::class);

        self::assertSame(10, User::query()->count());
        self::assertTrue(User::query()->where('email', 'unrelated@grc.test')->exists());
    }

    public function test_missing_seed_password_fails_closed(): void
    {
        config(['grc.seed_password' => null]);

        $this->expectException(RuntimeException::class);
        $this->seed(RoleUserSeeder::class);
    }
}
```

Add a fourth test that changes the application environment to `production`,
expects `RuntimeException`, and restores the original environment:

```php
public function test_production_environment_fails_closed(): void
{
    $originalEnvironment = app()->environment();

    try {
        app()->detectEnvironment(static fn (): string => 'production');
        $this->expectException(RuntimeException::class);
        $this->seed(RoleUserSeeder::class);
    } finally {
        app()->detectEnvironment(
            static fn (): string => $originalEnvironment,
        );
    }
}
```

- [ ] **Step 3: Run the tests and confirm failure**

```powershell
php artisan test tests/Feature/Database/RoleUserSeederTest.php
```

Expected: failure because the seeders do not exist.

- [ ] **Step 4: Implement the guarded catalog and upsert**

`RoleUserSeeder` contains exactly:

```php
$accounts = [
    [UserRole::Student, 'Seed Student', 'student.seed@grc.test'],
    [UserRole::AdmissionStaff, 'Seed Admission Staff', 'admission.seed@grc.test'],
    [UserRole::Faculty, 'Seed Faculty', 'faculty.seed@grc.test'],
    [UserRole::ProgramChair, 'Seed Program Chair', 'chair.seed@grc.test'],
    [UserRole::Dean, 'Seed Dean', 'dean.seed@grc.test'],
    [UserRole::ExecutiveDirector, 'Seed Executive Director', 'executive.seed@grc.test'],
    [UserRole::RegistrarHead, 'Seed Registrar Head', 'registrar-head.seed@grc.test'],
    [UserRole::RegistrarStaff, 'Seed Registrar Staff', 'registrar-staff.seed@grc.test'],
    [UserRole::AccountingStaff, 'Seed Accounting Staff', 'accounting.seed@grc.test'],
];
```

Before mutation:

```php
if (! app()->environment(['local', 'testing'])) {
    throw new RuntimeException('Synthetic role seeding is limited to local and testing.');
}

$password = config('grc.seed_password');
if (! is_string($password) || $password === '') {
    throw new RuntimeException('GRC_SEED_PASSWORD is required for role seeding.');
}
```

For each account call `User::query()->updateOrCreate(['email' => $email], [...])`
with `Hash::make($password)`, the exact name/role, and
`UserStatus::Active`. `DatabaseSeeder` calls only `RoleUserSeeder`.

- [ ] **Step 5: Document all nine database identities**

`docs/testing/SEEDED_IDENTITIES.md` lists all nine exact emails, role IDs, and
display names. The password column says `GRC_SEED_PASSWORD from the ignored
backend environment`; it contains no password value. State that these records
cannot sign in until Phase 1 Sanctum is implemented.

Add a short cross-link in `DEMO_CREDENTIALS.md` explaining that demo accounts
and seeded identities have separate emails, passwords, and authentication
boundaries.

- [ ] **Step 6: Run focused seeder and credential-contract checks**

```powershell
php artisan test tests/Feature/Database/RoleUserSeederTest.php
php artisan db:seed --class='Database\Seeders\RoleUserSeeder' --force
php artisan db:seed --class='Database\Seeders\RoleUserSeeder' --force
rg -n -o '[a-z-]+\\.seed@grc\\.test' docs/testing/SEEDED_IDENTITIES.md
composer format:check
composer analyse
```

Expected: tests pass, both real seed runs succeed, the document contains nine
unique seed emails, and quality checks pass.

- [ ] **Step 7: Record the Task 7 checkpoint**

Record exact counts and document paths without recording the password. Do not
commit.

## Task 8: MySQL Environment and Least-Privilege Tests

**Files:**

- Create: `backend/tests/Feature/Database/MySql84EnvironmentTest.php`
- Create: `backend/tests/Feature/Database/RuntimeDatabasePrivilegeTest.php`
- Modify: `PROGRESS.md`

**Interfaces:**

- Tests use `grc_test` on `grc_enrollment_test` by default.
- `mysql_runtime` uses `grc_app` on `grc_enrollment`.
- The runtime privilege probe creates only a temporary table and expects
  MySQL to deny it.

- [ ] **Step 1: Record Task 8 start**

Document that these tests prove the engine contract and effective privilege
boundary, not only configuration values.

- [ ] **Step 2: Write the environment test**

```php
<?php

namespace Tests\Feature\Database;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

final class MySql84EnvironmentTest extends TestCase
{
    public function test_test_connection_is_the_isolated_mysql_84_instance(): void
    {
        $row = DB::selectOne(<<<'SQL'
            SELECT
                VERSION() AS version,
                @@port AS port,
                @@default_storage_engine AS engine,
                @@character_set_server AS character_set_name,
                @@collation_server AS collation_name,
                @@session.time_zone AS time_zone,
                @@session.sql_mode AS sql_mode
            SQL);

        self::assertNotNull($row);
        self::assertStringStartsWith('8.4.10', $row->version);
        self::assertSame(3307, (int) $row->port);
        self::assertSame('InnoDB', $row->engine);
        self::assertSame('utf8mb4', $row->character_set_name);
        self::assertSame('utf8mb4_0900_ai_ci', $row->collation_name);
        self::assertSame('+00:00', $row->time_zone);
        self::assertStringContainsString('STRICT_TRANS_TABLES', $row->sql_mode);
        self::assertSame('grc_enrollment_test', DB::getDatabaseName());
    }
}
```

- [ ] **Step 3: Write the runtime denial test**

```php
<?php

namespace Tests\Feature\Database;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

final class RuntimeDatabasePrivilegeTest extends TestCase
{
    public function test_runtime_principal_cannot_create_even_a_temporary_table(): void
    {
        $connection = DB::connection('mysql_runtime');
        self::assertSame('grc_enrollment', $connection->getDatabaseName());

        $this->expectException(QueryException::class);
        $connection->statement(
            'CREATE TEMPORARY TABLE grc_runtime_privilege_probe (id BIGINT)',
        );
    }
}
```

- [ ] **Step 4: Run both tests**

```powershell
php artisan test tests/Feature/Database/MySql84EnvironmentTest.php tests/Feature/Database/RuntimeDatabasePrivilegeTest.php
```

Expected: both pass. If the privilege probe unexpectedly succeeds, stop and
revoke the unintended privilege before any further work.

- [ ] **Step 5: Run the complete backend gate sequentially**

```powershell
composer validate --strict
composer format:check
composer analyse
composer test
composer check-platform-reqs
composer audit --locked --no-interaction
php artisan migrate:fresh --database=mysql_migrator --seed --force
php artisan migrate:rollback --database=mysql_migrator --force
php artisan migrate --database=mysql_migrator --force
```

Run sequentially to keep Windows resource usage predictable. Report the audit
as unrun if Packagist is unavailable; never convert a timeout into a pass.

- [ ] **Step 6: Re-run the PowerShell gate**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ..\scripts\mysql84\tests\MySql84.Common.Tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File ..\scripts\mysql84\tests\ScriptSafety.Scan.ps1
```

Expected: both pass from `backend/`.

- [ ] **Step 7: Record the Task 8 checkpoint**

Record PHPUnit totals, MySQL assertions, privilege denial, migrations, static
analysis, formatting, manifest, platform, audit, and PowerShell results. Do not
commit.

## Task 9: Data Dictionary, Runbook, and Final Handoff

**Files:**

- Modify: `backend/README.md`
- Modify: `docs/architecture/version-compatibility.md`
- Create: `docs/data-dictionary/identity-foundation.md`
- Create: `docs/runbooks/mysql84-local.md`
- Modify: `PROGRESS.md`

**Interfaces:**

- Documentation reflects only commands and checks that actually passed.
- Data dictionary maps physical fields to PRD §10.1 and the manuscript logical
  stores without inventing retention values.

- [ ] **Step 1: Record Task 9 start**

State that runtime implementation is complete but no completion claim will be
made until documentation, secret scans, and a fresh verification pass finish.

- [ ] **Step 2: Update backend setup documentation**

Document:

- MySQL 8.4 start/status/stop commands;
- safe copying of `.env.example` and `.env.testing.example`;
- runtime versus migrator versus test connection purposes;
- exact migration, rollback, and seeding commands;
- the `GRC_SEED_PASSWORD` location without its value;
- why XAMPP MariaDB on 3306 is unsupported and untouched;
- Sanctum and working seeded-user login remain Phase 1.

- [ ] **Step 3: Update the version record and create the operator runbook**

Change the database row from blocked to verified only if Task 5/8 proved the
instance. Record exact MySQL version, ZIP filename, checksum, port, and
verification date.

The runbook covers:

- external directory ownership and backup boundary;
- routine start/status/stop;
- migration and seed procedure;
- occupied-port diagnosis;
- checksum/init/start failure paths;
- graceful recovery without deleting data;
- grant inspection;
- MariaDB preservation check;
- no automatic service registration;
- upgrade trigger for a future MySQL 8.4 patch.

- [ ] **Step 4: Create the identity data dictionary**

For every field in `users`, `programs`, and `academic_terms`, document:

- MySQL type/nullability/index or unique constraint;
- PRD §10.1 source field;
- logical store (`STUDENT RECORDS` for identity; `CURRICULUM AND SCHEDULING`
  for programs/terms);
- producer/consumer boundary;
- sensitivity class;
- retention as “pending authorized GRC decision” where policy is unresolved.

Explicitly record that `student_profiles`, approved contact fields,
`curricula`, and institutional status vocabularies are deferred.

- [ ] **Step 5: Run documentation and secret scans**

```powershell
git diff --check
rg -n -i 'password\\s*[:=]\\s*[^$<[:space:]]+|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|mysql://[^[:space:]]+:[^[:space:]]+@' `
    scripts backend docs PROGRESS.md `
    -g '!backend/vendor/**' `
    -g '!backend/.env' `
    -g '!backend/.env.testing'
```

Review every match. Safe variable names, test-only repeated characters, and
the intentionally public frontend demo password may remain only in their
documented safety contexts. No generated database/admin secret may appear.

Verify role/email synchronization:

```powershell
rg -n 'admission_staff|program_chair|executive_director|accounting_staff' `
    backend/app backend/database backend/tests docs/testing
rg -o '[a-z-]+\\.seed@grc\\.test' docs/testing/SEEDED_IDENTITIES.md |
    Sort-Object -Unique
```

Expected: canonical role IDs agree and exactly nine unique seed emails appear.

- [ ] **Step 6: Run a fresh final gate**

From `backend/`:

```powershell
composer validate --strict
composer format:check
composer analyse
composer test
composer check-platform-reqs
composer audit --locked --no-interaction
php artisan migrate:fresh --database=mysql_migrator --seed --force
php artisan migrate:rollback --database=mysql_migrator --force
php artisan migrate --database=mysql_migrator --force
php artisan db:seed --class='Database\Seeders\RoleUserSeeder' --force
```

From the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mysql84/tests/MySql84.Common.Tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mysql84/tests/ScriptSafety.Scan.ps1
& .\scripts\mysql84\status.ps1 -InstanceRoot 'C:\xampp\mysql84'
git diff --check
git status --short
```

Expected: every applicable gate exits zero, MySQL reports the approved
settings, and Git shows no database binaries/data/logs or secret environment
files.

- [ ] **Step 7: Complete `PROGRESS.md`**

Update:

- top-level objective/status and Phase 0 checklist;
- database/migration/seeder status;
- exact MySQL/runtime facts;
- test table with commands and actual results;
- decisions, failures/recovery, files changed, and a timestamped handoff;
- next exact step: design the real Sanctum bearer-authentication and RBAC
  vertical slice.

Do not mark CI, Sanctum, real login, browser E2E, or Phase 0 overall complete.
Do not commit.

## Completion Definition

The plan is complete only when:

- official MySQL 8.4.10 is verified on `127.0.0.1:3307`;
- MariaDB remains unchanged on `3306`;
- lifecycle scripts pass their safety lint and parser checks, and their real
  lifecycle behavior passes Task 5 integration verification;
- effective variables prove InnoDB, `utf8mb4_0900_ai_ci`, strict SQL, and UTC;
- development/test databases and exact scoped grants are verified;
- all three migrations run forward, rollback, and run forward again;
- the exact nine-role enum and idempotent guarded seeder pass on MySQL;
- `grc_app` is actually denied temporary-table DDL;
- all backend and PowerShell quality gates pass or an unavailable external
  audit is truthfully reported;
- the credential boundary, runbook, data dictionary, version record, and
  `PROGRESS.md` are synchronized;
- Git contains no MySQL runtime artifact or real secret;
- no real authentication or portal-backend integration is claimed.
