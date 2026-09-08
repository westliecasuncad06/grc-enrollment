"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationListOptions,
} from "@/features/services/notification-service"

export const notificationQueryKey = (
  options: NotificationListOptions,
  userId: string | null,
) =>
  [
    "notifications",
    userId,
    options.unread ?? false,
    options.page ?? 1,
    options.perPage ?? 20,
  ] as const

export function useNotificationsQuery(
  options: NotificationListOptions = {},
  open = false,
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: notificationQueryKey(options, session?.userId ?? null),
    queryFn: ({ signal }) => getNotifications(options, signal),
    enabled: session !== null && open,
    refetchInterval: 5_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  })
}

const UNREAD_COUNT_OPTIONS: NotificationListOptions = {
  unread: true,
  page: 1,
  perPage: 1,
}

/**
 * The true unread total (`meta.total`), not a count of the current page's
 * items — the sheet previously derived its "N unread" figure by filtering
 * whichever page was loaded, which undercounted as soon as there was more
 * than one page. This is one of the targeted workflow queries that polls: the
 * bell is where a user expects to learn about another role's action without
 * manually revisiting the page.
 */
export function useUnreadNotificationCountQuery() {
  const { session } = useAuth()

  return useQuery({
    queryKey: notificationQueryKey(UNREAD_COUNT_OPTIONS, session?.userId ?? null),
    queryFn: ({ signal }) => getNotifications(UNREAD_COUNT_OPTIONS, signal),
    enabled: session !== null,
    refetchInterval: 5_000,
    refetchOnWindowFocus: "always",
    select: (envelope) => envelope.meta.total,
  })
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["notifications", session?.userId ?? null],
      }),
  })
}

/**
 * Calls the bulk read-all endpoint in one request and optimistically
 * clears unread notification counts and badges immediately.
 */
export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.setQueriesData(
        { queryKey: ["notifications", session?.userId ?? null] },
        (old: unknown) => {
          if (!old || typeof old !== "object") return old
          const envelope = old as { meta?: { total?: number }; data?: Array<{ read_at: string | null }> }
          if (envelope.meta) {
            return {
              ...envelope,
              meta: { ...envelope.meta, total: 0 },
              data: envelope.data
                ? envelope.data.map((n) => ({
                    ...n,
                    read_at: n.read_at ?? new Date().toISOString(),
                  }))
                : [],
            }
          }
          return old
        },
      )
      void queryClient.invalidateQueries({
        queryKey: ["notifications", session?.userId ?? null],
      })
    },
  })
}
