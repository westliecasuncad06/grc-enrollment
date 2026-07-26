import {
  BadgeCheck,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  FileClock,
  FileText,
  FolderArchive,
  Gauge,
  GraduationCap,
  Hash,
  LibraryBig,
  ListChecks,
  Medal,
  Network,
  ReceiptText,
  ScrollText,
  Settings2,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserRoundCog,
  Users,
  Waypoints,
  type LucideIcon,
} from "lucide-react"

import type { DemoRole } from "@/app/auth/demo-auth-types"

export interface PortalModule {
  id: string
  label: string
  description: string
  icon: LucideIcon
}

export interface RolePortalDefinition {
  roleLabel: string
  welcomeHeading: string
  modules: readonly PortalModule[]
}

function portalModule(
  id: string,
  label: string,
  description: string,
  icon: LucideIcon,
): PortalModule {
  return { id, label, description, icon }
}

export const rolePortalDefinitions: Record<DemoRole, RolePortalDefinition> = {
  student: {
    roleLabel: "Student",
    welcomeHeading: "Your enrollment path, organized in one place.",
    modules: [
      portalModule(
        "enrollment",
        "Enrollment",
        "Preview the subject-selection and enrollment submission pathway.",
        GraduationCap,
      ),
      portalModule(
        "eligible-subjects",
        "Eligible Subjects",
        "Review where curriculum and prerequisite eligibility will appear.",
        BookOpen,
      ),
      portalModule(
        "queue-payment",
        "Queue & Payment",
        "Preview the payment-queue handoff after authorized approval.",
        CreditCard,
      ),
      portalModule(
        "grades-com",
        "Grades & Digital COM",
        "See the future home for released grades and finalized registration records.",
        FileCheck2,
      ),
    ],
  },
  admission_staff: {
    roleLabel: "Admission Staff",
    welcomeHeading: "Guide applicant records toward enrollment readiness.",
    modules: [
      portalModule(
        "student-accounts",
        "Student Accounts",
        "Preview account preparation for admitted students.",
        Users,
      ),
      portalModule(
        "admission-status",
        "Admission Status",
        "See where admission progress and record checks will be coordinated.",
        UserCheck,
      ),
      portalModule(
        "credential-issuance",
        "Credential Issuance",
        "Preview the controlled handoff of student access credentials.",
        BadgeCheck,
      ),
    ],
  },
  faculty: {
    roleLabel: "Professor / Faculty",
    welcomeHeading: "Prepare teaching commitments and class records.",
    modules: [
      portalModule(
        "availability-preferences",
        "Availability Preferences",
        "Preview the workspace for communicating teaching availability.",
        CalendarDays,
      ),
      portalModule(
        "teaching-schedule",
        "Teaching Schedule",
        "See where approved teaching assignments will be presented.",
        FileClock,
      ),
      portalModule(
        "class-rosters",
        "Class Rosters",
        "Preview authorized class-list access for assigned sections.",
        ListChecks,
      ),
      portalModule(
        "grade-submission",
        "Grade Submission",
        "See the future controlled workflow for submitting class grades.",
        ClipboardCheck,
      ),
    ],
  },
  program_chair: {
    roleLabel: "Program Chair",
    welcomeHeading: "Shape curriculum demand into a reviewable schedule.",
    modules: [
      portalModule(
        "curriculum",
        "Curriculum",
        "Preview curriculum structure and program requirements.",
        LibraryBig,
      ),
      portalModule(
        "subjects-prerequisites",
        "Subjects & Prerequisites",
        "See where subject relationships and eligibility rules will be managed.",
        Network,
      ),
      portalModule(
        "sections-schedules",
        "Sections & Schedules",
        "Preview section planning across rooms and meeting patterns.",
        CalendarDays,
      ),
      portalModule(
        "faculty-assignment",
        "Faculty Assignment",
        "See where instructors will be proposed for planned sections.",
        UserRoundCog,
      ),
      portalModule(
        "demand-forecast",
        "Demand Forecast",
        "Preview advisory demand signals without automatic enrollment decisions.",
        BarChart3,
      ),
      portalModule(
        "schedule-proposals",
        "Schedule Proposals",
        "Prepare schedule drafts for authorized review.",
        FileText,
      ),
    ],
  },
  dean: {
    roleLabel: "Dean",
    welcomeHeading: "Review academic plans and student progress signals.",
    modules: [
      portalModule(
        "schedule-approvals",
        "Schedule Approvals",
        "Preview the academic schedule review queue.",
        ClipboardCheck,
      ),
      portalModule(
        "enrollment-dashboard",
        "Enrollment Dashboard",
        "See where validated enrollment activity will be summarized.",
        Gauge,
      ),
      portalModule(
        "stuck-students",
        "Stuck Students",
        "Preview support-oriented exception signals for authorized review.",
        Waypoints,
      ),
      portalModule(
        "honors",
        "Honors",
        "See the future review space for validated academic distinctions.",
        Medal,
      ),
      portalModule(
        "reports",
        "Reports",
        "Preview role-authorized academic reporting.",
        BarChart3,
      ),
    ],
  },
  executive_director: {
    roleLabel: "Executive Director",
    welcomeHeading: "See the institution-wide enrollment picture.",
    modules: [
      portalModule(
        "master-schedule",
        "Master Schedule",
        "Preview the consolidated academic schedule view.",
        CalendarDays,
      ),
      portalModule(
        "institution-dashboard",
        "Institution Dashboard",
        "See where validated institution-level activity will be summarized.",
        Building2,
      ),
      portalModule(
        "kpis",
        "KPIs",
        "Preview governed performance indicators with future source definitions.",
        Gauge,
      ),
      portalModule(
        "reports",
        "Reports",
        "Preview institution-level reporting for authorized leadership.",
        BarChart3,
      ),
    ],
  },
  registrar_head: {
    roleLabel: "Registrar Head",
    welcomeHeading: "Govern enrollment decisions, controls, and records.",
    modules: [
      portalModule(
        "enrollment-approvals",
        "Enrollment Approvals",
        "Preview final registrar review of enrollment submissions.",
        ClipboardCheck,
      ),
      portalModule(
        "overrides-voids",
        "Overrides & Voids",
        "See where exceptional actions will require controlled authorization.",
        ShieldCheck,
      ),
      portalModule(
        "attrition-analytics",
        "Attrition Analytics",
        "Preview advisory student-support analytics without automatic denials.",
        BarChart3,
      ),
      portalModule(
        "compliance-reports",
        "Compliance Reports",
        "See where governed compliance exports will be prepared.",
        ScrollText,
      ),
      portalModule(
        "audit-logs",
        "Audit Logs",
        "Preview traceable activity records for authorized review.",
        FileText,
      ),
      portalModule(
        "policy-settings",
        "Policy Settings",
        "See where confirmed institutional policy values will eventually be configured.",
        Settings2,
      ),
    ],
  },
  registrar_staff: {
    roleLabel: "Registrar Staff",
    welcomeHeading: "Maintain accurate enrollment and academic records.",
    modules: [
      portalModule(
        "credit-mappings",
        "Credit Mappings",
        "Preview controlled mapping of approved academic credits.",
        Network,
      ),
      portalModule(
        "drops-withdrawals",
        "Drops & Withdrawals",
        "See the future idempotent record-change workflow.",
        UserMinus,
      ),
      portalModule(
        "academic-records",
        "Academic Records",
        "Preview authorized maintenance of official student records.",
        FolderArchive,
      ),
      portalModule(
        "enrollment-documents",
        "Enrollment Documents",
        "See where validated enrollment documents will be prepared.",
        FileText,
      ),
    ],
  },
  accounting_staff: {
    roleLabel: "Accounting Staff",
    welcomeHeading: "Move approved enrollment through payment confirmation.",
    modules: [
      portalModule(
        "payment-queue",
        "Payment Queue",
        "Preview the ordered queue of approved enrollment payments.",
        ReceiptText,
      ),
      portalModule(
        "serving-number",
        "Serving Number",
        "See where the active payment-queue number will be managed.",
        Hash,
      ),
      portalModule(
        "payment-confirmation",
        "Payment Confirmation",
        "Preview the controlled confirmation step after verified payment.",
        BadgeCheck,
      ),
      portalModule(
        "com-finalization",
        "COM Finalization",
        "See the future handoff that finalizes the Digital Certificate of Matriculation.",
        FileCheck2,
      ),
    ],
  },
}

export function getRoleModule(
  role: DemoRole,
  moduleId: string,
): PortalModule | null {
  return (
    rolePortalDefinitions[role].modules.find(
      (module) => module.id === moduleId,
    ) ?? null
  )
}

export const knownPortalModuleIds = new Set(
  Object.values(rolePortalDefinitions).flatMap(({ modules }) =>
    modules.map(({ id }) => id),
  ),
)
