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
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Skeleton } from "@/features/components/ui/skeleton"
import {
  useConfirmPaymentMutation,
  useEnrollmentsListQuery,
} from "@/features/hooks/use-enrollment"
import {
  useQueueTicketsQuery,
  useUpdateQueueTicketMutation,
} from "@/features/hooks/use-queue-tickets"
import type { PaymentConfirmation } from "@/features/schemas/enrollment-schema"

const workspaceHeadings: Record<string, string> = {
  "payment-queue": "Payment queue",
  "serving-number": "Serving number",
  "payment-confirmation": "Payment confirmation",
  "com-finalization": "COM finalization",
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
            <ul className="grid gap-3">
              {(ticketsQuery.data?.data ?? []).map((ticket) => (
                <li key={ticket.id} className="rounded-md border p-3">
                  <p>
                    {ticket.ticket_number} · Student {ticket.student_number} ·{" "}
                    {ticket.status_label}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ticket.status === "waiting" && (
                      <Button
                        type="button"
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
                  </div>
                </li>
              ))}
            </ul>
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
            <ul className="grid gap-3">
              {(pendingPaymentQuery.data?.data ?? []).map((enrollment) => (
                <li key={enrollment.id} className="rounded-md border p-3">
                  <p>
                    Student {enrollment.student_number} · Enrollment #
                    {enrollment.id} · {enrollment.total_units} units
                  </p>
                  <Button
                    type="button"
                    className="mt-2"
                    onClick={() => {
                      setConfirming(enrollment.id)
                      setExternalReference("")
                      setAmount("")
                      setError("")
                    }}
                  >
                    Confirm payment
                  </Button>
                </li>
              ))}
            </ul>
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
          <label className="grid gap-1" htmlFor="external-reference">
            External reference (optional)
            <input
              id="external-reference"
              value={externalReference}
              onChange={(event) => setExternalReference(event.target.value)}
              disabled={paymentMutation.isPending}
            />
          </label>
          <label className="grid gap-1" htmlFor="payment-amount">
            Amount (optional)
            <input
              id="payment-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={paymentMutation.isPending}
            />
          </label>
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
