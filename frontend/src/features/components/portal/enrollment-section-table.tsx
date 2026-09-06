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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
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
 * Step 1: Section Summary Card.
 * Regular students choose a section first without the schedule timetable expanded.
 */
function SectionSummaryCard({
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
      className={`flex flex-col justify-between transition-all duration-200 ${
        isSelectable
          ? "hover:border-primary/60 hover:shadow-sm"
          : "opacity-85"
      }`}
    >
      <CardHeader className="gap-2 border-b pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <CardTitle level={2} className="text-xl font-bold">
              {block.block_code}
            </CardTitle>
            <Badge variant="secondary">{seatLabel(block)}</Badge>
            <Badge variant="outline">{block.total_units} units</Badge>
          </div>
          <Badge variant="outline">Year {block.year_level}</Badge>
        </div>
        <CardDescription>
          {block.subjects.length} subject
          {block.subjects.length === 1 ? "" : "s"} included in this section
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-3 pt-3">
        <div className="grid gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Included subjects
          </span>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {block.subjects.map((subject) => (
              <li
                key={subject.section_id}
                className="flex items-center justify-between rounded border border-border/60 bg-muted/20 px-2.5 py-1 text-xs"
              >
                <span className="truncate font-medium text-foreground">
                  <span>{subject.code}</span>
                  <span className="font-normal text-muted-foreground"> · </span>
                  <span className="font-normal text-muted-foreground">
                    {subject.title}
                  </span>
                </span>
                <span className="ml-2 shrink-0 font-mono text-muted-foreground">
                  {subject.units}u
                </span>
              </li>
            ))}
          </ul>
        </div>

        {block.preference_reasons.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {block.preference_reasons[0]}
          </p>
        )}

        {!block.is_selectable && (
          <Alert variant="destructive">
            <AlertDescription>
              {block.reasons[0]?.message ??
                "This section is not currently available for selection."}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex justify-end border-t pt-3">
        <Button
          type="button"
          disabled={!isSelectable}
          onClick={() => onChoose(block.block_code)}
        >
          Choose {block.block_code}
        </Button>
      </CardFooter>
    </Card>
  )
}

/**
 * Step 2: Selected Section Weekly Schedule & Enrollment Submission.
 * Displayed once a student chooses a section. Renders the full timetable/table
 * and enables schedule selection & enrollment submission.
 */
function SelectedSectionCard({
  block,
  onChangeSection,
  disabled,
  renderSelectedFooter,
}: {
  block: EnrollmentBlock
  onChangeSection: () => void
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
    <Card role="article" aria-label={`${block.block_code} section`}>
      <CardHeader className="gap-3 border-b">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle level={2}>{block.block_code}</CardTitle>
            <Badge variant="secondary">{seatLabel(block)}</Badge>
            <Badge variant="outline">{block.total_units} units</Badge>
          </div>
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
            <ToggleGroupItem value="table" aria-label="Table view">
              <ListIcon data-icon="inline-start" aria-hidden="true" />
              Table
            </ToggleGroupItem>
            <ToggleGroupItem value="calendar" aria-label="Calendar view">
              <CalendarDays data-icon="inline-start" aria-hidden="true" />
              Calendar
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <CardDescription>
          Year {block.year_level} block section · {block.subjects.length}{" "}
          subject
          {block.subjects.length === 1 ? "" : "s"} · Review the weekly schedule below before submitting enrollment.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4">
        {view === "calendar" ? (
          <SectionScheduleCalendar items={calendarItems} disabled={disabled} />
        ) : (
          <SectionSchedule block={block} />
        )}

        <div className="grid gap-3 border-t pt-4 sm:flex sm:items-center sm:justify-between">
          <Button type="button" variant="outline" onClick={onChangeSection}>
            Change section
          </Button>
          {renderSelectedFooter(block)}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Regular-student section and schedule selection.
 * Step 1: Student picks a section from available section summary cards (schedules are hidden).
 * Step 2: Clicking a section reveals its weekly schedule (table / calendar) and schedule submission controls.
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

  if (selectedBlock) {
    return (
      <SelectedSectionCard
        block={selectedBlock}
        onChangeSection={onChangeSection}
        disabled={disabled}
        renderSelectedFooter={renderSelectedFooter}
      />
    )
  }

  return (
    <div className="grid gap-4">
      {blocks.map((block) => (
        <SectionSummaryCard
          key={block.block_code}
          block={block}
          onChoose={onChoose}
          disabled={disabled}
        />
      ))}
    </div>
  )
}
