import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import type { DemoSession } from "@/app/auth/demo-auth-types"
import { demoSessionStorageKey } from "@/app/auth/demo-session-store"
import { sharedDemoPassword } from "@/app/auth/demo-users"
import { rolePortalDefinitions } from "@/app/portal/role-capabilities"
import { renderAppAtRoute } from "@/tests/render-app"

const studentSession: DemoSession = {
  schemaVersion: "demo-v1",
  userId: "demo-student",
  displayName: "Demo Student",
  role: "student",
  signedInAt: "2026-07-26T12:00:00.000Z",
}

describe("AppRouter", () => {
  it.each([
    ["/", "Enrollment, guided from first step to final record."],
    ["/login", "Sign in to your portal"],
  ])("renders public route %s without a session", async (route, heading) => {
    renderAppAtRoute(route)

    expect(
      await screen.findByRole("heading", { name: heading }),
    ).toBeInTheDocument()
  })

  it("redirects the portal overview to login with a safe return path", async () => {
    renderAppAtRoute("/portal")

    await waitFor(() => {
      expect(screen.getByLabelText("current route")).toHaveTextContent(
        "/login?returnTo=%2Fportal",
      )
    })
  })

  it("preserves a protected module path and query in the login redirect", async () => {
    renderAppAtRoute("/portal/enrollment?tab=available")

    await waitFor(() => {
      expect(screen.getByLabelText("current route")).toHaveTextContent(
        "/login?returnTo=%2Fportal%2Fenrollment%3Ftab%3Davailable",
      )
    })
  })

  it("renders protected content for a restored demo session", async () => {
    renderAppAtRoute("/portal", { initialSession: studentSession })

    expect(
      await screen.findByRole("heading", {
        name: rolePortalDefinitions.student.welcomeHeading,
      }),
    ).toBeInTheDocument()
  })

  it("returns a valid sign-in to the originally requested role module", async () => {
    const user = userEvent.setup()
    renderAppAtRoute("/portal/enrollment")

    await waitFor(() => {
      expect(screen.getByLabelText("current route")).toHaveTextContent(
        "/login?returnTo=%2Fportal%2Fenrollment",
      )
    })

    await user.type(
      screen.getByLabelText("Email address"),
      "student.demo@grc.test",
    )
    await user.type(screen.getByLabelText("Password"), sharedDemoPassword)
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(
      await screen.findByRole("heading", { name: "Enrollment" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("current route")).toHaveTextContent(
      /^\/portal\/enrollment$/,
    )
  })

  it("redirects an authenticated user away from login", async () => {
    renderAppAtRoute("/login", { initialSession: studentSession })

    await waitFor(() => {
      expect(screen.getByLabelText("current route")).toHaveTextContent(
        /^\/portal$/,
      )
    })
  })

  it("removes a corrupt session and redirects to login", async () => {
    const { storage } = renderAppAtRoute("/portal", {
      persistedValue: "{not-json",
    })

    await waitFor(() => {
      expect(screen.getByLabelText("current route")).toHaveTextContent(
        "/login?returnTo=%2Fportal",
      )
    })
    expect(storage.getItem(demoSessionStorageKey)).toBeNull()
  })

  it("renders a branded not-found page for an unknown public route", async () => {
    renderAppAtRoute("/does-not-exist")

    expect(
      await screen.findByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Return home" })).toHaveAttribute(
      "href",
      "/",
    )
  })
})
