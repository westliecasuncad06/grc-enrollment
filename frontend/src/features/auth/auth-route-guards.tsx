"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, type ReactNode } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { getSafeReturnPath } from "@/features/router/safe-return-path"

function SessionRestoreState() {
  return (
    <main className="grid min-h-svh place-items-center px-6">
      <p role="status" className="text-sm text-muted-foreground">
        Restoring your session…
      </p>
    </main>
  )
}

/**
 * Client-side navigation guard for the authenticated portal.
 *
 * This is deliberately NOT a security boundary — the bearer token lives in
 * `localStorage`, so Next.js middleware cannot read it and no server-side
 * check is possible (ADR 0013). Laravel Policies authorize every request;
 * this only avoids rendering a portal shell the API would reject anyway.
 *
 * Redirecting happens in an effect rather than during render, so a redirecting
 * pass returns `null` — matching react-router's `<Navigate>`, which also
 * rendered nothing.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { session, status } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const search = searchParams.toString()
  // Only append "?" when there is a query string — `/portal` must encode to
  // exactly "%2Fportal", never "%2Fportal%3F".
  const returnTo = search ? `${pathname}?${search}` : pathname
  const redirectTo =
    status === "anonymous" && !session
      ? `/login?returnTo=${encodeURIComponent(returnTo)}`
      : null

  useEffect(() => {
    if (redirectTo !== null) {
      router.replace(redirectTo)
    }
  }, [redirectTo, router])

  if (status === "restoring") {
    return <SessionRestoreState />
  }

  if (redirectTo !== null) {
    return null
  }

  return <>{children}</>
}

/** Keeps an already-authenticated user off the sign-in page. */
export function AnonymousOnly({ children }: { children: ReactNode }) {
  const { session, status } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const redirectTo =
    status !== "restoring" && session
      ? getSafeReturnPath(searchParams.get("returnTo"))
      : null

  useEffect(() => {
    if (redirectTo !== null) {
      router.replace(redirectTo)
    }
  }, [redirectTo, router])

  if (status === "restoring") {
    return <SessionRestoreState />
  }

  if (redirectTo !== null) {
    return null
  }

  return <>{children}</>
}
