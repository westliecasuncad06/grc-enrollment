"use client"

import { useState, type ReactNode } from "react"

import { ApplyPreferencesSwitch } from "@/features/components/portal/apply-preferences-switch"
import { StatusRegion } from "@/features/components/portal/status-region"
import { Field, FieldLabel } from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
import type { EligibleSubject } from "@/features/schemas/enrollment-schema"

// A plain "no filter" sentinel for every filter below. None of these are a
// Radix `Select` (that component can't hold "" for "no selection" — see the
// same convention in audit-logs-workspace.tsx), but a native `<select>` is
// used here instead so an already-mounted option list can be driven directly
// (Testing Library's `selectOptions` only supports `<select>`/`[role=listbox]`
// elements, not a closed Radix popover) — the sentinel name/value is kept
// the same regardless, so every "no filter" control in the portal reads the
// same way.
const ALL_FILTER_VALUE = "all"

const DAY_OPTIONS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "7", label: "Sunday" },
] as const

const TIME_BLOCK_OPTIONS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
] as const

const selectClassName =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

/**
 * Longest tokens first so "Th"/"Sat"/"Sun" are not swallowed by the
 * single-letter "T"/"S" checks — mirrors the backend's
 * `App\Domain\Scheduling\ScheduleDayParser` token table and its ISO-8601
 * numbering (1 = Monday … 7 = Sunday), since the pool response only carries
 * the raw `schedule_days` shorthand (e.g. "MWF", "TTh"), not parsed days.
 */
const DAY_TOKENS: readonly (readonly [string, number])[] = [
  ["Th", 4],
  ["Sat", 6],
  ["Sun", 7],
  ["M", 1],
  ["T", 2],
  ["W", 3],
  ["F", 5],
]

function parseScheduleDays(scheduleDays: string | null): number[] {
  if (scheduleDays === null) return []

  const days: number[] = []
  let remaining = scheduleDays

  while (remaining !== "") {
    const token = DAY_TOKENS.find(([symbol]) => remaining.startsWith(symbol))
    if (!token) break
    days.push(token[1])
    remaining = remaining.slice(token[0].length)
  }

  return [...new Set(days)]
}

/** Same morning/afternoon/evening boundaries as the backend `SchedulePreferenceScorer`. */
function timeBlockOf(
  startsAtTime: string | null,
): "morning" | "afternoon" | "evening" | null {
  if (startsAtTime === null) return null
  if (startsAtTime < "12:00:00") return "morning"
  if (startsAtTime < "17:00:00") return "afternoon"
  return "evening"
}

function matchesSearch(subject: EligibleSubject, search: string): boolean {
  const needle = search.trim().toLocaleLowerCase()
  if (needle === "") return true

  return (
    subject.code.toLocaleLowerCase().includes(needle) ||
    subject.title.toLocaleLowerCase().includes(needle)
  )
}

function matchesDay(subject: EligibleSubject, day: string): boolean {
  if (day === ALL_FILTER_VALUE) return true
  const target = Number(day)

  return subject.available_sections.some((section) =>
    parseScheduleDays(section.schedule_days).includes(target),
  )
}

function matchesTimeBlock(subject: EligibleSubject, timeBlock: string): boolean {
  if (timeBlock === ALL_FILTER_VALUE) return true

  return subject.available_sections.some(
    (section) => timeBlockOf(section.starts_at_time) === timeBlock,
  )
}

function matchesProfessor(subject: EligibleSubject, professorId: string): boolean {
  if (professorId === ALL_FILTER_VALUE) return true
  const target = Number(professorId)

  return subject.available_sections.some(
    (section) => section.professor_id === target,
  )
}

/**
 * Distinct professor IDs across the pool, in ascending order. The
 * eligible-subject pool's `SectionResource` only exposes `professor_id`
 * (unlike `EnrollmentBlockResource`, which denormalizes a `professor_name`)
 * — so, absent a name to show, options are labelled by number.
 */
function professorOptions(subjects: readonly EligibleSubject[]): number[] {
  const ids = new Set<number>()
  for (const subject of subjects) {
    for (const section of subject.available_sections) {
      if (section.professor_id !== null) ids.add(section.professor_id)
    }
  }
  return [...ids].sort((a, b) => a - b)
}

/**
 * Client-side filters (Day, Time block, Professor, Subject search) plus the
 * "Apply my preferences" sort, over an already-fetched eligible-subject
 * pool — the irregular-student per-subject flow in `enrollment-workspace.tsx`.
 * Everything here operates on the `subjects` prop already sitting in the
 * parent's query cache; no filter or sort ever issues a new request.
 *
 * "Apply my preferences" sorts the subject list by its own `preference_score`
 * (the pool only scores a subject as a whole against its available sections,
 * not per individual section — see `BuildEligibleSubjectPool`). Like the
 * regular-student table, this only reorders: a subject with no score, or a
 * low one, is never removed (preferences rank, they never gate).
 */
export function EnrollmentSubjectFilterBar({
  subjects,
  children,
}: {
  subjects: readonly EligibleSubject[]
  children: (subjects: readonly EligibleSubject[]) => ReactNode
}) {
  const [search, setSearch] = useState("")
  const [day, setDay] = useState(ALL_FILTER_VALUE)
  const [timeBlock, setTimeBlock] = useState(ALL_FILTER_VALUE)
  const [professorId, setProfessorId] = useState(ALL_FILTER_VALUE)
  const [applyPreferences, setApplyPreferences] = useState(false)

  const filtered = subjects.filter(
    (subject) =>
      matchesSearch(subject, search) &&
      matchesDay(subject, day) &&
      matchesTimeBlock(subject, timeBlock) &&
      matchesProfessor(subject, professorId),
  )

  const visible = applyPreferences
    ? [...filtered].sort(
        (a, b) =>
          (b.preference_score ?? Number.NEGATIVE_INFINITY) -
          (a.preference_score ?? Number.NEGATIVE_INFINITY),
      )
    : filtered

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field>
          <FieldLabel htmlFor="eligible-subject-search">
            Subject search
          </FieldLabel>
          <Input
            id="eligible-subject-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by code or title"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="eligible-subject-day">Day</FieldLabel>
          <select
            id="eligible-subject-day"
            className={selectClassName}
            value={day}
            onChange={(event) => setDay(event.target.value)}
          >
            <option value={ALL_FILTER_VALUE}>All days</option>
            {DAY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="eligible-subject-time-block">
            Time block
          </FieldLabel>
          <select
            id="eligible-subject-time-block"
            className={selectClassName}
            value={timeBlock}
            onChange={(event) => setTimeBlock(event.target.value)}
          >
            <option value={ALL_FILTER_VALUE}>All time blocks</option>
            {TIME_BLOCK_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="eligible-subject-professor">
            Professor
          </FieldLabel>
          <select
            id="eligible-subject-professor"
            className={selectClassName}
            value={professorId}
            onChange={(event) => setProfessorId(event.target.value)}
          >
            <option value={ALL_FILTER_VALUE}>All professors</option>
            {professorOptions(subjects).map((id) => (
              <option key={id} value={String(id)}>
                Professor #{id}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <ApplyPreferencesSwitch
        id="eligible-subject-apply-preferences"
        checked={applyPreferences}
        onCheckedChange={setApplyPreferences}
      />

      <StatusRegion
        message={
          subjects.length > 0
            ? `${visible.length} of ${subjects.length} subject${subjects.length === 1 ? "" : "s"} shown.`
            : null
        }
      />

      {visible.length === 0 && subjects.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          No subjects match the current filters.
        </p>
      ) : (
        children(visible)
      )}
    </div>
  )
}
