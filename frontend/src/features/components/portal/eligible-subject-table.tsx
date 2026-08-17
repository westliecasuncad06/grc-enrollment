"use client"

import { useState } from "react"

import {
  DataTable,
  type DataTableColumn,
} from "@/features/components/portal/data-table"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/components/ui/select"
import type { EligibleSubject } from "@/features/schemas/enrollment-schema"

type EligibleSection = EligibleSubject["available_sections"][number]

const COLLEGE_LABELS: Record<string, string> = {
  ccs: "CCS",
  coe: "COE",
  coa: "COA",
  cbae: "CBAE",
}

function collegeLabel(college: string | null): string {
  if (college === null) return "Other department"
  return COLLEGE_LABELS[college] ?? college.toUpperCase()
}

function scheduleLabel(section: EligibleSection | undefined): string {
  if (!section) return "Not selected"
  if (
    !section.schedule_days ||
    !section.starts_at_time ||
    !section.ends_at_time
  )
    return "To be confirmed"
  return `${section.schedule_days} · ${section.starts_at_time.slice(0, 5)}–${section.ends_at_time.slice(0, 5)}`
}

function selectedSectionOf(
  subject: EligibleSubject,
  selections: Record<number, number>,
): EligibleSection | undefined {
  const sectionId = selections[subject.subject_id]
  return subject.available_sections.find((section) => section.id === sectionId)
}

function columns(
  selections: Record<number, number>,
  onChoose: (subjectId: number, sectionId: number) => void,
  onClear: (subjectId: number) => void,
  onRemove: (subjectId: number) => void,
  disabled: boolean,
): DataTableColumn<EligibleSubject>[] {
  return [
    {
      key: "subject",
      header: "Subject",
      render: (subject) => (
        <div>
          <div className="font-medium">{subject.code}</div>
          <div className="text-muted-foreground">{subject.title}</div>
        </div>
      ),
    },
    {
      key: "units",
      header: "Units",
      render: (subject) => subject.units,
    },
    {
      key: "section",
      header: "Section",
      render: (subject) => {
        const selectedSectionId = selections[subject.subject_id]
        const selectedSection = selectedSectionOf(subject, selections)

        return (
          <div className="grid gap-2">
            <Select
              value={selectedSectionId ? String(selectedSectionId) : ""}
              onValueChange={(value) => {
                const sectionId = Number(value)
                if (sectionId) onChoose(subject.subject_id, sectionId)
                else onClear(subject.subject_id)
              }}
              disabled={disabled}
            >
              <SelectTrigger
                aria-label={`${subject.code} section`}
                className="w-full"
              >
                <SelectValue placeholder="Not selected" />
              </SelectTrigger>
              <SelectContent>
                {subject.available_sections.map((option) => (
                  <SelectItem key={option.id} value={String(option.id)}>
                    Section {option.section_code}
                    {option.schedule_days
                      ? ` · ${option.schedule_days} ${option.starts_at_time}–${option.ends_at_time}`
                      : ""}{" "}
                    · {option.remaining_seats} seat
                    {option.remaining_seats === 1 ? "" : "s"} open
                    {option.is_own_department
                      ? ""
                      : ` · ${collegeLabel(option.college)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSection && !selectedSection.is_own_department && (
              <Badge variant="outline" className="w-fit">
                {collegeLabel(selectedSection.college)} section
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      key: "schedule",
      header: "Schedule",
      render: (subject) =>
        scheduleLabel(selectedSectionOf(subject, selections)),
    },
    {
      key: "room",
      header: "Room",
      render: (subject) =>
        selectedSectionOf(subject, selections)?.room ?? "Not selected",
    },
    {
      key: "remove",
      header: "Remove",
      render: (subject) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onRemove(subject.subject_id)}
        >
          Remove {subject.code}
        </Button>
      ),
    },
  ]
}

/**
 * The irregular-student per-subject selection table. Every row is one
 * eligible subject with a manual section picker — `available_sections`
 * already carries only sections the student may currently choose
 * (`BuildEligibleSubjectPool`), including another department's section for a
 * shared (non-major) subject, flagged via `is_own_department`/`college`.
 * Remove hides a subject from view for the session and clears any selection
 * it had; nothing here is persisted or affects eligibility.
 */
export function EligibleSubjectTable({
  subjects,
  selections,
  onChoose,
  onClear,
  disabled = false,
}: {
  subjects: readonly EligibleSubject[]
  selections: Record<number, number>
  onChoose: (subjectId: number, sectionId: number) => void
  onClear: (subjectId: number) => void
  disabled?: boolean
}) {
  const [removedIds, setRemovedIds] = useState<ReadonlySet<number>>(new Set())

  const remove = (subjectId: number) => {
    if (selections[subjectId] !== undefined) onClear(subjectId)
    setRemovedIds((prev) => new Set(prev).add(subjectId))
  }
  const showRemoved = () => setRemovedIds(new Set())

  const removedVisibleCount = subjects.filter((subject) =>
    removedIds.has(subject.subject_id),
  ).length
  const visibleSubjects = subjects.filter(
    (subject) => !removedIds.has(subject.subject_id),
  )

  return (
    <div className="grid gap-3">
      {removedVisibleCount > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {removedVisibleCount} subject{removedVisibleCount === 1 ? "" : "s"}{" "}
            removed
          </span>
          <Button type="button" variant="link" size="sm" onClick={showRemoved}>
            Show
          </Button>
        </div>
      )}
      <DataTable
        caption="Eligible subjects"
        rowKey={(subject) => subject.subject_id}
        rows={visibleSubjects}
        columns={columns(selections, onChoose, onClear, remove, disabled)}
        emptyMessage={
          removedVisibleCount > 0
            ? "Every subject in view has been removed. Use Show above to bring them back."
            : undefined
        }
      />
    </div>
  )
}
