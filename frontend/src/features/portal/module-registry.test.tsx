import { render } from "@testing-library/react"
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

describe("phaseFiveModuleRegistry", () => {
  it("dispatches exactly the thirteen Phase 5 role-owned module IDs", () => {
    expect(phaseFiveModuleIds).toHaveLength(13)
    expect(Object.keys(phaseFiveModuleRegistry).sort()).toEqual(
      [...phaseFiveModuleIds].sort(),
    )

    for (const moduleId of phaseFiveModuleIds) {
      const ModuleComponent = phaseFiveModuleRegistry[moduleId]
      const view = render(<ModuleComponent />)
      expect(
        view.getByRole("region", { name: "Connected portal workspace" }),
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
