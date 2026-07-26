import { describe, expect, it } from "vitest"

import { demoRoles } from "@/app/auth/demo-users"
import {
  getRoleModule,
  rolePortalDefinitions,
} from "@/app/portal/role-capabilities"

const expectedModuleIds = {
  student: ["enrollment", "eligible-subjects", "queue-payment", "grades-com"],
  admission_staff: [
    "student-accounts",
    "admission-status",
    "credential-issuance",
  ],
  faculty: [
    "availability-preferences",
    "teaching-schedule",
    "class-rosters",
    "grade-submission",
  ],
  program_chair: [
    "curriculum",
    "subjects-prerequisites",
    "sections-schedules",
    "faculty-assignment",
    "demand-forecast",
    "schedule-proposals",
  ],
  dean: [
    "schedule-approvals",
    "enrollment-dashboard",
    "stuck-students",
    "honors",
    "reports",
  ],
  executive_director: [
    "master-schedule",
    "institution-dashboard",
    "kpis",
    "reports",
  ],
  registrar_head: [
    "enrollment-approvals",
    "overrides-voids",
    "attrition-analytics",
    "compliance-reports",
    "audit-logs",
    "policy-settings",
  ],
  registrar_staff: [
    "credit-mappings",
    "drops-withdrawals",
    "academic-records",
    "enrollment-documents",
  ],
  accounting_staff: [
    "payment-queue",
    "serving-number",
    "payment-confirmation",
    "com-finalization",
  ],
} as const

describe("rolePortalDefinitions", () => {
  it("covers every demo role with the approved ordered module IDs", () => {
    expect(Object.keys(rolePortalDefinitions)).toEqual(demoRoles)

    for (const role of demoRoles) {
      expect(rolePortalDefinitions[role].modules.map(({ id }) => id)).toEqual(
        expectedModuleIds[role],
      )
    }
  })

  it("provides meaningful labels and descriptions without duplicate role modules", () => {
    for (const role of demoRoles) {
      const definition = rolePortalDefinitions[role]
      const ids = definition.modules.map(({ id }) => id)

      expect(definition.roleLabel.trim()).not.toBe("")
      expect(definition.welcomeHeading.trim()).not.toBe("")
      expect(new Set(ids).size).toBe(ids.length)

      for (const module of definition.modules) {
        expect(module.label.trim()).not.toBe("")
        expect(module.description.trim()).not.toBe("")
      }
    }
  })
})

describe("getRoleModule", () => {
  it("returns only modules assigned to the active role", () => {
    expect(getRoleModule("student", "enrollment")?.label).toBe("Enrollment")
    expect(getRoleModule("student", "payment-queue")).toBeNull()
    expect(getRoleModule("student", "unknown")).toBeNull()
  })
})
