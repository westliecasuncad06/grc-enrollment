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
  useEnrollmentsListQuery,
  useUpdateEnrollmentMutation,
} from "@/features/hooks/use-enrollment"
import type { Enrollment } from "@/features/schemas/enrollment-schema"

const workspaceHeadings: Record<string, string> = {
  "enrollment-approvals": "Enrollment approvals",
  "overrides-voids": "Overrides & voids",
}

type RegistrarAction = "registrar_approve" | "registrar_reject" | "void"

const actionLabel: Record<RegistrarAction, string> = {
  registrar_approve: "Approve",
  registrar_reject: "Reject",
  void: "Void",
}

function requiresReason(action: RegistrarAction) {
  return action === "registrar_reject" || action === "void"
}

function availableActions(enrollment: Enrollment): readonly RegistrarAction[] {
  if (enrollment.status === "pending_registrar_approval") {
    return ["registrar_approve", "registrar_reject"]
  }
  if (enrollment.status === "pending_payment") {
    return ["void"]
  }
  return []
}

interface RegistrarEnrollmentWorkspaceProps {
  initialModuleId?: string
}

export function RegistrarEnrollmentWorkspace({
  initialModuleId = "enrollment-approvals",
}: RegistrarEnrollmentWorkspaceProps) {
  const { session } = useAuth()
  const authorized = session?.role === "registrar_head"
  const [page, setPage] = useState(1)
  const [pending, setPending] = useState<{
    enrollment: Enrollment
    action: RegistrarAction
  } | null>(null)
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const heading =
    workspaceHeadings[initialModuleId] ??
    workspaceHeadings["enrollment-approvals"]

  const enrollmentsQuery = useEnrollmentsListQuery(
    { page, per_page: 20 },
    { enabled: authorized },
  )
  const mutation = useUpdateEnrollmentMutation()

  if (!authorized) {
    return (
      <section aria-label="Registrar enrollment workspace">
        <p>This workspace is not available for your role.</p>
      </section>
    )
  }

  const confirm = async () => {
    if (!pending || (requiresReason(pending.action) && !reason.trim())) return
    setError("")
    try {
      await mutation.mutateAsync({
        id: pending.enrollment.id,
        action: pending.action,
        reason: reason.trim() || undefined,
      })
      setPending(null)
      setReason("")
    } catch {
      setError(
        "The enrollment decision could not be saved. Check the connection and try again.",
      )
    }
  }

  return (
    <section aria-label="Registrar enrollment workspace" className="grid gap-4">
      <div>
        <h2>{heading}</h2>
        <p>
          Approve or reject submissions pending registrar review, or void an
          already-approved enrollment before payment is confirmed.
        </p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {enrollmentsQuery.isLoading ? (
        <Skeleton className="h-48" />
      ) : enrollmentsQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            Enrollments could not be loaded.{" "}
            <Button
              type="button"
              variant="outline"
              onClick={() => void enrollmentsQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Enrollment queue</CardTitle>
          </CardHeader>
          <CardContent>
            {(enrollmentsQuery.data?.data.length ?? 0) === 0 ? (
              <p>No enrollments match this queue.</p>
            ) : (
              <ul className="grid gap-3">
                {(enrollmentsQuery.data?.data ?? []).map((enrollment) => (
                  <li key={enrollment.id} className="rounded-md border p-3">
                    <p>
                      Student {enrollment.student_number} · Enrollment #
                      {enrollment.id} · {enrollment.status_label}
                    </p>
                    <p>Total units: {enrollment.total_units}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {availableActions(enrollment).map((action) => (
                        <Button
                          key={action}
                          type="button"
                          disabled={mutation.isPending}
                          onClick={() => {
                            setPending({ enrollment, action })
                            setReason("")
                            setError("")
                          }}
                        >
                          {actionLabel[action]}
                        </Button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex justify-between">
              <Button
                type="button"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous page
              </Button>
              <span>
                Page {enrollmentsQuery.data?.meta.current_page ?? 1} of{" "}
                {enrollmentsQuery.data?.meta.last_page ?? 1}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={
                  (enrollmentsQuery.data?.meta.current_page ?? 1) >=
                  (enrollmentsQuery.data?.meta.last_page ?? 1)
                }
                onClick={() => setPage((value) => value + 1)}
              >
                Next page
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setPending(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm enrollment decision</AlertDialogTitle>
            <AlertDialogDescription>
              This decision is recorded in the operational audit log and
              notifies the student.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pending && requiresReason(pending.action) && (
            <label className="grid gap-1" htmlFor="registrar-decision-reason">
              Reason
              <textarea
                id="registrar-decision-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={mutation.isPending}
              />
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={
                mutation.isPending ||
                (pending !== null &&
                  requiresReason(pending.action) &&
                  !reason.trim())
              }
              onClick={() => void confirm()}
            >
              {mutation.isPending ? "Saving decision" : "Confirm decision"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
