import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { AuthError } from "@/features/auth/auth-error"
import type { AuthSession } from "@/features/auth/auth-types"
import { LoginPage } from "@/features/components/pages/login-page"
import { routerMock } from "@/tests/navigation-mock"
import { createStubGateway, renderWithAuthProvider } from "@/tests/render-app"

const studentSession: AuthSession = {
  userId: "1",
  displayName: "Test Student",
  role: "student",
  signedInAt: "2026-07-26T12:00:00.000Z",
}

function renderLogin(route = "/login", gateway = createStubGateway()) {
  return renderWithAuthProvider(<LoginPage />, { route, gateway })
}

async function enterCredentials(
  user: ReturnType<typeof userEvent.setup>,
  email = "student.seed@grc.test",
  password = "a-correct-password",
) {
  await user.type(await screen.findByLabelText("Email address"), email)
  await user.type(screen.getByLabelText("Password"), password)
}

describe("LoginPage", () => {
  it("renders an accessible institutional form without unimplemented account actions", async () => {
    renderLogin()

    expect(
      await screen.findByRole("heading", { name: "Sign in to your portal" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Email address")).toHaveAttribute(
      "autocomplete",
      "username",
    )
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "current-password",
    )
    expect(
      screen.getByText("docs/testing/SEEDED_IDENTITIES.md"),
    ).toBeInTheDocument()
    expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/register|create account/i),
    ).not.toBeInTheDocument()
  })

  it("carries no demo-credential disclaimer now that demo mode is gone", async () => {
    renderLogin()

    await screen.findByRole("heading", { name: "Sign in to your portal" })
    expect(
      screen.queryByText("Interface demonstration—not real authentication"),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("docs/testing/DEMO_CREDENTIALS.md"),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText("Email address")).toBeEnabled()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled()
  })

  it("focuses a summary and identifies invalid fields", async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.click(await screen.findByRole("button", { name: "Sign in" }))

    const summary = await screen.findByRole("alert", { name: "Sign-in errors" })
    expect(summary).toHaveFocus()
    expect(screen.getByLabelText("Email address")).toHaveAttribute(
      "aria-invalid",
      "true",
    )
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "aria-invalid",
      "true",
    )
  })

  it("uses an action-labeled password visibility control", async () => {
    const user = userEvent.setup()
    renderLogin()

    const password = await screen.findByLabelText("Password")
    expect(password).toHaveAttribute("type", "password")

    await user.click(screen.getByRole("button", { name: "Show password" }))
    expect(password).toHaveAttribute("type", "text")

    await user.click(screen.getByRole("button", { name: "Hide password" }))
    expect(password).toHaveAttribute("type", "password")
  })

  it("shows one generic credential error, retains email, and clears password", async () => {
    const user = userEvent.setup()
    renderLogin(
      "/login",
      createStubGateway({
        signIn: () => Promise.reject(new AuthError("INVALID_CREDENTIALS")),
      }),
    )
    await enterCredentials(user, "student.seed@grc.test", "incorrect-password")

    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(
      await screen.findByText(
        "The email or password you entered was not recognized.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Email address")).toHaveValue(
      "student.seed@grc.test",
    )
    expect(screen.getByLabelText("Password")).toHaveValue("")
    expect(document.body).not.toHaveTextContent("incorrect-password")
  })

  it("directs an authenticated kiosk identity to the queue device portal", async () => {
    const user = userEvent.setup()
    renderLogin(
      "/login",
      createStubGateway({
        signIn: () =>
          Promise.reject(new AuthError("QUEUE_KIOSK_REQUIRES_DEVICE_PORTAL")),
      }),
    )
    await enterCredentials(user)

    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(
      await screen.findByRole("link", { name: /queue kiosk/i }),
    ).toHaveAttribute("href", "/queue")
    expect(
      screen.queryByText(
        "The email or password you entered was not recognized.",
      ),
    ).not.toBeInTheDocument()
  })

  it("reports an unexpected failure with the same generic message", async () => {
    const user = userEvent.setup()
    renderLogin(
      "/login",
      createStubGateway({
        signIn: () => Promise.reject(new Error("gateway exploded")),
      }),
    )
    await enterCredentials(user)

    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(
      await screen.findByText(
        "The email or password you entered was not recognized.",
      ),
    ).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent("gateway exploded")
  })

  it("normalizes credentials and honors a safe internal return path", async () => {
    const user = userEvent.setup()
    let received: { email: string; password: string } | null = null
    renderLogin(
      "/login?returnTo=%2Fportal%2Fenrollment",
      createStubGateway({
        signIn: (credentials) => {
          received = credentials
          return Promise.resolve(studentSession)
        },
      }),
    )
    await enterCredentials(user, "  STUDENT.SEED@GRC.TEST  ", "a-password")

    await user.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith("/portal/enrollment")
    })
    expect(received).toEqual({
      email: "student.seed@grc.test",
      password: "a-password",
    })
  })

  it("falls back to the portal overview for an unsafe return target", async () => {
    const user = userEvent.setup()
    renderLogin(
      "/login?returnTo=https%3A%2F%2Fevil.example%2Fportal",
      createStubGateway({ signIn: () => Promise.resolve(studentSession) }),
    )
    await enterCredentials(user)

    await user.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith("/portal")
    })
    expect(routerMock.replace).not.toHaveBeenCalledWith(
      expect.stringContaining("evil.example"),
    )
  })

  it("announces and disables the form while sign-in is pending", async () => {
    let resolveSignIn: (session: AuthSession) => void = () => undefined
    const user = userEvent.setup()
    renderLogin(
      "/login",
      createStubGateway({
        signIn: () =>
          new Promise((resolve) => {
            resolveSignIn = resolve
          }),
      }),
    )
    await enterCredentials(user)

    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled()
    resolveSignIn(studentSession)

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith("/portal")
    })
  })
})
