"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import {
  DataTable,
  type DataTableColumn,
} from "@/features/components/portal/data-table"
import { EnrollmentReviewDialog } from "@/features/components/portal/enrollment-review-dialog"
import { Paginator } from "@/features/components/portal/paginator"
import { ProspectusDocument } from "@/features/components/portal/prospectus-document"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/features/components/ui/alert-dialog"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/features/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
import { Textarea } from "@/features/components/ui/textarea"
import { useEnrollmentsListQuery } from "@/features/hooks/use-enrollment"
import { formatYearLevelOrdinal } from "@/features/lib/curriculum-ordinal"
import type { Enrollment } from "@/features/schemas/enrollment-schema"
import { updateEnrollment } from "@/features/services/enrollment-service"

type DecisionAction = "registrar_approve" | "registrar_reject"

function statusBadgeVariant(
  status: Enrollment["status"],
): "default" | "destructive" | "outline" {
  if (status === "rejected" || status === "cancelled") return "destructive"
  if (status === "enrolled") return "default"
  return "outline"
}

export function ProgramChairIrregularEnrollmentsWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "program_chair"
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<
    "pending_registrar_approval" | "pending_payment" | "enrolled" | "rejected" | "all"
  >("pending_registrar_approval")

  const [reviewingEnrollment, setReviewingEnrollment] =
    useState<Enrollment | null>(null)
  const [prospectusStudent, setProspectusStudent] = useState<{
    id: number
    name: string
    studentNumber: string
  } | null>(null)

  const [pendingDecision, setPendingDecision] = useState<{
    enrollment: Enrollment
    action: DecisionAction
  } | null>(null)
  const [reason, setReason] = useState("")
  const [overloadAcknowledged, setOverloadAcknowledged] = useState(false)
  const [error, setError] = useState("")

  const queryClient = useQueryClient()

  const enrollmentsQuery = useEnrollmentsListQuery(
    {
      page,
      status: statusFilter === "all" ? undefined : statusFilter,
    },
    { enabled: authorized },
  )

  const mutation = useMutation({
    mutationFn: async ({
      enrollmentId,
      action,
      decisionReason,
    }: {
      enrollmentId: number
      action: DecisionAction
      decisionReason?: string
    }) => {
      return updateEnrollment(enrollmentId, {
        action,
        reason: decisionReason,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["enrollments"],
      })
      setPendingDecision(null)
      setReason("")
      setOverloadAcknowledged(false)
      setError("")
    },
    onError: (err: unknown) => {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while saving decision.",
      )
    },
  })

  if (!authorized) {
    return (
      <WorkspacePage
        title="Irregular Advising"
        description="Review and advise irregular students on their subject selections and schedule."
      >
        <Alert variant="destructive">
          <AlertDescription>
            You are not authorized to access irregular student advising.
          </AlertDescription>
        </Alert>
      </WorkspacePage>
    )
  }

  const reasonRequired =
    pendingDecision?.action === "registrar_reject" && reason.trim() === ""
  const overloadAcknowledgementRequired =
    pendingDecision?.action === "registrar_approve" &&
    Boolean(pendingDecision.enrollment.requires_overload_approval) &&
    !overloadAcknowledged

  const handleConfirmDecision = async () => {
    if (!pendingDecision) return
    if (reasonRequired || overloadAcknowledgementRequired) return

    await mutation.mutateAsync({
      enrollmentId: pendingDecision.enrollment.id,
      action: pendingDecision.action,
      decisionReason: reason.trim() ? reason.trim() : undefined,
    })
  }

  const rawRows = enrollmentsQuery.data?.data ?? []
  const filteredRows = search.trim()
    ? rawRows.filter(
        (e) =>
          e.student_number.toLowerCase().includes(search.toLowerCase().trim()) ||
          (e.student_name &&
            e.student_name.toLowerCase().includes(search.toLowerCase().trim())),
      )
    : rawRows

  const columns: DataTableColumn<Enrollment>[] = [
    {
      key: "student",
      header: "Student",
      render: (enrollment) => (
        <div>
          <div className="flex items-center gap-2 font-medium">
            <span>{enrollment.student_name ?? "—"}</span>
            <span className="text-xs text-muted-foreground font-mono">
              ({enrollment.student_number})
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {formatYearLevelOrdinal(enrollment.student_year_level)}
          </div>
        </div>
      ),
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
      render: (enrollment) => (
        <div className="flex items-center gap-2">
          <span>{enrollment.total_units} units</span>
          {enrollment.requires_overload_approval && (
            <Badge variant="warning">Overload</Badge>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (enrollment) => (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setReviewingEnrollment(enrollment)}
          >
            Check Schedule
          </Button>
          {enrollment.student_id && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setProspectusStudent({
                  id: enrollment.student_id,
                  name: enrollment.student_name ?? enrollment.student_number,
                  studentNumber: enrollment.student_number,
                })
              }
            >
              Prospectus
            </Button>
          )}
          {enrollment.status === "pending_registrar_approval" && (
            <>
              <Button
                type="button"
                size="sm"
                variant="default"
                disabled={mutation.isPending}
                onClick={() => {
                  setPendingDecision({
                    enrollment,
                    action: "registrar_approve",
                  })
                  setReason("")
                  setOverloadAcknowledged(false)
                  setError("")
                }}
              >
                Approve
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={mutation.isPending}
                onClick={() => {
                  setPendingDecision({
                    enrollment,
                    action: "registrar_reject",
                  })
                  setReason("")
                  setOverloadAcknowledged(false)
                  setError("")
                }}
              >
                Reject
              </Button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <WorkspacePage
      title="Irregular Student Advising & Approvals"
      description="Check submitted schedules for irregular students, verify their curriculum prospectus, and approve or reject submissions."
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1">
            <CardTitle level={2}>Submissions Queue</CardTitle>
            <p className="text-sm text-muted-foreground">
              Review irregular student subject loads before confirming enrollment.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={
                statusFilter === "pending_registrar_approval"
                  ? "default"
                  : "outline"
              }
              onClick={() => {
                setStatusFilter("pending_registrar_approval")
                setPage(1)
              }}
            >
              Pending Review
            </Button>
            <Button
              type="button"
              size="sm"
              variant={statusFilter === "pending_payment" ? "default" : "outline"}
              onClick={() => {
                setStatusFilter("pending_payment")
                setPage(1)
              }}
            >
              Approved
            </Button>
            <Button
              type="button"
              size="sm"
              variant={statusFilter === "enrolled" ? "default" : "outline"}
              onClick={() => {
                setStatusFilter("enrolled")
                setPage(1)
              }}
            >
              Enrolled
            </Button>
            <Button
              type="button"
              size="sm"
              variant={statusFilter === "rejected" ? "default" : "outline"}
              onClick={() => {
                setStatusFilter("rejected")
                setPage(1)
              }}
            >
              Rejected
            </Button>
            <Button
              type="button"
              size="sm"
              variant={statusFilter === "all" ? "default" : "outline"}
              onClick={() => {
                setStatusFilter("all")
                setPage(1)
              }}
            >
              All
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center gap-3">
            <Input
              type="search"
              placeholder="Search by student number or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>

          <AsyncBoundary
            query={{ ...enrollmentsQuery, data: filteredRows }}
            isEmpty={(rows) => rows.length === 0}
            emptyMessage="No irregular student enrollments match this filter."
            loadingLabel="Loading irregular enrollments…"
          >
            {(rows) => (
              <DataTable
                caption="Irregular student enrollments"
                rowKey={(e) => e.id}
                rows={rows}
                columns={columns}
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

      {/* Review Dialog with Schedule */}
      <EnrollmentReviewDialog
        enrollment={reviewingEnrollment}
        onOpenChange={(open) => {
          if (!open) setReviewingEnrollment(null)
        }}
      />

      {/* Dedicated Prospectus Dialog */}
      <Dialog
        open={prospectusStudent !== null}
        onOpenChange={(open) => {
          if (!open) setProspectusStudent(null)
        }}
      >
        <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              Curriculum Prospectus — {prospectusStudent?.name} ({prospectusStudent?.studentNumber})
            </DialogTitle>
          </DialogHeader>
          {prospectusStudent && (
            <ProspectusDocument studentId={prospectusStudent.id} />
          )}
        </DialogContent>
      </Dialog>

      {/* Approval / Rejection Decision Confirmation */}
      <AlertDialog
        open={pendingDecision !== null}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setPendingDecision(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDecision?.action === "registrar_approve"
                ? "Approve irregular student enrollment?"
                : "Reject irregular student enrollment"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDecision?.action === "registrar_approve"
                ? "Approving this enrollment will compute fee assessments and transition the student to pending payment."
                : "Rejecting this enrollment requires providing a reason explaining what schedule corrections the student must make."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingDecision?.action === "registrar_reject" && (
            <Field data-invalid={reasonRequired}>
              <FieldLabel htmlFor="decision-reason">Reason for rejection</FieldLabel>
              <Textarea
                id="decision-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Schedule conflicts with core curriculum prerequisites; please choose an afternoon section."
                disabled={mutation.isPending}
                required
              />
              {reasonRequired && (
                <FieldError>A reason is required to reject an enrollment.</FieldError>
              )}
            </Field>
          )}

          {pendingDecision?.action === "registrar_approve" &&
            Boolean(pendingDecision.enrollment.requires_overload_approval) && (
              <Alert variant="destructive">
                <AlertDescription>
                  <p>
                    This enrollment totals {pendingDecision.enrollment.total_units} units,
                    which exceeds the regular load. Approving it requires explicit overload
                    acknowledgement.
                  </p>
                  <label className="mt-2 flex items-center gap-2 text-sm font-normal">
                    <input
                      type="checkbox"
                      checked={overloadAcknowledged}
                      onChange={(e) => setOverloadAcknowledged(e.target.checked)}
                      disabled={mutation.isPending}
                    />
                    <span>
                      I acknowledge this enrollment exceeds the regular unit load.
                    </span>
                  </label>
                </AlertDescription>
              </Alert>
            )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant={
                pendingDecision?.action === "registrar_approve"
                  ? "default"
                  : "destructive"
              }
              disabled={
                mutation.isPending ||
                reasonRequired ||
                overloadAcknowledgementRequired
              }
              onClick={() => void handleConfirmDecision()}
            >
              {mutation.isPending
                ? "Saving decision…"
                : pendingDecision?.action === "registrar_approve"
                  ? "Confirm Approval"
                  : "Confirm Rejection"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkspacePage>
  )
}
