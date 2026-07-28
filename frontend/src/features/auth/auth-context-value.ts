import { createContext } from "react"

import type { AuthSession, Credentials } from "@/features/auth/auth-types"

export interface AuthContextValue {
  session: AuthSession | null
  storageAvailable: boolean
  status: "restoring" | "anonymous" | "authenticated"
  signIn: (credentials: Credentials) => Promise<void>
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
