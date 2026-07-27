import { Navigate, Outlet, useLocation } from "react-router"

import { useAuth } from "@/app/auth/use-auth"
import { getSafeReturnPath } from "@/app/router/safe-return-path"

function SessionRestoreState() {
  return (
    <main className="grid min-h-svh place-items-center px-6">
      <p role="status" className="text-sm text-muted-foreground">
        Restoring your session…
      </p>
    </main>
  )
}

export function RequireDemoSession() {
  const { session, status } = useAuth()
  const location = useLocation()

  if (status === "restoring") {
    return <SessionRestoreState />
  }

  if (!session) {
    const returnTo = encodeURIComponent(
      `${location.pathname}${location.search}`,
    )

    return <Navigate to={`/login?returnTo=${returnTo}`} replace />
  }

  return <Outlet />
}

export function AnonymousOnlyRoute() {
  const { session, status } = useAuth()
  const location = useLocation()

  if (status === "restoring") {
    return <SessionRestoreState />
  }

  if (session) {
    const returnTo = new URLSearchParams(location.search).get("returnTo")

    return <Navigate to={getSafeReturnPath(returnTo)} replace />
  }

  return <Outlet />
}
