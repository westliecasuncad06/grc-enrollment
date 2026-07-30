import { AuthError } from "@/features/auth/auth-error"
import type { AuthTokenStore } from "@/features/auth/auth-token"
import type {
  AuthGateway,
  AuthSession,
  Credentials,
} from "@/features/auth/auth-types"
import type { AuthenticatedUser } from "@/features/schemas/auth-schema"
import { isApiClientError } from "@/features/services/api-client"
import {
  fetchCurrentUser,
  login,
  logout,
  type AuthSessionPayload,
} from "@/features/services/auth-service"

function toSession(
  user: AuthenticatedUser,
  signedInAt: string = new Date().toISOString(),
): AuthSession {
  return {
    userId: String(user.id),
    displayName: user.name,
    role: user.role,
    signedInAt,
  }
}

/**
 * Authenticates against the real Laravel API with Sanctum bearer tokens.
 *
 * The token is owned exclusively by the injected `AuthTokenStore`
 * (`auth-token.ts`); this gateway never touches browser storage directly.
 */
export function createApiAuthGateway(tokenStore: AuthTokenStore): AuthGateway {
  let lastWriteSucceeded = true

  return {
    async signIn(credentials: Credentials): Promise<AuthSession> {
      let payload: AuthSessionPayload

      try {
        payload = await login({
          email: credentials.email.trim().toLowerCase(),
          password: credentials.password,
        })
      } catch (cause) {
        // A rejected credential must read the same to the user regardless of
        // whether the account was missing, wrong, or disabled — the API
        // already returns one generic 401 for all three.
        if (isApiClientError(cause) && cause.status === 401) {
          throw new AuthError("INVALID_CREDENTIALS")
        }

        throw cause
      }

      lastWriteSucceeded = tokenStore.write(payload.token)

      return toSession(payload.user)
    },

    persistenceAvailable(): boolean {
      return lastWriteSucceeded
    },

    async restore(): Promise<AuthSession | null> {
      if (tokenStore.read() === null) {
        return null
      }

      try {
        return toSession(await fetchCurrentUser())
      } catch {
        // An expired, revoked, or unverifiable token yields no session. The
        // 401 handler in api-client has already cleared it.
        tokenStore.clear()

        return null
      }
    },

    async signOut(): Promise<void> {
      try {
        await logout()
      } catch {
        // The local session is cleared regardless; a failed revoke must not
        // strand the user in a signed-in UI.
      } finally {
        tokenStore.clear()
      }
    },

    clearSession(): void {
      tokenStore.clear()
    },
  }
}
