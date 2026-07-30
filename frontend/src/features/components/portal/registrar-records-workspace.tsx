"use client"

import { useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/features/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
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
import {
  useCreateTransfereeCreditMutation,
  useDecideTransfereeCreditMutation,
  useTransfereeCreditsQuery,
} from "@/features/hooks/use-transferee-credits"
import {
  useDecideWithdrawalRequestMutation,
  useWithdrawalRequestsQuery,
} from "@/features/hooks/use-withdrawal-requests"
import type { AcademicGrade } from "@/features/schemas/academic-grade-schema"
import type { TransfereeCredit } from "@/features/schemas/transferee-credit-schema"

const workspaceHeadings: Record<string, string> = {
  "credit-mappings": "Credit mappings",
  "drops-withdrawals": "Drops & withdrawals",
  "academic-records": "Academic records",
  "enrollment-documents": "Enrollment documents",
}

function pendingBadgeVariant(
  status: TransfereeCredit["status"],
): "default" | "destructive" | "outline" {
  if (status === "rejected") return "destructive"
  if (status === "approved") return "default"
  return "outline"
}

function gradeBadgeVariant(
  status: AcademicGrade["status"],
): "default" | "secondary" | "outline" {
  if (status === "locked") return "default"
  if (status === "submitted") return "secondary"
  return "outline"
}

interface DecisionTarget {
  kind: "credit" | "withdrawal"
  id: number
  action: "approve" | "reject"
}

/**
 * Unlike `AccountingPaymentWorkspace`/`AdmissionProvisioningWorkspace` (whose
 * modules are steps of one flow, so every card renders regardless of which
 * link was clicked), these four modules are unrelated record types — so
 * only the module matching `initialModuleId` renders. Every query below is
 * still called unconditionally (Rules of Hooks); only the inactive ones are
 * `enabled: false`.
 */
export function RegistrarRecordsWorkspace({
  initialModuleId = "credit-mappings",
}: {
  initialModuleId?: string
}) {
  const { session } = useAuth()
  const authorized = session?.role === "registrar_staff"
  const heading =
    workspaceHeadings[initialModuleId] ?? workspaceHeadings["credit-mappings"]

  const showCredits = authorized && initialModuleId === "credit-mappings"
  const showWithdrawals = authorized && initialModuleId === "drops-withdrawals"
  const showGrades = authorized && initialModuleId === "academic-records"
  const showDocuments = authorized && initialModuleId === "enrollment-documents"

  const [creditsPage, setCreditsPage] = useState(1)
  const [withdrawalsPage, setWithdrawalsPage] = useState(1)
  const [gradesPage, setGradesPage] = useState(1)
  const [documentsPage, setDocumentsPage] = useState(1)

  const [decision, setDecision] = useState<DecisionTarget | null>(null)
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")

  const [studentId, setStudentId] = useState("")
  const [sourceInstitution, setSourceInstitution] = useState("")
  const [sourceSubjectCode, setSourceSubjectCode] = useState("")
  const [sourceSubjectTitle, setSourceSubjectTitle] = useState("")
  const [sourceGrade, setSourceGrade] = useState("")
  const [creditedUnits, setCreditedUnits] = useState("")
  const [createError, setCreateError] = useState("")

  const creditsQuery = useTransfereeCreditsQuery(
    { page: creditsPage, per_page: 20 },
    { enabled: showCredits },
  )
  const createCreditMutation = useCreateTransfereeCreditMutation()
  const decideCreditMutation = useDecideTransfereeCreditMutation()

  const withdrawalsQuery = useWithdrawalRequestsQuery(
    { page: withdrawalsPage, per_page: 20 },
    { enabled: showWithdrawals },
  )
  const decideWithdrawalMutation = useDecideWithdrawalRequestMutation()

  const gradesQuery = useAcademicGradesQuery(
    { page: gradesPage, per_page: 20 },
    { enabled: showGrades },
  )

  const documentsQuery = useEnrollmentDocumentsQuery(
    { page: documentsPage, per_page: 20 },
    { enabled: showDocuments },
  )

  if (!authorized) {
    return (
      <section aria-label="Registrar records workspace">
        <p>This workspace is not available for your role.</p>
      </section>
    )
  }

  const deciding =
    decideCreditMutation.isPending || decideWithdrawalMutation.isPending

  const confirmDecision = async () => {
    if (!decision) return
    if (decision.action === "reject" && !reason.trim()) return
    setError("")
    try {
      if (decision.kind === "credit") {
        await decideCreditMutation.mutateAsync({
          id: decision.id,
          input: {
            action: decision.action,
            reason: reason.trim() || undefined,
          },
        })
      } else {
        await decideWithdrawalMutation.mutateAsync({
          id: decision.id,
          input: {
            action: decision.action,
            reason: reason.trim() || undefined,
          },
        })
      }
      setDecision(null)
      setReason("")
    } catch {
      setError(
        "The decision could not be saved. Check the connection and try again.",
      )
    }
  }

  const createCredit = async () => {
    setCreateError("")
    const parsedStudentId = Number(studentId)
    const parsedCreditedUnits = Number(creditedUnits)
    if (!Number.isSafeInteger(parsedStudentId) || parsedStudentId <= 0) {
      setCreateError("Enter a valid student ID.")
      return
    }
    if (
      !Number.isSafeInteger(parsedCreditedUnits) ||
      parsedCreditedUnits <= 0
    ) {
      setCreateError("Enter a valid number of credited units.")
      return
    }
    try {
      await createCreditMutation.mutateAsync({
        student_id: parsedStudentId,
        source_institution: sourceInstitution.trim(),
        source_subject_code: sourceSubjectCode.trim(),
        source_subject_title: sourceSubjectTitle.trim(),
        source_grade: sourceGrade.trim() || undefined,
        credited_units: parsedCreditedUnits,
      })
      setStudentId("")
      setSourceInstitution("")
      setSourceSubjectCode("")
      setSourceSubjectTitle("")
      setSourceGrade("")
      setCreditedUnits("")
    } catch {
      setCreateError(
        "The transferee credit could not be recorded. Check the connection and try again.",
      )
    }
  }

  return (
    <section aria-label="Registrar records workspace" className="grid gap-4">
      <div>
        <h2>{heading}</h2>
        <p>Maintain accurate enrollment and academic records.</p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {showCredits && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Record a transferee credit</CardTitle>
            </CardHeader>
            <CardContent>
              {createError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{createError}</AlertDescription>
                </Alert>
              )}
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="credit-student-id">
                    Student ID (see Academic Records)
                  </FieldLabel>
                  <Input
                    id="credit-student-id"
                    inputMode="numeric"
                    value={studentId}
                    onChange={(event) => setStudentId(event.target.value)}
                    disabled={createCreditMutation.isPending}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="credit-source-institution">
                    Source institution
                  </FieldLabel>
                  <Input
                    id="credit-source-institution"
                    value={sourceInstitution}
                    onChange={(event) =>
                      setSourceInstitution(event.target.value)
                    }
                    disabled={createCreditMutation.isPending}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="credit-source-code">
                    Source subject code
                  </FieldLabel>
                  <Input
                    id="credit-source-code"
                    value={sourceSubjectCode}
                    onChange={(event) =>
                      setSourceSubjectCode(event.target.value)
                    }
                    disabled={createCreditMutation.isPending}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="credit-source-title">
                    Source subject title
                  </FieldLabel>
                  <Input
                    id="credit-source-title"
                    value={sourceSubjectTitle}
                    onChange={(event) =>
                      setSourceSubjectTitle(event.target.value)
                    }
                    disabled={createCreditMutation.isPending}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="credit-source-grade">
                    Source grade (optional)
                  </FieldLabel>
                  <Input
                    id="credit-source-grade"
                    value={sourceGrade}
                    onChange={(event) => setSourceGrade(event.target.value)}
                    disabled={createCreditMutation.isPending}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="credit-units">Credited units</FieldLabel>
                  <Input
                    id="credit-units"
                    inputMode="numeric"
                    value={creditedUnits}
                    onChange={(event) => setCreditedUnits(event.target.value)}
                    disabled={createCreditMutation.isPending}
                  />
                </Field>
                <Button
                  type="button"
                  disabled={createCreditMutation.isPending}
                  onClick={() => void createCredit()}
                >
                  {createCreditMutation.isPending
                    ? "Recording credit"
                    : "Record credit"}
                </Button>
              </FieldGroup>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Transferee credits</CardTitle>
            </CardHeader>
            <CardContent>
              {creditsQuery.isLoading ? (
                <Skeleton className="h-32" />
              ) : creditsQuery.isError ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    Transferee credits could not be loaded.
                  </AlertDescription>
                </Alert>
              ) : (creditsQuery.data?.data.length ?? 0) === 0 ? (
                <p>No transferee credits have been recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Units</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(creditsQuery.data?.data ?? []).map((credit) => (
                      <TableRow key={credit.id}>
                        <TableCell>{credit.student_number}</TableCell>
                        <TableCell>
                          {credit.source_institution} —{" "}
                          {credit.source_subject_code}
                        </TableCell>
                        <TableCell>{credit.credited_units}</TableCell>
                        <TableCell>
                          <Badge variant={pendingBadgeVariant(credit.status)}>
                            {credit.status_label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {credit.status === "pending" && (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={deciding}
                                onClick={() => {
                                  setDecision({
                                    kind: "credit",
                                    id: credit.id,
                                    action: "approve",
                                  })
                                  setReason("")
                                  setError("")
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={deciding}
                                onClick={() => {
                                  setDecision({
                                    kind: "credit",
                                    id: credit.id,
                                    action: "reject",
                                  })
                                  setReason("")
                                  setError("")
                                }}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="mt-4 flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={creditsPage <= 1}
                  onClick={() =>
                    setCreditsPage((value) => Math.max(1, value - 1))
                  }
                >
                  Previous page
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {creditsQuery.data?.meta.current_page ?? 1} of{" "}
                  {creditsQuery.data?.meta.last_page ?? 1}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    (creditsQuery.data?.meta.current_page ?? 1) >=
                    (creditsQuery.data?.meta.last_page ?? 1)
                  }
                  onClick={() => setCreditsPage((value) => value + 1)}
                >
                  Next page
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {showWithdrawals && (
        <Card>
          <CardHeader>
            <CardTitle>Withdrawal requests</CardTitle>
          </CardHeader>
          <CardContent>
            {withdrawalsQuery.isLoading ? (
              <Skeleton className="h-32" />
            ) : withdrawalsQuery.isError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  Withdrawal requests could not be loaded.
                </AlertDescription>
              </Alert>
            ) : (withdrawalsQuery.data?.data.length ?? 0) === 0 ? (
              <p>No withdrawal requests are pending review.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Enrollment</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(withdrawalsQuery.data?.data ?? []).map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{request.student_number}</TableCell>
                      <TableCell>#{request.enrollment_id}</TableCell>
                      <TableCell>{request.reason}</TableCell>
                      <TableCell>
                        <Badge variant={pendingBadgeVariant(request.status)}>
                          {request.status_label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {request.status === "pending" && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={deciding}
                              onClick={() => {
                                setDecision({
                                  kind: "withdrawal",
                                  id: request.id,
                                  action: "approve",
                                })
                                setReason("")
                                setError("")
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={deciding}
                              onClick={() => {
                                setDecision({
                                  kind: "withdrawal",
                                  id: request.id,
                                  action: "reject",
                                })
                                setReason("")
                                setError("")
                              }}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="mt-4 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={withdrawalsPage <= 1}
                onClick={() =>
                  setWithdrawalsPage((value) => Math.max(1, value - 1))
                }
              >
                Previous page
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {withdrawalsQuery.data?.meta.current_page ?? 1} of{" "}
                {withdrawalsQuery.data?.meta.last_page ?? 1}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  (withdrawalsQuery.data?.meta.current_page ?? 1) >=
                  (withdrawalsQuery.data?.meta.last_page ?? 1)
                }
                onClick={() => setWithdrawalsPage((value) => value + 1)}
              >
                Next page
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showGrades && (
        <Card>
          <CardHeader>
            <CardTitle>Academic records</CardTitle>
          </CardHeader>
          <CardContent>
            {gradesQuery.isLoading ? (
              <Skeleton className="h-32" />
            ) : gradesQuery.isError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  Academic records could not be loaded.
                </AlertDescription>
              </Alert>
            ) : (gradesQuery.data?.data.length ?? 0) === 0 ? (
              <p>No academic records exist yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(gradesQuery.data?.data ?? []).map((grade) => (
                    <TableRow key={grade.id}>
                      <TableCell>{grade.student_id}</TableCell>
                      <TableCell>{grade.student_number}</TableCell>
                      <TableCell>{grade.subject_code}</TableCell>
                      <TableCell>{grade.final_grade ?? "—"}</TableCell>
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
            <div className="mt-4 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={gradesPage <= 1}
                onClick={() => setGradesPage((value) => Math.max(1, value - 1))}
              >
                Previous page
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {gradesQuery.data?.meta.current_page ?? 1} of{" "}
                {gradesQuery.data?.meta.last_page ?? 1}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  (gradesQuery.data?.meta.current_page ?? 1) >=
                  (gradesQuery.data?.meta.last_page ?? 1)
                }
                onClick={() => setGradesPage((value) => value + 1)}
              >
                Next page
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showDocuments && (
        <Card>
          <CardHeader>
            <CardTitle>Enrollment documents</CardTitle>
          </CardHeader>
          <CardContent>
            {documentsQuery.isLoading ? (
              <Skeleton className="h-32" />
            ) : documentsQuery.isError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  Enrollment documents could not be loaded.
                </AlertDescription>
              </Alert>
            ) : (documentsQuery.data?.data.length ?? 0) === 0 ? (
              <p>No enrollment documents have been generated yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Document type</TableHead>
                    <TableHead>Document number</TableHead>
                    <TableHead>Generated at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(documentsQuery.data?.data ?? []).map((document) => (
                    <TableRow key={document.id}>
                      <TableCell>{document.student_number}</TableCell>
                      <TableCell>{document.document_type_label}</TableCell>
                      <TableCell className="font-mono">
                        {document.document_number}
                      </TableCell>
                      <TableCell>
                        {new Date(document.generated_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="mt-4 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={documentsPage <= 1}
                onClick={() =>
                  setDocumentsPage((value) => Math.max(1, value - 1))
                }
              >
                Previous page
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {documentsQuery.data?.meta.current_page ?? 1} of{" "}
                {documentsQuery.data?.meta.last_page ?? 1}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  (documentsQuery.data?.meta.current_page ?? 1) >=
                  (documentsQuery.data?.meta.last_page ?? 1)
                }
                onClick={() => setDocumentsPage((value) => value + 1)}
              >
                Next page
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={decision !== null}
        onOpenChange={(open) => {
          if (!open && !deciding) setDecision(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm decision</AlertDialogTitle>
            <AlertDialogDescription>
              This decision is recorded in the operational audit log and
              notifies the student.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {decision?.action === "reject" && (
            <Field>
              <FieldLabel htmlFor="registrar-record-decision-reason">
                Reason
              </FieldLabel>
              <textarea
                id="registrar-record-decision-reason"
                className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={deciding}
              />
            </Field>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deciding}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={
                deciding || (decision?.action === "reject" && !reason.trim())
              }
              onClick={() => void confirmDecision()}
            >
              {deciding ? "Saving decision" : "Confirm decision"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
