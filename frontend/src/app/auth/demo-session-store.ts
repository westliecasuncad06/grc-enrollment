import { z } from "zod"

import { demoRoles, type DemoSession } from "@/app/auth/demo-auth-types"

export const demoSessionStorageKey = "grc.demo-session.v1"

export interface SessionStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface SessionStoreResult {
  session: DemoSession | null
  storageAvailable: boolean
}

export interface DemoSessionPersistence {
  clear(): boolean
  read(): SessionStoreResult
  write(session: DemoSession): boolean
}

const demoSessionSchema = z
  .object({
    schemaVersion: z.literal("demo-v1"),
    userId: z.string().min(1),
    displayName: z.string().min(1),
    role: z.enum(demoRoles),
    signedInAt: z.iso.datetime(),
  })
  .strict()

function removeInvalidValue(storage: SessionStorageLike): boolean {
  try {
    storage.removeItem(demoSessionStorageKey)
    return true
  } catch {
    return false
  }
}

export function createDemoSessionStore(
  storage: SessionStorageLike | null,
): DemoSessionPersistence {
  return {
    clear() {
      if (!storage) {
        return false
      }

      return removeInvalidValue(storage)
    },

    read() {
      if (!storage) {
        return {
          session: null,
          storageAvailable: false,
        }
      }

      let serialized: string | null

      try {
        serialized = storage.getItem(demoSessionStorageKey)
      } catch {
        return {
          session: null,
          storageAvailable: false,
        }
      }

      if (serialized === null) {
        return {
          session: null,
          storageAvailable: true,
        }
      }

      try {
        const session = demoSessionSchema.parse(JSON.parse(serialized))

        return {
          session,
          storageAvailable: true,
        }
      } catch {
        return {
          session: null,
          storageAvailable: removeInvalidValue(storage),
        }
      }
    },

    write(session) {
      if (!storage) {
        return false
      }

      try {
        const validatedSession = demoSessionSchema.parse(session)
        storage.setItem(demoSessionStorageKey, JSON.stringify(validatedSession))
        return true
      } catch {
        return false
      }
    },
  }
}

export function createBrowserDemoSessionStore(): DemoSessionPersistence {
  try {
    return createDemoSessionStore(window.sessionStorage)
  } catch {
    return createDemoSessionStore(null)
  }
}
