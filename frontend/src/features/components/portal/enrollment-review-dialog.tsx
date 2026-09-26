"use client"

import { useMemo, useState } from "react"

import { CalendarDays, CheckCircle2, ListIcon, TriangleAlert } from "lucide-react"

import {
  DataTable,
  type DataTableColumn,
} from "@/features/components/portal/data-table"
import { ProspectusDocument } from "@/features/components/portal/prospectus-document"
import {
  SectionScheduleCalendar,
  type SectionScheduleItem,
} from "@/features/components/portal/section-schedule-calendar"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/features/components/ui/dialog"
import { Skeleton } from "@/features/components/ui/skeleton"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/features/components/ui/toggle-group"
import {
  useSectionsQuery,
  useSubjectsQuery,
} from "@/features/hooks/use-reference-data"
import { formatYearLevelOrdinal } from "@/features/lib/curriculum-ordinal"
import { findConflictingIds } from "@/features/lib/room-calendar"
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
  const [prospectusOpen, setProspectusOpen] = useState(false)
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

  const [view, setView] = useState<"table" | "calendar">("table")
  const totalUnits = rows.reduce((sum, row) => sum + (row.units ?? 0), 0)

  const calendarItems: SectionScheduleItem[] = useMemo(() => {
    return rows.map((row) => ({
      id: row.section_id,
      subject_code: row.subject_code,
      subject_title: row.subject_title,
      units: row.units,
      section_code: row.section_code ?? `Section #${row.section_id}`,
      room: row.room,
      professor_name: null,
      schedule_days: row.schedule_days,
      starts_at_time: row.starts_at_time,
      ends_at_time: row.ends_at_time,
      modality: null,
    }))
  }, [rows])

  const conflictingIds = useMemo(
    () => findConflictingIds(calendarItems, (item) => item.id),
    [calendarItems],
  )

  return (
    <>
      <Dialog open={enrollment !== null} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-6xl">
          <DialogHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <DialogTitle>
                Review enrollment{enrollment ? ` #${enrollment.id}` : ""}
              </DialogTitle>
              <DialogDescription>
                {enrollment ? `${enrollment.total_units} total units` : ""}
              </DialogDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {enrollment?.student_id && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setProspectusOpen(true)}
                >
                  View Prospectus
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* Normalized Student Overview & Pre-Flight Checks */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1 rounded-lg border bg-muted/20 p-3 text-sm">
              <span className="text-xs text-muted-foreground">Student</span>
              <span className="font-semibold text-foreground truncate">
                {enrollment?.student_name ?? "—"}
              </span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>{enrollment?.student_number ?? "—"}</span>
                <span>·</span>
                <span>{formatYearLevelOrdinal(enrollment?.student_year_level)}</span>
              </div>
            </div>

            <div className="grid gap-1 rounded-lg border bg-muted/20 p-3 text-sm">
              <span className="text-xs text-muted-foreground">Academic Load</span>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-foreground">
                  {rows.length}
                </span>
                <span className="text-xs text-muted-foreground">subjects</span>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-base font-bold text-foreground">
                  {totalUnits}
                </span>
                <span className="text-xs text-muted-foreground">units</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Assessed for Term 6
              </span>
            </div>

            <div className="grid gap-1 rounded-lg border bg-muted/20 p-3 text-sm">
              <span className="text-xs text-muted-foreground">Unit Overload Status</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {enrollment?.requires_overload_approval ? (
                  <Badge variant="destructive" className="font-semibold text-xs">
                    Overload Approved
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs font-medium">
                    Within Regular Load
                  </Badge>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground">
                {enrollment?.requires_overload_approval
                  ? "Requires Program Head sign-off"
                  : "Standard prescribed ceiling"}
              </span>
            </div>

            <div className="grid gap-1 rounded-lg border bg-muted/20 p-3 text-sm">
              <span className="text-xs text-muted-foreground">Timetable Conflict Check</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {conflictingIds.size > 0 ? (
                  <Badge variant="destructive" className="flex items-center gap-1 text-xs font-semibold">
                    <TriangleAlert className="size-3.5" aria-hidden="true" />
                    {conflictingIds.size} Conflict(s) Detected
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="flex items-center gap-1 text-xs font-semibold border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    Zero Schedule Conflicts
                  </Badge>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground">
                {conflictingIds.size > 0
                  ? "Requires section re-selection"
                  : "All days & times compatible"}
              </span>
            </div>
          </div>

          {/* View Switcher Controls */}
          <div className="flex items-center justify-between border-b pb-2 pt-1">
            <h3 className="text-sm font-semibold text-foreground">
              Selected Subject Schedule
            </h3>
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(val) => {
                if (val === "table" || val === "calendar") setView(val)
              }}
              variant="outline"
              size="sm"
              aria-label="Schedule layout view"
            >
              <ToggleGroupItem value="table" aria-label="Table view">
                <ListIcon data-icon="inline-start" aria-hidden="true" />
                Table view
              </ToggleGroupItem>
              <ToggleGroupItem value="calendar" aria-label="Calendar view">
                <CalendarDays data-icon="inline-start" aria-hidden="true" />
                Calendar timetable
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

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
          ) : view === "table" ? (
            <>
              <DataTable
                caption={`Enrollment #${enrollment?.id ?? "—"} schedule`}
                columns={scheduleColumns()}
                rowKey={(row) => row.section_id}
                rows={rows}
              />
              <p className="text-xs text-muted-foreground text-right">
                Showing {rows.length} subjects · {totalUnits} units total
              </p>
            </>
          ) : (
            <div className="rounded-xl border bg-card p-3">
              <SectionScheduleCalendar
                items={calendarItems}
                disabled={true}
                emptyMessage="No weekly timetable slots scheduled."
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    <Dialog open={prospectusOpen} onOpenChange={setProspectusOpen}>
      <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            Student Prospectus — {enrollment?.student_name ?? enrollment?.student_number}
          </DialogTitle>
        </DialogHeader>
        {enrollment?.student_id && (
          <ProspectusDocument studentId={enrollment.student_id} />
        )}
      </DialogContent>
    </Dialog>
  </>
  )
}
