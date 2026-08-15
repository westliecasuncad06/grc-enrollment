"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import {
  getOwnStudentAccount,
  getStudentAccount,
  recordStudentAccountPayment,
} from "@/features/services/student-account-service"

export const ownStudentAccountQueryKey = (userId: string | null) =>
  ["student-account", "own", userId] as const

export const studentAccountQueryKey = (
  userId: string | null,
  studentId: number | null,
) => ["student-account", "student", userId, studentId] as const

export function useOwnStudentAccountQuery({
  enabled = true,
}: { enabled?: boolean } = {}) {
  const { session } = useAuth()

  return useQuery({
    queryKey: ownStudentAccountQueryKey(session?.userId ?? null),
    queryFn: ({ signal }) => getOwnStudentAccount(signal),
    enabled: enabled && session?.role === "student",
    refetchOnWindowFocus: "always",
  })
}

export function useStudentAccountQuery(
  studentId: number | null,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: studentAccountQueryKey(session?.userId ?? null, studentId),
    queryFn: ({ signal }) => getStudentAccount(studentId!, signal),
    enabled:
      enabled && session?.role === "accounting_staff" && studentId !== null,
    refetchOnWindowFocus: "always",
  })
}

export function useRecordStudentAccountPaymentMutation() {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      studentId,
      amount,
    }: {
      studentId: number
      amount: number
    }) => recordStudentAccountPayment(studentId, { amount }),
    onSuccess: (_account, variables) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: studentAccountQueryKey(
            session?.userId ?? null,
            variables.studentId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: ["enrollments-list", session?.userId ?? null],
        }),
        queryClient.invalidateQueries({
          queryKey: ["queue-tickets", session?.userId ?? null],
        }),
      ]),
  })
}
