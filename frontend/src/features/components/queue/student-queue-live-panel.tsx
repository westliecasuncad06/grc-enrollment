"use client"

import { useId } from "react"
import {
  BellRingIcon,
  Clock3Icon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react"

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
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { useQueueCallAlert } from "@/features/hooks/use-queue-call-alert"
import { cn } from "@/features/lib/utils"
import type { StudentQueueView } from "@/features/schemas/student-queue-schema"

export type QueueLivePanelMode = "kiosk" | "default" | "compact"

interface StudentQueueLivePanelProps {
  queue: StudentQueueView
  mode?: QueueLivePanelMode
}

function getStageGuidance(queue: StudentQueueView): string {
  switch (queue.stage) {
    case "no_active_enrollment":
      return "You do not have an active enrollment for the current term."
    case "pending_registrar_approval":
      return "Registrar approval is required before a queue number can be issued."
    case "pending_payment":
      if (!queue.ticket && queue.can_claim) {
        return "Claim your number at the Cashier kiosk."
      }
      return queue.ticket
        ? "Your queue ticket is active."
        : "Your queue number is not available yet."
    case "enrolled":
      return "Payment has been confirmed and your enrollment is complete."
  }
}

function getStatusVariant(
  status: NonNullable<StudentQueueView["ticket"]>["status"],
) {
  switch (status) {
    case "serving":
      return "success" as const
    case "cancelled":
      return "destructive" as const
    case "served":
      return "outline" as const
    case "waiting":
      return "secondary" as const
  }
}

function getPositionCopy(position: number): string {
  return position === 0
    ? "You're next in line."
    : `${position} ${position === 1 ? "student is" : "students are"} ahead of you.`
}

export function StudentQueueLivePanel({
  queue,
  mode = "default",
}: StudentQueueLivePanelProps) {
  const upcomingTicketNumbersId = useId()
  const {
    isCalled,
    callMessage,
    soundEnabled,
    soundPreferred,
    enableSound,
    disableSound,
  } = useQueueCallAlert(queue.ticket)
  const ticket = queue.ticket
  const isStudentSurface = mode !== "kiosk"
  const isAwaitingRegistrarApproval =
    isStudentSurface &&
    ticket === null &&
    queue.stage === "pending_registrar_approval"

  return (
    <Card
      role="region"
      aria-label="Your Cashier queue"
      className={cn(
        "queue-live-panel",
        `queue-live-panel--${mode}`,
        isCalled && "queue-live-panel--called",
      )}
    >
      <CardHeader>
        <CardTitle level={2}>Your Cashier queue</CardTitle>
        <CardDescription>
          Your live queue details refresh while this page is open.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {callMessage && (
          <Alert
            role="alert"
            aria-live="assertive"
            className="queue-live-panel__call-alert"
          >
            <BellRingIcon />
            <AlertTitle>Now serving</AlertTitle>
            <AlertDescription>{callMessage}</AlertDescription>
          </Alert>
        )}

        <div className="queue-live-panel__facts">
          <div
            className={cn(
              "queue-live-panel__ticket",
              !ticket &&
                isStudentSurface &&
                "queue-live-panel__ticket--unavailable",
              isAwaitingRegistrarApproval &&
                "queue-live-panel__ticket--awaiting-approval",
            )}
          >
            <p className="queue-live-panel__label">Your ticket</p>
            {ticket ? (
              <p className="queue-live-panel__ticket-number">
                {ticket.ticket_number}
              </p>
            ) : (
              <p className="queue-live-panel__ticket-number queue-live-panel__ticket-number--status">
                Not issued
              </p>
            )}
            {isAwaitingRegistrarApproval && (
              <p className="queue-live-panel__approval-status">
                <Clock3Icon aria-hidden="true" />
                Waiting for Registrar approval
              </p>
            )}
            {ticket && (
              <div className="flex flex-wrap gap-2">
                <Badge variant={getStatusVariant(ticket.status)}>
                  {ticket.status_label}
                </Badge>
                <Badge
                  variant={
                    ticket.priority === "priority" ? "warning" : "outline"
                  }
                >
                  {ticket.priority_label}
                </Badge>
              </div>
            )}
          </div>

          <div
            className={cn(
              "queue-live-panel__serving",
              !queue.now_serving_ticket_number &&
                isStudentSurface &&
                "queue-live-panel__serving--unavailable",
            )}
          >
            <p className="queue-live-panel__label">Now serving</p>
            <p
              className={cn(
                "queue-live-panel__serving-number",
                !queue.now_serving_ticket_number &&
                  "queue-live-panel__serving-number--status",
              )}
            >
              {queue.now_serving_ticket_number ??
                "No number is currently being served."}
            </p>
          </div>
        </div>

        {ticket?.status === "waiting" && ticket.position !== null && (
          <p className="font-medium">{getPositionCopy(ticket.position)}</p>
        )}

        {mode !== "compact" && queue.upcoming_ticket_numbers.length > 0 && (
          <section aria-labelledby={upcomingTicketNumbersId}>
            <p id={upcomingTicketNumbersId} className="queue-live-panel__label">
              Upcoming ticket numbers
            </p>
            <ul
              aria-labelledby={upcomingTicketNumbersId}
              className="queue-live-panel__upcoming-list"
            >
              {queue.upcoming_ticket_numbers.map((ticketNumber) => (
                <li key={ticketNumber}>{ticketNumber}</li>
              ))}
            </ul>
          </section>
        )}

        <Alert>
          <AlertTitle>Queue guidance</AlertTitle>
          <AlertDescription>{getStageGuidance(queue)}</AlertDescription>
        </Alert>

        {queue.cut_off_today && (
          <Alert variant="destructive">
            <AlertTitle>Today&apos;s cut-off has been reached</AlertTitle>
            <AlertDescription>
              Today&apos;s queue has reached its cut-off. Please check with the
              Cashier for next steps.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="queue-live-panel__footer">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Queue alerts</p>
          <p className="text-sm text-muted-foreground">
            Vibration is best-effort; iOS Safari does not support web vibration.
            Visual alerts remain available.
          </p>
          {soundPreferred && !soundEnabled && (
            <p className="text-sm text-muted-foreground">
              Sound is preferred, but this visit still needs you to turn it on.
            </p>
          )}
        </div>
        <Button
          type="button"
          variant={soundEnabled ? "secondary" : "outline"}
          onClick={soundEnabled ? disableSound : enableSound}
        >
          {soundEnabled ? (
            <VolumeXIcon data-icon="inline-start" />
          ) : (
            <Volume2Icon data-icon="inline-start" />
          )}
          {soundEnabled ? "Turn off sound" : "Turn on sound"}
        </Button>
        <p className="queue-live-panel__keep-open">
          Keep this page open and visible near the time of service. Browsers and
          operating systems may throttle background tabs.
        </p>
      </CardFooter>
    </Card>
  )
}
