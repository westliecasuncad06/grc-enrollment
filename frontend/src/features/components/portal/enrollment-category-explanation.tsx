"use client"

import { Info } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/features/components/ui/alert"
import type { AudienceAvailability } from "@/features/schemas/enrollment-window-schema"

/**
 * Explains why the student is seeing the block flow or the per-subject flow
 * this term — the underlying rule (`ClassifyEnrollmentStanding`) is
 * re-derived live every time the student's enrollment page loads (and
 * eagerly on every grade lock too), so this is always describing live
 * status, never a manual label. Presentational only, same
 * shape as `EnrollmentAvailabilityBanner`: the caller supplies `viewer` from
 * the shared `enrollment-windows` fetch, and a null/undefined viewer (a
 * non-student session, or one still loading) renders nothing.
 */
export function EnrollmentCategoryExplanation({
  viewer,
}: {
  viewer: AudienceAvailability | null | undefined
}) {
  if (!viewer) return null

  const isIrregular = viewer.audience === "irregular"

  return (
    <Alert>
      <Info aria-hidden="true" />
      <AlertTitle>
        {isIrregular
          ? "You're Irregular this semester"
          : "You're Regular this semester"}
      </AlertTitle>
      <AlertDescription>
        {isIrregular
          ? "At least one subject from a semester you've already completed still needs to be resolved — failed, marked Incomplete, Not Complete, Dropped, or never taken — shown as “Backlog” below. You'll enroll by picking a section per subject instead of a whole block. Once those subjects are resolved and your grades are finalized, you'll return to Regular automatically."
          : "Every subject from every semester you've already completed has a passing, on-time grade — so you'll enroll by picking one section for your whole block. If a subject from a finished semester is ever left unresolved, you'll switch to Irregular and enroll per subject until it's cleared."}
      </AlertDescription>
    </Alert>
  )
}
