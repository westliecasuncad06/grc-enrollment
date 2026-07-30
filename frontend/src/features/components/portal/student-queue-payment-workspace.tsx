"use client"

import { CheckIcon } from "lucide-react"

import { useAuth } from "@/features/auth/use-auth"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Skeleton } from "@/features/components/ui/skeleton"
import { useEnrollmentsQuery } from "@/features/hooks/use-enrollment"
import type { Enrollment } from "@/features/schemas/enrollment-schema"
import { cn } from "@/features/lib/utils"

const STOPPED_STATUSES = new Set(["rejected", "cancelled", "withdrawn"])

interface Stage {
  label: string
  done: boolean
  current: boolean
}

function stagesFor(enrollment: Enrollment): readonly Stage[] {
  const approved = enrollment.registrar_decided_at !== null
  const paid = enrollment.payment_confirmed_at !== null
  const enrolled = enrollment.enrolled_at !== null

  return [
    { label: "Submitted", done: true, current: false },
    {
      label: "Registrar approved",
      done: approved,
      current: !approved,
    },
    {
      label: "Payment confirmed",
      done: paid,
      current: approved && !paid,
    },
    {
      label: "Enrolled",
      done: enrolled,
      current: paid && !enrolled,
    },
  ]
}

function StatusStepper({ enrollment }: { enrollment: Enrollment }) {
  if (STOPPED_STATUSES.has(enrollment.status)) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          This enrollment is {enrollment.status_label.toLowerCase()} and is not
          progressing further.
        </AlertDescription>
      </Alert>
    )
  }

  const stages = stagesFor(enrollment)

  return (
    <ol className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-0">
      {stages.map((stage, index) => (
        <li key={stage.label} className="flex flex-1 items-center gap-3">
          <div className="flex flex-col items-center gap-1 sm:w-full">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                stage.done
                  ? "border-primary bg-primary text-primary-foreground"
                  : stage.current
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground",
              )}
            >
              {stage.done ? (
                <CheckIcon aria-hidden="true" className="size-4" />
              ) : (
                index + 1
              )}
            </span>
            <span
              className={cn(
                "text-center text-xs",
                stage.done || stage.current
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {stage.label}
            </span>
          </div>
          {index < stages.length - 1 && (
            <div
              aria-hidden="true"
              className={cn(
                "hidden h-px flex-1 sm:block",
                stages[index + 1]?.done || stages[index + 1]?.current
                  ? "bg-primary"
                  : "bg-border",
              )}
            />
          )}
        </li>
      ))}
    </ol>
  )
}

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
          Track your enrollment&rsquo;s approval, queue position, and payment
          status.
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
            <CardTitle className="flex items-center gap-2">
              Enrollment #{activeEnrollment.id}
              <Badge variant="secondary">{activeEnrollment.status_label}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <StatusStepper enrollment={activeEnrollment} />
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">Queue ticket</dt>
                <dd className="text-sm font-medium">
                  {activeEnrollment.queue_ticket ? (
                    <>
                      {activeEnrollment.queue_ticket.ticket_number}{" "}
                      <span className="font-normal text-muted-foreground">
                        · {activeEnrollment.queue_ticket.status_label}
                      </span>
                    </>
                  ) : (
                    <span className="font-normal text-muted-foreground">
                      Not issued yet
                    </span>
                  )}
                </dd>
              </div>
              <div className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">
                  Payment confirmed
                </dt>
                <dd className="text-sm font-medium">
                  {activeEnrollment.payment_confirmed_at ? (
                    new Date(
                      activeEnrollment.payment_confirmed_at,
                    ).toLocaleString()
                  ) : (
                    <span className="font-normal text-muted-foreground">
                      Not yet
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
