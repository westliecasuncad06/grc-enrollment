"use client"

import { useState } from "react"
import { Printer } from "lucide-react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { CertificateOfRegistrationDocument } from "@/features/components/portal/certificate-of-registration-document"
import { DataTable } from "@/features/components/portal/data-table"
import {
  PaymentClassificationDialog,
  ScholarshipTierDialog,
  type PaymentClassification,
} from "@/features/components/portal/payment-classification-dialogs"
import {
  DownloadPdfButton,
  PrintButton,
  PrintDocument,
} from "@/features/components/portal/print-document"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/features/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/features/components/ui/dialog"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
import { Checkbox } from "@/features/components/ui/checkbox"
import {
  useApplyScholarshipDiscountMutation,
  useConfirmPaymentMutation,
  useCorPreviewQuery,
  useEnrollmentsListQuery,
  useRemoveScholarshipDiscountMutation,
} from "@/features/hooks/use-enrollment"
import {
  useStudentAccountQuery,
} from "@/features/hooks/use-student-account"
import {
  useClaimQueueTicketMutation,
  useQueueTicketsQuery,
  useUpdateQueueTicketMutation,
} from "@/features/hooks/use-queue-tickets"
import {
  useCutOffQueueMutation,
  useQueueCycleQuery,
  useResumeQueueMutation,
} from "@/features/hooks/use-queue-cycle"
import { useCertificateOfRegistrationQuery } from "@/features/hooks/use-enrollment-documents"
import { useCashierPaymentCandidateQuery } from "@/features/hooks/use-cashier-transactions"
import type {
  Enrollment,
  PaymentConfirmation,
  ScholarshipPercentage,
} from "@/features/schemas/enrollment-schema"
import { isApiClientError } from "@/features/services/api-client"
import type { QueueTicket } from "@/features/schemas/queue-ticket-schema"
import { playQueueAlert } from "@/features/lib/queue-announcement"
import { formatYearLevel } from "@/features/lib/format-year-level"

/**
 * Priority tickets always precede regular ones; within a tier, ordered by
 * `queue_date` (the Cashier's queue can span multiple Manila service days
 * once a cut-off carries tickets forward — a carry-over always sorts ahead
 * of a ticket claimed on a later date, even if the carry-over's own
 * `requeued_at` is a later raw timestamp than the newer ticket's
 * `created_at`), then effective order — `requeued_at` if the ticket was
 * ever skipped, otherwise `created_at`.
 *
 * `created_at`/`requeued_at` are whole-second timestamps, so an exact tie
 * on that effective order is routine, not a rare edge case. `id` can't be
 * the *whole* tiebreak for that tie: a low-id ticket requeued after a
 * higher-id ticket already exists must now sort *after* it, which a plain
 * `id` comparison gets backwards. So a tie first splits on whether the
 * ticket was ever requeued — never-requeued (arrival order) always
 * precedes requeued (skip moment) — and only falls back to `id` once both
 * candidates agree on that split, i.e. a true same-instant tie within one
 * regime. Mirrors `QueueTicket::position()`/`ListQueueTickets` server-side
 * exactly (`queue_date`, then effective order, then the `requeued_at IS
 * NOT NULL` regime split, then `id`).
 */
function byQueueOrder(a: QueueTicket, b: QueueTicket): number {
  if (a.priority !== b.priority) return a.priority === "priority" ? -1 : 1
  if (a.queue_date !== b.queue_date) return a.queue_date < b.queue_date ? -1 : 1
  const aOrder = a.requeued_at ?? a.created_at
  const bOrder = b.requeued_at ?? b.created_at
  if (aOrder !== bOrder) return aOrder < bOrder ? -1 : 1
  const aRequeued = a.requeued_at !== null
  const bRequeued = b.requeued_at !== null
  if (aRequeued !== bRequeued) return aRequeued ? 1 : -1
  return a.id - b.id
}

function formatAmountDue(enrollment: Enrollment | undefined) {
  const total = enrollment?.assessment?.total_amount
  return total ? `₱${total}` : "—"
}

/**
 * The enrollment payment rule agreed for the Cashier workflow, also enforced by
 * the API (`ConfirmPaymentRequest`): an explicit first payment is at least this.
 */
const MIN_FIRST_PAYMENT = 1000

/** The tier stored on a scholarship line (in its `quantity`), or null if it is not one. */
function scholarshipTierOf(
  item: { quantity: string | null } | null,
): ScholarshipPercentage | null {
  const value = item?.quantity ? Math.round(Number(item.quantity)) : null
  return value === 100 || value === 40 || value === 20 ? value : null
}

/** The API's own reason when it gave one (e.g. "cannot be changed after payment"), else `fallback`. */
function apiMessage(error: unknown, fallback: string): string {
  if (isApiClientError(error)) {
    const first = Object.values(error.fieldErrors ?? {})[0]?.[0]
    if (first) return first
  }
  return fallback
}

function formatPhp(amount: string): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(amount))
}

function WaitingTicketCard({
  ticket,
  enrollment,
  pending,
  onMarkPriority,
}: {
  ticket: QueueTicket
  enrollment: Enrollment | undefined
  pending: boolean
  onMarkPriority: (ticket: QueueTicket) => void
}) {
  return (
    <Card role="article" aria-label={`Waiting ticket ${ticket.ticket_number}`}>
      <CardHeader>
        <CardTitle level={3}>{ticket.ticket_number}</CardTitle>
        {ticket.priority === "priority" && (
          <Badge variant="outline">Priority</Badge>
        )}
        <CardDescription>{ticket.student_number}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 text-sm">
          <div className="grid gap-1">
            <dt className="text-muted-foreground">Amount due</dt>
            <dd className="font-medium">{formatAmountDue(enrollment)}</dd>
          </div>
          {enrollment?.student_financial_status_label && (
            <div className="grid gap-1">
              <dt className="text-muted-foreground">Student status</dt>
              <dd>
                <Badge variant="secondary">
                  {enrollment.student_financial_status_label}
                </Badge>
              </dd>
            </div>
          )}
        </dl>
      </CardContent>
      {ticket.priority === "regular" && (
        <CardFooter className="items-stretch">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onMarkPriority(ticket)}
            className="w-full"
          >
            Mark priority
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

function ServedTicketCard({ ticket }: { ticket: QueueTicket }) {
  return (
    <Card role="article" aria-label={`Served ticket ${ticket.ticket_number}`}>
      <CardHeader>
        <CardTitle level={3}>{ticket.ticket_number}</CardTitle>
        <CardDescription>{ticket.student_number}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-1 text-sm">
          <dt className="text-muted-foreground">Served at</dt>
          <dd>
            {ticket.served_at
              ? new Date(ticket.served_at).toLocaleTimeString()
              : "—"}
          </dd>
        </dl>
      </CardContent>
    </Card>
  )
}

/**
 * The Cashier's guided flow: one NOW SERVING panel driving call-next,
 * skip, and payment confirmation, plus the waiting line and today's served
 * tickets — replaces the four separate payment-queue/serving-number/
 * payment-confirmation/com-finalization modules with a single screen a
 * cashier can work top to bottom without navigating away.
 */
export function AccountingPaymentWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "accounting_staff"
  // Confirm payment is a short chain of dialogs (ADR 0025): the Payee/Scholar
  // question, the tier for a scholar, then the payment modal.
  const [step, setStep] = useState<
    "closed" | "classification" | "scholarship" | "payment"
  >("closed")
  const confirming = step === "payment"
  const [amountOverride, setAmountOverride] = useState<string | null>(null)
  const [stepError, setStepError] = useState("")
  const [promissoryNoteOnFile, setPromissoryNoteOnFile] = useState(false)
  const [lastConfirmation, setLastConfirmation] =
    useState<PaymentConfirmation | null>(null)
  const [viewingCorDocumentId, setViewingCorDocumentId] = useState<
    number | null
  >(null)
  const corQuery = useCertificateOfRegistrationQuery(viewingCorDocumentId, {
    enabled: viewingCorDocumentId !== null,
  })
  const [previewingEnrollmentId, setPreviewingEnrollmentId] = useState<
    number | null
  >(null)
  const corPreviewQuery = useCorPreviewQuery(previewingEnrollmentId)
  const [processedEnrollmentId, setProcessedEnrollmentId] = useState<
    number | null
  >(null)
  const [studentNumberInput, setStudentNumberInput] = useState("")
  const [submittedStudentNumber, setSubmittedStudentNumber] = useState<
    string | null
  >(null)
  const [error, setError] = useState("")

  const ticketsQuery = useQueueTicketsQuery(
    { cycle: "open", page: 1, per_page: 100 },
    { enabled: authorized },
  )
  const ticketMutation = useUpdateQueueTicketMutation()
  const pendingPaymentQuery = useEnrollmentsListQuery(
    { status: "pending_payment", page: 1, per_page: 100 },
    { enabled: authorized },
  )
  const paymentMutation = useConfirmPaymentMutation()
  const applyScholarship = useApplyScholarshipDiscountMutation()
  const removeScholarship = useRemoveScholarshipDiscountMutation()
  const cycleQuery = useQueueCycleQuery({ enabled: authorized })
  const cutOffMutation = useCutOffQueueMutation()
  const resumeMutation = useResumeQueueMutation()
  const claimMutation = useClaimQueueTicketMutation()
  const [cuttingOff, setCuttingOff] = useState(false)

  const tickets = ticketsQuery.data?.data ?? []
  const enrollments = pendingPaymentQuery.data?.data ?? []
  const enrollmentFor = (ticket: QueueTicket): Enrollment | undefined =>
    enrollments.find((enrollment) => enrollment.id === ticket.enrollment_id)

  const nowServing = tickets.find((ticket) => ticket.status === "serving")
  const waiting = [...tickets]
    .filter((ticket) => ticket.status === "waiting")
    .sort(byQueueOrder)
  const servedToday = [...tickets]
    .filter((ticket) => ticket.status === "served")
    .sort((a, b) => {
      const aTime = a.served_at ? new Date(a.served_at).getTime() : 0
      const bTime = b.served_at ? new Date(b.served_at).getTime() : 0
      if (bTime !== aTime) {
        return bTime - aTime
      }
      return b.id - a.id
    })
  const nowServingEnrollment = nowServing
    ? enrollmentFor(nowServing)
    : undefined
  const accountQuery = useStudentAccountQuery(
    nowServingEnrollment?.student_id ?? null,
    { enabled: authorized && nowServingEnrollment !== undefined },
  )
  const candidateQuery = useCashierPaymentCandidateQuery(
    submittedStudentNumber,
    { enabled: authorized },
  )
  // The assessment the payment is against: net of any scholarship line.
  const assessment = nowServingEnrollment?.assessment ?? null
  const discountItem =
    assessment?.items.find((item) => item.category === "scholarship_discount") ??
    null
  const discountAmount = discountItem?.amount
    ? Math.abs(Number(discountItem.amount))
    : 0
  const netTotal =
    assessment?.total_amount != null ? Number(assessment.total_amount) : null
  const baseAmount =
    netTotal !== null ? Math.round((netTotal + discountAmount) * 100) / 100 : 0
  // Below the minimum (a 100% scholarship's zero included) the assessment is
  // collected in full, so no amount is typed or sent; the API falls back to it.
  const fixedAmount = netTotal !== null && netTotal < MIN_FIRST_PAYMENT
  const amount = amountOverride ?? (netTotal !== null ? netTotal.toFixed(2) : "")
  const amountBelowMinimum =
    !fixedAmount && amount.trim() !== "" && !(Number(amount) >= MIN_FIRST_PAYMENT)
  const isPartialPayment =
    !amountBelowMinimum &&
    netTotal !== null &&
    Number(amount) > 0 &&
    Number(amount) < netTotal
  const currentClassification: PaymentClassification =
    (accountQuery.data?.financial_status ??
      nowServingEnrollment?.student_financial_status) === "scholar"
      ? "scholar"
      : "payee"
  const studentDisplayName =
    accountQuery.data?.student_name ??
    nowServingEnrollment?.student_name ??
    nowServingEnrollment?.student_number ??
    "this student"
  const isCurrentEnrollmentProcessed =
    processedEnrollmentId === nowServingEnrollment?.id
  const confirmDisabled =
    paymentMutation.isPending ||
    nowServingEnrollment === undefined ||
    isCurrentEnrollmentProcessed ||
    (confirming && isPartialPayment && !promissoryNoteOnFile)

  const callNext = () => {
    const next = waiting[0]
    if (!next) return
    ticketMutation.mutate({ id: next.id, action: "serve" })
    playQueueAlert(next.ticket_number)
  }

  const skipCurrent = () => {
    if (!nowServing) return
    ticketMutation.mutate({ id: nowServing.id, action: "skip" })
  }

  const markPriority = (ticket: QueueTicket) => {
    ticketMutation.mutate({ id: ticket.id, action: "mark_priority" })
  }

  const openConfirm = () => {
    if (confirmDisabled) return
    setAmountOverride(null)
    setPromissoryNoteOnFile(false)
    setError("")
    setStepError("")
    setStep("classification")
  }

  // Regular payee goes straight on to the payment modal; a scholar picks a tier
  // first. A payee choice also drops any scholarship the student had.
  const continueFromClassification = async (choice: PaymentClassification) => {
    if (!nowServingEnrollment) return
    setStepError("")
    if (choice === "scholar") {
      setStep("scholarship")
      return
    }
    if (discountItem !== null || currentClassification === "scholar") {
      try {
        await removeScholarship.mutateAsync({ id: nowServingEnrollment.id })
      } catch (removeError) {
        setStepError(
          apiMessage(
            removeError,
            "The classification could not be saved. Check the connection and try again.",
          ),
        )
        return
      }
    }
    setAmountOverride(null)
    setStep("payment")
  }

  // `mutateAsync` resolves after the enrollment list has been refetched, so the
  // payment modal that opens next already reads the discounted assessment.
  const applyTier = async (percentage: ScholarshipPercentage) => {
    if (!nowServingEnrollment) return
    setStepError("")
    try {
      await applyScholarship.mutateAsync({
        id: nowServingEnrollment.id,
        percentage,
      })
    } catch (applyError) {
      setStepError(
        apiMessage(
          applyError,
          "The scholarship could not be applied. Check the connection and try again.",
        ),
      )
      return
    }
    setAmountOverride(null)
    setStep("payment")
  }

  const confirmPayment = async () => {
    if (!nowServing || confirmDisabled || amountBelowMinimum) return
    setError("")
    try {
      const result = await paymentMutation.mutateAsync({
        id: nowServing.enrollment_id,
        amount: fixedAmount || !amount.trim() ? undefined : Number(amount),
        promissoryNoteOnFile,
      })
      setLastConfirmation(result)
      setProcessedEnrollmentId(result.enrollment.id)
      setStep("closed")
      setAmountOverride(null)
      if (nowServingEnrollment?.student_id) {
        void accountQuery.refetch()
      }
      try {
        await ticketMutation.mutateAsync({ id: nowServing.id, action: "complete" })
      } catch {
        // Ticket completion failure shouldn't mask successful payment
      }
    } catch {
      setError(
        "The payment could not be confirmed. Check the connection and try again.",
      )
    }
  }

  const serveSelectedStudent = () => {
    const candidate = candidateQuery.data
    if (!candidate || !candidate.ticket || nowServing) return

    ticketMutation.mutate({ id: candidate.ticket.id, action: "serve" })
    playQueueAlert(candidate.ticket.ticket_number)
  }

  const issueTicketForCandidate = async () => {
    const candidate = candidateQuery.data
    if (!candidate) return
    setError("")
    try {
      await claimMutation.mutateAsync(candidate.student_number)
    } catch {
      setError(
        "The queue ticket could not be issued. Check the connection and try again.",
      )
    }
  }

  const confirmCutOff = async () => {
    setError("")
    try {
      await cutOffMutation.mutateAsync()
      setCuttingOff(false)
    } catch {
      setError(
        "The queue could not be cut off. Check the connection and try again.",
      )
    }
  }

  const resumeQueue = async () => {
    setError("")
    try {
      await resumeMutation.mutateAsync()
    } catch {
      setError(
        "The queue could not be resumed. Check the connection and try again.",
      )
    }
  }

  return (
    <WorkspacePage
      title="Payment queue"
      description="Call the next student, confirm their payment, and generate the COR."
      unauthorized={!authorized}
      lastUpdated={Math.max(
        ticketsQuery.dataUpdatedAt,
        pendingPaymentQuery.dataUpdatedAt,
        accountQuery.dataUpdatedAt,
        cycleQuery.dataUpdatedAt,
      )}
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {lastConfirmation && (
        <Alert>
          <AlertDescription className="grid gap-3">
            <p>
              Payment confirmed for enrollment #{lastConfirmation.enrollment.id}
              . Certificate of Registration{" "}
              {lastConfirmation.document.document_number ?? "pending"} is ready.
            </p>
            {lastConfirmation.document.document_number && (
              <div className="grid gap-1 rounded-lg border bg-card p-4">
                <p className="font-medium">
                  Certificate of Registration
                </p>
                <p className="font-mono text-sm text-muted-foreground">
                  {lastConfirmation.document.document_number}
                </p>
                <p className="text-sm text-muted-foreground">
                  {lastConfirmation.enrollment.student_number}
                  {lastConfirmation.enrollment.student_financial_status_label
                    ? ` · ${lastConfirmation.enrollment.student_financial_status_label}`
                    : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  Generated{" "}
                  {lastConfirmation.document.generated_at
                    ? new Date(
                        lastConfirmation.document.generated_at,
                      ).toLocaleString()
                    : "—"}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <DownloadPdfButton
                    documentId={lastConfirmation.document.id ?? 1}
                    documentNumber={lastConfirmation.document.document_number}
                    label="Print / download"
                  />
                  {lastConfirmation.document.id && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setViewingCorDocumentId(
                          lastConfirmation.document.id ?? null,
                        )
                      }
                    >
                      <Printer className="mr-1.5 size-4" />
                      View &amp; Print COR
                    </Button>
                  )}
                </div>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle level={2}>Find student</CardTitle>
          <CardDescription>
            Search a student number, student name, or email before serving an eligible payment ticket.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              setSubmittedStudentNumber(studentNumberInput.trim() || null)
            }}
          >
            <Field className="min-w-52 flex-1">
              <FieldLabel htmlFor="cashier-student-number">
                Student number, name, or email
              </FieldLabel>
              <Input
                id="cashier-student-number"
                aria-label="Find student number"
                value={studentNumberInput}
                onChange={(event) => setStudentNumberInput(event.target.value)}
                placeholder="e.g. 2024-06-01091, student name, or email"
              />
            </Field>
            <Button type="submit" disabled={!studentNumberInput.trim()}>
              Find student
            </Button>
          </form>
          {candidateQuery.isPending && (
            <p className="text-sm text-muted-foreground">
              Finding eligible payment ticket…
            </p>
          )}
          {candidateQuery.isError && submittedStudentNumber && (
            <p className="text-sm text-destructive">
              No eligible payment ticket was found for this student number, name, or email.
            </p>
          )}
          {candidateQuery.data && (
            <div className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="grid gap-1">
                <p className="font-medium">
                  {candidateQuery.data.student_name}
                </p>
                <p className="text-muted-foreground">
                  {candidateQuery.data.student_number} · {formatYearLevel(candidateQuery.data.year_level)}
                  {candidateQuery.data.ticket
                    ? ` · ${candidateQuery.data.ticket.ticket_number}`
                    : ""}
                </p>
              </div>
              {candidateQuery.data.ticket === null ? (
                <Button
                  type="button"
                  disabled={claimMutation.isPending}
                  onClick={() => void issueTicketForCandidate()}
                >
                  Issue queue ticket
                </Button>
              ) : candidateQuery.data.ticket.status === "serving" ? (
                <p className="font-medium">This student is now serving.</p>
              ) : nowServing ? (
                <p className="text-muted-foreground">
                  Skip the current ticket before serving this student.
                </p>
              ) : (
                <Button
                  type="button"
                  disabled={ticketMutation.isPending}
                  onClick={serveSelectedStudent}
                >
                  Serve selected student
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle level={2}>Queue status</CardTitle>
          <CardDescription>
            {cycleQuery.data == null
              ? "No queue is open yet."
              : cycleQuery.data.status === "cut_off"
                ? "The queue is cut off for today. Waiting tickets are saved and the queue resumes automatically on the next service day."
                : "The queue is open."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cycleQuery.data?.status === "cut_off" ? (
            <Button
              type="button"
              variant="outline"
              disabled={resumeMutation.isPending}
              onClick={() => void resumeQueue()}
            >
              Resume queue
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={cutOffMutation.isPending}
              onClick={() => setCuttingOff(true)}
            >
              Cut off for today
            </Button>
          )}
        </CardContent>
      </Card>
      <AsyncBoundary
        query={{
          isPending: ticketsQuery.isPending || pendingPaymentQuery.isPending,
          isError: ticketsQuery.isError || pendingPaymentQuery.isError,
          error: ticketsQuery.error ?? pendingPaymentQuery.error,
          data: tickets,
          refetch: () => {
            void ticketsQuery.refetch()
            void pendingPaymentQuery.refetch()
          },
        }}
        loadingLabel="Loading the payment queue…"
      >
        {() => (
          <>
            <Card className="portal-workspace-highlight">
              <CardHeader>
                <CardTitle level={2}>Now serving</CardTitle>
                <CardDescription>
                  {waiting.length} waiting · {servedToday.length} served today
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {nowServing ? (
                  <div className="grid gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-3xl font-bold">
                        {nowServing.ticket_number}
                      </span>
                      {nowServing.priority === "priority" && (
                        <Badge variant="outline">Priority</Badge>
                      )}
                    </div>
                    <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      {nowServing.student_number}
                      {nowServingEnrollment
                        ? ` · ${nowServingEnrollment.total_units} units`
                        : ""}
                      {nowServingEnrollment?.student_financial_status_label && (
                        <Badge variant="secondary">
                          {nowServingEnrollment.student_financial_status_label}
                        </Badge>
                      )}
                    </p>
                    <p className="text-sm font-medium">
                      Amount due{" "}
                      {nowServingEnrollment?.assessment?.total_amount
                        ? `₱${nowServingEnrollment.assessment.total_amount}`
                        : "—"}
                    </p>
                    {nowServingEnrollment?.assessment?.items &&
                      nowServingEnrollment.assessment.items.length > 0 && (
                        <div className="grid gap-1.5 rounded-lg border bg-muted/20 p-3 text-xs">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Assessment Particulars
                          </p>
                          {nowServingEnrollment.assessment.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between"
                            >
                              <span>{item.label}</span>
                              <span className="font-medium">
                                {item.category === "scholarship_discount"
                                  ? `-${formatPhp(item.amount ?? "0.00")}`
                                  : formatPhp(item.amount ?? "0.00")}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    {accountQuery.isPending && (
                      <p className="text-sm text-muted-foreground">
                        Loading student account…
                      </p>
                    )}
                    {accountQuery.isError && (
                      <p className="text-sm text-destructive">
                        Student account details are unavailable right now.
                      </p>
                    )}
                    {accountQuery.data && (
                      <dl className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-2">
                        <div className="grid gap-1">
                          <dt className="text-muted-foreground">Student</dt>
                          <dd className="font-medium">
                            {accountQuery.data.student_name}
                          </dd>
                        </div>
                        <div className="grid gap-1">
                          <dt className="text-muted-foreground">
                            Student details
                          </dt>
                          <dd>
                            {accountQuery.data.student_number} · {formatYearLevel(accountQuery.data.year_level)}
                          </dd>
                        </div>
                        <div className="grid gap-1">
                          <dt className="text-muted-foreground">
                            Prior balance
                          </dt>
                          <dd className="font-medium">
                            {formatPhp(accountQuery.data.prior_balance)}
                          </dd>
                        </div>
                        <div className="grid gap-1">
                          <dt className="text-muted-foreground">
                            Total outstanding
                          </dt>
                          <dd className={`font-semibold ${accountQuery.data.outstanding_balance !== "0.00" ? "text-destructive" : "text-emerald-600"}`}>
                            {formatPhp(accountQuery.data.outstanding_balance)}
                          </dd>
                        </div>
                        <div className="grid gap-1">
                          <dt className="text-muted-foreground">
                            Advance credit
                          </dt>
                          <dd className={`font-semibold ${accountQuery.data.advance_payment_balance !== "0.00" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                            {formatPhp(accountQuery.data.advance_payment_balance)}
                          </dd>
                        </div>
                        {accountQuery.data.has_promissory_note_on_file && (
                          <div className="sm:col-span-2">
                            <Badge variant="outline" className="border-amber-600/40 text-amber-800 bg-amber-50 dark:bg-amber-950/20">
                              Promissory note on file
                            </Badge>
                          </div>
                        )}
                      </dl>
                    )}
                    {accountQuery.data?.transactions && accountQuery.data.transactions.length > 0 && (
                      <details className="group rounded-lg border bg-muted/20 p-2.5 transition-colors">
                        <summary className="flex cursor-pointer select-none items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                          <span className="flex items-center gap-2">
                            <span>Payment History with Cashier</span>
                            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                              {accountQuery.data.transactions.length} record{accountQuery.data.transactions.length === 1 ? "" : "s"}
                            </Badge>
                          </span>
                          <span className="text-[11px] font-normal text-muted-foreground group-open:hidden">
                            Click to view past payments
                          </span>
                        </summary>
                        <div className="overflow-x-auto rounded-md border bg-card mt-2.5">
                          <table className="w-full text-left text-xs" aria-label="Student payment history">
                            <thead className="bg-muted/50 text-muted-foreground">
                              <tr>
                                <th className="p-2">Date & Time</th>
                                <th className="p-2">Type</th>
                                <th className="p-2">Ref / OR</th>
                                <th className="p-2">Cashier</th>
                                <th className="p-2 text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {accountQuery.data.transactions.map((tx) => (
                                <tr key={tx.id} className="hover:bg-muted/30">
                                  <td className="p-2 text-muted-foreground">
                                    {new Date(tx.processed_at).toLocaleString()}
                                  </td>
                                  <td className="p-2 font-medium">
                                    {tx.transaction_type_label}
                                    {tx.promissory_note_on_file && (
                                      <Badge variant="secondary" className="ml-1 text-[9px] py-0">
                                        Promissory
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="p-2 font-mono">
                                    {tx.reference_number}
                                  </td>
                                  <td className="p-2 text-muted-foreground">
                                    {tx.cashier_name}
                                  </td>
                                  <td className="p-2 text-right font-semibold">
                                    {formatPhp(tx.amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={confirmDisabled}
                        onClick={openConfirm}
                      >
                        {isCurrentEnrollmentProcessed
                          ? "Payment processed"
                          : "Confirm payment"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!nowServingEnrollment}
                        onClick={() =>
                          setPreviewingEnrollmentId(
                            nowServingEnrollment?.id ?? null,
                          )
                        }
                      >
                        Preview COR
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={ticketMutation.isPending}
                        onClick={() => {
                          // Tells the student's own device too: their polled
                          // queue view sees the counter go up and rings.
                          ticketMutation.mutate({
                            id: nowServing.id,
                            action: "announce",
                          })
                          playQueueAlert(nowServing.ticket_number)
                        }}
                      >
                        Announce ticket 📢
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={ticketMutation.isPending}
                        onClick={skipCurrent}
                      >
                        Skip
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    <p className="text-sm text-muted-foreground">
                      No one is currently being served.
                    </p>
                    <Button
                      type="button"
                      disabled={
                        ticketMutation.isPending || waiting.length === 0
                      }
                      onClick={callNext}
                      className="w-fit"
                    >
                      Call next →
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle level={2}>Waiting ({waiting.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  caption="Waiting"
                  rowKey={(ticket) => ticket.id}
                  rows={waiting}
                  columns={[
                    {
                      key: "ticket",
                      header: "Ticket",
                      render: (ticket) => (
                        <span className="flex items-center gap-2">
                          {ticket.ticket_number}
                          {ticket.priority === "priority" && (
                            <Badge variant="outline">Priority</Badge>
                          )}
                        </span>
                      ),
                    },
                    {
                      key: "student",
                      header: "Student",
                      render: (ticket) => {
                        const financialStatusLabel =
                          enrollmentFor(ticket)?.student_financial_status_label
                        return (
                          <span className="flex items-center gap-2">
                            {ticket.student_number}
                            {financialStatusLabel && (
                              <Badge variant="secondary">
                                {financialStatusLabel}
                              </Badge>
                            )}
                          </span>
                        )
                      },
                    },
                    {
                      key: "amount",
                      header: "Amount due",
                      render: (ticket) =>
                        formatAmountDue(enrollmentFor(ticket)),
                    },
                    {
                      key: "actions",
                      header: "Actions",
                      render: (ticket) =>
                        ticket.priority === "regular" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={ticketMutation.isPending}
                            onClick={() => markPriority(ticket)}
                          >
                            Mark priority
                          </Button>
                        ) : null,
                    },
                  ]}
                  renderCard={(ticket) => (
                    <WaitingTicketCard
                      ticket={ticket}
                      enrollment={enrollmentFor(ticket)}
                      pending={ticketMutation.isPending}
                      onMarkPriority={markPriority}
                    />
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle level={2}>
                  Served today ({servedToday.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  caption="Served today"
                  rowKey={(ticket) => ticket.id}
                  rows={servedToday}
                  columns={[
                    {
                      key: "ticket",
                      header: "Ticket",
                      render: (ticket) => ticket.ticket_number,
                    },
                    {
                      key: "student",
                      header: "Student",
                      render: (ticket) => ticket.student_number,
                    },
                    {
                      key: "served_at",
                      header: "Served at",
                      render: (ticket) =>
                        ticket.served_at
                          ? new Date(ticket.served_at).toLocaleTimeString()
                          : "—",
                    },
                  ]}
                  renderCard={(ticket) => <ServedTicketCard ticket={ticket} />}
                />
              </CardContent>
            </Card>
          </>
        )}
      </AsyncBoundary>
      <AlertDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!open && !paymentMutation.isPending) setStep("closed")
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm received payment</AlertDialogTitle>
            <AlertDialogDescription>
              This is a manual payment — no external reference is collected.
              Confirming generates the Certificate of Registration and is recorded in the
              operational audit log. Confirming twice has no additional effect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FieldGroup>
            <Field data-invalid={amountBelowMinimum}>
              <FieldLabel htmlFor="payment-amount">Amount</FieldLabel>
              <Input
                id="payment-amount"
                inputMode="decimal"
                value={amount}
                readOnly={fixedAmount}
                aria-invalid={amountBelowMinimum}
                onChange={(event) => setAmountOverride(event.target.value)}
                disabled={paymentMutation.isPending}
              />
              {fixedAmount ? (
                <FieldDescription>
                  {netTotal === 0
                    ? "No payment is due: the scholarship covers the whole assessment. Confirming still generates the Certificate of Registration."
                    : "The assessment is below the ₱1,000.00 first-payment minimum, so it is collected in full."}
                </FieldDescription>
              ) : (
                <FieldDescription>
                  The first enrollment payment must be at least ₱1,000.00.
                </FieldDescription>
              )}
              {amountBelowMinimum && (
                <FieldError>
                  The first enrollment payment must be at least ₱1,000.00.
                </FieldError>
              )}
            </Field>
            {nowServingEnrollment?.assessment?.total_amount && (
              <div className="grid gap-1.5 rounded-lg border bg-muted/20 p-3 text-xs">
                {discountItem !== null && discountAmount > 0 && (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Assessment before scholarship:</span>
                      <span className="font-semibold text-foreground">
                        {formatPhp(baseAmount.toFixed(2))}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                      <span>{discountItem.label}:</span>
                      <span className="font-semibold">
                        -{formatPhp(discountAmount.toFixed(2))}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Current Term Assessment:</span>
                  <span className="font-semibold text-foreground">
                    {formatPhp(nowServingEnrollment.assessment.total_amount)}
                  </span>
                </div>
                {accountQuery.data && Number(accountQuery.data.prior_balance) > 0 && (
                  <div className="flex justify-between text-amber-700 dark:text-amber-400">
                    <span>Unpaid Prior Balance:</span>
                    <span className="font-semibold">
                      {formatPhp(accountQuery.data.prior_balance)}
                    </span>
                  </div>
                )}
                {accountQuery.data && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total Account Outstanding:</span>
                    <span className="font-semibold text-foreground">
                      {formatPhp(accountQuery.data.outstanding_balance)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Payment Entered (This Term):</span>
                  <span className="font-semibold text-primary">
                    {formatPhp(String((Number(amount) || 0).toFixed(2)))}
                  </span>
                </div>
                {(() => {
                  const assessed = Number(nowServingEnrollment.assessment.total_amount)
                  const entered = Number(amount) || 0
                  const remaining = Math.max(0, assessed - entered)
                  const isPartial = entered > 0 && entered < assessed
                  const priorBalance = accountQuery.data ? Number(accountQuery.data.prior_balance) : 0
                  const overallOutstanding = accountQuery.data ? Number(accountQuery.data.outstanding_balance) : assessed
                  const remainingOverall = Math.max(0, overallOutstanding - entered)
                  return (
                    <>
                      <div className="flex justify-between border-t pt-1.5 font-medium">
                        <span className={isPartial ? "text-destructive font-semibold" : "text-muted-foreground"}>
                          Remaining Term Balance:
                        </span>
                        <span className={isPartial ? "font-bold text-destructive" : "font-bold text-emerald-600"}>
                          {formatPhp(String(remaining.toFixed(2)))}
                        </span>
                      </div>
                      {priorBalance > 0 && (
                        <div className="flex justify-between font-medium">
                          <span className="text-amber-800 dark:text-amber-300">
                            Remaining Overall Balance:
                          </span>
                          <span className="font-bold text-amber-800 dark:text-amber-300">
                            {formatPhp(String(remainingOverall.toFixed(2)))}
                          </span>
                        </div>
                      )}
                      {isPartial && (
                        <p className="text-[11px] text-amber-800 font-medium pt-1">
                          * Note: Partial payment detected. Ensure a promissory note is on file for the remaining balance.
                        </p>
                      )}
                      {priorBalance > 0 && (
                        <p className="text-[11px] text-amber-800 font-medium pt-1">
                          * Note: Student has {formatPhp(String(priorBalance.toFixed(2)))} in unpaid balance from prior terms. This payment clears the current term assessment ({formatPhp(nowServingEnrollment.assessment.total_amount)}). Prior balances must be settled separately via &quot;Record Payment&quot; in the Student Account section.
                        </p>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
            <Field data-invalid={isPartialPayment && !promissoryNoteOnFile}>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="promissory-note-on-file"
                  checked={promissoryNoteOnFile}
                  onCheckedChange={(checked) =>
                    setPromissoryNoteOnFile(checked === true)
                  }
                  disabled={paymentMutation.isPending}
                />
                <FieldLabel htmlFor="promissory-note-on-file">
                  Promissory note on file
                </FieldLabel>
              </div>
              {isPartialPayment && !promissoryNoteOnFile && (
                <FieldError className="mt-1">
                  A promissory note on file is required for partial payments.
                </FieldError>
              )}
            </Field>
          </FieldGroup>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={paymentMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              disabled={!nowServingEnrollment}
              onClick={() =>
                setPreviewingEnrollmentId(nowServingEnrollment?.id ?? null)
              }
            >
              Preview COR
            </Button>
            <Button
              type="button"
              disabled={confirmDisabled || amountBelowMinimum}
              onClick={() => void confirmPayment()}
            >
              {paymentMutation.isPending
                ? "Confirming payment"
                : isCurrentEnrollmentProcessed
                  ? "Payment processed"
                  : "Confirm payment"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {step === "classification" && nowServingEnrollment && (
        <PaymentClassificationDialog
          studentName={studentDisplayName}
          initial={currentClassification}
          busy={removeScholarship.isPending}
          error={stepError}
          onContinue={(choice) => void continueFromClassification(choice)}
          onCancel={() => setStep("closed")}
        />
      )}
      {step === "scholarship" && nowServingEnrollment && (
        <ScholarshipTierDialog
          studentName={studentDisplayName}
          baseAmount={baseAmount}
          initialPercentage={scholarshipTierOf(discountItem) ?? 100}
          busy={applyScholarship.isPending}
          error={stepError}
          onApply={(percentage) => void applyTier(percentage)}
          onBack={() => {
            setStepError("")
            setStep("classification")
          }}
        />
      )}
      <AlertDialog
        open={cuttingOff}
        onOpenChange={(open) => {
          if (!open && !cutOffMutation.isPending) setCuttingOff(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cut off the queue for today?</AlertDialogTitle>
            <AlertDialogDescription>
              {waiting.length > 0
                ? `${waiting.length} student${waiting.length === 1 ? "" : "s"} still waiting will keep their place and are carried forward automatically — they do not need a new ticket.`
                : "The queue will resume automatically on the next service day."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cutOffMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={cutOffMutation.isPending}
              onClick={() => void confirmCutOff()}
            >
              Confirm cut-off
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={viewingCorDocumentId !== null}
        onOpenChange={(open) => {
          if (!open) setViewingCorDocumentId(null)
        }}
      >
        <DialogContent className="max-h-[90dvh] sm:max-w-6xl print:max-h-none print:w-full print:max-w-none print:p-0 print:border-none print:shadow-none print:overflow-visible">
          <DialogHeader className="pr-8 print:hidden">
            <DialogTitle>Certificate of Registration</DialogTitle>
            <DialogDescription>
              Review or print the official Certificate of Registration.
            </DialogDescription>
          </DialogHeader>
          <AsyncBoundary
            query={{ ...corQuery, data: corQuery.data }}
            isEmpty={(cor) => cor.snapshot === null}
            emptyMessage="This COR is being loaded. Please try again shortly."
            loadingLabel="Loading official COR…"
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
                        label="Download PDF"
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
        </DialogContent>
      </Dialog>

      <Dialog
        open={previewingEnrollmentId !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewingEnrollmentId(null)
        }}
      >
        <DialogContent className="max-h-[90dvh] sm:max-w-6xl print:max-h-none print:w-full print:max-w-none print:p-0 print:border-none print:shadow-none print:overflow-visible">
          <DialogHeader className="pr-8 print:hidden">
            <DialogTitle>Certificate of Registration Preview</DialogTitle>
            <DialogDescription>
              Preview official COR before confirming payment.
            </DialogDescription>
          </DialogHeader>
          <AsyncBoundary
            query={{ ...corPreviewQuery, data: corPreviewQuery.data }}
            isEmpty={(preview) => !preview?.snapshot}
            emptyMessage="COR preview could not be loaded."
            loadingLabel="Loading COR preview…"
          >
            {(preview) => (
              <CertificateOfRegistrationDocument
                cor={{
                  type: "certificate_of_registration",
                  id: 0,
                  enrollment_id: previewingEnrollmentId!,
                  document_number: "PREVIEW",
                  generated_at: new Date().toISOString(),
                  content_hash: null,
                  snapshot: preview.snapshot,
                }}
                watermark={
                  preview.watermark ??
                  "Preview — official COR is issued after payment confirmation"
                }
              />
            )}
          </AsyncBoundary>
        </DialogContent>
      </Dialog>
    </WorkspacePage>
  )
}
