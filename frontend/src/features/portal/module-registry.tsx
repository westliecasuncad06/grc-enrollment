import type { ComponentType } from "react"

import { StudentRecordsWorkspace } from "@/features/components/portal/student-records-workspace"
import { StudentInformationWorkspace } from "@/features/components/portal/student-information-workspace"
import { AnalyticsDashboardWorkspace } from "@/features/components/portal/analytics-dashboard-workspace"
import { FacultyInputWorkspace } from "@/features/components/portal/faculty-input-workspace"
import { TeachingScheduleWorkspace } from "@/features/components/portal/teaching-schedule-workspace"
import { CurriculumWorkspace } from "@/features/components/portal/curriculum-workspace"
import { CurriculumApprovalsWorkspace } from "@/features/components/portal/curriculum-approvals-workspace"
import { ProgramChairEnrollmentWorkspace } from "@/features/components/portal/program-chair-enrollment-workspace"
import { AcademicTermWorkspace } from "@/features/components/portal/academic-term-workspace"
import { ScheduleProposalsWorkspace } from "@/features/components/portal/schedule-proposals-workspace"
import { ScheduleFacultyLoadingWorkspace } from "@/features/components/portal/schedule-faculty-loading-workspace"
import { ScheduleDecisionWorkspace } from "@/features/components/portal/schedule-decision-workspace"
import { MasterScheduleWorkspace } from "@/features/components/portal/master-schedule-workspace"
import { AuditLogsWorkspace } from "@/features/components/portal/audit-logs-workspace"
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
import { RoomsOperationsWorkspace } from "@/features/components/portal/rooms-operations-workspace"
import { ItControlStudentsWorkspace } from "@/features/components/portal/it-control-students-workspace"
import { ItControlFacultyWorkspace } from "@/features/components/portal/it-control-faculty-workspace"
import { ItControlEnrollmentOverrideWorkspace } from "@/features/components/portal/it-control-enrollment-override-workspace"
import { QueueKioskAccessWorkspace } from "@/features/components/portal/queue-kiosk-access-workspace"
import { AttritionAnalyticsWorkspace } from "@/features/components/portal/attrition-analytics-workspace"
import { HonorsWorkspace } from "@/features/components/portal/honors-workspace"
import { CashierCorRecordsWorkspace } from "@/features/components/portal/cashier-cor-records-workspace"

export type ConnectedModuleId =
  | "student-records"
  | "student-information"
  | "availability-preferences"
  | "teaching-schedule"
  | "program-chair-enrollment"
  | "subjects-prerequisites"
  | "schedule-faculty-loading"
  | "rooms"
  | "schedule-proposals"
  | "program-chair-analytics"
  | "registrar-analytics"
  | "schedule-approvals"
  | "curriculum-approvals"
  | "master-schedule"
  | "audit-logs"
  | "enrollment"
  | "grade-approvals"
  | "academic-transcripts"
  | "enrollment-approvals"
  | "overrides-voids"
  | "payment-queue"
  | "payment-records"
  | "cor-records"
  | "queue-kiosk-access"
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
  | "it-control-students"
  | "it-control-faculty"
  | "it-control-enrollment-override"
  | "attrition-analytics"
  | "honors"

export type PortalModuleComponent = ComponentType

export const connectedModuleIds = [
  "student-records",
  "student-information",
  "availability-preferences",
  "teaching-schedule",
  "program-chair-enrollment",
  "subjects-prerequisites",
  "schedule-faculty-loading",
  "rooms",
  "schedule-proposals",
  "program-chair-analytics",
  "registrar-analytics",
  "schedule-approvals",
  "curriculum-approvals",
  "master-schedule",
  "audit-logs",
  "enrollment",
  "grade-approvals",
  "academic-transcripts",
  "enrollment-approvals",
  "overrides-voids",
  "payment-queue",
  "payment-records",
  "cor-records",
  "queue-kiosk-access",
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
  "it-control-students",
  "it-control-faculty",
  "it-control-enrollment-override",
  "attrition-analytics",
  "honors",
] as const satisfies readonly ConnectedModuleId[]

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
const enrollmentOverrideWorkspace: PortalModuleComponent = () => (
  <ItControlEnrollmentOverrideWorkspace />
)
const scheduleFacultyLoadingWorkspace: PortalModuleComponent = () => (
  <ScheduleFacultyLoadingWorkspace />
)
const roomsOperationsWorkspace: PortalModuleComponent = () => (
  <RoomsOperationsWorkspace />
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
  "student-records": StudentRecordsWorkspace,
  "student-information": StudentInformationWorkspace,
  "availability-preferences": availabilityPreferencesWorkspace,
  "teaching-schedule": teachingScheduleWorkspace,
  "program-chair-enrollment": programChairEnrollmentWorkspace,
  "subjects-prerequisites": curriculumWorkspace,
  "schedule-faculty-loading": scheduleFacultyLoadingWorkspace,
  rooms: roomsOperationsWorkspace,
  "schedule-proposals": scheduleProposalsWorkspace,
  "program-chair-analytics": AnalyticsDashboardWorkspace,
  "registrar-analytics": AnalyticsDashboardWorkspace,
  "schedule-approvals": ScheduleDecisionWorkspace,
  "curriculum-approvals": CurriculumApprovalsWorkspace,
  "master-schedule": MasterScheduleWorkspace,
  "audit-logs": AuditLogsWorkspace,
  enrollment: EnrollmentWorkspace,
  "grade-approvals": gradeApprovalsWorkspace,
  "academic-transcripts": academicTranscriptsWorkspace,
  "enrollment-approvals": enrollmentApprovalsWorkspace,
  "overrides-voids": overridesVoidsWorkspace,
  "payment-queue": AccountingPaymentWorkspace,
  "payment-records": PaymentRecordsWorkspace,
  "cor-records": CashierCorRecordsWorkspace,
  "queue-kiosk-access": QueueKioskAccessWorkspace,
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
  "it-control-students": ItControlStudentsWorkspace,
  "it-control-faculty": ItControlFacultyWorkspace,
  "it-control-enrollment-override": enrollmentOverrideWorkspace,
  "attrition-analytics": AttritionAnalyticsWorkspace,
  honors: HonorsWorkspace,
}

export function isConnectedModuleId(
  moduleId: string,
): moduleId is ConnectedModuleId {
  return connectedModuleIds.includes(moduleId as ConnectedModuleId)
}
