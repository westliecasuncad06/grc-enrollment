"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  AuthContext,
  type AuthContextValue,
} from "@/features/auth/auth-context-value"
import type {
  AuthGateway,
  AuthSession,
  Credentials,
} from "@/features/auth/auth-types"
import { setUnauthorizedHandler } from "@/features/services/api-client"

interface AuthProviderProps {
  children: ReactNode
  gateway: AuthGateway
}

export function AuthProvider({ children, gateway }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [status, setStatus] = useState<AuthContextValue["status"]>("restoring")
  const [storageAvailable, setStorageAvailable] = useState(true)

  useEffect(() => {
    let active = true

    // Restoring requires a network round-trip to `GET /auth/me`, so the first
    // render is always "restoring". That is also what keeps hydration safe:
    // the server-rendered markup and the first client render agree, and the
    // real session only lands on a subsequent render.
    gateway.restore().then(
      (restored) => {
        if (!active) {
          return
        }

        setSession(restored)
        setStatus(restored ? "authenticated" : "anonymous")
      },
      () => {
        if (active) {
          setSession(null)
          setStatus("anonymous")
        }
      },
    )

    return () => {
      active = false
    }
  }, [gateway])

  useEffect(() => {
    // A 401 on an authenticated request means the stored token is already
    // invalid — clear it locally (no revoke round-trip; that would just 401
    // again) and drop to "anonymous" so `RequireSession` performs its normal
    // redirect, instead of leaving a stale authenticated view rendered over a
    // cleared token.
    setUnauthorizedHandler(() => {
      gateway.clearSession()
      setSession(null)
      setStatus("anonymous")
    })
  }, [gateway])

  const signIn = useCallback(
    async (credentials: Credentials) => {
      const authenticatedSession = await gateway.signIn(credentials)

      setStorageAvailable(gateway.persistenceAvailable())
      setSession(authenticatedSession)
      setStatus("authenticated")
    },
    [gateway],
  )

  const signOut = useCallback(() => {
    // Revoke server-side, but clear locally without waiting: a failed or slow
    // revoke must never leave the user stuck in a signed-in UI. The rejection
    // is swallowed deliberately — without it a failed revoke surfaces as an
    // unhandled promise rejection in the browser console.
    void gateway.signOut().catch(() => undefined)

    setSession(null)
    setStatus("anonymous")
  }, [gateway])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      signIn,
      signOut,
      status,
      storageAvailable,
    }),
    [session, signIn, signOut, status, storageAvailable],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
