"use client"

import { useEffect, useMemo, useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { StatusStepper } from "@/features/components/portal/status-stepper"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/features/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import {
  isActiveItControlAutomationRun,
  useItControlAutomationRunQueries,
  useItControlAutomationRunsQuery,
  useStartItControlAutomationRunMutation,
} from "@/features/hooks/use-it-control-automation"
import {
  type ItControlAutomationRun,
  type ItControlAutomationStep,
  type ItControlAutomationRunStatus,
} from "@/features/schemas/it-control-schema"

interface AutomationStepDefinition {
  step: ItControlAutomationStep
  label: string
  description: string
  role: string
}

const automationSteps: readonly AutomationStepDefinition[] = [
  {
    step: "chair_generate_sections",
    label: "Generate all sections",
    description: "Creates and submits draft section plans across all colleges.",
    role: "Program Chair",
  },
  {
    step: "dean_approve_all",
    label: "Dean approves all",
    description:
      "Approves every submitted schedule proposal for the current term.",
    role: "Dean",
  },
  {
    step: "executive_publish_all",
    label: "Executive publishes all",
    description: "Publishes approved schedules and their available sections.",
    role: "Executive Director",
  },
  {
    step: "students_auto_enroll",
    label: "Students auto-enroll",
    description:
      "Creates validated subject-level enrollment requests for eligible students.",
    role: "Student",
  },
  {
    step: "registrar_approve_all",
    label: "Registrar approves all",
    description:
      "Moves submitted enrollment requests to payment and issues queue tickets.",
    role: "Registrar Head",
  },
  {
    step: "cashier_confirm_all",
    label: "Cashier confirms all",
    description:
      "Confirms recorded payments, finalizes enrollment, and creates Digital COMs.",
    role: "Accounting Staff",
  },
] as const

function isTerminalSuccess(run: ItControlAutomationRun | undefined) {
  return run?.status === "succeeded"
}

function isTerminal(run: ItControlAutomationRun) {
  return !isActiveItControlAutomationRun(run.status)
}

function displayStatus(run: ItControlAutomationRun | undefined) {
  if (!run) return "Idle"
  if (run.status === "queued") return "Running"

  return run.status[0].toUpperCase() + run.status.slice(1)
}

function statusVariant(
  status: ItControlAutomationRunStatus | undefined,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "succeeded") return "default"
  if (status === "partial" || status === "queued" || status === "running") {
    return "secondary"
  }
  if (status === "failed") return "destructive"

  return "outline"
}

function latestCompletedRunByStep(runs: readonly ItControlAutomationRun[]) {
  const completed = new Map<ItControlAutomationStep, ItControlAutomationRun>()

  for (const run of runs) {
    if (isTerminal(run) && !completed.has(run.step)) {
      completed.set(run.step, run)
    }
  }

  return completed
}

function formattedTimestamp(run: ItControlAutomationRun) {
  const timestamp = run.completed_at ?? run.started_at ?? run.created_at
  return timestamp
    ? new Date(timestamp).toLocaleString()
    : "Timestamp unavailable"
}

export function ItControlEnrollmentOverrideWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "it_admin"
  const [pendingStep, setPendingStep] =
    useState<AutomationStepDefinition | null>(null)
  const [activeRunId, setActiveRunId] = useState<number | null>(null)
  const [overrideOrder, setOverrideOrder] = useState(false)
  const runsQuery = useItControlAutomationRunsQuery(authorized)
  const activeRunIds = useMemo(
    () =>
      [
        ...(runsQuery.data ?? []),
        ...(activeRunId === null ? [] : [{ id: activeRunId }]),
      ]
        .filter((run) =>
          "status" in run ? isActiveItControlAutomationRun(run.status) : true,
        )
        .map((run) => run.id)
        .filter((id, index, ids) => ids.indexOf(id) === index),
    [activeRunId, runsQuery.data],
  )
  const activeRunQueries = useItControlAutomationRunQueries(
    activeRunIds,
    authorized,
  )
  const startRun = useStartItControlAutomationRunMutation()
  const activeRuns = activeRunQueries.flatMap((query) =>
    query.data ? [query.data] : [],
  )
  const runs = useMemo(() => {
    const byStep = latestCompletedRunByStep(runsQuery.data ?? [])

    for (const activeRun of activeRuns) byStep.set(activeRun.step, activeRun)

    return byStep
  }, [activeRuns, runsQuery.data])

  useEffect(() => {
    if (activeRuns.some((run) => !isActiveItControlAutomationRun(run.status))) {
      void runsQuery.refetch()
    }
  }, [activeRuns, runsQuery])

  const start = () => {
    if (!pendingStep) return

    startRun.mutate(
      { step: pendingStep.step },
      {
        onSuccess: (run) => {
          setActiveRunId(run.id)
          setPendingStep(null)
        },
      },
    )
  }

  return (
    <WorkspacePage
      title="Enrollment overrides"
      description="Run local IT-control enrollment automation in the audited lifecycle order. Each operation is advisory support tooling, not a production enrollment decision."
      unauthorized={!authorized}
      lastUpdated={Math.max(
        runsQuery.dataUpdatedAt,
        ...activeRunQueries.map((query) => query.dataUpdatedAt),
      )}
      actions={
        <Button
          type="button"
          variant="outline"
          aria-pressed={overrideOrder}
          onClick={() => setOverrideOrder((current) => !current)}
        >
          {overrideOrder ? "Stop override order" : "Override order"}
        </Button>
      }
    >
      {(runsQuery.isError ||
        activeRunQueries.some((query) => query.isError) ||
        startRun.isError) && (
        <Alert variant="destructive">
          <AlertTitle>Automation request needs attention</AlertTitle>
          <AlertDescription>
            {runsQuery.error?.message ??
              activeRunQueries.find((query) => query.isError)?.error?.message ??
              startRun.error?.message ??
              "The automation run could not be completed."}
          </AlertDescription>
        </Alert>
      )}
      <StatusStepper
        stages={automationSteps.map((definition) => {
          const run = runs.get(definition.step)

          return {
            label: definition.label,
            done: isTerminalSuccess(run),
            current: isActiveItControlAutomationRun(run?.status),
          }
        })}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        {automationSteps.map((definition, index) => {
          const run = runs.get(definition.step)
          const prerequisite = automationSteps[index - 1]
          const prerequisiteRun = prerequisite
            ? runs.get(prerequisite.step)
            : undefined
          const disabled =
            startRun.isPending ||
            isActiveItControlAutomationRun(run?.status) ||
            (!overrideOrder &&
              prerequisite !== undefined &&
              !isTerminalSuccess(prerequisiteRun))

          return (
            <Card key={definition.step}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle level={2}>{definition.label}</CardTitle>
                    <CardDescription>{definition.description}</CardDescription>
                  </div>
                  <Badge variant={statusVariant(run?.status)}>
                    {displayStatus(run)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Impersonates:{" "}
                  <span className="font-medium text-foreground">
                    {definition.role}
                  </span>
                </p>
                {run ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span>
                      {run.processed_count.toLocaleString()} processed
                    </span>
                    <span>{run.failed_count.toLocaleString()} failed</span>
                    <time
                      dateTime={
                        run.completed_at ??
                        run.started_at ??
                        run.created_at ??
                        undefined
                      }
                    >
                      {formattedTimestamp(run)}
                    </time>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No completed run recorded.
                  </p>
                )}
                {run && run.warnings.length > 0 && (
                  <details className="rounded-md border border-border p-3 text-sm">
                    <summary className="cursor-pointer font-medium">
                      Warnings ({run.warnings.length})
                    </summary>
                    <ul className="mt-2 list-disc pl-5">
                      {run.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {run?.error_summary && (
                  <Alert variant="destructive">
                    <AlertDescription>{run.error_summary}</AlertDescription>
                  </Alert>
                )}
                <Button
                  type="button"
                  disabled={disabled}
                  onClick={() => setPendingStep(definition)}
                >
                  {isActiveItControlAutomationRun(run?.status)
                    ? "Running"
                    : definition.label}
                </Button>
                {prerequisite !== undefined &&
                  !overrideOrder &&
                  !isTerminalSuccess(prerequisiteRun) && (
                    <p className="text-sm text-muted-foreground">
                      Complete {prerequisite.label} successfully first, or use
                      Override order for a targeted rerun.
                    </p>
                  )}
              </CardContent>
            </Card>
          )
        })}
      </div>
      <AlertDialog
        open={pendingStep !== null}
        onOpenChange={(open) => !open && setPendingStep(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run {pendingStep?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This starts the audited automation as {pendingStep?.role}. It can
              change local enrollment workflow records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={start}>Run step</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkspacePage>
  )
}
