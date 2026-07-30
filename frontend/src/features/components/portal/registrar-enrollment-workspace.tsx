"use client"

import { useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { DataTable } from "@/features/components/portal/data-table"
import { Paginator } from "@/features/components/portal/paginator"
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
import { Field, FieldLabel } from "@/features/components/ui/field"
import { Textarea } from "@/features/components/ui/textarea"
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

function statusBadgeVariant(
  status: Enrollment["status"],
): "default" | "destructive" | "outline" {
  if (status === "rejected" || status === "cancelled") return "destructive"
  if (status === "enrolled") return "default"
  return "outline"
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
  const reasonRequired =
    pending !== null && requiresReason(pending.action) && !reason.trim()

  const confirm = async () => {
    if (!pending || reasonRequired) return
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
    <WorkspacePage
      title={heading}
      description="Approve or reject submissions pending registrar review, or void an already-approved enrollment before payment is confirmed."
      unauthorized={!authorized}
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle level={3}>Enrollment queue</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncBoundary
            query={{ ...enrollmentsQuery, data: enrollmentsQuery.data?.data }}
            isEmpty={(rows) => rows.length === 0}
            emptyMessage="No enrollments match this queue."
            loadingLabel="Loading the enrollment queue…"
          >
            {(enrollments) => (
              <DataTable
                caption="Enrollment queue"
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
                    key: "status",
                    header: "Status",
                    render: (enrollment) => (
                      <Badge variant={statusBadgeVariant(enrollment.status)}>
                        {enrollment.status_label}
                      </Badge>
                    ),
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
                      <div className="flex flex-wrap gap-2">
                        {availableActions(enrollment).map((action) => (
                          <Button
                            key={action}
                            type="button"
                            size="sm"
                            variant={
                              action === "registrar_approve"
                                ? "default"
                                : "destructive"
                            }
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
                    ),
                  },
                ]}
              />
            )}
          </AsyncBoundary>
          <div className="mt-4">
            <Paginator
              currentPage={enrollmentsQuery.data?.meta.current_page ?? 1}
              lastPage={enrollmentsQuery.data?.meta.last_page ?? 1}
              onPageChange={setPage}
            />
          </div>
        </CardContent>
      </Card>
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
            <Field data-invalid={reasonRequired}>
              <FieldLabel htmlFor="registrar-decision-reason">
                Reason
              </FieldLabel>
              <Textarea
                id="registrar-decision-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={mutation.isPending}
                aria-describedby={
                  reasonRequired ? "registrar-decision-reason-error" : undefined
                }
              />
              {reasonRequired && (
                <p
                  id="registrar-decision-reason-error"
                  className="text-sm text-destructive"
                >
                  A reason is required to reject or void this enrollment.
                </p>
              )}
            </Field>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={mutation.isPending || reasonRequired}
              onClick={() => void confirm()}
            >
              {mutation.isPending ? "Saving decision" : "Confirm decision"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkspacePage>
  )
}
