"use client"

import { FileCheck2 } from "lucide-react"

import { useAuth } from "@/features/auth/use-auth"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Skeleton } from "@/features/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
import { useAcademicGradesQuery } from "@/features/hooks/use-academic-grades"
import { useEnrollmentDocumentsQuery } from "@/features/hooks/use-enrollment-documents"
import type { AcademicGrade } from "@/features/schemas/academic-grade-schema"

function gradeBadgeVariant(
  status: AcademicGrade["status"],
): "default" | "secondary" | "outline" {
  if (status === "locked") return "default"
  if (status === "submitted") return "secondary"
  return "outline"
}

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

  if (!authorized) {
    return (
      <section aria-label="Academic records workspace">
        <p>This workspace is not available for your role.</p>
      </section>
    )
  }

  const loading = gradesQuery.isLoading || documentsQuery.isLoading
  const failed = gradesQuery.isError || documentsQuery.isError

  return (
    <section aria-label="Academic records workspace" className="grid gap-4">
      <div>
        <h2>Your academic records</h2>
        <p>Review your recorded grades and print your Digital COM.</p>
      </div>
      {loading ? (
        <Skeleton className="h-48" />
      ) : failed ? (
        <Alert variant="destructive">
          <AlertDescription>
            Your academic records could not be loaded.{" "}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void Promise.all([
                  gradesQuery.refetch(),
                  documentsQuery.refetch(),
                ])
              }
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Grades</CardTitle>
            </CardHeader>
            <CardContent>
              {(gradesQuery.data?.data.length ?? 0) === 0 ? (
                <p>No grade records are available yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(gradesQuery.data?.data ?? []).map((grade) => (
                      <TableRow key={grade.id}>
                        <TableCell className="font-medium">
                          {grade.subject_code}
                        </TableCell>
                        <TableCell>{grade.final_grade ?? "—"}</TableCell>
                        <TableCell>{grade.remarks ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={gradeBadgeVariant(grade.status)}>
                            {grade.status_label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card className="print:shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck2 aria-hidden="true" className="size-5" />
                Digital Certificate of Matriculation
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {(documentsQuery.data?.data.length ?? 0) === 0 ? (
                <p>No Digital COM has been generated yet.</p>
              ) : (
                (documentsQuery.data?.data ?? []).map((document) => (
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
    </section>
  )
}
