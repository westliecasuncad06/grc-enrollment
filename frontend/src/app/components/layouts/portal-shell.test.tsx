import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { DemoSession } from "@/app/auth/demo-auth-types"
import type { DemoSessionPersistence } from "@/app/auth/demo-session-store"
import { demoUsers } from "@/app/auth/demo-users"
import { rolePortalDefinitions } from "@/app/portal/role-capabilities"
import { renderAppAtRoute } from "@/tests/render-app"

function sessionFor(user: (typeof demoUsers)[number]): DemoSession {
  return {
    schemaVersion: "demo-v1",
    userId: user.id,
    displayName: user.displayName,
    role: user.role,
    signedInAt: "2026-07-26T12:00:00.000Z",
  }
}

describe("PortalShell", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined))
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(demoUsers)(
    "shows the exact role navigation for $role",
    async (user) => {
      const definition = rolePortalDefinitions[user.role]
      renderAppAtRoute("/portal", { initialSession: sessionFor(user) })

      expect(
        await screen.findByRole("heading", {
          name: definition.welcomeHeading,
        }),
      ).toBeInTheDocument()

      const navigation = screen.getByRole("navigation", {
        name: "Role portal navigation",
      })
      const links = within(navigation).getAllByRole("link")

      expect(links).toHaveLength(definition.modules.length + 1)
      expect(
        within(navigation).getByRole("link", { name: "Portal overview" }),
      ).toHaveAttribute("href", "/portal")

      for (const module of definition.modules) {
        expect(
          within(navigation).getByRole("link", { name: module.label }),
        ).toHaveAttribute("href", `/portal/${module.id}`)
      }

      expect(screen.getAllByText(user.displayName).length).toBeGreaterThan(0)
      expect(screen.getAllByText(definition.roleLabel).length).toBeGreaterThan(
        0,
      )
      expect(screen.getAllByText("Demo portal").length).toBeGreaterThan(0)
    },
  )

  it("exposes preview actions without claiming they are connected", async () => {
    renderAppAtRoute("/portal", {
      initialSession: sessionFor(demoUsers[0]),
    })

    await screen.findByRole("heading", {
      name: rolePortalDefinitions.student.welcomeHeading,
    })

    for (const name of [
      "Notifications preview",
      "Profile preview",
      "Password settings preview",
      "Help preview",
      "Report issue preview",
    ]) {
      expect(screen.getByRole("button", { name })).toBeDisabled()
    }
    expect(
      screen.getAllByText("Academic term not connected").length,
    ).toBeGreaterThan(0)
  })

  it("opens an accessible mobile navigation Sheet", async () => {
    const user = userEvent.setup()
    renderAppAtRoute("/portal", {
      initialSession: sessionFor(demoUsers[8]),
    })
    await screen.findByRole("heading", {
      name: rolePortalDefinitions.accounting_staff.welcomeHeading,
    })

    await user.click(
      screen.getByRole("button", { name: "Open portal navigation" }),
    )

    const dialog = screen.getByRole("dialog", {
      name: "Portal navigation",
    })
    expect(
      within(dialog).getByRole("link", { name: "Payment Queue" }),
    ).toHaveAttribute("href", "/portal/payment-queue")
    expect(
      within(dialog).getByRole("button", { name: "Close" }),
    ).toBeInTheDocument()
  })

  it("logs out, clears the session, and returns home", async () => {
    const user = userEvent.setup()
    const { sessionStore } = renderAppAtRoute("/portal", {
      initialSession: sessionFor(demoUsers[0]),
    })
    await screen.findByRole("heading", {
      name: rolePortalDefinitions.student.welcomeHeading,
    })

    await user.click(screen.getByRole("button", { name: "Sign out" }))

    await waitFor(() => {
      expect(screen.getByLabelText("current route")).toHaveTextContent(/^\/$/)
    })
    expect(sessionStore.read().session).toBeNull()
  })

  it("announces when the demo session cannot persist", async () => {
    const session = sessionFor(demoUsers[0])
    const unavailablePersistence: DemoSessionPersistence = {
      read: () => ({ session, storageAvailable: false }),
      write: () => false,
      clear: () => false,
    }

    renderAppAtRoute("/portal", {
      sessionStore: unavailablePersistence,
    })

    expect(
      await screen.findByText(
        "This demo session cannot be restored after refresh on this browser.",
      ),
    ).toBeInTheDocument()
  })
})
