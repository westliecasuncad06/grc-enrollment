"use client"

import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import {
  PrintButton,
  PrintDocument,
} from "@/features/components/portal/print-document"
import { Skeleton } from "@/features/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
import { useGradeSlipQuery } from "@/features/hooks/use-academic-record"

/**
 * A single term's printable grade slip: CODE | SUBJECT DESCRIPTION | UNITS |
 * FINAL | REMARKS | SECTION | PROFESSOR | SIGNATURE, matching the
 * institution's reference form, with TOTAL ACADEMIC UNITS and GPA below.
 */
export function GradeSlipDocument({
  academicTermId,
  studentId,
}: {
  academicTermId: number | null
  studentId?: number
}) {
  const query = useGradeSlipQuery(academicTermId, studentId)

  return (
    <AsyncBoundary
      query={query}
      loadingLabel="Loading grade slip…"
      loadingFallback={<Skeleton className="h-64" />}
    >
      {(slip) => (
        <PrintDocument
          title={`Grade slip — ${slip.term_label}`}
          actions={<PrintButton />}
        >
          <div className="mb-3 grid gap-1 text-sm">
            <p>
              <strong>{slip.student_number}</strong> · {slip.program_name} (
              {slip.program_code})
            </p>
            <p>
              Year {slip.year_level}
              {slip.enrollment_category_label
                ? ` · ${slip.enrollment_category_label}`
                : ""}{" "}
              · {slip.term_label}
            </p>
          </div>
          <Table>
            <TableCaption>Grade slip for {slip.term_label}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Code</TableHead>
                <TableHead scope="col">Subject description</TableHead>
                <TableHead scope="col">Units</TableHead>
                <TableHead scope="col">Final</TableHead>
                <TableHead scope="col">Remarks</TableHead>
                <TableHead scope="col">Section</TableHead>
                <TableHead scope="col">Professor</TableHead>
                <TableHead scope="col">Signature</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slip.rows.map((row) => (
                <TableRow key={row.academic_grade_id}>
                  <TableCell>{row.code}</TableCell>
                  <TableCell>{row.title}</TableCell>
                  <TableCell>{row.units}</TableCell>
                  <TableCell>{row.mark ?? "—"}</TableCell>
                  <TableCell>{row.mark_label ?? "—"}</TableCell>
                  <TableCell>{row.section_code ?? "—"}</TableCell>
                  <TableCell>{row.professor_name ?? "—"}</TableCell>
                  <TableCell className="signature-cell" />
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Total academic units</TableCell>
                <TableCell colSpan={6}>{slip.total_academic_units}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>GPA</TableCell>
                <TableCell colSpan={6}>{slip.gpa ?? "—"}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          {slip.excluded_from_gpa_count > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {slip.excluded_from_gpa_count} subject
              {slip.excluded_from_gpa_count === 1 ? "" : "s"} with a
              non-numeric mark {slip.excluded_from_gpa_count === 1 ? "is" : "are"}{" "}
              excluded from the GPA above.
            </p>
          )}
        </PrintDocument>
      )}
    </AsyncBoundary>
  )
}
