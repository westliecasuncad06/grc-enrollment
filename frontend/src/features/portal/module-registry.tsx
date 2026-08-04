import type { ComponentType } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AdmissionProvisioningWorkspace } from "@/features/components/portal/admission-provisioning-workspace"
import { FacultyInputWorkspace } from "@/features/components/portal/faculty-input-workspace"
import { TeachingScheduleWorkspace } from "@/features/components/portal/teaching-schedule-workspace"
import { CurriculumWorkspace } from "@/features/components/portal/curriculum-workspace"
import { ProgramChairEnrollmentWorkspace } from "@/features/components/portal/program-chair-enrollment-workspace"
import { AcademicTermWorkspace } from "@/features/components/portal/academic-term-workspace"
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
import { PaymentRecordsWorkspace } from "@/features/components/portal/payment-records-workspace"
import { StudentGradesWorkspace } from "@/features/components/portal/student-grades-workspace"
import { StudentDigitalComWorkspace } from "@/features/components/portal/student-digital-com-workspace"
import { EnrollmentChangeRequestsWorkspace } from "@/features/components/portal/enrollment-change-requests-workspace"
import { RegistrarRecordsWorkspace } from "@/features/components/portal/registrar-records-workspace"
import { RegistrarGradesWorkspace } from "@/features/components/portal/registrar-grades-workspace"
import { ClassRostersWorkspace } from "@/features/components/portal/class-rosters-workspace"
import { GradeSubmissionWorkspace } from "@/features/components/portal/grade-submission-workspace"
import { EnrollmentDashboardWorkspace } from "@/features/components/portal/enrollment-dashboard-workspace"
import { InstitutionDashboardWorkspace } from "@/features/components/portal/institution-dashboard-workspace"
import { StuckStudentsWorkspace } from "@/features/components/portal/stuck-students-workspace"
import { PolicySettingsWorkspace } from "@/features/components/portal/policy-settings-workspace"

export type ConnectedModuleId =
  | "student-accounts"
  | "admission-status"
  | "credential-issuance"
  | "availability-preferences"
  | "teaching-schedule"
  | "program-chair-enrollment"
  | "subjects-prerequisites"
  | "sections-schedules"
  | "faculty-assignment"
  | "schedule-proposals"
  | "schedule-approvals"
  | "master-schedule"
  | "audit-logs"
  | "eligible-subjects"
  | "enrollment"
  | "grade-approvals"
  | "academic-transcripts"
  | "enrollment-approvals"
  | "overrides-voids"
  | "payment-queue"
  | "payment-records"
  | "grades"
  | "digital-com"
  | "enrollment-change-requests"
  | "credit-mappings"
  | "drops-withdrawals"
  | "academic-records"
  | "enrollment-documents"
  | "class-rosters"
  | "grade-submission"
  | "enrollment-dashboard"
  | "institution-dashboard"
  | "stuck-students"
  | "policy-settings"
  | "academic-terms"

export type PortalModuleComponent = ComponentType

export const connectedModuleIds = [
  "student-accounts",
  "admission-status",
  "credential-issuance",
  "availability-preferences",
  "teaching-schedule",
  "program-chair-enrollment",
  "subjects-prerequisites",
  "sections-schedules",
  "faculty-assignment",
  "schedule-proposals",
  "schedule-approvals",
  "master-schedule",
  "audit-logs",
  "eligible-subjects",
  "enrollment",
  "grade-approvals",
  "academic-transcripts",
  "enrollment-approvals",
  "overrides-voids",
  "payment-queue",
  "payment-records",
  "grades",
  "digital-com",
  "enrollment-change-requests",
  "credit-mappings",
  "drops-withdrawals",
  "academic-records",
  "enrollment-documents",
  "class-rosters",
  "grade-submission",
  "enrollment-dashboard",
  "institution-dashboard",
  "stuck-students",
  "policy-settings",
  "academic-terms",
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
const programChairEnrollmentWorkspace: PortalModuleComponent = () => (
  <ProgramChairEnrollmentWorkspace />
)
const academicTermWorkspace: PortalModuleComponent = () => (
  <AcademicTermWorkspace />
)
const SectionsModuleWorkspace: PortalModuleComponent = () => {
  const { session } = useAuth()

  return session?.role === "program_chair" ? (
    <ProgramChairEnrollmentWorkspace
      workspaceTitle="Sections and schedules"
      workspaceDescription="Track the approval of your submitted plan and review every generated section schedule."
      initialView="tiles"
    />
  ) : (
    <SectionsWorkspace />
  )
}
const facultyAssignmentWorkspace: PortalModuleComponent = () => (
  <FacultyAssignmentWorkspace />
)
const scheduleProposalsWorkspace: PortalModuleComponent = () => (
  <ScheduleProposalsWorkspace />
)

const gradeApprovalsWorkspace: PortalModuleComponent = () => (
  <RegistrarGradesWorkspace initialModuleId="grade-approvals" />
)
const academicTranscriptsWorkspace: PortalModuleComponent = () => (
  <RegistrarGradesWorkspace initialModuleId="academic-transcripts" />
)

const enrollmentApprovalsWorkspace: PortalModuleComponent = () => (
  <RegistrarEnrollmentWorkspace initialModuleId="enrollment-approvals" />
)
const overridesVoidsWorkspace: PortalModuleComponent = () => (
  <RegistrarEnrollmentWorkspace initialModuleId="overrides-voids" />
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
  "program-chair-enrollment": programChairEnrollmentWorkspace,
  "subjects-prerequisites": curriculumWorkspace,
  "sections-schedules": SectionsModuleWorkspace,
  "faculty-assignment": facultyAssignmentWorkspace,
  "schedule-proposals": scheduleProposalsWorkspace,
  "schedule-approvals": ScheduleDecisionWorkspace,
  "master-schedule": MasterScheduleWorkspace,
  "audit-logs": AuditLogsWorkspace,
  "eligible-subjects": EligibleSubjectsWorkspace,
  enrollment: EnrollmentWorkspace,
  "grade-approvals": gradeApprovalsWorkspace,
  "academic-transcripts": academicTranscriptsWorkspace,
  "enrollment-approvals": enrollmentApprovalsWorkspace,
  "overrides-voids": overridesVoidsWorkspace,
  "payment-queue": AccountingPaymentWorkspace,
  "payment-records": PaymentRecordsWorkspace,
  grades: StudentGradesWorkspace,
  "digital-com": StudentDigitalComWorkspace,
  "enrollment-change-requests": EnrollmentChangeRequestsWorkspace,
  "credit-mappings": creditMappingsWorkspace,
  "drops-withdrawals": dropsWithdrawalsWorkspace,
  "academic-records": academicRecordsWorkspace,
  "enrollment-documents": enrollmentDocumentsWorkspace,
  "class-rosters": ClassRostersWorkspace,
  "grade-submission": GradeSubmissionWorkspace,
  "enrollment-dashboard": EnrollmentDashboardWorkspace,
  "institution-dashboard": InstitutionDashboardWorkspace,
  "stuck-students": StuckStudentsWorkspace,
  "policy-settings": PolicySettingsWorkspace,
  "academic-terms": academicTermWorkspace,
}

export function isConnectedModuleId(
  moduleId: string,
): moduleId is ConnectedModuleId {
  return connectedModuleIds.includes(moduleId as ConnectedModuleId)
}
