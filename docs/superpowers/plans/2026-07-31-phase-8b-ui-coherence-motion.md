# Phase 8b — Portal UI Coherence & Motion Implementation Plan

**Goal:** Bring the 29 connected portal modules into the design language
already established on the landing/login pages, fix the structural chrome
defects (duplicated header, placeholder-styled workspaces, centered layout,
raw form controls), and add motion — across shared chrome and all 19
workspaces.

**Architecture:** Fix `PortalModulePage` + `globals.css` once (fixes all 29
modules), add a design-token layer and a thin motion wrapper, migrate the
remaining raw-HTML form controls onto existing `ui/select.tsx`/`ui/input.tsx`,
finish `enrollment-workspace.tsx`'s Phase 8a migration, then apply the result
across every workspace.

**Tech Stack:** Next.js 16 App Router / React 19 / TypeScript 6, TanStack Query
5, React Hook Form + Zod, Tailwind v4, shadcn/ui (radix-ui), `motion` (new),
Vitest 4 + Testing Library + `vitest-axe`.

## Global Constraints

- Frontend-only — no backend route, migration, Action, or Policy changes.
- Reuse existing tokens/classes/idioms; do not invent a new visual language.
- Every workspace keeps its existing role-scoping and API contract; only
  presentation/markup/motion changes.
- Any new dependency conflict is resolved via `frontend/package.json`
  `overrides`, not `--legacy-peer-deps`.
- Every JS-driven (motion library) animation must have explicit
  `useReducedMotion()` handling — the existing CSS `prefers-reduced-motion`
  blanket does not reach it.
- Update `PROGRESS.md` after each completed task; never record a check as
  passed unless it actually ran.
- Do not commit, merge, or push unless explicitly asked.

---

## File Structure

| Area | Responsibility |
|---|---|
| `frontend/src/features/components/pages/portal-module-page.tsx` | Remove duplicate outer header from the connected branch. |
| `frontend/src/features/components/portal/workspace-page.tsx` | `<h2>` → `<h1>`, `.eyebrow` treatment, `lastUpdated` wired. |
| `frontend/src/app/globals.css` | New tokens, fixed `.portal-module-page` layout, card hover/shadow, dead-CSS removal. |
| `frontend/src/features/components/portal/motion.tsx` | New shared motion vocabulary. |
| `frontend/src/features/components/portal/async-boundary.tsx` | `Empty` primitive for empty states; motion crossfade. |
| `frontend/src/features/components/portal/data-table.tsx` | Mobile-card heading fix, empty-rows branch. |
| `frontend/src/features/components/ui/select.tsx` | `transition-colors` on `SelectTrigger`. |
| `frontend/src/features/components/portal/*-workspace.tsx` (19 files) | Raw `<select>`/`<input>` → `Select`/`Input`; motion; `enrollment-workspace.tsx` full rebuild. |
| `frontend/src/features/components/portal/status-stepper.tsx` | New — promoted from `student-queue-payment-workspace.tsx`. |
| `docs/adr/0015-page-header-ownership-and-portal-motion.md` | New ADR. |

---

### Task 1: Fix page chrome

**Files:** Modify `portal-module-page.tsx`, `workspace-page.tsx`, `globals.css`.

- [ ] Remove the outer `<section className="portal-module-empty">` / `<h1>` /
      `<p>` / role `<Badge>` from `PortalModulePage`'s connected branch; render
      `<main className="portal-module-page portal-module-page--connected"><ModuleComponent/></main>`.
- [ ] `workspace-page.tsx`: change the internal `<h2>` to `<h1>` in both the
      unauthorized and normal render paths.
- [ ] `globals.css`: add `.portal-module-page--connected` overriding the
      centered-grid layout with a top-aligned, `max-width`-constrained column;
      leave the base `.portal-module-page` (still used by the two placeholder
      branches) untouched.
- [ ] Grep for any workspace whose title/description meaningfully diverges
      from its module-registry label/description in a way that would now read
      oddly as the sole heading (multiplexed workspaces already derive a
      per-module heading via `workspaceHeadings[initialModuleId]`); align
      wording only, not structure.

---

### Task 2: Design tokens + house language in the portal

**Files:** Modify `globals.css`, `workspace-page.tsx`, `card.tsx` (or a portal
wrapper), `data-table.tsx`.

- [ ] Add `--ease-house`, `--duration-fast/base/slow` tokens to `:root`,
      seeded from `cubic-bezier(0.2, 0.75, 0.2, 1)` / 150ms / 200ms / 650ms —
      values already in use, not new ones.
- [ ] `WorkspacePage`: give the heading/description a real typographic
      treatment (serif display, `.eyebrow`-style micro-label above it) drawn
      from `.portal-overview-header`'s existing pattern.
- [ ] Add a card hover state (subtle lift/shadow using the new duration
      tokens) — cards are currently `ring-1` with zero interaction feedback,
      despite several being clickable (module cards) or containing primary
      actions (review/summary panels).
- [ ] Apply the gold offset-shadow / red cap-rule idiom (from
      `.enrollment-folio`) to one or two high-attention surfaces per page
      (e.g. the enrollment review/summary panel) — sparingly, not everywhere.

---

### Task 3: Motion library + vocabulary

**Files:** Modify `frontend/package.json`; create `motion.tsx` +
`motion.test.tsx`.

- [ ] `npm install motion` in `frontend/`; verify compatibility with the
      installed React 19.2 / Next 16.2 (check peer ranges before install, add
      an `overrides` entry only if actually needed).
- [ ] Build `src/features/components/portal/motion.tsx`: `Reveal` (single
      staggered entrance, replaces `.reveal` for JS-driven cases),
      `StaggerList`/`StaggerItem` (list/table row stagger), `FadePresence`
      (wraps `AnimatePresence` for alerts/receipts appearing and leaving).
      Each calls `useReducedMotion()` and renders inert when true.
- [x] ~~Wire `AsyncBoundary`'s loading→content transition through
      `FadePresence`.~~ **Reverted after empirical testing**: wrapping
      `AsyncBoundary`'s state machine in `AnimatePresence` meant a refetch
      (filter change, pagination) had to wait for a real exit animation
      before new content mounted, which broke a synchronous test assertion
      in `audit-logs-workspace.test.tsx` and would likely affect other
      workspaces' refetch-driven tests the same way. `AsyncBoundary` backs
      ~26 query sites — too broad a surface for one shared crossfade tuning.
      `FadePresence` stays available in `motion.tsx` for narrower,
      per-workspace uses (a receipt banner, a dismissible notice) instead.
- [ ] Record the new dependency and the reason in `PROGRESS.md` per
      `AGENTS.md`.
- [ ] `npm run lint && npm run typecheck && npm test && npm audit --audit-level=moderate` —
      confirm green before proceeding.

---

### Task 4: Shared primitive gaps

**Files:** Modify `async-boundary.tsx`, `data-table.tsx`, `select.tsx`,
`workspace-page.tsx`, and their tests.

- [ ] `AsyncBoundary`: replace both bare `<p>{emptyMessage}</p>` branches with
      `ui/empty.tsx`'s `Empty`/`EmptyTitle`/`EmptyDescription`, matching PRD
      §12.2.
- [ ] `DataTable`: stop defaulting the mobile card heading to
      `String(rowKey(row))`; require callers needing a card fallback to supply
      one (already optional via `renderCard`), or accept a `cardTitle`
      render-prop. Add an empty-rows branch so callers stop hand-guarding.
- [ ] `select.tsx`: add `transition-colors` to `SelectTrigger`, matching
      `Input`/`Textarea`.
- [ ] `WorkspacePage`: confirm `lastUpdated` renders correctly once workspaces
      start passing it (Task 5/6).

---

### Task 5: Rebuild `enrollment-workspace.tsx`

**Files:** Modify `enrollment-workspace.tsx` and its test.

- [ ] Replace both raw `<select>` term/section pickers with `Select`.
- [ ] Replace the hand-rolled loading/error/empty branches with
      `AsyncBoundary`.
- [ ] Replace the raw `<Table>` "Your enrollments" list with `DataTable`.
- [ ] Collapse the four independently-stacking `Alert`s into one prioritised
      region (error > conflict-notice > receipt, never more than one visible).
- [ ] Rebuild the review/summary panel as a persistent, visually-distinct
      panel (Task 2's folio treatment candidate) rather than an inline `<p>` +
      `<Badge>`.
- [ ] Apply `StaggerList` to the subject-selection cards.

---

### Task 6: Apply polish to the remaining 18 workspaces

**Files:** All other `*-workspace.tsx` files and their tests.

- [ ] In role order (Student → Admission → Faculty → Program Chair → Dean →
      Executive Director → Registrar Head → Registrar Staff → Accounting),
      replace raw `<select>`/`<input>` with `Select`/`Input`, apply
      `Reveal`/`StaggerList` to entrance, pass `lastUpdated` where the
      underlying query exposes `dataUpdatedAt`.
- [ ] Promote `StudentQueuePaymentWorkspace`'s `StatusStepper` into
      `src/features/components/portal/status-stepper.tsx`; re-import it back
      into that workspace unchanged in behavior.
- [ ] Re-run the full portal test directory after each few files, per the
      Phase 8a-established pattern of catching regressions early rather than
      at the end.

---

### Task 7: Dead CSS cleanup

**Files:** Modify `globals.css`, and the 2 files using undefined classes.

- [ ] Delete `.readiness-hero`, `.hero-copy`, `.hero-summary`,
      `.hero-action-row`, `.route-ledger*`, `.phase-folio*`, `.boundary-note*`
      — confirmed zero TSX references.
- [ ] Fix `landing-shell` (`landing-page.tsx`) and `portal-module-section`
      (`portal-overview-page.tsx`) — used in TSX, never defined; either define
      them or remove the dead className.
- [ ] Record in `PROGRESS.md` per `AGENTS.md`'s reason-for-touching-adjacent-
      code rule.

---

### Task 8: Tests

**Files:** `portal-module-page.test.tsx`, `module-registry.test.tsx`, and any
workspace test touched above.

- [ ] Rewrite `portal-module-page.test.tsx:91-103`'s three outer-header
      assertions against the single `WorkspacePage` header (heading role name
      = workspace's own title; no separate `${module.label} workspace`
      region).
- [ ] Confirm `module-registry.test.tsx` passes untouched (it renders
      workspaces standalone) — a control that nothing about the workspaces'
      own internals broke.
- [ ] `npx vitest run --no-file-parallelism` on `src/features/components/portal/`
      after Tasks 1–6 land; full `npm test` at the end.
- [ ] Add/extend `vitest-axe` coverage for any new interaction surface
      (`Select` migrations, `Empty` states).

---

### Task 9: Docs

**Files:** Create `docs/adr/0015-page-header-ownership-and-portal-motion.md`;
modify `PROGRESS.md`.

- [ ] ADR 0015: record `WorkspacePage` as sole page-header owner, module
      registry strings as navigation-only, the motion-library decision and its
      reduced-motion contract.
- [ ] `PROGRESS.md`: new "Verified Completed — Phase 8b" section following the
      established pattern; correct the stale "Phase 8a not yet merged /
      ~95 uncommitted files" text (Phase 8a is merged, `main` at `8bb7e66`).

---

## Verification

- **Full frontend gate**: `format:check`, `lint` (`--max-warnings=0`),
  `lint:fast`, `typecheck`, `test`, `build`, `npm audit --audit-level=moderate`.
- **Backend no-regression**: `composer test`, expect 641/641 (unchanged — no
  backend file touched).
- **Live visual check** against running dev servers, Student journey at
  minimum — confirm the dashed frame, centering, doubled header, and bare
  native dropdown are gone.
- **Motion + reduced-motion check.**
- **Manual WCAG 2.1 AA pass** deferred from Phase 8a, attempted here since
  this phase changes layout/heading levels — needs a connected browser; report
  honestly if unavailable rather than recording it as done.

## Explicitly out of scope

Phase 8c (Playwright E2E, security, performance); §12.6 profile/password/help
wiring (needs backend endpoints); Phase 7c dashboards; activating the
unreachable `.dark` theme.

## Commits

Per `AGENTS.md`, nothing is committed, merged, or pushed without an explicit
request.
