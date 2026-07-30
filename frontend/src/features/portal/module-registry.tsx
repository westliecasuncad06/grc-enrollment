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
import { EligibleSubjectsWorkspace } from "@/features/components/portal/eligible-subjects-workspace"
import { EnrollmentWorkspace } from "@/features/components/portal/enrollment-workspace"
import { RegistrarEnrollmentWorkspace } from "@/features/components/portal/registrar-enrollment-workspace"
import { AccountingPaymentWorkspace } from "@/features/components/portal/accounting-payment-workspace"
import { StudentQueuePaymentWorkspace } from "@/features/components/portal/student-queue-payment-workspace"
import { StudentGradesComWorkspace } from "@/features/components/portal/student-grades-com-workspace"
import { RegistrarRecordsWorkspace } from "@/features/components/portal/registrar-records-workspace"
import { ClassRostersWorkspace } from "@/features/components/portal/class-rosters-workspace"
import { GradeSubmissionWorkspace } from "@/features/components/portal/grade-submission-workspace"

export type ConnectedModuleId =
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
  | "eligible-subjects"
  | "enrollment"
  | "enrollment-approvals"
  | "overrides-voids"
  | "payment-queue"
  | "serving-number"
  | "payment-confirmation"
  | "com-finalization"
  | "queue-payment"
  | "grades-com"
  | "credit-mappings"
  | "drops-withdrawals"
  | "academic-records"
  | "enrollment-documents"
  | "class-rosters"
  | "grade-submission"

export type PortalModuleComponent = ComponentType

export const connectedModuleIds = [
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
  "eligible-subjects",
  "enrollment",
  "enrollment-approvals",
  "overrides-voids",
  "payment-queue",
  "serving-number",
  "payment-confirmation",
  "com-finalization",
  "queue-payment",
  "grades-com",
  "credit-mappings",
  "drops-withdrawals",
  "academic-records",
  "enrollment-documents",
  "class-rosters",
  "grade-submission",
] as const satisfies readonly ConnectedModuleId[]

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

const enrollmentApprovalsWorkspace: PortalModuleComponent = () => (
  <RegistrarEnrollmentWorkspace initialModuleId="enrollment-approvals" />
)
const overridesVoidsWorkspace: PortalModuleComponent = () => (
  <RegistrarEnrollmentWorkspace initialModuleId="overrides-voids" />
)

const paymentQueueWorkspace: PortalModuleComponent = () => (
  <AccountingPaymentWorkspace initialModuleId="payment-queue" />
)
const servingNumberWorkspace: PortalModuleComponent = () => (
  <AccountingPaymentWorkspace initialModuleId="serving-number" />
)
const paymentConfirmationWorkspace: PortalModuleComponent = () => (
  <AccountingPaymentWorkspace initialModuleId="payment-confirmation" />
)
const comFinalizationWorkspace: PortalModuleComponent = () => (
  <AccountingPaymentWorkspace initialModuleId="com-finalization" />
)

const creditMappingsWorkspace: PortalModuleComponent = () => (
  <RegistrarRecordsWorkspace initialModuleId="credit-mappings" />
)
const dropsWithdrawalsWorkspace: PortalModuleComponent = () => (
  <RegistrarRecordsWorkspace initialModuleId="drops-withdrawals" />
)
const academicRecordsWorkspace: PortalModuleComponent = () => (
  <RegistrarRecordsWorkspace initialModuleId="academic-records" />
)
const enrollmentDocumentsWorkspace: PortalModuleComponent = () => (
  <RegistrarRecordsWorkspace initialModuleId="enrollment-documents" />
)

export const connectedModuleRegistry: Readonly<
  Record<ConnectedModuleId, PortalModuleComponent>
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
  "eligible-subjects": EligibleSubjectsWorkspace,
  enrollment: EnrollmentWorkspace,
  "enrollment-approvals": enrollmentApprovalsWorkspace,
  "overrides-voids": overridesVoidsWorkspace,
  "payment-queue": paymentQueueWorkspace,
  "serving-number": servingNumberWorkspace,
  "payment-confirmation": paymentConfirmationWorkspace,
  "com-finalization": comFinalizationWorkspace,
  "queue-payment": StudentQueuePaymentWorkspace,
  "grades-com": StudentGradesComWorkspace,
  "credit-mappings": creditMappingsWorkspace,
  "drops-withdrawals": dropsWithdrawalsWorkspace,
  "academic-records": academicRecordsWorkspace,
  "enrollment-documents": enrollmentDocumentsWorkspace,
  "class-rosters": ClassRostersWorkspace,
  "grade-submission": GradeSubmissionWorkspace,
}

export function isConnectedModuleId(
  moduleId: string,
): moduleId is ConnectedModuleId {
  return connectedModuleIds.includes(moduleId as ConnectedModuleId)
}
