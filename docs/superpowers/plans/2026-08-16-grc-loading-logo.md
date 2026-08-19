# GRC Loading Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an accessible branded GRC loading logo for App Router transitions and default asynchronous workspace loading states.

**Architecture:** A reusable `GrcLoadingLogo` owns the monogram, status semantics, and motion. The root Next.js loading file uses its full-page form, while `AsyncBoundary` uses the compact form only when callers did not provide a layout-preserving fallback.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS 4, Vitest, Testing Library.

## Global Constraints

- Use existing red, gold, background, and reduced-motion CSS/Tailwind tokens; add no package or image asset.
- Preserve all custom `AsyncBoundary` loading fallbacks and its error, empty, and success paths.
- Make the loading message accessible and all monogram decoration hidden from assistive technology.
- Do not commit or push without a new explicit user request.

---

### Task 1: Build and apply the branded loading logo

**Files:**

- Create: `frontend/src/features/components/portal/grc-loading-logo.tsx`
- Create: `frontend/src/features/components/portal/grc-loading-logo.test.tsx`
- Create: `frontend/src/app/loading.tsx`
- Modify: `frontend/src/features/components/portal/async-boundary.tsx`
- Modify: `frontend/src/features/components/portal/async-boundary.test.tsx`

**Interfaces:**

- Produces `GrcLoadingLogo({ label?: string; fullPage?: boolean }): JSX.Element`.
- `app/loading.tsx` exports Next.js's default loading component.

- [ ] **Step 1: Write the failing component and boundary tests**

```tsx
it("announces GRC loading while keeping the monogram decorative", () => {
  render(<GrcLoadingLogo label="Loading enrollment workspace…" />)

  expect(
    screen.getByRole("status", { name: "Loading enrollment workspace…" }),
  ).toBeInTheDocument()
  expect(screen.getByText("GRC")).toHaveAttribute("aria-hidden", "true")
})

it("shows the branded fallback when pending without a custom fallback", () => {
  render(<AsyncBoundary query={pendingQuery}>{() => <p>data</p>}</AsyncBoundary>)

  expect(screen.getByRole("status", { name: "Loading…" })).toBeInTheDocument()
  expect(screen.getByText("GRC")).toBeInTheDocument()
})

it("preserves a caller-provided loading fallback", () => {
  render(
    <AsyncBoundary query={pendingQuery} loadingFallback={<p>Loading roster layout</p>}>
      {() => <p>data</p>}
    </AsyncBoundary>,
  )

  expect(screen.getByText("Loading roster layout")).toBeInTheDocument()
  expect(screen.queryByText("GRC")).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```powershell
.\node_modules\.bin\vitest.cmd --configLoader runner run src/features/components/portal/grc-loading-logo.test.tsx src/features/components/portal/async-boundary.test.tsx --reporter=verbose
```

Expected: failure because the loading-logo component and branded fallback do not exist.

- [ ] **Step 3: Implement the minimal reusable component and wire it into both loading entry points**

`AsyncBoundary` replaces only its default `Skeleton` fallback with
`<GrcLoadingLogo label={loadingLabel} />`; a supplied `loadingFallback` is
rendered unchanged. `app/loading.tsx` returns
`<GrcLoadingLogo fullPage label="Loading GRC Connect…" />`.

- [ ] **Step 4: Run focused tests to verify the implementation passes**

Run the same Vitest command from Step 2. Expected: all tests pass, including
the new caller-provided fallback, existing error, empty, and success coverage.

- [ ] **Step 5: Run formatting, type, and diff checks**

Run Prettier on the five changed files, `npm run typecheck`, and
`git diff --check`. Expected: all commands succeed; the known CSV line-ending
notice is acceptable if it is the only Git output.

## Self-review

- Task 1 covers the reusable visual, route fallback, default query fallback,
  accessibility, reduced-motion behavior, and verification.
- The original boundary test file did not cover a caller-provided fallback, so
  Task 1 adds that regression case before replacing the default fallback.
- No dependency or business-data behavior changes are included.
