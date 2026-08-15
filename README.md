# GRC Automated Enrollment System

Secure, API-first enrollment platform for Global Reciprocal Colleges, implemented from [`PRD.md`](PRD.md). The product uses a React and strict TypeScript single-page application, a versioned Laravel REST API, MySQL 8 LTS, and a private Python prediction service.

## Current Status

Phase 0A's database-independent contract-first shells are implemented and
locally verified. On top of that, the identity foundation and a real Sanctum
bearer-token vertical slice are implemented against the existing XAMPP
MariaDB 10.4.32 instance (accepted as the local development substitute for
the PRD's MySQL 8 LTS requirement — see
[ADR 0007](docs/adr/0007-mariadb-development-database.md)): reversible
migrations for `users`/`programs`/`academic_terms`/`personal_access_tokens`,
a deterministic nine-role seeder, and `POST /api/v1/auth/login`,
`POST /api/v1/auth/logout`, `GET /api/v1/auth/me`. Phase 0 remains in
progress: CI execution, authorization Policies beyond role-filtered
navigation, business workflow endpoints, and institutional policy
confirmations are not part of this slice.

See [`PROGRESS.md`](PROGRESS.md) for the exact implementation state, real test results, blockers, and resume steps.

## Source of Truth

Read these files before making changes:

1. [`AGENTS.md`](AGENTS.md)
2. [`PRD.md`](PRD.md)
3. [`PROGRESS.md`](PROGRESS.md)
4. This README

Do not infer institutional values listed as open decisions in PRD §17.

## Target Architecture

```text
frontend/     Next.js (App Router) + React + strict TypeScript
backend/      Laravel REST API under /api/v1
ml-service/   Private Python prediction service
docs/         ADRs, API contract, data dictionary, and runbooks
e2e/          Playwright journeys against the integrated stack
```

Next.js is used **client-rendered only** (PRD v3.2, [ADR 0013](docs/adr/0013-nextjs-presentation-layer.md)): no server session, no server-side rendering of authorized student data, and no proxying of the Laravel API. It provides routing and the build pipeline, not a second server.

The frontend and API remain independently deployable. Browser requests use bearer tokens; session-cookie and CSRF-cookie authentication are out of scope. Because the token lives in `localStorage`, Next.js middleware cannot read it — route guards are client-side, and Laravel Policies remain the authoritative check on every request. The browser must not call the prediction service directly.

Local development runs the frontend on port 3000 (`npm run dev`) and the API on 8000 (`php artisan serve`).

## Environment Baseline

The initial workstation audit found:

- PHP 8.2.12 and Composer 2.9.2
- Node.js 24.14.1 and npm 11.11.0
- Python 3.14.3 and Python 3.11.9
- XAMPP MariaDB 10.4.32
- no Docker installation

Per [ADR 0007](docs/adr/0007-mariadb-development-database.md), this MariaDB
instance is now used directly for local development and MariaDB-backed
integration tests, in place of the PRD-required MySQL 8 LTS — a deliberate
deviation accepted for local development only, to be revisited before any
production-like deployment. See
[`docs/runbooks/mariadb-local.md`](docs/runbooks/mariadb-local.md) for setup,
including a known instability issue in this specific MariaDB installation
that must be read before granting any database privilege. PHP must also be
updated to a current security patch before production-like use.

## Setup

Complete the one-time setup for each service below. Safe examples may be copied
to local `.env` files, but local environment files must never be committed.

For integrated local work, including schedule generation, use the recommended
launcher from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
```

It reuses a healthy private prediction service or starts it on loopback, then
starts the API at `http://127.0.0.1:8000` and frontend at
`http://127.0.0.1:3000`. It never replaces an existing process: an occupied API
or frontend port stops the launcher with its owning process ID. Child-process
output is written under ignored `artifacts/local-dev/`. To repair only the ML
service when the API and frontend are already running, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1 -PredictionOnly
```

For manual diagnosis, the three services remain independently runnable:

Laravel API:

```powershell
Set-Location backend
composer install
Copy-Item .env.example .env
php artisan key:generate
php artisan serve --host=127.0.0.1 --port=8000
```

Next.js frontend:

```powershell
Set-Location frontend
npm ci
Copy-Item .env.example .env.local
npm run dev
```

`next dev` serves on port 3000 by default, matching `CORS_ALLOWED_ORIGINS` above — do not pass `--port=5173`, a leftover from the pre-Next.js Vite SPA (ADR 0013).

Private prediction service:

```powershell
Set-Location ml-service
py -3.14 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host=127.0.0.1 --port=8100
```

The public liveness contract is `GET http://127.0.0.1:8000/api/v1/health`;
the private liveness contract is
`GET http://127.0.0.1:8100/internal/v1/health`. Migrations run against the
bundled XAMPP MariaDB instance — see
[`docs/runbooks/mariadb-local.md`](docs/runbooks/mariadb-local.md) before
running `php artisan migrate` or issuing any database `GRANT`.

Playwright E2E suite (`e2e/`), against the same MariaDB instance's isolated
`grc_enrollment_test` database — see ADR 0016:

```powershell
Set-Location e2e
npm ci
npm run install-browsers
npm run reset-db
# In separate terminals: the backend on --env=testing, then the frontend.
Set-Location ..\backend; php artisan serve --host=127.0.0.1 --port=8000 --env=testing
Set-Location ..\frontend; npm run dev
Set-Location ..\e2e; npm test
```

## Quality Gates

```powershell
# backend/
composer validate --strict
composer format:check
composer analyse
composer test
composer check-platform-reqs
composer audit --locked --no-interaction

# frontend/
npm run format:check
npm run lint
npm run lint:fast
npm run typecheck
npm test
npm run build
npm audit

# ml-service/
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
.\.venv\Scripts\python.exe -m mypy app
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m pip check

# e2e/ — both servers must already be running, see Setup above
npm test
```

## Security

- Never commit credentials, access tokens, `.env` files, personal student data, or production datasets.
- Keep all application endpoints versioned under `/api/v1`.
- Enforce authorization in the API; hiding controls in the SPA is never sufficient.
- Treat all predictive results as advisory decision support.
- Use synthetic, deterministic data for development and tests.

## Project Discipline

Implement one coherent PRD slice at a time. Run the narrowest checks during development, then the full applicable suite before a phase is marked complete. Record every meaningful milestone and failure in [`PROGRESS.md`](PROGRESS.md).
