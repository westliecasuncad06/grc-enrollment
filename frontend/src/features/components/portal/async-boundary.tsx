"use client"

import type { ReactNode } from "react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/features/components/ui/alert"
import { Button } from "@/features/components/ui/button"
import { Skeleton } from "@/features/components/ui/skeleton"
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
 * place to define "empty" per query.
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
    return (
      <div role="status" aria-live="polite" className="flex flex-col gap-2">
        <span className="sr-only">{loadingLabel}</span>
        {loadingFallback ?? <Skeleton className="h-32" />}
      </div>
    )
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

  if (query.data === undefined) {
    return <p>{emptyMessage}</p>
  }

  if (isEmpty?.(query.data)) {
    return <p>{emptyMessage}</p>
  }

  return <>{children(query.data)}</>
}
