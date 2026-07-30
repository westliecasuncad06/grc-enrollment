"use client"

import { useId, type ReactNode } from "react"

function formatRelativeUpdate(timestampMs: number): string {
  const seconds = Math.round((Date.now() - timestampMs) / 1000)

  if (seconds < 5) return "Updated just now"
  if (seconds < 60) return `Updated ${seconds} seconds ago`

  const minutes = Math.round(seconds / 60)
  if (minutes < 60)
    return `Updated ${minutes} minute${minutes === 1 ? "" : "s"} ago`

  const hours = Math.round(minutes / 60)
  return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`
}

export interface WorkspacePageProps {
  title: string
  description?: string
  actions?: ReactNode
  /** When true, renders the standard "not available for your role" state instead of `children`. */
  unauthorized?: boolean
  /** A TanStack Query result's `dataUpdatedAt` — 0 means "no successful fetch yet", so nothing renders. */
  lastUpdated?: number
  children?: ReactNode
}

/**
 * The page header and outer landmark every workspace re-implemented by hand
 * (19/19, per the Phase 8a accessibility audit): a labelled section, a real
 * `<h2>`, and the unauthorized-role branch — which previously rendered a bare
 * `<p>` with no heading at all.
 */
export function WorkspacePage({
  title,
  description,
  actions,
  unauthorized = false,
  lastUpdated,
  children,
}: WorkspacePageProps) {
  const headingId = useId()

  if (unauthorized) {
    return (
      <section aria-labelledby={headingId} className="grid gap-4">
        <h2 id={headingId}>{title}</h2>
        <p>This workspace is not available for your role.</p>
      </section>
    )
  }

  return (
    <section aria-labelledby={headingId} className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={headingId}>{title}</h2>
          {description && <p>{description}</p>}
          {lastUpdated !== undefined && lastUpdated > 0 && (
            <p className="text-sm text-muted-foreground">
              <time dateTime={new Date(lastUpdated).toISOString()}>
                {formatRelativeUpdate(lastUpdated)}
              </time>
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}
