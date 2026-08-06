"use client"

import { useMemo, useState } from "react"

import { Field, FieldLabel } from "@/features/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/components/ui/select"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
import type {
  Curriculum,
  Program,
} from "@/features/schemas/reference-data-schema"

const yearFilterOptions = [
  { value: "all", label: "All years" },
  { value: "1", label: "1st Year" },
  { value: "2", label: "2nd Year" },
  { value: "3", label: "3rd Year" },
  { value: "4", label: "4th Year" },
]
const semesterFilterOptions = [
  { value: "all", label: "All semesters" },
  { value: "1st", label: "1st Semester" },
  { value: "2nd", label: "2nd Semester" },
]

/** Deliberately not imported from curriculum-workspace.tsx — importing it back
 * would create a cycle once that file imports CurriculumView (Task 3). */
function yearLabel(year: number) {
  return `${year}${year === 1 ? "st" : year === 2 ? "nd" : year === 3 ? "rd" : "th"} Year`
}

/**
 * Mirrors the backend's `SemesterCoverage::parse` bucketing (see
 * `backend/app/Domain/Curriculum/SemesterCoverage.php`) so a composite
 * placement (`"1st|2nd"`, offered either semester) matches both specific
 * semester filters instead of only the first one found.
 */
function semesterSlots(raw: string): ("1st" | "2nd")[] {
  const normalized = raw.toLowerCase()
  const hasFirst = normalized.includes("1st")
  const hasSecond = normalized.includes("2nd")
  if (hasFirst && hasSecond) return ["1st", "2nd"]
  if (hasSecond) return ["2nd"]
  return ["1st"]
}

interface ViewRow {
  year_level: number
  semester: "1st" | "2nd"
  subjects: Curriculum["subjects"]
}

export function CurriculumView({
  programs,
  curricula,
}: {
  programs: readonly Program[]
  curricula: readonly Curriculum[]
}) {
  const activeCurricula = useMemo(
    () => curricula.filter((curriculum) => curriculum.status === "active"),
    [curricula],
  )
  const availablePrograms = useMemo(
    () =>
      programs
        .filter((program) =>
          activeCurricula.some(
            (curriculum) => curriculum.program_id === program.id,
          ),
        )
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code)),
    [programs, activeCurricula],
  )
  const [programId, setProgramId] = useState(0)
  const [yearFilter, setYearFilter] = useState("all")
  const [semesterFilter, setSemesterFilter] = useState("all")

  const selectedProgramId =
    programId > 0 ? programId : (availablePrograms[0]?.id ?? 0)
  const curriculum = activeCurricula.find(
    (item) => item.program_id === selectedProgramId,
  )

  const rows = useMemo<ViewRow[]>(() => {
    if (!curriculum) return []
    const byKey = new Map<string, ViewRow>()
    for (const subject of curriculum.subjects) {
      if (yearFilter !== "all" && subject.year_level !== Number(yearFilter))
        continue
      const slots = semesterSlots(subject.semester).filter(
        (slot) => semesterFilter === "all" || slot === semesterFilter,
      )
      for (const slot of slots) {
        const key = `${subject.year_level}-${slot}`
        const existing = byKey.get(key)
        if (existing) existing.subjects = [...existing.subjects, subject]
        else
          byKey.set(key, {
            year_level: subject.year_level,
            semester: slot,
            subjects: [subject],
          })
      }
    }
    return [...byKey.values()].sort((a, b) =>
      a.year_level !== b.year_level
        ? a.year_level - b.year_level
        : a.semester.localeCompare(b.semester),
    )
  }, [curriculum, yearFilter, semesterFilter])

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="curriculum-view-program">Program</FieldLabel>
          <Select
            value={selectedProgramId > 0 ? String(selectedProgramId) : ""}
            onValueChange={(value) => setProgramId(Number(value))}
          >
            <SelectTrigger id="curriculum-view-program" className="w-full">
              <SelectValue placeholder="Select a program" />
            </SelectTrigger>
            <SelectContent>
              {availablePrograms.map((program) => (
                <SelectItem key={program.id} value={String(program.id)}>
                  {program.code} — {program.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="curriculum-view-year">Year level</FieldLabel>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger id="curriculum-view-year" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearFilterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="curriculum-view-semester">Semester</FieldLabel>
          <Select value={semesterFilter} onValueChange={setSemesterFilter}>
            <SelectTrigger id="curriculum-view-semester" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {semesterFilterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {availablePrograms.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No active curriculum is available to view yet.
        </p>
      )}
      {availablePrograms.length > 0 && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No subjects match the selected filters.
        </p>
      )}

      {rows.map((row) => (
        <Table key={`${row.year_level}-${row.semester}`}>
          <TableCaption>
            {yearLabel(row.year_level)} · {row.semester} Semester
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Units</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {row.subjects.map((subject) => (
              <TableRow key={subject.subject_id}>
                <TableCell>{subject.code}</TableCell>
                <TableCell>{subject.title}</TableCell>
                <TableCell>{subject.units ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ))}
    </div>
  )
}
