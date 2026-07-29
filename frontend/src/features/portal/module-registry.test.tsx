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

describe("connectedModuleRegistry", () => {
  it("dispatches exactly the fifteen role-owned connected module IDs", () => {
    expect(connectedModuleIds).toHaveLength(15)
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
      const expectedRegion = [
        "student-accounts",
        "admission-status",
        "credential-issuance",
      ].includes(moduleId)
        ? "Admission provisioning workspace"
        : moduleId === "availability-preferences"
          ? "Faculty input workspace"
          : moduleId === "teaching-schedule"
            ? "Teaching schedule workspace"
            : ["curriculum", "subjects-prerequisites"].includes(moduleId)
              ? "Curriculum workspace"
              : moduleId === "sections-schedules"
                ? "Sections and schedules workspace"
                : moduleId === "faculty-assignment"
                  ? "Faculty assignment workspace"
                  : moduleId === "schedule-proposals"
                    ? "Schedule proposals workspace"
                    : moduleId === "schedule-approvals"
                      ? "Schedule decision workspace"
                      : moduleId === "master-schedule"
                        ? "Master schedule workspace"
                        : moduleId === "audit-logs"
                          ? "Audit logs workspace"
                          : moduleId === "eligible-subjects"
                            ? "Eligible subjects workspace"
                            : moduleId === "enrollment"
                              ? "Enrollment submission workspace"
                              : "Connected portal workspace"
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
