import type { UserRole } from "@/features/auth/roles"

export interface AuthSession {
  userId: string
  displayName: string
  role: UserRole
  signedInAt: string
}

export interface Credentials {
  email: string
  password: string
}

/**
 * The authentication gateway. One implementation exists — `api-auth-gateway`,
 * which talks to Laravel with Sanctum bearer tokens.
 *
 * The gateway owns persistence entirely: it writes the token through an
 * injected `AuthTokenStore` and rebuilds the session from the server on reload.
 * `AuthProvider` never touches storage itself.
 */
export interface AuthGateway {
  signIn(credentials: Credentials): Promise<AuthSession>

  /** Rebuilds the session from the stored token on page load. */
  restore(): Promise<AuthSession | null>

  /** Revokes the session server-side. Failures must not block local sign-out. */
  signOut(): Promise<void>

  /**
   * Whether the last session actually persisted (browser storage can be
   * disabled or full). Drives the "cannot be restored after refresh" warning.
   */
  persistenceAvailable(): boolean
}
