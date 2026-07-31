import { screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { AuthSession } from "@/features/auth/auth-types"
import { userRoles, type UserRole } from "@/features/auth/roles"
import { PortalShell } from "@/features/components/layouts/portal-shell"
import { PortalModulePage } from "@/features/components/pages/portal-module-page"
import { isConnectedModuleId } from "@/features/portal/module-registry"
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

// Since Phase 8b (ADR 0015), a connected workspace's own WorkspacePage
// heading is the page's *only* heading — this shell no longer wraps it in a
// second, module-registry-sourced <h1>. Each workspace's heading text is its
// own, established in earlier phases and unaffected by this shell change; it
// is not always identical to the module registry's label (e.g.
// "Eligible Subjects" vs. "Eligible subjects"). Kept in sync with
// `module-registry.test.tsx`'s identical `migratedRegionNames` map, which
// covers the same 29 connected module IDs.
const workspaceHeadings: Record<string, string> = {
  "class-rosters": "Class rosters",
  "grade-submission": "Grade submission",
  "credit-mappings": "Credit mappings",
  "drops-withdrawals": "Drops & withdrawals",
  "academic-records": "Academic records",
  "enrollment-documents": "Enrollment documents",
  "master-schedule": "Master schedule",
  "audit-logs": "Audit logs",
  "teaching-schedule": "Teaching schedule",
  "eligible-subjects": "Eligible subjects",
  "queue-payment": "Queue & payment status",
  "grades-com": "Your academic records",
  "schedule-approvals": "Schedule approvals",
  "schedule-proposals": "Schedule proposals",
  "sections-schedules": "Sections and schedules",
  "faculty-assignment": "Faculty assignment",
  enrollment: "Select your subjects",
  "enrollment-approvals": "Enrollment approvals",
  "overrides-voids": "Overrides & voids",
  curriculum: "Curriculum editor",
  "subjects-prerequisites": "Curriculum editor",
  "availability-preferences": "Availability and preferences",
  "payment-queue": "Payment queue",
  "serving-number": "Serving number",
  "payment-confirmation": "Payment confirmation",
  "com-finalization": "COM finalization",
  "student-accounts": "Student accounts",
  "admission-status": "Admission status",
  "credential-issuance": "Credential issuance",
}

describe("PortalModulePage", () => {
  it.each(allowedModuleCases)(
    "renders $role access to $module.id from that role's catalog",
    ({ module, role }) => {
      const definition = rolePortalDefinitions[role]
      renderModule(role, module.id)

      // The sidebar profile block always renders the role label, regardless
      // of which module is open — unaffected by the connected/placeholder
      // branch below.
      expect(screen.getAllByText(definition.roleLabel).length).toBeGreaterThan(
        0,
      )

      if (isConnectedModuleId(module.id)) {
        const heading = workspaceHeadings[module.id]
        expect(heading).toBeDefined()
        expect(
          screen.getByRole("heading", { level: 1, name: heading }),
        ).toBeInTheDocument()
        expect(
          screen.getByRole("region", { name: heading }),
        ).toBeInTheDocument()
        expect(
          screen.queryByRole("heading", { name: "Demo module preview" }),
        ).not.toBeInTheDocument()
      } else {
        expect(
          screen.getByRole("heading", { level: 1, name: module.label }),
        ).toBeInTheDocument()
        expect(screen.getByText(module.description)).toBeInTheDocument()
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
