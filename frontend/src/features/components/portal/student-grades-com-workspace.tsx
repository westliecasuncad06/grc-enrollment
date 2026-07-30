"use client"

import { useAuth } from "@/features/auth/use-auth"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Skeleton } from "@/features/components/ui/skeleton"
import { useAcademicGradesQuery } from "@/features/hooks/use-academic-grades"
import { useEnrollmentDocumentsQuery } from "@/features/hooks/use-enrollment-documents"

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
                <ul className="grid gap-3">
                  {(gradesQuery.data?.data ?? []).map((grade) => (
                    <li key={grade.id} className="rounded-md border p-3">
                      <p>
                        {grade.subject_code} · {grade.status_label}
                      </p>
                      <p>
                        Grade: {grade.final_grade ?? "—"}
                        {grade.remarks ? ` (${grade.remarks})` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card className="print:shadow-none">
            <CardHeader>
              <CardTitle>Digital Certificate of Matriculation</CardTitle>
            </CardHeader>
            <CardContent>
              {(documentsQuery.data?.data.length ?? 0) === 0 ? (
                <p>No Digital COM has been generated yet.</p>
              ) : (
                <ul className="grid gap-3">
                  {(documentsQuery.data?.data ?? []).map((document) => (
                    <li key={document.id} className="rounded-md border p-3">
                      <p>{document.document_type_label}</p>
                      <p>Document number: {document.document_number}</p>
                      <p>
                        Generated:{" "}
                        {new Date(document.generated_at).toLocaleString()}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-2 print:hidden"
                        onClick={() => window.print()}
                      >
                        Print / download
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  )
}
