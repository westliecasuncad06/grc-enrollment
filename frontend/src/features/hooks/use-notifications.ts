"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  getNotifications,
  markNotificationRead,
  type NotificationListOptions,
} from "@/features/services/notification-service"

export const notificationQueryKey = (options: NotificationListOptions) =>
  [
    "notifications",
    options.unread ?? false,
    options.page ?? 1,
    options.perPage ?? 20,
  ] as const

export function useNotificationsQuery(options: NotificationListOptions = {}) {
  return useQuery({
    queryKey: notificationQueryKey(options),
    queryFn: ({ signal }) => getNotifications(options, signal),
  })
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })
}
