import {
  BadgeCheck,
  Ban,
  CalendarCheck,
  CircleDollarSign,
  FileCheck,
  type LucideIcon,
  Megaphone,
  UndoDot,
} from "lucide-react"

import type { UserRole } from "@/features/auth/roles"

export type NotificationTone = "neutral" | "success" | "warning" | "destructive"

export interface NotificationPresentation {
  label: string
  tone: NotificationTone
  icon: LucideIcon
}

// Keyed by `Notification.notification_type` (backend `NotificationType`
// enum). Deliberately a lookup with a default fallback rather than a
// `switch` that must be exhaustive — an unrecognized type (the backend adds
// one this build has not shipped yet) still renders sensibly instead of
// throwing or being filtered out.
const PRESENTATION_BY_TYPE: Record<string, NotificationPresentation> = {
  schedule_submitted_for_dean: {
    label: "Schedule submitted",
    tone: "neutral",
    icon: FileCheck,
  },
  schedule_dean_approved: {
    label: "Dean approved",
    tone: "success",
    icon: BadgeCheck,
  },
  schedule_executive_approved: {
    label: "Executive Director approved",
    tone: "success",
    icon: BadgeCheck,
  },
  schedule_returned: {
    label: "Returned for correction",
    tone: "destructive",
    icon: UndoDot,
  },
  schedule_published: {
    label: "Schedule published",
    tone: "success",
    icon: Megaphone,
  },
  enrollment_submitted: {
    label: "Enrollment submitted",
    tone: "neutral",
    icon: FileCheck,
  },
  enrollment_registrar_approved: {
    label: "Enrollment approved",
    tone: "success",
    icon: BadgeCheck,
  },
  enrollment_registrar_rejected: {
    label: "Enrollment rejected",
    tone: "destructive",
    icon: Ban,
  },
  enrollment_voided: {
    label: "Enrollment voided",
    tone: "destructive",
    icon: Ban,
  },
  enrollment_payment_confirmed: {
    label: "Payment confirmed",
    tone: "success",
    icon: CircleDollarSign,
  },
  academic_grade_locked: {
    label: "Grade locked",
    tone: "neutral",
    icon: FileCheck,
  },
  withdrawal_request_approved: {
    label: "Withdrawal approved",
    tone: "success",
    icon: BadgeCheck,
  },
  withdrawal_request_rejected: {
    label: "Withdrawal rejected",
    tone: "destructive",
    icon: Ban,
  },
  transferee_credit_approved: {
    label: "Transferee credit approved",
    tone: "success",
    icon: BadgeCheck,
  },
  transferee_credit_rejected: {
    label: "Transferee credit rejected",
    tone: "destructive",
    icon: Ban,
  },
  enrollment_category_reclassified: {
    label: "Enrollment standing updated",
    tone: "neutral",
    icon: CalendarCheck,
  },
  enrollment_change_request_submitted: {
    label: "Change request submitted",
    tone: "neutral",
    icon: FileCheck,
  },
  enrollment_change_request_approved: {
    label: "Change request approved",
    tone: "success",
    icon: BadgeCheck,
  },
  enrollment_change_request_rejected: {
    label: "Change request rejected",
    tone: "destructive",
    icon: Ban,
  },
}

const DEFAULT_PRESENTATION: NotificationPresentation = {
  label: "Notification",
  tone: "neutral",
  icon: CalendarCheck,
}

export function notificationPresentation(
  notificationType: string,
): NotificationPresentation {
  return PRESENTATION_BY_TYPE[notificationType] ?? DEFAULT_PRESENTATION
}

/**
 * Where clicking a notification should navigate. Deliberately scoped to the
 * schedule-proposal types this build introduces (plus the pre-existing
 * `schedule_published`) rather than every `NotificationType` — a full
 * type-to-module map for the other, unrelated notification kinds is outside
 * this task's scope and would just be guesswork about destinations this
 * change never touched.
 */
export function notificationDestinationPath(
  notificationType: string,
  role: UserRole,
): string | null {
  switch (notificationType) {
    case "schedule_submitted_for_dean":
      return role === "dean" ? "/portal/schedule-approvals" : null
    case "schedule_dean_approved":
      if (role === "executive_director") return "/portal/master-schedule"
      if (role === "program_chair") return "/portal/program-chair-enrollment"
      return null
    case "schedule_executive_approved":
      if (role === "dean") return "/portal/schedule-approvals"
      if (role === "program_chair") return "/portal/program-chair-enrollment"
      return null
    case "schedule_returned":
      return role === "program_chair" ? "/portal/program-chair-enrollment" : null
    case "schedule_published":
      if (role === "program_chair") return "/portal/program-chair-enrollment"
      if (role === "faculty") return "/portal/teaching-schedule"
      return null
    default:
      return null
  }
}
