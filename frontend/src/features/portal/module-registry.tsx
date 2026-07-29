import type { ComponentType } from "react"

import { AdmissionProvisioningWorkspace } from "@/features/components/portal/admission-provisioning-workspace"
import { FacultyInputWorkspace } from "@/features/components/portal/faculty-input-workspace"
import { TeachingScheduleWorkspace } from "@/features/components/portal/teaching-schedule-workspace"
import { CurriculumWorkspace } from "@/features/components/portal/curriculum-workspace"
import { FacultyAssignmentWorkspace } from "@/features/components/portal/faculty-assignment-workspace"
import { ScheduleProposalsWorkspace } from "@/features/components/portal/schedule-proposals-workspace"
import { SectionsWorkspace } from "@/features/components/portal/sections-workspace"
import { ScheduleDecisionWorkspace } from "@/features/components/portal/schedule-decision-workspace"
import { MasterScheduleWorkspace } from "@/features/components/portal/master-schedule-workspace"
import { AuditLogsWorkspace } from "@/features/components/portal/audit-logs-workspace"

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
const sectionsWorkspace: PortalModuleComponent = () => <SectionsWorkspace />
const facultyAssignmentWorkspace: PortalModuleComponent = () => (
  <FacultyAssignmentWorkspace />
)
const scheduleProposalsWorkspace: PortalModuleComponent = () => (
  <ScheduleProposalsWorkspace />
)

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
  "sections-schedules": sectionsWorkspace,
  "faculty-assignment": facultyAssignmentWorkspace,
  "schedule-proposals": scheduleProposalsWorkspace,
  "schedule-approvals": ScheduleDecisionWorkspace,
  "master-schedule": MasterScheduleWorkspace,
  "audit-logs": AuditLogsWorkspace,
}

export function isPhaseFiveModuleId(
  moduleId: string,
): moduleId is PhaseFiveModuleId {
  return phaseFiveModuleIds.includes(moduleId as PhaseFiveModuleId)
}
