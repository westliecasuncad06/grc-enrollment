# Queue Kiosk Portal and Live Student Queue View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require physical kiosk proof for Student queue claims, provide a dedicated dual-session `/queue` flow, give Accounting Staff controlled shared-credential management, and render one live Student queue view across kiosk and portal contexts.

**Architecture:** Keep `POST /api/v1/queue-tickets` as the single claim contract and add a Student-only second-token middleware condition; Accounting continues through the existing Policy path unchanged. A non-human `queue_kiosk` Sanctum identity is restricted to device validation/logout, while the frontend keeps its token in a dedicated persistent store and keeps each Student token in memory only. The existing `GET /api/v1/queue-status` powers one strict query/service layer and one reusable live panel with a three-second poll and accessible waiting-to-serving alerts.

**Tech Stack:** Laravel 12, PHP 8.2+, Sanctum bearer tokens, MariaDB, PHPUnit, Next.js 16 App Router, React 19, strict TypeScript, TanStack Query 5, React Hook Form, Zod 4, Tailwind CSS 4, shadcn/ui, Sonner, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-23-queue-kiosk-live-student-view-design.md`

## Global Constraints

- Read the approved spec and the latest `PROGRESS.md` entry before each execution session.
- Preserve the existing `/api/v1/queue-tickets`, `ClaimQueueTicket`, `TransitionQueueTicket`, `TransitionQueueCycle`, and `queue_cycles` behavior.
- Student self-claim requires `Authorization: Bearer <student>` plus `X-Queue-Kiosk-Token: <device>`; Accounting on-behalf claim requires no kiosk header.
- `queue_kiosk` is a non-human, non-learner role and must never render or call the normal `/portal` surface.
- Keep the normal portal bearer in `auth-token.ts`, the kiosk bearer in `kiosk-token.ts`, and the kiosk Student bearer in React memory only.
- Never place a bearer token in a URL, TanStack Query key, log, audit payload, error copy, or browser storage other than its one approved token store.
- Credential responses are Accounting-only and `Cache-Control: no-store, private`; audit payloads never contain email, plaintext, hash, ciphertext, header, or token data.
- Poll `GET /api/v1/queue-status` every `3_000` ms with `refetchIntervalInBackground: true` and state the browser-throttling limitation honestly.
- Do not add Web Push, service workers, a public display, SMS/email alerts, an inactivity duration, priority criteria, skip limits, or no-show policy.
- Use Form Requests, Policies, Actions, API Resources, transactions, reversible migrations, strict Zod contracts, service modules, TanStack hooks, and existing shadcn components.
- Update `PROGRESS.md` before substantial commands, after each red/green milestone or failure, and before ending.
- Work directly on `main`; do not create a worktree, commit, or push unless the user explicitly requests a GitHub saving point.
- Preserve the pre-existing untracked root `node_modules/` directory.

## File and interface map

### Backend identity and persistence

- Create `backend/app/Domain/Identity/QueueKioskAccess.php`: canonical header and Sanctum ability constants.
- Modify `backend/app/Domain/Identity/UserRole.php`: `QueueKiosk`, `isDevice()`, and `humanCases()`.
- Create `backend/database/migrations/2026_08_23_000003_create_queue_kiosk_credentials_table.php`: credential schema and reversible drop.
- Create `backend/app/Models/QueueKioskCredential.php`: hidden ciphertext plus `user()` and `updatedBy()` relations.
- Modify `backend/app/Models/User.php`: optional `queueKioskCredential()` relation.
- Create `backend/database/seeders/QueueKioskSeeder.php`: local/testing `queue@grc.com` identity and encrypted development secret.
- Modify `backend/database/seeders/RoleUserSeeder.php`: iterate `UserRole::humanCases()`.
- Modify `backend/database/seeders/DatabaseSeeder.php`: call `QueueKioskSeeder` after human identities.

### Backend authorization and APIs

- Modify `backend/app/Actions/Auth/AuthenticateUser.php`: kiosk-specific token ability.
- Create `backend/app/Http/Middleware/EnsureQueueKioskUsesDeviceSurface.php`: allow direct device calls only to `auth.me` and `auth.logout`.
- Create `backend/app/Http/Middleware/EnsureStudentQueueClaimUsesKiosk.php`: validate the Student claim's second bearer.
- Modify `backend/routes/api.php`: add middleware and credential routes without duplicating the claim URI.
- Create `backend/app/Policies/QueueKioskCredentialPolicy.php`.
- Create `backend/app/Actions/QueueKiosk/ViewQueueKioskCredential.php`.
- Create `backend/app/Actions/QueueKiosk/ChangeQueueKioskPassword.php`.
- Create `backend/app/Http/Requests/Api/V1/QueueKioskCredential/UpdateQueueKioskCredentialRequest.php`.
- Create `backend/app/Http/Resources/Api/V1/QueueKioskCredentialResource.php`.
- Create `backend/app/Http/Controllers/Api/V1/QueueKioskCredentialController.php`.
- Modify `backend/app/Domain/Audit/AuditAction.php` and `backend/app/Domain/Audit/AuditableType.php`.

### Frontend shared services

- Modify `frontend/src/features/services/api-client.ts`: explicit token/header overrides and 401 suppression.
- Modify `frontend/src/features/services/auth-service.ts`: override-aware `fetchCurrentUser()` and `logout()`.
- Modify `frontend/src/features/auth/api-auth-gateway.ts`, `auth-error.ts`, `auth-context.tsx`, `auth-context-value.ts`, and `auth-route-guards.tsx`: reject/revoke a kiosk role on the normal portal surface and return the authenticated session from `signIn()`.
- Modify `frontend/src/features/auth/roles.ts`, `frontend/src/features/schemas/auth-schema.ts` transitively through its enum import, and all total role maps/tests.
- Modify `frontend/src/tests/render-app.tsx`: keep the shared auth test helper aligned with `signIn(): Promise<AuthSession>`.

### Frontend Cashier credential workspace

- Create `frontend/src/features/schemas/queue-kiosk-credential-schema.ts`.
- Create `frontend/src/features/services/queue-kiosk-credential-service.ts`.
- Create `frontend/src/features/hooks/use-queue-kiosk-credential.ts`.
- Create `frontend/src/features/components/portal/queue-kiosk-access-workspace.tsx`.
- Modify `frontend/src/features/schemas/audit-schema.ts`: expose the two new actions and auditable type in Registrar filter options.
- Modify `frontend/src/features/portal/role-capabilities.ts` and `module-registry.tsx`.

### Frontend Student live queue and kiosk

- Create `frontend/src/features/schemas/student-queue-schema.ts`.
- Create `frontend/src/features/services/student-queue-service.ts`.
- Create `frontend/src/features/hooks/use-student-queue.ts`.
- Create `frontend/src/features/lib/queue-alert-preference.ts`.
- Create `frontend/src/features/hooks/use-queue-call-alert.ts`.
- Create `frontend/src/features/components/queue/student-queue-live-panel.tsx`.
- Modify `frontend/src/features/components/portal/enrollment-queue-payment-panel.tsx` and `frontend/src/features/components/pages/portal-overview-page.tsx`.
- Create `frontend/src/features/kiosk/kiosk-token.ts`.
- Create `frontend/src/features/hooks/use-queue-kiosk-session.ts`.
- Create `frontend/src/features/components/kiosk/queue-kiosk-device-login.tsx`.
- Create `frontend/src/features/components/kiosk/queue-kiosk-student-login.tsx`.
- Create `frontend/src/features/components/pages/queue-kiosk-page.tsx`.
- Create `frontend/src/app/queue/page.tsx`.
- Modify `frontend/src/features/services/queue-ticket-service.ts`, `frontend/src/features/hooks/use-queue-tickets.ts`, and `frontend/src/app/globals.css`.

### Documentation

- Create `docs/adr/0023-queue-kiosk-dual-session-and-live-student-view.md`.
- Modify `PRD.md`, `docs/api/openapi.yaml`, `docs/testing/SEEDED_IDENTITIES.md`, and `PROGRESS.md`.

---

### Task 1: Add the device role, credential persistence, and local fixture

**Files:**
- Create: `backend/app/Domain/Identity/QueueKioskAccess.php`
- Modify: `backend/app/Domain/Identity/UserRole.php`
- Create: `backend/database/migrations/2026_08_23_000003_create_queue_kiosk_credentials_table.php`
- Create: `backend/app/Models/QueueKioskCredential.php`
- Modify: `backend/app/Models/User.php`
- Create: `backend/database/seeders/QueueKioskSeeder.php`
- Modify: `backend/database/seeders/RoleUserSeeder.php`
- Modify: `backend/database/seeders/DatabaseSeeder.php`
- Modify: `backend/tests/Unit/Domain/Identity/UserRoleTest.php`
- Modify: `backend/tests/Feature/Database/RoleUserSeederTest.php`
- Create: `backend/tests/Feature/Database/QueueKioskCredentialMigrationTest.php`
- Create: `backend/tests/Feature/Database/QueueKioskSeederTest.php`

**Interfaces:**
- Produces: `QueueKioskAccess::TOKEN_ABILITY = 'queue-kiosk:claim'`, `QueueKioskAccess::TOKEN_HEADER = 'X-Queue-Kiosk-Token'`.
- Produces: `UserRole::QueueKiosk`, `UserRole::isDevice(): bool`, and `UserRole::humanCases(): array` containing the existing ten roles.
- Produces: one `QueueKioskCredential` row whose `secret_ciphertext` is never serialized.

- [ ] **Step 1: Write failing role and human-seeder tests**

Add assertions equivalent to:

```php
self::assertSame('queue_kiosk', UserRole::QueueKiosk->value);
self::assertSame('Queue Kiosk', UserRole::QueueKiosk->label());
self::assertTrue(UserRole::QueueKiosk->isDevice());
self::assertFalse(UserRole::QueueKiosk->isLearnerScoped());
self::assertCount(11, UserRole::cases());
self::assertCount(10, UserRole::humanCases());
self::assertNotContains(UserRole::QueueKiosk, UserRole::humanCases());
```

Keep `RoleUserSeederTest` at exactly ten human users and assert no
`queue_kiosk` row is created by that seeder alone.

- [ ] **Step 2: Run the focused tests and verify red**

Run from `backend/`:

```powershell
php artisan test tests/Unit/Domain/Identity/UserRoleTest.php tests/Feature/Database/RoleUserSeederTest.php
```

Expected: failures for the missing enum case and `humanCases()` contract.

- [ ] **Step 3: Implement the role catalog and shared constants**

Create:

```php
final class QueueKioskAccess
{
    public const TOKEN_ABILITY = 'queue-kiosk:claim';
    public const TOKEN_HEADER = 'X-Queue-Kiosk-Token';
}
```

Add `QueueKiosk` to `UserRole`, return `Queue Kiosk` from `label()`, keep it
out of `isLearnerScoped()`, implement `isDevice()` as an identity comparison,
and implement `humanCases()` with an explicit `array_values(array_filter())`.
Change `RoleUserSeeder` to loop over `UserRole::humanCases()`.

- [ ] **Step 4: Write failing migration/model tests**

Assert the table has `user_id`, `secret_ciphertext`, and `updated_by`; creating
a second credential for one user violates the unique constraint; deleting the
device user cascades its credential; deleting the updater nulls `updated_by`;
and `toArray()` never contains `secret_ciphertext`.

- [ ] **Step 5: Run the migration test and verify red**

```powershell
php artisan test tests/Feature/Database/QueueKioskCredentialMigrationTest.php
```

Expected: failure because the table/model do not exist.

- [ ] **Step 6: Implement the reversible migration and focused model**

Use this schema contract:

```php
Schema::create('queue_kiosk_credentials', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
    $table->text('secret_ciphertext');
    $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();
});
```

`down()` drops only `queue_kiosk_credentials`. The model uses explicit
`$fillable`, `protected $hidden = ['secret_ciphertext']`, and two `BelongsTo`
relations. Add the matching `HasOne` relation to `User`.

- [ ] **Step 7: Write failing seeder tests**

Assert `QueueKioskSeeder` creates exactly one active `queue@grc.com` device
user, `Hash::check('password', $user->password)` is true,
`Crypt::decryptString($credential->secret_ciphertext)` equals `password`, a
second run preserves row ids, and production execution throws before writes.

- [ ] **Step 8: Implement the isolated local/testing seeder**

Inside one `DB::transaction()`, `updateOrCreate()` the user and credential;
use `Crypt::encryptString(self::PASSWORD)`. Reuse the exact environment guard
message/pattern from `RoleUserSeeder`. Insert `QueueKioskSeeder::class`
immediately after `RoleUserSeeder::class` in `DatabaseSeeder`.

- [ ] **Step 9: Run the Task 1 suite and checkpoint**

```powershell
php artisan test tests/Unit/Domain/Identity/UserRoleTest.php tests/Feature/Database/RoleUserSeederTest.php tests/Feature/Database/QueueKioskCredentialMigrationTest.php tests/Feature/Database/QueueKioskSeederTest.php
vendor\bin\pint --test app/Domain/Identity/QueueKioskAccess.php app/Domain/Identity/UserRole.php app/Models/QueueKioskCredential.php app/Models/User.php database/migrations/2026_08_23_000003_create_queue_kiosk_credentials_table.php database/seeders/QueueKioskSeeder.php database/seeders/RoleUserSeeder.php database/seeders/DatabaseSeeder.php
```

Expected: all named tests and Pint pass. Update `PROGRESS.md`, run
`git diff --check`, and do not commit.

---

### Task 2: Restrict kiosk-issued bearer tokens to the device surface

**Files:**
- Modify: `backend/app/Actions/Auth/AuthenticateUser.php`
- Create: `backend/app/Http/Middleware/EnsureQueueKioskUsesDeviceSurface.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/tests/Feature/Api/V1/Auth/LoginEndpointTest.php`
- Modify: `backend/tests/Feature/Api/V1/Auth/SessionEndpointTest.php`
- Create: `backend/tests/Feature/Auth/QueueKioskDeviceSurfaceTest.php`
- Modify: `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`

**Interfaces:**
- Consumes: `QueueKioskAccess::TOKEN_ABILITY` and `UserRole::QueueKiosk`.
- Produces: kiosk login tokens with only `['queue-kiosk:claim']` and a middleware allowing direct kiosk calls only to `api.v1.auth.me` and `api.v1.auth.logout`.

- [ ] **Step 1: Write failing token-ability tests**

Log in one kiosk user and one Student, resolve each returned token through
`PersonalAccessToken::findToken()`, and assert:

```php
self::assertSame(['queue-kiosk:claim'], $kioskToken->abilities);
self::assertSame(['*'], $studentToken->abilities);
```

- [ ] **Step 2: Run the login test and verify red**

```powershell
php artisan test tests/Feature/Api/V1/Auth/LoginEndpointTest.php
```

Expected: kiosk ability assertion receives the current wildcard ability.

- [ ] **Step 3: Issue role-specific abilities**

In `AuthenticateUser`, calculate before the transaction:

```php
$abilities = $user->role === UserRole::QueueKiosk
    ? [QueueKioskAccess::TOKEN_ABILITY]
    : ['*'];
```

Capture `$abilities` and pass it to `createToken()` without changing expiry,
last-login, dummy-hash, disabled-user, or generic-error behavior.

- [ ] **Step 4: Write failing device-surface tests**

With a valid kiosk bearer, assert `GET /auth/me` succeeds, `POST /auth/logout`
succeeds, and representative ordinary endpoints (`GET /programs`,
`GET /academic-terms`, `GET /queue-status`, `POST /queue-tickets`) return 403.
Assert the same middleware does not change Student or Accounting access.

- [ ] **Step 5: Run the device-surface test and verify red**

```powershell
php artisan test tests/Feature/Auth/QueueKioskDeviceSurfaceTest.php
```

Expected: at least the broadly readable reference endpoints currently succeed
for the kiosk actor.

- [ ] **Step 6: Implement the device-surface middleware and route placement**

Use exact route-name authorization:

```php
if ($user instanceof User
    && $user->role === UserRole::QueueKiosk
    && ! $request->routeIs('api.v1.auth.me', 'api.v1.auth.logout')) {
    throw new AuthorizationException;
}
```

Attach the class after `EnsureUserIsActive` in both authenticated groups: the
auth `me/logout` group and the main v1 group. Do not register a string alias.
Add route-middleware assertions to `ApiSurfaceTest` without changing paths.

- [ ] **Step 7: Run the Task 2 suite and checkpoint**

```powershell
php artisan test tests/Feature/Api/V1/Auth/LoginEndpointTest.php tests/Feature/Api/V1/Auth/SessionEndpointTest.php tests/Feature/Auth/QueueKioskDeviceSurfaceTest.php tests/Feature/Api/V1/ApiSurfaceTest.php
vendor\bin\pint --test app/Actions/Auth/AuthenticateUser.php app/Http/Middleware/EnsureQueueKioskUsesDeviceSurface.php routes/api.php
```

Expected: all named tests and Pint pass. Update `PROGRESS.md`, run
`git diff --check`, and do not commit.

---

### Task 3: Require the second kiosk token only for Student self-claims

**Files:**
- Create: `backend/app/Http/Middleware/EnsureStudentQueueClaimUsesKiosk.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/tests/Feature/Api/V1/ClaimQueueTicketEndpointTest.php`
- Modify: `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`

**Interfaces:**
- Consumes: `QueueKioskAccess::TOKEN_HEADER`, `QueueKioskAccess::TOKEN_ABILITY`, existing `EnrollmentPolicy::claimQueueTicket`, and the one `queue-tickets.store` route.
- Produces: the physical-device proof condition without altering controller/action signatures.

- [ ] **Step 1: Replace the old unrestricted Student success test with failing gate cases**

Keep the current fixture builder, add a helper returning a kiosk plaintext
token, and cover:

```php
$this->withToken($studentToken)
    ->postJson('/api/v1/queue-tickets')
    ->assertForbidden();

$this->withToken($studentToken)
    ->withHeader('X-Queue-Kiosk-Token', $kioskToken)
    ->postJson('/api/v1/queue-tickets')
    ->assertCreated();
```

Also assert fabricated, revoked, expired, disabled-owner, Student-owner, and
kiosk-token-without-required-ability values each fail 403. Preserve the repeat
claim, carry-over, reset, Manila-date, and Accounting on-behalf assertions;
Student repetitions supply the header. Explicitly assert Accounting succeeds
without the header and an Accounting request with junk in that header is still
authorized by the existing business Policy.

- [ ] **Step 2: Run the claim endpoint test and verify red**

```powershell
php artisan test tests/Feature/Api/V1/ClaimQueueTicketEndpointTest.php
```

Expected: missing-header Student request still creates a ticket.

- [ ] **Step 3: Implement fail-closed token validation**

In `EnsureStudentQueueClaimUsesKiosk::handle()`, return `$next($request)`
immediately unless the authenticated actor is a Student. For a Student,
normalize the header to a non-blank string, resolve with
`PersonalAccessToken::findToken()`, and authorize only when:

```php
$token instanceof PersonalAccessToken
&& ($token->expires_at === null || $token->expires_at->isFuture())
&& $token->tokenable instanceof User
&& $token->tokenable->role === UserRole::QueueKiosk
&& $token->tokenable->status === UserStatus::Active
&& $token->can(QueueKioskAccess::TOKEN_ABILITY)
```

Throw one generic `AuthorizationException` for every failed condition. Never
place the header value in an exception message. Attach this middleware to the
existing `Route::post('/queue-tickets', ...)` only.

- [ ] **Step 4: Assert the route shape remains singular**

Update `ApiSurfaceTest` to assert there is still exactly one
`POST api/v1/queue-tickets`, it includes
`EnsureStudentQueueClaimUsesKiosk::class`, and it does not carry a blanket
`role:` middleware.

- [ ] **Step 5: Run the Task 3 suite and checkpoint**

```powershell
php artisan test tests/Feature/Api/V1/ClaimQueueTicketEndpointTest.php tests/Feature/Actions/Enrollment/ClaimQueueTicketGuardTest.php tests/Feature/Api/V1/QueueTicketsEndpointTest.php tests/Feature/Api/V1/ApiSurfaceTest.php
vendor\bin\pint --test app/Http/Middleware/EnsureStudentQueueClaimUsesKiosk.php routes/api.php tests/Feature/Api/V1/ClaimQueueTicketEndpointTest.php
```

Expected: all named tests and Pint pass. Update `PROGRESS.md`, run
`git diff --check`, and do not commit.

---

### Task 4: Add the audited Accounting credential API

**Files:**
- Modify: `backend/app/Domain/Audit/AuditAction.php`
- Modify: `backend/app/Domain/Audit/AuditableType.php`
- Create: `backend/app/Policies/QueueKioskCredentialPolicy.php`
- Create: `backend/app/Actions/QueueKiosk/ViewQueueKioskCredential.php`
- Create: `backend/app/Actions/QueueKiosk/ChangeQueueKioskPassword.php`
- Create: `backend/app/Http/Requests/Api/V1/QueueKioskCredential/UpdateQueueKioskCredentialRequest.php`
- Create: `backend/app/Http/Resources/Api/V1/QueueKioskCredentialResource.php`
- Create: `backend/app/Http/Controllers/Api/V1/QueueKioskCredentialController.php`
- Modify: `backend/routes/api.php`
- Create: `backend/tests/Feature/Api/V1/QueueKioskCredentialEndpointTest.php`
- Modify: `backend/tests/Unit/Domain/Audit/AuditVocabularyTest.php`
- Modify: `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`

**Interfaces:**
- Produces: `GET|PUT /api/v1/queue-kiosk-credential` and exact resource `{type,email,password}`.
- Produces: `QUEUE_KIOSK_CREDENTIAL_VIEWED = 'queue_kiosk_credential.viewed'`, `QUEUE_KIOSK_PASSWORD_CHANGED = 'queue_kiosk.password_changed'`, and `QUEUE_KIOSK_CREDENTIAL = 'queue_kiosk_credential'` audit vocabulary.
- Produces: `ViewQueueKioskCredential::execute(QueueKioskCredential $credential, User $actor, AuditRequestContext $context): array`.
- Produces: `ChangeQueueKioskPassword::execute(QueueKioskCredential $credential, string $password, User $actor, AuditRequestContext $context): array`.

- [ ] **Step 1: Write failing endpoint and audit-vocabulary tests**

Cover anonymous 401; Student, Registrar, IT, and kiosk-role 403; Accounting GET
200 with exact keys and `no-store, private`; Accounting PUT validation at 7
characters; successful 8-character rotation; and both audit constants present
in `values()`.

Assert GET creates one audit row with action
`queue_kiosk_credential.viewed`. Assert PUT updates both representations:

```php
self::assertTrue(Hash::check('new-pass', $user->fresh()->password));
self::assertSame(
    'new-pass',
    Crypt::decryptString($credential->fresh()->secret_ciphertext),
);
```

Create two kiosk tokens before PUT and assert both rows are removed. Recursively
inspect serialized audit `before_values`/`after_values` and response content to
prove no old/new plaintext, hash, ciphertext, or bearer appears. Assert the
after snapshot uses safe keys `user_id`, `rotated_at`, and
`revoked_session_count`.

- [ ] **Step 2: Run the focused tests and verify red**

```powershell
php artisan test tests/Feature/Api/V1/QueueKioskCredentialEndpointTest.php tests/Unit/Domain/Audit/AuditVocabularyTest.php
```

Expected: missing routes/classes/constants.

- [ ] **Step 3: Implement Policy, Form Request, and exact Resource**

The Policy returns true only for `UserRole::AccountingStaff`. The request rules
are:

```php
return ['password' => ['required', 'string', 'min:8', 'max:255']];
```

The resource accepts `array{email: string, password: string}` and returns only:

```php
return [
    'type' => 'queue_kiosk_credential',
    'email' => $this->resource['email'],
    'password' => $this->resource['password'],
];
```

Set `Cache-Control: no-store, private` in `withResponse()`.

- [ ] **Step 4: Implement audited read and transactional rotation actions**

`ViewQueueKioskCredential` receives the authorized credential with its `user`
relation, decrypts with `Crypt::decryptString()`, records the view audit with
only `['user_id' => $user->id]`, and returns email/password. Let a decrypt
exception reach the generic 500 renderer; never append ciphertext to the
message.

`ChangeQueueKioskPassword` starts `DB::transaction()`, locks the credential and
user rows, captures the previous `updated_at`, counts and deletes
`$user->tokens()`, updates the hashed user password plus encrypted credential
and `updated_by`, then records:

```php
$before = ['user_id' => $user->id, 'rotated_at' => $previousUpdatedAt?->toISOString()];
$after = [
    'user_id' => $user->id,
    'rotated_at' => $credential->updated_at?->toISOString(),
    'revoked_session_count' => $revokedSessionCount,
];
```

Return the new email/plaintext only from the action's in-memory return value,
not from a model accessor.

- [ ] **Step 5: Implement the controller and Accounting routes**

The controller resolves the canonical device credential with
`whereHas('user', fn ($query) => $query->where('role', UserRole::QueueKiosk))`
and eager-loads `user`. It calls `authorize('view'|'update', $credential)`,
passes request context to the actions, and returns the Resource. Add GET and
PUT inside the existing
`role:accounting_staff` group with route names
`queue-kiosk-credential.show` and `queue-kiosk-credential.update`.

- [ ] **Step 6: Update the exact API inventory and rerun**

Insert the two route strings in sorted order and add their auth/role middleware
names to `ApiSurfaceTest`.

```powershell
php artisan test tests/Feature/Api/V1/QueueKioskCredentialEndpointTest.php tests/Unit/Domain/Audit/AuditVocabularyTest.php tests/Feature/Api/V1/ApiSurfaceTest.php
vendor\bin\pint --test app/Domain/Audit/AuditAction.php app/Domain/Audit/AuditableType.php app/Policies/QueueKioskCredentialPolicy.php app/Actions/QueueKiosk app/Http/Requests/Api/V1/QueueKioskCredential app/Http/Resources/Api/V1/QueueKioskCredentialResource.php app/Http/Controllers/Api/V1/QueueKioskCredentialController.php routes/api.php
```

Expected: all named tests and Pint pass. Update `PROGRESS.md`, run
`git diff --check`, and do not commit.

---

### Task 5: Add frontend request isolation and block kiosk identities from normal portal auth

**Files:**
- Modify: `frontend/src/features/services/api-client.ts`
- Modify: `frontend/src/features/services/api-client.auth.test.ts`
- Modify: `frontend/src/features/services/auth-service.ts`
- Modify: `frontend/src/features/services/auth-service.test.ts`
- Modify: `frontend/src/features/auth/roles.ts`
- Modify: `frontend/src/features/auth/auth-error.ts`
- Modify: `frontend/src/features/auth/api-auth-gateway.ts`
- Modify: `frontend/src/features/auth/api-auth-gateway.test.ts`
- Modify: `frontend/src/features/auth/auth-context-value.ts`
- Modify: `frontend/src/features/auth/auth-context.tsx`
- Modify: `frontend/src/features/auth/auth-context.test.tsx`
- Modify: `frontend/src/features/auth/auth-route-guards.tsx`
- Modify: `frontend/src/features/auth/auth-route-guards.test.tsx`
- Modify: `frontend/src/features/components/pages/login-page.tsx`
- Modify: `frontend/src/features/components/pages/login-page.test.tsx`
- Modify: `frontend/src/features/portal/role-capabilities.ts`
- Modify: `frontend/src/features/portal/role-capabilities.test.ts`
- Modify: `frontend/src/tests/render-app.tsx`

**Interfaces:**
- Produces: `AuthenticatedRequestOptions { token?, headers?, suppressUnauthorizedHandler? }` accepted after the existing signal argument.
- Produces: `AuthError('QUEUE_KIOSK_REQUIRES_DEVICE_PORTAL')` and `signIn(): Promise<AuthSession>` at context level.
- Produces: frontend `queue_kiosk` role definition with zero modules.

- [ ] **Step 1: Write failing API-client override tests**

Assert an explicit token beats the registered provider, extra headers are
merged without replacing `Accept`/`Content-Type`, and a 401 with suppression
does not call the global handler:

```ts
await getAuthenticatedJson("/api/v1/auth/me", undefined, {
  token: "2|kiosk",
  headers: { "X-Queue-Kiosk-Token": "3|device-proof" },
  suppressUnauthorizedHandler: true,
})
```

Also retain a passing assertion that omitted options use the original portal
provider and global 401 handler.

- [ ] **Step 2: Run the API-client test and verify red**

```powershell
npx vitest run src/features/services/api-client.auth.test.ts --no-file-parallelism
```

Expected: TypeScript/test failure because the third argument/options do not
exist.

- [ ] **Step 3: Implement backward-compatible authenticated options**

Export:

```ts
export interface AuthenticatedRequestOptions {
  token?: string
  headers?: Readonly<Record<string, string>>
  suppressUnauthorizedHandler?: boolean
}
```

Inside `request()`, merge extra headers first and overwrite reserved
`Authorization` only from `options.token ?? provideToken()`. Invoke the global
401 handler only when `authenticated && !suppressUnauthorizedHandler`. Add the
options after `signal` to each authenticated verb helper so every existing
call site remains source-compatible.

- [ ] **Step 4: Write failing wrong-surface auth tests**

Add `queue_kiosk` to `userRoles`. Mock a successful kiosk login in
`api-auth-gateway.test.ts` and assert the gateway calls logout with the returned
token, never writes it to the portal store, and rejects with
`QUEUE_KIOSK_REQUIRES_DEVICE_PORTAL`. Assert human roles still persist. Update
AuthProvider tests to expect `signIn()` to return the session. Add route-guard
coverage that a restored queue-kiosk session signs out and redirects to
`/queue`. Add LoginPage coverage for a visible `/queue` link after the
wrong-surface error.

- [ ] **Step 5: Run the auth cluster and verify red**

```powershell
npx vitest run src/features/auth/api-auth-gateway.test.ts src/features/auth/auth-context.test.tsx src/features/auth/auth-route-guards.test.tsx src/features/components/pages/login-page.test.tsx src/features/portal/role-capabilities.test.ts --no-file-parallelism
```

Expected: role-contract and behavior failures.

- [ ] **Step 6: Implement portal rejection and total role maps**

Extend `AuthErrorCode`; in the gateway, revoke a just-issued kiosk token with:

```ts
await logout(undefined, {
  token: payload.token,
  suppressUnauthorizedHandler: true,
}).catch(() => undefined)
throw new AuthError("QUEUE_KIOSK_REQUIRES_DEVICE_PORTAL")
```

Return the `AuthSession` from AuthProvider's `signIn`. In `RequireSession`, a
queue-kiosk session triggers `signOut()` plus `router.replace('/queue')` and
renders no portal shell. Give `rolePortalDefinitions.queue_kiosk` label
`Queue Kiosk`, dedicated-surface guidance, and `modules: []`. LoginPage
distinguishes only the already-authenticated wrong-surface error; invalid
credentials retain the generic enumeration-safe copy.

- [ ] **Step 7: Run the Task 5 suite and checkpoint**

```powershell
npx vitest run src/features/services/api-client.auth.test.ts src/features/services/auth-service.test.ts src/features/auth src/features/components/pages/login-page.test.tsx src/features/portal/role-capabilities.test.ts --no-file-parallelism
npm run typecheck
npx eslint src/features/services/api-client.ts src/features/services/auth-service.ts src/features/auth src/features/components/pages/login-page.tsx src/features/portal/role-capabilities.ts --max-warnings=0
```

Expected: focused tests, typecheck, and ESLint pass. Update `PROGRESS.md`, run
`git diff --check`, and do not commit.

---

### Task 6: Build the Cashier kiosk-credential workspace

**Files:**
- Create: `frontend/src/features/schemas/queue-kiosk-credential-schema.ts`
- Create: `frontend/src/features/services/queue-kiosk-credential-service.ts`
- Create: `frontend/src/features/services/queue-kiosk-credential-service.test.ts`
- Create: `frontend/src/features/hooks/use-queue-kiosk-credential.ts`
- Create: `frontend/src/features/hooks/use-queue-kiosk-credential.test.tsx`
- Create: `frontend/src/features/components/portal/queue-kiosk-access-workspace.tsx`
- Create: `frontend/src/features/components/portal/queue-kiosk-access-workspace.test.tsx`
- Modify: `frontend/src/features/schemas/audit-schema.ts`
- Create: `frontend/src/features/schemas/audit-schema.test.ts`
- Modify: `frontend/src/features/portal/role-capabilities.ts`
- Modify: `frontend/src/features/portal/role-capabilities.test.ts`
- Modify: `frontend/src/features/portal/module-registry.tsx`
- Modify: `frontend/src/features/portal/module-registry.test.tsx`

**Interfaces:**
- Produces: strict `QueueKioskCredential` and `UpdateQueueKioskCredentialInput` types.
- Produces: query key `['queue-kiosk-credential', accountingUserId]` with `gcTime: 0` and removal on unmount.
- Produces: connected Accounting module id `queue-kiosk-access`.

- [ ] **Step 1: Write failing schema/service tests**

Use a strict envelope with exactly:

```ts
const queueKioskCredentialResourceSchema = z.object({
  type: z.literal("queue_kiosk_credential"),
  email: z.string().min(1),
  password: z.string(),
}).strict()
```

Assert GET and PUT target `/api/v1/queue-kiosk-credential`, PUT sends only the
validated password, both parse the exact envelope, and undeclared response
fields cause `ApiClientError(kind='contract')`.

- [ ] **Step 2: Run service tests and verify red**

```powershell
npx vitest run src/features/services/queue-kiosk-credential-service.test.ts --no-file-parallelism
```

Expected: missing modules.

- [ ] **Step 3: Implement schema, service, and hook**

Use `getAuthenticatedJson` and `putAuthenticatedJson` only in the service.
The hook enables only for `session?.role === 'accounting_staff'`, sets
`gcTime: 0`, replaces cached data after mutation success, and removes its
viewer-scoped query in an effect cleanup.

- [ ] **Step 4: Write failing workspace and registry tests**

Cover loading, API error+retry, hidden initial password, reveal/hide,
`password` default warning, client rejection under eight characters, rotation
confirmation copy stating active kiosks sign out, one PUT while pending,
success state, and axe. Update role expectations to:

```ts
accounting_staff: ["payment-queue", "payment-records", "queue-kiosk-access"],
queue_kiosk: [],
```

Update the connected-module inventory from 40 to 41 and expected accessible
region name to `Queue kiosk access`.

Add `queue_kiosk_credential.viewed` and `queue_kiosk.password_changed` to
`auditActions`, and `queue_kiosk_credential` to `auditableTypes`; assert each
new value is accepted as a filter while the resource continues accepting
future non-filterable action strings.

- [ ] **Step 5: Run workspace/registry tests and verify red**

```powershell
npx vitest run src/features/components/portal/queue-kiosk-access-workspace.test.tsx src/features/schemas/audit-schema.test.ts src/features/portal/role-capabilities.test.ts src/features/portal/module-registry.test.tsx --no-file-parallelism
```

Expected: missing workspace/module id and count mismatch.

- [ ] **Step 6: Implement the workspace with existing primitives**

Use `WorkspacePage`, `AsyncBoundary`, `Card`, `Alert`, `FieldGroup`, `Field`,
`Input`, `Button`, `AlertDialog`, and `StatusRegion`. Use React Hook Form with:

```ts
const changePasswordSchema = z.object({
  password: z.string().min(8, "Use at least 8 characters.").max(255),
})
```

Keep password input/revealed output hidden by default, reset the form after a
successful PUT, and never copy the plaintext into toast/error text. Add the
module with a key/lock icon and connect it through the registry.

- [ ] **Step 7: Run the Task 6 suite and checkpoint**

```powershell
npx vitest run src/features/services/queue-kiosk-credential-service.test.ts src/features/hooks/use-queue-kiosk-credential.test.tsx src/features/components/portal/queue-kiosk-access-workspace.test.tsx src/features/schemas/audit-schema.test.ts src/features/portal/role-capabilities.test.ts src/features/portal/module-registry.test.tsx --no-file-parallelism
npm run typecheck
npx eslint src/features/schemas/queue-kiosk-credential-schema.ts src/features/services/queue-kiosk-credential-service.ts src/features/hooks/use-queue-kiosk-credential.ts src/features/components/portal/queue-kiosk-access-workspace.tsx src/features/portal/role-capabilities.ts src/features/portal/module-registry.tsx --max-warnings=0
```

Expected: focused tests, typecheck, and ESLint pass. Update `PROGRESS.md`, run
`git diff --check`, and do not commit.

---

### Task 7: Add the strict Student queue service and intentional live polling hook

**Files:**
- Create: `frontend/src/features/schemas/student-queue-schema.ts`
- Create: `frontend/src/features/services/student-queue-service.ts`
- Create: `frontend/src/features/services/student-queue-service.test.ts`
- Create: `frontend/src/features/hooks/use-student-queue.ts`
- Create: `frontend/src/features/hooks/use-student-queue.test.tsx`
- Modify: `frontend/src/features/services/queue-ticket-service.ts`
- Modify: `frontend/src/features/services/queue-ticket-service.test.ts`

**Interfaces:**
- Produces: `StudentQueueView` matching `StudentQueueViewResource` exactly.
- Produces: `getStudentQueueView(signal?, token?)` with suppressed global 401 only when an explicit token is supplied.
- Produces: `useStudentQueueQuery({viewerId, enabled, token})` and `studentQueueQueryKey(viewerId)`.
- Produces: `claimQueueTicket(studentNumber?, kiosk?: KioskClaimCredentials)` and `useKioskQueueClaimMutation({viewerId, studentToken, kioskToken})` without changing the existing Accounting mutation signature.

- [ ] **Step 1: Write failing strict-contract service tests**

Define the stages as
`no_active_enrollment|pending_registrar_approval|pending_payment|enrolled`,
ticket statuses as the existing four values, priorities as
`regular|priority`, position as nonnegative nullable, and every object as
`.strict()`. Test a full success payload and reject an extra Student identity
field inside `upcoming_ticket_numbers`/ticket.

Assert explicit-token GET uses:

```ts
getAuthenticatedJson(STUDENT_QUEUE_PATH, signal, {
  token,
  suppressUnauthorizedHandler: token !== undefined,
})
```

- [ ] **Step 2: Run service tests and verify red**

```powershell
npx vitest run src/features/services/student-queue-service.test.ts --no-file-parallelism
```

Expected: missing schema/service.

- [ ] **Step 3: Implement the schema and service**

Export `STUDENT_QUEUE_PATH = '/api/v1/queue-status'`, reuse the repository's
contract-error wording, and return only parsed `data`.

- [ ] **Step 4: Write failing polling-hook tests with fake timers**

Assert the query key is `['student-queue', viewerId]`, disabled with null
viewer, makes a second fetch after exactly 3,000 ms, refetches on focus always,
and continues when `document.visibilityState` is hidden. Assert neither the
explicit token nor kiosk token appears in the query cache/key.

- [ ] **Step 5: Implement the hook with the documented exception**

```ts
return useQuery({
  queryKey: studentQueueQueryKey(viewerId),
  queryFn: ({ signal }) => getStudentQueueView(signal, token),
  enabled: enabled && viewerId !== null,
  refetchInterval: 3_000,
  refetchIntervalInBackground: true,
  refetchOnWindowFocus: "always",
})
```

Add JSDoc stating that browser/OS throttling can still pause timers.

- [ ] **Step 6: Extend claim service tests for kiosk headers without changing Accounting**

Assert kiosk mode sends Student bearer plus exact second header and suppresses
the global 401 handler; existing no-argument and `studentNumber` calls keep
using the global portal token and no kiosk header. Define:

```ts
export interface KioskClaimCredentials {
  studentToken: string
  kioskToken: string
}
```

Keep `useClaimQueueTicketMutation()` unchanged for Accounting. Add
`useKioskQueueClaimMutation({viewerId, studentToken, kioskToken})` to
`use-student-queue.ts`; it calls `claimQueueTicket(undefined, credentials)` and
invalidates `studentQueueQueryKey(viewerId)` after success.

- [ ] **Step 7: Run the Task 7 suite and checkpoint**

```powershell
npx vitest run src/features/services/student-queue-service.test.ts src/features/hooks/use-student-queue.test.tsx src/features/services/queue-ticket-service.test.ts --no-file-parallelism
npm run typecheck
npx eslint src/features/schemas/student-queue-schema.ts src/features/services/student-queue-service.ts src/features/hooks/use-student-queue.ts src/features/services/queue-ticket-service.ts --max-warnings=0
```

Expected: every named test passes; the service test protects the unchanged
Accounting request and the new hook test protects kiosk invalidation. Update
`PROGRESS.md`, run `git diff --check`, and do not commit.

---

### Task 8: Build the accessible queue-call alert and reusable live panel

**Files:**
- Create: `frontend/src/features/lib/queue-alert-preference.ts`
- Create: `frontend/src/features/lib/queue-alert-preference.test.ts`
- Create: `frontend/src/features/hooks/use-queue-call-alert.ts`
- Create: `frontend/src/features/hooks/use-queue-call-alert.test.tsx`
- Create: `frontend/src/features/components/queue/student-queue-live-panel.tsx`
- Create: `frontend/src/features/components/queue/student-queue-live-panel.test.tsx`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Produces: `QueueLivePanelMode = 'kiosk'|'default'|'compact'`.
- Produces: `useQueueCallAlert(ticket)` returning `{isCalled, callMessage, soundEnabled, enableSound, disableSound}`.
- Consumes: validated `StudentQueueView`; performs no API calls.

- [ ] **Step 1: Write failing preference and transition-alert tests**

Test guarded localStorage key `grc.queue-call-sound.v1`, storage exceptions,
and boolean parsing. With fake timers and fake AudioContext, assert:

- initial `serving` does not alert;
- `waiting -> serving` produces one toast, title `Now serving Q007 — GRC Queue`,
  `navigator.vibrate([200, 100, 200, 100, 400])`, and `isCalled=true`;
- sound is silent until `enableSound()` is invoked by the test click;
- an enabled transition starts and stops one oscillator;
- ticket replacement, ten seconds, and unmount restore the original title and
  clear timers/audio resources; and
- unavailable AudioContext/vibration still returns the visible call message.

- [ ] **Step 2: Run alert tests and verify red**

```powershell
npx vitest run src/features/lib/queue-alert-preference.test.ts src/features/hooks/use-queue-call-alert.test.tsx --no-file-parallelism
```

Expected: missing modules.

- [ ] **Step 3: Implement preference ownership and transition detection**

Keep the previous `{ticketNumber,status}` in a ref. Fire only when the same
ticket moves from `waiting` to `serving`. Use `toast()` from `sonner`, guard all
browser APIs, generate a short oscillator tone without adding an asset, and
return control functions whose `enableSound()` creates/resumes the
AudioContext synchronously from the button gesture.

- [ ] **Step 4: Write failing panel state/mode/accessibility tests**

For each mode, cover own number/status/priority, now serving, zero/one/many
ahead copy, upcoming numbers, cut-off warning, all four stages, portal
`can_claim` guidance, keep-open reminder, sound toggle, iOS Safari vibration
notice, `role='alert'` during call, and axe. Assert no Student name/number is
rendered from board data.

- [ ] **Step 5: Implement one pure panel with existing UI components**

Use `Card`, `Badge`, `Alert`, `Button`, and semantic tokens. Derive position
copy exactly:

```ts
position === 0
  ? "You're next in line."
  : `${position} ${position === 1 ? "student is" : "students are"} ahead of you.`
```

Render upcoming values as a list of ticket numbers. The compact mode may omit
the full upcoming list but must preserve own ticket, now serving, guidance,
and alert controls. Add a static high-contrast called state and a short visual
animation only outside `prefers-reduced-motion: reduce`.

- [ ] **Step 6: Run the Task 8 suite and checkpoint**

```powershell
npx vitest run src/features/lib/queue-alert-preference.test.ts src/features/hooks/use-queue-call-alert.test.tsx src/features/components/queue/student-queue-live-panel.test.tsx --no-file-parallelism
npm run typecheck
npx eslint src/features/lib/queue-alert-preference.ts src/features/hooks/use-queue-call-alert.ts src/features/components/queue/student-queue-live-panel.tsx --max-warnings=0
```

Expected: focused tests, typecheck, and ESLint pass. Update `PROGRESS.md`, run
`git diff --check`, and do not commit.

---

### Task 9: Integrate the live panel into the Student enrollment and overview surfaces

**Files:**
- Modify: `frontend/src/features/components/portal/enrollment-queue-payment-panel.tsx`
- Modify: `frontend/src/features/components/portal/enrollment-queue-payment-panel.test.tsx`
- Modify: `frontend/src/features/components/pages/portal-overview-page.tsx`
- Modify: `frontend/src/features/components/pages/portal-overview-page.test.tsx`
- Modify: `frontend/src/features/components/portal/enrollment-workspace.test.tsx`

**Interfaces:**
- Consumes: `useStudentQueueQuery`, `StudentQueueLivePanel(mode='default'|'compact')`, and normal portal auth.
- Produces: no Student claim action outside `/queue`.

- [ ] **Step 1: Write failing enrollment-panel integration tests**

Switch direct component renders to `renderWithSession` so QueryClient/auth are
present. Mock `/queue-status`; assert the live response replaces stale
`enrollment.queue_ticket` display, pending query shows an explicit loading
state, errors offer retry, `can_claim` says `Claim your number at the Cashier kiosk`,
and the assessment/payment-confirmed sections remain unchanged.

- [ ] **Step 2: Run the enrollment tests and verify red**

```powershell
npx vitest run src/features/components/portal/enrollment-queue-payment-panel.test.tsx src/features/components/portal/enrollment-workspace.test.tsx --no-file-parallelism
```

Expected: no live query/panel output.

- [ ] **Step 3: Replace only the static queue block**

Keep enrollment id/status, payment confirmation, and assessment markup. Add a
Student queue query keyed by `session.userId`, render loading/error with
`Alert`/`Button`, and pass successful data to `StudentQueueLivePanel` in
`default` mode. Do not import the claim mutation.

- [ ] **Step 4: Write failing Student-overview tests**

For a Student response, assert a compact `Your Cashier queue` region appears
and shows ticket/now-serving data. For every non-Student role, assert no
`/queue-status` request and no queue region. Preserve all current role-module,
academic-term, health, and planned-module expectations.

- [ ] **Step 5: Add the compact Student-only overview panel**

Call `useStudentQueueQuery` only with `enabled: session.role === 'student'`;
render its compact panel between module cards and system status. Use explicit
loading/error states and no claim button.

- [ ] **Step 6: Run the Task 9 suite and checkpoint**

```powershell
npx vitest run src/features/components/portal/enrollment-queue-payment-panel.test.tsx src/features/components/portal/enrollment-workspace.test.tsx src/features/components/pages/portal-overview-page.test.tsx --no-file-parallelism
npm run typecheck
npx eslint src/features/components/portal/enrollment-queue-payment-panel.tsx src/features/components/pages/portal-overview-page.tsx --max-warnings=0
```

Expected: focused tests, typecheck, and ESLint pass. Update `PROGRESS.md`, run
`git diff --check`, and do not commit.

---

### Task 10: Build the persistent-device/in-memory-Student `/queue` flow

**Files:**
- Create: `frontend/src/features/kiosk/kiosk-token.ts`
- Create: `frontend/src/features/kiosk/kiosk-token.test.ts`
- Create: `frontend/src/features/hooks/use-queue-kiosk-session.ts`
- Create: `frontend/src/features/hooks/use-queue-kiosk-session.test.tsx`
- Create: `frontend/src/features/components/kiosk/queue-kiosk-device-login.tsx`
- Create: `frontend/src/features/components/kiosk/queue-kiosk-student-login.tsx`
- Create: `frontend/src/features/components/pages/queue-kiosk-page.tsx`
- Create: `frontend/src/features/components/pages/queue-kiosk-page.test.tsx`
- Create: `frontend/src/app/queue/page.tsx`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Produces: `KioskTokenStore` using only `grc.kiosk-token.v1`.
- Produces: session states `restoring-device|device-login|student-login|student-active` plus explicit device/student actions.
- Consumes: raw auth service with explicit token overrides, `useStudentQueueQuery`, kiosk-mode claim mutation/service, and `StudentQueueLivePanel(mode='kiosk')`.

- [ ] **Step 1: Write failing kiosk-token store tests**

Mirror the auth-token tests: null storage, blank values, read/write/clear,
quota/security exceptions, and exact storage key. Assert the module never
touches `grc.auth-token.v1`.

- [ ] **Step 2: Implement the focused token store and verify green**

Expose the same `read/write/clear` contract as `AuthTokenStore` but define a
separate `KioskTokenStore` type and key. Run:

```powershell
npx vitest run src/features/kiosk/kiosk-token.test.ts --no-file-parallelism
```

Expected: all store tests pass.

- [ ] **Step 3: Write failing session-hook tests**

Cover:

- restore calls `/auth/me` with the stored device token and suppression;
- invalid/revoked/wrong-role restore clears only kiosk storage;
- device login accepts only `queue_kiosk`, persists it, and blocks when storage
  write fails while revoking the just-issued bearer;
- successful human login on the device form is revoked and rejected;
- Student login accepts only `student`, retains its token in hook state, and
  never calls any storage writer;
- successful non-Student login is revoked and rejected;
- Student sign-out clears memory synchronously and best-effort revokes with an
  override;
- device sign-out clears both sessions and the persistent token; and
- a Student 401 does not clear the device session.

- [ ] **Step 4: Implement the session state machine**

Export a discriminated state rather than parallel nullable booleans:

```ts
type QueueKioskSessionState =
  | { status: "restoring-device" }
  | { status: "device-login"; error: string | null }
  | { status: "student-login"; kioskToken: string; kioskUser: AuthenticatedUser; error: string | null }
  | { status: "student-active"; kioskToken: string; kioskUser: AuthenticatedUser; studentToken: string; studentUser: AuthenticatedUser }
```

Expose `signInDevice`, `signInStudent`, `finishStudent`, and `signOutDevice`.
All successful wrong-role tokens are revoked with their explicit bearer and
suppressed global 401 handling. A failed kiosk-store write also revokes the
just-issued kiosk bearer before returning the blocking storage error.

- [ ] **Step 5: Write failing page-flow tests**

Use mocked fetch responses and assert:

1. restore spinner then device form;
2. device login persists and opens Student form;
3. Student login immediately requests `/queue-status`;
4. each non-claimable stage has exact guidance and `Done`;
5. `pending_payment + can_claim` shows one touch-sized claim button;
6. claim sends both tokens, invalidates/refetches, and shows `Q001`;
7. an existing ticket skips claim and opens the live panel;
8. `Done` removes all `['student-queue']` queries before returning to Student
   login;
9. refresh has no Student session but retains device restore;
10. a kiosk-proof 403 clears Student then device state;
11. explicit device sign-out returns to device login;
12. password inputs use correct autocomplete values, errors are focused/live,
    keyboard flow works, and axe reports no violations.

- [ ] **Step 6: Implement the two forms and page orchestration**

Both forms use React Hook Form, Zod, `FieldGroup`, `Field`, `Input`, and
`Button`. Device email uses `username`; Student email uses `username`; both
passwords use `current-password`. The page owns the Student queue query and
claim mutation, passes validated data to the `kiosk` panel, and implements:

```ts
await queryClient.cancelQueries({ queryKey: ["student-queue"] })
queryClient.removeQueries({ queryKey: ["student-queue"] })
finishStudent()
```

The local clear occurs even when server logout rejects. Treat claim 403 as
device-proof invalidation only after clearing Student state/cache. Other claim
errors keep the Student session and show retry.

- [ ] **Step 7: Add the App Router page and kiosk-specific responsive styles**

`src/app/queue/page.tsx` renders only `<QueueKioskPage />`; it does not import
`PortalShell` or `RequireSession`. Add `.queue-kiosk-*` classes using semantic
tokens, large ticket numerals, minimum 44px touch targets, a visible focus
ring, mobile stacking, and the reduced-motion call-state override. Do not add
images or external assets.

- [ ] **Step 8: Run the Task 10 suite and checkpoint**

```powershell
npx vitest run src/features/kiosk/kiosk-token.test.ts src/features/hooks/use-queue-kiosk-session.test.tsx src/features/components/pages/queue-kiosk-page.test.tsx --no-file-parallelism
npm run typecheck
npx eslint src/features/kiosk src/features/hooks/use-queue-kiosk-session.ts src/features/components/kiosk src/features/components/pages/queue-kiosk-page.tsx src/app/queue/page.tsx --max-warnings=0
```

Expected: focused tests, typecheck, and ESLint pass. Update `PROGRESS.md`, run
`git diff --check`, and do not commit.

---

### Task 11: Synchronize the durable architecture and public contracts

**Files:**
- Create: `docs/adr/0023-queue-kiosk-dual-session-and-live-student-view.md`
- Modify: `PRD.md`
- Modify: `docs/api/openapi.yaml`
- Modify: `docs/testing/SEEDED_IDENTITIES.md`
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: the final tested route/resource/header/role names from Tasks 1–10.
- Produces: one authoritative description with no stale unrestricted Student-claim language.

- [ ] **Step 1: Write ADR 0023 from the approved spec and verified implementation**

Record status Accepted, context, decision, rejected duplicate-route and
composite-session alternatives, reversible-secret consequences, device API
isolation, independent 401 handling, token revocation on rotation, live-polling
limits, and explicit non-goals. Use actual final class/file names.

- [ ] **Step 2: Amend PRD source-of-truth sections**

Update the role catalog to distinguish `queue_kiosk` as a non-human device
identity; lifecycle language to say a Student ticket is claimed at the kiosk;
API/auth/security sections for the second header and two token stores; and the
frontend route/module section for `/queue` and the live panel. Preserve the
nine primary external actors plus the already-documented IT role rather than
renumbering the device as a human actor.

- [ ] **Step 3: Update OpenAPI exactly**

Add `queue_kiosk` to the role enum, document `X-Queue-Kiosk-Token` as required
only for Student `POST /queue-tickets`, add GET/PUT credential paths and exact
schemas, and keep Accounting's request-body option. Mark credential responses
private/no-store in descriptions and never include a real token/password
example.

- [ ] **Step 4: Update seeded identity documentation**

Add `queue@grc.com` / development-only `password`, dedicated `/queue` route,
local/testing-only warning, and immediate rotation instruction. State that the
normal `/login` rejects this role.

- [ ] **Step 5: Run documentation and contract checks**

```powershell
rg -n "queue_kiosk|X-Queue-Kiosk-Token|queue-kiosk-credential|/queue" PRD.md docs/adr/0023-queue-kiosk-dual-session-and-live-student-view.md docs/api/openapi.yaml docs/testing/SEEDED_IDENTITIES.md
git diff --check
```

Expected: every contract appears in all required documents and the diff check
passes. Update `PROGRESS.md`; do not commit.

---

### Task 12: Run full verification and perform the live queue journey

**Files:**
- Modify: `PROGRESS.md`
- Modify only if a new failure is attributable to this feature: the smallest relevant source/test file from Tasks 1–11.

**Interfaces:**
- Consumes: the complete vertical slice.
- Produces: evidence-backed completion status with exact pass/failure counts.

- [ ] **Step 1: Record the verification start and inspect scope**

In `PROGRESS.md`, list the commands about to run. Confirm `git status --short`
contains only this slice, the previously approved docs/progress changes, and
the pre-existing untracked root `node_modules/`.

- [ ] **Step 2: Run the full backend quality gates**

From `backend/`:

```powershell
php artisan test
composer format:check
composer analyse
```

Record actual test count/duration. If PHPStan reports the known baseline,
separate pre-existing findings from any finding in a changed file; fix every
new finding before continuing.

- [ ] **Step 3: Run a fresh MariaDB migration and seed**

Use the configured `mariadb_migrator` connection; Laravel reads its credential
from the existing uncommitted environment configuration and the command must
not print it. Run:

```powershell
php artisan migrate:fresh --database=mariadb_migrator --seed --force
```

Then verify exactly one active
`queue@grc.com` user and one matching credential row through an application
test or safe read that does not print the decrypted secret.

- [ ] **Step 4: Run the full frontend quality gates**

From `frontend/`:

```powershell
npm test -- --no-file-parallelism
npm run typecheck
npm run lint
npm run format:check
```

Record actual file/test counts and durations. Fix every failure introduced by
this slice; record unrelated baseline failures without claiming the suite
passed.

- [ ] **Step 5: Use the browser-control skill for the live walkthrough**

Start Laravel and Next.js with hidden background processes from the repository
root:

```powershell
$backendProcess = Start-Process -FilePath "php" -ArgumentList "artisan","serve","--host=127.0.0.1","--port=8000" -WorkingDirectory "$PWD\backend" -WindowStyle Hidden -PassThru
$frontendProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev","--","--hostname","127.0.0.1","--port","3000" -WorkingDirectory "$PWD\frontend" -WindowStyle Hidden -PassThru
```

In the local app:

1. open `/queue` and sign in the seeded device;
2. sign in a pending-payment Student;
3. claim and verify one ticket appears;
4. open the Accounting payment queue in a separate portal session and call the
   same ticket;
5. verify the Student panel changes to serving and shows visual/ARIA alert;
6. enable sound through the user-gesture control and repeat with another
   waiting ticket when fixture data permits;
7. select `Done` and verify no previous ticket remains for the next Student;
8. verify the Student portal enrollment and overview panels;
9. open Queue Kiosk Access as Accounting, reveal then rotate the development
   password, and verify the old kiosk token is rejected;
10. confirm normal `/login` refuses the kiosk role and points to `/queue`;
11. inspect desktop, narrow mobile, keyboard focus, and reduced-motion states.

Capture screenshots only when they contain no exposed plaintext credential or
bearer token. Stop only the two exact processes created above after the
walkthrough:

```powershell
Stop-Process -Id $backendProcess.Id,$frontendProcess.Id
```

- [ ] **Step 6: Run final diff and secret checks**

```powershell
git diff --check
git status --short
git diff --stat
rg -n "Bearer [A-Za-z0-9]|grc\.kiosk-token\.v1.*=" backend frontend docs --glob '!**/*.test.*'
```

Review every match manually; the storage-key constant and documentation are
allowed, hard-coded token values or real credentials are not.

- [ ] **Step 7: Record the final evidence without committing**

Update `PROGRESS.md` with every command's actual result, browser journey
outcome, any remaining pre-existing baseline, and exact changed-file scope.
Run `git diff --check` once more. Do not commit or push unless the user now
explicitly requests a GitHub saving point.
