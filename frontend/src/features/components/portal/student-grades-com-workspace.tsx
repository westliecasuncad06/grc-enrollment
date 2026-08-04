"use client"

import { FileCheck2 } from "lucide-react"
import { useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { DataTable } from "@/features/components/portal/data-table"
import { GradeSlipDocument } from "@/features/components/portal/grade-slip-document"
import { PrintButton } from "@/features/components/portal/print-document"
import { ProspectusDocument } from "@/features/components/portal/prospectus-document"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Badge } from "@/features/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Field, FieldLabel } from "@/features/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/components/ui/select"
import { useAcademicGradesQuery } from "@/features/hooks/use-academic-grades"
import { useEnrollmentDocumentsQuery } from "@/features/hooks/use-enrollment-documents"
import { useAcademicTermsQuery } from "@/features/hooks/use-reference-data"
import { gradeBadgeVariant } from "@/features/lib/grade-presentation"
import { formatAcademicTerm } from "@/features/services/reference-data-service"

export function StudentGradesComWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "student"
  const gradesQuery = useAcademicGradesQuery(
    { page: 1, per_page: 20 },
    { enabled: authorized },
  )
  const documentsQuery = useEnrollmentDocumentsQuery(
    { page: 1, per_page: 20 },
    { enabled: authorized },
  )
  const termsQuery = useAcademicTermsQuery({ enabled: authorized })
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null)
  const combinedQuery = {
    isPending: gradesQuery.isPending || documentsQuery.isPending,
    isError: gradesQuery.isError || documentsQuery.isError,
    error: gradesQuery.error ?? documentsQuery.error,
    data:
      gradesQuery.data && documentsQuery.data
        ? { grades: gradesQuery.data.data, documents: documentsQuery.data.data }
        : undefined,
    refetch: () => {
      void gradesQuery.refetch()
      void documentsQuery.refetch()
    },
  }

  return (
    <WorkspacePage
      title="Your academic records"
      description="Review your recorded grades and print your Digital COM."
      unauthorized={!authorized}
      lastUpdated={gradesQuery.dataUpdatedAt}
    >
      <AsyncBoundary
        query={combinedQuery}
        loadingLabel="Loading your academic records…"
      >
        {({ grades, documents }) => (
          <>
            <Card>
              <CardHeader>
                <CardTitle level={2}>Grades</CardTitle>
              </CardHeader>
              <CardContent>
                {grades.length === 0 ? (
                  <p>No grade records are available yet.</p>
                ) : (
                  <DataTable
                    caption="Grades"
                    rowKey={(grade) => grade.id}
                    rows={grades}
                    columns={[
                      {
                        key: "subject",
                        header: "Subject",
                        render: (grade) => grade.subject_code,
                      },
                      {
                        key: "grade",
                        header: "Grade",
                        render: (grade) => grade.mark ?? "—",
                      },
                      {
                        key: "remarks",
                        header: "Remarks",
                        render: (grade) => (
                          <div className="grid gap-0.5">
                            <span>{grade.mark_label ?? "—"}</span>
                            {grade.remarks && (
                              <span className="text-xs text-muted-foreground">
                                {grade.remarks}
                              </span>
                            )}
                          </div>
                        ),
                      },
                      {
                        key: "status",
                        header: "Status",
                        render: (grade) => (
                          <Badge variant={gradeBadgeVariant(grade.status)}>
                            {grade.status_label}
                          </Badge>
                        ),
                      },
                    ]}
                  />
                )}
              </CardContent>
            </Card>
            <Card className="print:shadow-none">
              <CardHeader className="flex items-center justify-between gap-2 print:hidden">
                <CardTitle level={2} className="flex items-center gap-2">
                  <FileCheck2 aria-hidden="true" className="size-5" />
                  Digital Certificate of Matriculation
                </CardTitle>
                {documents.length > 0 && <PrintButton />}
              </CardHeader>
              <CardContent
                data-print-region
                className="print-document grid gap-3"
              >
                {documents.length === 0 ? (
                  <p>No Digital COM has been generated yet.</p>
                ) : (
                  documents.map((document) => (
                    <div
                      key={document.id}
                      className="grid gap-1 rounded-lg border p-4"
                    >
                      <p className="font-medium">
                        {document.document_type_label}
                      </p>
                      <p className="font-mono text-sm text-muted-foreground">
                        {document.document_number}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Generated{" "}
                        {new Date(document.generated_at).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle level={2}>Prospectus</CardTitle>
              </CardHeader>
              <CardContent>
                <ProspectusDocument />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle level={2}>Grade slip</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Field className="max-w-xs">
                  <FieldLabel htmlFor="grade-slip-term">Academic term</FieldLabel>
                  <Select
                    value={selectedTermId !== null ? String(selectedTermId) : ""}
                    onValueChange={(value) => setSelectedTermId(Number(value) || null)}
                    disabled={termsQuery.isLoading}
                  >
                    <SelectTrigger id="grade-slip-term" className="w-full">
                      <SelectValue placeholder="Select an academic term" />
                    </SelectTrigger>
                    <SelectContent>
                      {(termsQuery.data ?? []).map((term) => (
                        <SelectItem key={term.id} value={String(term.id)}>
                          {formatAcademicTerm(term)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {selectedTermId !== null ? (
                  <GradeSlipDocument academicTermId={selectedTermId} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select an academic term to view its grade slip.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </AsyncBoundary>
    </WorkspacePage>
  )
}
