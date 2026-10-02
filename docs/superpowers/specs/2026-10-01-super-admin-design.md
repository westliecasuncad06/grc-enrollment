# Super Admin + Department Switcher — Design Spec

**Status:** Approved by the owner (2026-10-01). Implementation not yet started.
**Related:** ADR 0038, PRD §3/§8.4/§9.1/§9.4/§10.4 (to be amended in Slice 4).

## Context

The owner (`westliecasuncad06@gmail.com`) asked for one Super Admin account that
controls the whole live system (grc-enrollment.tech: Vercel frontend + Dokploy/VPS
Laravel API) and can use every department's features.

Decisions made with the owner during brainstorming:

| Decision | Choice |
|---|---|
| Email | `westliecasuncad06@gmail.com` ("westliecauncad06" in the original request was a typo) |
| Purpose | Live system administration: accounts, fixing problems, overrides, monitoring |
| Reaching department features | **Department Switcher** — pick an office and get its full workspace under your OWN identity |
| Accounts module scope | Invite + change role, Deactivate/Reactivate, Password reset + sign-out everywhere, Permanent delete |
| Build order | Role and account → Switcher → Accounts & Access → docs, e2e, verification |

### What exists today

Verified by three parallel research agents (backend auth/policies, frontend role
navigation, PROGRESS/ADR history) plus direct reads of the critical files, then
checked by a Plan-review agent against the installed Laravel/Sanctum framework source:

- **No super-admin concept anywhere.** PROGRESS.md previously recorded "there is no
  SuperAdmin role". There is no `Gate::before`, no policy `before()`, and no role
  wildcard.
- **One role per user.** `users.role` is a plain VARCHAR cast to
  `App\Domain\Identity\UserRole` (11 cases today), so a new role needs no migration.
- **Every authorization layer reads `$user->role` / `$user->college` on the one
  cached authenticated instance per request.** That covers the `EnsureUserHasRole`
  middleware, 33 policies, 23 gates, the `scopeVisibleTo` query scopes, and assorted
  inline checks. `$request->user()`, `Auth::user()` and the Gate resolver all return
  that same instance under `auth:sanctum`.
- **Identity-bound checks are limited** to Faculty, Student and own-notification
  policies (`$user->id === …`). No Action re-reads the actor from the database mid
  request.
- **Frontend** has ~108 `session.role` checks across 65 files. Navigation is
  config-driven (`rolePortalDefinitions`); the page guard is
  `getRoleModule(session.role, moduleId)`.
- **Account-control gaps today:** nobody can create Admission Staff accounts, change
  a user's role, disable a non-faculty user, reset someone else's password, or
  remove a mistaken account.

## Design

### A. The Super Admin identity

- **New role.** `UserRole::SuperAdmin = 'super_admin'`, label **"Super Admin"**, not
  learner-scoped. Appended **last** in the enum — order must match
  `docs/api/openapi.yaml` and `frontend/src/features/auth/roles.ts`
  (`UserRoleContractTest` enforces this).
- **Never seeded.** `RoleUserSeeder` loops `UserRole::humanCases()` and throws on a
  missing identity, so it must explicitly skip `SuperAdmin`. A test asserts no super
  admin is ever created by the seeder.
- **Provisioned only by CLI:** `php artisan super-admin:provision --name="…"`.
  - Email comes from `config('super_admin.email')` ← env `SUPER_ADMIN_EMAIL`. Never
    committed; `.env.example` gets an empty key.
  - Idempotent: creates an Active account (unusable random password,
    `account_setup_completed_at` set) or re-activates the existing super admin.
  - Refuses if the email already belongs to an account with a different role.
  - `--deactivate` disables the account and deletes its tokens (incident response).
  - Both actions are audited.
- **Sign-in.** Google Sign-In works unchanged (matches an existing active account by
  email, no domain restriction, skips OTP). Password login (via "Forgot password")
  is OTP-gated automatically like every other human role. The account's security is
  therefore bounded by the Gmail account's security — the runbook (Slice 4) requires
  Google 2-Step Verification on it.
- **Untouchable through the API.** No endpoint may invite, change the role of,
  deactivate, or delete a `super_admin` account.

### B. Department Switcher (the "acting context")

**Why this approach over the alternatives considered:**
- *Impersonation* (sign in as a specific person) was rejected: records would show
  someone else's name as the actor, which is wrong for an "I did this" log.
- *One mega-sidebar with every module* was rejected: it would require changing
  ~108 frontend role checks and ~25 inline backend checks, and several pages can
  only render one role's variant at a time (e.g. `CreditMappingsModuleRouter`).

**Switchable offices:** Admission Staff; Program Head and Dean (each with a
college); Executive Director; Registrar Head; Registrar Staff; Accounting Staff;
IT Control. **Not** Faculty or Student — their features are bound to one person's
own records (sections taught, own grades, own enrollment).

**Storage.** A reversible migration adds nullable `acting_role` and
`acting_college` columns directly to `personal_access_tokens`. The context is
per-token: it survives page reloads and is destroyed automatically when the token
is revoked or expires. No extra query is needed — Sanctum already loads this row
on every authenticated request.

**Endpoints**, guarded by a new `EnsureUserIsSuperAdmin` middleware that checks the
raw stored role (so it keeps working while the user is acting as something else):
- `PUT /api/v1/super-admin/acting-context {role, college?}` — college required for
  Program Head/Dean, forbidden otherwise.
- `DELETE /api/v1/super-admin/acting-context` — return to the console.

Both audited, both return `UserResource`.

**Model change.** `User` gains a private `?ActingContext` value object and
overrides `getAttributeValue($key)`: for `role`/`college`, returns the acting value
when one is set, otherwise delegates to the parent/cast.
- **Do not use an `Attribute` accessor** on these columns — confirmed against the
  framework source that a get-only `Attribute` accessor on an enum-cast column
  crashes `toArray()`/`toJson()` with "Cannot instantiate enum", because accessor
  attributes are listed as cast-resolved and the enum caster tries to construct the
  enum class directly.
- `getAttributeValue` override reads cleanly: `getAttributes()`, `getOriginal()`,
  `isDirty()`, `toArray()` and saves all keep seeing the real stored `super_admin`
  value. The database row never changes.
- Add `User::isSuperAdmin()` (reads the **raw** attribute, bypassing the override),
  `actingContext()`, `applyActingContext(?ActingContext)`.

**Middleware.** `ApplySuperAdminActingContext` runs immediately after
`EnsureUserIsActive` in both authenticated route groups in `routes/api.php` (the
`/auth/me`+`/auth/logout` group and the main group).
- For a non-super-admin it returns immediately with no extra query (verified this
  doesn't regress the query-count tests on ordinary endpoints). It also tolerates
  `Sanctum::actingAs()` transient tokens used by ~6 test files.
- For a super admin, it applies or clears the token's stored context on **every**
  request (no caching across requests).
- **Multi-tab guard.** Because one bearer token can be open in several browser
  tabs, the super admin's frontend sends `X-Acting-Context: none` or
  `role` or `role:college` on every request. A mismatch between what the tab
  believes and what the token actually holds returns **409
  `ACTING_CONTEXT_CHANGED`**, so a stale tab can never act (and be audited) as an
  office it isn't showing. `/auth/me` and the two acting-context endpoints are
  exempt from this check. The header name is added to `config/cors.php`'s allowed
  headers.

**Net effect:** the role middleware, every policy, every gate, every
`scopeVisibleTo` scope, the dashboard stage limits, and the college-scoping code —
including the two `->role->value === 'program_chair'` string-literal checks in
`ScheduleProposalController.php` and `AcademicTermSectionPlanController.php` — all
keep working completely unchanged.

**Attribution.** Domain write columns (`approved_by`, `confirmed_by`,
`submitted_by`, …) store the super admin's own user id, so every record screen
shows "Westlie Casuncad" — never a borrowed name. Role-targeted notifications
(`NotificationRecorder::recordManyForRole`) still query the real stored role, so
they keep reaching the actual office holders, not the super admin.

**Frontend.**
- `/auth/me` returns the *effective* role/college as today, plus — for super
  admins only — an optional `acting_context: {role, college} | null` field. Because
  `session.role` is always the effective role, the existing navigation, page
  guards, per-page role branches and TanStack Query `enabled` checks need **no
  changes** at all.
- A workspace switcher sits in the portal header (desktop: topbar actions row,
  before the notification bell; mobile: inside the navigation Sheet) and a
  persistent banner ("Super Admin · Acting as Dean (CCS) · Switch · Back to Admin
  Console") sits between the header and the page body.
- On switch or exit: navigate to `/portal`, cancel in-flight queries and
  `queryClient.clear()` (private query keys are `[name, userId, …]`, and `userId`
  never changes on a switch, so stale per-office data must be dropped explicitly),
  then set the session from the `UserResource` the switch/exit call already
  returned (a new `AuthProvider.replaceSession()` — never re-run `restore()` here,
  since a transient network error there signs the user out).
- On a 409 `ACTING_CONTEXT_CHANGED`: re-fetch `/auth/me` without destroying the
  session, replace the session, clear the query cache, and show a toast explaining
  the tab was out of sync.

### C. Audit & accountability

- A reversible migration adds nullable `acting_role` and `acting_college` to
  `audit_logs`. `AuditRecorder::record()` fills them from the actor's
  `actingContext()` — one change covers all ~108 existing call sites.
- Audit payload keys keep obeying the existing forbidden-fragment rule (no
  `password`, `token`, `secret`, `email`, `phone`, `mobile`, `address` substrings) —
  e.g. use `sessions_revoked`, not anything containing `token`.
- `AuditLogResource` / `AuditActorResource` keep `actor_role` as the *stored* role
  and add `acting_role`, `acting_role_label`, `acting_college`. The UI renders
  "Super Admin (as Dean · CCS)".
- **Latent bug found and fixed as part of this work:**
  `ScheduleProposalResource.php:92,106` emit the actor's raw stored role into
  `returned_by_role` / `decision_history[].actor_role`, but the frontend's
  `.strict()` `scheduling-schema.ts:113-116,141` only accepts
  `"dean" | "executive_director"`. Once a super admin can act as Dean, a schedule
  returned while acting would emit `super_admin` there and break the schedule pages
  for *everyone* viewing that proposal (a contract violation, not just a cosmetic
  issue). Fix: add `AuditLog::effectiveActorRole()` returning
  `acting_role ?? role`, and use it at both call sites instead of the raw
  `actor->role`.
- Super admin actions remain visible in the existing Audit Logs screen for
  transparency: the two `audit-logs` routes move into a
  `role:registrar_head,super_admin` group, and `AuditLogPolicy` allows
  `UserRole::SuperAdmin`.
- New `AuditAction` values (existing `noun.verb` convention):
  `super_admin.provisioned`, `super_admin.deactivated`,
  `super_admin.acting_context_changed`, `user_account.role_changed`,
  `user_account.deactivated`, `user_account.reactivated`,
  `user_account.sessions_revoked`, `user_account.password_reset_sent`,
  `user_account.deleted`, `user_account.list_viewed` (an audited privileged read,
  following the existing `ListAuditLogs` precedent of auditing its own reads).

### D. Admin Console — "Accounts & Access"

Endpoints under `/api/v1/super-admin/users`, built with Form Requests, Actions,
Resources and DB transactions, matching the rest of the codebase's conventions.

- **Console-mode only.** While the super admin is acting as an office, every
  Accounts & Access endpoint returns 409 ("Return to the Admin Console first").
  This guarantees an account-management action is never stamped with a borrowed
  office in the audit trail.
- **Authorization** uses named Gate abilities mapped to a new `UserAccountPolicy`
  registered explicitly in `AppServiceProvider` (not auto-discovered as `UserPolicy`
  — that name would collide with and hijack the two existing named gates that are
  already called with a plain `User` argument: `view-faculty-profile` and
  `update-workforce-profile`).

| Action | Rules |
|---|---|
| `GET` list | Paginated; search by name/email; filter by role, status, college, pending-setup. The read itself is audited (`user_account.list_viewed`). `super_admin` and `queue_kiosk` rows are shown but read-only. |
| `POST` invite | Allowed target roles: `UserRole::superAdminInvitableCases()` = the existing 8 Registrar-invitable roles **plus Admission Staff**. College required for Dean/Program Head/Faculty. Three call sites widen together: `InviteStaffAccount::handle()` (role-list now a parameter, not a hard-coded constant), `SendStaffAccountSetupInvitation` (its own allow-list check), `ActivateStaffAccount` (both of its role-list checks). `ActivateStaffAccount` keeps any college the inviter pre-set (the setup page must show it read-only rather than letting the invitee override it) so Admission Staff — who gets no college — isn't broken by the existing "invitee picks their college" step. The Registrar Head's own invite endpoint is *not* widened: it still cannot invite Admission Staff. |
| `PATCH …/role` | Staff↔staff only — never student, kiosk, or super_admin as source or target. Reason required. College rules as above. Returns **409** if the target is Faculty still assigned to sections in a non-archived term ("reassign their sections first"). Revokes the target's tokens. |
| `PATCH …/status` | Deactivate/reactivate with a reason. Deactivating revokes tokens. Reactivating an account that never finished setup returns **409** ("resend the setup invitation instead"). The kiosk account is out of scope — it stays Accounting's. |
| `POST …/setup-invitation` | Resend: students via `SendStudentAccountSetupInvitation`, everyone else via `SendStaffAccountSetupInvitation`. |
| `POST …/password-reset` | Reuses `SendPasswordResetCode` with the same Active/non-kiosk filter `ForgotPasswordController` already applies, behind its own rate limiter (the Action itself has no built-in per-user throttle). Surfaces the Action's own `sent`/`failed` result. The super admin never sees or sets a password directly. |
| `DELETE …/sessions` | Sign out everywhere: deletes all of the target's personal access tokens. |
| `DELETE …` (permanent) | **Only for an account that was never actually used.** Requires `account_setup_completed_at` is null AND zero rows exist in *every* table with a foreign key to `users` for that id (enumerated via `information_schema`, not a hand-maintained list, so a future migration can't silently create an unsafe gap) except the pre-activation auth tables (`account_setup_codes`, `password_reset_codes`, `login_otp_challenges`). This blocks: any student (has a `student_profiles` row), any faculty member with even one availability/preference/teaching-history/specialization/load-override row (including a legacy, disabled `@grc.test` account some merge-rollback workflow still needs), and anyone who has ever acted (`audit_logs.actor_user_id`). Runs inside a row lock; a residual FK violation (SQLSTATE 23000) is caught and turned into the same 409 "Deactivate instead" rather than a 500. Deletes the target's tokens explicitly first (no FK there to rely on). The UI requires typing the target's email into an `AlertDialog` before enabling the destructive button. |

**Frontend.** A `super-admin-accounts` workspace built from shadcn `Table` +
`Pagination`, `Dialog`/`AlertDialog`, `Badge`; forms with React Hook Form + Zod;
`422` → field errors; every PRD §12.4 application state. New files:
`features/services/super-admin-service.ts`, `features/schemas/super-admin-schema.ts`,
`features/hooks/use-super-admin.ts`. This becomes the console's first/default
module in `rolePortalDefinitions.super_admin`.

## Implementation slices

Built one at a time, test-driven, narrowest relevant checks run after each change,
full suites run before a slice is marked done (see **Verification** below).

1. **Role, account & console shell** — the enum case, provisioning command, audit
   actions, and a minimal console that only shows Audit Logs.
2. **Department Switcher** — token columns, model override, middleware, switch/exit
   endpoints, frontend switcher/banner, audit `acting_*` columns and the
   `ScheduleProposalResource` fix.
3. **Accounts & Access** — the full module in §D.
4. **Docs & verification** — PRD v3.3, data dictionary, the super-admin runbook,
   `SEEDED_IDENTITIES.md`, e2e coverage, a real-browser pass.

A detailed, task-by-task implementation plan (file lists, exact test-first steps,
exact commands) lives in `docs/superpowers/plans/2026-10-01-super-admin.md`.

## Release order (production)

The frontend's zod schemas are `.strict()`, and a contract violation on `/auth/me`
makes the gateway's `restore()` clear the token and sign the user out. So in
production, the **frontend** deploy (new role string, optional `acting_*` fields,
the `X-Acting-Context` header) must go out and be confirmed live on Vercel
*before* the matching backend deploy, migration, and
`super-admin:provision` run on the VPS.

## Reused code (not reimplemented)

- Backend: `EnsureUserHasRole`, `EnsureUserIsActive` (both unchanged); `AuditRecorder`,
  `AuditRequestContextFactory`, `ListAuditLogs` (audited-read pattern);
  `InviteStaffAccount`, `SendStaffAccountSetupInvitation`,
  `SendStudentAccountSetupInvitation`, `ActivateStaffAccount`,
  `SendPasswordResetCode`, `IssueSanctumToken` (token issuance/expiry unchanged).
- Frontend: `api-client.ts` request helpers (including the kiosk's per-request
  header pattern, reused for `X-Acting-Context`), `WorkspacePage`, `AsyncBoundary`,
  shadcn primitives, `auth-context.tsx`/`api-auth-gateway.ts` (`toSession`), the
  lazy-module pattern in `module-registry.tsx`.

## Out of scope (possible follow-ups, not this plan)

- Acting as one specific Professor or Student ("view as user", read-only).
- IT Control automation stays local/testing-only, even for the super admin.
- Token lifetime policy for privileged accounts (PRD §17 remains an open
  institutional decision; not invented here).

## Risks and mitigations already designed for

- **Lost acting context:** any code that re-fetches the actor mid-request
  (`$user->fresh()`, a job receiving a stale actor) would bypass the override.
  None exists today for the actor; covered by Slice 2 tests.
- **Contract drift:** exact-shape backend tests and strict frontend zod schemas
  must change together in the same commit — this bit a prior session before
  (see ADR history) and is called out explicitly per slice above.
- **Found, outside this plan's scope but worth the owner's attention:**
  PROGRESS.md's own recent entries record that production may still be running
  on seeded `*.seed@grc.test` accounts with the password `password`. Not
  re-verified independently this session. Worth confirming and rotating
  regardless of this feature's timeline — the new Accounts module will make that
  easy once Slice 3 ships.
