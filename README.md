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
frontend/     React + strict TypeScript + Vite SPA
backend/      Laravel REST API under /api/v1
ml-service/   Private Python prediction service
docs/         ADRs, API contract, data dictionary, and runbooks
e2e/          Playwright journeys against the integrated stack
```

The SPA and API remain independently deployable. Browser requests use bearer tokens; session-cookie and CSRF-cookie authentication are out of scope. The browser must not call the prediction service directly.

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

Use three terminals from the repository root. Safe examples may be copied to
local `.env` files, but local environment files must never be committed.

Laravel API:

```powershell
Set-Location backend
composer install
Copy-Item .env.example .env
php artisan key:generate
php artisan serve --host=127.0.0.1 --port=8000
```

React SPA:

```powershell
Set-Location frontend
npm ci
Copy-Item .env.example .env.local
npm run dev -- --host=localhost --port=5173
```

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
```

## Security

- Never commit credentials, access tokens, `.env` files, personal student data, or production datasets.
- Keep all application endpoints versioned under `/api/v1`.
- Enforce authorization in the API; hiding controls in the SPA is never sufficient.
- Treat all predictive results as advisory decision support.
- Use synthetic, deterministic data for development and tests.

## Project Discipline

Implement one coherent PRD slice at a time. Run the narrowest checks during development, then the full applicable suite before a phase is marked complete. Record every meaningful milestone and failure in [`PROGRESS.md`](PROGRESS.md).
