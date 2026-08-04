"use client"

import { FileCheck2 } from "lucide-react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { PrintButton } from "@/features/components/portal/print-document"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { useEnrollmentDocumentsQuery } from "@/features/hooks/use-enrollment-documents"

/**
 * The student's own Digital Certificate of Matriculation — separate from
 * Grades (see `StudentGradesWorkspace`) so a failure in one record never
 * blanks the other.
 */
export function StudentDigitalComWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "student"
  const documentsQuery = useEnrollmentDocumentsQuery(
    { page: 1, per_page: 20 },
    { enabled: authorized },
  )

  return (
    <WorkspacePage
      title="Digital COM"
      description="View and print your Digital Certificate of Matriculation."
      unauthorized={!authorized}
      lastUpdated={documentsQuery.dataUpdatedAt}
    >
      <AsyncBoundary
        query={{ ...documentsQuery, data: documentsQuery.data?.data }}
        isEmpty={(documents) => documents.length === 0}
        emptyMessage="No Digital COM has been generated yet."
        loadingLabel="Loading your Digital COM…"
      >
        {(documents) => (
          <Card className="print:shadow-none">
            <CardHeader className="flex items-center justify-between gap-2 print:hidden">
              <CardTitle level={2} className="flex items-center gap-2">
                <FileCheck2 aria-hidden="true" className="size-5" />
                Digital Certificate of Matriculation
              </CardTitle>
              <PrintButton />
            </CardHeader>
            <CardContent data-print-region className="print-document grid gap-3">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="grid gap-1 rounded-lg border p-4"
                >
                  <p className="font-medium">{document.document_type_label}</p>
                  <p className="font-mono text-sm text-muted-foreground">
                    {document.document_number}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Generated {new Date(document.generated_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </AsyncBoundary>
    </WorkspacePage>
  )
}
