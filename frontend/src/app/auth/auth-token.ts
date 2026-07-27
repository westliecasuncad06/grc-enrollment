/**
 * The ONLY module permitted to read, write, or remove the bearer token from
 * browser storage (PRD §9.1). Every other module must go through these
 * functions so the token has exactly one owner.
 *
 * Note this is `localStorage`, deliberately separate from the demo session's
 * `sessionStorage` in `demo-session-store.ts`: the two auth modes persist
 * different things, and each store has exactly one owning module.
 */

export const authTokenStorageKey = "grc.auth-token.v1"

export interface TokenStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface AuthTokenStore {
  clear(): void
  read(): string | null
  write(token: string): boolean
}

export function createAuthTokenStore(
  storage: TokenStorageLike | null,
): AuthTokenStore {
  return {
    clear() {
      if (!storage) {
        return
      }

      try {
        storage.removeItem(authTokenStorageKey)
      } catch {
        // A browser that refuses storage cannot retain a token anyway.
      }
    },

    read() {
      if (!storage) {
        return null
      }

      try {
        const token = storage.getItem(authTokenStorageKey)

        return token !== null && token.trim() !== "" ? token : null
      } catch {
        return null
      }
    },

    write(token) {
      if (!storage) {
        return false
      }

      try {
        storage.setItem(authTokenStorageKey, token)
        return true
      } catch {
        return false
      }
    },
  }
}

export function createBrowserAuthTokenStore(): AuthTokenStore {
  try {
    return createAuthTokenStore(window.localStorage)
  } catch {
    return createAuthTokenStore(null)
  }
}
