# Phase 8b — Portal UI Coherence & Motion — Design Specification

**Status:** User-approved design; implementation plan pending review.

## Goal

Bring the 29 connected portal modules into the design language that already
exists in this repo — the print-ledger / institutional-folio style used on the
landing and login pages (ruled-paper background, Newsreader variable serif at
negative tracking, GRC red hairlines, gold accents including a signature hard
offset shadow, uppercase `.eyebrow` micro-labels) — and add motion. This is the
second slice of roadmap Phase 8; Playwright E2E (§14.3), security (§14.4), and
performance (§14.5) verification move to Phase 8c. §12.6's profile/password
settings and help/report-an-issue entries stay deferred — they need new
backend endpoints and are features, not polish.

Grounded in PRD §12.1 (design system), §12.2 (required shadcn/ui patterns),
and §12.6 (portal content, specifically last-updated indicators). No
institutional rule is invented, per `AGENTS.md`.

## Origin

A user screenshot of the Eligible Subjects page showed the module heading and
description rendered twice, a dashed placeholder border around real content,
and a bare unstyled `<select>`. Investigation traced this to four structural
defects, two of which are misses from Phase 8a itself (recorded honestly, not
glossed over):

1. **Every connected workspace renders inside `.portal-module-empty`** — a
   class built for *unbuilt* modules (dashed border, centered placeholder
   layout) — because `PortalModulePage`'s connected branch reuses it.
2. **`.portal-module-page` centers content like a splash screen**
   (`display: grid; place-items: center`), correct for a one-line "not built
   yet" card, wrong for a data workspace.
3. **The page header renders twice on all 29 connected modules.** Phase 8a
   flagged this as defect #9, deferred it via a code comment calling it "Task 5
   work," and then Task 5 never did it.
4. **28 raw `<select>` and 14 raw `<input>` elements across 10 workspaces**,
   while `ui/select.tsx` and `ui/input.tsx` already exist and `globals.css` has
   zero styling for bare form elements. Phase 8a's own Task 5 said to adopt
   `ui/select.tsx`; it wasn't done.

`enrollment-workspace.tsx` — the page in the screenshot — is also the only
Student workspace Phase 8a's migration skipped entirely: no `AsyncBoundary`, no
`DataTable`, a hand-rolled `<Skeleton>` for loading, and four `Alert`s that can
stack simultaneously with no hierarchy.

## Scope and Decisions

- **Frontend-only.** No backend routes, migrations, or Actions change.
- **This UI pass is the whole of Phase 8b**, not a side effect of some other
  slice — the defects found are structural and span all 40 modules' shared
  chrome, so they warrant a dedicated phase rather than a quick patch.
- **Full breadth: shared chrome, then all 19 workspaces**, not a partial
  subset — chosen over doing only the Student flow you screenshotted, because
  the shared-chrome fix (Task 1) already lands on all 29 modules for free, and
  leaving the other 15 workspaces visually inconsistent with the fixed ones
  would look like an unfinished job.
- **Reuse the existing design language; do not invent a new one.** The audit
  found a genuinely good, deliberate visual system already built on the
  landing/login pages that the portal simply never adopted. Every visual
  decision in this phase ports an existing token, class, or idiom
  (`--institutional-gold`, `.eyebrow`, the `ledger-enter` keyframe, the button
  press idiom) rather than authoring new ones.
- **Add a motion library (`motion`, the current framer-motion package)**
  instead of extending the existing pure-CSS `.reveal` system, per your
  decision. This is a real tradeoff, accepted deliberately:
  - **Cost:** a new runtime dependency in a project whose CI enforces
    `npm audit --audit-level=moderate`; if it conflicts, the fix is the
    repo's established `overrides` pattern, not `--legacy-peer-deps`.
  - **Cost:** the existing `prefers-reduced-motion` CSS blanket
    (`globals.css:1930`) cannot reach JS-driven inline transforms, so every
    motion-library animation needs its own `useReducedMotion()` handling —
    centralized in one wrapper module so it's one decision, not nineteen.
  - **Benefit:** presence/exit animation (alerts appearing and leaving,
    skeleton→content crossfade) is what plain CSS keyframes handle poorly and
    is exactly what the enrollment/registrar decision flows need.
  - Where plain CSS already does the job well (simple staggered entrances),
    the existing `.reveal`/`.reveal--one..four` ladder is reused as-is —
    `.reveal--three` and `--four` are already defined and simply unused.

## Public Interfaces

### Page chrome (Task 1)

`PortalModulePage`'s connected branch stops wrapping `<ModuleComponent/>` in
its own `<section className="portal-module-empty">` / `<h1>` / `<p>` / role
`<Badge>`. `WorkspacePage` becomes the sole page header; its internal heading
moves from `<h2>` to `<h1>` since it is now the only heading on the page.
Module registry label/description remain in use for navigation (sidebar links,
breadcrumb) only.

```tsx
// portal-module-page.tsx, connected branch — new shape
if (ModuleComponent) {
  return (
    <main className="portal-module-page portal-module-page--connected">
      <ModuleComponent />
    </main>
  )
}
```

`WorkspacePage`'s heading level becomes configurable (default `h1`, since every
current call site is the connected branch's sole heading):

```ts
export interface WorkspacePageProps {
  title: string
  description?: string
  actions?: ReactNode
  unauthorized?: boolean
  lastUpdated?: number
  children?: ReactNode
}
```

(No new prop needed — the internal `<h2>` literal becomes `<h1>`. No workspace
currently passes a heading level, and none should: there is exactly one
`WorkspacePage` per connected page.)

### Motion vocabulary (Task 3)

`src/features/components/portal/motion.tsx` (new), a thin wrapper so 19
workspaces never import `motion` directly and reduced-motion handling is
centralized:

```tsx
export function Reveal({ children, index }: { children: ReactNode; index?: number }): JSX.Element
export function StaggerList({ children }: { children: ReactNode }): JSX.Element
export function StaggerItem({ children }: { children: ReactNode }): JSX.Element
export function FadePresence({ show, children }: { show: boolean; children: ReactNode }): JSX.Element
```

Each reads `useReducedMotion()` internally and renders motion-free when true.

### Design tokens (Task 2)

New tokens added to `globals.css`'s `:root`, seeded from values already in use
rather than invented:

```css
--ease-house: cubic-bezier(0.2, 0.75, 0.2, 1); /* from the existing ledger-enter keyframe */
--duration-fast: 150ms;   /* existing Tailwind-default de facto standard */
--duration-base: 200ms;   /* existing Sheet duration */
--duration-slow: 650ms;   /* existing ledger-enter duration */
```

### Form primitives (Task 4)

No new components — `ui/select.tsx` and `ui/input.tsx` already exist and are
correctly built (Phase 8a already added the jsdom Pointer Events polyfill
`Select` needs, in `src/tests/setup.tsx`). This task is pure adoption: replace
raw `<select>`/`<input>` call sites with `<Select>`/`<Input>` following the
existing correct pattern in `class-rosters-workspace.tsx:73-90`.

## Non-goals

- Wiring up the four disabled topbar buttons (profile/password/help/report) —
  they need backend endpoints; this phase gives them polish only.
- Activating the existing but unreachable `.dark` theme.
- Playwright E2E, security, performance verification (Phase 8c).
- Phase 7c dashboards (blocked on institutional content).
