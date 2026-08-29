import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  connectedModuleIds,
  connectedModuleRegistry,
} from "@/features/portal/module-registry"
import {
  getRoleModule,
  knownPortalModuleIds,
  rolePortalDefinitions,
} from "@/features/portal/role-capabilities"
import { renderWithSession } from "@/tests/render-app"

// Modules whose workspace component has been migrated onto WorkspacePage
// (Phase 8a Task 5) derive their region's accessible name directly from the
// visible <h2> heading text, not a separate aria-label string with a
// "workspace" suffix — so their expected name is exactly the heading text.
const migratedRegionNames: Partial<Record<string, string>> = {
  "class-rosters": "Class rosters",
  "grade-submission": "Grade submission",
  "credit-mappings": "Credit mappings",
  "drops-withdrawals": "Drops & withdrawals",
  "academic-records": "Academic records",
  "enrollment-documents": "Enrollment documents",
  "master-schedule": "Enrollment planning review",
  "audit-logs": "Audit logs",
  "teaching-schedule": "Teaching schedule",
  grades: "Grades",
  "digital-com": "Certificate of Registration",
  "schedule-approvals": "Enrollment planning review",
  "curriculum-approvals": "Curriculum Approvals",
  "schedule-proposals": "Schedule proposals",
  schedule: "Schedule",
  "faculty-loading": "Faculty Loading",
  "faculty-workforce": "Faculty Workforce",
  "program-chair-analytics": "Analytics",
  "faculty-invitations": "Invite Professors",
  "staff-invitations": "Invite Staff",
  "registrar-analytics": "Analytics",
  rooms: "Rooms",
  enrollment: "Select your subjects",
  "grade-approvals": "Grade approvals",
  "academic-transcripts": "Academic transcripts",
  "enrollment-change-requests": "Add/Drop requests",
  "enrollment-approvals": "Enrollment approvals",
  "overrides-voids": "Overrides & voids",
  "program-chair-enrollment": "Enrollment",
  "subjects-prerequisites": "Curriculum editor",
  "academic-terms": "Enrollment",
  "availability-preferences": "Availability and preferences",
  "payment-queue": "Payment queue",
  "payment-records": "Transaction history",
  "cor-records": "Certificate of Registration Records",
  "queue-kiosk-access": "Queue kiosk access",
  "student-records": "Student Records",
  "student-information": "Student Information",
  "attrition-analytics": "Attrition analytics",
  honors: "Dean's list",
  "enrollment-dashboard": "Enrollment dashboard",
  "institution-dashboard": "Institution dashboard",
  "stuck-students": "Stuck students",
  "policy-settings": "Policy settings",
  "it-control-students": "IT Control student accounts",
  "it-control-faculty": "IT Control faculty accounts",
  "it-control-enrollment-override": "Enrollment overrides",
}

const unmigratedRegionNames: Partial<Record<string, string>> = {}

describe("connectedModuleRegistry", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify({ data: [] }))),
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  it("dispatches every role-owned connected module ID", () => {
    expect(Object.keys(connectedModuleRegistry).sort()).toEqual(
      [...connectedModuleIds].sort(),
    )

    for (const moduleId of connectedModuleIds) {
      const ModuleComponent = connectedModuleRegistry[moduleId]
      const role = (
        Object.keys(
          rolePortalDefinitions,
        ) as (keyof typeof rolePortalDefinitions)[]
      ).find((candidate) =>
        rolePortalDefinitions[candidate].modules.some(
          (module) => module.id === moduleId,
        ),
      )
      const view = renderWithSession(<ModuleComponent />, {
        session: {
          userId: "5",
          displayName: role === "dean" ? "Dean" : "Test User",
          role: role ?? "admission_staff",
          signedInAt: "2026-07-29T12:00:00Z",
        },
      })
      const expectedRegion =
        migratedRegionNames[moduleId] ??
        unmigratedRegionNames[moduleId] ??
        "Connected portal workspace"
      expect(
        view.getByRole("region", { name: expectedRegion }),
      ).toBeInTheDocument()
      view.unmount()
    }
  })

  it("connects curriculum approvals for Dean and Executive Director", () => {
    expect(connectedModuleIds).toContain("curriculum-approvals")
    expect(connectedModuleRegistry["curriculum-approvals"]).toBeDefined()

    for (const role of ["dean", "executive_director"] as const) {
      expect(rolePortalDefinitions[role].modules).toContainEqual(
        expect.objectContaining({
          id: "curriculum-approvals",
          label: "Curriculum Approvals",
        }),
      )
    }

    const ModuleComponent = connectedModuleRegistry["curriculum-approvals"]
    const view = renderWithSession(<ModuleComponent />, {
      session: {
        userId: "5",
        displayName: "Dean",
        role: "dean",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })

    expect(
      view.getByRole("region", { name: "Curriculum Approvals" }),
    ).toBeInTheDocument()
    view.unmount()
  })

  it("does not connect any module outside the registry", () => {
    const plannedModuleIds = [...knownPortalModuleIds].filter(
      (moduleId) => !connectedModuleIds.includes(moduleId as never),
    )

    expect(plannedModuleIds).toHaveLength(
      knownPortalModuleIds.size - connectedModuleIds.length,
    )
    for (const moduleId of plannedModuleIds) {
      expect(connectedModuleRegistry[moduleId as never]).toBeUndefined()
    }
  })

  it("keeps the registry independent from role authorization", () => {
    expect(getRoleModule("student", "audit-logs")).toBeNull()
    expect(rolePortalDefinitions.registrar_head.modules).toContainEqual(
      expect.objectContaining({ id: "audit-logs" }),
    )
  })
})
