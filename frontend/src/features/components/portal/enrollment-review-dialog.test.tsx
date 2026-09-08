import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { EnrollmentReviewDialog } from "@/features/components/portal/enrollment-review-dialog"
import { formatYearLevelOrdinal } from "@/features/lib/curriculum-ordinal"
import type { Enrollment } from "@/features/schemas/enrollment-schema"
import { renderWithSession } from "@/tests/render-app"

describe("EnrollmentReviewDialog & formatYearLevelOrdinal", () => {
  it("formats year levels as institutional ordinals", () => {
    expect(formatYearLevelOrdinal(1)).toBe("1ST YEAR")
    expect(formatYearLevelOrdinal(2)).toBe("2ND YEAR")
    expect(formatYearLevelOrdinal(3)).toBe("3RD YEAR")
    expect(formatYearLevelOrdinal(4)).toBe("4TH YEAR")
    expect(formatYearLevelOrdinal(null)).toBe("—")
    expect(formatYearLevelOrdinal(undefined)).toBe("—")
  })

  it("renders 1ST YEAR for a student with year_level 1", () => {
    const enrollment: Enrollment = {
      type: "enrollment",
      id: 30333,
      student_id: 1,
      student_number: "2026-06-01090",
      student_name: "Natividad A. Velasco",
      student_year_level: 1,
      student_financial_status: null,
      student_financial_status_label: null,
      academic_term_id: 1,
      status: "pending_registrar_approval",
      status_label: "Pending Registrar Approval",
      total_units: 30.5,
      requires_overload_approval: false,
      submitted_at: "2026-09-08T00:00:00Z",
      registrar_decided_at: null,
      payment_confirmed_at: null,
      enrolled_at: null,
      subjects: [],
      queue_ticket: null,
      assessment: null,
    }

    renderWithSession(
      <EnrollmentReviewDialog
        enrollment={enrollment}
        onOpenChange={() => {}}
      />,
    )

    expect(screen.getByText("1ST YEAR")).toBeInTheDocument()
    expect(screen.queryByText("Year 1")).not.toBeInTheDocument()
  })
})
