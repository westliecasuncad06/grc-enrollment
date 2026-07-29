"use client"

import { Bell } from "lucide-react"
import { useState } from "react"

import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/features/components/ui/sheet"
import {
  useMarkNotificationReadMutation,
  useNotificationsQuery,
} from "@/features/hooks/use-notifications"

export function PortalNotificationSheet() {
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)
  const notificationsQuery = useNotificationsQuery({
    unread: unreadOnly,
    page,
  })
  const markReadMutation = useMarkNotificationReadMutation()
  const notifications = notificationsQuery.data?.data ?? []
  const unreadCount = notifications.filter(
    (notification) => notification.read_at === null,
  ).length

  function toggleUnreadOnly() {
    setUnreadOnly((current) => !current)
    setPage(1)
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="sr-only">{unreadCount} unread notifications</span>
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
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary">
              {unreadCount} {unreadCount === 1 ? "unread" : "unread"}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant={unreadOnly ? "default" : "outline"}
              onClick={toggleUnreadOnly}
            >
              Unread only
            </Button>
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
          {notifications.map((notification) => (
            <article key={notification.id} className="rounded-md border p-3">
              <p>{notification.message}</p>
              {notification.read_at === null ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={markReadMutation.isPending}
                  onClick={() => markReadMutation.mutate(notification.id)}
                >
                  Mark notification as read
                </Button>
              ) : (
                <span>Read</span>
              )}
            </article>
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
