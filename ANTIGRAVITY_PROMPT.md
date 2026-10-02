# Prompt para kay Antigravity — Super Admin + Department Switcher

Kopyahin at i-paste ang sumusunod na buong prompt kay Antigravity, habang bukas ang
repository na `C:\xampp\htdocs\GRC-ENROLLMENT` sa workspace nito. Lokal na coding task
ito (walang kailangang production/SSH access) — ang lahat ng kailangan nitong basahin ay
nasa repo na.

```markdown
You are an expert full-stack engineer working inside the GRC Enrollment System
repository, already open as this workspace (`GRC-ENROLLMENT/`). Your task is to
implement one approved, fully-specified feature end to end: a **Super Admin** role
with a **Department Switcher** and an **Accounts & Access** console. Planning and
design review are already done by another agent (Claude) this session — your job
is implementation, following the plan exactly, not re-planning.

### 0. Read these four files first, in this order, before writing any code

1. `AGENTS.md` (repo root) — the repository's own operating rules. These override
   any default behavior you might otherwise default to. In particular: work on
   `main` unless told otherwise; never commit or push unless explicitly asked;
   run the narrowest relevant checks after each change and the full suite before
   calling a slice complete; never record a check as passed unless it actually
   ran; update `PROGRESS.md` as that file directs; never invent a policy value;
   never commit secrets, `.env` files, or production data.
2. `PRD.md` — product and architecture source of truth. You don't need to read
   all 1400+ lines up front; the implementation plan below tells you exactly
   which sections matter and when.
3. `docs/adr/0038-super-admin-and-department-switcher.md` — the architecture
   decision record: what was decided and why, in ~2 pages.
4. `docs/superpowers/specs/2026-10-01-super-admin-design.md` — the full design
   spec: every mechanism, every endpoint, every rule, with the current-state
   findings that justify each decision.

Then open **the actual implementation plan** you will execute task by task:

`docs/superpowers/plans/2026-10-01-super-admin.md`

That plan is the real instruction set — it has exact file paths, exact function
signatures, exact test bodies to write first, exact commands to run, and exact
line-level anchors in files like `backend/routes/api.php` for where new code goes.
Follow it in order: Slice 1 → Slice 2 → Slice 3 → Slice 4. Do not skip ahead or
reorder — later slices depend on earlier ones (e.g. the Department Switcher in
Slice 2 depends on the `super_admin` role existing from Slice 1).

### 1. System overview

- **Frontend** (`frontend/`): Next.js (App Router), React, strict TypeScript,
  TanStack Query, React Hook Form, Zod, Tailwind CSS, shadcn/ui. Client-rendered
  only — no server-side session, no SSR of authorized data (ADR 0013). API calls
  live in `features/services/*.ts`, never directly in components.
- **Backend** (`backend/`): Laravel, Sanctum bearer-token authentication (no
  cookies, no CSRF endpoints — never introduce them), versioned REST under
  `/api/v1`, Form Requests, Policies, Actions/Services, API Resources, database
  transactions, reversible migrations.
- **Database:** MySQL/MariaDB, InnoDB, `utf8mb4`.
- Both `frontend/` and `backend/` must stay independently runnable.

### 2. Non-negotiable working method (this is how this repo is built)

This project uses test-driven development throughout. For every task in the
implementation plan:

1. Write the failing test(s) first — the plan gives you concrete test bodies or
   a precise description of what to assert.
2. Run the narrow test command the plan specifies and **confirm it fails** for
   the expected reason (missing class/route/column), not for an unrelated
   error.
3. Implement the smallest change that makes it pass.
4. Run the narrow command again and confirm it passes.
5. Move to the next task.

After each full Slice (the plan has four), run the **entire** backend suite
(`cd backend && vendor/bin/phpunit`) and the entire frontend suite
(`cd frontend && npx vitest run && npx tsc --noEmit`) and confirm you are at or
above the baseline the plan states (backend 2078/2078, frontend 1394/1394, `tsc`
0 errors, before your changes). Do not report a slice done, or move on, unless
you actually ran these and saw them pass — never assert a test passed without
having run it.

Use a **private, dedicated test database** (e.g. a MariaDB instance on its own
port such as `3310`), never the developer's main local database — several
existing tests in this repo are sensitive to a shared database being used by two
processes at once. If `docs/runbooks/mariadb-local.md` exists, follow it for the
exact local setup.

This repository's tracked files are mostly CRLF line endings. If you edit a file
with a tool that rewrites in text mode (common in some Python-based editing
paths), it can flip line endings and break the PHP formatter (`pint`). Prefer
your native file-edit tool, or a short one-off PHP script run with `php`, over
any approach that risks silently changing every line ending in a file you touch.

### 3. Scope discipline

- Implement exactly what the plan describes. If you find the plan is wrong about
  something concrete and checkable in the code (a line number has shifted, a
  function doesn't exist where expected), fix your understanding from the actual
  code and proceed — the plan's prose intent still governs. If you find a
  genuine gap in the *design* (not just a stale reference), stop and surface it
  clearly rather than inventing a policy decision — this system explicitly
  requires never inventing institutional/policy values that should come from
  the project owner.
- Do not modify files unrelated to this feature. If you believe an unrelated fix
  is necessary, note it and the reason rather than silently making it.
- Do not commit or push. Leave the working tree as your implementation result;
  the project owner decides when to request a commit.
- Update `PROGRESS.md` as you go: at the start of this work, before any
  substantial step, after each slice, and if anything fails — per `AGENTS.md`'s
  own rule for this file. Follow the existing entries' format (newest entry at
  the top of the file, a `## YYYY-MM-DD — Title (STATUS)` heading).

### 4. What "done" looks like

All four slices in `docs/superpowers/plans/2026-10-01-super-admin.md` checked
off, both full test suites passing, `tsc --noEmit` clean, and
`docs/runbooks/super-admin.md` written (Slice 4) so the project owner can
actually provision and use the account in production themselves — production
deployment and the `SUPER_ADMIN_EMAIL` value are the owner's own action, not
something you do.

Begin with Slice 1, Task 1.1, exactly as written in the plan.
```
