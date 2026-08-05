"use client"

import { Bell, CheckCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/features/components/ui/sheet"
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
  useUnreadNotificationCountQuery,
} from "@/features/hooks/use-notifications"
import {
  notificationDestinationPath,
  notificationPresentation,
  type NotificationTone,
} from "@/features/lib/notification-presentation"
import type { Notification } from "@/features/schemas/notification-schema"

const TONE_TEXT_CLASS: Record<NotificationTone, string> = {
  neutral: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
}

function dayGroupLabel(createdAt: string | null): string {
  if (!createdAt) return "Earlier"
  const date = new Date(createdAt)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return "Today"
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function groupByDay(
  notifications: readonly Notification[],
): ReadonlyMap<string, readonly Notification[]> {
  const groups = new Map<string, Notification[]>()

  for (const notification of notifications) {
    const label = dayGroupLabel(notification.created_at)
    groups.set(label, [...(groups.get(label) ?? []), notification])
  }

  return groups
}

function NotificationItem({
  notification,
  destination,
  onNavigate,
  onMarkRead,
  markReadPending,
}: {
  notification: Notification
  destination: string | null
  onNavigate: (path: string) => void
  onMarkRead: (id: number) => void
  markReadPending: boolean
}) {
  const presentation = notificationPresentation(notification.notification_type)
  const Icon = presentation.icon
  const isUnread = notification.read_at === null
  const body = (
    <div className="flex items-start gap-3">
      <Icon
        className={`mt-0.5 size-4 shrink-0 ${TONE_TEXT_CLASS[presentation.tone]}`}
        aria-hidden="true"
      />
      <div className="grid min-w-0 flex-1 gap-1 text-left">
        <p className={isUnread ? "font-medium" : undefined}>
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground">
          {notification.created_at
            ? new Date(notification.created_at).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })
            : null}
        </p>
      </div>
      {isUnread && (
        <span
          aria-hidden="true"
          className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
        />
      )}
    </div>
  )

  const className = `w-full rounded-md border p-3 ${isUnread ? "border-l-2 border-l-primary" : ""}`

  if (destination) {
    return (
      <SheetClose asChild>
        <button
          type="button"
          className={`${className} text-left transition-colors hover:bg-muted`}
          onClick={() => {
            if (isUnread) onMarkRead(notification.id)
            onNavigate(destination)
          }}
        >
          {body}
        </button>
      </SheetClose>
    )
  }

  return (
    <article className={className}>
      {body}
      {isUnread && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2"
          disabled={markReadPending}
          onClick={() => onMarkRead(notification.id)}
        >
          Mark notification as read
        </Button>
      )}
    </article>
  )
}

export function PortalNotificationSheet() {
  const { session } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)
  const notificationsQuery = useNotificationsQuery(
    {
      unread: unreadOnly,
      page,
    },
    open,
  )
  const unreadCountQuery = useUnreadNotificationCountQuery()
  const markReadMutation = useMarkNotificationReadMutation()
  const markAllReadMutation = useMarkAllNotificationsReadMutation()
  const notifications = notificationsQuery.data?.data ?? []
  const unreadTotal = unreadCountQuery.data ?? 0
  const groups = groupByDay(notifications)

  function toggleUnreadOnly() {
    setUnreadOnly((current) => !current)
    setPage(1)
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={
            unreadTotal > 0
              ? `Notifications, ${unreadTotal} unread`
              : "Notifications"
          }
          title="Notifications"
          className="relative"
        >
          <Bell aria-hidden="true" />
          {unreadTotal > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground"
            >
              {unreadTotal > 9 ? "9+" : unreadTotal}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            Your private schedule and workflow updates.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="secondary">
              {unreadTotal} {unreadTotal === 1 ? "unread" : "unread"}
            </Badge>
            <div className="flex flex-wrap gap-2">
              {unreadTotal > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={markAllReadMutation.isPending}
                  onClick={() => markAllReadMutation.mutate()}
                >
                  <CheckCheck data-icon="inline-start" aria-hidden="true" />
                  Mark all as read
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant={unreadOnly ? "default" : "outline"}
                onClick={toggleUnreadOnly}
              >
                Unread only
              </Button>
            </div>
          </div>

          {notificationsQuery.isPending && <p>Loading notifications…</p>}
          {notificationsQuery.isError && (
            <Alert>
              <AlertDescription>
                Notifications are unavailable right now.
              </AlertDescription>
            </Alert>
          )}
          {notificationsQuery.data && notifications.length === 0 && (
            <p>No notifications to show.</p>
          )}
          {[...groups.entries()].map(([label, items]) => (
            <div key={label} className="grid gap-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
              </p>
              <div className="grid gap-2">
                {items.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    destination={
                      session
                        ? notificationDestinationPath(
                            notification.notification_type,
                            session.role,
                          )
                        : null
                    }
                    onNavigate={(path) => router.push(path)}
                    onMarkRead={(id) => markReadMutation.mutate(id)}
                    markReadPending={markReadMutation.isPending}
                  />
                ))}
              </div>
            </div>
          ))}

          {notificationsQuery.data &&
            notificationsQuery.data.meta.last_page > 1 && (
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous notifications page
                </Button>
                <span>
                  Page {notificationsQuery.data.meta.current_page} of{" "}
                  {notificationsQuery.data.meta.last_page}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={page >= notificationsQuery.data.meta.last_page}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next notifications page
                </Button>
              </div>
            )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
