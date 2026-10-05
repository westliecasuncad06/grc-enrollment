"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import { keepPreviousForSameUser } from "@/features/lib/query-client"
import type {
  ConfirmFreshmanPaymentInput,
  FreshmanEnrolleeFilters,
} from "@/features/schemas/freshman-schema"
import {
  confirmFreshmanPayment,
  getFreshmanPaymentPreview,
  listFreshmanEnrollees,
} from "@/features/services/freshman-service"

export const freshmanPaymentPreviewQueryKey = (
  userId: string | null,
  studentId: number | null,
) => ["freshman-payment-preview", userId, studentId] as const

/** What the Cashier is about to do for this freshman; read when the payment dialog opens. */
export function useFreshmanPaymentPreviewQuery(
  studentId: number | null,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: freshmanPaymentPreviewQueryKey(
      session?.userId ?? null,
      studentId,
    ),
    queryFn: ({ signal }) => getFreshmanPaymentPreview(studentId!, signal),
    enabled:
      enabled && studentId !== null && session?.role === "accounting_staff",
    // The seats can change while the Cashier talks to the freshman, so the preview is re-read
    // each time the dialog opens and kept fresh while it stays open.
    staleTime: 0,
    refetchInterval: 5_000,
  })
}

export function useConfirmFreshmanPaymentMutation() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const userId = session?.userId ?? null

  return useMutation({
    mutationFn: ({
      studentId,
      input,
    }: {
      studentId: number
      input: ConfirmFreshmanPaymentInput
    }) => confirmFreshmanPayment(studentId, input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["queue-tickets", userId] }),
        queryClient.invalidateQueries({
          queryKey: ["freshman-payment-preview", userId],
        }),
        queryClient.invalidateQueries({ queryKey: ["enrollments", userId] }),
        queryClient.invalidateQueries({ queryKey: ["cashier-transactions"] }),
      ]),
  })
}

export const freshmanEnrolleesQueryKey = (
  userId: string | null,
  filters: FreshmanEnrolleeFilters,
) => ["freshman-enrollees", userId, filters] as const

/** The Registrar's read-only list of freshmen who paid first, refreshed every 15 s. */
export function useFreshmanEnrolleesQuery(filters: FreshmanEnrolleeFilters) {
  const { session } = useAuth()
  const authorized =
    session?.role === "registrar_staff" || session?.role === "registrar_head"

  return useQuery({
    queryKey: freshmanEnrolleesQueryKey(session?.userId ?? null, filters),
    queryFn: ({ signal }) => listFreshmanEnrollees(filters, signal),
    placeholderData: keepPreviousForSameUser(session?.userId ?? null),
    enabled: authorized,
    refetchInterval: 15_000,
    refetchOnWindowFocus: "always",
  })
}
