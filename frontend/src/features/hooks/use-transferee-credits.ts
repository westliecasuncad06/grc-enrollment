"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import { keepPreviousForSameUser } from "@/features/lib/query-client"
import type {
  CreateTransfereeCreditInput,
  DecideTransfereeCreditInput,
  TransfereeCreditActionInput,
  TransfereeCreditFilters,
  UpdateTransfereeCreditInput,
} from "@/features/schemas/transferee-credit-schema"
import {
  actOnTransfereeCredit,
  createTransfereeCredit,
  decideTransfereeCredit,
  getTransfereeCreditSuggestions,
  listTransfereeCredits,
  updateTransfereeCredit,
} from "@/features/services/transferee-credit-service"

export const transfereeCreditsQueryKey = (
  userId: string | null,
  filters: TransfereeCreditFilters,
) => ["transferee-credits", userId, filters] as const

export const transfereeCreditSuggestionsQueryKey = (
  userId: string | null,
  creditId: number | null,
) => ["transferee-credit-suggestions", userId, creditId] as const

export function useTransfereeCreditsQuery(
  filters: TransfereeCreditFilters,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: transfereeCreditsQueryKey(session?.userId ?? null, filters),
    queryFn: ({ signal }) => listTransfereeCredits(filters, signal),
    placeholderData: keepPreviousForSameUser(session?.userId ?? null),
    enabled: enabled && session !== null,
  })
}

/** Suggested GRC subjects for one credit; fetched only while it is being reviewed. */
export function useTransfereeCreditSuggestionsQuery(
  creditId: number | null,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: transfereeCreditSuggestionsQueryKey(
      session?.userId ?? null,
      creditId,
    ),
    queryFn: ({ signal }) => getTransfereeCreditSuggestions(creditId!, signal),
    enabled: enabled && session !== null && creditId !== null,
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

/** The Program Chair's corrections and mapping of a pending credit. */
export function useUpdateTransfereeCreditMutation() {
  const invalidate = useInvalidateTransfereeCreditQueries()

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number
      input: UpdateTransfereeCreditInput
    }) => updateTransfereeCredit(id, input),
    onSuccess: () => invalidate(),
  })
}

/** Endorse / decline (Program Chair) or approve / reject (Registrar Staff). */
export function useTransfereeCreditActionMutation() {
  const invalidate = useInvalidateTransfereeCreditQueries()

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number
      input: TransfereeCreditActionInput
    }) => actOnTransfereeCredit(id, input),
    onSuccess: () => invalidate(),
  })
}

/** The Registrar's decision on an endorsed credit. */
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
