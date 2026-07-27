# GRC Portal Demo Credentials

> Local interface demonstration only, for `VITE_AUTH_MODE=demo`. These
> credentials do not authenticate against Laravel, a database, or any
> deployed GRC system. **For real Sanctum authentication against the
> database, see [`SEEDED_IDENTITIES.md`](SEEDED_IDENTITIES.md) instead** —
> the default `api` auth mode does not accept anything on this page.

All nine synthetic accounts use this shared password:

```text
GRC-Demo-Only!2026
```

| Role | Internal role ID | Display name | Email | Password |
|---|---|---|---|---|
| Student | `student` | Demo Student | `student.demo@grc.test` | `GRC-Demo-Only!2026` |
| Admission Staff | `admission_staff` | Demo Admission Staff | `admission.demo@grc.test` | `GRC-Demo-Only!2026` |
| Professor / Faculty | `faculty` | Demo Faculty | `faculty.demo@grc.test` | `GRC-Demo-Only!2026` |
| Program Chair | `program_chair` | Demo Program Chair | `chair.demo@grc.test` | `GRC-Demo-Only!2026` |
| Dean | `dean` | Demo Dean | `dean.demo@grc.test` | `GRC-Demo-Only!2026` |
| Executive Director | `executive_director` | Demo Executive Director | `executive.demo@grc.test` | `GRC-Demo-Only!2026` |
| Registrar Head | `registrar_head` | Demo Registrar Head | `registrar-head.demo@grc.test` | `GRC-Demo-Only!2026` |
| Registrar Staff | `registrar_staff` | Demo Registrar Staff | `registrar-staff.demo@grc.test` | `GRC-Demo-Only!2026` |
| Accounting Staff | `accounting_staff` | Demo Accounting Staff | `accounting.demo@grc.test` | `GRC-Demo-Only!2026` |

## Demo credentials vs. seeded database identities

These two sets are deliberately distinct and **must never share a password**:

| | This file | `SEEDED_IDENTITIES.md` |
|---|---|---|
| Lives in | Frontend TypeScript fixtures (`src/app/auth/demo-users.ts`) | `grc_enrollment.users` table |
| Auth path | UI-only; no network request | Real `POST /api/v1/auth/login`, Sanctum bearer token |
| Email domain | `*.demo@grc.test` | `*.seed@grc.test` |
| Password | This shared, committed value | Generated locally, in `GRC_SEED_PASSWORD`, never committed |
| Auth mode | `VITE_AUTH_MODE=demo` only | Default (`api`) — active everywhere including production |

## How to Test Locally

1. In `frontend/`, copy `.env.example` to `.env.local` and set
   `VITE_AUTH_MODE=demo`.
2. Run `npm install`, then `npm run dev`.
3. Open `/login`.
4. Sign in with one account from the table.
5. Sign out before switching roles.

To test real authentication instead, leave `VITE_AUTH_MODE` unset and use
`SEEDED_IDENTITIES.md` with a running, migrated, and seeded backend.

## Safety Boundary

- These accounts are client-side fixtures, not database users.
- They work only when the frontend runs locally with `VITE_AUTH_MODE=demo`.
- Laravel never accepts these emails or this password.
- Do not reuse this password for a real account, database seeder, environment
  secret, or deployed test user.
- This file contains no production secret.
- Client-side role navigation is a presentation preview, not authorization.
  Protected APIs require Sanctum bearer tokens; authorization Policies remain
  a later slice.
