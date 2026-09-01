"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Drives the print CSS in `globals.css`'s `@media print` block: sets
 * `document.body.dataset.printing` immediately before `window.print()` so
 * only the caller's `[data-print-region]` renders, and clears it once
 * printing finishes.
 *
 * `afterprint` is the primary cleanup signal, but Safari does not
 * reliably fire it for a synchronous `window.print()` call — the
 * `setTimeout(0)` fallback clears the flag on the next tick regardless, so
 * a Safari user is never left with a stuck "printing" state.
 */
export function usePrintDocument(): { print: () => void; isPrinting: boolean } {
  const [isPrinting, setIsPrinting] = useState(false)
  const cleanupTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    document.body.removeAttribute("data-printing")
    setIsPrinting(false)
  }, [])

  useEffect(() => {
    window.addEventListener("afterprint", clear)

    return () => {
      window.removeEventListener("afterprint", clear)
      if (cleanupTimeout.current) clearTimeout(cleanupTimeout.current)
      // Unmounting mid-print should not leave a stale attribute behind for
      // whatever renders next.
      document.body.removeAttribute("data-printing")
    }
  }, [clear])

  const print = useCallback(() => {
    document.body.setAttribute("data-printing", "document")
    setIsPrinting(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print()
      })
    })
    if (cleanupTimeout.current) clearTimeout(cleanupTimeout.current)
    cleanupTimeout.current = setTimeout(clear, 2000)
  }, [clear])

  return { print, isPrinting }
}
