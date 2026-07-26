import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { AuthProvider } from "@/app/auth/auth-context"
import { createDemoAuthGateway } from "@/app/auth/demo-auth-gateway"
import type { DemoSession } from "@/app/auth/demo-auth-types"
import {
  createDemoSessionStore,
  demoSessionStorageKey,
  type SessionStorageLike,
} from "@/app/auth/demo-session-store"
import { demoUsers, sharedDemoPassword } from "@/app/auth/demo-users"
import { useAuth } from "@/app/auth/use-auth"

const validSession: DemoSession = {
  schemaVersion: "demo-v1",
  userId: "demo-student",
  displayName: "Demo Student",
  role: "student",
  signedInAt: "2026-07-26T12:00:00.000Z",
}

function createMemoryStorage(): SessionStorageLike {
  const values = new Map<string, string>()

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
}

function AuthProbe() {
  const { session, signIn, signOut, status, storageAvailable } = useAuth()

  return (
    <>
      <output aria-label="auth state">
        {status}:{session?.displayName ?? "none"}:
        {storageAvailable ? "persistence-on" : "persistence-off"}
      </output>
      <button
        type="button"
        onClick={() =>
          void signIn({
            email: demoUsers[0].email,
            password: sharedDemoPassword,
          })
        }
      >
        Sign in
      </button>
      <button type="button" onClick={signOut}>
        Sign out
      </button>
    </>
  )
}

describe("AuthProvider", () => {
  const gateway = createDemoAuthGateway(demoUsers)

  it("restores a validated demo session", async () => {
    const store = createDemoSessionStore(createMemoryStorage())
    store.write(validSession)

    render(
      <AuthProvider authMode="demo" gateway={gateway} sessionStore={store}>
        <AuthProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByLabelText("auth state")).toHaveTextContent(
        "authenticated:Demo Student:persistence-on",
      )
    })
  })

  it("keeps a successful sign-in in memory when persistence fails", async () => {
    const unavailableOnWrite: SessionStorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("browser storage unavailable")
      },
      removeItem: () => undefined,
    }
    const user = userEvent.setup()

    render(
      <AuthProvider
        authMode="demo"
        gateway={gateway}
        sessionStore={createDemoSessionStore(unavailableOnWrite)}
      >
        <AuthProbe />
      </AuthProvider>,
    )

    await user.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => {
      expect(screen.getByLabelText("auth state")).toHaveTextContent(
        "authenticated:Demo Student:persistence-off",
      )
    })
  })

  it("clears the persisted and in-memory session on sign-out", async () => {
    const storage = createMemoryStorage()
    const store = createDemoSessionStore(storage)
    store.write(validSession)
    const user = userEvent.setup()

    render(
      <AuthProvider authMode="demo" gateway={gateway} sessionStore={store}>
        <AuthProbe />
      </AuthProvider>,
    )

    await screen.findByText(/authenticated:Demo Student/)
    await user.click(screen.getByRole("button", { name: "Sign out" }))

    expect(screen.getByLabelText("auth state")).toHaveTextContent(
      "anonymous:none:persistence-on",
    )
    expect(storage.getItem(demoSessionStorageKey)).toBeNull()
  })

  it("rejects a persisted demo session when demo mode is disabled", async () => {
    const storage = createMemoryStorage()
    const store = createDemoSessionStore(storage)
    store.write(validSession)

    render(
      <AuthProvider authMode="disabled" gateway={gateway} sessionStore={store}>
        <AuthProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByLabelText("auth state")).toHaveTextContent(
        "anonymous:none:persistence-on",
      )
    })
    expect(storage.getItem(demoSessionStorageKey)).toBeNull()
  })
})
