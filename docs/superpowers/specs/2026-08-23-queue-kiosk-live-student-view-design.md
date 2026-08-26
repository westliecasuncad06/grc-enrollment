# Queue kiosk portal and live Student queue view — full-stack design

**Date:** 2026-08-23
**Status:** Approved

## Goal

Finish the physical-presence part of the Cashier queue flow that the existing
queue-cycle slice deliberately left open. A Student may claim their own queue
ticket only while using a GRC-controlled front-desk kiosk, then keep a live,
privacy-preserving view of their own ticket inside the kiosk or their normal
portal. Accounting Staff retains the current ability to issue a ticket on a
Student's behalf.

This design has two connected parts:

1. a dedicated `/queue` device surface with one persistent kiosk session and
   one in-memory Student session; and
2. a reusable Student queue panel backed by the already-shipped
   `GET /api/v1/queue-status` endpoint.

The current queue lifecycle remains authoritative: `ClaimQueueTicket`,
`TransitionQueueTicket`, `TransitionQueueCycle`, `queue_cycles`, and the
cycle-aware ordering defined in
`2026-08-23-queue-kiosk-claim-carryover-cutoff-design.md` are not replaced.

## Product decisions carried forward

- The device uses the shared `queue@grc.com` account. Accounting Staff can
  view and rotate its password.
- The kiosk device remains signed in between students. Each Student signs in
  with their own institutional email and password, but their bearer token is
  held in memory only.
- A Student claim requires both the Student bearer token and a valid kiosk
  bearer token in `X-Queue-Kiosk-Token`.
- Accounting Staff's existing on-behalf claim does not require the kiosk
  header.
- Alerts are in-page only: no Web Push, service worker, SMS, email, or public
  TV queue board.
- Carry-over, priority, skip/requeue, Cashier call/complete behavior, and
  payment confirmation are unchanged.

## Chosen architecture

Keep the existing `POST /api/v1/queue-tickets` URI and controller path. Add a
role-aware middleware condition to the route: a Student actor must present a
second, valid kiosk token; Accounting Staff bypasses this additional device
proof and continues through the existing `EnrollmentPolicy` authorization.

This is preferred over duplicate Student/Accounting routes because Laravel
does not fall through between two identical method/path registrations when
the first route's middleware rejects the request. It is also preferred over a
new composite server session or token-exchange endpoint because the approved
flow already has two independently useful Sanctum tokens and needs only a
narrow proof-of-device condition at claim time.

## Identity and role boundary

### `queue_kiosk` is a device identity, not a primary human actor

Add `QueueKiosk = 'queue_kiosk'` to `UserRole` and the frontend role catalog,
with label `Queue Kiosk`. It is explicitly not learner-scoped. PRD actor and
role documentation will distinguish it from the primary institutional roles:
it represents an installed/shared device, owns no student records, performs
no business transition as the actor, and is never the bearer used to call the
claim action itself.

The existing human-role `RoleUserSeeder` stays responsible for its current ten
development identities. A separate local/testing-only `QueueKioskSeeder`
creates or updates the device identity and credential atomically, and
`DatabaseSeeder` calls it immediately after `RoleUserSeeder`. This avoids
quietly redefining `RoleUserSeeder`'s human-role fixture contract while still
making a fresh seeded environment complete.

### Device API isolation

Correct kiosk credentials still use the current public
`POST /api/v1/auth/login` endpoint. `AuthenticateUser` issues a kiosk-specific
Sanctum ability for the device role; every existing human role retains the
current wildcard ability.

A new authenticated-request middleware denies a `queue_kiosk` actor access to
ordinary application endpoints. Direct device requests are limited to:

- `GET /api/v1/auth/me`, used to restore/validate the persistent kiosk token;
  and
- `POST /api/v1/auth/logout`, used for explicit device sign-out.

The kiosk header validator reads the second token independently and therefore
does not treat the kiosk user as the business actor. It requires all of:

- a syntactically valid Sanctum personal access token;
- an existing token record that has not been revoked or expired;
- an active token owner;
- `UserRole::QueueKiosk`; and
- the kiosk-specific ability.

Failure is an authorization failure with the normal API error envelope. It
does not reveal which individual token check failed.

### Normal portal exclusion

The normal portal auth gateway rejects an otherwise-correct `queue_kiosk`
login before persisting it as the regular `grc.auth-token.v1` token. The
just-issued token is revoked using an explicit bearer override, and the login
page directs the operator to `/queue`. Portal route guards also treat a
restored/manual device-role session as the wrong surface, clear/revoke it, and
redirect to `/queue` as defense in depth.

The `/queue` kiosk form calls the same login service directly, accepts only a
`queue_kiosk` result, and revokes a successfully authenticated non-kiosk token
instead of retaining it. The Student form does the inverse: it accepts only a
Student result and revokes any other successfully authenticated role token.

## Reversible shared credential

### Schema

Create `queue_kiosk_credentials` with:

| column | contract |
|---|---|
| `id` | primary key |
| `user_id` | unique FK to `users`, cascade on delete |
| `secret_ciphertext` | encrypted text, never serialized directly |
| `updated_by` | nullable FK to `users`, null on delete |
| timestamps | normal Laravel timestamps |

`users.password` remains a one-way Laravel password hash. The separate
`secret_ciphertext` is encrypted/decrypted with Laravel `Crypt` solely because
the approved Cashier workflow must display the current shared device password.
The migration docblock, PRD security section, and ADR 0023 will record this
intentional trade-off: compromise of `APP_KEY` plus the database can reveal the
shared kiosk secret, so this mechanism is not suitable for personal-user
passwords.

The model hides `secret_ciphertext` and does not expose a decrypted accessor.
Decryption occurs only inside the Accounting-authorized application path, so a
generic model serialization or debug dump cannot reveal the password.

### Seeder

`QueueKioskSeeder` is local/testing-only and idempotent. It creates or updates:

- email: `queue@grc.com`
- development password: `password`
- role: `queue_kiosk`
- status: active
- matching encrypted credential row

The default is documented as deliberately weak development data. It is not a
production credential and the UI visibly asks Accounting Staff to rotate it.
No environment variable, `.env` value, or real secret is committed.

### Cashier API

Add Accounting-only endpoints:

```text
GET /api/v1/queue-kiosk-credential
PUT /api/v1/queue-kiosk-credential
```

The GET resource has an exact, private contract:

```json
{
  "data": {
    "type": "queue_kiosk_credential",
    "email": "queue@grc.com",
    "password": "..."
  }
}
```

The PUT body contains `password`; validation follows the existing minimum
eight-character account-password rule without inventing a new institutional
password-complexity policy. It returns the same resource shape.

A `QueueKioskCredentialPolicy` authorizes both view and update for Accounting
Staff only, with matching route middleware as coarse defense in depth.
Responses use `Cache-Control: no-store, private`.

### Rotation and auditing

`ChangeQueueKioskPassword` executes in one database transaction and locks the
device user and credential row before it:

1. updates `users.password` through the existing hashed cast;
2. writes `Crypt::encryptString()` output to `secret_ciphertext`;
3. records `updated_by`;
4. revokes all outstanding kiosk access tokens; and
5. writes the audit event.

Changing the password therefore invalidates an already-running kiosk on its
next validation or claim. A compromised old password or token cannot remain a
parallel valid device session.

Add `AuditableType::QUEUE_KIOSK_CREDENTIAL` and two explicit audit actions:

- `QUEUE_KIOSK_CREDENTIAL_VIEWED`, because PRD §9.6 requires privileged reads
  to be audited; and
- `QUEUE_KIOSK_PASSWORD_CHANGED`, as required for the privileged write.

Audit before/after values may record the kiosk user id, rotation time, and
token revocation count. They do not record the email because the existing
`AuditRecorder` deliberately rejects contact-data keys. They never contain
plaintext, password hashes, ciphertext, bearer tokens, or request headers.
Resource and request bodies are also never copied into logs.

## Dual-session frontend architecture

### Persistent kiosk token

`kiosk-token.ts` is the sole owner of the device token in browser storage,
using key `grc.kiosk-token.v1`. It mirrors the failure-tolerant storage API of
`auth-token.ts`, but is deliberately separate so the normal portal token and
device token can coexist without overwriting each other.

This is a narrow addition to PRD §9.1, not a change from bearer authentication:
the normal portal token still has exactly one owner (`auth-token.ts`), the
device token has exactly one owner (`kiosk-token.ts`), credentials use
`Authorization: Bearer`, and requests continue to omit cookies and CSRF state.

On `/queue` load:

1. read the kiosk token;
2. call `GET /auth/me` with that token as an explicit override;
3. accept only an active `queue_kiosk` response; and
4. clear it and show the device login for every invalid, expired, revoked, or
   wrong-role response.

The device login persists until explicit kiosk sign-out, token expiry,
credential rotation, or validation failure.

### In-memory Student token

The Student token and minimal authenticated-user record live only in the
mounted `/queue` client state. They never enter `localStorage`,
`sessionStorage`, a URL, a TanStack Query key, an error message, or a log.

`Done` starts a best-effort logout using the Student token override, but clears
all local state immediately even if the revoke call fails. It also removes all
Student queue queries from the shared QueryClient so the next person cannot
see cached state from the previous Student. Browser refresh naturally removes
the in-memory Student session and returns to Student login while retaining the
validated kiosk device session.

No inactivity duration is introduced because the PRD does not define one. The
screen gives the Student an explicit, prominent `Done` action and explains
that it signs them out of the kiosk.

### API client request isolation

Extend the internal request options with:

- an explicit bearer-token override;
- extra headers for the kiosk proof; and
- `suppressUnauthorizedHandler`.

When no override is supplied, every existing caller preserves current
behavior and receives the globally provided portal token. When an override is
supplied, that value is the only bearer used. A `401` invokes the global portal
unauthorized handler only for normal portal-authenticated requests that did
not suppress it.

Every kiosk and in-memory Student call supplies its own token and suppresses
the global handler. Thus an expired Student token cannot clear a concurrently
stored staff portal token, and an expired kiosk token cannot sign a normal
portal user out.

The Student claim service sends:

```text
Authorization: Bearer <in-memory Student token>
X-Queue-Kiosk-Token: <persistent kiosk token>
```

Accounting's current `claimQueueTicket(studentNumber)` call uses the normal
portal bearer and no kiosk header, unchanged.

## `/queue` screen flow

The route is outside `/portal` and does not render `PortalShell`.

### State 1: device authentication

- GRC-branded kiosk access screen.
- Shared account email and password inputs.
- Generic invalid-credential error.
- Storage-unavailable error explains that the device cannot remain signed in.
- Successful non-kiosk credentials are revoked and rejected as the wrong
  account type.

### State 2: Student authentication

- Device is visibly ready, without exposing its token or password.
- Student enters institutional email/password.
- Successful non-Student credentials are revoked and rejected.
- A device sign-out control is available to authorized operators.

### State 3: eligibility lookup

Immediately after Student authentication, fetch `GET /queue-status` with the
in-memory token. Render explicit loading, connection, contract, and
authorization states. No claim is attempted before the response validates.

Stage behavior:

| stage | kiosk behavior |
|---|---|
| `no_active_enrollment` | Explain that there is no active enrollment for the current term; offer `Done` |
| `pending_registrar_approval` | Explain that Registrar approval is still required; offer `Done` |
| `pending_payment`, `can_claim=true` | Present a clear claim action, then send both tokens and refetch the live view |
| `pending_payment`, existing ticket | Show the live panel immediately; never create a second ticket |
| `enrolled` | Explain that payment/enrollment is already complete; offer `Done` |

A claim error stays on the same Student session, presents the API message in an
accessible error region, and permits retry. A kiosk-token authorization error
clears the invalid device token after the Student session is safely cleared,
then returns to device authentication.

## Student queue data contract

Add a strict Zod schema matching the current backend response exactly:

- `type: student_queue_view`
- `stage`
- `can_claim`
- nullable own `ticket`
- nullable `now_serving_ticket_number`
- `upcoming_ticket_numbers`
- `cut_off_today`

The ticket schema includes number, status/label, priority/label, and nullable
position. The response contains no other student's identity; the upcoming
list contains ticket numbers only.

`student-queue-service.ts` performs the API call and contract parse. Rendering
components do not call the API directly.

## Polling and cache ownership

`useStudentQueueQuery` polls every 3,000 ms and sets:

```text
refetchIntervalInBackground: true
refetchOnWindowFocus: "always"
```

This intentional exception to the app's usual hidden-tab behavior is local to
the live Student queue. Documentation and UI state the limitation honestly:
browsers and operating systems may still throttle or suspend background tabs,
so the page should remain open and visible near the time of service.

The hook accepts an enabled flag, a non-secret viewer id for its query key, and
an optional explicit Student token for kiosk use. Normal portal consumers omit
the override and use the portal token. Tokens never appear in query keys.

The key is viewer-scoped so users cannot share cached responses. Kiosk `Done`
removes the entire kiosk Student queue key family before the next login.

## Reusable live panel

`StudentQueueLivePanel` is one component with presentation modes rather than
three independently evolving implementations:

- `kiosk`: large ticket and now-serving numerals, touch-friendly controls;
- `default`: replaces the static queue portion of
  `EnrollmentQueuePaymentPanel`; and
- `compact`: Student-only summary on `PortalOverviewPage`.

All modes show the same facts where relevant:

- own ticket number and status;
- priority badge;
- now-serving ticket number;
- `You're next` or the number of Students ahead for a waiting ticket;
- upcoming ticket numbers only;
- cut-off notice;
- stage-specific guidance; and
- a reminder to keep the page open.

In normal portal modes, `can_claim=true` tells the Student to use the Cashier
kiosk. Only the `/queue` flow owns the claim button because only it has the
second token.

Every loading, empty, error, and success state uses the existing UI primitives
and semantic theme tokens. The kiosk view is responsive but optimized for a
large touch display; the normal portal modes remain usable at mobile widths.

## Queue-call alert

`useQueueCallAlert` observes the current Student's own ticket status. It alerts
only on a confirmed transition from `waiting` to `serving`; an initial page
load already in `serving` does not manufacture a transition alert.

The alert combines:

- a Sonner toast;
- a persistent `role="alert"` / `aria-live="assertive"` call message;
- a temporary document-title change containing the ticket number;
- a reduced-motion-aware visual call state;
- `navigator.vibrate()` where supported; and
- an opt-in WebAudio oscillator tone.

Browsers require a user gesture before audio can start, so the panel exposes a
plain `Turn on sound` control. The preference is held by a small guarded
browser-preference module under its own non-secret localStorage key. Enabling
sound creates/resumes the AudioContext during the gesture; disabling closes or
suspends it. The UI never claims that sound is guaranteed while a device is
muted or a tab is suspended.

Vibration is best-effort and independent of sound. The UI explicitly notes
that iOS Safari does not support web vibration. A failed audio or vibration
call never prevents the visual and accessible alert.

The hook cleans up timers, title changes, and AudioContext resources on ticket
change, Student `Done`, and unmount. `prefers-reduced-motion` disables flashing
animation but retains a high-contrast static called state.

## Cashier credential workspace

Add one connected Accounting module, `queue-kiosk-access`, rather than adding
credential controls to the already dense payment workflow. It contains:

- kiosk email;
- password hidden by default with reveal/hide control;
- a visible development-default warning when the password is still
  `password`;
- a React Hook Form + Zod change-password form;
- confirmation before rotation because active kiosk tokens will be revoked;
- accessible pending/success/error regions; and
- a reminder that the value is a shared device credential and must not be
  reused for a personal account.

The GET is enabled only when this module is mounted, limiting plaintext
retrieval to an Accounting user who opens the workspace. The QueryClient
entry is removed when leaving/signing out so the decrypted password does not
linger in the client cache.

## Error and recovery behavior

- **Invalid/revoked kiosk token on restore:** clear kiosk storage; show device
  login.
- **Kiosk token revoked while a Student is present:** claim fails closed;
  clear Student state and queue cache, then device state, and return to device
  login.
- **Invalid/expired Student token:** clear only the in-memory Student state and
  queue cache; keep the validated kiosk session.
- **Queue-status connection failure:** keep the Student session, show retry,
  and let TanStack Query continue its bounded request cadence.
- **Contract mismatch:** render a safe generic contract error; do not display
  unvalidated response properties.
- **Credential decrypt failure:** return a generic server error with no
  ciphertext or exception detail in the response; Cashier cannot rotate from
  a guessed value, but PUT may still replace the corrupted encrypted value
  after authorizing and locking the canonical device user/row.
- **Browser storage unavailable:** kiosk login cannot be treated as persistent;
  show a blocking device-storage error instead of silently degrading into an
  insecure or misleading session.
- **Audio/vibration unavailable:** continue with toast, title, visible state,
  and assistive-technology alert.

## Authorization matrix

| operation | Student | Accounting | Queue kiosk | Other role |
|---|---:|---:|---:|---:|
| `GET /queue-status` | own view | no | no | no |
| `POST /queue-tickets` without kiosk header | no | on behalf | no | no |
| `POST /queue-tickets` with valid kiosk header | own pending-payment enrollment | on behalf; header ignored | no | no |
| view/change kiosk credential | no | yes | no | no |
| direct ordinary portal API access | normal existing Policies | normal existing Policies | denied | normal existing Policies |

The kiosk token never becomes the request actor for a Student claim. Audit and
notification behavior in `ClaimQueueTicket` therefore continues to identify
the Student or Accounting Staff actor, not the device account.

## Documentation changes

- Update PRD role/auth/security/API sections to record the non-human device
  identity, dual-token claim proof, reversible shared-secret exception, and
  `/queue` surface while preserving Sanctum bearer authentication.
- Add ADR 0023 for the long-lived architectural decisions and security
  consequences.
- Update `docs/testing/SEEDED_IDENTITIES.md` with the local kiosk identity and
  required immediate rotation warning.
- Update the OpenAPI document for the credential endpoints and required
  Student claim header.
- Update route/module inventories and any exact-count architecture tests.

## Test-first implementation strategy

### Backend

- `UserRole`: exact catalog, label, non-learner/device behavior.
- Migration/model: FK and uniqueness rules, hidden ciphertext, reversible
  migration.
- Seeder: local/testing guard, idempotency, bcrypt plus decryptable credential,
  no changes to unrelated human identities.
- Auth: kiosk-specific ability and ordinary-role behavior unchanged.
- Device-isolation middleware: allowed auth endpoints; all ordinary endpoints
  denied for device actor.
- Student claim gate: missing, malformed, expired, revoked, inactive-owner,
  wrong-role, and wrong-ability header cases; valid Student+kiosk success;
  repeat-claim idempotency; Accounting path unchanged without a header.
- Credential API: anonymous/Student/other roles denied; Accounting view/update;
  exact no-store resource; minimum length; transactional hash+cipher update;
  token revocation; view/change audits with no secret material.
- API surface/OpenAPI and fresh migrate/seed coverage.

### Frontend

- API client: override precedence, custom header, 401 suppression, and all
  existing default behavior unchanged.
- Kiosk token store: storage success/failure/invalid values.
- Kiosk auth state machine: restore, wrong role revocation, Student memory-only
  session, refresh behavior, `Done`, cache removal, and independent failure
  handling.
- Queue schema/service/hook: strict contract, viewer-scoped key, three-second
  interval, background flag, token override, no token in key.
- Claim service: both required headers for kiosk Student; Accounting call
  unchanged.
- Live panel: all stages, ticket/position/priority/board/cut-off states, three
  presentation modes, normal-portal kiosk guidance.
- Call alert: waiting-to-serving edge only, opt-in sound, vibration fallback,
  title/toast/ARIA behavior, reduced motion, cleanup.
- Cashier credential page: least-privilege navigation, hidden/revealed state,
  weak-default warning, rotation confirmation, cache removal.
- Role maps, route guards, module registry, navigation, and exact inventories.

### Verification

Run the narrowest related backend and frontend test files after each red/green
slice. Before completion run:

- complete Laravel test suite;
- Pint;
- PHPStan, recording any pre-existing baseline separately from new failures;
- frontend Vitest suite;
- TypeScript no-emit check;
- ESLint;
- fresh MariaDB migration and full seed with the configured migrator account;
  and
- an in-browser walkthrough of kiosk login, Student claim, Cashier call,
  waiting-to-serving alert, `Done`, portal live panel, and credential rotation.

No pass is recorded unless the command actually finishes successfully.

## Deliberate non-goals

- No public queue display or exposure of Student names/numbers in board data.
- No push notifications, service worker, SMS, or email call alert.
- No kiosk camera, QR scanner, barcode reader, printer, or hardware integration.
- No automatic enrollment denial or policy inference.
- No new queue priority eligibility rule, skip limit, or no-show policy.
- No change to `ConfirmPayment`, ticket completion, or queue-cycle ordering.
- No invented inactivity-timeout duration.
- No cookie/CSRF authentication and no Next.js API proxy.

## Consequences

Students can no longer self-claim from an arbitrary authenticated browser: the
existing claim action stays idempotent and own-record authorized, but now also
requires proof that the request is physically on an authenticated kiosk. The
Cashier's on-behalf workflow remains available when the kiosk cannot be used.

The cost is a deliberately reversible shared device secret and a second
browser-resident bearer token. Least-privilege routing, kiosk-specific token
ability, credential-read/change auditing, no-store responses, token revocation
on rotation, exact storage ownership, and separate 401 handling contain that
risk. The live panel reuses a privacy-preserving endpoint and exposes only
ticket numbers, while the three-second poll gives a near-live experience
without claiming stronger browser-background guarantees than the platform can
provide.
