"use client"

import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import {
  PrintButton,
  PrintDocument,
} from "@/features/components/portal/print-document"
import { Badge } from "@/features/components/ui/badge"
import { Skeleton } from "@/features/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
import { useProspectusQuery } from "@/features/hooks/use-academic-record"
import { useIsPhone } from "@/features/hooks/use-media-query"
import { formatYearLevel } from "@/features/lib/format-year-level"
import {
  markTone,
  markToneBadgeVariant,
  markToneRowClass,
} from "@/features/lib/grade-presentation"
import { cn } from "@/features/lib/utils"
import type { ProspectusSemester } from "@/features/schemas/academic-record-schema"

/**
 * A student's full curriculum, year 1 semester 1 through year 4 semester 2:
 * one table per semester that actually has a placement, blank rows for
 * subjects not yet taken, and an "Additional / credited subjects" table for
 * grades outside the curriculum (transferee credit, a shifted-from
 * program's leftover grade) when any exist.
 */
export function ProspectusDocument({ studentId }: { studentId?: number }) {
  const query = useProspectusQuery(studentId)
  const isPhone = useIsPhone()

  return (
    <AsyncBoundary
      query={query}
      loadingLabel="Loading prospectus…"
      loadingFallback={<Skeleton className="h-96" />}
    >
      {(prospectus) => (
        <PrintDocument
          title="Prospectus"
          actions={<PrintButton label="Print / download prospectus" />}
        >
          <div className="mb-3 grid gap-1 text-sm">
            <p>
              <strong>{prospectus.student_number}</strong> ·{" "}
              {prospectus.program_name} ({prospectus.program_code})
            </p>
            <p>
              {prospectus.curriculum_name} · {prospectus.effective_school_year}
              {prospectus.enrollment_category_label
                ? ` · ${prospectus.enrollment_category_label}`
                : ""}
            </p>
          </div>

          {prospectus.curriculum_transition && (
            <div className="mb-4">
              <Table>
                <TableCaption>
                  Curriculum transition ·{" "}
                  {prospectus.curriculum_transition.source_curriculum_name} →{" "}
                  {prospectus.curriculum_transition.target_curriculum_name}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Old subject</TableHead>
                    <TableHead scope="col">New credited subject</TableHead>
                    <TableHead scope="col">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prospectus.curriculum_transition.credits.map((credit) => (
                    <TableRow
                      key={`${credit.source_code}-${credit.target_code}`}
                    >
                      <TableCell>
                        {credit.source_code} — {credit.source_title}
                      </TableCell>
                      <TableCell>
                        {credit.target_code} — {credit.target_title}
                      </TableCell>
                      <TableCell>
                        <Badge>Credited</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {prospectus.transferee_credits.length > 0 && (
            <div className="mb-4">
              <Table>
                <TableCaption>Credited from a previous school</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Previous subject</TableHead>
                    <TableHead scope="col">Credited as</TableHead>
                    <TableHead scope="col">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prospectus.transferee_credits.map((credit, index) => (
                    <TableRow key={`${credit.source_subject_title}-${index}`}>
                      <TableCell>
                        {credit.source_subject_code
                          ? `${credit.source_subject_code} — `
                          : ""}
                        {credit.source_subject_title}
                        <span className="block text-xs text-muted-foreground">
                          {credit.source_institution}
                          {credit.source_school_year
                            ? ` · ${credit.source_school_year}`
                            : ""}
                          {credit.source_semester
                            ? ` (${credit.source_semester})`
                            : ""}
                        </span>
                      </TableCell>
                      <TableCell>
                        {credit.target_code} — {credit.target_title}
                      </TableCell>
                      <TableCell>
                        <Badge>Credited</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {(() => {
            const semestersByYear = new Map<number, ProspectusSemester[]>()
            for (const sem of prospectus.semesters) {
              const list = semestersByYear.get(sem.year_level) ?? []
              list.push(sem)
              semestersByYear.set(sem.year_level, list)
            }

            const years = [...semestersByYear.entries()].sort(
              ([a], [b]) => a - b,
            )
            // On a phone only the year the student is working on starts open:
            // the first with any subject not yet passed, else the last one.
            const focusYear =
              years.find(([, sems]) =>
                sems.some((sem) =>
                  sem.entries.some(
                    (entry) => markTone(entry.mark) !== "passed",
                  ),
                ),
              )?.[0] ?? years.at(-1)?.[0]

            return years.map(([yearLevel, sems]) => {
              const yearUnits = sems.reduce(
                (sum, s) =>
                  sum + s.entries.reduce((eSum, e) => eSum + (e.units ?? 0), 0),
                0,
              )
              const completedEntries = sems.reduce(
                (sum, s) =>
                  sum + s.entries.filter((e) => e.mark !== null).length,
                0,
              )
              const totalEntries = sems.reduce(
                (sum, s) => sum + s.entries.length,
                0,
              )

              return (
                <details
                  key={yearLevel}
                  open={!isPhone || yearLevel === focusYear}
                  className="group mb-4 rounded-xl border bg-card overflow-hidden print:border-none print:shadow-none print:mb-2"
                >
                  <summary className="flex cursor-pointer select-none items-center justify-between p-3.5 bg-muted/25 hover:bg-muted/40 border-b transition-colors print:hidden">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <span>{formatYearLevel(yearLevel)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {completedEntries} / {totalEntries} completed
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {yearUnits} units
                      </Badge>
                    </div>
                  </summary>
                  <div className="p-3">
                    {sems.map((semester) => (
                      <SemesterTable
                        key={`${semester.year_level}-${semester.semester}`}
                        semester={semester}
                      />
                    ))}
                  </div>
                </details>
              )
            })
          })()}

          {prospectus.unplaced_entries.length > 0 && (
            <div className="mt-4">
              <Table>
                <TableCaption>Additional / credited subjects</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Code</TableHead>
                    <TableHead scope="col">Subject description</TableHead>
                    <TableHead scope="col">Units</TableHead>
                    <TableHead scope="col">Grade</TableHead>
                    <TableHead scope="col">Term</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prospectus.unplaced_entries.map((entry) => (
                    <TableRow key={entry.subject_id}>
                      <TableCell>{entry.code}</TableCell>
                      <TableCell>{entry.title}</TableCell>
                      <TableCell>{entry.units}</TableCell>
                      <TableCell>{entry.mark_label ?? "—"}</TableCell>
                      <TableCell>{entry.term_label}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </PrintDocument>
      )}
    </AsyncBoundary>
  )
}

function SemesterTable({ semester }: { semester: ProspectusSemester }) {
  return (
    <div className="mb-4">
      <Table className="caption-top" data-stack-mobile>
        <TableCaption className="mt-0 mb-2 text-left font-medium text-foreground">
          {formatYearLevel(semester.year_level)} · {semester.semester_label}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Code</TableHead>
            <TableHead scope="col">Subject description</TableHead>
            <TableHead scope="col">Pre-requisite</TableHead>
            <TableHead scope="col">Units</TableHead>
            <TableHead scope="col">Grade</TableHead>
            <TableHead scope="col">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {semester.entries.map((entry) => {
            const tone = markTone(entry.mark)

            return (
              <TableRow
                key={entry.subject_id}
                className={cn("print:bg-transparent", markToneRowClass(tone))}
              >
                <TableCell data-stack="full">
                  {entry.code}
                  {entry.offered_either_semester && (
                    <Badge variant="outline" className="ml-2 print:hidden">
                      1st/2nd Sem
                    </Badge>
                  )}
                </TableCell>
                <TableCell data-stack="full">{entry.title}</TableCell>
                <TableCell data-label="Pre-requisite">
                  {entry.prerequisites.length > 0
                    ? entry.prerequisites.map((p) => p.code).join(", ")
                    : "—"}
                </TableCell>
                <TableCell data-label="Units">{entry.units}</TableCell>
                <TableCell data-label="Grade">{entry.mark ?? "—"}</TableCell>
                <TableCell data-label="Status">
                  <Badge variant={markToneBadgeVariant(tone)}>
                    {entry.status_label ?? "Not taken"}
                  </Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
