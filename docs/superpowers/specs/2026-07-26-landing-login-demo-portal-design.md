# Landing, Demo Login, and Role Portal Design

**Status:** Approved for implementation planning
**Date:** 2026-07-26
**PRD traceability:** §3, §6.1, §8.4, §9, §12.6, §15, and Phase 1
**Implementation type:** Frontend demonstration boundary; not production authentication

## Purpose

Extend the verified Phase 0A frontend with a public institutional landing page,
a testable demo login, and a role-aware portal shell for all nine PRD roles.
This slice gives the user a credible interface to review while the required
MySQL 8.4 identity foundation and real Laravel Sanctum authentication remain
unavailable.

The demonstration must be explicit. It must not create fake bearer tokens, call
an unimplemented login API, or imply that client-side role filtering is secure
authorization.

## Approved Approach

Use an interchangeable authentication boundary with a development-only
`DemoAuthGateway`.

- The demo gateway validates committed synthetic fixtures.
- The browser stores a non-sensitive demo session, not a bearer token.
- Portal guards and role navigation operate on that validated demo session.
- Real authentication later replaces the gateway with a Sanctum-backed
  implementation without redesigning the pages.

Rejected alternatives:

- A static mockup would not allow login, logout, restoration, or route-guard
  testing.
- Real authentication now would require unsupported database assumptions and
  would violate the recorded MySQL blocker.

## Non-Negotiable Guardrails

- Demo authentication is available only in Vite development and test modes.
- Production builds retain the landing page but disable synthetic login.
- Every authenticated-looking screen displays a textual “Demo portal” status.
- Demo passwords are synthetic, shared openly, and never accepted by Laravel.
- No token string is created, persisted, logged, displayed, or placed in a URL.
- Only the demo-session module may access `sessionStorage`.
- The existing public API client remains the only browser `fetch` boundary.
- No component calls the Laravel API or the prediction service directly.
- Portal navigation is presentation filtering only and is never described as
  server authorization.
- Real protected APIs still require Sanctum bearer tokens and Laravel Policies.

`frontend/.env.example` will declare `VITE_AUTH_MODE=demo`. The application
selects the demo gateway only when that value is present and Vite reports
development or test mode. Every production-mode build selects a disabled
gateway even if a local environment file incorrectly requests demo mode.

## Routing

Use `react-router` 8.3.0 in client-library mode. Do not use Framework Mode,
server actions, RSC APIs, or React Router server packages.

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Institutional landing page and system readiness |
| `/login` | Public | Demo sign-in; an existing session redirects to `/portal` |
| `/portal` | Demo session | Role dashboard overview |
| `/portal/:moduleId` | Demo session and role module | Accessible module-preview state |
| `*` | Public | Branded not-found page with safe navigation |

When a user opens a protected route without a session, the router sends them to
`/login?returnTo=<internal-path>`. Only known `/portal` paths are accepted.
External URLs, protocol-relative values, encoded protocols, and unknown paths
fall back to `/portal`.

## Landing Page

The landing page evolves the existing registrar-ledger visual system rather
than replacing it with a generic marketing template.

### Header

- GRC monogram and “Global Reciprocal Colleges”
- “Automated Enrollment System” product label
- Links to portal guide and system readiness sections
- Primary “Sign in to portal” action

### Hero

- Heading: “Enrollment, guided from first step to final record.”
- Supporting copy explains that the platform coordinates schedules,
  enrollment, approvals, payment confirmation, and academic records.
- Primary action: “Sign in to portal”
- Secondary action: “View system readiness”
- No unverified numbers, dates, policy values, or production-readiness claims

### Role Orientation

Concise pathways introduce:

- Students
- Faculty and Program Chairs
- Admissions, Registrar, Accounting, Dean, and Executive offices

These pathways explain responsibilities without exposing portal data.

### Enrollment Journey

Four high-level steps:

1. Schedule preparation
2. Student subject selection and submission
3. Authorized review and approval
4. Payment confirmation and Digital COM finalization

### System Readiness

Refactor the existing service-readiness content into a lower landing-page
section. Preserve its database-independent health query, loading, success,
contract-failure, connection-failure, and retry behavior.

### Footer

- Institution and system name
- Help/report-an-issue placeholder without invented contact details
- Privacy and demo-boundary reminder

## Login Page

Use a focused split composition on wide screens and a single-column layout on
small screens.

### Institutional Panel

- GRC identity and registrar-ledger styling
- Short portal-purpose statement
- Three trust statements: role-aware navigation, private records, and
  authorized workflows
- Persistent “Interface demonstration—not real authentication” notice

### Form Panel

- Email field
- Password field
- Accessible show/hide-password control
- Submit button with pending state
- Link back to the landing page
- Text reference to `docs/testing/DEMO_CREDENTIALS.md`

The form uses React Hook Form with a strict Zod schema:

- email: trimmed, normalized to lowercase, and syntactically valid
- password: required and never logged

Invalid email/password combinations always render:

> The demo credentials were not recognized.

The message must not reveal whether the email exists.

Password recovery and public registration are not rendered because neither
workflow is implemented.

## Demo Identity Model

```ts
export const demoRoles = [
  "student",
  "admission_staff",
  "faculty",
  "program_chair",
  "dean",
  "executive_director",
  "registrar_head",
  "registrar_staff",
  "accounting_staff",
] as const

export type DemoRole = (typeof demoRoles)[number]

export interface DemoUser {
  id: string
  displayName: string
  email: string
  password: string
  role: DemoRole
}

export interface DemoSession {
  schemaVersion: "demo-v1"
  userId: string
  displayName: string
  role: DemoRole
  signedInAt: string
}

export interface DemoCredentials {
  email: string
  password: string
}

export interface DemoAuthGateway {
  signIn(credentials: DemoCredentials): Promise<DemoSession>
}

export interface DemoSessionStore {
  clear(): void
  read(): DemoSession | null
  write(session: DemoSession): void
}
```

The persisted session excludes email and password. A strict Zod schema validates
restored sessions. Invalid JSON, an unknown schema version, an unknown role, or
missing fields causes immediate storage removal.

An authentication provider owns the current in-memory session. It calls the
gateway only to validate credentials and calls `DemoSessionStore` for
persistence. The gateway, page components, route guards, and portal components
never access browser storage directly.

## Demo Credentials

Create `docs/testing/DEMO_CREDENTIALS.md` with the table below and explicit
local-demo warnings.

All accounts use the shared password:

```text
GRC-Demo-Only!2026
```

| Role | Display name | Email |
|---|---|---|
| Student | Demo Student | `student.demo@grc.test` |
| Admission Staff | Demo Admission Staff | `admission.demo@grc.test` |
| Professor / Faculty | Demo Faculty | `faculty.demo@grc.test` |
| Program Chair | Demo Program Chair | `chair.demo@grc.test` |
| Dean | Demo Dean | `dean.demo@grc.test` |
| Executive Director | Demo Executive Director | `executive.demo@grc.test` |
| Registrar Head | Demo Registrar Head | `registrar-head.demo@grc.test` |
| Registrar Staff | Demo Registrar Staff | `registrar-staff.demo@grc.test` |
| Accounting Staff | Demo Accounting Staff | `accounting.demo@grc.test` |

The credential document must state:

- these are client-side fixtures, not database users;
- they work only in local development demo mode;
- Laravel never accepts the emails/password;
- the password must not be reused for real accounts or seeders;
- the file contains no production secret;
- real test accounts will use environment-controlled, hashed credentials.

## Demo Session Flow

1. The user submits the validated login form.
2. `DemoAuthGateway.signIn` normalizes the email and compares the fixture.
3. Failure returns the generic invalid-credential result.
4. Success returns a `DemoSession` and writes it through the demo-session
   module.
5. The guard restores and validates the session.
6. The portal reads only the validated session and role-capability map.
7. Logout removes the session and navigates to `/`.

If `sessionStorage` is unavailable, the current in-memory session remains usable
until refresh. The portal displays:

> This demo session cannot be restored after refresh on this browser.

## Portal Shell

### Shared Layout

- Skip link
- Desktop sidebar
- Mobile navigation Sheet with an accessible title
- GRC identity and “Demo portal” badge
- Logged-in display name and role
- Breadcrumb/page context
- Current academic term shown as “Academic term not connected”
- Notification, profile, password-settings, help, and report-issue previews
- Logout
- Main content landmark

The overview dashboard includes:

- role-specific welcome heading;
- persistent demo-boundary Alert;
- role module cards;
- current-term unavailable state;
- public API readiness summary;
- “last updated” only for data that has a real generated timestamp.

### Module Preview

Selecting an allowed module opens `/portal/:moduleId` and renders:

- module title and description;
- role-context badge;
- an accessible Empty state;
- copy explaining that the workflow and authorization API are not connected;
- a route back to the role overview.

Unknown or cross-role module IDs render a portal not-found state. They must not
silently display another role’s navigation or content.

## Role Navigation Matrix

| Role | Allowed module IDs |
|---|---|
| Student | `enrollment`, `eligible-subjects`, `queue-payment`, `grades-com` |
| Admission Staff | `student-accounts`, `admission-status`, `credential-issuance` |
| Professor / Faculty | `availability-preferences`, `teaching-schedule`, `class-rosters`, `grade-submission` |
| Program Chair | `curriculum`, `subjects-prerequisites`, `sections-schedules`, `faculty-assignment`, `demand-forecast`, `schedule-proposals` |
| Dean | `schedule-approvals`, `enrollment-dashboard`, `stuck-students`, `honors`, `reports` |
| Executive Director | `master-schedule`, `institution-dashboard`, `kpis`, `reports` |
| Registrar Head | `enrollment-approvals`, `overrides-voids`, `attrition-analytics`, `compliance-reports`, `audit-logs`, `policy-settings` |
| Registrar Staff | `credit-mappings`, `drops-withdrawals`, `academic-records`, `enrollment-documents` |
| Accounting Staff | `payment-queue`, `serving-number`, `payment-confirmation`, `com-finalization` |

The matrix is the single source for navigation and module-route validation.

## Error and Boundary Behavior

| Condition | Required behavior |
|---|---|
| Invalid form fields | Inline field error and focusable error summary |
| Unknown credentials | Generic demo error; retain email, clear password |
| Missing session | Redirect to login with safe internal return path |
| Corrupt or invalid demo session | Delete it and redirect to login |
| Storage unavailable | Keep memory session and announce refresh limitation |
| Cross-role module URL | Portal not-found state; no foreign role content |
| Backend health unavailable | Preserve current retry/error experience |
| Demo disabled | Login page explains that demo access is unavailable |
| Unknown public route | Branded not-found page |

No error message includes a password, fixture object, stack trace, token, or
browser-storage contents.

## Accessibility and Responsive Requirements

- WCAG 2.1 AA minimum target
- Semantic headings, landmarks, lists, navigation, and form controls
- Explicit labels and described validation errors
- Error summary receives focus after invalid submission
- Status and failure changes use appropriate live regions
- Password visibility has an accessible name reflecting the action
- Visible focus for every control
- Keyboard-operable desktop and mobile navigation
- Mobile Sheet includes a title and focus management
- Text labels accompany every role/demo/status indicator
- Zoom and text resizing do not hide actions or navigation
- Reduced-motion preference disables decorative reveals/spins where practical
- Touch targets remain usable at mobile widths

## Testing Strategy

Implementation follows red-green-refactor TDD.

### Fixture and Documentation Tests

- exactly nine roles exist;
- every email is unique and ends in `.test`;
- every documented email matches a fixture;
- the shared synthetic password appears in the credential document;
- every PRD role appears in the credential document;
- no fixture contains a token or production-looking domain.

### Authentication Tests

- each of the nine accounts signs in;
- wrong email, wrong password, and unknown email share the generic error;
- normalization handles email case and surrounding whitespace;
- the persisted session excludes email and password;
- valid restoration succeeds;
- invalid JSON, schema version, and role are removed;
- storage failure falls back to memory and announces the limitation;
- logout clears the session.

### Routing Tests

- public routes render without a session;
- protected routes redirect to login;
- successful login honors only safe internal return paths;
- unsafe return values fall back to `/portal`;
- an existing session redirects away from login;
- unknown and cross-role modules render not-found states.

### Page and Role Tests

- landing primary/secondary actions and readiness states;
- login labels, password visibility, pending, and error states;
- all nine role overviews;
- every role sees exactly its allowed module IDs;
- logout, desktop navigation, and mobile navigation;
- module Empty state and demo warning;
- no role claims database or workflow readiness.

### Static Boundary Checks

- no frontend source creates a token;
- no storage access exists outside the demo-session module;
- direct `fetch` remains isolated to the API client;
- no ML endpoint appears in frontend source;
- `npm audit` reports no known vulnerability before completion.

### Full Frontend Gate

```powershell
npm run format:check
npm run lint
npm run lint:fast
npm run typecheck
npm test
npm run build
npm audit --audit-level=moderate
```

## Production Transition

The real Phase 1 authentication slice will:

1. provision supported MySQL 8.4 identity tables and deterministic role seeders;
2. install/configure Laravel Sanctum personal access tokens;
3. implement Form Requests, token service, AuthResource, policies, and strict
   rate limiting;
4. add the single `auth-token` localStorage module;
5. replace `DemoAuthGateway` with the API-backed gateway;
6. preserve landing/login/portal presentation while replacing session behavior;
7. remove or permanently disable demo fixtures in deployed production builds;
8. verify missing, expired, revoked, logout, and cross-role API behavior.

## Out of Scope

- Laravel auth endpoints
- database users, migrations, and seeders
- bearer tokens
- password recovery
- public registration
- profile/password mutation
- notifications
- real academic-term data
- business workflow forms or writes
- backend role authorization
- predictive analytics

## Acceptance Criteria

- The public landing, demo login, role portal, module preview, and not-found
  routes are implemented.
- All nine documented synthetic accounts can be tested locally.
- `docs/testing/DEMO_CREDENTIALS.md` exactly matches the fixtures.
- The UI always identifies demo mode.
- A protected route cannot render without a valid demo session.
- Each role receives only its configured navigation.
- No fake token or backend auth claim exists.
- All tests and the full frontend quality gate pass.
- `PROGRESS.md` records implementation, failures, verification, and remaining
  MySQL/Sanctum blockers.
