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
  "master-schedule": "Enrollment planning review",
  "audit-logs": "Audit logs",
  "teaching-schedule": "Teaching schedule",
  grades: "Grades",
  "digital-com": "Digital COM",
  "schedule-approvals": "Enrollment planning review",
  "schedule-proposals": "Schedule proposals",
  "sections-schedules": "Sections and schedules",
  "faculty-assignment": "Faculty assignment",
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
  "payment-records": "Payment records",
  "student-accounts": "Student accounts",
  "admission-status": "Admission status",
  "credential-issuance": "Credential issuance",
  "enrollment-dashboard": "Enrollment dashboard",
  "institution-dashboard": "Institution dashboard",
  "stuck-students": "Stuck students",
  "policy-settings": "Policy settings",
}

const unmigratedRegionNames: Partial<Record<string, string>> = {}

describe("connectedModuleRegistry", () => {
  it("dispatches exactly the thirty-four role-owned connected module IDs", () => {
    expect(connectedModuleIds).toHaveLength(34)
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
