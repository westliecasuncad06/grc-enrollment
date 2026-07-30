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
import { Field, FieldLabel } from "@/features/components/ui/field"
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Enrollment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(enrollmentsQuery.data?.data ?? []).map((enrollment) => (
                    <TableRow key={enrollment.id}>
                      <TableCell>{enrollment.student_number}</TableCell>
                      <TableCell>#{enrollment.id}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(enrollment.status)}>
                          {enrollment.status_label}
                        </Badge>
                      </TableCell>
                      <TableCell>{enrollment.total_units}</TableCell>
                      <TableCell>
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="mt-4 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous page
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {enrollmentsQuery.data?.meta.current_page ?? 1} of{" "}
                {enrollmentsQuery.data?.meta.last_page ?? 1}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
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
            <Field>
              <FieldLabel htmlFor="registrar-decision-reason">
                Reason
              </FieldLabel>
              <textarea
                id="registrar-decision-reason"
                className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={mutation.isPending}
              />
            </Field>
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
