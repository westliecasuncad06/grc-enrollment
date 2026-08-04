"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import type { SaveEnrollmentScheduleInput } from "@/features/schemas/enrollment-window-schema"
import {
  getEnrollmentSchedule,
  saveEnrollmentSchedule,
} from "@/features/services/enrollment-window-service"

export const enrollmentScheduleQueryKey = (
  academicTermId: number | null,
  userId: string | null,
) => ["enrollment-schedule", academicTermId, userId] as const

export function useEnrollmentScheduleQuery(
  academicTermId: number | null,
  enabled = true,
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: enrollmentScheduleQueryKey(academicTermId, session?.userId ?? null),
    queryFn: ({ signal }) => getEnrollmentSchedule(academicTermId!, signal),
    enabled: enabled && session !== null && academicTermId !== null,
  })
}

export function useSaveEnrollmentScheduleMutation(academicTermId: number | null) {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SaveEnrollmentScheduleInput) =>
      saveEnrollmentSchedule(academicTermId!, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: enrollmentScheduleQueryKey(academicTermId, session?.userId ?? null),
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: ["academic-terms", session?.userId ?? null],
          exact: true,
        }),
      ])
    },
  })
}
