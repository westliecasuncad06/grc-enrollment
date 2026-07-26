# Landing, Demo Login, and Role Portal Implementation Plan

> **For agentic workers:** Execute this plan with the
> `superpowers:executing-plans` skill. Use the `frontend-design` and `shadcn`
> skills for interface work, `superpowers:test-driven-development` for every
> behavior change, and `superpowers:verification-before-completion` before any
> completion claim. Do not delegate to subagents unless the user explicitly
> authorizes delegation.

**Goal:** Deliver a polished public landing page, a development/test-only demo
login, and a protected role-aware portal that all nine documented GRC demo
users can exercise without implying that real Laravel authentication exists.

**Architecture:** Keep the existing Laravel health-query boundary intact and
add a client-library React Router shell around it. Authentication is selected
through one environment-aware gateway, held by one provider, and persisted only
through a schema-validating `sessionStorage` adapter. A single typed
role-capability catalog drives both portal navigation and module-route
validation. Production builds always select a disabled gateway; no token or
backend-auth behavior is introduced.

**Tech stack:** React 19.2, strict TypeScript 6, Vite 8, React Router 8.3.0
client-library mode, TanStack Query 5, React Hook Form 7, Zod 4, Tailwind CSS 4,
reviewed shadcn/ui source components, Vitest, and Testing Library.

**Approved design:**
`docs/superpowers/specs/2026-07-26-landing-login-demo-portal-design.md`

## Global Constraints

- Read `AGENTS.md`, `PRD.md`, the approved design, and all of `PROGRESS.md`
  before execution.
- Update `PROGRESS.md` before each substantial task, after every meaningful
  milestone or failure, and before ending the session.
- Work red-green-refactor: write the smallest failing test, run it and confirm
  the expected failure, implement only enough to pass, rerun it, then refactor.
- Do not commit or push. Repository instructions require explicit user
  authorization, which has not been provided.
- Do not add React Router framework mode, server packages, RSC APIs, server
  actions, cookie sessions, fake bearer tokens, or direct backend-auth calls.
- Do not place passwords in browser storage or environment files. The only
  password fixture is the intentionally public local-demo password documented
  in the approved design and credential guide.
- Keep `fetch(` confined to `frontend/src/app/services/api-client.ts`; keep all
  `sessionStorage` references confined to
  `frontend/src/app/auth/demo-session-store.ts`.
- Keep the existing service-readiness loading, success, contract-error,
  connection-error, and retry behavior.
- During UI work, use the `shadcn` skill to inspect current project metadata and
  component documentation before adding source. Review dry-run output before
  accepting generated files.
- Treat no task as complete until its narrow test passes. Treat the slice as
  complete only after the full frontend gate and static-boundary scans pass.

## Planned File Map

```text
docs/testing/DEMO_CREDENTIALS.md
frontend/.env.example
frontend/README.md
frontend/package.json
frontend/package-lock.json
frontend/src/main.tsx
frontend/src/app/app.tsx
frontend/src/app/auth/auth-context.tsx
frontend/src/app/auth/auth-route-guards.tsx
frontend/src/app/auth/demo-auth-gateway.test.ts
frontend/src/app/auth/demo-auth-gateway.ts
frontend/src/app/auth/demo-auth-mode.test.ts
frontend/src/app/auth/demo-auth-mode.ts
frontend/src/app/auth/demo-auth-types.ts
frontend/src/app/auth/demo-session-store.test.ts
frontend/src/app/auth/demo-session-store.ts
frontend/src/app/auth/demo-users.test.ts
frontend/src/app/auth/demo-users.ts
frontend/src/app/components/common/public-api-readiness.tsx
frontend/src/app/components/layouts/portal-shell.test.tsx
frontend/src/app/components/layouts/portal-shell.tsx
frontend/src/app/components/layouts/public-footer.tsx
frontend/src/app/components/layouts/public-header.tsx
frontend/src/app/components/pages/landing-page.test.tsx
frontend/src/app/components/pages/landing-page.tsx
frontend/src/app/components/pages/login-page.test.tsx
frontend/src/app/components/pages/login-page.tsx
frontend/src/app/components/pages/not-found-page.tsx
frontend/src/app/components/pages/portal-module-page.test.tsx
frontend/src/app/components/pages/portal-module-page.tsx
frontend/src/app/components/pages/portal-overview-page.test.tsx
frontend/src/app/components/pages/portal-overview-page.tsx
frontend/src/app/components/pages/service-readiness-page.test.tsx
frontend/src/app/components/pages/service-readiness-page.tsx
frontend/src/app/components/ui/avatar.tsx
frontend/src/app/components/ui/empty.tsx
frontend/src/app/components/ui/field.tsx
frontend/src/app/components/ui/input.tsx
frontend/src/app/components/ui/sheet.tsx
frontend/src/app/portal/role-capabilities.test.ts
frontend/src/app/portal/role-capabilities.ts
frontend/src/app/router/app-router.test.tsx
frontend/src/app/router/app-router.tsx
frontend/src/app/router/safe-return-path.test.ts
frontend/src/app/router/safe-return-path.ts
frontend/src/tests/render-app.tsx
frontend/src/vite-env.d.ts
PROGRESS.md
```

Existing files may be split slightly differently during refactoring only when
the final ownership boundaries remain the same and the change is recorded in
`PROGRESS.md`.

## Task 1: Add the Routing and Form Integration Foundation

**Files:**

- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/.env.example`
- Modify: `frontend/src/vite-env.d.ts`
- Create: `frontend/src/app/auth/demo-auth-mode.test.ts`
- Create: `frontend/src/app/auth/demo-auth-mode.ts`
- Modify: `PROGRESS.md`

**Step 1: Record the checkpoint**

Update `PROGRESS.md` to state that dependency and environment-mode work has
started. Record that npm metadata confirmed:

- `react-router@8.3.0` requires Node `>=22.22.0`;
- it peers on React and React DOM `>=19.2.7`;
- `@hookform/resolvers@5.5.7` supports React Hook Form `^7.55.0` and Zod 4;
- the shadcn project is Vite, TypeScript, Tailwind 4, `rsc: false`, and
  `radix-nova`.

**Step 2: Write the failing mode-selection test**

Create `demo-auth-mode.test.ts` around a pure selector, not Vite globals:

```ts
import { describe, expect, it } from "vitest"

import { selectAuthMode } from "@/app/auth/demo-auth-mode"

describe("selectAuthMode", () => {
  it("enables demo authentication only for requested development or test modes", () => {
    expect(selectAuthMode({ requestedMode: "demo", mode: "development" })).toBe("demo")
    expect(selectAuthMode({ requestedMode: "demo", mode: "test" })).toBe("demo")
    expect(selectAuthMode({ requestedMode: "demo", mode: "production" })).toBe("disabled")
    expect(selectAuthMode({ requestedMode: undefined, mode: "development" })).toBe("disabled")
  })
})
```

Run:

```powershell
npm test -- src/app/auth/demo-auth-mode.test.ts
```

Expected: FAIL because `demo-auth-mode.ts` does not exist.

**Step 3: Install exact reviewed runtime dependencies**

From `frontend/`:

```powershell
npm install react-router@8.3.0 @hookform/resolvers@5.5.7
```

Do not install `react-router-dom`, framework packages, or server/RSC packages.
Review the resulting manifest and lock diff.

**Step 4: Implement the pure selector and environment adapter**

Export:

```ts
export type AuthMode = "demo" | "disabled"

export interface AuthModeEnvironment {
  requestedMode: string | undefined
  mode: string
}

export function selectAuthMode(environment: AuthModeEnvironment): AuthMode
export function getAuthMode(): AuthMode
```

`getAuthMode()` passes `import.meta.env.VITE_AUTH_MODE` and
`import.meta.env.MODE` into the pure selector. It must not depend solely on
`import.meta.env.DEV`, because Vitest uses `MODE === "test"`.

Add `VITE_AUTH_MODE?: string` to the existing Vite environment interface if
needed. Add this safe setting to `.env.example`:

```dotenv
# Local frontend demonstration only; production builds always disable it.
VITE_AUTH_MODE=demo
```

**Step 5: Verify**

```powershell
npm test -- src/app/auth/demo-auth-mode.test.ts
npm run typecheck
npm audit --audit-level=moderate
```

Expected: all pass and audit reports zero known vulnerabilities. Record actual
results in `PROGRESS.md`; do not record unrun checks.

## Task 2: Add Reviewed shadcn Primitives

**Files:**

- Create: `frontend/src/app/components/ui/avatar.tsx`
- Create: `frontend/src/app/components/ui/empty.tsx`
- Create: `frontend/src/app/components/ui/field.tsx`
- Create: `frontend/src/app/components/ui/input.tsx`
- Create: `frontend/src/app/components/ui/sheet.tsx`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `PROGRESS.md`

**Step 1: Inspect before adding**

Use the `shadcn` skill. From `frontend/`, rerun:

```powershell
npx --yes shadcn@latest info --json
npx --yes shadcn@latest docs input field sheet empty avatar
npx --yes shadcn@latest add input field sheet empty avatar --dry-run
```

Read each returned component documentation/source URL. Confirm that the dry run
writes only the five intended UI files and compatible dependencies. If the CLI
proposes unrelated overwrites, stop and inspect rather than accepting them.

**Step 2: Add and review the source**

```powershell
npx --yes shadcn@latest add input field sheet empty avatar
```

Review the generated source for:

- no RSC directive;
- accessible Sheet title support and focus management;
- current `@/app/...` aliases;
- Lucide icons;
- no remote assets or runtime network dependency.

**Step 3: Verify the primitive boundary**

```powershell
npm run format:check
npm run lint
npm run lint:fast
npm run typecheck
npm audit --audit-level=moderate
```

If generated source fails repository formatting, run `npm run format`, inspect
the diff, and rerun the checks. Record the milestone or failure and recovery in
`PROGRESS.md`.

## Task 3: Create the Nine Demo Identities and Credential Contract

**Files:**

- Create: `frontend/src/app/auth/demo-auth-types.ts`
- Create: `frontend/src/app/auth/demo-users.ts`
- Create: `frontend/src/app/auth/demo-users.test.ts`
- Create: `docs/testing/DEMO_CREDENTIALS.md`
- Modify: `PROGRESS.md`

**Step 1: Write the failing fixture/document synchronization test**

Define the expected public exports in the test:

```ts
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { demoRoles, demoUsers, sharedDemoPassword } from "@/app/auth/demo-users"

const credentialDocument = readFileSync(
  fileURLToPath(
    new URL("../../../../docs/testing/DEMO_CREDENTIALS.md", import.meta.url),
  ),
  "utf8",
)

describe("demo user fixtures", () => {
  it("keeps exactly one safe documented account for every PRD role", () => {
    expect(demoRoles).toHaveLength(9)
    expect(demoUsers).toHaveLength(9)
    expect(new Set(demoUsers.map(({ email }) => email)).size).toBe(9)

    for (const user of demoUsers) {
      expect(user.email).toMatch(/\.test$/)
      expect(credentialDocument).toContain(user.email)
      expect(credentialDocument).toContain(user.displayName)
      expect(user).not.toHaveProperty("token")
    }

    expect(credentialDocument).toContain(sharedDemoPassword)
  })
})
```

Adjust only the relative document URL if Vitest resolves it differently; do not
weaken the synchronization assertions.

Run:

```powershell
npm test -- src/app/auth/demo-users.test.ts
```

Expected: FAIL because fixtures and documentation do not exist.

**Step 2: Implement exact types and fixtures**

In `demo-auth-types.ts`, define the approved `DemoRole`, `DemoUser`,
`DemoSession`, `DemoCredentials`, `DemoAuthGateway`, and `DemoSessionStore`
interfaces. In `demo-users.ts`, export the exact nine-role tuple, shared
password, and these synthetic users:

```text
student.demo@grc.test
admission.demo@grc.test
faculty.demo@grc.test
chair.demo@grc.test
dean.demo@grc.test
executive.demo@grc.test
registrar-head.demo@grc.test
registrar-staff.demo@grc.test
accounting.demo@grc.test
```

All use `GRC-Demo-Only!2026`. Use stable non-production IDs such as
`demo-student`; never use random IDs, UUIDs that resemble records, or a
production domain.

**Step 3: Create the test credential guide**

Create `docs/testing/DEMO_CREDENTIALS.md` with:

- a prominent “local interface demonstration only” warning;
- the shared password;
- one table row for every role, display name, email, and password;
- exact steps: copy `.env.example` to `.env.local`, run the frontend, open
  `/login`, sign in, and sign out before switching roles;
- statements that these are client fixtures, not database users, Laravel never
  accepts them, they must not be reused for real accounts or seeders, and real
  test accounts will use environment-controlled hashed credentials;
- a statement that the file contains no production secret.

**Step 4: Verify**

```powershell
npm test -- src/app/auth/demo-users.test.ts
npm run typecheck
```

Expected: PASS with exactly nine unique `.test` identities. Update
`PROGRESS.md` and link the credential guide.

## Task 4: Implement the Demo Gateway, Session Store, and Provider

**Files:**

- Create: `frontend/src/app/auth/demo-auth-gateway.test.ts`
- Create: `frontend/src/app/auth/demo-auth-gateway.ts`
- Create: `frontend/src/app/auth/demo-session-store.test.ts`
- Create: `frontend/src/app/auth/demo-session-store.ts`
- Create: `frontend/src/app/auth/auth-context.tsx`
- Create: `frontend/src/tests/render-app.tsx`
- Modify: `frontend/src/main.tsx`
- Modify: `PROGRESS.md`

**Step 1: Write failing gateway tests**

Test all nine fixtures, normalization, generic failure, and no credential
leakage:

```ts
const gateway = createDemoAuthGateway(demoUsers)

await expect(
  gateway.signIn({
    email: `  ${demoUsers[0].email.toUpperCase()}  `,
    password: sharedDemoPassword,
  }),
).resolves.toMatchObject({
  schemaVersion: "demo-v1",
  userId: demoUsers[0].id,
  role: demoUsers[0].role,
})

await expect(
  gateway.signIn({ email: "unknown@grc.test", password: "wrong" }),
).rejects.toMatchObject({ code: "INVALID_DEMO_CREDENTIALS" })
```

Loop through all users and assert the returned session contains neither
`email` nor `password`. Wrong email, wrong password, and unknown email must
produce the same typed error shape.

Run:

```powershell
npm test -- src/app/auth/demo-auth-gateway.test.ts
```

Expected: FAIL because the gateway does not exist.

**Step 2: Implement the gateway**

Export:

```ts
export const invalidDemoCredentialsMessage =
  "The demo credentials were not recognized."

export class DemoAuthError extends Error {
  readonly code = "INVALID_DEMO_CREDENTIALS"
}

export function createDemoAuthGateway(
  users: readonly DemoUser[],
): DemoAuthGateway

export function createDisabledAuthGateway(): DemoAuthGateway
```

The demo gateway trims/lowercases email, performs exact password comparison,
returns an ISO timestamp, and never logs. The disabled gateway rejects with a
separate `DEMO_AUTH_DISABLED` code used only for the availability notice.

**Step 3: Write failing session-store tests**

Use an injected minimal `Storage` interface so tests do not mutate global
storage. Cover valid restoration, write shape, clear, corrupt JSON, unknown
schema, unknown role, missing fields, and every `getItem`/`setItem`/`removeItem`
exception. Invalid stored data must trigger removal. Write assertions must prove
the serialized value excludes email and password.

Run:

```powershell
npm test -- src/app/auth/demo-session-store.test.ts
```

Expected: FAIL because the store does not exist.

**Step 4: Implement the single storage boundary**

`demo-session-store.ts` is the only source file allowed to reference
`sessionStorage`. Export:

```ts
export const demoSessionStorageKey = "grc.demo-session.v1"

export interface SessionStoreResult {
  session: DemoSession | null
  storageAvailable: boolean
}

export function createDemoSessionStore(storage: Storage | null): {
  clear(): boolean
  read(): SessionStoreResult
  write(session: DemoSession): boolean
}
```

Validate with a strict Zod schema. Catch storage exceptions without exposing
their messages. Remove malformed data where removal remains possible.

**Step 5: Implement the provider around injected dependencies**

`AuthProvider` owns:

```ts
interface AuthContextValue {
  authMode: AuthMode
  session: DemoSession | null
  storageAvailable: boolean
  status: "restoring" | "anonymous" | "authenticated"
  signIn(credentials: DemoCredentials): Promise<void>
  signOut(): void
}
```

It restores once, keeps an in-memory session if storage fails, and never exposes
fixtures or a password. Export a strict `useAuth()` hook that errors when used
outside the provider.

In `main.tsx`, create the gateway from `getAuthMode()` and wrap `<App />` in
`AuthProvider`. Preserve `StrictMode` and `QueryClientProvider`.

Create `render-app.tsx` to centralize a fresh `QueryClient`, MemoryRouter
initial entries, and injectable auth/session dependencies for page and route
tests.

**Step 6: Verify**

```powershell
npm test -- src/app/auth/demo-auth-gateway.test.ts src/app/auth/demo-session-store.test.ts
npm run typecheck
rg -n "sessionStorage" frontend/src
```

Expected: tests and typecheck pass; the scan reports only
`demo-session-store.ts` (test files may mention it as test text, but no other
application source may access it). Record results in `PROGRESS.md`.

## Task 5: Add Safe Routing and Authentication Guards

**Files:**

- Create: `frontend/src/app/router/safe-return-path.test.ts`
- Create: `frontend/src/app/router/safe-return-path.ts`
- Create: `frontend/src/app/auth/auth-route-guards.tsx`
- Create: `frontend/src/app/router/app-router.test.tsx`
- Create: `frontend/src/app/router/app-router.tsx`
- Modify: `frontend/src/app/app.tsx`
- Create: `frontend/src/app/components/pages/not-found-page.tsx`
- Modify: `PROGRESS.md`

**Step 1: Write failing safe-return tests**

Table-test accepted and rejected values:

```ts
expect(getSafeReturnPath("/portal")).toBe("/portal")
expect(getSafeReturnPath("/portal/enrollment?tab=open")).toBe(
  "/portal/enrollment?tab=open",
)
expect(getSafeReturnPath("https://evil.example")).toBe("/portal")
expect(getSafeReturnPath("//evil.example")).toBe("/portal")
expect(getSafeReturnPath("javascript:alert(1)")).toBe("/portal")
expect(getSafeReturnPath("/unknown")).toBe("/portal")
```

Also cover encoded protocol/leading-slash tricks, backslashes, repeated
decoding, fragments, blank values, and unknown portal module paths. Accept only
`/portal` and module IDs in the role-capability catalog; route authorization
still happens after session restoration.

Run:

```powershell
npm test -- src/app/router/safe-return-path.test.ts
```

Expected: FAIL because the helper does not exist.

**Step 2: Implement the safe parser**

Export `getSafeReturnPath(value: string | null | undefined): string`. Parse with
an inert same-origin base, require exactly the expected internal pathname
shape, reject credentials/host changes and malformed encodings, and return
`/portal` on any doubt.

**Step 3: Write failing route-guard tests**

Using the shared render helper, test:

- `/` and `/login` render anonymously;
- `/portal` redirects to `/login?returnTo=%2Fportal`;
- `/portal/enrollment` preserves the safe internal return path;
- valid session renders protected content;
- existing session visiting `/login` redirects to `/portal`;
- corrupt persisted session redirects and is cleared;
- unknown public routes render the branded not-found page.

Run:

```powershell
npm test -- src/app/router/app-router.test.tsx
```

Expected: FAIL because the router and guards do not exist.

**Step 4: Implement client-library routes**

Use only exports from `react-router`. Create:

```tsx
export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<AnonymousOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route element={<RequireDemoSession />}>
        <Route path="/portal" element={<PortalShell />}>
          <Route index element={<PortalOverviewPage />} />
          <Route path=":moduleId" element={<PortalModulePage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
```

`RequireDemoSession` renders a non-flashing restore state before deciding.
Redirects use `replace`. `AnonymousOnlyRoute` does not reveal fixture data.
`App` renders a `BrowserRouter` plus `AppRouter`; tests render `AppRouter`
inside a `MemoryRouter`.

At this step, temporary semantic page stubs are permitted only long enough to
make the route tests green; Tasks 6–9 immediately replace them. Do not use
placeholder lorem ipsum.

**Step 5: Verify**

```powershell
npm test -- src/app/router/safe-return-path.test.ts src/app/router/app-router.test.tsx
npm run typecheck
```

Record route behavior and actual results in `PROGRESS.md`.

## Task 6: Build the Institutional Landing Page and Readiness Section

**Files:**

- Create: `frontend/src/app/components/layouts/public-header.tsx`
- Create: `frontend/src/app/components/layouts/public-footer.tsx`
- Create: `frontend/src/app/components/common/public-api-readiness.tsx`
- Create: `frontend/src/app/components/pages/landing-page.test.tsx`
- Create: `frontend/src/app/components/pages/landing-page.tsx`
- Modify: `frontend/src/app/components/pages/service-readiness-page.tsx`
- Modify: `frontend/src/app/components/pages/service-readiness-page.test.tsx`
- Modify: `frontend/src/index.css`
- Modify: `PROGRESS.md`

**Step 1: Write failing landing tests**

Test the required semantic content:

- one H1: “Enrollment, guided from first step to final record.”;
- header identity and “Automated Enrollment System” label;
- primary `/login` action;
- secondary `#system-readiness` action;
- three role-orientation pathways;
- ordered four-step enrollment journey;
- public API readiness section;
- no invented phone, email, readiness percentage, policy value, or production
  claim;
- footer demo/privacy reminder.

Retain and adapt existing readiness tests to render the extracted
`PublicApiReadiness` section. Continue asserting loading, success, malformed
contract, unreachable service, and retry.

Run:

```powershell
npm test -- src/app/components/pages/landing-page.test.tsx src/app/components/pages/service-readiness-page.test.tsx
```

Expected: FAIL on the new page and/or extracted section.

**Step 2: Implement the visual system**

Use the `frontend-design` skill. Preserve the registrar-ledger identity:
Newsreader display type, IBM Plex Sans UI type, ink/navy, paper, muted blue,
warm signal accents, compact rules, and restrained institutional motion.

Build:

- sticky public header with functional section links and portal CTA;
- asymmetrical hero with a ledger/workflow visual made from HTML/CSS and Lucide
  icons, not an invented stock image;
- role pathway cards;
- four-step journey;
- the extracted health/readiness component;
- public footer with no fabricated contact details.

Use semantic landmarks and a skip link. Include reduced-motion CSS. Avoid
gradients, generic dashboard templates, excessive pills, and unverified
metrics.

`ServiceReadinessPage` may remain as a thin compatibility wrapper around
`PublicApiReadiness`, or be removed only after every import/test is updated.

**Step 3: Verify**

```powershell
npm test -- src/app/components/pages/landing-page.test.tsx src/app/components/pages/service-readiness-page.test.tsx
npm run lint
npm run typecheck
```

Inspect at narrow and wide widths with the browser skill if a browser session
is available. If none is available, record the unverified visual-QA gap rather
than claiming it passed. Update `PROGRESS.md`.

## Task 7: Build the Login Page and Complete the Sign-In Flow

**Files:**

- Create: `frontend/src/app/components/pages/login-page.test.tsx`
- Create: `frontend/src/app/components/pages/login-page.tsx`
- Modify: `frontend/src/app/router/app-router.test.tsx`
- Modify: `frontend/src/index.css`
- Modify: `PROGRESS.md`

**Step 1: Write failing login tests**

Cover:

- accessible email and password labels;
- client validation with focusable error summary;
- email trim/lowercase normalization;
- accessible show/hide action whose name changes;
- pending button state;
- generic invalid-credential message for every gateway failure of that class;
- email retained and password cleared after rejection;
- safe `returnTo` honored after success;
- unsafe `returnTo` falls back to `/portal`;
- demo-disabled notice and disabled submit;
- link to `/` and visible reference to
  `docs/testing/DEMO_CREDENTIALS.md`;
- no registration or password-recovery control.

Run:

```powershell
npm test -- src/app/components/pages/login-page.test.tsx
```

Expected: FAIL because the finished form does not exist.

**Step 2: Implement RHF/Zod form behavior**

Use `zodResolver` and:

```ts
const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Enter your password."),
})
```

Use shadcn `Field`, `Input`, `Alert`, and `Button`. The error summary receives
programmatic focus after invalid submission. Set `autoComplete="username"` and
`autoComplete="current-password"`. Never log form data. Use an `aria-live`
region for pending/failure changes.

Use a split wide-screen composition and one-column small-screen layout.
Repeatedly label the boundary as “Interface demonstration—not real
authentication.”

**Step 3: Verify**

```powershell
npm test -- src/app/components/pages/login-page.test.tsx src/app/router/app-router.test.tsx
npm run lint
npm run typecheck
```

Record the login milestone in `PROGRESS.md`.

## Task 8: Implement the Role-Capability Catalog and Portal Shell

**Files:**

- Create: `frontend/src/app/portal/role-capabilities.test.ts`
- Create: `frontend/src/app/portal/role-capabilities.ts`
- Create: `frontend/src/app/components/layouts/portal-shell.test.tsx`
- Create: `frontend/src/app/components/layouts/portal-shell.tsx`
- Create: `frontend/src/app/components/pages/portal-overview-page.test.tsx`
- Create: `frontend/src/app/components/pages/portal-overview-page.tsx`
- Modify: `frontend/src/index.css`
- Modify: `PROGRESS.md`

**Step 1: Write failing capability tests**

Create an expected matrix with the exact approved module IDs. Assert:

- all nine `DemoRole` values are keys;
- every module ID is non-empty and unique within a role;
- labels/descriptions are non-empty;
- each role receives exactly its approved IDs in approved order;
- the lookup helper returns `null` for an unavailable module.

Run:

```powershell
npm test -- src/app/portal/role-capabilities.test.ts
```

Expected: FAIL because the catalog does not exist.

**Step 2: Implement the single typed catalog**

Export:

```ts
export interface PortalModule {
  id: string
  label: string
  description: string
  icon: LucideIcon
}

export interface RolePortalDefinition {
  roleLabel: string
  welcomeHeading: string
  modules: readonly PortalModule[]
}

export const rolePortalDefinitions: Record<DemoRole, RolePortalDefinition>
export function getRoleModule(role: DemoRole, moduleId: string): PortalModule | null
```

Descriptions must state workflow intent without asserting that APIs, approvals,
policy values, or records are connected.

**Step 3: Write failing shell and overview tests**

For each of the nine demo sessions, assert:

- role-specific welcome;
- exactly the allowed navigation labels/links and no foreign modules;
- visible “Demo portal” badge and boundary Alert;
- display name and human role label;
- “Academic term not connected”;
- main landmark and skip link;
- public API readiness summary;
- notification/profile/password/help/report-issue controls are explicitly
  previews or unavailable, not functional claims;
- logout clears session and navigates to `/`.

Add focused tests for mobile menu opening, accessible Sheet title, and keyboard
reachable logout.

Run:

```powershell
npm test -- src/app/components/layouts/portal-shell.test.tsx src/app/components/pages/portal-overview-page.test.tsx
```

Expected: FAIL because shell and overview do not exist.

**Step 4: Implement shell and overview**

Use `Avatar`, `Badge`, `Alert`, `Card`, `Separator`, `Sheet`, and `Button`.
Desktop receives a persistent sidebar; mobile receives a Sheet with visible or
screen-reader title. Both derive links from the same catalog and expose the
same actions.

Use `Outlet` for nested pages. Provide breadcrumb/page context without making a
second module catalog. The overview maps role modules to cards and includes the
existing public health query as an honest readiness summary.

When storage persistence failed, display:

> This demo session cannot be restored after refresh on this browser.

**Step 5: Verify**

```powershell
npm test -- src/app/portal/role-capabilities.test.ts src/app/components/layouts/portal-shell.test.tsx src/app/components/pages/portal-overview-page.test.tsx
npm run lint
npm run typecheck
```

Update `PROGRESS.md` with all-nine-role coverage.

## Task 9: Implement Module Previews and Cross-Role Denial States

**Files:**

- Create: `frontend/src/app/components/pages/portal-module-page.test.tsx`
- Create: `frontend/src/app/components/pages/portal-module-page.tsx`
- Modify: `frontend/src/app/router/app-router.test.tsx`
- Modify: `frontend/src/app/components/layouts/portal-shell.tsx`
- Modify: `PROGRESS.md`

**Step 1: Write failing module-route tests**

Test:

- every allowed module ID renders its own label/description;
- the page includes role badge, demo warning, accessible Empty state, API
  disconnection explanation, and overview link;
- an unknown module renders portal not-found;
- a module valid for another role also renders portal not-found;
- no foreign module title, role navigation, or content leaks;
- browser back/overview navigation remains within the signed-in role;
- a direct module URL without a session redirects safely to login and returns
  after valid sign-in.

Run:

```powershell
npm test -- src/app/components/pages/portal-module-page.test.tsx src/app/router/app-router.test.tsx
```

Expected: FAIL because route-specific module validation is incomplete.

**Step 2: Implement catalog-backed module lookup**

Read `moduleId` from `useParams`, the role from `useAuth`, and resolve only
through `getRoleModule(session.role, moduleId)`. Never search across all roles.
Use shadcn `Empty` for both module-preview and portal-not-found states, with
distinct headings and actions.

**Step 3: Verify**

```powershell
npm test -- src/app/components/pages/portal-module-page.test.tsx src/app/router/app-router.test.tsx
npm run lint
npm run typecheck
```

Update `PROGRESS.md`.

## Task 10: Documentation, Static Boundary Checks, and Full Verification

**Files:**

- Modify: `frontend/README.md`
- Modify: `PROGRESS.md`
- Review: every file listed in this plan

**Step 1: Update operator documentation**

Update `frontend/README.md` with:

- landing/login/portal route inventory;
- `VITE_AUTH_MODE=demo` local setup;
- a link to `docs/testing/DEMO_CREDENTIALS.md`;
- exact warning that demo accounts are client fixtures and not Laravel users;
- production-mode disable behavior;
- current real-auth/MySQL/Sanctum deferral;
- current source layout and test commands;
- replacement path to Sanctum bearer-token auth.

Remove the obsolete statement that routing is intentionally deferred. Record
the documentation milestone in `PROGRESS.md`.

**Step 2: Run focused static boundary scans**

From the repository root:

```powershell
rg -n --glob '!**/*.test.*' --glob '!**/node_modules/**' "sessionStorage" frontend/src
rg -n --glob '!**/node_modules/**' "fetch\\(" frontend/src
rg -n --glob '!**/node_modules/**' "(Bearer|access[_-]?token|fake[_-]?token|ml-service|8100)" frontend/src
rg -n "(TODO|TBD|FIXME|lorem ipsum)" docs/testing frontend/src
```

Expected:

- `sessionStorage` only in `demo-session-store.ts`;
- `fetch(` only in `services/api-client.ts`;
- no bearer/fake-token/ML endpoint construction;
- no unfinished placeholder markers in delivered content.

Review every match manually. A clean scan or intentional documentation text is
not a substitute for review.

**Step 3: Run the full frontend gate**

From `frontend/`:

```powershell
npm run format:check
npm run lint
npm run lint:fast
npm run typecheck
npm test
npm run build
npm audit --audit-level=moderate
```

If formatting alone fails, run `npm run format`, inspect changes, and rerun the
entire gate. For any functional failure, invoke
`superpowers:systematic-debugging`, record the failure and evidence in
`PROGRESS.md`, fix the root cause with a regression test, and rerun from the
narrow check through the full gate.

**Step 4: Run browser visual and interaction QA when available**

Use `browser:control-in-app-browser` to test:

- `/` at narrow mobile and wide desktop widths;
- `/login` keyboard flow, error focus, password visibility, and valid login;
- one student, one high-module-count registrar role, and one accounting portal;
- mobile Sheet focus/close behavior;
- direct protected route, cross-role module, logout, and back navigation;
- no horizontal overflow at 200% zoom where the browser supports it;
- reduced-motion behavior.

If no browser is available, record that as an explicit verification gap in
`PROGRESS.md`; do not claim visual QA passed.

**Step 5: Final acceptance review**

Read the approved design acceptance criteria line by line and verify:

- five route classes exist: landing, login, portal overview, module preview,
  branded not-found;
- all nine credentials are documented and executable in local demo mode;
- protected routes require a validated session;
- role navigation and route lookup use one catalog;
- production mode disables the gateway;
- no credential is persisted;
- no fake token or real-auth claim exists;
- current health states remain covered.

Update `PROGRESS.md` with:

- exact files/behaviors completed;
- actual test counts and command results;
- all failures and recoveries;
- browser-QA status;
- remaining MySQL 8.4, Sanctum, institutional-policy, and CI blockers;
- the next exact production-auth step;
- a new session handoff entry.

Do not mark real authentication, RBAC, or Phase 1 complete.

## Completion Definition

This slice is complete only when:

1. all ten tasks are executed through red-green-refactor;
2. `docs/testing/DEMO_CREDENTIALS.md` and fixtures stay synchronized;
3. all nine roles have exact tested portal navigation;
4. safe routing and storage boundaries pass their tests and scans;
5. the full frontend gate passes with zero known moderate-or-higher audit
   findings;
6. visual QA is either evidenced or explicitly recorded as unavailable;
7. `PROGRESS.md` accurately records the milestone and remaining blockers.
