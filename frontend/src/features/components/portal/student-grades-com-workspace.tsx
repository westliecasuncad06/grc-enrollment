"use client"

import { FileCheck2 } from "lucide-react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { DataTable } from "@/features/components/portal/data-table"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { useAcademicGradesQuery } from "@/features/hooks/use-academic-grades"
import { useEnrollmentDocumentsQuery } from "@/features/hooks/use-enrollment-documents"
import { gradeBadgeVariant } from "@/features/lib/grade-presentation"

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
                        render: (grade) => grade.final_grade ?? "—",
                      },
                      {
                        key: "remarks",
                        header: "Remarks",
                        render: (grade) => grade.remarks ?? "—",
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
              <CardHeader>
                <CardTitle level={2} className="flex items-center gap-2">
                  <FileCheck2 aria-hidden="true" className="size-5" />
                  Digital Certificate of Matriculation
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {documents.length === 0 ? (
                  <p>No Digital COM has been generated yet.</p>
                ) : (
                  documents.map((document) => (
                    <div
                      key={document.id}
                      className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                    >
                      <div className="grid gap-1">
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
                      <Button
                        type="button"
                        variant="outline"
                        className="print:hidden"
                        onClick={() => window.print()}
                      >
                        Print / download
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </AsyncBoundary>
    </WorkspacePage>
  )
}
