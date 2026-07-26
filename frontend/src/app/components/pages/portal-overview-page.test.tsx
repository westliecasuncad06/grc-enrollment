import { screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { DemoSession } from "@/app/auth/demo-auth-types"
import { demoUsers } from "@/app/auth/demo-users"
import { rolePortalDefinitions } from "@/app/portal/role-capabilities"
import { renderAppAtRoute } from "@/tests/render-app"

const studentSession: DemoSession = {
  schemaVersion: "demo-v1",
  userId: "demo-student",
  displayName: "Demo Student",
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

  it("explains the demo boundary and unavailable connected data", async () => {
    renderAppAtRoute("/portal", { initialSession: studentSession })

    expect(
      await screen.findByRole("heading", {
        name: rolePortalDefinitions.student.welcomeHeading,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Demo portal interface" }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText("Academic term not connected").length,
    ).toBeGreaterThan(0)
    expect(screen.getByText("Checking public API…")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Workflow and authorization APIs are not connected in this preview.",
      ),
    ).toBeInTheDocument()
  })

  it("renders one overview card for each assigned module", async () => {
    renderAppAtRoute("/portal", { initialSession: studentSession })
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
    renderAppAtRoute("/portal", { initialSession: studentSession })
    await screen.findByRole("heading", {
      name: rolePortalDefinitions.student.welcomeHeading,
    })

    const accountingOnly =
      rolePortalDefinitions.accounting_staff.modules[0].label
    expect(screen.queryByText(accountingOnly)).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(demoUsers[8].displayName)
  })
})
