"use client"

import { DataTable } from "@/features/components/portal/data-table"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import type { EnrollmentBlock } from "@/features/schemas/enrollment-block-schema"

const MODALITY_LABEL: Record<string, string> = {
  online: "Online",
  hyflex_a: "HyFlex A",
  hyflex_b: "HyFlex B",
  f2f: "Face-to-face",
}

/**
 * One section a regular student may choose as a unit — every subject in it
 * enrolls together, so this shows the full weekly schedule rather than a
 * single subject's detail. `block.block_code` is the school's own section
 * code (e.g. "BSCS101"), shown as-is — "block" stays as the underlying
 * mechanism (choosing it enrolls every subject at once) but never appears
 * as a word in front of the student.
 */
export function EnrollmentBlockChoice({
  block,
  selected,
  onSelect,
  disabled = false,
}: {
  block: EnrollmentBlock
  selected: boolean
  onSelect: () => void
  disabled?: boolean
}) {
  const isSelectable = block.is_selectable && !disabled

  return (
    <Card
      role="radio"
      aria-checked={selected}
      aria-disabled={!isSelectable}
      tabIndex={isSelectable ? 0 : -1}
      onClick={() => {
        if (isSelectable) onSelect()
      }}
      onKeyDown={(event) => {
        if (!isSelectable) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect()
        }
      }}
      className={
        selected
          ? "border-primary ring-1 ring-primary"
          : isSelectable
            ? "cursor-pointer"
            : "opacity-70"
      }
    >
      <CardHeader>
        <CardTitle level={2} className="flex flex-wrap items-center gap-2">
          {block.block_code}
          <Badge variant={block.seats_remaining > 0 ? "secondary" : "outline"}>
            {block.seats_remaining} seat{block.seats_remaining === 1 ? "" : "s"} left
          </Badge>
        </CardTitle>
        <CardDescription>
          {block.subjects.length} subject{block.subjects.length === 1 ? "" : "s"} ·{" "}
          {block.total_units} units
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!block.is_selectable && (
          <Alert variant="destructive">
            <AlertDescription>
              <ul className="grid gap-1">
                {block.reasons.map((reason) => (
                  <li key={reason.code}>{reason.message}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        <DataTable
          caption={`${block.block_code} weekly schedule`}
          rowKey={(subject) => subject.section_id}
          rows={block.subjects}
          columns={[
            {
              key: "subject",
              header: "Subject",
              render: (subject) => `${subject.code} — ${subject.title}`,
            },
            { key: "units", header: "Units", render: (subject) => subject.units },
            {
              key: "schedule",
              header: "Day · Time",
              render: (subject) =>
                subject.schedule_days
                  ? `${subject.schedule_days} ${subject.starts_at_time ?? ""}–${subject.ends_at_time ?? ""}`
                  : "Not yet scheduled",
            },
            {
              key: "room",
              header: "Room",
              render: (subject) => subject.room ?? "—",
            },
            {
              key: "professor",
              header: "Professor",
              render: (subject) => subject.professor_name ?? "To be announced",
            },
            {
              key: "modality",
              header: "Modality",
              render: (subject) =>
                subject.modality ? MODALITY_LABEL[subject.modality] : "—",
            },
          ]}
        />
      </CardContent>
    </Card>
  )
}
