const DAY_MS = 24 * 60 * 60 * 1000
const MANILA_TIME_ZONE = "Asia/Manila"

/**
 * The one module a newly created Transferee or Returnee can open until the Registrar approves their
 * enrollment (ADR 0048): credit mapping, subject selection, payment and the queue number all live inside it.
 */
export const RESTRICTED_STUDENT_MODULE_ID = "enrollment"

/**
 * While the student profile carries an enrollment deadline the student has not had an enrollment
 * approved by the Registrar yet. Accounts that existed before the rule, and every other student type,
 * have none, and an unknown profile (still loading, or failed) never restricts anyone.
 */
export function isPortalRestricted(
  profile: { enrollment_deadline_at: string | null } | null | undefined,
): boolean {
  return profile?.enrollment_deadline_at != null
}

export interface EnrollmentDeadlineNotice {
  /** Whole days left, a partial day counted as a day; 0 once the deadline has passed. */
  daysLeft: number
  /** "in 7 days", "in 1 day" or "today". */
  countdown: string
  /** The deadline's calendar date in the school's time zone, e.g. "October 21, 2026". */
  dateLabel: string
}

export function enrollmentDeadlineNotice(
  deadlineAt: string,
  now: Date,
): EnrollmentDeadlineNotice {
  const deadline = new Date(deadlineAt)
  const daysLeft = Math.max(
    0,
    Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS),
  )

  return {
    daysLeft,
    countdown:
      daysLeft === 0
        ? "today"
        : `in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`,
    dateLabel: new Intl.DateTimeFormat("en-US", {
      timeZone: MANILA_TIME_ZONE,
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(deadline),
  }
}
