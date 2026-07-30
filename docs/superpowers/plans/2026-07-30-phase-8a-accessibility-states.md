# Phase 8a — Accessibility & Required States Implementation Plan

**Goal:** Bring all 29 connected portal modules (19 `*-workspace.tsx` files) up to PRD §12.4 required states, §12.5 WCAG 2.1 AA, §12.3 form behavior, and the presentation-layer part of §12.6, via shared primitives extracted once and adopted everywhere.

**Architecture:** A status-aware error-presentation mapper drives a small set of new shared components (`WorkspacePage`, `AsyncBoundary`, `DataTable`, `Paginator`, `StatusRegion`); existing primitives (`Card`, `Field`, `Skeleton`, `Alert`) gain targeted accessibility fixes; all 19 workspaces migrate onto the new components, replacing ~26 hand-written loading/error/empty branches, 11 unauthorized-role branches, and 6 duplicated paginators.

**Tech Stack:** Next.js 16 App Router / React 19 / TypeScript 6, TanStack Query 5, React Hook Form + Zod, Tailwind v4, shadcn/ui (radix-ui), Vitest 4 + Testing Library + `vitest-axe`, `eslint-plugin-jsx-a11y`.

## Global Constraints

- Frontend-only — no backend route, migration, Action, or Policy changes.
- No new UI component libraries beyond `eslint-plugin-jsx-a11y` and `vitest-axe` (both dev-only).
- Every workspace keeps its existing role-scoping and API contract; only presentation/markup/state-handling changes.
- Preserve `applyApiFieldErrors` as the 422 path; do not touch its behavior beyond adding focus-on-first-error.
- Do not implement §12.6 profile/password/help/report-issue, Playwright E2E, security, or performance work — those are separate slices.
- Update `PROGRESS.md` after each completed task; never record a check as passed unless it actually ran.
- Do not commit or push unless explicitly asked.

---

## File Structure

| Area | Responsibility |
|---|---|
| `frontend/src/features/lib/api-error-presentation.ts` | Status → user-facing state mapping (new). |
| `frontend/src/features/lib/query-client.ts` | Stop retrying 4xx. |
| `frontend/src/features/services/api-client.ts` | Unauthorized handler drives a real redirect. |
| `frontend/src/features/components/ui/{card,field,skeleton,alert}.tsx` | Targeted a11y fixes to existing primitives. |
| `frontend/src/features/components/portal/{workspace-page,async-boundary,data-table,paginator,status-region}.tsx` | New shared primitives (new). |
| `frontend/src/features/components/layouts/portal-shell.tsx`, `src/app/globals.css` | Shell focus/breadcrumb/region fixes. |
| `frontend/src/features/components/pages/portal-module-page.tsx` | De-duplicate nested region. |
| `frontend/src/features/components/portal/*-workspace.tsx` (19 files) | Migrate onto the new primitives. |
| `docs/adr/0014-presentation-layer-state-contract.md` | New ADR recording the status→state mapping. |

---

### Task 1: Add accessibility tooling

**Files:**
- Modify: `frontend/package.json`, `frontend/eslint.config.js`, `frontend/vitest.config.ts`, `frontend/src/tests/setup.tsx`

**Interfaces:**
- `eslint-plugin-jsx-a11y` recommended ruleset added to the flat ESLint config, scoped to `frontend/src/**/*.{ts,tsx}`.
- `vitest-axe`'s `toHaveNoViolations` matcher registered globally in `src/tests/setup.tsx` alongside the existing `jest-dom` matchers.

- [ ] **Step 1:** `npm install -D eslint-plugin-jsx-a11y vitest-axe` in `frontend/`.
- [ ] **Step 2:** Add the plugin's `flat/recommended` config to `eslint.config.js`.
- [ ] **Step 3:** Run `npm run lint` and fix every violation surfaced immediately — do not suppress with inline disables except where a false positive is confirmed (e.g. a Radix primitive that already provides the semantics the rule can't see).
- [ ] **Step 4:** Register `vitest-axe`'s matcher in `src/tests/setup.tsx` via `expect.extend(matchers)`.
- [ ] **Step 5:** Record the two new dev dependencies and the reason in `PROGRESS.md` per `AGENTS.md` §14 (adding a dependency without prior use requires a recorded reason).
- [ ] **Step 6:** Run `npm run lint && npm run typecheck && npm test` — confirm all green before proceeding.

---

### Task 2: Status-aware error contract

**Files:**
- Create: `frontend/src/features/lib/api-error-presentation.ts`, `frontend/src/features/lib/api-error-presentation.test.ts`
- Modify: `frontend/src/features/lib/query-client.ts`, `frontend/src/features/services/api-client.ts`, `frontend/src/features/lib/api-form-errors.ts`
- Modify: `frontend/src/features/components/common/public-api-readiness.tsx` (adopt the new shared helper, removing its local `getErrorPresentation`)

**Interfaces:**
```ts
export interface ErrorPresentation {
  title: string
  message: string
  action?: { label: string; onClick: () => void }
}
export function getStatePresentation(error: unknown, options?: { onRetry?: () => void }): ErrorPresentation
```
Maps `ApiClientError.status` 403/404/409/429 (reading `Retry-After` from the error when present) and `.kind === "connection"` to distinct copy; falls back to a generic 5xx message carrying `requestId`.

- [ ] **Step 1:** Write `api-error-presentation.test.ts` covering each `ApiClientError` shape (403, 404, 409, 429 with and without `Retry-After`, `kind: "connection"`, generic 5xx, and the existing `configuration`/`contract` kinds) — assert exact title/message/action shape per case.
- [ ] **Step 2:** Run the test, confirm it fails (module doesn't exist yet).
- [ ] **Step 3:** Implement `getStatePresentation`, porting and generalizing the mapping logic already in `public-api-readiness.tsx`'s local `getErrorPresentation`.
- [ ] **Step 4:** In `query-client.ts`, change the query `retry` function from a flat `1` to one that returns `false` when the thrown error is an `ApiClientError` with a 4xx `status` (400–499), and retries once otherwise.
- [ ] **Step 5:** In `api-client.ts`, extend the registered unauthorized handler's call site so `setUnauthorizedHandler` — invoked from `providers.tsx` — also flips `AuthContext` to `status: "anonymous"` (add a method on `AuthContextValue` or call the existing `signOut()` local-clear path) so `RequireSession` performs its normal effect-driven redirect instead of leaving a stale view.
- [ ] **Step 6:** In `api-form-errors.ts`, add `focusFirstInvalidField(setError, fieldOrder)` or extend `applyApiFieldErrors` to accept a `formRef`/`setFocus` callback and call it after setting the first field error.
- [ ] **Step 7:** Update `public-api-readiness.tsx` to import `getStatePresentation` instead of its local copy; confirm its existing test still passes unmodified (behavior is a superset, not a change, for the cases it exercises).
- [ ] **Step 8:** Run `npm test -- api-error-presentation query-client public-api-readiness` and `npm run typecheck`.

---

### Task 3: Shared workspace primitives + existing-primitive fixes

**Files:**
- Create: `frontend/src/features/components/portal/workspace-page.tsx` (+ `.test.tsx`)
- Create: `frontend/src/features/components/portal/async-boundary.tsx` (+ `.test.tsx`)
- Create: `frontend/src/features/components/portal/data-table.tsx` (+ `.test.tsx`)
- Create: `frontend/src/features/components/portal/paginator.tsx` (+ `.test.tsx`)
- Create: `frontend/src/features/components/portal/status-region.tsx` (+ `.test.tsx`)
- Modify: `frontend/src/features/components/ui/card.tsx`, `ui/field.tsx`, `ui/skeleton.tsx`, `ui/alert.tsx` (+ existing tests for each, if any; add if none)

**Interfaces:**
```ts
// workspace-page.tsx
export function WorkspacePage(props: {
  title: string
  description?: string
  actions?: ReactNode
  lastUpdated?: number // dataUpdatedAt from a TanStack Query result
  children: ReactNode
}): JSX.Element

// async-boundary.tsx
export function AsyncBoundary<T>(props: {
  query: Pick<UseQueryResult<T>, "isPending" | "isError" | "error" | "data" | "refetch">
  authorized?: boolean
  isEmpty?: (data: T) => boolean
  emptyMessage?: string
  children: (data: T) => ReactNode
}): JSX.Element

// data-table.tsx
export function DataTable<Row>(props: {
  caption: string
  columns: { key: string; header: string; render: (row: Row) => ReactNode }[]
  rows: Row[]
  rowKey: (row: Row) => string
}): JSX.Element // renders <Table> w/ <TableCaption>, <TableHead scope="col">, plus a card fallback below `sm`

// paginator.tsx
export function Paginator(props: { page: number; totalPages: number; onPageChange: (page: number) => void }): JSX.Element

// status-region.tsx
export function StatusRegion(props: { message: string | null }): JSX.Element // role="status" aria-live="polite"
```

- [ ] **Step 1:** Write tests for each new component first (render, accessible-name assertions, `vitest-axe` `toHaveNoViolations` on each), confirm they fail.
- [ ] **Step 2:** Implement `WorkspacePage`: `<section aria-labelledby={headingId}>`, real `<h2 id={headingId}>`, optional `actions` slot, `lastUpdated` rendered as `"Updated {relative time}"` via a small local formatter (no new date library — reuse patterns already in the repo for term formatting).
- [ ] **Step 3:** Implement `AsyncBoundary`: branches in order — `!authorized` (renders a real `<h2>`-headed message, not a bare `<p>`) → `isPending` (renders `Skeleton` group, post-Task-3-fix so it's `role="status"`) → `isError` (calls `getStatePresentation(error, { onRetry: refetch })`, renders via `Alert`) → `isEmpty?.(data)` (renders empty message) → `children(data)`.
- [ ] **Step 4:** Implement `DataTable` using existing `ui/table.tsx` primitives; `sm:hidden` card list + `hidden sm:block` table, matching the existing pattern in `class-rosters-workspace.tsx`/`teaching-schedule-workspace.tsx` but generalized.
- [ ] **Step 5:** Implement `Paginator` as a thin wrapper generating page-number links via the existing `ui/pagination.tsx` primitives.
- [ ] **Step 6:** Implement `StatusRegion` as a minimal `role="status" aria-live="polite"` element that renders nothing when `message` is `null`.
- [ ] **Step 7:** Fix `ui/card.tsx`: add a `level?: 2 | 3 | 4 | 5 | 6` prop to `CardTitle` (default `3`), rendering the matching `<hN>` instead of `<div>`. Verify existing `CardTitle` consumers (grep confirms ~76 usages) don't break — this is additive (children/className unchanged), so no consumer edits needed for this step; workspace migration in Task 5 will pass `level={2}` where a Card is a workspace's primary section.
- [ ] **Step 8:** Fix `ui/field.tsx`: `FieldError` generates an `id` via `useId()` when rendering; export a way for the sibling input to read it (either `Field` provides it via context, or `FieldError` accepts an `id` prop and the caller wires `aria-describedby`) — pick the context approach if `Field` already wraps both, since it avoids changing every call site's prop list.
- [ ] **Step 9:** Fix `ui/skeleton.tsx`: add `role="status"` and an `sr-only` "Loading…" span (visually unchanged).
- [ ] **Step 10:** Fix `ui/alert.tsx`: add a `variant="success"` (or reuse `default` with a `live?: "polite" | "assertive"` prop, defaulting to `"assertive"` only for `variant="destructive"`) so success/receipt content doesn't interrupt as aggressively as errors.
- [ ] **Step 11:** Run `npm test -- workspace-page async-boundary data-table paginator status-region card field skeleton alert` and `npm run lint` (jsx-a11y must be clean on every new file).

---

### Task 4: Portal shell & CSS accessibility fixes

**Files:**
- Modify: `frontend/src/features/components/layouts/portal-shell.tsx`, `frontend/src/app/globals.css`, `frontend/src/features/components/pages/portal-module-page.tsx`
- Create: `frontend/src/features/components/common/breadcrumb.tsx` (+ `.test.tsx`) — or adopt shadcn's breadcrumb primitive if pulling one in is cheaper than hand-rolling; keep to the existing "no unrelated component libraries" constraint (still shadcn/radix-ui, already a dependency)

**Interfaces:**
- `PortalNavigation`'s `NavigationLink` sets `aria-current="page"` when `pathname === href` (currently only toggles a class).
- Breadcrumb renders `<nav aria-label="Breadcrumb"><ol>…</ol></nav>` replacing the current `<p>Role workspace / {roleLabel}</p><strong>{pageLabel}</strong>`.

- [ ] **Step 1:** Add `.portal-nav-link:focus-visible` to `globals.css` (visible ring matching the existing `--ring` token, consistent with `Button`/`Input`'s `focus-visible:ring-3 focus-visible:ring-ring/50`).
- [ ] **Step 2:** Remove or narrow `.portal-content:focus { outline: none }` so the skip-link's target keeps a visible ring when it receives focus.
- [ ] **Step 3:** Add `aria-current="page"` to the active `NavigationLink` in `portal-shell.tsx`.
- [ ] **Step 4:** Build `Breadcrumb` and swap it into `portal-shell.tsx`'s topbar in place of the hardcoded `<p>`/`<strong>` pair, sourcing the same `definition.roleLabel` / `currentPageLabel` values already computed there.
- **Step 5 MOVED to Task 5.** Attempted here first; reverted. `portal-module-page.tsx`'s outer `<section aria-label="{module.label} workspace">` wraps every connected workspace's own labelled section — genuinely duplicated regions — but multiplexed workspaces (`RegistrarRecordsWorkspace`, `AccountingPaymentWorkspace`, `AdmissionProvisioningWorkspace`, `RegistrarEnrollmentWorkspace`, `CurriculumWorkspace`) already compute a per-module heading via a local `workspaceHeadings[initialModuleId]` lookup that differs from their own fixed `aria-label` (e.g. all 4 `RegistrarRecordsWorkspace` modules share the outer name "Registrar records workspace" but render heading text like "Credit mappings"). `portal-module-page.test.tsx` asserts the outer region's exact name per module (`getAllByRole("region", {name: \`${module.label} workspace\`})`), so removing the outer wrapper now — before those 5 workspaces migrate onto `WorkspacePage` with a correctly-threaded per-module title — breaks that test. Do this instead as part of Task 5: for each multiplexed workspace, pass `workspaceHeadings[initialModuleId]` (or equivalent) as `WorkspacePage`'s `title` so the single surviving inner region is correctly and uniquely named per module, remove `portal-module-page.tsx`'s outer wrapper in the same pass, and update `portal-module-page.test.tsx`'s region-name assertions to match (they currently encode the old fixed generic names — e.g. `schedulingWorkspaceRegions` — which should become module-specific once this lands).
- [ ] **Step 6:** Write/update tests: `portal-shell.test.tsx` asserts `aria-current` toggles correctly between routes and the breadcrumb renders `<nav aria-label="Breadcrumb">`; run `vitest-axe` against a rendered shell.
- [ ] **Step 7:** Run `npm test -- portal-shell portal-module-page breadcrumb` and `npm run lint`.

---

### Task 5: Migrate all 19 workspaces onto the shared primitives

**Files (all 19, one migration pattern applied to each):**
`accounting-payment-workspace.tsx`, `admission-provisioning-workspace.tsx`, `audit-logs-workspace.tsx`, `class-rosters-workspace.tsx`, `curriculum-workspace.tsx`, `eligible-subjects-workspace.tsx`, `enrollment-workspace.tsx`, `faculty-assignment-workspace.tsx`, `faculty-input-workspace.tsx`, `grade-submission-workspace.tsx`, `master-schedule-workspace.tsx`, `registrar-enrollment-workspace.tsx`, `registrar-records-workspace.tsx`, `schedule-decision-workspace.tsx`, `schedule-proposals-workspace.tsx`, `sections-workspace.tsx`, `student-grades-com-workspace.tsx`, `student-queue-payment-workspace.tsx`, `teaching-schedule-workspace.tsx` — all under `frontend/src/features/components/portal/`.

**Per-file migration pattern** (apply to each; order chosen so early files validate the pattern before it's repeated 18 more times — start with the 3 untested files since they need new tests regardless, then the largest/highest-risk (`registrar-records`), then the rest):

- [ ] **Step 1 (per file): Replace the header** — swap the hand-written `<section aria-label><h2>…</h2><p>…</p></section>` opening for `<WorkspacePage title=… description=…>`.
- [ ] **Step 2 (per file): Replace the loading/error/empty ternary** with `<AsyncBoundary query={...} authorized={...} isEmpty={...}>{(data) => (...)}</AsyncBoundary>`.
- [ ] **Step 3 (per file): Replace `<Table>` usage** with `<DataTable caption=… columns=… rows=… rowKey=…>` where the workspace renders tabular data (13 of 19 files).
- [ ] **Step 4 (per file): Replace hand-rolled Prev/Next** with `<Paginator>` (6 files: `registrar-records` ×4 call sites, `registrar-enrollment`, `audit-logs`).
- [ ] **Step 5 (per file): Add focus management** where a mutation or dialog close currently leaves focus stranded — `enrollment-workspace.tsx` (after receipt renders), `registrar-records-workspace.tsx`/`registrar-enrollment-workspace.tsx`/`schedule-decision-workspace.tsx` (after decision dialog closes), `admission-provisioning-workspace.tsx` (remove `shouldFocusError: false`).
- [ ] **Step 6 (per file): Fix disabled-only confirm buttons** — `registrar-records-workspace.tsx`, `registrar-enrollment-workspace.tsx`, `accounting-payment-workspace.tsx` gain a visible "Reason is required" message alongside the existing `disabled={!reason.trim()}`.
- [ ] **Step 7 (per file): Replace raw elements** — `master-schedule-workspace.tsx`'s bare `<button>` → `Button`; `schedule-decision-workspace.tsx`'s bare `<textarea>` → `Field`/`FieldLabel`-wrapped `Textarea` (add a minimal `ui/textarea.tsx` if one doesn't exist, matching `Input`'s styling conventions).
- [ ] **Step 8 (per file): Adopt `ui/select.tsx`** in place of the raw `<select>` + copy-pasted `selectClassName` string in `class-rosters-workspace.tsx` and `grade-submission-workspace.tsx`.
- [ ] **Step 9 (per file): Run that file's test** (`npm test -- <workspace-name>`) after each migration, before moving to the next file, so failures are attributed to one file at a time.

**Shared helper de-duplication (once, not per-file):**
- [ ] Extract `gradeBadgeVariant` (currently duplicated in `grade-submission-workspace.tsx`, `registrar-records-workspace.tsx`, `student-grades-com-workspace.tsx`) into `frontend/src/features/lib/grade-presentation.ts`; update all three call sites.
- [ ] Extract `workspaceHeadings` (duplicated in `accounting-payment-workspace.tsx`, `registrar-records-workspace.tsx`, `admission-provisioning-workspace.tsx`, `registrar-enrollment-workspace.tsx`) into a shared constant colocated with `module-registry.tsx` or a new `frontend/src/features/portal/workspace-headings.ts`.

- [ ] **Final step:** Run `npm test` (full suite), `npm run lint`, `npm run typecheck` after all 19 files are migrated.

---

### Task 6: Missing tests + new state coverage

**Files:**
- Create: `class-rosters-workspace.test.tsx`, `grade-submission-workspace.test.tsx`, `registrar-records-workspace.test.tsx` (these are written as part of Task 5 Step 1 for those 3 files, per the plan above — this task covers the *additional* cross-cutting state tests)
- Modify: a representative subset of existing workspace tests to add 403/404/409/429/offline cases (not all 19 need every state — apply where the workspace's real API surface can produce that status, per the live-verification list in the spec)

**Interfaces:** No new production interfaces; test-only.

- [ ] **Step 1:** For the 3 new test files, follow `enrollment-workspace.test.tsx`'s pattern exactly: `renderWithSession`, stubbed global `fetch` returning contract-complete fixtures (Zod parsing runs for real), assertions by accessible role/name, unauthorized-role branch asserts `fetchMock` was never called.
- [ ] **Step 2:** Add a `vitest-axe` assertion (`expect(await axe(container)).toHaveNoViolations()`) to every one of the 19 workspace test files' primary rendered state.
- [ ] **Step 3:** Add 403/404/409/429/offline (`kind: "connection"`) test cases to `enrollment-workspace.test.tsx` (409 — repeat payment/conflict), `registrar-records-workspace.test.tsx` (403 cross-role, 404 bad id), and `api-error-presentation.test.ts` (already covers all statuses at the unit level from Task 2).
- [ ] **Step 4:** Run `npm test` — full suite must pass, count reported and compared against the pre-migration baseline (243 + new).

---

### Task 7: ADR + PROGRESS.md

**Files:**
- Create: `docs/adr/0014-presentation-layer-state-contract.md`
- Modify: `PROGRESS.md`

**Interfaces:** None (documentation only).

- [ ] **Step 1:** Write ADR 0014 following the existing ADR format (see `docs/adr/0011-approval-workflow-transitions-and-publish-linkage.md` for structure: Status, Context, Decision, Consequences). Record: the HTTP-status → presentation-state mapping table, why primitives-first was chosen over per-file fixes, and the `--datadir`-equivalent gotchas are N/A here (that's the MariaDB runbook, unrelated).
- [ ] **Step 2:** Update `PROGRESS.md`: mark Phase 8a's row/status, update the completion percentage table (row 8 "Nine role portals" and row 10 "Verification & deployment" both move), and correct the stale line (~528) claiming the push to `origin` is still deferred — it already happened as of Phase 7b.
- [ ] **Step 3:** Cross-link the ADR from `docs/data-dictionary/` or the relevant service docs if any existing doc describes error handling (check `docs/api/error-contract.md` for a reference to add).

---

## Final Verification (run after all 7 tasks)

- [ ] `cd frontend && npm run format:check && npm run lint && npm run lint:fast && npm run typecheck && npm test && npm run build && npm audit --audit-level=moderate` — all green.
- [ ] `cd backend && composer test` — 641/641, confirming zero backend regression.
- [ ] Live run: `php artisan serve` + `npm run dev`, sign in via `docs/testing/SEEDED_IDENTITIES.md` identities, manually trigger a 403 (cross-role), 404 (bad id), 409 (repeat action), 429 (rapid repeat), and an offline state (stop backend mid-session).
- [ ] Manual WCAG 2.1 AA pass: keyboard-only traversal, screen-reader heading/landmark spot check, 200% zoom, responsive breakpoints, reduced-motion.
- [ ] Update `PROGRESS.md` with final verification results before considering Phase 8a complete.
