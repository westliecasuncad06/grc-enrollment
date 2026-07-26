# GRC Portal Demo Credentials

> Local interface demonstration only. These credentials do not authenticate
> against Laravel, a database, or any deployed GRC system.

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

## How to Test Locally

1. In `frontend/`, copy `.env.example` to `.env.local`.
2. Run `npm install`, then `npm run dev`.
3. Open `/login`.
4. Sign in with one account from the table.
5. Sign out before switching roles.

## Safety Boundary

- These accounts are client-side fixtures, not database users.
- They work only when the frontend runs locally in development demo mode.
- Laravel never accepts these emails or this password.
- Do not reuse this password for a real account, database seeder, environment
  secret, or deployed test user.
- This file contains no production secret.
- Real integration-test accounts will use environment-controlled credentials
  and server-side password hashing.
- Client-side role navigation is a presentation preview, not authorization.
  Real protected APIs will continue to require Sanctum bearer tokens and
  Laravel Policies.
