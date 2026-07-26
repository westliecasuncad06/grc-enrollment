# GRC Enrollment Frontend

Independent React and strict-TypeScript SPA for the GRC Automated Enrollment System. Phase 0A provides a polished service-readiness screen and verifies only the public Laravel health contract.

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

The safe example points to `http://127.0.0.1:8000`. Never place tokens, credentials, or personal data in a committed environment file.

## Available Checks

```powershell
npm run lint
npm run lint:fast
npm run format:check
npm run typecheck
npm test
npm run build
npm audit
```

## Phase 0A Contract

The browser makes one request:

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

Raw browser requests live only in `src/app/services`. Rendering components consume the TanStack Query hook and never call the API or prediction service directly.

## Source Layout

```text
src/
  app/
    components/
      common/
      pages/
      ui/
    hooks/
    lib/
    schemas/
    services/
    types/
  tests/
  main.tsx
```

The shadcn/ui source components are checked into `src/app/components/ui`; the CLI is not an application dependency. Newsreader and IBM Plex Sans are packaged locally through Fontsource, so the interface makes no runtime font request.

## Deferred Work

- Authentication, forms, role navigation, and business workflows begin in later PRD slices.
- Client routing is intentionally deferred. On 2026-07-26, current React Router `7.18.1` was affected by `GHSA-qwww-vcr4-c8h2`; Phase 0A has one screen and therefore renders the App directly instead of retaining a vulnerable dependency.
- Database and prediction-service readiness are not inferred by this browser screen.
