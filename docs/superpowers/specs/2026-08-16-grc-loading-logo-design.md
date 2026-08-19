# GRC Loading Logo Design

## Goal

Show a recognizable, accessible GRC loading state whenever a route segment or
default data workspace is loading.

## Visual direction

The loader uses the existing institutional red and gold palette. A compact
square GRC monogram sits inside a thin orbit ring, with one deliberate pulse.
It uses the existing IBM Plex Sans typeface and avoids a generic spinner-only
appearance. The animation pauses for people who enable reduced motion.

## Components and behavior

- Create `GrcLoadingLogo` in the portal component area. It receives an
  optional status label and compact/full presentation so the same visual works
  in both contexts.
- Add `frontend/src/app/loading.tsx` as the Next.js App Router loading
  fallback. It renders the full presentation, centered in the application
  page background.
- Change `AsyncBoundary`'s default pending fallback from an anonymous
  skeleton to the compact GRC loader. Existing callers that pass
  `loadingFallback` retain their purpose-built skeletons and layout.
- Use a `role="status"` region with a visibly associated label. Decorative
  visual elements are hidden from assistive technology.

## Constraints

- Use only React, Tailwind CSS, and the existing CSS variables; add no package
  or image asset.
- Retain the existing `AsyncBoundary` error and empty states unchanged.
- Support both light and dark themes through the existing semantic color
  tokens.
- Cover the reusable loader and the changed default pending state with Vitest
  tests before production implementation.

## Verification

- The new component test checks the visible GRC identity, loading label,
  accessible status semantics, and decorative accessibility treatment.
- The existing `AsyncBoundary` test confirms the default pending fallback uses
  the branded loading label; its custom-fallback behavior remains covered.
- Run the focused Vitest files, TypeScript, targeted Prettier, and
  `git diff --check`.
