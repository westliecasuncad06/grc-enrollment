# Phase 8a — Accessibility & Required States — Design Specification

**Status:** User-approved design; implementation plan pending review.

## Goal

Bring the 29 connected portal modules (served by 19 `*-workspace.tsx` files)
up to PRD §12.4 (required application states), §12.5 (WCAG 2.1 AA), §12.3
(form behavior), and the presentation-layer portion of §12.6 (portal shell
content). This is the first slice of roadmap Phase 8 ("Polish, Accessibility,
E2E, Performance"); Playwright E2E (§14.3), security (§14.4), and performance
(§14.5) verification are separate later slices, chosen because they build on
the semantic locators this slice creates. §12.6's profile/password settings
and help/report-an-issue entries are deferred — they require new backend
endpoints and are features, not polish.

## Scope and Decisions

- **Frontend-only.** No backend routes, migrations, or Actions change.
- **Primitives first, then migrate all 19 workspaces onto them**, chosen over
  fixing each workspace in place. An audit of the current code found the same
  four patterns hand-duplicated in every workspace: the page header (19/19),
  the loading/error/empty triad (~26 sites), the unauthorized-role branch
  (11/19), and a Prev/Next paginator (6 verbatim copies, while the existing
  `ui/pagination.tsx` is used by none of them). Under that duplication, every
  accessibility fix would need to land 19 times and drift apart again. Primi-
  tives make each fix a single-site change.
- **Add `eslint-plugin-jsx-a11y` (lint-time) and `vitest-axe` (runtime) as dev
  dependencies.** There is currently no automated accessibility checking in
  this repo. CI runs `eslint --max-warnings=0`, so the plugin must land clean
  before merge — enabling it early lets it guide the migration instead of
  auditing it afterward.
- **Cover all 19 workspaces in this slice**, not a partial subset, so the
  phase produces one coherent, consistent result across every portal (per
  `AGENTS.md` §5: implement one coherent slice at a time). The work is
  internally phased (tooling → error contract → primitives → shell → per-
  workspace migration → tests → docs) so it can be verified incrementally
  rather than as one indivisible change.
- Fix the shell-level defects alongside the workspace migration since they
  affect every page: `.portal-nav-link` has no focus style at all (a WCAG
  2.4.7 failure — a keyboard user is invisible in the sidebar), there is no
  `aria-current="page"` on nav links, and a 401 currently clears the stored
  token without updating `AuthContext` or redirecting, leaving the user on a
  stale portal until a manual reload.

## Public Interfaces

### Status-aware error presentation

`src/features/lib/api-error-presentation.ts` (new) generalizes the
`getErrorPresentation` helper that already exists ad hoc in
`src/features/components/common/public-api-readiness.tsx`:

```ts
export interface ErrorPresentation {
  title: string
  message: string
  action?: { label: string; onClick: () => void }
}

export function getStatePresentation(error: unknown): ErrorPresentation
```

It reads `ApiClientError`'s existing `.kind` (`configuration | connection |
contract | http`), `.status`, `.code`, and `.requestId` (all already produced
by `src/features/services/api-client.ts`; no service-layer change needed) and
maps each PRD §12.4 state: `403` → authorization error, `404` → not found,
`409` → conflict (preserve input, non-field message), `429` → throttled
(reads `Retry-After` when present), `kind: "connection"` → offline/dependency
failure, everything else → generic server failure with `requestId` shown for
support. The existing `422` path (`applyApiFieldErrors` in
`src/features/lib/api-form-errors.ts`) is untouched and stays the field-level
validation mechanism; it gains a `focusFirstInvalidField` call.

Two existing defects are fixed alongside this, because they are part of the
same status-handling surface:
- `src/features/lib/query-client.ts`: `retry: 1` currently retries every
  failure including throttled (`429`) and other 4xx responses. Changes to
  retry only on network/5xx-shaped failures.
- `src/features/services/api-client.ts`'s unauthorized handler (`setUnauthorizedHandler`)
  currently only clears the token store; it gains a call that drives
  `AuthContext` to `status: "anonymous"` so the existing `RequireSession`
  guard performs its normal redirect, instead of leaving a stale authenticated
  view rendered over a cleared token.

### Shared workspace primitives

New, each exported from `src/features/components/portal/` and covered by its
own colocated test:

| Component | Responsibility |
|---|---|
| `WorkspacePage` | `<section aria-labelledby>` wrapping a real `<h2>` (via `useId`), description text, optional header actions, and a last-updated indicator sourced from TanStack Query's `dataUpdatedAt` (currently read nowhere in the codebase). |
| `AsyncBoundary` | Single decision point for loading / empty / error / unauthorized / offline, driven by `getStatePresentation`. Replaces the ~26 hand-written ternary chains. |
| `DataTable` | Wraps the existing `ui/table.tsx` primitives; requires a `caption` prop and renders `<th scope="col">` for every header; provides the card-fallback layout only 2 of 13 current tables have. |
| `Paginator` | Thin wrapper around the already-built, currently-unused `ui/pagination.tsx`, replacing the 6 hand-rolled Prev/Next copies. |
| `StatusRegion` | A polite live region (`role="status" aria-live="polite"`) for announcing async result and result-count changes — today only one workspace (`admission-provisioning-workspace.tsx`) has anything like this. |

Existing primitives gain accessibility fixes as part of this work, each a
single-file change that benefits every consumer:
- `ui/card.tsx`: `CardTitle` renders a real heading (`level` prop, default 3)
  instead of a `<div>` — currently ~76 usages produce zero navigable
  sub-headings below the page `<h1>`.
- `ui/field.tsx`: `FieldError` gains a generated `id`; the field's input
  gains matching `aria-describedby` and `aria-invalid` wiring (today set in
  only 1 of 6 forms; the rest use CSS-only `data-invalid`).
- `ui/skeleton.tsx`: gains `role="status"` and screen-reader-only loading
  text — today's 26 usages announce nothing to assistive tech.
- `ui/alert.tsx`: gains a non-assertive `role="status"` path for success
  content (receipts, confirmations), leaving `role="alert"` for actual
  errors — today every `Alert` interrupts equally regardless of severity.

### Portal shell

`src/features/components/layouts/portal-shell.tsx` and `globals.css`:
`.portal-nav-link:focus-visible` styling, `aria-current="page"` on the active
nav link, a real `<Breadcrumb>` component replacing the hardcoded `<p>role
workspace / …</p>` string, and restoring the focus ring the skip-link target
currently loses (`globals.css` sets `.portal-content:focus { outline: none }`).
`src/features/components/pages/portal-module-page.tsx`'s nested
`<section role="region" aria-label="X workspace">` wrapping each workspace's
own near-identically-labeled `<section>` is de-duplicated to one region.

## Workspace Migration

All 19 files under `src/features/components/portal/*-workspace.tsx` move
their loading/empty/error/unauthorized branches onto `AsyncBoundary`, their
headers onto `WorkspacePage`, their tables onto `DataTable`, and their
paginators onto `Paginator`. Beyond the mechanical migration:

- Focus management is added where there is currently none: after a mutation
  succeeds (e.g. enrollment submission clearing its form), after a dialog
  closes (decision dialogs in `registrar-records-workspace.tsx`,
  `registrar-enrollment-workspace.tsx`, `schedule-decision-workspace.tsx`),
  and `admission-provisioning-workspace.tsx`'s `shouldFocusError: false` is
  removed so React Hook Form's built-in error focus works again.
- Confirm buttons currently gated only by `disabled={!reason.trim()}` (no
  stated reason for the user) gain a visible validation message.
- Raw unstyled elements bypassing the design system
  (`master-schedule-workspace.tsx`'s bare `<button>`,
  `schedule-decision-workspace.tsx`'s bare `<textarea>`) are replaced with
  `Button`/`Field`-based equivalents.
- Verbatim-duplicated helpers fold into shared modules: the `selectClassName`
  string (2 copies) is replaced by adopting the already-built,
  currently-unused `ui/select.tsx`; the `gradeBadgeVariant` helper (3 copies)
  and `workspaceHeadings` lookup (4 copies) each become one shared function.

The 3 workspaces that shipped without tests —
`class-rosters-workspace.tsx` (182 lines), `grade-submission-workspace.tsx`
(356 lines), and `registrar-records-workspace.tsx` (756 lines, backing 4
modules) — get their first test files as part of this migration, following
the existing pattern in `src/tests/render-app.tsx`'s `renderWithSession` plus
a stubbed global `fetch` (per `enrollment-workspace.test.tsx`).

## Interaction, Safety, and Accessibility

- Every table gets a `<caption>` and `<th scope="col">` headers; tables that
  currently rely purely on horizontal scroll (11 of 13) gain the card
  fallback `DataTable` provides.
- Every form input's error text is programmatically associated via
  `aria-describedby`, and `aria-invalid` is set consistently — today true in
  only 1 of 6 forms.
- 403/404/409/429/offline all render a distinct, correctly-announced state
  instead of collapsing into one generic "could not be loaded" message — the
  current behavior across all 19 workspaces (grep for these statuses in
  `src/` returns zero hits today; only `401` and `422` are handled).
- `prefers-reduced-motion` handling in `globals.css` and the existing skip
  link are already correct and are left as-is.

## Verification

- Full frontend gate matching `.github/workflows/ci.yml`: `format:check`,
  `lint` (with `jsx-a11y` at `--max-warnings=0`), `lint:fast`, `typecheck`,
  `test` (243 existing tests plus new coverage, including `vitest-axe`
  assertions per workspace), `build`, `npm audit --audit-level=moderate`.
- Backend suite (`composer test`, 641 tests) run as a no-regression check —
  this slice touches no backend file.
- Live verification against the real dev database: sign in as identities
  from `docs/testing/SEEDED_IDENTITIES.md` to exercise a true 403
  (cross-role denial), 404 (bad id), 409 (repeat payment confirmation), and
  429 (repeated rapid requests); stop the backend mid-session to verify
  offline/dependency-failure states.
- Manual WCAG 2.1 AA pass (cannot be automated): keyboard-only traversal of
  every portal with visible focus throughout, screen-reader spot check of
  heading/landmark navigation, 200% zoom and text-resize, responsive
  behavior at the existing `30/45/64/68rem` breakpoints, reduced-motion
  confirmation.

## Explicit Non-Goals

- Playwright E2E (§14.3), security verification (§14.4), performance
  verification (§14.5) — later Phase 8 slices.
- §12.6 profile/password settings and help/report-an-issue — need new backend
  endpoints (password change with current-password re-verification); a
  feature, not a polish pass.
- Phase 7c (Dean/Executive Director dashboards) — blocked separately; the PRD
  authorizes these modules but never specifies their content, and
  `AGENTS.md` §5 forbids inventing institutional rules.
- The dead dark-mode token block in `globals.css` (a full `.dark` palette and
  `dark:` component classes exist, but nothing ever sets the class). Not a
  WCAG requirement; flagged for a future decision to wire up or delete, not
  addressed here.
