"use client"

import { useMemo } from "react"

import { Badge } from "@/features/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/features/components/ui/dialog"
import { Skeleton } from "@/features/components/ui/skeleton"
import {
  useSectionsQuery,
  useSubjectsQuery,
} from "@/features/hooks/use-reference-data"
import type { Enrollment } from "@/features/schemas/enrollment-schema"

function formatMeeting(
  days: string | null,
  startsAt: string | null,
  endsAt: string | null,
): string {
  if (!days || !startsAt || !endsAt) return "Not assigned"

  return `${days} · ${startsAt.slice(0, 5)}–${endsAt.slice(0, 5)}`
}

/**
 * Lets Registrar Staff see exactly which subjects and sections a student
 * selected — with each section's schedule and unit count — before deciding
 * on the enrollment. Sections/subjects are reference data every role may
 * already read (`SectionPolicy`/`SubjectPolicy` `viewAny`); this joins them
 * client-side against the enrollment's own `subjects[].section_id`, the
 * same pattern `MasterScheduleWorkspace` already uses for published
 * sections.
 */
export function EnrollmentReviewDialog({
  enrollment,
  onOpenChange,
}: {
  enrollment: Enrollment | null
  onOpenChange: (open: boolean) => void
}) {
  const sectionsQuery = useSectionsQuery({ enabled: enrollment !== null })
  const subjectsQuery = useSubjectsQuery({ enabled: enrollment !== null })
  const isLoading = sectionsQuery.isPending || subjectsQuery.isPending

  const rows = useMemo(() => {
    if (!enrollment) return []
    const sections = sectionsQuery.data ?? []
    const subjects = subjectsQuery.data ?? []

    return enrollment.subjects.map((enrolled) => {
      const section = sections.find(
        (item) => item.id === enrolled.section_id,
      )
      const subject = section
        ? subjects.find((item) => item.id === section.subject_id)
        : undefined

      return {
        ...enrolled,
        units: subject?.units ?? null,
        section_code: section?.section_code ?? null,
        schedule_days: section?.schedule_days ?? null,
        starts_at_time: section?.starts_at_time ?? null,
        ends_at_time: section?.ends_at_time ?? null,
        room: section?.room ?? null,
      }
    })
  }, [enrollment, sectionsQuery.data, subjectsQuery.data])

  const totalUnits = rows.reduce((sum, row) => sum + (row.units ?? 0), 0)

  return (
    <Dialog open={enrollment !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Review enrollment{enrollment ? ` #${enrollment.id}` : ""}
          </DialogTitle>
          <DialogDescription>
            {enrollment?.student_number}
            {enrollment ? ` · ${enrollment.total_units} total units` : ""}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="grid gap-3" role="status" aria-label="Loading subjects and schedule">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This enrollment has no subjects on record.
          </p>
        ) : (
          <>
            <ul className="grid gap-3">
              {rows.map((row) => (
                <li key={row.section_id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {row.subject_code} — {row.subject_title}
                    </p>
                    <Badge variant="outline">
                      {row.units ?? "—"} unit{row.units === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <div>
                      <dt className="inline">Section: </dt>
                      <dd className="inline font-medium text-foreground">
                        {row.section_code ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">Schedule: </dt>
                      <dd className="inline font-medium text-foreground">
                        {formatMeeting(
                          row.schedule_days,
                          row.starts_at_time,
                          row.ends_at_time,
                        )}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="inline">Room: </dt>
                      <dd className="inline font-medium text-foreground">
                        {row.room ?? "Not assigned"}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              {rows.length} subject{rows.length === 1 ? "" : "s"} · {totalUnits} unit
              {totalUnits === 1 ? "" : "s"} total
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
