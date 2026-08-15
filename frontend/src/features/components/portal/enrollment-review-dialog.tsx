"use client"

import { useMemo } from "react"

import {
  DataTable,
  type DataTableColumn,
} from "@/features/components/portal/data-table"
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

type EnrollmentReviewRow = Enrollment["subjects"][number] & {
  units: number | null
  schedule_days: string | null
  starts_at_time: string | null
  ends_at_time: string | null
  room: string | null
}

function formatTimeRange(
  startsAt: string | null,
  endsAt: string | null,
): string {
  if (!startsAt || !endsAt) return "Not assigned"

  return `${startsAt.slice(0, 5)}–${endsAt.slice(0, 5)}`
}

function scheduleColumns(): DataTableColumn<EnrollmentReviewRow>[] {
  return [
    {
      key: "subject-code",
      header: "Subject code",
      render: (row) => row.subject_code,
    },
    {
      key: "description",
      header: "Description",
      render: (row) => row.subject_title,
    },
    { key: "units", header: "Units", render: (row) => row.units ?? "—" },
    {
      key: "section-id",
      header: "Section ID",
      render: (row) => row.section_id,
    },
    {
      key: "day",
      header: "Day",
      render: (row) => row.schedule_days ?? "Not assigned",
    },
    {
      key: "time",
      header: "Time",
      render: (row) => formatTimeRange(row.starts_at_time, row.ends_at_time),
    },
    {
      key: "room",
      header: "Room",
      render: (row) => row.room ?? "Not assigned",
    },
  ]
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
      const section = sections.find((item) => item.id === enrolled.section_id)
      const subject = section
        ? subjects.find((item) => item.id === section.subject_id)
        : undefined

      return {
        ...enrolled,
        units: subject?.units ?? null,
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
      <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>
            Review enrollment{enrollment ? ` #${enrollment.id}` : ""}
          </DialogTitle>
          <DialogDescription>
            {enrollment ? `${enrollment.total_units} total units` : ""}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-3">
          <div className="grid gap-1">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium">{enrollment?.student_name ?? "—"}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-muted-foreground">Year</dt>
            <dd className="font-medium">
              {enrollment?.student_year_level
                ? `Year ${enrollment.student_year_level}`
                : "—"}
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-muted-foreground">Student number</dt>
            <dd className="font-medium">{enrollment?.student_number ?? "—"}</dd>
          </div>
        </dl>
        {isLoading ? (
          <div
            className="grid gap-3"
            role="status"
            aria-label="Loading subjects and schedule"
          >
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This enrollment has no subjects on record.
          </p>
        ) : (
          <>
            <DataTable
              caption={`Enrollment #${enrollment?.id ?? "—"} schedule`}
              columns={scheduleColumns()}
              rowKey={(row) => row.section_id}
              rows={rows}
            />
            <p className="text-sm text-muted-foreground">
              {rows.length} subject{rows.length === 1 ? "" : "s"} · {totalUnits}{" "}
              unit
              {totalUnits === 1 ? "" : "s"} total
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
