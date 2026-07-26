import { describe, expect, it } from "vitest"

import type { DemoSession } from "@/app/auth/demo-auth-types"
import {
  createDemoSessionStore,
  demoSessionStorageKey,
  type SessionStorageLike,
} from "@/app/auth/demo-session-store"

const validSession: DemoSession = {
  schemaVersion: "demo-v1",
  userId: "demo-student",
  displayName: "Demo Student",
  role: "student",
  signedInAt: "2026-07-26T12:00:00.000Z",
}

function createMemoryStorage(initialValue?: string): SessionStorageLike & {
  has(key: string): boolean
} {
  const values = new Map<string, string>()

  if (initialValue !== undefined) {
    values.set(demoSessionStorageKey, initialValue)
  }

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
    has: (key) => values.has(key),
  }
}

describe("createDemoSessionStore", () => {
  it("writes and restores only the validated non-credential session", () => {
    const storage = createMemoryStorage()
    const store = createDemoSessionStore(storage)

    expect(store.write(validSession)).toBe(true)
    expect(store.read()).toEqual({
      session: validSession,
      storageAvailable: true,
    })

    const serialized = storage.getItem(demoSessionStorageKey)
    expect(serialized).not.toContain("student.demo@grc.test")
    expect(serialized).not.toContain("GRC-Demo-Only!2026")
    expect(serialized).not.toContain("password")
  })

  it.each([
    "{not-json",
    JSON.stringify({ ...validSession, schemaVersion: "demo-v2" }),
    JSON.stringify({ ...validSession, role: "super_admin" }),
    JSON.stringify({ ...validSession, displayName: undefined }),
  ])("removes invalid persisted data", (serialized) => {
    const storage = createMemoryStorage(serialized)
    const store = createDemoSessionStore(storage)

    expect(store.read()).toEqual({
      session: null,
      storageAvailable: true,
    })
    expect(storage.has(demoSessionStorageKey)).toBe(false)
  })

  it("clears a persisted session", () => {
    const storage = createMemoryStorage(JSON.stringify(validSession))
    const store = createDemoSessionStore(storage)

    expect(store.clear()).toBe(true)
    expect(storage.has(demoSessionStorageKey)).toBe(false)
  })

  it("reports unavailable storage without exposing its exception", () => {
    const unavailableStorage: SessionStorageLike = {
      getItem: () => {
        throw new Error("private browser detail")
      },
      setItem: () => {
        throw new Error("private browser detail")
      },
      removeItem: () => {
        throw new Error("private browser detail")
      },
    }
    const store = createDemoSessionStore(unavailableStorage)

    expect(store.read()).toEqual({
      session: null,
      storageAvailable: false,
    })
    expect(store.write(validSession)).toBe(false)
    expect(store.clear()).toBe(false)
  })

  it("treats an absent browser store as unavailable", () => {
    const store = createDemoSessionStore(null)

    expect(store.read()).toEqual({
      session: null,
      storageAvailable: false,
    })
    expect(store.write(validSession)).toBe(false)
  })
})
