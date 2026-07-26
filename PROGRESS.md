# GRC Enrollment System — Development Progress

**Last updated:** 2026-07-26 23:01 +08:00
**Current branch:** `main`, locally merged, verified, and worktree-cleaned
**Current PRD version:** v3.1  
**Current phase:** Phase 0 — Discovery, Policy Confirmation, and Foundations  
**Completed slice:** Phase 0A — Contract-first runnable service shells  
**Overall status:** Phase 0A complete locally; Phase 0 remains in progress

## Source Documents Reviewed

- [x] `AGENTS.md`
- [x] `PRD.md` in full (1,707 lines)
- [x] `README.md`
- [x] Current backend, frontend, prediction-service, documentation, and tests

## Current Objective

Preserve the verified demo-first landing, login, all-role credential
documentation, and role portal slice on local `main` while preparing the real
MySQL/Sanctum identity foundation.

## Completed

- Established the canonical project record.
  - `PRD.md` and the supplied `PRD(1).md` remain byte-identical with SHA-256
    `E180797A70A5CE5CB8B32CED3F753608702A889EF5695F94C35D8DDFD2C10CD2`.
  - Created `AGENTS.md`, this progress record, root documentation, ignore rules,
    and local Git metadata on `main`.
- Audited the workstation and selected a documented compatibility bridge.
  - Local: PHP 8.2.12, Composer 2.9.2, Node 24.14.1, npm 11.11.0,
    Python 3.14.3/3.11.9, MariaDB 10.4.32, and no Docker.
  - Target versions and upgrade triggers are in
    `docs/architecture/version-compatibility.md`.
  - Laravel 12.64 is the temporary PHP 8.2-compatible bridge; it is not the
    final production-platform decision.
- Implemented the database-independent Laravel API shell.
  - Public `GET /api/v1/health` with an exact API Resource envelope.
  - Safe error envelopes, validated/generated request IDs, no-store responses,
    explicit credentialless CORS, and a 60-request/minute health throttle.
  - API-only route inventory: `GET|HEAD api/v1/health`; generated local storage
    serving routes are disabled.
  - No user model, database behavior, migrations, authentication, or business
    policy was introduced.
- Implemented the React/strict-TypeScript frontend shell.
  - Distinctive GRC registrar-ledger service-readiness page using reviewed
    shadcn sources, Tailwind CSS, Lucide icons, and locally bundled fonts.
  - Fetch is isolated to the API service, uses `credentials: "omit"` and
    `cache: "no-store"`, and never contacts the ML service.
  - TanStack Query loading, success, connection, HTTP, configuration, contract,
    and retry states.
  - Strict Zod schemas reject undeclared success and error-envelope fields.
  - Semantic landmarks, skip-link focus, visible focus, reduced motion,
    responsive layouts, and accessible live status text.
- Implemented the private FastAPI prediction-service shell.
  - Private `GET /internal/v1/health`; no CORS, model, prediction endpoint,
    training data, or student data.
  - Safe 404/405/422/500 envelopes with aligned request-ID/no-store headers and
    preserved protocol headers such as `Allow`.
- Added Phase 0 architecture and contract documentation.
  - ADRs `0001`–`0006` cover service boundaries, the Laravel runtime bridge,
    bearer authentication, the private prediction bridge, document generation,
    and artifact storage.
  - `docs/api/openapi.yaml` and `docs/api/error-contract.md` define the current
    public contract.
- Completed an independent foundation/security review.
  - No critical/high issue, committed secret, personal data, or production data
    was found.
  - All three medium findings were corrected and regression-tested.
  - Actionable low gaps for throttling, CORS preflight, exact schemas, route
    exposure, and lockfile wording were corrected.

## In Progress and Deferred

- The user-approved landing, login, documented synthetic test accounts, and
  role-correct portal design is implemented in the isolated feature worktree.
  The complete design
  is at
  `docs/superpowers/specs/2026-07-26-landing-login-demo-portal-design.md`;
  its status now records approval for implementation planning.
- The detailed ten-task red-green-refactor plan is complete at
  `docs/superpowers/plans/2026-07-26-landing-login-demo-portal.md`. It defines
  exact files, interfaces, narrow failure/pass commands, all-nine-role
  credential synchronization, safe routing, demo-session isolation,
  production disablement, portal navigation, static boundary scans, browser QA,
  the full frontend gate, and continuous `PROGRESS.md` checkpoints.
- The user selected inline execution. The executing-plans workflow confirmed
  consent to create an isolated feature worktree. The worktree is ready at
  `.worktrees/landing-login-demo-portal` on
  `feat/landing-login-demo-portal`; hash checks confirmed that `PROGRESS.md`,
  the approved design, and the implementation plan were transferred
  byte-for-byte.
- The isolated frontend baseline is verified: `npm ci --ignore-scripts`
  installed 339 packages with 0 vulnerabilities, and `npm test` passed the
  existing 3 files/9 tests.
- Task 1 is complete through red-green verification. The missing auth-mode
  module produced the expected failing test; the production-safe selector now
  passes 4 focused tests, strict TypeScript passes, and the dependency audit
  reports 0 vulnerabilities after installing `react-router@8.3.0` and
  `@hookform/resolvers@5.5.7`.
- Task 2 is complete. Current shadcn and official component documentation were
  reviewed; dry runs exposed existing Button/Separator overwrites, so both
  repository files were preserved while Input, Field, Sheet, Empty, Avatar,
  and the required Label source were added. Format, ESLint, Oxlint, strict
  TypeScript, and audit all pass.
- Task 3 is complete. Exact typed fixtures and
  `docs/testing/DEMO_CREDENTIALS.md` now cover all nine PRD roles with the
  shared local-demo password and explicit safety/testing instructions. The
  fixture/document contract, auth-mode contract, formatting, and strict
  TypeScript pass (2 files/7 focused tests).
- Task 4 is complete. The demo/disabled gateways, strict Zod session store,
  browser-storage adapter, auth provider, and production wiring are
  implemented. Five auth files/25 tests pass along with formatting, ESLint,
  Oxlint, and strict TypeScript. The storage scan finds `sessionStorage` only in
  `demo-session-store.ts`.
- Task 5 safe routing/guards is complete. Its known-module return-path
  contract requires the role-capability catalog that was originally scheduled
  in Task 8, so the catalog's TDD subtask was pulled forward. The exact
  nine-role matrix, 23-case safe return parser, protected/public guards,
  corruption cleanup, anonymous/authenticated redirects, and branded
  not-found route now pass 3 files/34 focused tests. Formatting, ESLint,
  Oxlint, and strict TypeScript pass. Task 8 still owns the portal shell and
  overview UI.
- Task 6 institutional landing page and embedded public-readiness work is in
  complete using the approved registrar-ledger visual direction. The public
  header/footer, hero, three audience pathways, four-stage journey, and
  extracted readiness component preserve the existing health loading, success,
  connection failure, and retry states. Three page/route files/15 focused tests
  pass with formatting, ESLint, Oxlint, and strict TypeScript.
- Task 7 is complete. The split institutional login, React Hook Form/Zod
  validation, focused error summary, password visibility, generic credential
  failure, pending state, safe/unsafe return handling, and disabled-production
  state pass 2 files/16 login/router tests. Formatting, ESLint, Oxlint, and
  strict TypeScript pass.
- Task 8 is complete. The responsive desktop/mobile shell, accessible Sheet,
  exact role navigation for all nine identities, profile context, disabled
  preview controls, persistence warning, sign-out flow, demo boundary,
  disconnected-term/API states, and role-filtered module cards pass 2 files/16
  focused tests. Formatting, ESLint, Oxlint, and strict TypeScript pass.
- Task 9 is complete. All catalog-assigned module routes render their exact
  role-owned label and description in an accessible Empty preview state. Unknown
  and cross-role module IDs render a scoped portal not-found state without
  foreign navigation/content, direct protected URLs return through login, and
  the overview action remains inside the signed-in role. Two files/52 focused
  tests, formatting, ESLint, Oxlint, and strict TypeScript pass.
- Task 10 documentation and static boundary review are complete. The frontend
  README now documents all route classes, `VITE_AUTH_MODE=demo`, the all-role
  credential guide, production disablement, client-fixture limits, source/test
  layout, and the Sanctum replacement path. Reviewed scans confirm
  `sessionStorage` only in `demo-session-store.ts`, the only raw `fetch(` in
  `api-client.ts`, and no bearer/fake-token/ML endpoint or unfinished-marker
  matches in delivered frontend/testing content.
- Task 10's complete frontend gate passes: Prettier, ESLint, Oxlint, strict
  TypeScript, 16 Vitest files/140 tests, and the Vite production build all exit
  successfully; `npm audit --audit-level=moderate` reports 0 vulnerabilities.
  A fresh completion rerun again passed all 16 files/140 tests.
- The local `main` fast-forward to `292e3c4` is independently verified after a
  clean locked-dependency install: Prettier, ESLint, Oxlint, strict TypeScript,
  16 Vitest files/140 tests, Vite production build, and the moderate-level
  dependency audit all pass; the audit reports 0 vulnerabilities.
- Local integration cleanup is complete: the verified feature worktree was
  removed and `feat/landing-login-demo-portal` was deleted after its commit
  became reachable from `main`. The earlier root-only records remain
  recoverable in the named `pre-merge root progress backup 2026-07-26` stash.
- Browser visual/interaction QA remains an explicit gap. The app started
  successfully on `http://127.0.0.1:5174`, but the supported browser discovery
  and recovery flow returned an empty browser list. The temporary server was
  stopped and port 5174 was verified closed; no visual, zoom, reduced-motion,
  or live keyboard QA pass is claimed.
- Planning-time package metadata confirmed that `react-router@8.3.0` supports
  the installed Node/React baseline and that `@hookform/resolvers@5.5.7`
  supports the installed React Hook Form and Zod versions. Current shadcn
  metadata confirms a Vite, strict-TypeScript, Tailwind 4, non-RSC
  `radix-nova` project. No dependency was installed during planning.
- Design-spec self-review passed: no `TBD`/`TODO`/`FIXME` flags, nine unique
  `.test` credential emails, and the approved shared synthetic password is
  present. The review separated gateway validation from session persistence and
  removed ambiguous demo-expiration wording.
- Phase 0 overall remains open.
- MySQL connection, reversible base migrations, deterministic role seeders,
  migration rollback/fresh verification, and database integration tests are
  waiting on MySQL 8.4 LTS.
- CI is not configured or executed yet. All intended local quality gates pass,
  but that is not a substitute for a remote pipeline.
- Authentication, Sanctum bearer tokens, role policies, institutional
  workflows, and business endpoints belong to later complete vertical slices.
- Interactive browser visual QA was attempted, but the available-browser list
  was empty. No screenshot or interactive-browser pass is claimed.

## Next Exact Actions

1. Re-run the documented browser visual/interaction matrix when a connected
   browser becomes available.
2. Provision a least-privileged MySQL 8.4 LTS development database before
   implementing real Sanctum login, users, role seeders, or credential testing.
3. Update PHP to a current supported patch and re-evaluate the documented
   Laravel 13 upgrade trigger before locking the production framework baseline.

## PRD Phase Checklist

- [ ] Repository and environment foundation
  - [x] Canonical `PRD.md`, `AGENTS.md`, and `PROGRESS.md`.
  - [x] Local Git repository and ignore rules.
  - [x] Repository/runtime audit and version-compatibility record.
  - [x] Safe service `.env.example` files.
  - [x] Independently runnable frontend, API, and prediction-service shells.
  - [x] Shared API error contract and OpenAPI document.
  - [x] Database-independent local quality gates and dependency audits.
  - [ ] Supported MySQL connection and reversible base migrations.
  - [ ] Deterministic role seeders.
  - [ ] CI quality checks.
- [ ] Authentication and RBAC
- [ ] Pre-enrollment schedules
- [ ] Enrollment and digital advising
- [ ] Final approvals, payment queue, and COM
- [ ] Predictive analytics and reporting
- [ ] Cross-cutting UI, notifications, accessibility, and security
- [ ] Testing and ISO/IEC 25010 evaluation support
- [ ] Deployment and handoff documentation

## API and Backend Status

- Implemented endpoint: public, database-independent
  `GET /api/v1/health`.
- Route middleware: API group plus `throttle:60,1`.
- Pending endpoints: every business endpoint group in PRD §8.4.
- Form Requests: none; Phase 0A accepts no application input.
- Policies: none; authentication/RBAC has not started.
- API Resources: `HealthResource`.
- Actions/Services: none; no Phase 0A business use case exists.
- Transactions and idempotency: not applicable yet.
- Security present: correlation IDs, safe exception rendering, no-store,
  credentialless CORS allowlist/preflight behavior, and health throttling.
- Security pending: Sanctum bearer authentication, authorization policies,
  business rate limiters, audit events, and infrastructure controls.

## Frontend Status

- Pages: institutional landing, service readiness, local-demo login, role-aware
  portal overview, catalog-authorized module preview/denial, and branded
  not-found route.
- Components: public and portal shells plus reviewed shadcn Alert, Avatar,
  Badge, Button, Card, Empty, Field, Input, Label, Separator, Sheet, and
  Skeleton sources.
- Data layer: typed API client, strict Zod success/error parsing, TanStack Query
  client and health hook.
- Forms: React Hook Form/Zod local-demo login with generic credential errors,
  summary focus, pending state, and password visibility.
- States: loading, success, connection, HTTP, configuration, contract, and retry.
- Boundary: source scan confirms the sole browser `fetch` call is in
  `src/app/services/api-client.ts`; no ML URL/call is present.
- Accessibility/responsiveness: source and component tests pass; interactive
  browser visual QA remains unverified because no browser session was available.
- Router status: patched `react-router@8.3.0` now provides public, anonymous,
  protected, safe-return, all-role portal, module-preview, and not-found routes.

## Database and Migrations

- Applied migrations: none.
- Pending first schema slice: PRD §10.1 identity/organization base tables.
- Seeders/factories: none.
- Local database warning: `C:\xampp\mysql` is MariaDB 10.4.32, not the required
  MySQL 8 LTS, and no database listener is active.
- Rollback status: not applicable because no database change was made.

## Predictive Analytics Status

- Data preparation, training, inference, model artifacts, and metrics: not
  started.
- Implemented boundary: versioned internal FastAPI liveness only.
- Failure fallback: no prediction endpoint exists yet.
- Privacy: no student/model data and no CORS; the browser cannot reach this
  service through application code.
- Pending infrastructure: enforce private network reachability before a
  prediction endpoint is deployed.

## Tests and Verification

| Check | Command | Result | Last Run |
|---|---|---|---|
| Backend manifest | `composer validate --strict` | Passed | 2026-07-26 |
| Backend format | `composer format:check` | Passed | 2026-07-26 |
| Backend static analysis | `composer analyse` | Passed: Larastan/PHPStan level 8, 14 files | 2026-07-26 |
| Backend tests | `composer test` | Passed: 11 tests, 61 assertions | 2026-07-26 |
| Backend platform | `composer check-platform-reqs` | Passed | 2026-07-26 |
| Backend lock install | `composer install --dry-run --no-scripts --no-interaction` | Passed: nothing to install/update/remove | 2026-07-26 |
| Backend dependency audit | `composer audit --locked --no-interaction` | Passed: no vulnerability advisories | 2026-07-26 |
| Backend routes | `php artisan route:list --json` | Passed: only `GET\|HEAD api/v1/health`, with throttle | 2026-07-26 |
| Frontend clean install | `npm ci --ignore-scripts` | Passed: 339 packages installed, 340 audited, 0 vulnerabilities | 2026-07-26 |
| Frontend format | `npm run format:check` | Passed | 2026-07-26 |
| Frontend ESLint | `npm run lint` | Passed, zero warnings | 2026-07-26 |
| Frontend fast lint | `npm run lint:fast` | Passed | 2026-07-26 |
| TypeScript | `npm run typecheck` | Passed: strict project build | 2026-07-26 |
| Frontend tests | `npm test` | Passed: 3 files, 9 tests | 2026-07-26 |
| Frontend build | `npm run build` | Passed: 2,028 modules; JS 341.20 kB/103.85 kB gzip | 2026-07-26 |
| Frontend audit | `npm audit --audit-level=moderate` | Passed: 0 vulnerabilities | 2026-07-26 |
| Integrated HTTP smoke | temporary Vite + Laravel servers | Passed: frontend/API 200, exact v1 identity, request ID, no-store, CORS | 2026-07-26 |
| Secret-pattern scan | filename-only `rg` scan excluding dependencies/requirements | Passed: 0 potential secret files | 2026-07-26 |
| Service cleanup | listener check for ports 5173, 8000, and 8100 | Passed: no listeners remain | 2026-07-26 |
| Interactive browser QA | browser-runtime discovery | Not run: no browser session available | 2026-07-26 |
| ML lint | `.venv\Scripts\python.exe -m ruff check .` | Passed | 2026-07-26 |
| ML format | `.venv\Scripts\python.exe -m ruff format --check .` | Passed: 6 files | 2026-07-26 |
| ML static analysis | `.venv\Scripts\python.exe -m mypy app` | Passed: 4 source files | 2026-07-26 |
| ML tests | `.venv\Scripts\python.exe -m pytest` | Passed: 6 tests | 2026-07-26 |
| ML dependency integrity | `.venv\Scripts\python.exe -m pip check` | Passed | 2026-07-26 |
| ML dependency audit | isolated `pip-audit 2.10.1 -r requirements.lock` | Passed: no known vulnerabilities | 2026-07-26 |
| ML HTTP smoke | temporary Uvicorn server | Passed: 200, exact internal v1 envelope and headers | 2026-07-26 |
| OpenAPI parse | PyYAML parse/assertions | Passed | 2026-07-26 |
| OpenAPI semantic lint | `npx --yes @redocly/cli@latest lint docs/api/openapi.yaml` | Passed: no warnings/errors | 2026-07-26 |

Never change a result to `Passed` unless that command actually ran
successfully.

## Decisions and Assumptions

| Date | Decision | Reason and PRD impact |
|---|---|---|
| 2026-07-26 | Canonicalize one byte-identical supplied Markdown PRD as `PRD.md`. | Provides the required source-of-truth path without changing requirements. |
| 2026-07-26 | Implement only a database-independent Phase 0A shell in this slice. | The repository started empty and the required MySQL environment is absent; no policy value was invented. |
| 2026-07-26 | Use Laravel 12.64 as a short-lived local bridge. | PHP 8.2.12 cannot run Laravel 13; production planning must upgrade PHP and re-evaluate. |
| 2026-07-26 | Use TypeScript 6.0.x, React 19, Vite 8, and Tailwind 4. | This is the current compatible strict-TypeScript toolchain recorded in the version matrix. |
| 2026-07-26 | Defer React Router. | The one-page shell needs no router, and reviewed React Router 7.18.1 carried an unfixed high RSC advisory. |
| 2026-07-26 | Keep the browser boundary at Laravel. | The SPA calls only `/api/v1`; the FastAPI service is private and advisory. |
| 2026-07-26 | Rate-limit public health at 60 requests/minute per Laravel throttle key. | Makes the documented 429 contract truthful without database state. Business routes need use-case-specific policies later. |
| 2026-07-26 | Mark licensing as pending authorized GRC approval. | The generated framework license was not adopted as the product's license. |
| 2026-07-26 | Use a modern registrar-ledger visual direction. | Provides a distinctive institutional Phase 0 surface without inventing workflow policy. |
| 2026-07-26 | Document synthetic demo credentials for all nine PRD roles. | The user needs to test every role portal; the file and UI must label them local-demo-only and never imply production authentication. |
| 2026-07-26 | Use React Router 8.3.0 in client-library mode for the demo routes. | The current patched release resolves the recorded RSC advisory; this SPA will not use RSC, server actions, or framework-mode packages. |
| 2026-07-26 | Enable synthetic authentication only in development/test modes. | Production builds may show the public landing page but must not accept committed demo credentials. |
| 2026-07-26 | Plan `react-router@8.3.0` and `@hookform/resolvers@5.5.7`. | Registry metadata confirms compatibility with Node 24, React 19.2.7, React Hook Form 7.83, and Zod 4.4; the plan retains client-library/non-RSC routing only. |

## Blockers and Clarifications Needed

### Supported database environment

- Blocker: XAMPP provides MariaDB 10.4.32, not MySQL 8.4 LTS; no database
  server/listener or Docker runtime is available.
- Impact: migrations, MySQL constraints, reversible migration checks, seeders,
  and database integration tests cannot be truthfully verified.
- Owner: development environment owner.
- Safe work meanwhile: contracts, documentation, database-independent tests,
  UI components, and private-service scaffolding.

### PHP production baseline

- Blocker: local PHP 8.2.12 is behind current supported patch levels and cannot
  run Laravel 13.
- Impact: the final production Laravel/PHP baseline cannot be locked.
- Owner: development environment owner.
- Safe work meanwhile: maintain the documented Laravel 12 compatibility bridge.

### Institutional policy values

- Blocker: the values listed as open decisions in PRD §17 remain unconfirmed.
- Impact: related workflows cannot hardcode those values or be declared
  production-complete.
- Owner: authorized GRC stakeholders for each policy domain.
- Safe work meanwhile: generic schema, configuration placeholders,
  authorization foundations, and synthetic tests.

### Visual verification

- Gap, not a product blocker: no in-app browser or Chrome session was available
  during Phase 0A verification.
- Impact: no screenshot, interactive focus traversal, or responsive visual pass
  is claimed.
- Next opportunity: rerun the readiness page at desktop and mobile widths when a
  browser session is connected.

## Failure and Recovery Record

- The first canonical-file patch was invalid, and the patch move then removed
  the redundant PRD copy; it was restored from the hash-verified canonical file.
- Initial runtime lookup could not find `mysql` on `PATH`; the explicit XAMPP
  audit found MariaDB 10.4.32 instead.
- The initial Laravel scaffold dependency lookup and several early Composer
  audits timed out against Packagist. Dependency installation recovered, and
  the final explicit locked audit passed with no advisories.
- Initial strict Composer validation rejected an exact framework constraint
  style; the supported `^12.64` constraint passes.
- An initial backend CORS test expected an absent header for a single configured
  origin. Live diagnosis showed the framework emits a fixed non-matching origin;
  coverage was corrected and later expanded to a two-origin allowlist,
  preflight, and rejected-origin behavior.
- The first ML Ruff run found import-order/format changes, and the original
  TestClient dependency emitted an upstream deprecation warning. The code was
  formatted and the current official test client installed; final checks pass.
- The first OpenAPI parse command had invalid PowerShell quoting. Two Redocly
  iterations then exposed missing public-security, 4xx, server, and license
  metadata. The final document parses and lints without warnings.
- The first frontend audit found a high React Router RSC advisory and a moderate
  transitive shadcn CLI advisory. Both unused runtime packages were removed;
  the final audit reports zero vulnerabilities.
- The first TypeScript 6 check rejected deprecated `baseUrl`; path aliases were
  retained without it and strict checking passes.
- Browser selection failed because no browser was available. Required
  troubleshooting confirmed the browser list was empty; no fallback browser
  claim was made.
- Final route inventory unexpectedly exposed generated local storage serve/upload
  routes. `filesystems.disks.local.serve` was disabled, and the rerun shows only
  the health route.
- The first listener-cleanup verification command had a PowerShell pipeline
  syntax error; the corrected command confirmed ports 5173, 8000, and 8100 were
  no longer listening.
- The first isolated Python-audit cleanup script was rejected before execution
  by command policy, and `pipx` was unavailable. A separate temporary venv
  completed the audit. Recursive cleanup of that verified temporary directory
  was also blocked, so the non-project tool environment remains under the user
  temp directory at `grc-pip-audit-20260726-1719`; no workspace file is affected.
- The first combined design-spec/progress patch failed atomically because one
  expected `PROGRESS.md` line did not match its wrapped form. No partial file was
  created; the specification and progress changes were reapplied as smaller
  exact patches.
- The first Task 2 source-review `rg` expression used lookahead without
  `--pcre2`; the corrected scan ran with PCRE2 and found no forbidden import,
  remote asset, or RSC directive after review.
- The isolated worktree's first format check flagged 44 files because global
  Git `core.autocrlf=true` checked tracked files out as CRLF while Prettier
  requires LF. Byte/line-ending evidence confirmed the root cause.
  `.gitattributes` now fixes the repository policy at LF (PDF remains binary);
  formatting was normalized and the rerun passes.
- The upstream generated Field source used `Array<T>`, which the repository
  ESLint policy forbids. It was changed to the equivalent `T[]`; ESLint and all
  other Task 2 checks now pass. Existing Button and Separator sources were not
  overwritten.
- The first credential-document test used `new URL(..., import.meta.url)`;
  Vite rewrote the static asset URL, so Node rejected the resulting non-file
  scheme. A raw import was also correctly denied because the document is above
  Vite's frontend root. The test now uses Node file access with a file-local
  Node type reference, preserving the browser project's restricted global type
  set; focused tests and typecheck pass.
- Running Vitest, TypeScript, and Prettier concurrently in the Windows worktree
  starved Vitest's two fork workers until their startup timeout. The same tests
  pass in 1.90 seconds when checks run sequentially, so resource-sensitive
  frontend checks will remain sequential for this worktree.
- Task 4's first ESLint run found seven integration-policy issues: unbound
  method destructuring in the probe, synchronous effect state updates, a
  component/hook Fast Refresh split, `async` functions without `await`, and an
  unused storage initialization. The provider now restores in a cancellable
  microtask, context/hook exports are separated, promise boundaries are
  explicit, and the browser store returns directly; focused tests and both
  linters pass.
- Strict TypeScript then rejected the gateway error's constructor parameter
  property under `erasableSyntaxOnly`. It now uses an explicit declared field
  and assignment; typecheck passes without relaxing configuration.
- Task 5's first lint pass rejected a control-character regular expression and
  mixed component/helper Fast Refresh files. The parser now checks Unicode code
  points explicitly, and the route location probe is isolated in its own
  component file; route tests and both linters pass.
- Task 7 tests found that React Hook Form's default field autofocus overrode the
  required error-summary focus and that the anonymous-only guard could redirect
  to `/portal` before the login page applied a safe module return path. The form
  now focuses its committed summary in an effect, and the guard uses the same
  safe return parser; all login and router tests pass.
- Task 8 tests found that clearing the demo session synchronously could let the
  protected-route guard redirect to login before the explicit home navigation
  settled. The sign-out handler now awaits navigation before clearing session
  state; its route and persistence assertions pass.
- Task 8's first quality command used the wrong local Oxlint script name
  (`lint:oxlint` instead of `lint:fast`) and the format check found two newly
  added test files. No application defect was hidden; the files are being
  normalized and the exact repository scripts will be used for the rerun.
- Task 9's first unknown-module assertion scanned the entire test document and
  saw the route only because the test-only location probe intentionally prints
  the current URL. The assertion now scopes the no-leak check to the rendered
  unavailable-module region; all 52 focused tests pass.
- Task 10's first raw-fetch scan passed an over-escaped regular expression to
  PowerShell and `rg` rejected the unclosed group. A fixed-string scan exposed
  one intentional `refetch()` name plus the raw call; a reviewed PCRE2
  identifier-boundary rerun confirms the sole raw browser `fetch(` remains in
  `src/app/services/api-client.ts`.
- The first post-merge `npm ci --ignore-scripts` on `main` stopped with Windows
  `EPERM` while replacing Rolldown's native binding. This indicates the existing
  binary is open by a local process. Two exact workspace Vite PIDs were found on
  ports 5173/5174, stopped, and both ports confirmed closed. The clean-install
  retry then passed.
- A post-merge command orchestrator yielded partial Vitest/build output without
  completion status and advanced conservatively. Those partial results were
  discarded; no related processes remained, and direct isolated reruns
  completed with 140/140 tests and a successful production build.

## Files Changed in the Current Session

- Root: `.gitignore`, `AGENTS.md`, `PRD.md`, restored `PRD(1).md`,
  `PROGRESS.md`, `README.md`, and local `.git/` metadata.
- Backend: Laravel API-only scaffold, configuration, request-ID middleware,
  health controller/resource, safe error support, tests, Composer lockfile,
  Larastan configuration, safe environment example, and README.
- Frontend: React/Vite/Tailwind scaffold, registrar-ledger page, shadcn source
  components, API/query/schema layers, tests, local fonts, Prettier/ESLint/
  Oxlint/TypeScript configuration, lockfile, safe environment example, and
  README.
- Prediction service: FastAPI shell, schemas, safe errors/middleware, tests,
  exact-version manifests, safe environment example, model placeholder, and
  README.
- Documentation: six ADRs, version-compatibility matrix, public OpenAPI
  document, and shared error contract.
- Current demo-portal session: approved specification and ten-task TDD plan
  under `docs/superpowers/`; nine-account credential guide under
  `docs/testing/`; React Router/auth/session/catalog layers; institutional
  landing and login; responsive all-role portal shell, overview, and module
  preview/denial states; focused and full regression coverage; continuously
  updated `PROGRESS.md`.
- Supplied artifact preserved unchanged: `Casuncad, Westlie.pdf`.

## Session Handoff Log

### 2026-07-26 16:19 +08:00

**Goal:** Establish mandatory continuity records and begin the Phase 0 audit.  
**Completed:** Repository/Git inspection, complete PRD review, duplicate hash verification, initial runtime audit, and continuity-file creation.  
**Not completed:** MySQL binary/service check, stable-version compatibility research, service scaffolding, and quality checks.  
**Tests run:** No application tests exist yet. Read-only repository and runtime checks only.  
**Known issues:** Git is not initialized; `mysql` is not on `PATH`; all PRD §17 institutional decisions remain open.  
**Next exact step:** Check `C:\xampp\mysql\bin\mysql.exe --version`, then document compatible stack versions before scaffolding the first service.

### 2026-07-26 17:33 +08:00

**Goal:** Audit the empty repository and implement the earliest safe PRD slice.  
**Completed:** Canonical repository records, version/architecture decisions,
three runnable Phase 0A shells, public/private health and error contracts,
security review corrections, automated quality gates, dependency audits, and
integrated HTTP smoke verification.  
**Not completed:** MySQL-backed schema, deterministic role seeders, CI,
authentication/RBAC, business workflows, or interactive browser visual QA.  
**Tests run:** Backend 11 tests/61 assertions; frontend 3 files/9 tests; ML 6
tests; all applicable format, lint, static-analysis, build, integrity,
dependency-audit, OpenAPI, and live HTTP checks listed above passed.  
**Known issues:** MySQL 8.4 LTS and a current PHP runtime are unavailable;
institutional PRD §17 values remain open; no browser session was connected.  
**Next exact step:** Provision a least-privileged MySQL 8.4 LTS development
database, then implement and verify reversible PRD §10.1 base migrations and the
nine-role deterministic seeder.

### 2026-07-26 18:41 +08:00

**Goal:** Design the requested landing page, login, all-role demo credentials,
and role-aware portal without misrepresenting frontend fixtures as real
authentication.
**Completed:** Current code/PRD review, approach comparison, user-approved
architecture, screen content, all-nine-role credential matrix, portal
navigation, demo-session boundaries, failure behavior, accessibility, and test
acceptance criteria. The written specification is
`docs/superpowers/specs/2026-07-26-landing-login-demo-portal-design.md`.
**Not completed:** Implementation plan, frontend implementation, real Laravel
authentication, MySQL users/seeders, or browser visual verification.
**Tests run:** No application code changed in this design stage, so application
tests were not rerun. The design self-check found zero placeholder flags,
exactly nine unique credential emails, and the required shared password.
**Known issues:** MySQL 8.4 and real Sanctum authentication remain blocked; the
design document is intentionally uncommitted because `AGENTS.md` prohibits
committing without explicit user authorization.
**Next exact step:** User reviews the written design, then a TDD implementation
plan is created.

### 2026-07-26 18:57 +08:00

**Goal:** Convert the approved landing/login/demo-portal design into an
executable red-green-refactor plan.
**Completed:** Verified planned dependency compatibility and current shadcn
configuration; advanced the approved design status; created and self-reviewed
the ten-task implementation plan at
`docs/superpowers/plans/2026-07-26-landing-login-demo-portal.md`. The plan
includes exact source/test/documentation files, all-nine-role credentials,
safe-route and storage boundaries, UI requirements, static scans, browser QA,
and the full frontend gate.
**Not completed:** Frontend implementation, dependency installation, demo
credential fixture/document creation, real Laravel authentication, MySQL
users/seeders, or browser visual verification.
**Tests run:** No application code or dependency changed in planning, so
application tests were not rerun. Plan inspection confirmed 10 task headings
and 1,050 lines; placeholder-scan matches were only the plan's explicit
prohibition and its future scan command.
**Known issues:** MySQL 8.4 and real Sanctum authentication remain blocked; no
browser session is currently known to be available; implementation remains
uncommitted because `AGENTS.md` prohibits commits without explicit user
authorization.
**Next exact step:** Select the execution workflow, then begin Task 1 with a
failing auth-mode test and exact dependency installation.

### 2026-07-26 22:42 +08:00

**Goal:** Execute the approved landing/login/demo-portal plan and provide
testable credentials for every user role.
**Completed:** All ten tasks through TDD; production-safe demo-mode selection;
nine synchronized synthetic accounts and `docs/testing/DEMO_CREDENTIALS.md`;
strict session persistence; safe return paths and route guards; institutional
landing, login, responsive all-role portal, role catalog, overview cards,
module previews, scoped denial states, operator documentation, and reviewed
static safety boundaries.
**Not completed:** Real Laravel/Sanctum authentication, MySQL users/role
seeders, backend authorization policies, business workflow APIs, CI, or
interactive visual/browser QA. No commit, push, merge, or pull request was
created.
**Tests run:** Final frontend gate passed Prettier, ESLint, Oxlint, strict
TypeScript, 16 Vitest files/140 tests, Vite production build, and audit with 0
vulnerabilities. A fresh completion rerun again passed 16 files/140 tests.
**Known issues:** Browser discovery returned no available browser, so mobile,
wide-screen, keyboard, zoom, and reduced-motion visual QA remain unverified.
MySQL 8.4, real Sanctum authentication/authorization, institutional policy
values, and CI remain deferred.
**Next exact step:** Choose the feature-branch integration option, then
provision the supported MySQL 8.4 identity baseline before implementing the
real Sanctum vertical slice.

### 2026-07-26 23:01 +08:00

**Goal:** Merge the completed demo-portal feature back to local `main`.
**Completed:** Created local feature commit `292e3c4`, preserved the earlier
root records in a named stash, fast-forwarded `main`, completed the full merged
frontend gate, removed the verified feature worktree, and deleted the merged
feature branch.
**Not completed:** No push or pull request was created. Real MySQL/Sanctum
authentication, server authorization, business workflow APIs, CI, and
interactive browser visual QA remain deferred.
**Tests run:** On merged `main`, `npm ci --ignore-scripts` completed with 0
vulnerabilities; Prettier, ESLint, Oxlint, strict TypeScript, 16 Vitest
files/140 tests, Vite production build, and the moderate-level dependency audit
all passed.
**Known issues:** The first clean install was blocked by two verified workspace
Vite processes holding the native Rolldown binary; both processes were stopped,
ports 5173/5174 confirmed closed, and the retry passed. Browser discovery still
returns no available browser.
**Next exact step:** Re-run browser QA when available, then provision the
supported MySQL 8.4 identity baseline before the real Sanctum vertical slice.
