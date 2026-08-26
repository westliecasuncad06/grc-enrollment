"use client"

import { useAuth } from "@/features/auth/use-auth"
import { StudentQueueLivePanel } from "@/features/components/queue/student-queue-live-panel"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { useStudentQueueQuery } from "@/features/hooks/use-student-queue"
import type { Enrollment } from "@/features/schemas/enrollment-schema"

/**
 * The Queue & Payment detail card, embedded directly in `EnrollmentWorkspace`
 * once a student has an active enrollment for the selected term — no longer
 * a standalone portal module (the top-level `StatusStepper` in
 * `EnrollmentWorkspace` already covers the stage progress this used to show
 * on its own; this card is just the queue ticket / payment-date detail).
 */
export function EnrollmentQueuePaymentPanel({
  enrollment,
}: {
  enrollment: Enrollment
}) {
  const { session } = useAuth()
  const queueQuery = useStudentQueueQuery({
    viewerId: session?.userId ?? null,
    enabled: session?.role === "student",
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle level={2} className="flex items-center gap-2">
          Enrollment #{enrollment.id}
          <Badge variant="secondary">{enrollment.status_label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {queueQuery.isPending && (
          <Alert>
            <AlertTitle>Loading queue status</AlertTitle>
            <AlertDescription>Loading your Cashier queue…</AlertDescription>
          </Alert>
        )}
        {queueQuery.isError && (
          <Alert variant="destructive">
            <AlertTitle>Queue status unavailable</AlertTitle>
            <AlertDescription>
              Your live Cashier queue could not be loaded. Try again to refresh
              it.
            </AlertDescription>
            <Button
              type="button"
              variant="outline"
              onClick={() => void queueQuery.refetch()}
            >
              Retry queue status
            </Button>
          </Alert>
        )}
        {queueQuery.data && (
          <StudentQueueLivePanel queue={queueQuery.data} mode="default" />
        )}
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">Payment confirmed</dt>
            <dd className="text-sm font-medium">
              {enrollment.payment_confirmed_at ? (
                new Date(enrollment.payment_confirmed_at).toLocaleString()
              ) : (
                <span className="font-normal text-muted-foreground">
                  Not yet
                </span>
              )}
            </dd>
          </div>
        </dl>
        {enrollment.assessment && (
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Amount due</p>
            <p className="text-lg font-semibold">
              ₱{enrollment.assessment.total_amount}
            </p>
            <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
              {enrollment.assessment.items.map((item, index) => (
                <li key={index} className="flex justify-between gap-4">
                  <span>{item.label}</span>
                  <span>₱{item.amount}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
