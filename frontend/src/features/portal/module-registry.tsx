import type { ComponentType } from "react"

import { AdmissionProvisioningWorkspace } from "@/features/components/portal/admission-provisioning-workspace"
import { FacultyInputWorkspace } from "@/features/components/portal/faculty-input-workspace"
import { TeachingScheduleWorkspace } from "@/features/components/portal/teaching-schedule-workspace"
import { CurriculumWorkspace } from "@/features/components/portal/curriculum-workspace"

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

const studentAccountsWorkspace: PortalModuleComponent = () => (
  <AdmissionProvisioningWorkspace initialModuleId="student-accounts" />
)

const admissionStatusWorkspace: PortalModuleComponent = () => (
  <AdmissionProvisioningWorkspace initialModuleId="admission-status" />
)

const credentialIssuanceWorkspace: PortalModuleComponent = () => (
  <AdmissionProvisioningWorkspace initialModuleId="credential-issuance" />
)

const availabilityPreferencesWorkspace: PortalModuleComponent = () => (
  <FacultyInputWorkspace />
)

const teachingScheduleWorkspace: PortalModuleComponent = () => (
  <TeachingScheduleWorkspace />
)

const curriculumWorkspace: PortalModuleComponent = () => <CurriculumWorkspace />

export const phaseFiveModuleRegistry: Readonly<
  Record<PhaseFiveModuleId, PortalModuleComponent>
> = {
  "student-accounts": studentAccountsWorkspace,
  "admission-status": admissionStatusWorkspace,
  "credential-issuance": credentialIssuanceWorkspace,
  "availability-preferences": availabilityPreferencesWorkspace,
  "teaching-schedule": teachingScheduleWorkspace,
  curriculum: curriculumWorkspace,
  "subjects-prerequisites": curriculumWorkspace,
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
