"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import {
  getNotifications,
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

export function useNotificationsQuery(options: NotificationListOptions = {}) {
  const { session } = useAuth()

  return useQuery({
    queryKey: notificationQueryKey(options, session?.userId ?? null),
    queryFn: ({ signal }) => getNotifications(options, signal),
    enabled: session !== null,
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
