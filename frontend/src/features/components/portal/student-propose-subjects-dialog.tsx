"use client"

import { useMemo, useState } from "react"

import {
  CalendarDays,
  CheckCircle2,
  ListIcon,
  Trash2,
  TriangleAlert,
} from "lucide-react"

import {
  DataTable,
  type DataTableColumn,
} from "@/features/components/portal/data-table"
import {
  SectionScheduleCalendar,
  type SectionScheduleItem,
} from "@/features/components/portal/section-schedule-calendar"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/features/components/ui/dialog"
import { SearchableCombobox } from "@/features/components/ui/searchable-combobox"
import { Skeleton } from "@/features/components/ui/skeleton"
import { Textarea } from "@/features/components/ui/textarea"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/features/components/ui/toggle-group"
import { useReviseEnrollmentSubjectsMutation } from "@/features/hooks/use-enrollment"
import {
  useSectionsQuery,
  useSubjectsQuery,
} from "@/features/hooks/use-reference-data"
import { formatClockTime, formatTimeRange } from "@/features/lib/format-time"
import { findConflictingIds } from "@/features/lib/room-calendar"
import { isApiClientError } from "@/features/services/api-client"
import type { Enrollment } from "@/features/schemas/enrollment-schema"

interface ProposedRow {
  section_id: number
  subject_code: string
  subject_title: string
  section_code: string | null
  units: number | null
  schedule_days: string | null
  starts_at_time: string | null
  ends_at_time: string | null
  room: string | null
}

function displayTimeRange(
  startsAt: string | null,
  endsAt: string | null,
): string {
  if (!startsAt || !endsAt) return "Not assigned"
  return formatTimeRange(startsAt, endsAt)
}

export function StudentProposeSubjectsDialog({
  enrollment,
  open,
  onOpenChange,
  onProposed,
}: {
  enrollment: Enrollment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onProposed?: (enrollment: Enrollment) => void
}) {
  const sectionsQuery = useSectionsQuery({ enabled: open && enrollment !== null })
  const subjectsQuery = useSubjectsQuery({ enabled: open && enrollment !== null })
  const isLoading = sectionsQuery.isPending || subjectsQuery.isPending

  const originalSectionIds = useMemo(
    () =>
      (enrollment?.subjects ?? [])
        .filter((s) => s.status !== "dropped")
        .map((s) => s.section_id),
    [enrollment],
  )

  const [pendingSectionIds, setPendingSectionIds] = useState<number[] | null>(null)
  const [initializedFor, setInitializedFor] = useState<number | null>(null)
  const [proposalNote, setProposalNote] = useState("")

  if (enrollment && initializedFor !== enrollment.id) {
    setInitializedFor(enrollment.id)
    setPendingSectionIds(null)
    setProposalNote("")
  }

  const currentSectionIds = pendingSectionIds ?? originalSectionIds
  const reviseMutation = useReviseEnrollmentSubjectsMutation()
  const [proposalError, setProposalError] = useState<string | null>(null)
  const [view, setView] = useState<"table" | "calendar">("table")

  const rows: ProposedRow[] = useMemo(() => {
    if (!enrollment) return []
    const sections = sectionsQuery.data ?? []
    const subjects = subjectsQuery.data ?? []

    return currentSectionIds.map((sectionId) => {
      const section = sections.find((item) => item.id === sectionId)
      const subject = section
        ? subjects.find((item) => item.id === section.subject_id)
        : undefined
      const original = enrollment.subjects.find(
        (s) => s.section_id === sectionId,
      )

      return {
        section_id: sectionId,
        subject_code: subject?.code ?? original?.subject_code ?? `#${sectionId}`,
        subject_title: subject?.title ?? original?.subject_title ?? "—",
        section_code: section?.section_code ?? original?.section_code ?? null,
        units: subject?.units ?? original?.units ?? null,
        schedule_days: section?.schedule_days ?? original?.schedule_days ?? null,
        starts_at_time: section?.starts_at_time ?? original?.starts_at_time ?? null,
        ends_at_time: section?.ends_at_time ?? original?.ends_at_time ?? null,
        room: section?.room ?? original?.room ?? null,
      }
    })
  }, [enrollment, sectionsQuery.data, subjectsQuery.data, currentSectionIds])

  const addableOptions = useMemo(() => {
    if (!enrollment) return []
    const subjects = subjectsQuery.data ?? []

    return (sectionsQuery.data ?? [])
      .filter((s) => s.academic_term_id === enrollment.academic_term_id)
      .filter((s) => !currentSectionIds.includes(s.id))
      .filter((s) => s.remaining_seats > 0)
      .map((s) => {
        const subject = subjects.find((subj) => subj.id === s.subject_id)
        const schedule =
          s.schedule_days && s.starts_at_time && s.ends_at_time
            ? ` · ${s.schedule_days} ${formatTimeRange(s.starts_at_time, s.ends_at_time)}`
            : s.schedule_days && s.starts_at_time
              ? ` · ${s.schedule_days} ${formatClockTime(s.starts_at_time)}`
              : ""

        return {
          value: String(s.id),
          label: `${subject?.code ?? "Subject"} — Section ${s.section_code}${schedule} (${s.remaining_seats} seats)`,
        }
      })
  }, [enrollment, sectionsQuery.data, subjectsQuery.data, currentSectionIds])

  const totalUnits = rows.reduce((sum, row) => sum + (row.units ?? 0), 0)
  const regularMax = enrollment?.regular_unit_maximum ?? 24
  const overloadMax = enrollment?.unit_maximum ?? null
  const isOverload = totalUnits > regularMax
  const isBeyondHardCap = overloadMax !== null && totalUnits > overloadMax

  const calendarItems: SectionScheduleItem[] = useMemo(() => {
    return rows.map((row) => ({
      id: row.section_id,
      subject_code: row.subject_code,
      subject_title: row.subject_title,
      units: row.units,
      section_code: row.section_code,
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

  function handleAddSection(value: string) {
    const sectionId = Number(value)
    if (!Number.isInteger(sectionId)) return
    setPendingSectionIds([...currentSectionIds, sectionId])
    setProposalError(null)
  }

  function handleRemoveSection(sectionId: number) {
    if (currentSectionIds.length <= 1) return
    setPendingSectionIds(currentSectionIds.filter((id) => id !== sectionId))
    setProposalError(null)
  }

  function handleSendProposal() {
    if (!enrollment) return
    if (proposalNote.trim() === "") {
      setProposalError("Tell your Program Chair why you are proposing these subjects.")
      return
    }
    if (currentSectionIds.length === 0) {
      setProposalError("Select at least one subject to propose.")
      return
    }
    if (isBeyondHardCap) {
      setProposalError(`Total units (${totalUnits}) exceeds the maximum allowed load of ${overloadMax} units.`)
      return
    }
    if (conflictingIds.size > 0) {
      setProposalError("Some of the selected subjects have overlapping class hours. Please resolve schedule conflicts.")
      return
    }

    setProposalError(null)
    reviseMutation.mutate(
      {
        id: enrollment.id,
        sectionIds: currentSectionIds,
        note: proposalNote.trim(),
        overloadAcknowledged: isOverload,
      },
      {
        onSuccess: (updated) => {
          onProposed?.(updated)
          onOpenChange(false)
        },
        onError: (err: unknown) => {
          const fieldErrors = isApiClientError(err)
            ? Object.values(err.fieldErrors ?? {}).flat()
            : []
          setProposalError(
            fieldErrors[0] ??
              (err instanceof Error
                ? err.message
                : "Could not submit your subject proposal. Please try again."),
          )
        },
      },
    )
  }

  const columns: DataTableColumn<ProposedRow>[] = [
    {
      key: "code",
      header: "Subject code",
      render: (row) => (
        <span className="font-mono font-semibold">{row.subject_code}</span>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (row) => row.subject_title,
    },
    {
      key: "units",
      header: "Units",
      render: (row) => row.units ?? "—",
    },
    {
      key: "section",
      header: "Section",
      render: (row) => row.section_code ?? "—",
    },
    {
      key: "day",
      header: "Day",
      render: (row) => row.schedule_days ?? "Not assigned",
    },
    {
      key: "time",
      header: "Time",
      render: (row) => displayTimeRange(row.starts_at_time, row.ends_at_time),
    },
    {
      key: "room",
      header: "Room",
      render: (row) => row.room ?? "Not assigned",
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={currentSectionIds.length <= 1}
          onClick={() => handleRemoveSection(row.section_id)}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" />
          <span className="sr-only">Remove {row.subject_code}</span>
        </Button>
      ),
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"
        aria-describedby="propose-subjects-description"
      >
        <DialogHeader>
          <DialogTitle>Propose different subjects</DialogTitle>
          <DialogDescription id="propose-subjects-description">
            Customize the subjects and sections you want to take and submit them to your Program Chair for review.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Academic Load & Status Bar */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 p-3">
                <span className="text-xs text-muted-foreground">Proposed Load</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-bold">{totalUnits}</span>
                  <span className="text-xs text-muted-foreground">units ({rows.length} subjects)</span>
                </div>
                <span className="text-xs text-muted-foreground block mt-1">
                  Allowed regular: <strong className="font-semibold">{regularMax} units</strong>
                  {overloadMax ? ` · max ${overloadMax}` : ""}
                </span>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3">
                <span className="text-xs text-muted-foreground">Unit Overload Status</span>
                <div className="mt-1">
                  {isBeyondHardCap ? (
                    <Badge variant="destructive">Exceeds Maximum Cap</Badge>
                  ) : isOverload ? (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-900 border-amber-300">
                      Overload (Requires Chair Approval)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 bg-emerald-50">
                      Within Regular Load
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground block mt-1">
                  {isOverload ? "Requires Program Chair review" : "Standard academic load"}
                </span>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3">
                <span className="text-xs text-muted-foreground">Schedule Conflict Check</span>
                <div className="mt-1 flex items-center gap-1.5">
                  {conflictingIds.size > 0 ? (
                    <>
                      <TriangleAlert className="size-4 text-destructive" />
                      <span className="text-sm font-semibold text-destructive">
                        {conflictingIds.size} conflict{conflictingIds.size > 1 ? "s" : ""} detected
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-700">Zero Schedule Conflicts</span>
                    </>
                  )}
                </div>
                <span className="text-xs text-muted-foreground block mt-1">
                  {conflictingIds.size > 0 ? "Resolve overlapping hours" : "All days & times compatible"}
                </span>
              </div>
            </div>

            {/* Subject Selector Combobox */}
            <div className="space-y-1.5">
              <SearchableCombobox
                id="search-add-subject"
                label="Add a subject or section"
                options={addableOptions}
                value=""
                onValueChange={handleAddSection}
                placeholder="Search an available subject or section to add…"
                emptyMessage="No more open sections available for this term."
              />
            </div>

            {/* View Switcher and Subject List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Your Proposed Schedule</span>
                <ToggleGroup
                  type="single"
                  value={view}
                  onValueChange={(val) => {
                    if (val === "table" || val === "calendar") setView(val)
                  }}
                  variant="outline"
                  size="sm"
                  aria-label="Proposed schedule view"
                >
                  <ToggleGroupItem value="table" aria-label="Table view">
                    <ListIcon className="size-4 mr-1.5" />
                    Table view
                  </ToggleGroupItem>
                  <ToggleGroupItem value="calendar" aria-label="Calendar timetable">
                    <CalendarDays className="size-4 mr-1.5" />
                    Calendar timetable
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {view === "table" ? (
                <div className="rounded-lg border overflow-hidden">
                  <DataTable
                    caption="Proposed subject schedule"
                    columns={columns}
                    rowKey={(row) => row.section_id}
                    rows={rows}
                  />
                </div>
              ) : (
                <div className="rounded-lg border bg-card p-2">
                  <SectionScheduleCalendar
                    items={calendarItems}
                    disabled={true}
                    emptyMessage="No timetable slots found for proposed subjects."
                  />
                </div>
              )}
            </div>

            {/* Reason / Note Textarea */}
            <div className="space-y-1.5 pt-2 border-t">
              <label htmlFor="proposal-note" className="text-xs font-medium text-foreground">
                Why are you proposing these subjects? <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="proposal-note"
                placeholder="Explain to your Program Chair why you are proposing these subjects (e.g. work schedule availability or preferred course path)…"
                value={proposalNote}
                onChange={(e) => {
                  setProposalNote(e.target.value)
                  if (proposalError) setProposalError(null)
                }}
                rows={3}
              />
            </div>

            {proposalError && (
              <Alert variant="destructive">
                <AlertDescription>{proposalError}</AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                disabled={reviseMutation.isPending}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={reviseMutation.isPending || rows.length === 0 || isBeyondHardCap || conflictingIds.size > 0}
                onClick={handleSendProposal}
              >
                {reviseMutation.isPending ? "Submitting proposal…" : "Submit proposal to Program Chair"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

