"use client"

import { useState } from "react"
import { FileCheck2, ReceiptText, RefreshCw } from "lucide-react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { CertificateOfRegistrationDocument } from "@/features/components/portal/certificate-of-registration-document"
import {
  DownloadPdfButton,
  PrintButton,
  PrintDocument,
} from "@/features/components/portal/print-document"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Badge } from "@/features/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Button } from "@/features/components/ui/button"
import {
  useCertificateOfRegistrationQuery,
  useEnrollmentDocumentsQuery,
} from "@/features/hooks/use-enrollment-documents"
import { useOwnStudentAccountQuery } from "@/features/hooks/use-student-account"

function formatPhp(amount: string): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(amount))
}

/**
 * The student's own Certificate of Registration and payment transaction history.
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
  const accountQuery = useOwnStudentAccountQuery({ enabled: authorized })

  return (
    <WorkspacePage
      title="Certificate of Registration"
      description="View and download your official Certificate of Registration and payment receipts."
      unauthorized={!authorized}
      lastUpdated={documentsQuery.dataUpdatedAt}
    >
      {accountQuery.data && (
        <Card className={selectedDocumentId !== null ? "print:hidden" : "print:shadow-none"}>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle level={2} className="flex items-center gap-2">
                <ReceiptText aria-hidden="true" className="size-5" />
                Payment & Account Summary
              </CardTitle>
              <CardDescription>
                Summary of fees assessed and payments confirmed by the Cashier.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {accountQuery.data.outstanding_balance === "0.00" ? (
                <Badge variant="outline" className="border-emerald-600/40 text-emerald-800 bg-emerald-50 dark:bg-emerald-950/20">
                  Paid in Full
                </Badge>
              ) : (
                <Badge variant="outline" className="border-destructive/40 text-destructive bg-destructive/10">
                  Remaining Balance: {formatPhp(accountQuery.data.outstanding_balance)}
                </Badge>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => void accountQuery.refetch()}
                disabled={accountQuery.isFetching}
              >
                <RefreshCw
                  className={`size-3.5 ${accountQuery.isFetching ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <dl className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">Total Assessed</dt>
                <dd className="text-lg font-semibold">
                  {formatPhp(accountQuery.data.total_assessed)}
                </dd>
              </div>
              <div className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">Amount Paid</dt>
                <dd className="text-lg font-semibold text-primary">
                  {formatPhp(accountQuery.data.total_paid)}
                </dd>
              </div>
              <div className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">Remaining Balance</dt>
                <dd className={`text-lg font-bold ${accountQuery.data.outstanding_balance !== "0.00" ? "text-destructive" : "text-emerald-600"}`}>
                  {formatPhp(accountQuery.data.outstanding_balance)}
                </dd>
              </div>
            </dl>

            {accountQuery.data.transactions && accountQuery.data.transactions.length > 0 && (
              <div className="grid gap-2 pt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Cashier Payment Transactions & Official Receipts
                </h3>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-left text-sm" aria-label="Student payment transactions">
                    <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
                      <tr>
                        <th className="p-2.5">Date & Time</th>
                        <th className="p-2.5">Payment Type</th>
                        <th className="p-2.5">Reference / OR</th>
                        <th className="p-2.5">Cashier</th>
                        <th className="p-2.5 text-right">Amount Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {accountQuery.data.transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-muted/30">
                          <td className="p-2.5 text-xs text-muted-foreground">
                            {new Date(tx.processed_at).toLocaleString()}
                          </td>
                          <td className="p-2.5 font-medium">
                            {tx.transaction_type_label}
                            {tx.promissory_note_on_file && (
                              <Badge variant="secondary" className="ml-1.5 text-[10px] py-0">
                                Promissory Note
                              </Badge>
                            )}
                          </td>
                          <td className="p-2.5 font-mono text-xs">
                            {tx.reference_number}
                          </td>
                          <td className="p-2.5 text-xs text-muted-foreground">
                            {tx.cashier_name}
                          </td>
                          <td className="p-2.5 text-right font-semibold text-primary">
                            {formatPhp(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AsyncBoundary
        query={{ ...documentsQuery, data: documentsQuery.data?.data }}
        isEmpty={(documents) => documents.length === 0}
        emptyMessage="No Certificate of Registration has been generated yet."
        loadingLabel="Loading your Certificate of Registration…"
      >
        {(documents) => (
          <Card className={selectedDocumentId !== null ? "print:hidden" : "print:shadow-none"}>
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
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedDocumentId(document.id)}
                    >
                      View COR
                    </Button>
                    <DownloadPdfButton
                      documentId={document.id}
                      documentNumber={document.document_number}
                      label="Download COR"
                    />
                  </div>
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
                actions={
                  <div className="flex items-center gap-2">
                    <PrintButton label="Print COR" />
                    <DownloadPdfButton
                      documentId={cor.id}
                      documentNumber={cor.document_number}
                      label="Download COR (PDF)"
                    />
                  </div>
                }
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
