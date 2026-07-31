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
import type { PaymentConfirmation } from "@/features/schemas/enrollment-schema"
import type { QueueTicket } from "@/features/schemas/queue-ticket-schema"

const workspaceHeadings: Record<string, string> = {
  "payment-queue": "Payment queue",
  "serving-number": "Serving number",
  "payment-confirmation": "Payment confirmation",
  "com-finalization": "COM finalization",
}

function ticketBadgeVariant(
  status: QueueTicket["status"],
): "default" | "secondary" | "outline" {
  if (status === "serving") return "default"
  if (status === "served") return "secondary"
  return "outline"
}

export function AccountingPaymentWorkspace({
  initialModuleId = "payment-queue",
}: {
  initialModuleId?: string
}) {
  const { session } = useAuth()
  const authorized = session?.role === "accounting_staff"
  const [confirming, setConfirming] = useState<number | null>(null)
  const [externalReference, setExternalReference] = useState("")
  const [amount, setAmount] = useState("")
  const [lastConfirmation, setLastConfirmation] =
    useState<PaymentConfirmation | null>(null)
  const [error, setError] = useState("")
  const heading =
    workspaceHeadings[initialModuleId] ?? workspaceHeadings["payment-queue"]

  const ticketsQuery = useQueueTicketsQuery(
    { page: 1, per_page: 20 },
    { enabled: authorized },
  )
  const ticketMutation = useUpdateQueueTicketMutation()
  const pendingPaymentQuery = useEnrollmentsListQuery(
    { status: "pending_payment", page: 1, per_page: 20 },
    { enabled: authorized },
  )
  const paymentMutation = useConfirmPaymentMutation()

  const confirmPayment = async () => {
    if (confirming === null) return
    setError("")
    try {
      const result = await paymentMutation.mutateAsync({
        id: confirming,
        externalReference: externalReference.trim() || undefined,
        amount: amount.trim() ? Number(amount) : undefined,
      })
      setLastConfirmation(result)
      setConfirming(null)
      setExternalReference("")
      setAmount("")
    } catch {
      setError(
        "The payment could not be confirmed. Check the connection and try again.",
      )
    }
  }

  return (
    <WorkspacePage
      title={heading}
      description="Advance the payment queue, confirm received payments, and finalize the Digital Certificate of Matriculation."
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
          <AlertDescription>
            Payment confirmed for enrollment #{lastConfirmation.enrollment.id}.
            Digital COM {lastConfirmation.document.document_number ?? "pending"}{" "}
            is ready.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle level={2}>Payment queue</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncBoundary
            query={{ ...ticketsQuery, data: ticketsQuery.data?.data }}
            isEmpty={(rows) => rows.length === 0}
            emptyMessage="No queue tickets are currently active."
            loadingLabel="Loading the payment queue…"
          >
            {(tickets) => (
              <DataTable
                caption="Payment queue"
                rowKey={(ticket) => ticket.id}
                rows={tickets}
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
                    key: "status",
                    header: "Status",
                    render: (ticket) => (
                      <Badge variant={ticketBadgeVariant(ticket.status)}>
                        {ticket.status_label}
                      </Badge>
                    ),
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    render: (ticket) => (
                      <>
                        {ticket.status === "waiting" && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={ticketMutation.isPending}
                            onClick={() =>
                              ticketMutation.mutate({
                                id: ticket.id,
                                action: "serve",
                              })
                            }
                          >
                            Call to serve
                          </Button>
                        )}
                        {ticket.status === "serving" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={ticketMutation.isPending}
                            onClick={() =>
                              ticketMutation.mutate({
                                id: ticket.id,
                                action: "complete",
                              })
                            }
                          >
                            Mark served
                          </Button>
                        )}
                        {ticket.status === "served" && (
                          <span className="text-sm text-muted-foreground">
                            Complete
                          </span>
                        )}
                      </>
                    ),
                  },
                ]}
              />
            )}
          </AsyncBoundary>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle level={2}>Pending payment confirmations</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncBoundary
            query={{
              ...pendingPaymentQuery,
              data: pendingPaymentQuery.data?.data,
            }}
            isEmpty={(rows) => rows.length === 0}
            emptyMessage="No enrollments are awaiting payment confirmation."
            loadingLabel="Loading pending payment confirmations…"
          >
            {(enrollments) => (
              <DataTable
                caption="Pending payment confirmations"
                rowKey={(enrollment) => enrollment.id}
                rows={enrollments}
                columns={[
                  {
                    key: "student",
                    header: "Student",
                    render: (enrollment) => enrollment.student_number,
                  },
                  {
                    key: "enrollment",
                    header: "Enrollment",
                    render: (enrollment) => `#${enrollment.id}`,
                  },
                  {
                    key: "units",
                    header: "Units",
                    render: (enrollment) => enrollment.total_units,
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    render: (enrollment) => (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setConfirming(enrollment.id)
                          setExternalReference("")
                          setAmount("")
                          setError("")
                        }}
                      >
                        Confirm payment
                      </Button>
                    ),
                  },
                ]}
              />
            )}
          </AsyncBoundary>
        </CardContent>
      </Card>
      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open && !paymentMutation.isPending) setConfirming(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm received payment</AlertDialogTitle>
            <AlertDialogDescription>
              This generates the Digital COM and is recorded in the operational
              audit log. Confirming twice has no additional effect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="external-reference">
                External reference (optional)
              </FieldLabel>
              <Input
                id="external-reference"
                value={externalReference}
                onChange={(event) => setExternalReference(event.target.value)}
                disabled={paymentMutation.isPending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="payment-amount">
                Amount (optional)
              </FieldLabel>
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
