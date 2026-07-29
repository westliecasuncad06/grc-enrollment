import { describe, expect, it } from "vitest"

import {
  phaseFiveModuleIds,
  phaseFiveModuleRegistry,
} from "@/features/portal/module-registry"
import {
  getRoleModule,
  knownPortalModuleIds,
  rolePortalDefinitions,
} from "@/features/portal/role-capabilities"
import { renderWithSession } from "@/tests/render-app"

describe("phaseFiveModuleRegistry", () => {
  it("dispatches exactly the thirteen Phase 5 role-owned module IDs", () => {
    expect(phaseFiveModuleIds).toHaveLength(13)
    expect(Object.keys(phaseFiveModuleRegistry).sort()).toEqual(
      [...phaseFiveModuleIds].sort(),
    )

    for (const moduleId of phaseFiveModuleIds) {
      const ModuleComponent = phaseFiveModuleRegistry[moduleId]
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
                    : "Connected portal workspace"
      expect(
        view.getByRole("region", { name: expectedRegion }),
      ).toBeInTheDocument()
      view.unmount()
    }
  })

  it("does not connect a module outside the Phase 5 registry", () => {
    const plannedModuleId = [...knownPortalModuleIds].find(
      (moduleId) => !phaseFiveModuleIds.includes(moduleId as never),
    )

    expect(plannedModuleId).toBeDefined()
    expect(
      plannedModuleId && phaseFiveModuleRegistry[plannedModuleId as never],
    ).toBeUndefined()
  })

  it("keeps the registry independent from role authorization", () => {
    expect(getRoleModule("student", "audit-logs")).toBeNull()
    expect(rolePortalDefinitions.registrar_head.modules).toContainEqual(
      expect.objectContaining({ id: "audit-logs" }),
    )
  })
})
