import type { ComponentType } from "react"

export type PhaseFiveModuleId =
  | "student-accounts"
  | "admission-status"
  | "credential-issuance"
  | "availability-preferences"
  | "teaching-schedule"
  | "curriculum"
  | "subjects-prerequisites"
  | "sections-schedules"
  | "faculty-assignment"
  | "schedule-proposals"
  | "schedule-approvals"
  | "master-schedule"
  | "audit-logs"

export type PortalModuleComponent = ComponentType

export const phaseFiveModuleIds = [
  "student-accounts",
  "admission-status",
  "credential-issuance",
  "availability-preferences",
  "teaching-schedule",
  "curriculum",
  "subjects-prerequisites",
  "sections-schedules",
  "faculty-assignment",
  "schedule-proposals",
  "schedule-approvals",
  "master-schedule",
  "audit-logs",
] as const satisfies readonly PhaseFiveModuleId[]

const connectedPortalWorkspace: PortalModuleComponent = () => (
  <section role="region" aria-label="Connected portal workspace">
    <p>Workspace data is being prepared from the approved API contract.</p>
  </section>
)

export const phaseFiveModuleRegistry: Readonly<
  Record<PhaseFiveModuleId, PortalModuleComponent>
> = {
  "student-accounts": connectedPortalWorkspace,
  "admission-status": connectedPortalWorkspace,
  "credential-issuance": connectedPortalWorkspace,
  "availability-preferences": connectedPortalWorkspace,
  "teaching-schedule": connectedPortalWorkspace,
  curriculum: connectedPortalWorkspace,
  "subjects-prerequisites": connectedPortalWorkspace,
  "sections-schedules": connectedPortalWorkspace,
  "faculty-assignment": connectedPortalWorkspace,
  "schedule-proposals": connectedPortalWorkspace,
  "schedule-approvals": connectedPortalWorkspace,
  "master-schedule": connectedPortalWorkspace,
  "audit-logs": connectedPortalWorkspace,
}

export function isPhaseFiveModuleId(
  moduleId: string,
): moduleId is PhaseFiveModuleId {
  return phaseFiveModuleIds.includes(moduleId as PhaseFiveModuleId)
}
