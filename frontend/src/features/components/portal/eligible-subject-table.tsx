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
import { SearchableCombobox } from "@/features/components/ui/searchable-combobox"
import {
  isAdvanceSubject,
  isBacklogSubject,
} from "@/features/lib/curriculum-ordinal"
import { formatTimeRange } from "@/features/lib/format-time"
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

function seatsLabel(section: EligibleSection): string {
  return `${section.remaining_seats} seat${section.remaining_seats === 1 ? "" : "s"} open`
}

/**
 * Once a section is actually chosen, the closed trigger shows only the
 * section code and seat count — not its schedule, which would just repeat
 * the adjacent "Schedule" column, nor the cross-department course name,
 * already carried by the badge rendered below the picker. The open dropdown
 * (`SelectItem`, below) still shows the full detail: that's the one place a
 * student is actively comparing sections against each other, so schedule
 * and cross-department context both stay load-bearing there.
 */
function triggerLabel(section: EligibleSection): string {
  return `Section ${section.section_code} · ${seatsLabel(section)}`
}

function scheduleLabel(section: EligibleSection | undefined): string {
  if (!section) return "Not selected"
  if (
    !section.schedule_days ||
    !section.starts_at_time ||
    !section.ends_at_time
  )
    return "To be confirmed"
  return `${section.schedule_days} · ${formatTimeRange(section.starts_at_time, section.ends_at_time)}`
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
  isBacklog: (subject: EligibleSubject) => boolean,
  isAdvance: (subject: EligibleSubject) => boolean,
  pairedCodeOf: (subject: EligibleSubject) => string | null,
): DataTableColumn<EligibleSubject>[] {
  return [
    {
      key: "subject",
      header: "Subject",
      render: (subject) => {
        const pairedCode = pairedCodeOf(subject)

        return (
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium">{subject.code}</span>
              {isBacklog(subject) && <Badge variant="warning">Backlog</Badge>}
              {isAdvance(subject) && (
                <Badge variant="outline">Next year</Badge>
              )}
              {pairedCode && (
                <Badge variant="secondary">Paired with {pairedCode}</Badge>
              )}
            </div>
            <div className="text-muted-foreground">{subject.title}</div>
          </div>
        )
      },
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
                <SelectValue placeholder="Not selected">
                  {selectedSection ? triggerLabel(selectedSection) : undefined}
                </SelectValue>
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
                      · {seatsLabel(option)}
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
 * pure client-side, one-way view action: it reorders the visible rows
 * Monday-to-Saturday by each subject's picked time, sinking not-yet-picked
 * subjects to the bottom; clicking it again is a harmless no-op — there is no
 * un-arrange, but the button itself stays enabled and stays styled the same
 * so it never reads as disabled. It never changes a selection. Remove hides a
 * subject from view for the session and clears any selection it had; nothing
 * here is persisted or affects eligibility.
 *
 * `subjects` can include "advance" entries — one year ahead of the
 * student's own standing, same semester (`BuildEligibleSubjectPool` bounds
 * the pool no further than that). Those start hidden from the table just
 * like a removed row, and share the same "Add subject" combobox to bring
 * them into view — a student who is caught up can still choose to get
 * ahead, without next year's subjects cluttering the default list.
 */
export function EligibleSubjectTable({
  subjects,
  selections,
  onChoose,
  onClear,
  disabled = false,
  currentYearLevel = null,
  currentSemester = null,
}: {
  subjects: readonly EligibleSubject[]
  selections: Record<number, number>
  onChoose: (subjectId: number, sectionId: number) => void
  onClear: (subjectId: number) => void
  disabled?: boolean
  /** The student's own current standing — see `curriculum-ordinal.ts`. Unknown (null) tags nothing Backlog rather than guessing. */
  currentYearLevel?: number | null
  currentSemester?: string | null
}) {
  // Subjects the student explicitly removed from view this session.
  const [removedIds, setRemovedIds] = useState<ReadonlySet<number>>(new Set())
  // Advance subjects (see isAdvance below) the student explicitly chose to
  // add via the combobox — everything else advance stays hidden by default,
  // computed fresh each render rather than seeded once at mount, since
  // currentYearLevel/currentSemester can resolve after this table's first
  // render.
  const [addedAdvanceIds, setAddedAdvanceIds] = useState<ReadonlySet<number>>(
    new Set(),
  )
  const [arrangedBySchedule, setArrangedBySchedule] = useState(false)
  const [addSubjectValue, setAddSubjectValue] = useState("")

  const isBacklog = (subject: EligibleSubject): boolean =>
    currentYearLevel !== null &&
    currentSemester !== null &&
    isBacklogSubject(
      subject.year_level,
      subject.semester,
      currentYearLevel,
      currentSemester,
    )
  const isAdvance = (subject: EligibleSubject): boolean =>
    currentYearLevel !== null &&
    currentSemester !== null &&
    isAdvanceSubject(
      subject.year_level,
      subject.semester,
      currentYearLevel,
      currentSemester,
    )
  // Hidden from the main table either because the student removed it, or
  // because it's a not-yet-added advance (one-year-ahead) subject — the
  // "Add subject" combobox is how either kind comes back into view.
  const isHidden = (subject: EligibleSubject): boolean =>
    removedIds.has(subject.subject_id) ||
    (isAdvance(subject) && !addedAdvanceIds.has(subject.subject_id))

  const subjectById = new Map(
    subjects.map((subject) => [subject.subject_id, subject]),
  )
  /**
   * A subject's own paired lecture/laboratory component, when the pair
   * actually appears in this pool (it may not — e.g. the other half was
   * already completed and is excluded entirely).
   */
  const pairOf = (subject: EligibleSubject): EligibleSubject | null =>
    subject.paired_subject_id !== null
      ? (subjectById.get(subject.paired_subject_id) ?? null)
      : null

  const reveal = (subjectId: number) => {
    setRemovedIds((prev) => {
      if (!prev.has(subjectId)) return prev
      const next = new Set(prev)
      next.delete(subjectId)
      return next
    })
    setAddedAdvanceIds((prev) =>
      prev.has(subjectId) ? prev : new Set(prev).add(subjectId),
    )
  }

  /**
   * A subject's lecture and laboratory components are institutional policy
   * always taken together, never separately — choosing a section for one
   * automatically chooses the matching section (same section code, the
   * convention the block-generation process already relies on) for the
   * other, revealing it first if it was hidden. If no matching section code
   * exists on the pair's side, nothing is auto-chosen there; the student
   * still can't submit an unpaired half — `StoreEnrollmentRequest` enforces
   * that server-side.
   */
  const choose = (subjectId: number, sectionId: number) => {
    onChoose(subjectId, sectionId)

    const subject = subjectById.get(subjectId)
    const paired = subject ? pairOf(subject) : null
    if (!subject || !paired) return

    const chosenSection = subject.available_sections.find(
      (section) => section.id === sectionId,
    )
    const matchingPairedSection = paired.available_sections.find(
      (section) => section.section_code === chosenSection?.section_code,
    )
    if (!matchingPairedSection) return

    reveal(paired.subject_id)
    if (selections[paired.subject_id] !== matchingPairedSection.id) {
      onChoose(paired.subject_id, matchingPairedSection.id)
    }
  }

  const clear = (subjectId: number) => {
    onClear(subjectId)

    const subject = subjectById.get(subjectId)
    const paired = subject ? pairOf(subject) : null
    if (paired && selections[paired.subject_id] !== undefined) {
      onClear(paired.subject_id)
    }
  }

  const remove = (subjectId: number) => {
    if (selections[subjectId] !== undefined) clear(subjectId)
    setRemovedIds((prev) => new Set(prev).add(subjectId))

    const subject = subjectById.get(subjectId)
    const paired = subject ? pairOf(subject) : null
    if (paired) {
      if (selections[paired.subject_id] !== undefined) onClear(paired.subject_id)
      setRemovedIds((prev) => new Set(prev).add(paired.subject_id))
    }
  }
  const showAll = () => {
    setRemovedIds(new Set())
    setAddedAdvanceIds(
      new Set(subjects.filter(isAdvance).map((subject) => subject.subject_id)),
    )
  }
  const addSubject = (subjectId: number) => {
    reveal(subjectId)

    const subject = subjectById.get(subjectId)
    const paired = subject ? pairOf(subject) : null
    if (paired) reveal(paired.subject_id)
  }

  const hiddenSubjects = subjects.filter(isHidden)
  const hiddenCount = hiddenSubjects.length
  const visibleSubjects = subjects.filter((subject) => !isHidden(subject))
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
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="default"
          size="sm"
          aria-pressed={arrangedBySchedule}
          onClick={() => setArrangedBySchedule(true)}
        >
          Arrange by schedule
        </Button>
        <div className="w-56">
          <SearchableCombobox
            id="add-subject"
            label="Add subject"
            options={hiddenSubjects.map((subject) => ({
              value: String(subject.subject_id),
              label: `${subject.code} — ${subject.title}`,
            }))}
            value={addSubjectValue}
            onValueChange={(value) => {
              if (value === "") return
              addSubject(Number(value))
              setAddSubjectValue("")
            }}
            placeholder="Add subject"
            emptyMessage="No subjects available to add."
            disabled={disabled || hiddenCount === 0}
          />
        </div>
        {hiddenCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {hiddenCount} subject{hiddenCount === 1 ? "" : "s"} not shown
            </span>
            <Button type="button" variant="link" size="sm" onClick={showAll}>
              Show all
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
          choose,
          clear,
          remove,
          disabled,
          isBacklog,
          isAdvance,
          (subject) => pairOf(subject)?.code ?? null,
        )}
        emptyMessage={
          hiddenCount > 0
            ? "Every subject in view is hidden. Use Show all above to bring them back."
            : undefined
        }
      />
    </div>
  )
}
