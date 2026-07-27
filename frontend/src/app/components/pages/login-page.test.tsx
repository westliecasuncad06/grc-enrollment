import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import type { DemoAuthGateway, DemoSession } from "@/app/auth/demo-auth-types"
import { sharedDemoPassword } from "@/app/auth/demo-users"
import { renderAppAtRoute } from "@/tests/render-app"

const studentSession: DemoSession = {
  schemaVersion: "demo-v1",
  userId: "demo-student",
  displayName: "Demo Student",
  role: "student",
  signedInAt: "2026-07-26T12:00:00.000Z",
}

async function enterStudentCredentials(
  user: ReturnType<typeof userEvent.setup>,
  email = "student.demo@grc.test",
  password = sharedDemoPassword,
) {
  await user.type(await screen.findByLabelText("Email address"), email)
  await user.type(screen.getByLabelText("Password"), password)
}

describe("LoginPage", () => {
  it("renders an accessible local-demo form without unimplemented account actions", async () => {
    renderAppAtRoute("/login")

    expect(
      await screen.findByRole("heading", {
        name: "Sign in to your portal",
      }),
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
      screen.getByText("docs/testing/DEMO_CREDENTIALS.md"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Interface demonstration—not real authentication"),
    ).toBeInTheDocument()
    expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/register|create account/i),
    ).not.toBeInTheDocument()
  })

  it("focuses a summary and identifies invalid fields", async () => {
    const user = userEvent.setup()
    renderAppAtRoute("/login")

    await user.click(await screen.findByRole("button", { name: "Sign in" }))

    const summary = await screen.findByRole("alert", {
      name: "Sign-in errors",
    })
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
    renderAppAtRoute("/login")

    const password = await screen.findByLabelText("Password")
    expect(password).toHaveAttribute("type", "password")

    await user.click(screen.getByRole("button", { name: "Show password" }))
    expect(password).toHaveAttribute("type", "text")

    await user.click(screen.getByRole("button", { name: "Hide password" }))
    expect(password).toHaveAttribute("type", "password")
  })

  it("shows one generic credential error, retains email, and clears password", async () => {
    const user = userEvent.setup()
    renderAppAtRoute("/login")
    await enterStudentCredentials(
      user,
      "student.demo@grc.test",
      "incorrect-password",
    )

    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(
      await screen.findByText("The demo credentials were not recognized."),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Email address")).toHaveValue(
      "student.demo@grc.test",
    )
    expect(screen.getByLabelText("Password")).toHaveValue("")
    expect(document.body).not.toHaveTextContent("incorrect-password")
  })

  it("normalizes credentials and honors a safe internal return path", async () => {
    const user = userEvent.setup()
    renderAppAtRoute("/login?returnTo=%2Fportal%2Fenrollment")
    await enterStudentCredentials(
      user,
      "  STUDENT.DEMO@GRC.TEST  ",
      sharedDemoPassword,
    )

    await user.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => {
      expect(screen.getByLabelText("current route")).toHaveTextContent(
        "/portal/enrollment",
      )
    })
  })

  it("falls back to the portal overview for an unsafe return target", async () => {
    const user = userEvent.setup()
    renderAppAtRoute("/login?returnTo=https%3A%2F%2Fevil.example%2Fportal")
    await enterStudentCredentials(user)

    await user.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => {
      expect(screen.getByLabelText("current route")).toHaveTextContent(
        /^\/portal$/,
      )
    })
  })

  it("announces and disables the form while sign-in is pending", async () => {
    let resolveSignIn: (session: DemoSession) => void = () => undefined
    const gateway: DemoAuthGateway = {
      signIn: () =>
        new Promise((resolve) => {
          resolveSignIn = resolve
        }),
    }
    const user = userEvent.setup()
    renderAppAtRoute("/login", { gateway })
    await enterStudentCredentials(user)

    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled()
    resolveSignIn(studentSession)

    await waitFor(() => {
      expect(screen.getByLabelText("current route")).toHaveTextContent(
        /^\/portal$/,
      )
    })
  })

  it("explains and disables demo access outside local demo mode", async () => {
    renderAppAtRoute("/login", { authMode: "disabled" })

    expect(
      await screen.findByText(
        "Demo portal access is unavailable in this environment.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled()
  })

  it("in API mode, renders a real institutional form with no demo disclaimer", async () => {
    renderAppAtRoute("/login", { authMode: "api" })

    expect(
      await screen.findByRole("heading", { name: "Sign in to your portal" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Email address")).toBeEnabled()
    expect(screen.getByLabelText("Password")).toBeEnabled()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled()
    expect(
      screen.getByText("docs/testing/SEEDED_IDENTITIES.md"),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Interface demonstration—not real authentication"),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("docs/testing/DEMO_CREDENTIALS.md"),
    ).not.toBeInTheDocument()
  })

  it("in API mode, a rejected sign-in shows a generic non-demo message", async () => {
    const user = userEvent.setup()
    const gateway: DemoAuthGateway = {
      persistsSessions: true,
      signIn: () => Promise.reject(new Error("credentials rejected")),
    }
    renderAppAtRoute("/login", { authMode: "api", gateway })

    await enterStudentCredentials(user, "registrar-head.seed@grc.test", "wrong")
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(
      await screen.findByText(
        "The email or password you entered was not recognized.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("The demo credentials were not recognized."),
    ).not.toBeInTheDocument()
  })
})
