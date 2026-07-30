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

  if (!authorized) {
    return (
      <section aria-label="Accounting payment workspace">
        <p>This workspace is not available for your role.</p>
      </section>
    )
  }

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
    <section aria-label="Accounting payment workspace" className="grid gap-4">
      <div>
        <h2>{heading}</h2>
        <p>
          Advance the payment queue, confirm received payments, and finalize the
          Digital Certificate of Matriculation.
        </p>
      </div>
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
          <CardTitle>Payment queue</CardTitle>
        </CardHeader>
        <CardContent>
          {ticketsQuery.isLoading ? (
            <Skeleton className="h-32" />
          ) : ticketsQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                The payment queue could not be loaded.{" "}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void ticketsQuery.refetch()}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : (ticketsQuery.data?.data.length ?? 0) === 0 ? (
            <p>No queue tickets are currently active.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(ticketsQuery.data?.data ?? []).map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">
                      {ticket.ticket_number}
                    </TableCell>
                    <TableCell>{ticket.student_number}</TableCell>
                    <TableCell>
                      <Badge variant={ticketBadgeVariant(ticket.status)}>
                        {ticket.status_label}
                      </Badge>
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Pending payment confirmations</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingPaymentQuery.isLoading ? (
            <Skeleton className="h-32" />
          ) : pendingPaymentQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                Pending enrollments could not be loaded.{" "}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void pendingPaymentQuery.refetch()}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : (pendingPaymentQuery.data?.data.length ?? 0) === 0 ? (
            <p>No enrollments are awaiting payment confirmation.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Enrollment</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pendingPaymentQuery.data?.data ?? []).map((enrollment) => (
                  <TableRow key={enrollment.id}>
                    <TableCell>{enrollment.student_number}</TableCell>
                    <TableCell>#{enrollment.id}</TableCell>
                    <TableCell>{enrollment.total_units}</TableCell>
                    <TableCell>
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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
    </section>
  )
}
