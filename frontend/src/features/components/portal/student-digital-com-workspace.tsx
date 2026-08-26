"use client"

import { useState } from "react"
import { FileCheck2 } from "lucide-react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { CertificateOfRegistrationDocument } from "@/features/components/portal/certificate-of-registration-document"
import { PrintButton, PrintDocument } from "@/features/components/portal/print-document"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Button } from "@/features/components/ui/button"
import {
  useCertificateOfRegistrationQuery,
  useEnrollmentDocumentsQuery,
} from "@/features/hooks/use-enrollment-documents"

/**
 * The student's own Certificate of Registration — separate from
 * Grades (see `StudentGradesWorkspace`) so a failure in one record never
 * blanks the other.
 */
export function StudentDigitalComWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "student"
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null)
  const documentsQuery = useEnrollmentDocumentsQuery(
    { page: 1, per_page: 20 },
    { enabled: authorized },
  )
  const corQuery = useCertificateOfRegistrationQuery(selectedDocumentId, {
    enabled: authorized && selectedDocumentId !== null,
  })

  return (
    <WorkspacePage
      title="Certificate of Registration"
      description="View and print your Certificate of Registration."
      unauthorized={!authorized}
      lastUpdated={documentsQuery.dataUpdatedAt}
    >
      <AsyncBoundary
        query={{ ...documentsQuery, data: documentsQuery.data?.data }}
        isEmpty={(documents) => documents.length === 0}
        emptyMessage="No Certificate of Registration has been generated yet."
        loadingLabel="Loading your Certificate of Registration…"
      >
        {(documents) => (
          <Card className="print:shadow-none">
            <CardHeader className="flex items-center justify-between gap-2">
              <CardTitle level={2} className="flex items-center gap-2">
                <FileCheck2 aria-hidden="true" className="size-5" />
                Certificate of Registration
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
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
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 w-fit"
                    onClick={() => setSelectedDocumentId(document.id)}
                  >
                    View printable COR
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </AsyncBoundary>

      {selectedDocumentId !== null && (
        <AsyncBoundary
          query={{ ...corQuery, data: corQuery.data }}
          isEmpty={(cor) => cor.snapshot === null}
          emptyMessage="This COR is being restored. Please try again shortly."
          loadingLabel="Loading your official COR…"
        >
          {(cor) =>
            cor.snapshot !== null && (
              <PrintDocument
                title={cor.document_number}
                actions={<PrintButton label="Print COR" />}
              >
                <CertificateOfRegistrationDocument
                  cor={{ ...cor, snapshot: cor.snapshot }}
                />
              </PrintDocument>
            )
          }
        </AsyncBoundary>
      )}
    </WorkspacePage>
  )
}
