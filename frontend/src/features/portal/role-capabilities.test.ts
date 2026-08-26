import { describe, expect, it } from "vitest"

import { userRoles } from "@/features/auth/roles"
import {
  getRoleModule,
  rolePortalDefinitions,
} from "@/features/portal/role-capabilities"

const expectedModuleIds = {
  student: ["enrollment", "grades", "digital-com"],
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
    "program-chair-enrollment",
    "subjects-prerequisites",
    "schedule-faculty-loading",
    "rooms",
    "schedule-proposals",
    "program-chair-analytics",
  ],
  dean: [
    "schedule-approvals",
    "curriculum-approvals",
    "enrollment-dashboard",
    "stuck-students",
    "honors",
    "reports",
  ],
  executive_director: [
    "master-schedule",
    "curriculum-approvals",
    "institution-dashboard",
    "kpis",
    "reports",
  ],
  registrar_head: [
    "academic-terms",
    "grade-approvals",
    "academic-transcripts",
    "cor-records",
    "overrides-voids",
    "enrollment-change-requests",
    "attrition-analytics",
    "registrar-analytics",
    "compliance-reports",
    "audit-logs",
    "policy-settings",
    "rooms",
  ],
  registrar_staff: [
    "enrollment-approvals",
    "credit-mappings",
    "drops-withdrawals",
    "academic-records",
    "enrollment-change-requests",
    "enrollment-documents",
  ],
  accounting_staff: [
    "payment-queue",
    "payment-records",
    "cor-records",
    "queue-kiosk-access",
  ],
  it_admin: [
    "it-control-students",
    "it-control-faculty",
    "it-control-enrollment-override",
  ],
  queue_kiosk: [],
} as const

describe("rolePortalDefinitions", () => {
  it("exposes the three IT control modules in order", () => {
    expect(
      rolePortalDefinitions.it_admin.modules.map((module) => module.id),
    ).toEqual([
      "it-control-students",
      "it-control-faculty",
      "it-control-enrollment-override",
    ])
  })

  it("covers every demo role with the approved ordered module IDs", () => {
    expect(Object.keys(rolePortalDefinitions)).toEqual(userRoles)

    for (const role of userRoles) {
      expect(rolePortalDefinitions[role].modules.map(({ id }) => id)).toEqual(
        expectedModuleIds[role],
      )
    }
  })

  it("provides meaningful labels and descriptions without duplicate role modules", () => {
    for (const role of userRoles) {
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
  it("names the Cashier payment-record destination Transaction History", () => {
    expect(getRoleModule("accounting_staff", "payment-records")?.label).toBe(
      "Transaction History",
    )
  })

  it("returns only modules assigned to the active role", () => {
    expect(getRoleModule("student", "enrollment")?.label).toBe("Enrollment")
    expect(getRoleModule("student", "payment-queue")).toBeNull()
    expect(getRoleModule("student", "unknown")).toBeNull()
    expect(getRoleModule("dean", "schedule-approvals")?.label).toBe(
      "Enrollment",
    )
    expect(getRoleModule("executive_director", "master-schedule")?.label).toBe(
      "Enrollment",
    )
    expect(
      getRoleModule("program_chair", "subjects-prerequisites")?.label,
    ).toBe("Curriculum Editor")
  })
})
