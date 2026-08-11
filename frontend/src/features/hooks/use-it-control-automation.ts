"use client"

import { useMutation, useQueries, useQuery } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import {
  type ItControlAutomationRun,
  type ItControlAutomationRunStatus,
  type ItControlAutomationStep,
} from "@/features/schemas/it-control-schema"
import {
  createItControlAutomationRun,
  getItControlAutomationRun,
  getItControlAutomationRuns,
} from "@/features/services/it-control-service"

const activeStatuses: readonly ItControlAutomationRunStatus[] = [
  "queued",
  "running",
]

export const itControlAutomationRunsQueryKey = (userId: string | null) =>
  ["it-control", "automation-runs", userId] as const

export const itControlAutomationRunQueryKey = (
  userId: string | null,
  runId: number | null,
) => ["it-control", "automation-run", userId, runId] as const

export function isActiveItControlAutomationRun(
  status: ItControlAutomationRunStatus | undefined,
) {
  return status !== undefined && activeStatuses.includes(status)
}

function shouldPollItControlAutomationRun(
  run: ItControlAutomationRun | undefined,
) {
  return run === undefined || isActiveItControlAutomationRun(run.status)
}

export function useItControlAutomationRunsQuery(enabled = true) {
  const { session } = useAuth()

  return useQuery({
    queryKey: itControlAutomationRunsQueryKey(session?.userId ?? null),
    queryFn: ({ signal }) => getItControlAutomationRuns(signal),
    enabled: enabled && session !== null,
  })
}

export function useItControlAutomationRunQuery(
  runId: number | null,
  enabled = true,
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: itControlAutomationRunQueryKey(session?.userId ?? null, runId),
    queryFn: ({ signal }) => {
      if (runId === null) throw new Error("An automation run is required.")

      return getItControlAutomationRun(runId, signal)
    },
    enabled: enabled && session !== null && runId !== null,
    refetchInterval: (query) =>
      shouldPollItControlAutomationRun(query.state.data) ? 2_000 : false,
  })
}

export function useItControlAutomationRunQueries(
  runIds: readonly number[],
  enabled = true,
) {
  const { session } = useAuth()

  return useQueries({
    queries: runIds.map((runId) => ({
      queryKey: itControlAutomationRunQueryKey(session?.userId ?? null, runId),
      queryFn: ({ signal }) => getItControlAutomationRun(runId, signal),
      enabled: enabled && session !== null,
      refetchInterval: (query: { state: { data?: ItControlAutomationRun } }) =>
        shouldPollItControlAutomationRun(query.state.data) ? 2_000 : false,
    })),
  })
}

export function useStartItControlAutomationRunMutation() {
  return useMutation({
    mutationFn: ({
      step,
      signal,
    }: {
      step: ItControlAutomationStep
      signal?: AbortSignal
    }) => createItControlAutomationRun(step, signal),
  })
}
