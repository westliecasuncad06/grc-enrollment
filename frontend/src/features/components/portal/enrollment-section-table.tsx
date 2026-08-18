"use client"

import type { ReactNode } from "react"

import {
  DataTable,
  type DataTableColumn,
} from "@/features/components/portal/data-table"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import type { EnrollmentBlock } from "@/features/schemas/enrollment-block-schema"

function displayTimeRange(startsAt: string | null, endsAt: string | null) {
  return startsAt && endsAt
    ? `${startsAt.slice(0, 5)}–${endsAt.slice(0, 5)}`
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

function SectionSchedule({ block }: { block: EnrollmentBlock }) {
  return (
    <DataTable
      caption={`${block.block_code} schedule`}
      rowKey={(subject) => subject.section_id}
      rows={block.subjects}
      columns={scheduleColumns()}
    />
  )
}

function seatLabel(block: EnrollmentBlock) {
  return block.capacity === null
    ? `${block.seats_remaining} seat${block.seats_remaining === 1 ? "" : "s"} available`
    : `${block.capacity} seats`
}

function SectionCard({
  block,
  selected,
  onChoose,
  onChangeSection,
  disabled,
  renderSelectedFooter,
}: {
  block: EnrollmentBlock
  selected: boolean
  onChoose: (blockCode: string) => void
  onChangeSection: () => void
  disabled: boolean
  renderSelectedFooter: (block: EnrollmentBlock) => ReactNode
}) {
  return (
    <Card role="article" aria-label={`${block.block_code} section`}>
      <CardHeader className="gap-3 border-b">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle level={2}>{block.block_code}</CardTitle>
          <Badge variant="secondary">{seatLabel(block)}</Badge>
          <Badge variant="outline">{block.total_units} units</Badge>
        </div>
        <CardDescription>
          Year {block.year_level} block section · {block.subjects.length}{" "}
          subject
          {block.subjects.length === 1 ? "" : "s"}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4">
        <SectionSchedule block={block} />

        {selected ? (
          <div className="grid gap-3 border-t pt-4 sm:flex sm:items-center sm:justify-between">
            <Button type="button" variant="outline" onClick={onChangeSection}>
              Change section
            </Button>
            {renderSelectedFooter(block)}
          </div>
        ) : block.is_selectable ? (
          <div className="flex justify-end border-t pt-4">
            <Button
              type="button"
              disabled={disabled}
              onClick={() => onChoose(block.block_code)}
            >
              Choose {block.block_code}
            </Button>
          </div>
        ) : (
          <Alert variant="destructive">
            <AlertDescription>
              {block.reasons[0]?.message ??
                "This section is not currently available for selection."}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Regular-student block selection. Every available block now exposes its full
 * subject schedule inline, so choosing a section never requires a picker
 * modal.
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
      <SectionCard
        block={selectedBlock}
        selected
        onChoose={onChoose}
        onChangeSection={onChangeSection}
        disabled={disabled}
        renderSelectedFooter={renderSelectedFooter}
      />
    )
  }

  return (
    <div className="grid gap-4">
      {blocks.map((block) => (
        <SectionCard
          key={block.block_code}
          block={block}
          selected={false}
          onChoose={onChoose}
          onChangeSection={onChangeSection}
          disabled={disabled}
          renderSelectedFooter={renderSelectedFooter}
        />
      ))}
    </div>
  )
}
