# Phase 8c — Playwright E2E Foundation — Design Specification

**Status:** User-approved design.

## Goal

Fill the `e2e/` slot this repo has reserved since scaffolding but never built:
a Playwright suite covering PRD §14.3's critical journeys, running against the
real Next.js frontend, real Laravel API, and an isolated MariaDB test
database — not a mocked or component-level substitute for what `vitest`
already covers.

Grounded in PRD §14.3 (End-to-End). No institutional rule is invented, per
`AGENTS.md`.

## Origin

The Phase 8 roadmap originally sketched 8c as one slice covering E2E (§14.3),
security verification (§14.4), performance verification (§14.5), and §12.6's
remaining profile/password/help features. That is four independent pieces of
work bundled under one label. Scoped down to the E2E foundation alone —
everything else moves to a later slice (see Non-goals).

This also closes a standing gap: the manual WCAG 2.1 AA and live visual pass
has been deferred twice now, in Phase 8a and Phase 8b, purely because no
browser was ever connected during either session. A Playwright suite runs a
real Chromium instance under our own control, so that verification becomes
automated and permanent (in CI, on every push) instead of a one-off manual
favor that depends on tooling availability.

## What already exists, and what doesn't

No Playwright dependency and no `e2e/` directory exist anywhere in the repo.
But the slot is pre-reserved by four already-committed references:

| Location | What it commits to |
|---|---|
| `.gitignore:38-40` | `/e2e/node_modules/`, `/e2e/playwright-report/`, `/e2e/test-results/` |
| `README.md:40` | `e2e/  Playwright journeys against the integrated stack` |
| `PRD.md:558` | directory layout `e2e/{fixtures/,tests/}` |
| `docs/architecture/version-compatibility.md:19` | pins "Playwright 1.62.x when E2E begins" |

The `/e2e/node_modules/` gitignore entry settles the one real design question:
`e2e/` is its own npm package at the repo root, not nested under `frontend/`.
This spec fills a reserved slot; it does not invent the layout.

## Scope and Decisions

- **13 of the PRD's 15 named journeys**, not 15. Journey #14 (prediction-service
  failure with cached fallback) needs the ml-service, which is dormant — none
  of the 48 live API routes are prediction routes, and `AGENTS.md` explicitly
  forbids touching `ml-service` before Phase 9. It is recorded as a skipped,
  documented placeholder rather than faked. Journey #15 (compliance report
  authorization) is split: `compliance-reports` is a registered but
  placeholder module (Phase 7c, blocked on an institutional content
  decision), so only the *authorization* half — non-Registrar-Head roles
  denied the route — is real and gets a real test; the report content does
  not exist to test.
- **Run-scoped state reset, not per-test.** A single `migrate:fresh --seed`
  before the suite runs, not before each test. The seeders (`RoleUserSeeder`,
  `DatabaseSeeder`) are already idempotent and produce the exact deterministic
  fixtures PRD §14.3 asks for — 9 role identities, 3 student lifecycle
  scenarios, known programs (BSIT/BSCS active, BSCRIM inactive) and terms
  (`2026-2027 1st` active). Per-test resets would mean 13+ full migration
  cycles against a MariaDB install that has already crashed twice on this
  workstation; one reset per run is both faster and the documented-safe
  pattern (see next point).
- **No schema-wildcard `GRANT` statements, ever, in any E2E tooling.** The
  MariaDB runbook (`docs/runbooks/mariadb-local.md`) traces both prior
  crashes: one general, one specifically and reproducibly triggered by
  `GRANT ... ON db.* TO ...`. `migrate:fresh` itself is not the risk — it's
  the same reset the runbook documents and the same DDL path `composer test`
  already exercises on every run. The rule this suite must honor is "no
  wildcard GRANTs," not "no migrations."
- **API-arranged preconditions for causally dependent journeys**, not UI
  replay. Journey 5 (schedule approval) needs a submitted proposal; journey 7
  (registrar approval) needs a submitted enrollment; journey 8 (payment
  confirmation) needs an approved enrollment. Each spec arranges its own
  precondition by calling the API directly (the same bearer-token endpoints
  the frontend calls), not by re-running an earlier journey's UI flow first.
  This keeps every spec independently runnable in any order or in isolation,
  and avoids the "no arbitrary sleeps" trap that UI-chained setup invites.
- **Journey 12 (throttle behavior) is isolated by design, not just by using a
  disposable email.** `routes/api.php:39` keys the login throttle
  (`throttle:30,1`) **per IP**, not per credential. Every Playwright worker
  shares one source IP, so a tripped limiter blocks *every* subsequent
  sign-in for the rest of that window — including other journeys' setup
  steps. Journey 12 runs in its own serial project, positioned so a tripped
  limiter cannot starve sign-ins the other 12 journeys depend on.
- **Semantic locators throughout**, per §14.3's own rule. This is unusually
  easy here: a repo-wide search for `data-testid` in `frontend/src` returns
  two hits, both inside one Skeleton unit test. Every interactive element in
  the app is already reachable by role and label — the direct dividend of
  the Phase 8a/8b accessibility work (`getByLabel("Email address")`,
  `getByRole("button", { name: "Sign in" })`, etc.).
- **Accessibility via `@axe-core/playwright`, deliberately non-duplicative of
  existing coverage.** All 19 workspaces already carry `vitest-axe` assertions
  in jsdom. The browser pass targets exactly what jsdom cannot see: real
  layout and focus order, 200% zoom, responsive breakpoints, and whether
  `prefers-reduced-motion: reduce` actually suppresses the Phase 8b `motion`
  library's JS-driven inline transforms — the existing CSS blanket rule
  can't reach those by construction (see ADR 0015 decision 3).

## Public Interfaces

### Package layout

```
e2e/
  package.json          # @playwright/test ^1.62, @axe-core/playwright
  tsconfig.json
  playwright.config.ts
  fixtures/
    auth.ts             # sign-in helper, per-role storageState or token injection
    api-client.ts        # arrange-via-API helper (bearer token, base URL)
    seed-identities.ts   # typed re-export of docs/testing/SEEDED_IDENTITIES.md's accounts
  tests/
    auth.spec.ts                  # journeys 1, 2
    authorization.spec.ts         # journeys 10, 15 (authorization half)
    validation-and-throttling.spec.ts  # journeys 11, 12
    faculty-availability.spec.ts  # journey 3
    scheduling-and-approval.spec.ts    # journeys 4, 5
    enrollment.spec.ts            # journey 6
    registrar-approval.spec.ts    # journey 7
    payment-and-com.spec.ts       # journey 8
    grade-submission.spec.ts      # journey 9
    withdrawal.spec.ts            # journey 13
    accessibility.spec.ts         # axe-core + reduced-motion + zoom sweep
```

### `playwright.config.ts` (key settings)

```ts
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "throttle-isolated", testMatch: /validation-and-throttling\.spec\.ts/, fullyParallel: false },
  ],
})
```

Exact retry/worker counts and whether a second browser project (WebKit/Firefox)
is worth the CI time are implementation-time decisions, not fixed here.

### Backend-under-test env

The suite needs the running `php artisan serve` to read `grc_enrollment_test`,
never the dev database. **Verified empirically** (not assumed): `php artisan
serve --host=127.0.0.1 --port=8001 --env=testing` correctly routes every
request to `grc_enrollment_test`. Confirmed by starting a throwaway server on
a spare port, logging in with a seeded identity against it (401, database
empty) and against the real dev server on 8000 (200, same credentials,
dev DB), then seeding the test database and repeating the login against the
test-env server (200, a different row id than the dev DB's). Mechanism: the
`--env` flag makes `artisan serve`'s own bootstrap load `.env.testing` via
Dotenv, which sets `APP_ENV=testing` as a real process environment variable;
`ServeCommand`'s passthrough whitelist (which includes `APP_ENV`) then carries
that into the spawned PHP dev-server subprocess, so every HTTP request's
fresh Laravel bootstrap picks it up and loads `.env.testing` too. No
`.env.e2e` or manual `APP_ENV` export needed — `--env=testing` alone is
sufficient.

## Non-goals

- **§14.4 security verification and §14.5 performance verification** — a
  later slice. §14.5 has no numeric targets anywhere in the PRD ("Define
  target values during architecture validation and pilot baselining"); that
  work means recording measured `EXPLAIN ANALYZE` baselines, not asserting
  invented thresholds.
- **§12.6 profile/password/help features** — need new Laravel endpoints
  (password change with current-password re-verification); "permitted
  profile fields" is an undefined institutional value. Password *reset* is
  separately blocked on PRD §17; authenticated password *change* is not, but
  neither exists yet.
- **Journey #14** (prediction-service failure) and the content half of
  journey #15 (compliance report output) — blocked as described above.
- **Phase 7c dashboards** — still blocked on institutional content.
- **Wiring the `e2e` job into required branch-protection status checks** — a
  GitHub repository setting, left for the user, matching ADR 0012's identical
  deferral for the original four CI jobs.
