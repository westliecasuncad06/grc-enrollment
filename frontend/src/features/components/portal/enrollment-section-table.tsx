"use client"

import { useState } from "react"

import { ApplyPreferencesSwitch } from "@/features/components/portal/apply-preferences-switch"
import {
  DataTable,
  type DataTableColumn,
} from "@/features/components/portal/data-table"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import type { EnrollmentBlock } from "@/features/schemas/enrollment-block-schema"

/** Every distinct value across a block's subjects, joined for one table cell. */
function summarize(
  block: EnrollmentBlock,
  pick: (subject: EnrollmentBlock["subjects"][number]) => string | null,
): string {
  const values = [
    ...new Set(
      block.subjects
        .map(pick)
        .filter((value): value is string => value !== null),
    ),
  ]
  return values.length > 0 ? values.join(", ") : "Not yet scheduled"
}

function PreferenceMatchCell({ block }: { block: EnrollmentBlock }) {
  if (block.preference_score === null) return <span>—</span>

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary">{block.preference_score}</Badge>
      {block.preference_reasons[0] && (
        <span className="text-sm text-muted-foreground">
          {block.preference_reasons[0]}
        </span>
      )}
    </div>
  )
}

/**
 * The table of sections a regular student may enroll into — replaces the
 * former vertical list of radio `Card`s (`EnrollmentBlockChoice`, deleted).
 * Selection itself now happens in `EnrollmentBlockDetailDialog`, opened by
 * a row's "View" action, so this component only lists and ranks.
 *
 * "Apply my preferences" is a client-side sort over the already-fetched
 * block pool — it never removes a row. Preferences rank sections, they
 * never gate them (Task 2 already enforces that at the data layer; this is
 * the same invariant held at the UI layer).
 */
export function EnrollmentSectionTable({
  blocks,
  onView,
}: {
  blocks: readonly EnrollmentBlock[]
  onView: (block: EnrollmentBlock) => void
}) {
  const [applyPreferences, setApplyPreferences] = useState(false)

  const rows = applyPreferences
    ? [...blocks].sort(
        (a, b) =>
          (b.preference_score ?? Number.NEGATIVE_INFINITY) -
          (a.preference_score ?? Number.NEGATIVE_INFINITY),
      )
    : blocks

  const columns: DataTableColumn<EnrollmentBlock>[] = [
    {
      key: "section",
      header: "Section",
      render: (block) => block.block_code,
    },
    {
      key: "subjects",
      header: "Subjects",
      render: (block) =>
        block.subjects.map((subject) => subject.code).join(", "),
    },
    { key: "units", header: "Units", render: (block) => block.total_units },
    {
      key: "days",
      header: "Days",
      render: (block) => summarize(block, (subject) => subject.schedule_days),
    },
    {
      key: "time",
      header: "Time",
      render: (block) =>
        summarize(block, (subject) =>
          subject.starts_at_time && subject.ends_at_time
            ? `${subject.starts_at_time.slice(0, 5)}–${subject.ends_at_time.slice(0, 5)}`
            : null,
        ),
    },
    {
      key: "seats",
      header: "Seats",
      render: (block) =>
        `${block.seats_remaining} seat${block.seats_remaining === 1 ? "" : "s"} left`,
    },
    {
      key: "preference",
      header: "Preference match",
      render: (block) => <PreferenceMatchCell block={block} />,
    },
    {
      key: "action",
      header: "Action",
      render: (block) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`View ${block.block_code}`}
          onClick={() => onView(block)}
        >
          View
        </Button>
      ),
    },
  ]

  return (
    <div className="grid gap-3">
      <ApplyPreferencesSwitch
        id="enrollment-section-table-apply-preferences"
        checked={applyPreferences}
        onCheckedChange={setApplyPreferences}
      />
      <DataTable
        caption="Available sections"
        rowKey={(block) => block.block_code}
        rows={rows}
        columns={columns}
      />
    </div>
  )
}
