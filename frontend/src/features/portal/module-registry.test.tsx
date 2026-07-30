import { describe, expect, it } from "vitest"

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

const unmigratedRegionNames: Partial<Record<string, string>> = {}

describe("connectedModuleRegistry", () => {
  it("dispatches exactly the twenty-nine role-owned connected module IDs", () => {
    expect(connectedModuleIds).toHaveLength(29)
    expect(Object.keys(connectedModuleRegistry).sort()).toEqual(
      [...connectedModuleIds].sort(),
    )

    for (const moduleId of connectedModuleIds) {
      const ModuleComponent = connectedModuleRegistry[moduleId]
      const view = renderWithSession(<ModuleComponent />, {
        session: {
          userId: "5",
          displayName: "Admission Staff",
          role: "admission_staff",
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
