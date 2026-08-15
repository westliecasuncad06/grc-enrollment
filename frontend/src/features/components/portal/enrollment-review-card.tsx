"use client"

import type { ReactNode } from "react"

import { DataTable } from "@/features/components/portal/data-table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import type { EligibleSubject } from "@/features/schemas/enrollment-schema"

function reviewTimeRange(startsAt: string | null, endsAt: string | null) {
  return startsAt && endsAt
    ? `${startsAt.slice(0, 5)}–${endsAt.slice(0, 5)}`
    : "Time to be confirmed"
}

function ReviewSubjectCard({
  code,
  title,
  units,
  details,
}: {
  code: string
  title: string
  units: number
  details: readonly { label: string; value: string | number }[]
}) {
  return (
    <Card role="article" aria-label={`${code} section review`} size="sm">
      <CardHeader>
        <CardTitle level={3}>{code}</CardTitle>
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-2 text-sm">
          {details.map((detail) => (
            <div
              key={detail.label}
              className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2"
            >
              <dt className="text-muted-foreground">{detail.label}</dt>
              <dd className="min-w-0 text-right font-medium">{detail.value}</dd>
            </div>
          ))}
          <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 border-t pt-2">
            <dt className="text-muted-foreground">Units</dt>
            <dd className="text-right font-semibold">{units}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}

interface SelectedEntry {
  subject: EligibleSubject
  section: EligibleSubject["available_sections"][number]
}

/**
 * The review card for irregular students' per-subject selections. A regular
 * student's full block schedule and submit action stay together in the inline
 * section card, so this component deliberately renders nothing for them.
 */
export function EnrollmentReviewCard({
  isRegularAudience,
  selectedEntries,
  totalUnits,
  hasActiveEnrollmentThisTerm,
  submitFooter,
}: {
  isRegularAudience: boolean
  selectedEntries: readonly SelectedEntry[]
  totalUnits: number
  hasActiveEnrollmentThisTerm: boolean
  submitFooter: (totalUnitsValue: number) => ReactNode
}): ReactNode {
  if (isRegularAudience) return null

  return (
    selectedEntries.length > 0 &&
    !hasActiveEnrollmentThisTerm && (
      <Card className="portal-workspace-highlight">
        <CardHeader>
          <CardTitle level={2}>Review your enrollment</CardTitle>
          <CardDescription>
            Confirm your selections before submitting.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <DataTable
            caption="Selected subjects"
            rowKey={(entry) => entry.subject.subject_id}
            rows={selectedEntries}
            columns={[
              {
                key: "subject",
                header: "Subject",
                render: (entry) =>
                  `${entry.subject.code} — ${entry.subject.title}`,
              },
              {
                key: "section",
                header: "Section",
                render: (entry) => entry.section.section_code,
              },
              {
                key: "units",
                header: "Units",
                render: (entry) => entry.subject.units,
              },
            ]}
            renderCard={(entry) => (
              <ReviewSubjectCard
                code={entry.subject.code}
                title={entry.subject.title}
                units={entry.subject.units}
                details={[
                  { label: "Section", value: entry.section.section_code },
                  {
                    label: "Schedule",
                    value: `${entry.section.schedule_days ?? "To be confirmed"} · ${reviewTimeRange(entry.section.starts_at_time, entry.section.ends_at_time)}`,
                  },
                  {
                    label: "Room",
                    value: entry.section.room ?? "To be confirmed",
                  },
                  {
                    label: "Seats available",
                    value: entry.section.remaining_seats,
                  },
                ]}
              />
            )}
          />
          {submitFooter(totalUnits)}
        </CardContent>
      </Card>
    )
  )
}
