import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  FileClock,
  FileText,
  FileSearch,
  FolderArchive,
  Gauge,
  GraduationCap,
  ListChecks,
  Lock,
  Medal,
  Network,
  NotebookText,
  ReceiptText,
  ScrollText,
  Settings2,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Waypoints,
  type LucideIcon,
} from "lucide-react"

import type { UserRole } from "@/features/auth/roles"

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

export const rolePortalDefinitions: Record<UserRole, RolePortalDefinition> = {
  student: {
    roleLabel: "Student",
    welcomeHeading: "Your enrollment path, organized in one place.",
    modules: [
      portalModule(
        "enrollment",
        "Enrollment",
        "Select sections and submit your enrollment for the term.",
        GraduationCap,
      ),
      portalModule(
        "grades",
        "Grades",
        "Browse your recorded grades by school year and semester, and view your full prospectus.",
        NotebookText,
      ),
      portalModule(
        "digital-com",
        "Certificate of Registration",
        "View and print your Certificate of Registration.",
        FileCheck2,
      ),
      portalModule(
        "student-information",
        "Student Information",
        "View your official information and request Admission-approved corrections.",
        UserCheck,
      ),
    ],
  },
  admission_staff: {
    roleLabel: "Admission Staff",
    welcomeHeading: "Guide applicant records toward enrollment readiness.",
    modules: [
      portalModule(
        "student-records",
        "Student Records",
        "Create accounts, maintain verified profiles, and decide student information changes.",
        Users,
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
        "Communicate teaching availability and subject preferences.",
        CalendarDays,
      ),
      portalModule(
        "teaching-schedule",
        "Teaching Schedule",
        "Review approved teaching assignments.",
        FileClock,
      ),
      portalModule(
        "class-rosters",
        "Class Rosters",
        "View the enrolled roster for each of your assigned sections.",
        ListChecks,
      ),
      portalModule(
        "grade-submission",
        "Grade Submission",
        "Encode, edit, and submit grades for students in your assigned sections.",
        ClipboardCheck,
      ),
    ],
  },
  program_chair: {
    roleLabel: "Program Chair",
    welcomeHeading: "Shape curriculum demand into a reviewable schedule.",
    modules: [
      portalModule(
        "program-chair-enrollment",
        "Enrollment",
        "Define curriculum capacities, review faculty input, and generate the term schedule.",
        GraduationCap,
      ),
      portalModule(
        "subjects-prerequisites",
        "Curriculum Editor",
        "Build each year level's subject list, units, and prerequisites.",
        Network,
      ),
      portalModule(
        "schedule",
        "Schedule",
        "Review and edit the generated section schedule and assignments for the selected term.",
        CalendarDays,
      ),
      portalModule(
        "faculty-loading",
        "Faculty Loading",
        "Set the faculty load threshold, review the load report, and manage the faculty workforce.",
        Gauge,
      ),
      portalModule(
        "rooms",
        "Rooms",
        "Review room availability, capacity, and scheduled physical-week use before assigning a section.",
        Building2,
      ),
      portalModule(
        "schedule-proposals",
        "Schedule Proposals",
        "Prepare schedule drafts for authorized review.",
        FileText,
      ),
      portalModule(
        "program-chair-analytics",
        "Analytics",
        "Descriptive, predictive, and prescriptive views built from your college's existing enrollment and forecast data.",
        BarChart3,
      ),
      portalModule(
        "faculty-invitations",
        "Invite Professors",
        "Invite a professor by email — they get a one-time code to set up their own account.",
        UserPlus,
      ),
    ],
  },
  dean: {
    roleLabel: "Dean",
    welcomeHeading: "Review academic plans and student progress signals.",
    modules: [
      portalModule(
        "schedule-approvals",
        "Enrollment",
        "Review submitted Program Chair enrollment plans and return them with notes when changes are needed.",
        ClipboardCheck,
      ),
      portalModule(
        "curriculum-approvals",
        "Curriculum Approvals",
        "Review curricula submitted by Program Chairs and record your decision.",
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
        "Review the live Dean's List after faculty submit complete term grades.",
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
        "Enrollment",
        "Review department enrollment plans, record decisions, and publish approved schedules.",
        CalendarDays,
      ),
      portalModule(
        "curriculum-approvals",
        "Curriculum Approvals",
        "Review curricula submitted by Program Chairs and record your decision.",
        ClipboardCheck,
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
        "academic-terms",
        "Enrollment",
        "Create the school year and semester that starts the enrollment cycle.",
        GraduationCap,
      ),
      portalModule(
        "grade-approvals",
        "Grade Approvals",
        "Lock submitted grades so they count toward prerequisites and standing.",
        Lock,
      ),
      portalModule(
        "academic-transcripts",
        "Academic Transcripts",
        "View and print any student's prospectus and grade slip.",
        FileSearch,
      ),
      portalModule(
        "cor-records",
        "COR Records",
        "Find and print a student's confirmed Certificate of Registration history.",
        FileSearch,
      ),
      portalModule(
        "overrides-voids",
        "Overrides & Voids",
        "Void an already-approved enrollment before payment is confirmed, for authorized edge cases.",
        ShieldCheck,
      ),
      portalModule(
        "enrollment-change-requests",
        "Add/Drop Requests",
        "Approve or reject student add/drop/change-section requests.",
        ArrowLeftRight,
      ),
      portalModule(
        "attrition-analytics",
        "Attrition Analytics",
        "Review aggregate first-to-second semester enrollment attrition without student identities.",
        BarChart3,
      ),
      portalModule(
        "registrar-analytics",
        "Analytics",
        "Review official enrollment trends across all departments or focus on one department.",
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
        "Review traceable activity records within authorized controls.",
        FileText,
      ),
      portalModule(
        "policy-settings",
        "Policy Settings",
        "See where confirmed institutional policy values will eventually be configured.",
        Settings2,
      ),
      portalModule(
        "rooms",
        "Rooms",
        "Maintain the authoritative room inventory and review all scheduled room use.",
        Building2,
      ),
      portalModule(
        "staff-invitations",
        "Invite Staff",
        "Invite anyone into a GRC staff account by email — they get a one-time code to set up their own account.",
        UserPlus,
      ),
    ],
  },
  registrar_staff: {
    roleLabel: "Registrar Staff",
    welcomeHeading: "Maintain accurate enrollment and academic records.",
    modules: [
      portalModule(
        "enrollment-approvals",
        "Enrollment Approvals",
        "Approve or reject enrollment submissions pending registrar review. Approved students claim their Cashier queue number at the front desk.",
        ClipboardCheck,
      ),
      portalModule(
        "credit-mappings",
        "Credit Mappings",
        "Record and decide transferee credit mappings for admitted students.",
        Network,
      ),
      portalModule(
        "drops-withdrawals",
        "Drops & Withdrawals",
        "Approve or reject student withdrawal requests and release seats accordingly.",
        UserMinus,
      ),
      portalModule(
        "academic-records",
        "Academic Records",
        "View every student's academic grade records across the institution.",
        FolderArchive,
      ),
      portalModule(
        "enrollment-change-requests",
        "Add/Drop Requests",
        "View every student add/drop/change-section request.",
        ArrowLeftRight,
      ),
      portalModule(
        "enrollment-documents",
        "Enrollment Documents",
        "View every student's generated Certificate of Registration.",
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
        "Call the next student, confirm their payment, and generate the COR.",
        ReceiptText,
      ),
      portalModule(
        "payment-records",
        "Transaction History",
        "Review enrollment payments and balance-payment receipts.",
        ScrollText,
      ),
      portalModule(
        "cor-records",
        "COR Records",
        "Find and print confirmed Certificates of Registration for prior enrollments.",
        FileSearch,
      ),
      portalModule(
        "queue-kiosk-access",
        "Queue Kiosk Access",
        "Review the shared kiosk credential and rotate it before a controlled handoff.",
        Lock,
      ),
    ],
  },
  it_admin: {
    roleLabel: "IT Control",
    welcomeHeading:
      "Find authorized account records and support enrollment controls.",
    modules: [
      portalModule(
        "it-control-students",
        "Student Accounts",
        "Browse student accounts and copy a test login email for authorized support.",
        Users,
      ),
      portalModule(
        "it-control-faculty",
        "Faculty Accounts",
        "Browse faculty accounts and copy a test login email for authorized support.",
        UserCheck,
      ),
      portalModule(
        "it-control-enrollment-override",
        "Enrollment Overrides",
        "Review the authorized entry point for enrollment override controls.",
        ShieldCheck,
      ),
    ],
  },
  queue_kiosk: {
    roleLabel: "Queue Kiosk",
    welcomeHeading:
      "This device identity is available only through the dedicated Queue Kiosk.",
    modules: [],
  },
}

export function getRoleModule(
  role: UserRole,
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
