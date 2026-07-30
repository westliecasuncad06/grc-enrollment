"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import type {
  CreateTransfereeCreditInput,
  DecideTransfereeCreditInput,
  TransfereeCreditFilters,
} from "@/features/schemas/transferee-credit-schema"
import {
  createTransfereeCredit,
  decideTransfereeCredit,
  listTransfereeCredits,
} from "@/features/services/transferee-credit-service"

export const transfereeCreditsQueryKey = (
  userId: string | null,
  filters: TransfereeCreditFilters,
) => ["transferee-credits", userId, filters] as const

export function useTransfereeCreditsQuery(
  filters: TransfereeCreditFilters,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: transfereeCreditsQueryKey(session?.userId ?? null, filters),
    queryFn: ({ signal }) => listTransfereeCredits(filters, signal),
    enabled: enabled && session !== null,
  })
}

function useInvalidateTransfereeCreditQueries() {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  return () =>
    queryClient.invalidateQueries({
      queryKey: ["transferee-credits", session?.userId ?? null],
    })
}

export function useCreateTransfereeCreditMutation() {
  const invalidate = useInvalidateTransfereeCreditQueries()

  return useMutation({
    mutationFn: (input: CreateTransfereeCreditInput) =>
      createTransfereeCredit(input),
    onSuccess: () => invalidate(),
  })
}

export function useDecideTransfereeCreditMutation() {
  const invalidate = useInvalidateTransfereeCreditQueries()

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number
      input: DecideTransfereeCreditInput
    }) => decideTransfereeCredit(id, input),
    onSuccess: () => invalidate(),
  })
}
