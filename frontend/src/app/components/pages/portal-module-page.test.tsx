import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import type { DemoSession } from "@/app/auth/demo-auth-types"
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

const allowedModuleCases = demoUsers.flatMap((user) =>
  rolePortalDefinitions[user.role].modules.map((module) => ({
    module,
    user,
  })),
)

describe("PortalModulePage", () => {
  it.each(allowedModuleCases)(
    "renders $user.role access to $module.id from that role's catalog",
    async ({ module, user }) => {
      const definition = rolePortalDefinitions[user.role]
      renderAppAtRoute(`/portal/${module.id}`, {
        initialSession: sessionFor(user),
      })

      expect(
        await screen.findByRole("heading", { name: module.label }),
      ).toBeInTheDocument()
      expect(screen.getByText(module.description)).toBeInTheDocument()
      expect(screen.getAllByText(definition.roleLabel).length).toBeGreaterThan(
        0,
      )
      expect(
        screen.getByRole("region", { name: `${module.label} module preview` }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole("heading", { name: "Demo module preview" }),
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          "This module is not connected to workflow or authorization APIs.",
        ),
      ).toBeInTheDocument()
      expect(
        screen.getByRole("link", { name: "Return to portal overview" }),
      ).toHaveAttribute("href", "/portal")
    },
  )

  it("renders a scoped portal not-found state for an unknown module", async () => {
    renderAppAtRoute("/portal/not-a-real-module", {
      initialSession: sessionFor(demoUsers[0]),
    })

    expect(
      await screen.findByRole("heading", {
        name: "Portal module not found",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "This destination is not assigned to your signed-in demo role.",
      ),
    ).toBeInTheDocument()
    const unavailableRegion = screen.getByRole("region", {
      name: "Unavailable portal module",
    })
    expect(unavailableRegion).not.toHaveTextContent("not-a-real-module")
  })

  it("does not leak a valid module assigned to another role", async () => {
    const accountingModule = rolePortalDefinitions.accounting_staff.modules[0]
    renderAppAtRoute(`/portal/${accountingModule.id}`, {
      initialSession: sessionFor(demoUsers[0]),
    })

    expect(
      await screen.findByRole("heading", {
        name: "Portal module not found",
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: accountingModule.label }),
    ).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(accountingModule.description)

    const navigation = screen.getByRole("navigation", {
      name: "Role portal navigation",
    })
    expect(
      within(navigation).queryByRole("link", {
        name: accountingModule.label,
      }),
    ).not.toBeInTheDocument()
  })

  it("returns to the overview without leaving the signed-in role", async () => {
    const user = userEvent.setup()
    const studentModule = rolePortalDefinitions.student.modules[0]
    renderAppAtRoute(`/portal/${studentModule.id}`, {
      initialSession: sessionFor(demoUsers[0]),
    })

    await screen.findByRole("heading", { name: studentModule.label })
    await user.click(
      screen.getByRole("link", { name: "Return to portal overview" }),
    )

    await waitFor(() => {
      expect(screen.getByLabelText("current route")).toHaveTextContent(
        /^\/portal$/,
      )
    })
    expect(
      screen.getByRole("heading", {
        name: rolePortalDefinitions.student.welcomeHeading,
      }),
    ).toBeInTheDocument()
  })
})
