"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import type { UserRole } from "@/features/auth/roles"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
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
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Field, FieldLabel } from "@/features/components/ui/field"
import { Textarea } from "@/features/components/ui/textarea"
import { sectionsQueryKey } from "@/features/hooks/use-reference-data"
import {
  scheduleProposalsQueryKey,
  useScheduleProposalsQuery,
} from "@/features/hooks/use-scheduling"
import type {
  ScheduleAction,
  ScheduleProposal,
} from "@/features/schemas/scheduling-schema"
import {
  availableScheduleActions,
  transitionScheduleProposal,
} from "@/features/services/scheduling-service"

const actionLabel: Record<ScheduleAction, string> = {
  dean_approve: "Approve as Dean",
  dean_return: "Return to draft",
  executive_approve: "Approve as Executive Director",
  executive_return: "Return to draft",
  publish: "Publish schedule",
  close: "Close proposal",
}
function requiresReason(action: ScheduleAction) {
  return action === "dean_return" || action === "executive_return"
}

export function ScheduleDecisionControls({
  actorRole,
  proposals,
}: {
  actorRole: UserRole
  proposals: readonly ScheduleProposal[]
}) {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState<{
    proposal: ScheduleProposal
    action: ScheduleAction
  } | null>(null)
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const mutation = useMutation({
    mutationFn: ({
      id,
      action,
      decision_reason,
    }: {
      id: number
      action: ScheduleAction
      decision_reason?: string
    }) =>
      transitionScheduleProposal(id, {
        action,
        ...(decision_reason ? { decision_reason } : {}),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: scheduleProposalsQueryKey(session?.userId ?? null),
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: sectionsQueryKey(session?.userId ?? null),
          exact: true,
        }),
      ])
      setPending(null)
      setReason("")
    },
  })
  const reasonRequired =
    pending !== null && requiresReason(pending.action) && !reason.trim()

  const confirm = async () => {
    if (!pending || reasonRequired) return
    setError("")
    try {
      await mutation.mutateAsync({
        id: pending.proposal.id,
        action: pending.action,
        decision_reason: reason.trim() || undefined,
      })
    } catch {
      setError(
        "The schedule decision could not be saved. Check the connection and try again.",
      )
    }
  }
  const selectable = proposals.filter(
    (proposal) => availableScheduleActions(actorRole, proposal).length > 0,
  )
  if (selectable.length === 0)
    return <p>No schedule decisions are currently available.</p>
  return (
    <>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <ul className="grid gap-3">
        {selectable.map((proposal) => (
          <li key={proposal.id} className="rounded-md border p-3">
            <p>
              Proposal #{proposal.id} · {proposal.status_label}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {availableScheduleActions(actorRole, proposal).map((action) => (
                <Button
                  key={action}
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => {
                    setPending({ proposal, action })
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
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setPending(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm schedule decision</AlertDialogTitle>
            <AlertDialogDescription>
              This lifecycle transition is recorded in the operational audit
              log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pending && requiresReason(pending.action) && (
            <Field data-invalid={reasonRequired}>
              <FieldLabel htmlFor="decision-reason">Decision reason</FieldLabel>
              <Textarea
                id="decision-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={mutation.isPending}
                aria-describedby={
                  reasonRequired ? "decision-reason-error" : undefined
                }
              />
              {reasonRequired && (
                <p
                  id="decision-reason-error"
                  className="text-sm text-destructive"
                >
                  A reason is required to return this proposal.
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
    </>
  )
}

export function ScheduleDecisionWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "dean"
  const proposalsQuery = useScheduleProposalsQuery({ enabled: authorized })

  return (
    <WorkspacePage
      title="Schedule approvals"
      description="Review only the proposals assigned to the Dean checkpoint."
      unauthorized={!authorized}
      lastUpdated={proposalsQuery.dataUpdatedAt}
    >
      <AsyncBoundary
        query={proposalsQuery}
        loadingLabel="Loading schedule proposals…"
      >
        {(proposals) => (
          <Card>
            <CardHeader>
              <CardTitle level={2}>Dean decisions</CardTitle>
            </CardHeader>
            <CardContent>
              <ScheduleDecisionControls
                actorRole="dean"
                proposals={proposals}
              />
            </CardContent>
          </Card>
        )}
      </AsyncBoundary>
    </WorkspacePage>
  )
}
