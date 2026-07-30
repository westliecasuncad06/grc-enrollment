"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import type { QueueTicketFilters } from "@/features/schemas/queue-ticket-schema"
import {
  listQueueTickets,
  updateQueueTicket,
} from "@/features/services/queue-ticket-service"

export const queueTicketsQueryKey = (
  userId: string | null,
  filters: QueueTicketFilters,
) => ["queue-tickets", userId, filters] as const

export function useQueueTicketsQuery(
  filters: QueueTicketFilters,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: queueTicketsQueryKey(session?.userId ?? null, filters),
    queryFn: ({ signal }) => listQueueTickets(filters, signal),
    enabled: enabled && session !== null,
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
      action: "serve" | "complete"
    }) => updateQueueTicket(id, { action }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["queue-tickets", session?.userId ?? null],
      }),
  })
}
