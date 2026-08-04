"use client"

import type { ReactNode } from "react"

import { Button } from "@/features/components/ui/button"
import { usePrintDocument } from "@/features/hooks/use-print-document"
import { cn } from "@/features/lib/utils"

/**
 * Wraps printable content in the `[data-print-region]`/`.print-document`
 * hooks `globals.css`'s `@media print` rules key on. `actions` (e.g. a
 * `PrintButton`) renders above the document and is hidden from print via
 * `print:hidden` — same convention as everywhere else in the portal.
 */
export function PrintDocument({
  title,
  actions,
  children,
  className,
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className="grid gap-3">
      {actions && (
        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <h2 className="text-lg font-semibold">{title}</h2>
          {actions}
        </div>
      )}
      <div data-print-region className={cn("print-document", className)}>
        {children}
      </div>
    </div>
  )
}

export function PrintButton({
  label = "Print / download",
}: {
  label?: string
}) {
  const { print, isPrinting } = usePrintDocument()

  return (
    <Button type="button" variant="outline" onClick={print} disabled={isPrinting}>
      {label}
    </Button>
  )
}
