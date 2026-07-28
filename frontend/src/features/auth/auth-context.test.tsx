import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AuthProvider } from "@/features/auth/auth-context"
import type { AuthGateway, AuthSession } from "@/features/auth/auth-types"
import { useAuth } from "@/features/auth/use-auth"

const validSession: AuthSession = {
  userId: "1",
  displayName: "Test Student",
  role: "student",
  signedInAt: "2026-07-26T12:00:00.000Z",
}

function createGateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    signIn: () => Promise.resolve(validSession),
    restore: () => Promise.resolve(null),
    signOut: () => Promise.resolve(),
    persistenceAvailable: () => true,
    ...overrides,
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
          void signIn({ email: "student.seed@grc.test", password: "secret" })
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

function renderProvider(gateway: AuthGateway) {
  return render(
    <AuthProvider gateway={gateway}>
      <AuthProbe />
    </AuthProvider>,
  )
}

describe("AuthProvider", () => {
  it("restores a session the gateway rebuilds from the stored token", async () => {
    renderProvider(
      createGateway({ restore: () => Promise.resolve(validSession) }),
    )

    await waitFor(() => {
      expect(screen.getByLabelText("auth state")).toHaveTextContent(
        "authenticated:Test Student:persistence-on",
      )
    })
  })

  it("settles as anonymous when there is nothing to restore", async () => {
    renderProvider(createGateway())

    await waitFor(() => {
      expect(screen.getByLabelText("auth state")).toHaveTextContent(
        "anonymous:none:persistence-on",
      )
    })
  })

  it("settles as anonymous when restoring fails outright", async () => {
    renderProvider(
      createGateway({
        restore: () => Promise.reject(new Error("network down")),
      }),
    )

    await waitFor(() => {
      expect(screen.getByLabelText("auth state")).toHaveTextContent(
        "anonymous:none:persistence-on",
      )
    })
  })

  it("keeps a successful sign-in in memory when the token cannot persist", async () => {
    const user = userEvent.setup()
    renderProvider(createGateway({ persistenceAvailable: () => false }))

    await user.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => {
      expect(screen.getByLabelText("auth state")).toHaveTextContent(
        "authenticated:Test Student:persistence-off",
      )
    })
  })

  it("clears the session on sign-out and revokes it server-side", async () => {
    const signOut = vi.fn(() => Promise.resolve())
    const user = userEvent.setup()
    renderProvider(
      createGateway({
        restore: () => Promise.resolve(validSession),
        signOut,
      }),
    )

    await screen.findByText(/authenticated:Test Student/)
    await user.click(screen.getByRole("button", { name: "Sign out" }))

    expect(screen.getByLabelText("auth state")).toHaveTextContent(
      "anonymous:none:persistence-on",
    )
    expect(signOut).toHaveBeenCalled()
  })

  it("signs out locally even when the server-side revoke rejects", async () => {
    const user = userEvent.setup()
    renderProvider(
      createGateway({
        restore: () => Promise.resolve(validSession),
        signOut: () => Promise.reject(new Error("revoke failed")),
      }),
    )

    await screen.findByText(/authenticated:Test Student/)
    await user.click(screen.getByRole("button", { name: "Sign out" }))

    expect(screen.getByLabelText("auth state")).toHaveTextContent(
      "anonymous:none:persistence-on",
    )
  })
})
