import { createContext } from "react"

import type { AuthMode } from "@/app/auth/demo-auth-mode"
import type { DemoCredentials, DemoSession } from "@/app/auth/demo-auth-types"

export interface AuthContextValue {
  authMode: AuthMode
  session: DemoSession | null
  storageAvailable: boolean
  status: "restoring" | "anonymous" | "authenticated"
  signIn: (credentials: DemoCredentials) => Promise<void>
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
