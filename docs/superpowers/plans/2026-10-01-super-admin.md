# Super Admin + Department Switcher — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking. If your harness does not have those skills,
> follow this plan directly: implement one task at a time, write the failing test first,
> make it pass, run the narrow check, then move to the next task.

**Design spec:** `docs/superpowers/specs/2026-10-01-super-admin-design.md` (read this first — it
has the full rationale; this plan only has the "how").
**ADR:** `docs/adr/0038-super-admin-and-department-switcher.md`.
**Repo rules:** `AGENTS.md` at the repo root. Non-negotiable: TDD, narrowest checks after
each change, full suite before a slice is "done", update `PROGRESS.md`, never invent a
policy value, work on `main` unless told otherwise, never commit/push unless asked.

**Baselines to protect:** backend `2078/2078` passed, frontend `1394/1394` passed, `tsc`
0 errors. Any new failure after your change is a real regression — find it before moving
on.

**Test database:** a private MariaDB on its own port (e.g. `:3310`), never the developer's
main `:3306` instance. See `docs/runbooks/mariadb-local.md` if present, otherwise point
`backend/.env.testing` (or equivalent) `DB_*` vars at the private instance before running
`vendor/bin/phpunit`.

**Windows note:** this repo's files are mostly CRLF. Prefer the Edit/Write tool pattern (or
a PHP one-off script run with `php`) over Python text-mode rewrites, which flip line
endings and break `pint`.

---

## Slice 1 — Role, account, and console shell

Goal: the `super_admin` role exists, is never seeded, can only be created/deactivated by a
CLI command, and signing in as one lands on a console that (for now) shows only Audit
Logs.

### Task 1.1: Add the `UserRole::SuperAdmin` case and its helpers

**Files:**
- Modify: `backend/app/Domain/Identity/UserRole.php`
- Modify: `backend/tests/Unit/Domain/Identity/UserRoleTest.php`
- Modify: `backend/tests/Unit/Contracts/UserRoleContractTest.php`
- Modify: `docs/api/openapi.yaml` (the `role` enum used by `UserResource`'s schema and by
  `StaffInvitableRole`)
- Modify: `frontend/src/features/auth/roles.ts`

**Interfaces:**
- `UserRole::SuperAdmin = 'super_admin'`, label `"Super Admin"`, `isLearnerScoped()` →
  `false`.
- `UserRole::seedableCases(): array` — like `humanCases()` but excluding `SuperAdmin`.
  `RoleUserSeeder` will loop this, not `humanCases()`.
- `UserRole::superAdminSwitchableCases(): array` — the 8 offices: `AdmissionStaff`,
  `ProgramChair`, `Dean`, `ExecutiveDirector`, `RegistrarHead`, `RegistrarStaff`,
  `AccountingStaff`, `ItAdmin`.
- `UserRole::superAdminInvitableCases(): array` — `registrarInvitableCases()` **plus**
  `AdmissionStaff` (9 roles). Used in Slice 3.
- `UserRole::collegeRequiredWhenActing(self $role): bool` — true only for `ProgramChair`
  and `Dean`. Used in Slice 2's acting-context validation and again in Slice 3's invite
  validation (both need "does this role need a college").

- [ ] **Step 1: Write the failing tests**

```php
// UserRoleTest.php
public function test_the_role_catalog_includes_super_admin(): void
{
    $this->assertContains('super_admin', array_column(UserRole::cases(), 'value'));
    $this->assertSame('Super Admin', UserRole::SuperAdmin->label());
    $this->assertFalse(UserRole::SuperAdmin->isLearnerScoped());
    $this->assertCount(12, UserRole::cases()); // was 11
}

public function test_seedable_cases_exclude_super_admin(): void
{
    $this->assertNotContains(UserRole::SuperAdmin, UserRole::seedableCases());
    $this->assertContains(UserRole::SuperAdmin, UserRole::humanCases()); // still "human"
}

public function test_super_admin_switchable_cases(): void
{
    $this->assertCount(8, UserRole::superAdminSwitchableCases());
    $this->assertNotContains(UserRole::Faculty, UserRole::superAdminSwitchableCases());
    $this->assertNotContains(UserRole::Student, UserRole::superAdminSwitchableCases());
}

public function test_super_admin_invitable_cases_adds_admission_staff(): void
{
    $this->assertCount(9, UserRole::superAdminInvitableCases());
    $this->assertContains(UserRole::AdmissionStaff, UserRole::superAdminInvitableCases());
}
```

Update `UserRoleContractTest` to expect the new case appended **last**, matching the order
you will give `roles.ts` and `openapi.yaml` (Step 3).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/phpunit --testdox --filter 'UserRole'`

Expected: FAIL — the case and helpers do not exist yet.

- [ ] **Step 3: Implement**

Add the case; add arms in `label()` and `isLearnerScoped()` (both are exhaustive `match`
with no default — a missing arm throws `UnhandledMatchError`, which is correct, keep it
that way); add the four helper methods. Append `super_admin` **last** in
`frontend/src/features/auth/roles.ts`'s `userRoles` tuple and in `openapi.yaml`'s two role
enums (`UserResource.role` and `StaffInvitableRole` — do **not** add it to
`StaffInvitableRole`, that stays the existing 8; only `UserResource.role` gains it).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/phpunit --testdox --filter 'UserRole'`
Then: `cd frontend && npx tsc --noEmit` (expect failures in `role-capabilities.ts` and
`scheduling-service.ts` — their `Record<UserRole, …>` maps are exhaustive; fixed in
Task 1.7).

Expected: backend PASS; frontend type errors are the expected, not-yet-fixed exhaustive
maps.

---

### Task 1.2: `RoleUserSeeder` must never seed a super admin

**Files:**
- Modify: `backend/database/seeders/RoleUserSeeder.php`
- Modify: `backend/tests/Feature/Database/RoleUserSeederTest.php`

- [ ] **Step 1: Write the failing test**

```php
public function test_it_never_seeds_a_super_admin(): void
{
    $this->seed(RoleUserSeeder::class);
    $this->assertDatabaseMissing('users', ['role' => UserRole::SuperAdmin->value]);
}
```

Update the existing `assertCount(10, $emails)`-style assertion (now 10 seedable human
roles, i.e. 11 human cases minus `SuperAdmin`) — check the exact current count in the test
before changing it; don't guess.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/phpunit --filter RoleUserSeederTest`

Expected: FAIL — `RoleUserSeeder::run()` still loops `UserRole::humanCases()`, which now
includes `SuperAdmin`, and throws `LogicException` because `IDENTITIES` has no entry for
it.

- [ ] **Step 3: Implement**

Change the loop in `RoleUserSeeder::run()` from `UserRole::humanCases()` to
`UserRole::seedableCases()`. Do **not** add a `super_admin` entry to `IDENTITIES`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/phpunit --filter RoleUserSeederTest`

Expected: PASS.

---

### Task 1.3: New `AuditAction` constants

**Files:**
- Modify: `backend/app/Domain/Audit/AuditAction.php`

No new `AuditableType` is needed — `AuditableType::USER_ACCOUNT` already exists and its
doc comment says it is "role-agnostic — login applies to every role," which fits every
action below.

- [ ] **Step 1: Add the constants** (follow the exact `noun.verb` style already used; add
  each to the `values()` list at the end — `values()` is one flat array, not grouped):

```php
public const SUPER_ADMIN_PROVISIONED = 'super_admin.provisioned';
public const SUPER_ADMIN_DEACTIVATED = 'super_admin.deactivated';
public const SUPER_ADMIN_ACTING_CONTEXT_CHANGED = 'super_admin.acting_context_changed';
public const USER_ACCOUNT_ROLE_CHANGED = 'user_account.role_changed';
public const USER_ACCOUNT_DEACTIVATED = 'user_account.deactivated';
public const USER_ACCOUNT_REACTIVATED = 'user_account.reactivated';
public const USER_ACCOUNT_SESSIONS_REVOKED = 'user_account.sessions_revoked';
public const USER_ACCOUNT_PASSWORD_RESET_SENT = 'user_account.password_reset_sent';
public const USER_ACCOUNT_DELETED = 'user_account.deleted';
public const USER_ACCOUNT_LIST_VIEWED = 'user_account.list_viewed';
```

- [ ] **Step 2: Test**

There is likely a test asserting `AuditAction::values()` has no duplicates and every
`const` is included (check `backend/tests/Unit/Domain/Audit/` for an existing
`AuditActionTest`; if none exists, that's fine — this is a mechanical addition). Run
whatever audit-domain unit tests exist:

Run: `cd backend && vendor/bin/phpunit --filter Audit`

Expected: PASS (nothing consumes these values yet, so nothing should break).

---

### Task 1.4: `config/super_admin.php`, env, and the provisioning command

**Files:**
- Create: `backend/config/super_admin.php`
- Modify: `backend/.env.example`
- Create: `backend/app/Console/Commands/ProvisionSuperAdmin.php`
- Create: `backend/tests/Feature/Console/ProvisionSuperAdminTest.php`

**Interfaces:**
- `config('super_admin.email')` ← env `SUPER_ADMIN_EMAIL` (default `null`).
- `php artisan super-admin:provision --name="Full Name"` — creates or re-activates.
- `php artisan super-admin:provision --deactivate` — disables and revokes tokens.

- [ ] **Step 1: Write the failing tests**

```php
public function test_it_creates_the_super_admin_when_the_email_is_configured(): void
{
    config(['super_admin.email' => 'owner@example.com']);

    $this->artisan('super-admin:provision', ['--name' => 'Westlie Casuncad'])
        ->assertExitCode(0);

    $this->assertDatabaseHas('users', [
        'email' => 'owner@example.com',
        'role' => UserRole::SuperAdmin->value,
        'status' => UserStatus::Active->value,
    ]);
}

public function test_it_is_idempotent(): void
{
    config(['super_admin.email' => 'owner@example.com']);
    $this->artisan('super-admin:provision', ['--name' => 'Westlie Casuncad']);
    $firstId = User::where('email', 'owner@example.com')->value('id');

    $this->artisan('super-admin:provision', ['--name' => 'Westlie Casuncad'])
        ->assertExitCode(0);

    $this->assertSame($firstId, User::where('email', 'owner@example.com')->value('id'));
    $this->assertSame(1, User::where('email', 'owner@example.com')->count());
}

public function test_it_refuses_to_hijack_an_existing_non_super_admin_email(): void
{
    config(['super_admin.email' => 'chair.seed@grc.test']);
    User::factory for this app does not exist — create inline, e.g.:
    User::create(['name' => 'X', 'email' => 'chair.seed@grc.test', 'password' => 'secret12#Aa',
        'role' => UserRole::ProgramChair, 'status' => UserStatus::Active]);

    $this->artisan('super-admin:provision', ['--name' => 'X'])->assertExitCode(1);
}

public function test_it_refuses_without_a_configured_email(): void
{
    config(['super_admin.email' => null]);
    $this->artisan('super-admin:provision', ['--name' => 'X'])->assertExitCode(1);
}

public function test_deactivate_disables_and_revokes_tokens(): void
{
    config(['super_admin.email' => 'owner@example.com']);
    $this->artisan('super-admin:provision', ['--name' => 'Westlie Casuncad']);
    $admin = User::where('email', 'owner@example.com')->first();
    $admin->createToken('test');

    $this->artisan('super-admin:provision', ['--deactivate'])->assertExitCode(0);

    $this->assertSame(UserStatus::Disabled, $admin->refresh()->status);
    $this->assertSame(0, $admin->tokens()->count());
}

public function test_both_actions_are_audited(): void
{
    // assertDatabaseHas('audit_logs', ['action' => AuditAction::SUPER_ADMIN_PROVISIONED])
    // and SUPER_ADMIN_DEACTIVATED after the matching command.
}
```

Follow this file's own convention for creating a `User` inline (grep any existing test for
`User::create([` — there is no factory in this codebase, see `AGENTS.md`/the design spec's
note that there is no `database/factories` directory).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/phpunit --filter ProvisionSuperAdmin`

Expected: FAIL — command does not exist.

- [ ] **Step 3: Implement**

`config/super_admin.php`:
```php
<?php

return [
    'email' => env('SUPER_ADMIN_EMAIL'),
];
```

Add `SUPER_ADMIN_EMAIL=` (empty) to `.env.example` with a one-line comment explaining it
is the only way to provision the account and must never be committed with a real value.

The command: find-or-create by `config('super_admin.email')` inside `DB::transaction`,
mirroring the locking pattern in `IssueSanctumToken`/`ActivateStaffAccount` (`whereKey`
+ `lockForUpdate()` when the row already exists). On create: `password` = a random
64-char string (unusable, like `InviteStaffAccount` does), `status` = Active,
`account_setup_completed_at` = now (so it's never treated as a pending invitation). On
"already exists with role `super_admin`": just re-activate (status = Active) — idempotent,
no duplicate row. On "already exists with a different role": `$this->error(...)` and
`return self::FAILURE`. On `--deactivate`: load by configured email, set
`status = Disabled`, delete all tokens (`$admin->tokens()->delete()`), audit
`SUPER_ADMIN_DEACTIVATED`. Audit the create/reactivate path as
`SUPER_ADMIN_PROVISIONED`. Use `AuditRecorder` + `AuditRequestContextFactory` the same way
`RoleUserSeeder`'s neighbors do — check how a non-HTTP context (a console command) builds
an `AuditRequestContext` elsewhere in this codebase (e.g. a scheduled Artisan command that
already audits, such as `faculty:merge-duplicates`) and copy that pattern exactly; if none
of the existing commands audit, construct `AuditRequestContext` directly with a generated
UUID request id and a null IP, and record the super admin's own id as the actor (a command
has no other actor).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/phpunit --filter ProvisionSuperAdmin`

Expected: PASS.

---

### Task 1.5: Audit Logs becomes reachable by the super admin directly

**Files:**
- Modify: `backend/routes/api.php`
- Modify: `backend/app/Policies/AuditLogPolicy.php`
- Modify: `backend/tests/Feature/Policies/AuditLogPolicyTest.php`
- Modify: `backend/tests/Feature/Api/V1/AuditLogsEndpointTest.php`
- Modify: `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`

**Why:** the super admin views the Console's own Audit Logs (including their own
switch/account actions) without needing to switch into Registrar Head first — Audit Logs
is Console furniture, not an office's workspace.

- [ ] **Step 1: Write the failing tests**

Add a `super_admin` case to `AuditLogPolicyTest`'s existing role-matrix data provider
expecting `true`. In `AuditLogsEndpointTest`, add a test that a super admin gets 200 on
`GET /api/v1/audit-logs` and `GET /api/v1/audit-logs/actors`. Update `ApiSurfaceTest`'s
pinned middleware string for those two routes from `role:registrar_head` to
`role:registrar_head,super_admin`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/phpunit --filter 'AuditLog|ApiSurface'`

Expected: FAIL.

- [ ] **Step 3: Implement**

In `routes/api.php`, pull the two routes currently at the lines containing
`Route::get('/audit-logs', ...)` and `Route::get('/audit-logs/actors', ...)` (today inside
the big `role:registrar_head` group alongside academic-terms/staff-invitations/etc. —
**do not** change that group's middleware, which must stay `registrar_head`-only for
everything else in it) out into their own small group right after it:

```php
Route::middleware('role:registrar_head,super_admin')->group(function (): void {
    Route::get('/audit-logs', AuditLogController::class)->name('audit-logs.index');
    Route::get('/audit-logs/actors', AuditActorController::class)->name('audit-logs.actors');
});
```

In `AuditLogPolicy`, change both `viewAny()` and `view()` from
`$user->role === UserRole::RegistrarHead` to
`in_array($user->role, [UserRole::RegistrarHead, UserRole::SuperAdmin], true)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/phpunit --filter 'AuditLog|ApiSurface'`
Then the full backend suite once (baseline check for this task):
Run: `cd backend && vendor/bin/phpunit`

Expected: PASS, same pass count as baseline plus your new tests.

---

### Task 1.6: Minimal frontend console shell

**Files:**
- Modify: `frontend/src/features/portal/role-capabilities.ts` + `.test.ts`
- Modify: `frontend/src/features/portal/module-registry.tsx` + `.test.tsx`
- Modify: `frontend/src/features/services/scheduling-service.ts`
- Modify: `frontend/src/features/components/portal/audit-logs-workspace.tsx` (its
  `authorized` check)
- Modify: any other exhaustive `Record<UserRole, …>` map `tsc --noEmit` reported in
  Task 1.1 Step 4

- [ ] **Step 1: Write the failing tests**

In `role-capabilities.test.ts`, add the expectation that
`rolePortalDefinitions.super_admin.modules.map(m => m.id)` is `["audit-logs"]` (for now —
Slice 3 will prepend `super-admin-accounts`), and that
`Object.keys(rolePortalDefinitions)` still equals `userRoles` in order (this test likely
already exists and will just need the new key to appear in the right place).

In the audit-logs workspace test file, add a case that a `super_admin` session is
`authorized`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run role-capabilities module-registry audit-logs-workspace`

Expected: FAIL / type errors.

- [ ] **Step 3: Implement**

`role-capabilities.ts`: add
```ts
super_admin: {
  roleLabel: "Super Admin",
  welcomeHeading: "Admin Console",
  modules: [
    { id: "audit-logs", label: "Audit Logs", description: "…", icon: … },
  ],
},
```
(copy the exact object shape from a neighboring role; reuse the existing audit-logs
label/description/icon from `registrar_head`'s entry rather than inventing new copy).

`scheduling-service.ts`: add `super_admin: {}` to the exhaustive `legalActions` map (the
super admin never takes schedule-proposal actions directly — only while acting as Dean/
Executive Director, where the record's `legalActions` lookup already uses the *effective*
role from `session.role`, so this empty entry is only there to satisfy the exhaustiveness
check for the console identity itself).

`audit-logs-workspace.tsx`: widen its `authorized` boolean to also allow `"super_admin"`.

Fix whatever other `Record<UserRole, …>` maps `tsc` flagged in Task 1.1 — there should be
very few at this point, since most per-role UI is reached through the switcher in Slice 2,
not directly as `super_admin`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`

Expected: PASS, 0 type errors.

---

**Slice 1 done when:** `php artisan super-admin:provision --name="…"` works locally against
a real `SUPER_ADMIN_EMAIL`, the account can sign in via Google (no code changes needed —
Google sign-in already matches any active account by email), and lands on a console
showing only Audit Logs. Run the full backend and frontend suites once; update
`PROGRESS.md`.

---

## Slice 2 — Department Switcher

Goal: the super admin can pick one of the 8 offices (with a college where required), use
that office's real workspace under their own identity, and switch back — safely across
multiple tabs, fully audited.

### Task 2.1: Acting-context columns on `personal_access_tokens`

**Files:**
- Create: `backend/database/migrations/2026_10_01_000001_add_acting_context_to_personal_access_tokens_table.php`
- Create/modify a migration test using `Tests\Support\RollsBackThroughMigration`

**Interfaces:** nullable `acting_role` (string) and `acting_college` (string) columns on
`personal_access_tokens`.

- [ ] **Step 1: Write the failing test**

```php
use Tests\Support\RollsBackThroughMigration;

final class AddActingContextToPersonalAccessTokensTableTest extends TestCase
{
    use RollsBackThroughMigration;

    public function test_it_adds_and_removes_the_acting_context_columns(): void
    {
        $this->assertTrue(Schema::hasColumn('personal_access_tokens', 'acting_role'));
        $this->assertTrue(Schema::hasColumn('personal_access_tokens', 'acting_college'));

        $this->rollBackThroughMigration('2026_10_01_000001_add_acting_context_to_personal_access_tokens_table');

        $this->assertFalse(Schema::hasColumn('personal_access_tokens', 'acting_role'));
    }
}
```

Read `tests/Support/RollsBackThroughMigration.php` first to use its exact method name and
calling convention — do not guess the signature.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/phpunit --filter ActingContextToPersonalAccessTokens`

Expected: FAIL — migration doesn't exist.

- [ ] **Step 3: Implement**

Plain nullable string columns, no foreign key (they hold enum *values*, like `users.role`
does, not ids). `down()` drops both columns.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/phpunit --filter ActingContextToPersonalAccessTokens`

Expected: PASS.

---

### Task 2.2: `ActingContext` value object

**Files:**
- Create: `backend/app/Domain/Identity/ActingContext.php`
- Create: `backend/tests/Unit/Domain/Identity/ActingContextTest.php`

**Interfaces:**
```php
final readonly class ActingContext
{
    public function __construct(
        public UserRole $role,
        public ?CollegeCode $college,
    ) {}

    public static function fromRequest(UserRole $role, ?CollegeCode $college): self; // validates
    public function label(): string; // "Dean (CCS)" or "Registrar Head"
}
```

- [ ] **Step 1: Write the failing tests**

```php
public function test_dean_requires_a_college(): void
{
    $this->expectException(InvalidArgumentException::class);
    ActingContext::fromRequest(UserRole::Dean, null);
}

public function test_registrar_head_forbids_a_college(): void
{
    $this->expectException(InvalidArgumentException::class);
    ActingContext::fromRequest(UserRole::RegistrarHead, CollegeCode::Ccs);
}

public function test_only_switchable_roles_are_accepted(): void
{
    $this->expectException(InvalidArgumentException::class);
    ActingContext::fromRequest(UserRole::Faculty, null);
}

public function test_label(): void
{
    $this->assertSame('Dean (CCS)', ActingContext::fromRequest(UserRole::Dean, CollegeCode::Ccs)->label());
    $this->assertSame('Registrar Head', ActingContext::fromRequest(UserRole::RegistrarHead, null)->label());
}
```

- [ ] **Step 2: Run tests to verify they fail** — class doesn't exist.

- [ ] **Step 3: Implement**, using `UserRole::superAdminSwitchableCases()` and
  `UserRole::collegeRequiredWhenActing()` from Task 1.1.

- [ ] **Step 4: Run tests to verify they pass.**

---

### Task 2.3: `User` model — the acting override (the trickiest part; read this carefully)

**Files:**
- Modify: `backend/app/Models/User.php`
- Create: `backend/tests/Unit/Models/UserActingContextTest.php`

**Do not use a get-only `Attribute` accessor for `role`/`college`.** It was tried and
rejected during design review: Laravel lists accessor-defined attributes as
cast-resolved, and because `role`/`college` are enum casts, `toArray()`/`toJson()` tries
to *construct* the enum class directly and crashes with "Cannot instantiate enum." Use an
override of the lower-level `getAttributeValue(string $key)` method instead.

**Interfaces:**
```php
private ?ActingContext $actingContext = null;

public function isSuperAdmin(): bool
{
    // reads the RAW stored value, bypassing any override below
    return $this->getRawOriginal('role') === UserRole::SuperAdmin->value;
}

public function actingContext(): ?ActingContext { return $this->actingContext; }

public function applyActingContext(?ActingContext $context): void
{
    $this->actingContext = $context;
}

protected function getAttributeValue($key)
{
    if ($this->actingContext !== null) {
        if ($key === 'role') {
            return $this->actingContext->role;
        }
        if ($key === 'college') {
            return $this->actingContext->college;
        }
    }

    return parent::getAttributeValue($key);
}
```

- [ ] **Step 1: Write the failing tests**

```php
public function test_role_and_college_reflect_the_acting_context(): void
{
    $admin = User::create([... 'role' => UserRole::SuperAdmin, 'status' => UserStatus::Active]);
    $admin->applyActingContext(ActingContext::fromRequest(UserRole::Dean, CollegeCode::Ccs));

    $this->assertSame(UserRole::Dean, $admin->role);
    $this->assertSame(CollegeCode::Ccs, $admin->college);
}

public function test_the_stored_row_and_raw_checks_are_unaffected(): void
{
    $admin = User::create([...]);
    $admin->applyActingContext(ActingContext::fromRequest(UserRole::Dean, CollegeCode::Ccs));

    $this->assertTrue($admin->isSuperAdmin());
    $this->assertSame('super_admin', $admin->getRawOriginal('role'));
    $this->assertSame('super_admin', $admin->getAttributes()['role']);
    $this->assertFalse($admin->isDirty('role'));
}

public function test_to_array_does_not_crash_and_reflects_the_acting_context(): void
{
    $admin = User::create([...]);
    $admin->applyActingContext(ActingContext::fromRequest(UserRole::RegistrarHead, null));

    $array = $admin->toArray();
    $this->assertSame('registrar_head', $array['role']);
}

public function test_saving_while_acting_still_writes_the_real_role(): void
{
    $admin = User::create([...]);
    $admin->applyActingContext(ActingContext::fromRequest(UserRole::Dean, CollegeCode::Ccs));
    $admin->forceFill(['last_login_at' => now()])->save();

    $this->assertSame('super_admin', $admin->fresh()->getRawOriginal('role'));
}

public function test_a_non_super_admin_with_no_acting_context_is_unaffected(): void
{
    $chair = User::create([... 'role' => UserRole::ProgramChair, 'college' => CollegeCode::Ccs]);
    $this->assertSame(UserRole::ProgramChair, $chair->role);
    $this->assertFalse($chair->isSuperAdmin());
}
```

- [ ] **Step 2: Run tests to verify they fail** — methods/override don't exist.

- [ ] **Step 3: Implement** exactly as the interface above.

- [ ] **Step 4: Run tests to verify they pass.**

Then run the **whole** backend suite once here — this is the highest-risk change in the
whole plan (it touches every `User` instance in the app):

Run: `cd backend && vendor/bin/phpunit`

Expected: still `2078+/2078+` passed (your new tests added, nothing broken). If anything
non-obvious breaks, stop and use superpowers:systematic-debugging before continuing —
do not patch around a `User` regression without understanding it.

---

### Task 2.4: The two middlewares

**Files:**
- Create: `backend/app/Http/Middleware/ApplySuperAdminActingContext.php`
- Create: `backend/app/Http/Middleware/EnsureUserIsSuperAdmin.php`
- Modify: `backend/bootstrap/app.php`
- Modify: `backend/routes/api.php` (both authenticated groups — see Task 2.7 for the exact
  insertion points)
- Create: `backend/tests/Feature/Auth/ApplySuperAdminActingContextTest.php`
- Create: `backend/tests/Feature/Auth/EnsureUserIsSuperAdminTest.php`

**`ApplySuperAdminActingContext::handle()`:**
```php
$user = $request->user();

if (! $user instanceof User || ! $user->isSuperAdmin()) {
    return $next($request);
}

$token = $user->currentAccessToken();
$context = ($token instanceof PersonalAccessToken && $token->acting_role !== null)
    ? ActingContext::fromRequest(UserRole::from($token->acting_role), CollegeCode::tryFrom($token->acting_college ?? ''))
    : null;

$user->applyActingContext($context);

return $next($request);
```

Handle the `Sanctum::actingAs()` fake-token case (used by ~6 existing test files): a fake
token is not a real `PersonalAccessToken` model instance in some call paths — guard with
`instanceof` as above so those tests keep passing unchanged.

**`EnsureUserIsSuperAdmin::handle()`:** throws `AuthorizationException` unless
`$request->user()?->isSuperAdmin()` — note **raw**, not the overridden `role`, so this
gate keeps working even while the super admin is acting as something else (needed for the
"switch back" / "exit" endpoint itself).

Register both as aliases in `bootstrap/app.php`:
```php
$middleware->alias([
    'role' => EnsureUserHasRole::class,
    'super_admin' => EnsureUserIsSuperAdmin::class,
]);
```

- [ ] **Step 1: Write the failing tests** — a test route or the real acting-context
  endpoints (Task 2.6) exercising: non-super-admin gets 403 from `super_admin` middleware;
  super admin with no token context gets the real `super_admin` role on `$request->user()`;
  super admin with a stored context sees it applied; a second concurrent token for the
  same user is unaffected (persistence is per-token).

- [ ] **Step 2: Run tests to verify they fail.**

- [ ] **Step 3: Implement** as above. Do **not** apply `ApplySuperAdminActingContext`
  inside the `super_admin`-only route group only — it must run in **both** main
  authenticated groups (see Task 2.7), because it needs to affect every endpoint the super
  admin might be acting on, not just the Console's own.

- [ ] **Step 4: Run tests to verify they pass.**

---

### Task 2.5: Switch / exit endpoints

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/SuperAdmin/ActingContextController.php`
- Create: `backend/app/Http/Requests/Api/V1/SuperAdmin/UpdateActingContextRequest.php`
- Create: `backend/app/Actions/SuperAdmin/SetActingContext.php`
- Create: `backend/app/Actions/SuperAdmin/ClearActingContext.php`
- Modify: `backend/app/Http/Resources/Api/V1/UserResource.php`
- Modify: `backend/routes/api.php`
- Create: `backend/tests/Feature/Api/V1/SuperAdmin/ActingContextEndpointTest.php`
- Modify: `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`

**Interfaces:**
- `PUT /api/v1/super-admin/acting-context` — body `{role: string, college?: string|null}`.
  Validates `role` is one of `UserRole::superAdminSwitchableCases()` and the college rule
  via `ActingContext::fromRequest` (catch its `InvalidArgumentException` and turn it into a
  422, same pattern other Form Requests/Actions use elsewhere in this codebase — check how
  an existing Action surfaces a domain validation error as a 422 `ValidationException` and
  copy that, e.g. `InviteStaffAccount`'s `ValidationException::withMessages(...)`).
- `DELETE /api/v1/super-admin/acting-context` — no body.
- Both write `acting_role`/`acting_college` onto the **current** `PersonalAccessToken` row
  (`$user->currentAccessToken()`), audit (`SUPER_ADMIN_ACTING_CONTEXT_CHANGED`, payload
  `{from: ..., to: ...}` — remember `AuditRecorder` forbids keys containing
  `token`/`secret`/`password`/`email`/`phone`/`mobile`/`address`, so don't name a payload
  key `token`), then return `UserResource::make($user)` (after re-applying the new context
  on the in-memory `$user` instance so the response reflects it immediately).

- [ ] **Step 1: Write the failing tests**

```php
public function test_a_super_admin_can_switch_to_an_office(): void
{
    $response = $this->withToken($superAdminToken)
        ->putJson('/api/v1/super-admin/acting-context', ['role' => 'dean', 'college' => 'ccs']);

    $response->assertOk()->assertJsonPath('data.role', 'dean')->assertJsonPath('data.college', 'ccs');
}

public function test_dean_without_a_college_is_rejected(): void
{
    $this->withToken($superAdminToken)
        ->putJson('/api/v1/super-admin/acting-context', ['role' => 'dean'])
        ->assertStatus(422);
}

#[DataProvider('nonSwitchableRoles')] // faculty, student, queue_kiosk, super_admin
public function test_non_switchable_roles_are_rejected(string $role): void { /* 422 */ }

public function test_a_non_super_admin_is_forbidden(): void
{
    $this->withToken($regularUserToken)
        ->putJson('/api/v1/super-admin/acting-context', ['role' => 'dean', 'college' => 'ccs'])
        ->assertForbidden();
}

public function test_switching_then_calling_a_registrar_head_only_route_works(): void
{
    $this->withToken($superAdminToken)->getJson('/api/v1/audit-logs/actors')->assertOk(); // already open to super_admin — use a TRUE registrar_head-only route instead, e.g. POST /academic-terms
    $this->withToken($superAdminToken)->putJson('/api/v1/super-admin/acting-context', ['role' => 'registrar_head']);
    $this->withToken($superAdminToken)->postJson('/api/v1/academic-terms', [...])->assertCreated(); // or whatever its real validation needs
}

public function test_exit_clears_the_context(): void
{
    $this->withToken($superAdminToken)->putJson('/api/v1/super-admin/acting-context', ['role' => 'registrar_head']);
    $this->withToken($superAdminToken)->deleteJson('/api/v1/super-admin/acting-context')->assertOk()
        ->assertJsonPath('data.role', 'super_admin');
}

public function test_context_is_per_token_not_per_user(): void
{
    // issue a second token for the same super admin, switch using the first token,
    // assert a request using the second token still sees role === 'super_admin'.
}

public function test_the_action_is_audited(): void
{
    // assertDatabaseHas('audit_logs', ['action' => AuditAction::SUPER_ADMIN_ACTING_CONTEXT_CHANGED, 'actor_user_id' => $admin->id]);
}
```

Use real bearer tokens throughout (`withToken($this->tokenFor(...))`, matching this
codebase's existing style per the design spec's findings), not `Sanctum::actingAs`, since
this feature is specifically about real per-token state.

- [ ] **Step 2: Run tests to verify they fail.**

- [ ] **Step 3: Implement.** Route placement in `routes/api.php` — add after the
  `it-control` group (after the line with `AutomationRunController::class, 'show'`):

```php
Route::prefix('super-admin')->name('super-admin.')->middleware('super_admin')->group(function (): void {
    Route::put('/acting-context', [ActingContextController::class, 'update'])->name('acting-context.update');
    Route::delete('/acting-context', [ActingContextController::class, 'destroy'])->name('acting-context.destroy');
});
```

Add `UserResource::acting_context` as
`$this->resource->isSuperAdmin() ? ['role' => ..., 'college' => ...] : null`, only ever
populated for a super admin (check via the raw flag, not the possibly-overridden `role`).

- [ ] **Step 4: Run tests to verify they pass**, then update `ApiSurfaceTest`'s pinned
  route list with the two new routes.

Run: `cd backend && vendor/bin/phpunit`

---

### Task 2.6: `/auth/me` and audit resources carry acting context

**Files:**
- Modify: `backend/app/Http/Resources/Api/V1/UserResource.php` (if not already covered by
  Task 2.5 — `GET /auth/me` uses the same resource)
- Modify: `backend/app/Http/Resources/Api/V1/AuditLogResource.php`
- Modify: `backend/app/Http/Resources/Api/V1/AuditActorResource.php`
- Modify: `backend/app/Models/AuditLog.php`
- Modify: `backend/app/Support/Audit/AuditRecorder.php`
- Create: migration `2026_10_01_000002_add_acting_context_to_audit_logs_table.php`
- Modify: `backend/tests/Feature/Database/AuditAndNotificationMigrationTest.php` (exact
  column list — read it first)
- Modify: `backend/tests/Feature/Api/V1/AuditLogsEndpointTest.php` (exact key list — read
  it first)

**`AuditLog::effectiveActorRole(): UserRole`** — returns
`$this->acting_role !== null ? UserRole::from($this->acting_role) : $this->actor->role`.
Add this method; it is the fix for the `ScheduleProposalResource` bug in Task 2.8.

**`AuditRecorder::record()`** — fill the two new columns from
`$actor->actingContext()?->role->value` / `?->college?->value`, nullable, no change to its
public signature.

- [ ] **Step 1: Write the failing tests**

Update `AuditAndNotificationMigrationTest`'s exact column assertion for `audit_logs` to
include `acting_role`, `acting_college`. Add to `AuditLogsEndpointTest`: perform an action
while acting as Dean, then assert the resulting `GET /api/v1/audit-logs` row has
`acting_role: "dean"`, `acting_role_label: "Dean"`, `acting_college: "ccs"`, while
`actor_role` is still `"super_admin"`.

- [ ] **Step 2: Run tests to verify they fail.**

- [ ] **Step 3: Implement** the migration (nullable strings, reversible), the recorder
  change, the two resources' new fields, and `effectiveActorRole()`.

- [ ] **Step 4: Run tests to verify they pass.**

Run: `cd backend && vendor/bin/phpunit --filter 'Audit'`

---

### Task 2.7: Wire the acting-context middleware into both authenticated groups

**Files:**
- Modify: `backend/routes/api.php`

- [ ] **Step 1 (no new test — this is covered by Task 2.4's and 2.5's tests actually
  exercising the full request pipeline; just make sure those pass only after this wiring is
  in place — do this task before running Task 2.5's Step 4 for real, or re-run it after).**

- [ ] **Step 2: Implement.** In the small group around the current
  `Route::middleware(['auth:sanctum', EnsureUserIsActive::class, EnsureQueueKioskUsesDeviceSurface::class])->group(...)`
  wrapping `/logout` and `/me`, insert `ApplySuperAdminActingContext::class` immediately
  after `EnsureUserIsActive::class`:
  `['auth:sanctum', EnsureUserIsActive::class, ApplySuperAdminActingContext::class, EnsureQueueKioskUsesDeviceSurface::class]`.
  Do the exact same insertion in the big main group a few lines below it
  (`Route::middleware(['auth:sanctum', EnsureUserIsActive::class, EnsureQueueKioskUsesDeviceSurface::class, 'throttle:60,1'])->group(...)`).
  Both groups currently share the same three-middleware prefix before their own extras —
  add the new middleware in the same relative position in both.

- [ ] **Step 3: Run the full backend suite.**

Run: `cd backend && vendor/bin/phpunit`

Expected: no regression. Pay special attention to any test asserting an exact query count
on an ordinary (non-super-admin) endpoint — `ApplySuperAdminActingContext` must return
before touching the database for a non-super-admin, so these should be unaffected; if one
fails, that's a real bug in the middleware, not a test to loosen.

---

### Task 2.8: Fix the `ScheduleProposalResource` latent contract bug

**Files:**
- Modify: `backend/app/Http/Resources/Api/V1/ScheduleProposalResource.php`
- Modify: `backend/tests/Feature/Api/V1/ScheduleProposalsEndpointTest.php` (find its exact
  name — may be under a different filename; search for `returned_by_role`)

- [ ] **Step 1: Write the failing test**

Return a schedule proposal while acting as Dean (using the switcher endpoints from Task
2.5), assert the resource's `returned_by_role` is `"dean"` (not `"super_admin"`) and each
`decision_history[].actor_role` entry for that action is also `"dean"`.

- [ ] **Step 2: Run tests to verify they fail** — today both emit `$audit->actor->role->value`,
  the raw stored role.

- [ ] **Step 3: Implement.** Replace both `$lastReturnedAudit?->actor->role->value` and
  `$audit->actor->role->value` in the `decision_history` map with
  `$lastReturnedAudit?->effectiveActorRole()->value` and
  `$audit->effectiveActorRole()->value` respectively (the method added in Task 2.6).

- [ ] **Step 4: Run tests to verify they pass.**

---

### Task 2.9: `X-Acting-Context` multi-tab guard

**Files:**
- Modify: `backend/config/cors.php` (`allowed_headers`)
- Modify: `backend/app/Http/Middleware/ApplySuperAdminActingContext.php`
- Modify: `backend/app/Support/Http/ApiExceptionRenderer.php` (if a new error code needs
  explicit mapping — check how existing 409s render their `error.code`, e.g. search for an
  existing `409` response and copy its shape)
- Modify: `frontend/src/features/services/api-client.ts`
- Create/modify: a small frontend "acting context store" the client reads on every request

**Contract:** every authenticated request from a signed-in super admin's browser sends
`X-Acting-Context: none` or `X-Acting-Context: dean:ccs` (role, or `role:college`),
reflecting what that **tab** currently believes. `/auth/me` and the two acting-context
endpoints are exempt (a tab must be able to resync without the header blocking it).

- [ ] **Step 1: Write the failing tests**

Backend: a super admin's token has `acting_role = 'dean'`, `acting_college = 'ccs'`
stored, but the request sends `X-Acting-Context: registrar_head` (simulating a stale tab
that switched in another tab) → expect 409 with `error.code === 'ACTING_CONTEXT_CHANGED'`.
A request with the matching header, or with no header at all from a **non**-super-admin,
is unaffected (the header is only meaningful for super admins; a non-super-admin sending
one is simply ignored — don't make it an error, other roles' existing clients never send
it).

Frontend: a service/unit test on the acting-context store + a client test asserting the
header is attached, and that a 409 with that code triggers the resync handler (re-fetch
`/auth/me`, replace session, clear query cache, show a toast) rather than signing out.

- [ ] **Step 2: Run tests to verify they fail.**

- [ ] **Step 3: Implement.**

Backend, inside `ApplySuperAdminActingContext` (after resolving `$context` from the
token, before calling `$next($request)`): skip the check entirely for `/auth/me` and the
acting-context routes (check `$request->routeIs('me', 'super-admin.acting-context.*')` or
equivalent — match whatever route-matching helper this codebase already uses elsewhere for
similar exemptions, e.g. how kiosk routes are excluded from something). Parse the header
into a comparable shape and compare against `$context`; on mismatch, abort with a 409 whose
body matches this API's existing error envelope
(`{"error": {"code": "ACTING_CONTEXT_CHANGED", "message": "...", "request_id": "..."}}`) —
reuse `ApiExceptionRenderer`'s existing envelope-building helper rather than hand-rolling
JSON.

Add `X-Acting-Context` to `config/cors.php`'s `allowed_headers`, next to the existing
`X-Queue-Kiosk-Token` entry.

Frontend: a small module (e.g. `features/auth/acting-context-store.ts`) holding the
current tab's belief, read by `api-client.ts` the same way it already reads the auth
token (the kiosk's per-request header override is the closest existing pattern — reuse its
shape, don't invent a parallel mechanism). On any response, check for the 409 code via the
existing error-parsing path and call a provided resync callback (wired up in Slice 2's
frontend work, Task 2.10) instead of the normal 401 sign-out handler.

- [ ] **Step 4: Run tests to verify they pass.**

---

### Task 2.10: Frontend — session, switcher UI, banner, cache handling

**Files:**
- Modify: `frontend/src/features/schemas/auth-schema.ts` (optional `acting_context` on
  `userSchema`)
- Modify: `frontend/src/features/auth/auth-types.ts` (`AuthSession.superAdmin?`)
- Modify: `frontend/src/features/auth/api-auth-gateway.ts` (export `toSession`; map
  `acting_context`)
- Modify: `frontend/src/features/auth/auth-context.tsx` / `auth-context-value.ts` (add
  `replaceSession(user)` — sets session directly from a `UserResource`-shaped payload, no
  network call, as distinct from `restore()`)
- Create: `frontend/src/features/services/super-admin-service.ts` (the two PUT/DELETE
  calls)
- Create: `frontend/src/features/schemas/super-admin-schema.ts`
- Create: `frontend/src/features/hooks/use-super-admin-acting-context.ts` (wraps the
  service, drives the acting-context store from Task 2.9, clears the query cache, navigates,
  shows the toast on a forced resync)
- Modify: `frontend/src/features/components/layouts/portal-shell.tsx` (switcher in
  `.portal-topbar__actions` + mobile Sheet; banner between the header and the storage
  Alert)
- Create: `frontend/src/features/components/portal/super-admin-switcher.tsx` + `.test.tsx`
- Fix the two hand-built `AuthContextValue` mocks that will now be missing
  `replaceSession`: `program-chair-enrollment-workspace.test.tsx` and
  `queue-kiosk-access-workspace.test.tsx`

- [ ] **Step 1: Write the failing tests** (component test for the switcher: lists the 8
  offices by label, shows a college `Select` only for Program Head/Dean, calls the
  mutation, and — on success — the banner appears with the right "Acting as …" text;
  keyboard navigation and an axe check per this repo's existing component-test
  conventions, mirroring a comparable existing dialog/menu test file).

- [ ] **Step 2: Run tests to verify they fail.**

- [ ] **Step 3: Implement.**

`toSession()` gains:
```ts
superAdmin: user.role === "super_admin" || user.acting_context != null
  ? { actingContext: user.acting_context ?? null }
  : undefined,
```
(exact shape is yours to finalize, but keep `session.role` as the single source of truth
for every existing guard/branch — do not introduce a second role field anything else
reads).

Switch/exit flow in the new hook: call the service, on success call
`auth.replaceSession(response.data)`, then `queryClient.cancelQueries()` +
`queryClient.clear()`, then `router.replace("/portal")`. On the 409 resync path (wired from
Task 2.9's client handler): call `GET /auth/me`, `replaceSession`, clear the cache, show a
`sonner` toast ("Your workspace changed in another tab — refreshed.").

Banner and switcher placement exactly as the design spec says (topbar actions row before
the bell; mobile Sheet body; banner between the header and the existing storage-unavailable
`Alert`) — read the current `portal-shell.tsx` structure around those spots before editing,
line numbers will have shifted since the design spec was written.

- [ ] **Step 4: Run tests to verify they pass.**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`

---

**Slice 2 done when:** a super admin can switch to each of the 8 offices, use that office's
real nav, see "Westlie Casuncad" on records they create, see the audit log attribute the
action to "Super Admin (as X)", switch back, and a second tab resyncs instead of acting
on stale state. Run both full suites; update `PROGRESS.md`.

---

## Slice 3 — Accounts & Access

Goal: the console's own account-management module. Build in this order (each is one Action
+ one Controller method + one Form Request + tests); all endpoints sit under
`/api/v1/super-admin/users`, guarded by the `super_admin` middleware alias from Slice 2
**plus** a new inline "Console mode only" check (reject with 409 if
`$request->user()->actingContext() !== null`) on every one of them.

Register a `UserAccountPolicy` and its gates **explicitly** in `AppServiceProvider::boot()`
next to the existing `Gate::define(...)` calls — do **not** let Laravel auto-discover a
class literally named `UserPolicy`, because that name would also apply to the two existing
gates already called with a bare `User` (`view-faculty-profile`,
`update-workforce-profile`), silently changing their behavior.

### Task 3.1: `GET` list

Paginated, `ListManagedUsers` action, search (`q` over name/email), filters (`role`,
`status`, `college`, `pending_setup`). Audit the read itself
(`USER_ACCOUNT_LIST_VIEWED`), following `ListAuditLogs`'s existing precedent of auditing
its own privileged reads. `super_admin`/`queue_kiosk` rows appear but are flagged
`manageable: false` in the resource. TDD as in prior tasks: write the role-matrix test
first (only `super_admin` gets 200; everyone else 403), then filters, then the
Console-mode-only 409, then implement.

### Task 3.2: `POST` invite (widen in 3 places, together)

Modify `InviteStaffAccount::handle()` to take the allowed-role list as a parameter instead
of hard-coding `UserRole::registrarInvitableCases()`; the existing Registrar Head
`StaffInvitationController` passes `UserRole::registrarInvitableCases()` explicitly
(unchanged behavior), while the new super-admin controller passes
`UserRole::superAdminInvitableCases()`. Widen the matching check inside
`SendStaffAccountSetupInvitation` and both checks inside `ActivateStaffAccount` (lines
flagged in the design spec) to the superset list too — an Admission Staff invitee must be
able to redeem their setup code through the existing `/auth/staff-account-setup` flow.
Confirm `ActivateStaffAccount` keeps (does not let the invitee overwrite) any college the
inviter pre-set, and that the setup page shows it read-only in that case — check
`StaffAccountSetupRequest` and the `account-setup-page.tsx` college step before assuming
either needs a change; only touch what the test proves is broken.

Test both old and new paths keep working: a Registrar Head still cannot invite Admission
Staff (regression test); a super admin can invite one and it's redeemable.

### Task 3.3: `PATCH …/role`

`ChangeUserRole` action: staff↔staff only (reject if source or target role is `student`,
`queue_kiosk`, or `super_admin`); require `reason`; apply the same college rule as invite;
return 409 if target is `Faculty` with any `sections` row in a non-archived
`academic_term` (query via the existing `Section`/`AcademicTerm` relationship, check how
"non-archived" is tested elsewhere, e.g. `AcademicTermStatus`); revoke the target's tokens
on success; audit before/after.

### Task 3.4: `PATCH …/status`

`SetUserAccountStatus` action: deactivate (revoke tokens) / reactivate, with `reason`.
Reactivating an account whose `account_setup_completed_at` is still null returns 409
("resend the setup invitation instead"). Reject `queue_kiosk` targets (Accounting's own
flow owns that).

### Task 3.5: `POST …/setup-invitation`

Resend: branch on target role — `student` → `SendStudentAccountSetupInvitation`,
otherwise → `SendStaffAccountSetupInvitation`. Reuse both unchanged.

### Task 3.6: `POST …/password-reset`

Reuse `SendPasswordResetCode` with the same Active/non-kiosk precondition
`ForgotPasswordController` already applies (copy that exact filter, don't invent a looser
one). Add a dedicated rate limiter for this new route (the Action itself has no built-in
per-user throttle — check how `LoginRequest` builds its throttle key and mirror that
pattern, keyed by the super admin's own user id this time, not an email/IP). Surface the
Action's own `sent`/`failed` result to the caller rather than assuming success.

### Task 3.7: `DELETE …/sessions`

Trivial: `$target->tokens()->delete()`, audited.

### Task 3.8: `DELETE …` (permanent delete)

`DeleteUnusedUserAccount` action: inside a transaction with the target row locked
(`lockForUpdate()`), first assert `account_setup_completed_at` is null, then query
`information_schema.KEY_COLUMN_USAGE` (or `information_schema.TABLE_CONSTRAINTS` joined to
`KEY_COLUMN_USAGE`) for every table/column with a foreign key referencing `users.id`,
excluding the three pre-activation auth tables named in the design spec, and run one
`exists` check per remaining table for `= $target->id`. If any row exists, throw a
domain exception mapped to 409 ("Deactivate instead — this account has history."). If none
exist: delete the target's tokens explicitly, then delete the user row, inside the same
transaction; also catch a residual `QueryException` with SQLSTATE `23000` around the
final delete and map it to the same 409 rather than a 500 (belt-and-suspenders against a
future FK the information_schema scan might miss due to a naming edge case).

Write this task's tests with real fixtures proving the boundary, not just the happy path:
a never-activated invited Program Chair with zero related rows → 200; a never-activated
invited Faculty who already has one `faculty_availabilities` row → 409; a disabled legacy
`@grc.test` faculty account with teaching history → 409; any student → 409 (has a
`student_profiles` row); any account with an `audit_logs` row as actor → 409.

### Task 3.9: Console-mode-only guard

A tiny shared Form Request trait or controller `before`-style check (this codebase has no
controller middleware hook for "reject if acting" yet — simplest: a private helper method
called at the top of every `SuperAdmin\Users\*Controller` method, or a dedicated
`EnsureSuperAdminIsNotActing` middleware applied to the whole `super-admin/users` route
group — prefer the middleware, it's one addition instead of N repeated checks and matches
this codebase's existing style of expressing a rule once in middleware). Test it on at
least one endpoint from each task above; no need to repeat it exhaustively on all nine.

### Task 3.10: Frontend module

`super-admin-accounts` workspace (Table + Pagination, filters, row actions opening
Dialog/AlertDialog, the typed-email confirmation for permanent delete), service, schema,
hook, and its place as the **first** entry in `rolePortalDefinitions.super_admin.modules`
(ahead of `audit-logs`). Every PRD §12.4 state. `422` → field errors via React Hook Form +
Zod, matching this codebase's existing form-error-mapping pattern (copy from any existing
workspace form rather than reinventing it).

**Slice 3 done when:** every row in §D of the design spec works end to end through the UI,
`StaffInvitationsEndpointTest` still passes unmodified (the Registrar Head boundary is
untouched), and both full suites pass. Update `PROGRESS.md`.

---

## Slice 4 — Docs and verification

- [ ] **PRD v3.3.** Bump the revision header and add a `### v3.3` entry to the Revision
  Summary (mirror the existing v3.2 entry's format). Add a new §3.x "Super Admin" section
  right after the existing "Queue kiosk device identity" note (§3, after §3.9), using the
  same framing ("not a tenth primary actor") the kiosk note uses for itself. Update §8.4's
  endpoint list with the new routes. Add a short paragraph to §9.1 (authentication) noting
  the CLI-only provisioning and the Google-sign-in security dependency, and to §9.4
  (authorization) noting the acting-context mechanism. Add the two new column pairs to
  §10.4's `audit_logs` entry (and note the `personal_access_tokens` columns aren't part of
  the manuscript-aligned data model proper — they're Sanctum's own table — so they don't
  need a §10 entry of their own, just a mention in the ADR, which already has one).
- [ ] **Data dictionary.** Add the new columns/table to whatever file in
  `docs/data-dictionary/` already covers `audit_logs` and `users`-adjacent tables — find it
  first (`docs/data-dictionary/cross-cutting-backend.md` was referenced earlier this
  session), follow its existing format exactly.
- [ ] **Runbook.** Create `docs/runbooks/super-admin.md`: setting `SUPER_ADMIN_EMAIL` in
  Dokploy, running `php artisan migrate` and `php artisan super-admin:provision` on the
  VPS, enabling Google 2-Step Verification on the owner's Gmail account before relying on
  this, and the `--deactivate` incident-response path.
- [ ] **`docs/testing/SEEDED_IDENTITIES.md`.** Add a note that `super_admin` is
  deliberately absent from the seeded identities table, with a one-line pointer to the
  runbook and to this plan, so a future reader doesn't "fix" that as an oversight.
- [ ] **e2e.** `e2e/tests/super-admin.spec.ts`: seed a super admin **only** in the
  `testing` environment (check how `e2e/scripts/reset-db.mjs` seeds other roles and extend
  it consistently, or provision via the artisan command directly against the test
  database — whichever this repo's e2e setup already prefers for roles that aren't in the
  default seeder). Journey: sign in → switch to Registrar Head → approve a real enrollment
  → the resulting audit-log row shows "as Registrar Head" → exit → invite and deactivate an
  account.
- [ ] **Real-browser pass** on an isolated stack (private MariaDB on its own port, a
  second `php artisan serve` port, a second Next.js build on its own port — never the
  owner's main dev ports/database): Google sign-in as the real super admin email in a local
  `.env` with `SUPER_ADMIN_EMAIL` set to it; every office via the switcher, spot-checking at
  least one nav module per office; reload keeps the office; open a second tab, switch in the
  first, confirm the second resyncs instead of acting stale; logout clears everything;
  mobile switcher works.
- [ ] **`PROGRESS.md`.** A session entry recording what shipped, test counts before/after,
  and any deviation from this plan with its reason (per `AGENTS.md`).

**Full plan done when:** all four slices are checked off, both full suites pass, `tsc` is
clean, and the owner has the runbook in hand for the production rollout (which they, not
the implementer, decide when to trigger per `AGENTS.md`'s "do not commit or push unless the
user explicitly requests a GitHub saving point").
