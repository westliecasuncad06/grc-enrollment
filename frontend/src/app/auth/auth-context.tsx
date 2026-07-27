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

    if (authMode !== "disabled" && gateway.persistsSessions === true) {
      // The gateway owns persistence (API mode): restoring requires a network
      // round-trip, so it cannot use the synchronous session-store path.
      const restore = gateway.restore?.() ?? Promise.resolve(null)

      restore.then(
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
    }

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
  }, [authMode, gateway, sessionStore])

  const signIn = useCallback(
    async (credentials: DemoCredentials) => {
      if (authMode === "disabled") {
        throw new DemoAuthError("DEMO_AUTH_DISABLED")
      }

      const authenticatedSession = await gateway.signIn(credentials)

      if (gateway.persistsSessions === true) {
        setStorageAvailable(gateway.persistenceAvailable?.() ?? true)
      } else {
        setStorageAvailable(sessionStore.write(authenticatedSession))
      }

      setSession(authenticatedSession)
      setStatus("authenticated")
    },
    [authMode, gateway, sessionStore],
  )

  const signOut = useCallback(() => {
    if (gateway.persistsSessions === true) {
      // Revoke server-side, but clear locally without waiting: a failed or
      // slow revoke must never leave the user stuck in a signed-in UI.
      void gateway.signOut?.()
    } else {
      setStorageAvailable(sessionStore.clear())
    }

    setSession(null)
    setStatus("anonymous")
  }, [gateway, sessionStore])

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
