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
} from "@/app/auth/auth-context-value"
import type { AuthMode } from "@/app/auth/demo-auth-mode"
import { DemoAuthError } from "@/app/auth/demo-auth-gateway"
import type {
  DemoAuthGateway,
  DemoCredentials,
  DemoSession,
} from "@/app/auth/demo-auth-types"
import type { DemoSessionPersistence } from "@/app/auth/demo-session-store"

interface AuthProviderProps {
  authMode: AuthMode
  children: ReactNode
  gateway: DemoAuthGateway
  sessionStore: DemoSessionPersistence
}

export function AuthProvider({
  authMode,
  children,
  gateway,
  sessionStore,
}: AuthProviderProps) {
  const [session, setSession] = useState<DemoSession | null>(null)
  const [status, setStatus] = useState<AuthContextValue["status"]>("restoring")
  const [storageAvailable, setStorageAvailable] = useState(true)

  useEffect(() => {
    let active = true

    queueMicrotask(() => {
      if (!active) {
        return
      }

      if (authMode === "disabled") {
        setSession(null)
        setStorageAvailable(sessionStore.clear())
        setStatus("anonymous")
        return
      }

      const restored = sessionStore.read()
      setSession(restored.session)
      setStorageAvailable(restored.storageAvailable)
      setStatus(restored.session ? "authenticated" : "anonymous")
    })

    return () => {
      active = false
    }
  }, [authMode, sessionStore])

  const signIn = useCallback(
    async (credentials: DemoCredentials) => {
      if (authMode !== "demo") {
        throw new DemoAuthError("DEMO_AUTH_DISABLED")
      }

      const authenticatedSession = await gateway.signIn(credentials)
      const persisted = sessionStore.write(authenticatedSession)

      setSession(authenticatedSession)
      setStorageAvailable(persisted)
      setStatus("authenticated")
    },
    [authMode, gateway, sessionStore],
  )

  const signOut = useCallback(() => {
    const cleared = sessionStore.clear()

    setSession(null)
    setStorageAvailable(cleared)
    setStatus("anonymous")
  }, [sessionStore])

  const value = useMemo<AuthContextValue>(
    () => ({
      authMode,
      session,
      signIn,
      signOut,
      status,
      storageAvailable,
    }),
    [authMode, session, signIn, signOut, status, storageAvailable],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
