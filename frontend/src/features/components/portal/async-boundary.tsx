"use client"

import type { ReactNode } from "react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/features/components/ui/alert"
import { Button } from "@/features/components/ui/button"
import { Empty, EmptyDescription } from "@/features/components/ui/empty"
import { GrcLoadingLogo } from "@/features/components/portal/grc-loading-logo"
import { getStatePresentation } from "@/features/lib/api-error-presentation"

export interface AsyncBoundaryQuery<T> {
  isPending: boolean
  isError: boolean
  error: unknown
  data: T | undefined
  refetch: () => unknown
}

export interface AsyncBoundaryProps<T> {
  query: AsyncBoundaryQuery<T>
  isEmpty?: (data: T) => boolean
  emptyMessage?: string
  loadingLabel?: string
  loadingFallback?: ReactNode
  children: (data: T) => ReactNode
}

/**
 * The loading/error/empty decision every workspace re-implemented by hand
 * (~26 sites across 19 files): a single, consistently-announced status
 * region for loading, a status-aware error presentation with retry, and one
 * place to define "empty" per query (PRD §12.2's `Empty` pattern).
 *
 * Deliberately not `AnimatePresence`-wrapped: an earlier attempt crossfaded
 * every state transition here, but on a refetch (filter change, pagination)
 * that meant a real exit animation had to complete before new content
 * mounted, and `AsyncBoundary` backs ~26 query sites across 19 workspaces —
 * one shared component's motion cannot be tuned per-caller. Motion for
 * specific, lower-blast-radius moments (a receipt appearing, a staggered
 * list) uses `Reveal`/`StaggerList` directly in the workspace that needs it.
 * See ADR 0015.
 */
export function AsyncBoundary<T>({
  query,
  isEmpty,
  emptyMessage = "Nothing to show yet.",
  loadingLabel = "Loading…",
  loadingFallback,
  children,
}: AsyncBoundaryProps<T>) {
  if (query.isPending) {
    if (loadingFallback) {
      return (
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          <span className="sr-only">{loadingLabel}</span>
          {loadingFallback}
        </div>
      )
    }

    return <GrcLoadingLogo label={loadingLabel} />
  }

  if (query.isError) {
    const presentation = getStatePresentation(query.error, {
      onRetry: () => void query.refetch(),
    })

    return (
      <Alert variant="destructive">
        <AlertTitle>{presentation.title}</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          <span>{presentation.message}</span>
          {presentation.action && (
            <Button
              type="button"
              variant="outline"
              onClick={presentation.action.onClick}
            >
              {presentation.action.label}
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  if (query.data === undefined || isEmpty?.(query.data)) {
    return (
      <Empty>
        <EmptyDescription>{emptyMessage}</EmptyDescription>
      </Empty>
    )
  }

  return <>{children(query.data)}</>
}
