"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import type { QueueTicketFilters } from "@/features/schemas/queue-ticket-schema"
import {
  claimQueueTicket,
  listQueueTickets,
  updateQueueTicket,
} from "@/features/services/queue-ticket-service"

export const queueTicketsQueryKey = (
  userId: string | null,
  filters: QueueTicketFilters,
) => ["queue-tickets", userId, filters] as const

/**
 * Polls every 5s so the Cashier's own queue stays current without a
 * manual reload — this hook drives `nowServing`/`waiting`/`servedToday`
 * directly in `AccountingPaymentWorkspace`, unlike `useEnrollmentsListQuery`
 * on the same screen, which only enriches ticket rows with payment data
 * (see that hook's own JSDoc). Matches the interval already used for the
 * schedule-proposals queue, the notification bell, and
 * `useEnrollmentsListQuery` (see
 * docs/superpowers/specs/2026-08-03-realtime-schedule-refresh-design.md and
 * docs/superpowers/specs/2026-08-05-realtime-enrollment-queue-refresh-design.md).
 * Refetches immediately on window focus. TanStack Query pauses polling in
 * hidden tabs by default (`refetchIntervalInBackground` is not set).
 */
export function useQueueTicketsQuery(
  filters: QueueTicketFilters,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: queueTicketsQueryKey(session?.userId ?? null, filters),
    queryFn: ({ signal }) => listQueueTickets(filters, signal),
    enabled: enabled && session !== null,
    refetchInterval: 5_000,
    refetchOnWindowFocus: "always",
  })
}

export function useUpdateQueueTicketMutation() {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: number
      action: "serve" | "complete" | "skip" | "mark_priority"
    }) => updateQueueTicket(id, { action }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["queue-tickets", session?.userId ?? null],
      }),
  })
}

export function useClaimQueueTicketMutation() {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (studentNumber?: string) => claimQueueTicket(studentNumber),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["queue-tickets", session?.userId ?? null],
      })
      void queryClient.invalidateQueries({
        queryKey: ["cashier-payment-candidate", session?.userId ?? null],
      })
    },
  })
}
