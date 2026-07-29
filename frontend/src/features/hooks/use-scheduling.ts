"use client"

import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/features/auth/use-auth"
import { getScheduleProposals } from "@/features/services/scheduling-service"

export const scheduleProposalsQueryKey = (userId: string | null) =>
  ["schedule-proposals", userId] as const
export function useScheduleProposalsQuery() {
  const { session } = useAuth()
  return useQuery({
    queryKey: scheduleProposalsQueryKey(session?.userId ?? null),
    queryFn: ({ signal }) => getScheduleProposals(signal),
    enabled: session !== null,
  })
}
