"use client"

import { useAuth } from "@/features/auth/use-auth"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Skeleton } from "@/features/components/ui/skeleton"
import { useEnrollmentsQuery } from "@/features/hooks/use-enrollment"

export function StudentQueuePaymentWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "student"
  const enrollmentsQuery = useEnrollmentsQuery({ enabled: authorized })

  if (!authorized) {
    return (
      <section aria-label="Payment queue status workspace">
        <p>This workspace is not available for your role.</p>
      </section>
    )
  }

  const activeEnrollment = (enrollmentsQuery.data ?? [])[0] ?? null

  return (
    <section aria-label="Payment queue status workspace" className="grid gap-4">
      <div>
        <h2>Queue & payment status</h2>
        <p>
          Track your enrollment's approval, queue position, and payment status.
        </p>
      </div>
      {enrollmentsQuery.isLoading ? (
        <Skeleton className="h-32" />
      ) : enrollmentsQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            Your enrollment status could not be loaded.{" "}
            <Button
              type="button"
              variant="outline"
              onClick={() => void enrollmentsQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : !activeEnrollment ? (
        <p>You have no enrollment submitted yet.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Enrollment #{activeEnrollment.id}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <p>Status: {activeEnrollment.status_label}</p>
            {activeEnrollment.queue_ticket ? (
              <>
                <p>
                  Queue ticket: {activeEnrollment.queue_ticket.ticket_number}
                </p>
                <p>
                  Queue status: {activeEnrollment.queue_ticket.status_label}
                </p>
              </>
            ) : (
              <p>No payment-queue ticket has been issued yet.</p>
            )}
            {activeEnrollment.payment_confirmed_at && (
              <p>
                Payment confirmed:{" "}
                {new Date(
                  activeEnrollment.payment_confirmed_at,
                ).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  )
}
