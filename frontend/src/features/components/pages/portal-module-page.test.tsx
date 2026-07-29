import { screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { AuthSession } from "@/features/auth/auth-types"
import { userRoles, type UserRole } from "@/features/auth/roles"
import { PortalShell } from "@/features/components/layouts/portal-shell"
import { PortalModulePage } from "@/features/components/pages/portal-module-page"
import { isPhaseFiveModuleId } from "@/features/portal/module-registry"
import { rolePortalDefinitions } from "@/features/portal/role-capabilities"
import { renderWithSession } from "@/tests/render-app"

function sessionFor(role: UserRole): AuthSession {
  return {
    userId: "1",
    displayName: `Test ${rolePortalDefinitions[role].roleLabel}`,
    role,
    signedInAt: "2026-07-26T12:00:00.000Z",
  }
}

/** Renders the module page inside the shell, as `app/portal/layout.tsx` does. */
function renderModule(role: UserRole, moduleId: string) {
  return renderWithSession(
    <PortalShell>
      <PortalModulePage moduleId={moduleId} />
    </PortalShell>,
    {
      route: `/portal/${moduleId}`,
      routeParams: { moduleId },
      session: sessionFor(role),
    },
  )
}

const allowedModuleCases = userRoles.flatMap((role) =>
  rolePortalDefinitions[role].modules.map((module) => ({ module, role })),
)

const admissionWorkspaceHeadings: Record<string, string> = {
  "student-accounts": "Student accounts",
  "admission-status": "Admission status",
  "credential-issuance": "Credential issuance",
}

const facultyWorkspaceRegions: Record<string, string> = {
  "availability-preferences": "Faculty input workspace",
  "teaching-schedule": "Teaching schedule workspace",
}

const curriculumWorkspaceModules = new Set([
  "curriculum",
  "subjects-prerequisites",
])

const schedulingWorkspaceRegions: Record<string, string> = {
  "sections-schedules": "Sections and schedules workspace",
  "faculty-assignment": "Faculty assignment workspace",
  "schedule-proposals": "Schedule proposals workspace",
  "schedule-approvals": "Schedule decision workspace",
  "master-schedule": "Master schedule workspace",
  "audit-logs": "Audit logs workspace",
}

describe("PortalModulePage", () => {
  it.each(allowedModuleCases)(
    "renders $role access to $module.id from that role's catalog",
    ({ module, role }) => {
      const definition = rolePortalDefinitions[role]
      renderModule(role, module.id)

      expect(
        screen.getByRole("heading", { name: module.label }),
      ).toBeInTheDocument()
      expect(screen.getByText(module.description)).toBeInTheDocument()
      expect(screen.getAllByText(definition.roleLabel).length).toBeGreaterThan(
        0,
      )
      if (isPhaseFiveModuleId(module.id)) {
        expect(
          screen.getAllByRole("region", {
            name: `${module.label} workspace`,
          }),
        ).not.toHaveLength(0)
        const admissionHeading = admissionWorkspaceHeadings[module.id]
        if (admissionHeading) {
          expect(
            screen.getByRole("region", {
              name: "Admission provisioning workspace",
            }),
          ).toBeInTheDocument()
          expect(
            screen.getByRole("heading", { name: admissionHeading }),
          ).toBeInTheDocument()
        } else if (facultyWorkspaceRegions[module.id]) {
          expect(
            screen.getByRole("region", {
              name: facultyWorkspaceRegions[module.id],
            }),
          ).toBeInTheDocument()
        } else if (curriculumWorkspaceModules.has(module.id)) {
          expect(
            screen.getAllByRole("region", {
              name: "Curriculum workspace",
            }),
          ).not.toHaveLength(0)
        } else if (schedulingWorkspaceRegions[module.id]) {
          expect(
            screen.getByRole("region", {
              name: schedulingWorkspaceRegions[module.id],
            }),
          ).toBeInTheDocument()
        } else {
          expect(
            screen.getByRole("region", {
              name: "Connected portal workspace",
            }),
          ).toBeInTheDocument()
        }
        expect(
          screen.queryByRole("heading", { name: "Demo module preview" }),
        ).not.toBeInTheDocument()
      } else {
        expect(
          screen.getByRole("region", {
            name: `${module.label} module preview`,
          }),
        ).toBeInTheDocument()
        expect(
          screen.getByRole("heading", { name: "Demo module preview" }),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            "This module is not connected to workflow or authorization APIs.",
          ),
        ).toBeInTheDocument()
      }
      expect(
        screen.getByRole("link", { name: "Return to portal overview" }),
      ).toHaveAttribute("href", "/portal")
    },
  )

  it("renders a scoped portal not-found state for an unknown module", () => {
    renderModule("student", "not-a-real-module")

    expect(
      screen.getByRole("heading", { name: "Portal module not found" }),
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

  it("does not leak a valid module assigned to another role", () => {
    const accountingModule = rolePortalDefinitions.accounting_staff.modules[0]
    renderModule("student", accountingModule.id)

    expect(
      screen.getByRole("heading", { name: "Portal module not found" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: accountingModule.label }),
    ).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(accountingModule.description)

    const navigation = screen.getByRole("navigation", {
      name: "Role portal navigation",
    })
    expect(
      within(navigation).queryByRole("link", { name: accountingModule.label }),
    ).not.toBeInTheDocument()
  })

  it("offers a route back to the overview that stays inside the signed-in role", () => {
    const studentModule = rolePortalDefinitions.student.modules[0]
    renderModule("student", studentModule.id)

    expect(
      screen.getByRole("link", { name: "Return to portal overview" }),
    ).toHaveAttribute("href", "/portal")

    // The destination must remain the role's own overview — the shell around
    // it still lists only the student catalog.
    const navigation = screen.getByRole("navigation", {
      name: "Role portal navigation",
    })
    const links = within(navigation).getAllByRole("link")
    expect(links).toHaveLength(
      rolePortalDefinitions.student.modules.length + 1, // + "Portal overview"
    )
  })
})
