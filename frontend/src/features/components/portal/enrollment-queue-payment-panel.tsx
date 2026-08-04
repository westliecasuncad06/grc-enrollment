"use client"

import { Badge } from "@/features/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
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
  return (
    <Card>
      <CardHeader>
        <CardTitle level={2} className="flex items-center gap-2">
          Enrollment #{enrollment.id}
          <Badge variant="secondary">{enrollment.status_label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">Queue ticket</dt>
            <dd className="text-sm font-medium">
              {enrollment.queue_ticket ? (
                <>
                  {enrollment.queue_ticket.ticket_number}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {enrollment.queue_ticket.status_label}
                  </span>
                  {enrollment.queue_ticket.status === "waiting" &&
                    enrollment.queue_ticket.position !== null && (
                      <p className="mt-1 text-sm font-normal text-muted-foreground">
                        {enrollment.queue_ticket.position === 0
                          ? "You're next in line."
                          : `${enrollment.queue_ticket.position} ${enrollment.queue_ticket.position === 1 ? "student is" : "students are"} ahead of you.`}
                      </p>
                    )}
                </>
              ) : (
                <span className="font-normal text-muted-foreground">
                  {enrollment.registrar_decided_at === null &&
                  enrollment.status === "pending_registrar_approval"
                    ? "Waiting for registrar approval — no queue number yet"
                    : "Not issued"}
                </span>
              )}
            </dd>
          </div>
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">
              Payment confirmed
            </dt>
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
