"use client"

import { useMemo, useState, type ReactNode } from "react"
import { CalendarDays, ListIcon } from "lucide-react"

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
import { Card } from "@/features/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/features/components/ui/dialog"
import { ToggleGroup, ToggleGroupItem } from "@/features/components/ui/toggle-group"
import { formatTimeRange } from "@/features/lib/format-time"
import { compareBySchedule } from "@/features/lib/schedule-order"
import type { EnrollmentBlock } from "@/features/schemas/enrollment-block-schema"

function displayTimeRange(startsAt: string | null, endsAt: string | null) {
  return startsAt && endsAt
    ? formatTimeRange(startsAt, endsAt)
    : "To be confirmed"
}

function scheduleColumns(): DataTableColumn<
  EnrollmentBlock["subjects"][number]
>[] {
  return [
    { key: "code", header: "Subject code", render: (subject) => subject.code },
    {
      key: "description",
      header: "Description",
      render: (subject) => subject.title,
    },
    { key: "units", header: "Units", render: (subject) => subject.units },
    {
      key: "section-id",
      header: "Section ID",
      render: (subject) => subject.section_id,
    },
    {
      key: "day",
      header: "Day",
      render: (subject) => subject.schedule_days ?? "To be confirmed",
    },
    {
      key: "time",
      header: "Time",
      render: (subject) =>
        displayTimeRange(subject.starts_at_time, subject.ends_at_time),
    },
    {
      key: "room",
      header: "Room",
      render: (subject) => subject.room ?? "To be confirmed",
    },
  ]
}

/** Monday's earliest class first, then Tuesday, … through Saturday — always sorted, no toggle needed since a block's own schedule never changes underneath the student. */
function SectionSchedule({ block }: { block: EnrollmentBlock }) {
  const subjects = [...block.subjects].sort(compareBySchedule)

  return (
    <DataTable
      caption={`${block.block_code} schedule`}
      rowKey={(subject) => subject.section_id}
      rows={subjects}
      columns={scheduleColumns()}
    />
  )
}

function seatLabel(block: EnrollmentBlock) {
  return block.capacity === null
    ? `${block.seats_remaining} seat${block.seats_remaining === 1 ? "" : "s"} available`
    : `${block.capacity} seats`
}

/**
 * Step 1: Section Thumbnail Card / Button.
 * Displays compact thumbnail options (e.g. IT101, IT102) with basic badges
 * and a direct choice button. Schedule list and calendar are hidden until chosen.
 */
function SectionThumbnailCard({
  block,
  onChoose,
  disabled,
}: {
  block: EnrollmentBlock
  onChoose: (blockCode: string) => void
  disabled: boolean
}) {
  const isSelectable = block.is_selectable && !disabled

  return (
    <Card
      role="article"
      aria-label={`${block.block_code} section`}
      className={`group flex flex-col justify-between rounded-xl border p-4 text-center transition-all duration-200 ${
        isSelectable
          ? "hover:border-primary/80 hover:shadow-md hover:bg-muted/10 cursor-pointer"
          : "opacity-60 cursor-not-allowed"
      }`}
      onClick={() => {
        if (isSelectable) onChoose(block.block_code)
      }}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="text-2xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
          {block.block_code}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <Badge variant="secondary">{seatLabel(block)}</Badge>
          <Badge variant="outline">{block.total_units} units</Badge>
          <Badge variant="outline">Year {block.year_level}</Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {block.subjects.length} subject{block.subjects.length === 1 ? "" : "s"}
        </span>

        {block.preference_reasons.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {block.preference_reasons[0]}
          </p>
        )}

        {!block.is_selectable && (
          <Alert variant="destructive" className="mt-2 text-left">
            <AlertDescription className="text-xs">
              {block.reasons[0]?.message ??
                "This section is not currently available for selection."}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="mt-4 border-t pt-3">
        <Button
          type="button"
          disabled={!isSelectable}
          className="w-full"
          onClick={(e) => {
            e.stopPropagation()
            onChoose(block.block_code)
          }}
        >
          Choose {block.block_code}
        </Button>
      </div>
    </Card>
  )
}

/**
 * Step 2: Selected Section Weekly Schedule & Enrollment Submission Modal.
 * Opens as a responsive dialog when a student chooses a section thumbnail.
 * Renders the full schedule (table/calendar view) and submission controls.
 */
function SelectedSectionModal({
  block,
  open,
  onOpenChange,
  disabled,
  renderSelectedFooter,
}: {
  block: EnrollmentBlock
  open: boolean
  onOpenChange: (open: boolean) => void
  disabled: boolean
  renderSelectedFooter: (block: EnrollmentBlock) => ReactNode
}) {
  const [view, setView] = useState<"calendar" | "table">("table")

  const calendarItems: SectionScheduleItem[] = useMemo(() => {
    return block.subjects.map((subject) => ({
      id: subject.section_id,
      subject_code: subject.code,
      subject_title: subject.title,
      units: subject.units,
      section_code: block.block_code,
      room: subject.room,
      professor_name: subject.professor_name,
      schedule_days: subject.schedule_days,
      starts_at_time: subject.starts_at_time,
      ends_at_time: subject.ends_at_time,
      modality: subject.modality ?? null,
      capacity: subject.capacity,
      enrolled_count: subject.enrolled_count,
    }))
  }, [block])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92dvh] max-w-5xl overflow-y-auto sm:max-w-5xl"
        aria-describedby="selected-section-description"
      >
        <div role="article" aria-label={`${block.block_code} section`} className="grid gap-4">
          <DialogHeader className="gap-3 border-b pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <DialogTitle className="text-xl font-bold">
                  Section {block.block_code}
                </DialogTitle>
                <Badge variant="secondary">{seatLabel(block)}</Badge>
                <Badge variant="outline">{block.total_units} units</Badge>
                <Badge variant="outline">Year {block.year_level}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ToggleGroup
                  type="single"
                  value={view}
                  onValueChange={(val) => {
                    if (val === "table" || val === "calendar") setView(val)
                  }}
                  variant="outline"
                  size="sm"
                  aria-label="Section schedule layout"
                >
                  <ToggleGroupItem value="table" aria-label="Schedule list">
                    <ListIcon data-icon="inline-start" aria-hidden="true" />
                    Schedule list
                  </ToggleGroupItem>
                  <ToggleGroupItem value="calendar" aria-label="View in calendar">
                    <CalendarDays data-icon="inline-start" aria-hidden="true" />
                    View in calendar
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
            <DialogDescription id="selected-section-description">
              Year {block.year_level} block section · {block.subjects.length}{" "}
              subject{block.subjects.length === 1 ? "" : "s"} ·{" "}
              {view === "calendar"
                ? "Weekly visual timetable across Monday to Saturday."
                : 'List of scheduled subjects with day, time, and room details. Click "View in calendar" to see the timetable.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-1">
            {view === "calendar" ? (
              <SectionScheduleCalendar items={calendarItems} disabled={disabled} />
            ) : (
              <SectionSchedule block={block} />
            )}
          </div>

          <DialogFooter className="mt-2 flex-wrap items-center justify-between gap-3 border-t pt-4 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Change section
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="text-sm font-semibold px-3 py-1">
                Total units: <span className="ml-1 text-primary">{block.total_units}</span>
              </Badge>
              {renderSelectedFooter(block)}
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Regular-student section and schedule selection.
 * Step 1: Student picks a section from thumbnail boxed buttons (schedules are hidden).
 * Step 2: Clicking a section reveals its schedule modal with table/calendar views and submission controls.
 */
export function EnrollmentSectionTable({
  blocks,
  selectedBlockCode,
  onChoose,
  onChangeSection,
  disabled = false,
  renderSelectedFooter,
}: {
  blocks: readonly EnrollmentBlock[]
  selectedBlockCode: string | null
  onChoose: (blockCode: string) => void
  onChangeSection: () => void
  disabled?: boolean
  renderSelectedFooter: (block: EnrollmentBlock) => ReactNode
}) {
  const selectedBlock = blocks.find(
    (block) => block.block_code === selectedBlockCode,
  )

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {blocks.map((block) => (
          <SectionThumbnailCard
            key={block.block_code}
            block={block}
            onChoose={onChoose}
            disabled={disabled}
          />
        ))}
      </div>

      {selectedBlock && (
        <SelectedSectionModal
          block={selectedBlock}
          open={true}
          onOpenChange={(open) => {
            if (!open) onChangeSection()
          }}
          disabled={disabled}
          renderSelectedFooter={renderSelectedFooter}
        />
      )}
    </>
  )
}
