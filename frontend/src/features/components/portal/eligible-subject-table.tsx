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
import {
  compareBySchedule,
  hasScheduleConflict,
} from "@/features/lib/schedule-order"
import type { EligibleSubject } from "@/features/schemas/enrollment-schema"

type EligibleSection = EligibleSubject["available_sections"][number]

/**
 * Every other subject's currently chosen section, each tagged with the
 * subject's own code — the conflict check needs to know both what to
 * compare against and what to name in the "Conflicts with X" message.
 */
function otherSelectedSections(
  subjects: readonly EligibleSubject[],
  selections: Record<number, number>,
  excludeSubjectId: number,
): { section: EligibleSection; subjectCode: string }[] {
  const others: { section: EligibleSection; subjectCode: string }[] = []

  for (const subject of subjects) {
    if (subject.subject_id === excludeSubjectId) continue
    const sectionId = selections[subject.subject_id]
    if (sectionId === undefined) continue
    const section = subject.available_sections.find(
      (candidate) => candidate.id === sectionId,
    )
    if (section) others.push({ section, subjectCode: subject.code })
  }

  return others
}

/** The other subject's code this option's day/time overlaps, or null when it's free to pick. */
function conflictingSubjectCode(
  option: EligibleSection,
  others: readonly { section: EligibleSection; subjectCode: string }[],
): string | null {
  const conflict = others.find((other) =>
    hasScheduleConflict(option, other.section),
  )
  return conflict?.subjectCode ?? null
}

function collegeLabel(college: string | null): string {
  return college === null ? "Other department" : college.toUpperCase()
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
  subjects: readonly EligibleSubject[],
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
        const others = otherSelectedSections(
          subjects,
          selections,
          subject.subject_id,
        )

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
                {subject.available_sections.map((option) => {
                  const conflictsWith = conflictingSubjectCode(option, others)

                  return (
                    <SelectItem
                      key={option.id}
                      value={String(option.id)}
                      disabled={conflictsWith !== null}
                    >
                      Section {option.section_code}
                      {option.schedule_days
                        ? ` · ${scheduleLabel(option)}`
                        : ""}{" "}
                      · {option.remaining_seats} seat
                      {option.remaining_seats === 1 ? "" : "s"} open
                      {option.is_own_department
                        ? ""
                        : ` · ${collegeLabel(option.college)} · ${option.subject_title}`}
                      {conflictsWith
                        ? ` · Conflicts with ${conflictsWith}`
                        : ""}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {selectedSection && !selectedSection.is_own_department && (
              <Badge variant="outline" className="w-fit">
                {`${collegeLabel(selectedSection.college)} section — ${selectedSection.subject_title}`}
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
      key: "remove",
      header: "Remove",
      render: (subject) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Remove ${subject.code}`}
          disabled={disabled}
          onClick={() => onRemove(subject.subject_id)}
        >
          Remove
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
 * shared (non-major) subject, flagged via `is_own_department`/`college`. An
 * option that overlaps a section already picked for a different subject is
 * disabled in its own dropdown — the same day/time rule the backend enforces
 * at submission (`SectionConflictDetector`), surfaced here so a student never
 * builds a conflicting set through this table. "Arrange by schedule" is a
 * pure client-side view toggle: it reorders the visible rows Monday-to-
 * Saturday by each subject's picked time, sinking not-yet-picked subjects to
 * the bottom; it never changes a selection. Remove hides a subject from view
 * for the session and clears any selection it had; nothing here is persisted
 * or affects eligibility.
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
  const [arrangedBySchedule, setArrangedBySchedule] = useState(false)

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
  const rows = arrangedBySchedule
    ? [...visibleSubjects].sort((a, b) =>
        compareBySchedule(
          selectedSectionOf(a, selections) ?? {
            schedule_days: null,
            starts_at_time: null,
            ends_at_time: null,
          },
          selectedSectionOf(b, selections) ?? {
            schedule_days: null,
            starts_at_time: null,
            ends_at_time: null,
          },
        ),
      )
    : visibleSubjects

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant={arrangedBySchedule ? "default" : "outline"}
          size="sm"
          aria-pressed={arrangedBySchedule}
          onClick={() => setArrangedBySchedule((prev) => !prev)}
        >
          Arrange by schedule
        </Button>
        {removedVisibleCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {removedVisibleCount} subject
              {removedVisibleCount === 1 ? "" : "s"} removed
            </span>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={showRemoved}
            >
              Show
            </Button>
          </div>
        )}
      </div>
      <DataTable
        caption="Eligible subjects"
        rowKey={(subject) => subject.subject_id}
        rows={rows}
        columns={columns(
          subjects,
          selections,
          onChoose,
          onClear,
          remove,
          disabled,
        )}
        emptyMessage={
          removedVisibleCount > 0
            ? "Every subject in view has been removed. Use Show above to bring them back."
            : undefined
        }
      />
    </div>
  )
}
