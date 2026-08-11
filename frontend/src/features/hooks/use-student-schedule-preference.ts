"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import type { StudentSchedulePreferenceInput } from "@/features/schemas/student-schedule-preference-schema"
import {
  getStudentSchedulePreference,
  saveStudentSchedulePreference,
} from "@/features/services/student-schedule-preference-service"

export const studentSchedulePreferenceQueryKey = (userId: string | null) =>
  ["student-schedule-preference", userId] as const

export function useStudentSchedulePreferenceQuery() {
  const { session } = useAuth()

  return useQuery({
    queryKey: studentSchedulePreferenceQueryKey(session?.userId ?? null),
    queryFn: ({ signal }) => getStudentSchedulePreference(signal),
    enabled: session !== null,
  })
}

/**
 * Saving a preference changes which blocks and subjects rank as good fits
 * (Task 2's server-side scoring reads this row), so both the enrollment
 * block pool and the eligible-subject pool must refresh — matching the
 * partial-key invalidation idiom already used for the enrollment queue
 * (`useInvalidateEnrollmentQueries` in `use-enrollment.ts`), since both keys
 * are further scoped by an academic term the panel does not know about.
 */
export function useSaveStudentSchedulePreferenceMutation() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const userId = session?.userId ?? null

  return useMutation({
    mutationFn: (input: StudentSchedulePreferenceInput) =>
      saveStudentSchedulePreference(input),
    onSuccess: async (preference) => {
      queryClient.setQueryData(
        studentSchedulePreferenceQueryKey(userId),
        preference,
      )
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["enrollment-blocks", userId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["eligible-subjects", userId],
        }),
      ])
    },
  })
}
