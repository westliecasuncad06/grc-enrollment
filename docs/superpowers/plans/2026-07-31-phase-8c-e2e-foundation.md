# Phase 8c — Playwright E2E Foundation Implementation Plan

**Goal:** Fill the pre-reserved `e2e/` slot with a working Playwright suite
covering 13 of PRD §14.3's 15 critical journeys against the real Next.js
frontend, real Laravel API, and an isolated MariaDB test database — closing
the twice-deferred manual WCAG/visual-verification gap along the way via
`@axe-core/playwright`.

**Architecture:** `e2e/` as its own root-level npm package (settled by the
pre-existing `/e2e/node_modules/` gitignore entry). Single run-scoped
`migrate:fresh --seed` reset, not per-test. Causally dependent journeys
arrange their own preconditions over the API rather than replaying another
journey's UI. Journey 12 (throttle) isolated in its own serial project because
the login limiter is keyed per IP, not per credential.

**Tech Stack:** `@playwright/test` 1.62.x (pinned by
`docs/architecture/version-compatibility.md`), `@axe-core/playwright`,
TypeScript, against the existing Next.js 16 / Laravel 12 / MariaDB 10.4 stack.

## Global Constraints

- No backend or frontend *application* source changes — this phase only adds
  test infrastructure, plus the one README correction Task 6 depends on.
- No schema-wildcard `GRANT` statements anywhere in setup tooling (see
  `docs/runbooks/mariadb-local.md`) — `migrate:fresh` itself is safe and
  already the documented reset pattern; only wildcard GRANTs are the proven
  crash trigger.
- Semantic locators first (`getByRole`/`getByLabel`), per §14.3.
- No arbitrary sleeps; capture trace + screenshot on failure.
- Never production credentials or data — seeded `*.seed@grc.test` identities
  only, shared password `password`.
- Update `PROGRESS.md` after each completed task; never record a check as
  passed unless it actually ran.
- Do not commit, merge, or push unless explicitly asked.

---

## File Structure

| Area | Responsibility |
|---|---|
| `e2e/package.json`, `e2e/tsconfig.json` | New root-level npm package for the suite. |
| `e2e/playwright.config.ts` | baseURL, trace/screenshot policy, reporter, project split (main + throttle-isolated). |
| `e2e/fixtures/auth.ts` | Per-role sign-in helper. |
| `e2e/fixtures/api-client.ts` | Bearer-token API client for arranging preconditions. |
| `e2e/fixtures/seed-identities.ts` | Typed re-export of the 9 role + 3 scenario seeded accounts. |
| `e2e/tests/*.spec.ts` | One file per journey group (see spec's Public Interfaces). |
| `.github/workflows/ci.yml` | New `e2e` job. |
| `docs/adr/0016-*.md` | E2E architecture decisions. |
| `PROGRESS.md`, `docs/architecture/version-compatibility.md`, `README.md` | Reconciliation. |

---

## Task 1 — `e2e/` package and Playwright config

Create the package: `package.json` pinning `@playwright/test` to the 1.62.x
line already committed to in `version-compatibility.md`, plus
`@axe-core/playwright`; `tsconfig.json`; `playwright.config.ts` per the spec's
sketch. Verify `npx playwright install --with-deps chromium` succeeds locally
before writing a single test.

**Verify:** `npx playwright test --list` runs against an empty `tests/`
without error (proves config parses and browsers are installed).

## Task 2 — Stack orchestration and state reset

1. **Done and verified.** `php artisan serve --env=testing` correctly routes
   every request to `grc_enrollment_test`, confirmed empirically against a
   throwaway server on a spare port (login 401 against the empty test DB,
   200 against the dev server on the same credentials, then 200 against the
   test-env server after seeding, with a different row id proving a
   different database). No `.env.e2e` fallback needed. See the spec's
   "Backend-under-test env" section for the full trace.

   **Process-management lesson from this verification, worth carrying
   forward:** when starting a throwaway server on a non-standard port
   alongside already-running dev servers, re-`netstat` for the actual PID
   bound to *that* port immediately before killing anything — a stale PID
   captured earlier (e.g. from a snapshot taken before the throwaway server
   started) can belong to a different, already-running process. This is
   exactly how the dev backend on port 8000 got killed by accident this
   session; it was caught and restarted within about a minute, but the CI/
   local orchestration script this task produces must not repeat the
   mistake — it should target processes by the port it itself started them
   on, captured from its own launch, never by re-deriving a PID from an
   earlier unrelated `netstat` call.
2. Write a small orchestration script (`e2e/scripts/reset-db.ps1` or an npm
   script calling `php artisan migrate:fresh --seed --env=testing`) that runs
   once before the suite, not per test.
3. Add `e2e/fixtures/api-client.ts`: a thin wrapper posting to
   `/api/v1/auth/login` and attaching the returned bearer token to subsequent
   requests, used both for per-test sign-in and for API-arranged
   preconditions (creating a schedule proposal, submitting an enrollment,
   etc.) ahead of a journey that starts mid-workflow.

**Verify:** a throwaway smoke spec signs in as `student.seed@grc.test`,
hits an authenticated route, and gets a 200 — proves the whole chain (server
env, seeded data, token auth) end-to-end before building the 13 real specs on
top of it.

## Task 3 — The 13 testable journeys

Write `e2e/tests/*.spec.ts` per the spec's file list. For each:

- **auth.spec.ts** (1, 2) — sign in with a seeded identity, confirm token
  persists across reload; hit a protected route unauthenticated, confirm
  redirect to `/login`.
- **authorization.spec.ts** (10, 15-partial) — cross-role access denial (e.g.
  a Student hitting a Faculty-only route/page); non-Registrar-Head roles
  denied `compliance-reports`.
- **validation-and-throttling.spec.ts** (11, 12) — a form submission with bad
  input renders the error against the correct field; repeated failed logins
  trip `throttle:30,1` and surface a rate-limit message. This file runs in
  the `throttle-isolated` project, positioned so a tripped limiter can't
  starve the other specs' sign-ins.
- **faculty-availability.spec.ts** (3) — Faculty submits availability.
- **scheduling-and-approval.spec.ts** (4, 5) — Program Chair creates a
  section and submits a schedule proposal (API-arranged prerequisite state
  where needed); Dean then Executive Director approve it.
- **enrollment.spec.ts** (6) — Student views eligible subjects, selects
  sections, submits enrollment.
- **registrar-approval.spec.ts** (7) — arrange a submitted enrollment over
  the API, Registrar approves it.
- **payment-and-com.spec.ts** (8) — arrange an approved enrollment, Accounting
  confirms payment, Digital COM becomes available.
- **grade-submission.spec.ts** (9) — Professor submits a grade.
- **withdrawal.spec.ts** (13) — submit the same withdrawal request twice,
  confirm the second call is a no-op (idempotency), not a duplicate side
  effect.

Journey #14 gets a `test.skip()` with a comment citing the dormant ml-service
and `AGENTS.md`'s Phase-9 boundary, not silent omission.

**Verify:** full `npx playwright test` run green locally, `--repeat-each=2`
on at least the throttle and withdrawal specs to catch order-dependent
flakiness before it reaches CI.

## Task 4 — Accessibility integration

`e2e/tests/accessibility.spec.ts`: `@axe-core/playwright`'s
`AxeBuilder` against the landing page, login page, portal overview, and a
representative connected workspace (Eligible Subjects — the page from the
original screenshot). Add a `prefers-reduced-motion: reduce` emulated-media
run confirming Phase 8b's `motion`-library transforms are actually suppressed
(not just the CSS ones), and a 200%-zoom viewport pass on the same pages.

**Verify:** zero critical/serious axe violations, or each recorded finding
triaged honestly (fixed here if trivial, or logged to `PROGRESS.md`'s Known
Issues if it's a pre-existing defect outside this phase's scope — not
silently suppressed).

## Task 5 — CI job

New `e2e` job in `.github/workflows/ci.yml`, composing:
- The `backend` job's `mariadb:10.4` service container + `.env`/`.env.testing`
  rewrite step (reused, not duplicated logic — extract to a composite step if
  the duplication gets unwieldy).
- The `frontend` job's Node 24 setup.
- `npx playwright install --with-deps` in `e2e/`.
- Start both servers (`php artisan serve` in background, `npm run dev` or a
  production build + `next start` in background — prefer the production
  build for CI stability), wait for health, then `npx playwright test`.
- Upload the HTML report and any trace/screenshot artifacts on failure.

**Verify:** the job must actually run green on GitHub at least once — per
ADR 0012, a workflow is only proven by running, not by local reasoning about
the YAML.

## Task 6 — Docs

**ADR 0016 — E2E architecture**: why `e2e/` as its own root package, run-scoped
reset over per-test reset (and why that's still safe against the documented
MariaDB crash history), API-arranged preconditions over UI-chained setup, the
throttle-isolation decision, and the deferred/partial journey record (#14,
#15).

**`README.md`**: correct line 84 ("React SPA") and line 90
(`npm run dev -- --host=localhost --port=5173`) — stale Vite instructions that
contradict line 47's already-correct "port 3000." The E2E `baseURL` has to
commit to one port, so this can't be left for the next reader to trip over.

**`docs/architecture/version-compatibility.md`**: update the Playwright row —
"when E2E begins" note becomes a real version/status record.

**`PROGRESS.md`**: new Phase 8c section following the Phase 8a/8b pattern —
Verified Completed, Files Changed, Commands and Tests Run, Technical
Decisions, Known Issues update (the WCAG gap finally closes here), roadmap
label update.

---

## Verification

Nothing recorded as passing unless it actually ran (`AGENTS.md`).

- E2E suite green locally against both real servers and the isolated test DB.
- Frontend gate (format/lint/lint:fast/typecheck/`vitest`/build/audit)
  unchanged and green — 8c adds no application source changes.
- Backend `composer test` unchanged at 641/641 — same reason.
- New `e2e` CI job runs green on GitHub at least once.
- Accessibility findings from Task 4 reported honestly, whatever they are.

## Commits

Per `AGENTS.md`, nothing is committed, merged, or pushed without an explicit
request (Phase 8b's commit/merge/push was already explicitly requested and is
complete; Phase 8c starts a new branch and needs its own explicit go-ahead
before landing).
