import { screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AuthSession } from "@/features/auth/auth-types"
import { userRoles, type UserRole } from "@/features/auth/roles"
import { PortalOverviewPage } from "@/features/components/pages/portal-overview-page"
import { isConnectedModuleId } from "@/features/portal/module-registry"
import { rolePortalDefinitions } from "@/features/portal/role-capabilities"
import { renderWithSession } from "@/tests/render-app"

const studentSession: AuthSession = {
  userId: "1",
  displayName: "Test Student",
  role: "student",
  signedInAt: "2026-07-26T12:00:00.000Z",
}

function sessionFor(role: UserRole): AuthSession {
  return {
    ...studentSession,
    displayName: `Test ${rolePortalDefinitions[role].roleLabel}`,
    role,
  }
}

describe("PortalOverviewPage", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined))
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows GRC Connect role guidance without repeating the signed-in name", async () => {
    renderWithSession(<PortalOverviewPage />, {
      route: "/portal",
      session: studentSession,
    })

    expect(
      await screen.findByRole("heading", {
        name: "GRC Connect",
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText("Welcome, Test Student.")).not.toBeInTheDocument()
    expect(
      screen.getByText(rolePortalDefinitions.student.welcomeHeading),
    ).toBeInTheDocument()
    expect(screen.getByText("Loading academic term…")).toBeInTheDocument()
    expect(
      screen.getByText("Checking system availability…"),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Continue to Enrollment" }),
    ).toBeInTheDocument()
  })

  it.each(userRoles)(
    "does not repeat the signed-in name in the GRC Connect hero for %s",
    async (role) => {
      const session = sessionFor(role)

      renderWithSession(<PortalOverviewPage />, {
        route: "/portal",
        session,
      })
      await screen.findByRole("heading", { name: "GRC Connect" })

      expect(
        screen.queryByText(`Welcome, ${session.displayName}.`),
      ).not.toBeInTheDocument()
      expect(
        screen.getByText(rolePortalDefinitions[role].welcomeHeading),
      ).toBeInTheDocument()
      expect(
        screen.queryByText(rolePortalDefinitions[role].roleLabel),
      ).not.toBeInTheDocument()
    },
  )

  it("renders each assigned module under the GRC Connect workspace", async () => {
    renderWithSession(<PortalOverviewPage />, {
      route: "/portal",
      session: studentSession,
    })
    await screen.findByRole("heading", {
      name: "GRC Connect",
    })

    const modules = screen.getByRole("region", {
      name: "Student GRC Connect modules",
    })
    const links = within(modules).getAllByRole("link")

    expect(links).toHaveLength(rolePortalDefinitions.student.modules.length)

    for (const module of rolePortalDefinitions.student.modules) {
      expect(
        within(modules).getByRole("link", {
          name:
            module.id === "enrollment"
              ? `Continue to ${module.label}`
              : `Open ${module.label}`,
        }),
      ).toHaveAttribute("href", `/portal/${module.id}`)
    }
  })

  it("does not expose another role's modules", async () => {
    renderWithSession(<PortalOverviewPage />, {
      route: "/portal",
      session: studentSession,
    })
    await screen.findByRole("heading", {
      name: "GRC Connect",
    })

    const accountingOnly =
      rolePortalDefinitions.accounting_staff.modules[0].label
    expect(screen.queryByText(accountingOnly)).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent("Accounting")
  })

  it("separates planned capabilities from the role's available workspaces", async () => {
    const deanSession: AuthSession = {
      ...studentSession,
      role: "dean",
      displayName: "Test Dean",
    }
    const definition = rolePortalDefinitions.dean
    const availableModules = definition.modules.filter((module) =>
      isConnectedModuleId(module.id),
    )
    const plannedModules = definition.modules.filter(
      (module) => !isConnectedModuleId(module.id),
    )

    renderWithSession(<PortalOverviewPage />, {
      route: "/portal",
      session: deanSession,
    })
    await screen.findByRole("heading", { name: "GRC Connect" })

    const availableWorkspace = screen.getByRole("region", {
      name: "Dean GRC Connect modules",
    })
    const plannedCapabilities = screen.getByRole("region", {
      name: "Dean planned capabilities",
    })

    expect(screen.getByText("Available workspaces")).toBeInTheDocument()
    expect(screen.getByText("Planned capabilities")).toBeInTheDocument()
    expect(screen.getByText("Start here")).toBeInTheDocument()

    for (const [index, module] of availableModules.entries()) {
      const actionLabel =
        index === 0 ? `Continue to ${module.label}` : `Open ${module.label}`

      expect(
        within(availableWorkspace).getByRole("link", {
          name: actionLabel,
        }),
      ).toHaveAttribute("href", `/portal/${module.id}`)
    }

    for (const module of plannedModules) {
      expect(
        within(availableWorkspace).queryByText(module.label),
      ).not.toBeInTheDocument()
      expect(
        within(plannedCapabilities).getByText(module.label),
      ).toBeInTheDocument()
      expect(
        within(plannedCapabilities).queryByRole("link", {
          name: new RegExp(module.label),
        }),
      ).not.toBeInTheDocument()
    }
  })
})
