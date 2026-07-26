# GRC Enrollment Frontend

Independent React and strict-TypeScript SPA for the GRC Automated Enrollment
System. The current Phase 0 interface includes an institutional landing page,
public API readiness, a local-only demo login, and role-filtered portal
previews for all nine PRD roles.

## Requirements

- Node.js 24
- npm 11
- the Laravel API running at the origin configured by `VITE_API_BASE_URL`

## Local Setup

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

The safe example points to `http://127.0.0.1:8000` and sets
`VITE_AUTH_MODE=demo`. Demo access is accepted only in Vite development/test
mode. Production builds always disable the demo gateway even if the variable is
set to `demo`.

Use the complete account matrix in
[`../docs/testing/DEMO_CREDENTIALS.md`](../docs/testing/DEMO_CREDENTIALS.md).
Those accounts are client fixtures, not Laravel users. They do not prove real
authentication, database identity, or server authorization. Never place real
tokens, credentials, or personal data in a committed environment file.

## Route Inventory

- `/` — institutional landing page with public readiness summary
- `/login` — local-demo sign-in when demo mode is enabled
- `/portal` — protected, role-filtered portal overview
- `/portal/:moduleId` — protected module preview resolved only from the
  signed-in role's catalog
- any unknown public route — branded not-found page

Anonymous protected-route requests are redirected to login with a validated
internal return path. Unknown or cross-role module IDs receive a scoped portal
not-found state. Client-side route filtering is a presentation boundary, not a
replacement for API authorization.

## Available Checks

```powershell
npm run format:check
npm run lint
npm run lint:fast
npm run typecheck
npm test
npm run build
npm audit --audit-level=moderate
```

## Current API Contract

The browser makes one public request:

```text
GET /api/v1/health
```

The response is parsed with Zod:

```json
{
  "data": {
    "type": "service-health",
    "service": "grc-enrollment-api",
    "status": "ok",
    "api_version": "v1",
    "generated_at": "RFC3339 UTC"
  }
}
```

Raw browser requests live only in `src/app/services`. Rendering components
consume the TanStack Query hook and never call the API or prediction service
directly.

## Source Layout

```text
src/
  app/
    auth/          demo gateway, strict session persistence, and provider
    components/
      common/      public API readiness
      layouts/     public and role portal shells
      pages/       landing, login, portal, module, and not-found routes
      ui/          checked-in shadcn source components
    hooks/
    lib/
    portal/        single role capability and module catalog
    router/        routes, guards, and safe return-path parser
    schemas/
    services/
    types/
  tests/
  main.tsx
```

The shadcn/ui sources are checked into `src/app/components/ui`; the CLI is not
an application dependency. Newsreader and IBM Plex Sans are packaged locally
through Fontsource, so the interface makes no runtime font request.

## Deferred Production Authentication

Real authentication remains deferred until the supported MySQL 8.4 baseline,
deterministic users/roles, and Laravel Sanctum vertical slice are implemented.
The replacement path is server-issued Sanctum bearer tokens, Laravel Policies
on every protected endpoint, server-owned role/capability responses, secure
credential handling, and integration tests. The local demo fixture and
browser session store must be removed or fully bypassed in that production
path.

Database readiness, workflow availability, institutional policy values, and
prediction-service readiness are not inferred by this frontend.
