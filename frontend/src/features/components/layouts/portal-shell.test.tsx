import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AuthSession } from "@/features/auth/auth-types"
import { userRoles, type UserRole } from "@/features/auth/roles"
import { PortalShell } from "@/features/components/layouts/portal-shell"
import { PortalModulePage } from "@/features/components/pages/portal-module-page"
import { PortalOverviewPage } from "@/features/components/pages/portal-overview-page"
import { rolePortalDefinitions } from "@/features/portal/role-capabilities"
import { routerMock } from "@/tests/navigation-mock"
import { renderWithSession } from "@/tests/render-app"

function sessionFor(role: UserRole): AuthSession {
  return {
    userId: "1",
    displayName: `Test ${rolePortalDefinitions[role].roleLabel}`,
    role,
    signedInAt: "2026-07-26T12:00:00.000Z",
  }
}

function renderShell(role: UserRole, overrides = {}) {
  return renderWithSession(
    <PortalShell>
      <PortalOverviewPage />
    </PortalShell>,
    { route: "/portal", session: sessionFor(role), ...overrides },
  )
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input
  }

  return input instanceof URL ? input.toString() : input.url
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

  it.each(userRoles)("shows the exact role navigation for %s", (role) => {
    const definition = rolePortalDefinitions[role]
    renderShell(role)

    expect(
      screen.getByRole("heading", { name: definition.welcomeHeading }),
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

    expect(
      screen.getAllByText(sessionFor(role).displayName).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText(definition.roleLabel).length).toBeGreaterThan(0)
  })

  it("connects notifications while keeping unsupported account actions honestly disabled", () => {
    renderShell("student")

    expect(screen.getByRole("button", { name: /notifications/i })).toBeEnabled()

    for (const name of [
      "Profile preview",
      "Password settings preview",
      "Help preview",
      "Report issue preview",
    ]) {
      expect(screen.getByRole("button", { name })).toBeDisabled()
    }
  })

  it("shows the active academic term and falls back when none is active", async () => {
    fetchMock.mockImplementation((input) => {
      if (requestUrl(input).includes("/academic-terms")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  type: "academic-term",
                  id: 1,
                  school_year: "2026-2027",
                  semester: "1st",
                  starts_at: null,
                  ends_at: null,
                  enrollment_opens_at: null,
                  enrollment_closes_at: null,
                  add_drop_deadline_at: null,
                  grading_deadline_at: null,
                  status: "semester_ongoing",
                  status_label: "Semester Ongoing",
                },
              ],
            }),
            { status: 200 },
          ),
        )
      }

      return new Promise<Response>(() => undefined)
    })
    renderShell("student")
    expect(
      (await screen.findAllByText("2026-2027 · 1st")).length,
    ).toBeGreaterThan(0)

    fetchMock.mockImplementation((input) => {
      if (requestUrl(input).includes("/academic-terms")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  type: "academic-term",
                  id: 2,
                  school_year: "2026-2027",
                  semester: "2nd",
                  starts_at: null,
                  ends_at: null,
                  enrollment_opens_at: null,
                  enrollment_closes_at: null,
                  add_drop_deadline_at: null,
                  grading_deadline_at: null,
                  status: "draft",
                  status_label: "Draft",
                },
              ],
            }),
            { status: 200 },
          ),
        )
      }

      return new Promise<Response>(() => undefined)
    })
    renderShell("faculty")
    expect(
      (await screen.findAllByText("No active academic term")).length,
    ).toBeGreaterThan(0)
  })

  it("opens an accessible mobile navigation Sheet", async () => {
    const user = userEvent.setup()
    renderShell("accounting_staff")

    await user.click(
      screen.getByRole("button", { name: "Open portal navigation" }),
    )

    const dialog = screen.getByRole("dialog", { name: "Portal navigation" })
    expect(
      within(dialog).getByRole("link", { name: "Payment Queue" }),
    ).toHaveAttribute("href", "/portal/payment-queue")
    expect(
      within(dialog).getByRole("button", { name: "Close" }),
    ).toBeInTheDocument()
  })

  it("signs out by navigating home before clearing the session", async () => {
    const user = userEvent.setup()
    const signOut = vi.fn()
    renderShell("student", { signOut })

    await user.click(screen.getByRole("button", { name: "Sign out" }))

    // Order matters: navigating first is what stops RequireSession from
    // bouncing a now-anonymous user to /login instead of the landing page.
    expect(routerMock.replace).toHaveBeenCalledWith("/")
    expect(signOut).toHaveBeenCalled()
  })

  it("warns when the session cannot be persisted on this browser", () => {
    renderShell("student", { storageAvailable: false })

    expect(
      screen.getByText(
        "Your session cannot be restored after refresh on this browser.",
      ),
    ).toBeInTheDocument()
  })

  it("labels the portal as a preview and never as a demo", () => {
    renderShell("student")

    expect(screen.getAllByText("Preview portal").length).toBeGreaterThan(0)
    expect(screen.queryByText("Demo portal")).not.toBeInTheDocument()
  })

  it("marks the active nav link with aria-current", () => {
    renderShell("student")

    const navigation = screen.getByRole("navigation", {
      name: "Role portal navigation",
    })

    expect(
      within(navigation).getByRole("link", { name: "Portal overview" }),
    ).toHaveAttribute("aria-current", "page")
  })

  it("shows a single current-page breadcrumb on the overview", () => {
    renderShell("student")

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" })
    expect(within(breadcrumb).getByText("Portal overview")).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(within(breadcrumb).queryByRole("link")).not.toBeInTheDocument()
  })

  it("shows a two-level breadcrumb linking back to the overview from a module", () => {
    const module = rolePortalDefinitions.student.modules[0]
    renderWithSession(
      <PortalShell>
        <PortalModulePage moduleId={module.id} />
      </PortalShell>,
      {
        route: `/portal/${module.id}`,
        routeParams: { moduleId: module.id },
        session: sessionFor("student"),
      },
    )

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" })
    expect(
      within(breadcrumb).getByRole("link", { name: "Portal overview" }),
    ).toHaveAttribute("href", "/portal")
    expect(within(breadcrumb).getByText(module.label)).toHaveAttribute(
      "aria-current",
      "page",
    )
  })
})
