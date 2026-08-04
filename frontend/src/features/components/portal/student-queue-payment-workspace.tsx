"use client"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import {
  StatusStepper,
  type StatusStepperStage,
} from "@/features/components/portal/status-stepper"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Badge } from "@/features/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { useEnrollmentsQuery } from "@/features/hooks/use-enrollment"
import type { Enrollment } from "@/features/schemas/enrollment-schema"

const STOPPED_STATUSES = new Set(["rejected", "cancelled", "withdrawn"])

function stagesFor(enrollment: Enrollment): readonly StatusStepperStage[] {
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

export function StudentQueuePaymentWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "student"
  const enrollmentsQuery = useEnrollmentsQuery({ enabled: authorized })

  return (
    <WorkspacePage
      title="Queue & payment status"
      description="Track your enrollment's approval, queue position, and payment status."
      unauthorized={!authorized}
      lastUpdated={enrollmentsQuery.dataUpdatedAt}
    >
      <AsyncBoundary
        query={{
          ...enrollmentsQuery,
          data: (enrollmentsQuery.data ?? [])[0] ?? null,
        }}
        isEmpty={(enrollment) => enrollment === null}
        emptyMessage="You have no enrollment submitted yet."
        loadingLabel="Loading your enrollment status…"
      >
        {(activeEnrollment) =>
          activeEnrollment && (
            <Card>
              <CardHeader>
                <CardTitle level={2} className="flex items-center gap-2">
                  Enrollment #{activeEnrollment.id}
                  <Badge variant="secondary">
                    {activeEnrollment.status_label}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6">
                <StatusStepper
                  stages={stagesFor(activeEnrollment)}
                  stoppedMessage={
                    STOPPED_STATUSES.has(activeEnrollment.status)
                      ? `This enrollment is ${activeEnrollment.status_label.toLowerCase()} and is not progressing further.`
                      : undefined
                  }
                />
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <dt className="text-xs text-muted-foreground">
                      Queue ticket
                    </dt>
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
                          {activeEnrollment.registrar_decided_at === null &&
                          activeEnrollment.status === "pending_registrar_approval"
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
          )
        }
      </AsyncBoundary>
    </WorkspacePage>
  )
}
