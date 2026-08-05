"use client"

import { useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { DataTable } from "@/features/components/portal/data-table"
import { PrintButton, PrintDocument } from "@/features/components/portal/print-document"
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
import {
  useConfirmPaymentMutation,
  useEnrollmentsListQuery,
} from "@/features/hooks/use-enrollment"
import {
  useQueueTicketsQuery,
  useUpdateQueueTicketMutation,
} from "@/features/hooks/use-queue-tickets"
import type {
  Enrollment,
  PaymentConfirmation,
} from "@/features/schemas/enrollment-schema"
import type { QueueTicket } from "@/features/schemas/queue-ticket-schema"

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Priority tickets always precede regular ones; within a tier, ordered by
 * effective order — `requeued_at` if the ticket was ever skipped,
 * otherwise `created_at`. A skipped ticket's `requeued_at` is stamped at
 * the moment it was skipped, so it naturally sorts after every ticket that
 * already existed then, landing at the back of its own tier.
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
 * exactly (effective order, then the `requeued_at IS NOT NULL` regime
 * split, then `id`).
 */
function byQueueOrder(a: QueueTicket, b: QueueTicket): number {
  if (a.priority !== b.priority) return a.priority === "priority" ? -1 : 1
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
  const [lastConfirmation, setLastConfirmation] =
    useState<PaymentConfirmation | null>(null)
  const [error, setError] = useState("")

  const ticketsQuery = useQueueTicketsQuery(
    { queue_date: todayIsoDate(), page: 1, per_page: 100 },
    { enabled: authorized },
  )
  const ticketMutation = useUpdateQueueTicketMutation()
  const pendingPaymentQuery = useEnrollmentsListQuery(
    { status: "pending_payment", page: 1, per_page: 100 },
    { enabled: authorized },
  )
  const paymentMutation = useConfirmPaymentMutation()

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
    setAmount(nowServingEnrollment?.assessment?.total_amount ?? "")
    setError("")
    setConfirming(true)
  }

  const confirmPayment = async () => {
    if (!nowServing) return
    setError("")
    try {
      const result = await paymentMutation.mutateAsync({
        id: nowServing.enrollment_id,
        amount: amount.trim() ? Number(amount) : undefined,
      })
      setLastConfirmation(result)
      setConfirming(false)
      setAmount("")
    } catch {
      setError(
        "The payment could not be confirmed. Check the connection and try again.",
      )
    }
  }

  return (
    <WorkspacePage
      title="Payment queue"
      description="Call the next student, confirm their payment, and generate the Digital COM."
      unauthorized={!authorized}
      lastUpdated={Math.max(
        ticketsQuery.dataUpdatedAt,
        pendingPaymentQuery.dataUpdatedAt,
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
              Payment confirmed for enrollment #{lastConfirmation.enrollment.id}.
              Digital COM {lastConfirmation.document.document_number ?? "pending"}{" "}
              is ready.
            </p>
            {lastConfirmation.document.document_number && (
              <PrintDocument title="Digital Certificate of Matriculation" actions={<PrintButton />}>
                <div className="grid gap-1 rounded-lg border p-4">
                  <p className="font-medium">
                    Digital Certificate of Matriculation
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
              </PrintDocument>
            )}
          </AlertDescription>
        </Alert>
      )}
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
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={ticketMutation.isPending}
                        onClick={openConfirm}
                      >
                        Confirm payment
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
                        disabled={ticketMutation.isPending || waiting.length === 0}
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
                      disabled={ticketMutation.isPending || waiting.length === 0}
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
                        const financialStatusLabel = enrollmentFor(ticket)
                          ?.student_financial_status_label
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
                      render: (ticket) => formatAmountDue(enrollmentFor(ticket)),
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
                <CardTitle level={2}>Served today ({servedToday.length})</CardTitle>
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
          if (!open && !paymentMutation.isPending) setConfirming(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm received payment</AlertDialogTitle>
            <AlertDialogDescription>
              This is a manual payment — no external reference is collected.
              Confirming generates the Digital COM and is recorded in the
              operational audit log. Confirming twice has no additional
              effect.
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
          </FieldGroup>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={paymentMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={paymentMutation.isPending}
              onClick={() => void confirmPayment()}
            >
              {paymentMutation.isPending
                ? "Confirming payment"
                : "Confirm payment"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkspacePage>
  )
}
