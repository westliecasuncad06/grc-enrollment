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
              {prospectus.curriculum_name} ·{" "}
              {prospectus.effective_school_year}
              {prospectus.enrollment_category_label
                ? ` · ${prospectus.enrollment_category_label}`
                : ""}
            </p>
          </div>

          {prospectus.semesters.map((semester) => (
            <SemesterTable key={`${semester.year_level}-${semester.semester}`} semester={semester} />
          ))}

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
      <Table>
        <TableCaption>
          Year {semester.year_level} · {semester.semester_label}
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
                <TableCell>
                  {entry.code}
                  {entry.offered_either_semester && (
                    <Badge variant="outline" className="ml-2 print:hidden">
                      1st/2nd Sem
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{entry.title}</TableCell>
                <TableCell>
                  {entry.prerequisites.length > 0
                    ? entry.prerequisites.map((p) => p.code).join(", ")
                    : "—"}
                </TableCell>
                <TableCell>{entry.units}</TableCell>
                <TableCell>{entry.mark ?? "—"}</TableCell>
                <TableCell>
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
