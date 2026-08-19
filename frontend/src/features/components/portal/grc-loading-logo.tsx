import { cn } from "@/features/lib/utils"

interface GrcLoadingLogoProps {
  label?: string
  fullPage?: boolean
}

/**
 * The shared visual identity for route and default workspace loading states.
 * Callers keep control of data-dense skeleton layouts through AsyncBoundary's
 * `loadingFallback`; this component covers the otherwise unbranded default.
 */
export function GrcLoadingLogo({
  label = "Loading…",
  fullPage = false,
}: GrcLoadingLogoProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "flex items-center justify-center gap-3 text-muted-foreground",
        fullPage && "min-h-svh bg-background px-6",
      )}
    >
      <div className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_10px_28px_color-mix(in_srgb,var(--primary)_28%,transparent)]">
        <span
          aria-hidden="true"
          className="absolute -inset-1.5 rounded-2xl border border-institutional-gold/75 motion-safe:animate-[spin_3s_linear_infinite] motion-reduce:animate-none"
        />
        <span
          aria-hidden="true"
          className="font-heading text-sm font-semibold tracking-[0.12em]"
        >
          GRC
        </span>
      </div>
      <p className="font-medium tracking-[0.01em]">{label}</p>
    </div>
  )
}
