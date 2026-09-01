"use client"

import { useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { DataTable } from "@/features/components/portal/data-table"
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
import { Field, FieldGroup, FieldLabel } from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
import { Checkbox } from "@/features/components/ui/checkbox"
import {
  useAdjustEnrollmentAssessmentMutation,
  useConfirmPaymentMutation,
  useEnrollmentsListQuery,
} from "@/features/hooks/use-enrollment"
import {
  useRecordStudentAccountPaymentMutation,
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
import { useCashierPaymentCandidateQuery } from "@/features/hooks/use-cashier-transactions"
import type {
  Enrollment,
  PaymentConfirmation,
} from "@/features/schemas/enrollment-schema"
import type { QueueTicket } from "@/features/schemas/queue-ticket-schema"

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

function formatPhp(amount: string): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(amount))
}

type FeeAdjustmentItem = {
  id: number
  label: string
  category: "tuition" | "miscellaneous"
  quantity: string | null
  amount: string | null
  unit_amount: string | null
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
  const [confirming, setConfirming] = useState(false)
  const [amount, setAmount] = useState("")
  const [promissoryNoteOnFile, setPromissoryNoteOnFile] = useState(false)
  const [adjustingAssessment, setAdjustingAssessment] = useState(false)
  const [adjustmentReason, setAdjustmentReason] = useState("")
  const [adjustmentItems, setAdjustmentItems] = useState<FeeAdjustmentItem[]>(
    [],
  )
  const [recordingBalance, setRecordingBalance] = useState(false)
  const [balancePaymentAmount, setBalancePaymentAmount] = useState("")
  const [lastConfirmation, setLastConfirmation] =
    useState<PaymentConfirmation | null>(null)
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
  const assessmentMutation = useAdjustEnrollmentAssessmentMutation()
  const accountPaymentMutation = useRecordStudentAccountPaymentMutation()
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
  const servedToday = tickets.filter((ticket) => ticket.status === "served")
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
  const isCurrentEnrollmentProcessed =
    processedEnrollmentId === nowServingEnrollment?.id
  const confirmDisabled =
    paymentMutation.isPending ||
    nowServingEnrollment === undefined ||
    isCurrentEnrollmentProcessed

  const callNext = () => {
    const next = waiting[0]
    if (!next) return
    ticketMutation.mutate({ id: next.id, action: "serve" })
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
    setAmount(nowServingEnrollment?.assessment?.total_amount ?? "")
    setPromissoryNoteOnFile(false)
    setError("")
    setConfirming(true)
  }

  const openAssessmentAdjustment = () => {
    const assessment = nowServingEnrollment?.assessment
    if (!assessment) return

    const editableItems = assessment.items.flatMap((item) =>
      item.id === undefined
        ? []
        : [
            {
              id: item.id,
              label: item.label,
              category: item.category,
              quantity: item.quantity,
              amount: item.amount,
              unit_amount: item.unit_amount,
            },
          ],
    )

    if (editableItems.length !== assessment.items.length) {
      setError("This assessment cannot be adjusted because one or more fee lines are incomplete.")
      return
    }

    setAdjustmentItems(editableItems)
    setAdjustmentReason("")
    setError("")
    setAdjustingAssessment(true)
  }

  const updateAssessmentItem = (
    id: number,
    field: "amount" | "unit_amount",
    value: string,
  ) => {
    setAdjustmentItems((items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    )
  }

  const saveAssessmentAdjustment = async () => {
    if (!nowServingEnrollment) return
    setError("")
    try {
      const result = await assessmentMutation.mutateAsync({
        id: nowServingEnrollment.id,
        reason: adjustmentReason.trim(),
        items: adjustmentItems.map((item) =>
          item.category === "tuition"
            ? { id: item.id, unit_amount: item.unit_amount ?? "" }
            : { id: item.id, amount: item.amount ?? "" },
        ),
      })
      setAmount(result.assessment?.total_amount ?? "")
      setAdjustingAssessment(false)
    } catch {
      setError(
        "The fee assessment could not be adjusted. Check every amount and try again.",
      )
    }
  }

  const confirmPayment = async () => {
    if (!nowServing || confirmDisabled) return
    setError("")
    try {
      const result = await paymentMutation.mutateAsync({
        id: nowServing.enrollment_id,
        amount: amount.trim() ? Number(amount) : undefined,
        promissoryNoteOnFile,
      })
      setLastConfirmation(result)
      setProcessedEnrollmentId(result.enrollment.id)
      setConfirming(false)
      setAmount("")
      void accountQuery.refetch()
    } catch {
      setError(
        "The payment could not be confirmed. Check the connection and try again.",
      )
    }
  }

  const openBalancePayment = () => {
    setBalancePaymentAmount("")
    setError("")
    setRecordingBalance(true)
  }

  const recordBalancePayment = async () => {
    if (!nowServingEnrollment) return
    setError("")
    try {
      await accountPaymentMutation.mutateAsync({
        studentId: nowServingEnrollment.student_id,
        amount: Number(balancePaymentAmount),
      })
      setRecordingBalance(false)
      setBalancePaymentAmount("")
    } catch {
      setError(
        "The balance payment could not be recorded. Check the amount and try again.",
      )
    }
  }

  const serveSelectedStudent = () => {
    const candidate = candidateQuery.data
    if (!candidate || !candidate.ticket || nowServing) return

    ticketMutation.mutate({ id: candidate.ticket.id, action: "serve" })
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
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle level={2}>Find student</CardTitle>
          <CardDescription>
            Search a student number before serving an eligible payment ticket.
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
                Find student number
              </FieldLabel>
              <Input
                id="cashier-student-number"
                value={studentNumberInput}
                onChange={(event) => setStudentNumberInput(event.target.value)}
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
              No eligible payment ticket was found for this student number.
            </p>
          )}
          {candidateQuery.data && (
            <div className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="grid gap-1">
                <p className="font-medium">
                  {candidateQuery.data.student_name}
                </p>
                <p className="text-muted-foreground">
                  {candidateQuery.data.student_number} · Year{" "}
                  {candidateQuery.data.year_level}
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
                            {accountQuery.data.student_number} · Year{" "}
                            {accountQuery.data.year_level}
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
                          <dd className="font-medium">
                            {formatPhp(accountQuery.data.outstanding_balance)}
                          </dd>
                        </div>
                        {accountQuery.data.has_promissory_note_on_file && (
                          <div className="sm:col-span-2">
                            <Badge variant="outline">
                              Promissory note on file
                            </Badge>
                          </div>
                        )}
                      </dl>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          assessmentMutation.isPending ||
                          !nowServingEnrollment?.assessment ||
                          isCurrentEnrollmentProcessed
                        }
                        onClick={openAssessmentAdjustment}
                      >
                        Adjust fees
                      </Button>
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
                        disabled={
                          accountPaymentMutation.isPending ||
                          accountQuery.data === undefined ||
                          accountQuery.data.outstanding_balance === "0.00"
                        }
                        onClick={openBalancePayment}
                      >
                        Record balance payment
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={ticketMutation.isPending}
                        onClick={skipCurrent}
                      >
                        Skip
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={
                          ticketMutation.isPending || waiting.length === 0
                        }
                        onClick={callNext}
                      >
                        Call next →
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
        open={adjustingAssessment}
        onOpenChange={(open) => {
          if (!open && !assessmentMutation.isPending)
            setAdjustingAssessment(false)
        }}
      >
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Adjust fee assessment</AlertDialogTitle>
            <AlertDialogDescription>
              Update this student&apos;s tuition rate or other fee amounts before
              payment. A reason is required and the issued COR cannot be
              changed after payment confirmation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FieldGroup>
            {adjustmentItems.map((item) => {
              const tuitionAmount =
                item.category === "tuition" &&
                item.quantity !== null &&
                item.unit_amount !== null
                  ? (Number(item.quantity) * Number(item.unit_amount)).toFixed(2)
                  : null

              return (
                <Field key={item.id}>
                  <FieldLabel htmlFor={`assessment-item-${item.id}`}>
                    {item.category === "tuition"
                      ? `${item.label} rate per unit`
                      : item.label}
                  </FieldLabel>
                  <Input
                    id={`assessment-item-${item.id}`}
                    inputMode="decimal"
                    value={
                      item.category === "tuition"
                        ? (item.unit_amount ?? "")
                        : (item.amount ?? "")
                    }
                    onChange={(event) =>
                      updateAssessmentItem(
                        item.id,
                        item.category === "tuition" ? "unit_amount" : "amount",
                        event.target.value,
                      )
                    }
                    disabled={assessmentMutation.isPending}
                  />
                  {tuitionAmount && (
                    <p className="text-sm text-muted-foreground">
                      {item.quantity} units × rate = {formatPhp(tuitionAmount)}
                    </p>
                  )}
                </Field>
              )
            })}
            <Field>
              <FieldLabel htmlFor="assessment-adjustment-reason">
                Adjustment reason
              </FieldLabel>
              <Input
                id="assessment-adjustment-reason"
                value={adjustmentReason}
                onChange={(event) => setAdjustmentReason(event.target.value)}
                disabled={assessmentMutation.isPending}
              />
            </Field>
          </FieldGroup>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={assessmentMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={
                assessmentMutation.isPending || adjustmentReason.trim().length < 3
              }
              onClick={() => void saveAssessmentAdjustment()}
            >
              {assessmentMutation.isPending ? "Saving fees" : "Save adjusted fees"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!open && !paymentMutation.isPending) setConfirming(false)
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
            <Field>
              <FieldLabel htmlFor="payment-amount">Amount</FieldLabel>
              <Input
                id="payment-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={paymentMutation.isPending}
              />
            </Field>
            <Field>
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
            </Field>
          </FieldGroup>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={paymentMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={confirmDisabled}
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
      <AlertDialog
        open={recordingBalance}
        onOpenChange={(open) => {
          if (!open && !accountPaymentMutation.isPending)
            setRecordingBalance(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Record balance payment</AlertDialogTitle>
            <AlertDialogDescription>
              This is applied to the oldest outstanding enrollment and does not
              confirm the current enrollment or change the queue ticket.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="balance-payment-amount">
                Balance payment amount
              </FieldLabel>
              <Input
                id="balance-payment-amount"
                inputMode="decimal"
                value={balancePaymentAmount}
                onChange={(event) =>
                  setBalancePaymentAmount(event.target.value)
                }
                disabled={accountPaymentMutation.isPending}
              />
            </Field>
          </FieldGroup>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={accountPaymentMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={accountPaymentMutation.isPending}
              onClick={() => void recordBalancePayment()}
            >
              {accountPaymentMutation.isPending
                ? "Recording payment"
                : "Record payment"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    </WorkspacePage>
  )
}
