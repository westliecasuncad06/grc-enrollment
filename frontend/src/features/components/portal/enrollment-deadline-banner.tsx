import { Clock } from "lucide-react"

import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { enrollmentDeadlineNotice } from "@/features/lib/enrollment-deadline"

/**
 * What a newly created Transferee or Returnee sees on every page they can reach (ADR 0048): the account
 * is deactivated when the deadline passes unless the Registrar has approved their enrollment, and the
 * other portal options appear only after that approval.
 */
export function EnrollmentDeadlineBanner({
  deadlineAt,
  now = new Date(),
}: {
  deadlineAt: string
  now?: Date
}) {
  const { countdown, dateLabel } = enrollmentDeadlineNotice(deadlineAt, now)

  return (
    <Alert className="portal-storage-alert">
      <Clock aria-hidden="true" />
      <AlertDescription>
        <strong>
          This account will be deactivated {countdown} ({dateLabel})
        </strong>{" "}
        unless your credit mapping is done and your enrollment is completed
        through payment. The other options unlock once the Registrar approves
        your enrollment.
      </AlertDescription>
    </Alert>
  )
}
