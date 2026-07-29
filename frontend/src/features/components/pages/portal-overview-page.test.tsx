import { screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AuthSession } from "@/features/auth/auth-types"
import { PortalOverviewPage } from "@/features/components/pages/portal-overview-page"
import { rolePortalDefinitions } from "@/features/portal/role-capabilities"
import { renderWithSession } from "@/tests/render-app"

const studentSession: AuthSession = {
  userId: "1",
  displayName: "Test Student",
  role: "student",
  signedInAt: "2026-07-26T12:00:00.000Z",
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

  it("explains the role boundary and loading academic-term state", async () => {
    renderWithSession(<PortalOverviewPage />, {
      route: "/portal",
      session: studentSession,
    })

    expect(
      await screen.findByRole("heading", {
        name: rolePortalDefinitions.student.welcomeHeading,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Portal workspace" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Loading academic term…")).toBeInTheDocument()
    expect(screen.getByText("Checking public API…")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Your available modules are limited to your signed-in role.",
      ),
    ).toBeInTheDocument()
  })

  it("renders one overview card for each assigned module", async () => {
    renderWithSession(<PortalOverviewPage />, {
      route: "/portal",
      session: studentSession,
    })
    await screen.findByRole("heading", {
      name: rolePortalDefinitions.student.welcomeHeading,
    })

    const modules = screen.getByRole("region", {
      name: "Student portal modules",
    })
    const links = within(modules).getAllByRole("link")

    expect(links).toHaveLength(rolePortalDefinitions.student.modules.length)

    for (const module of rolePortalDefinitions.student.modules) {
      expect(
        within(modules).getByRole("link", { name: `Open ${module.label}` }),
      ).toHaveAttribute("href", `/portal/${module.id}`)
    }
  })

  it("does not expose another role's modules", async () => {
    renderWithSession(<PortalOverviewPage />, {
      route: "/portal",
      session: studentSession,
    })
    await screen.findByRole("heading", {
      name: rolePortalDefinitions.student.welcomeHeading,
    })

    const accountingOnly =
      rolePortalDefinitions.accounting_staff.modules[0].label
    expect(screen.queryByText(accountingOnly)).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent("Accounting")
  })
})
