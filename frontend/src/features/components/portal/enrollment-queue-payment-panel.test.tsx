import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { axe } from "vitest-axe"

import { EnrollmentQueuePaymentPanel } from "@/features/components/portal/enrollment-queue-payment-panel"
import type { Enrollment } from "@/features/schemas/enrollment-schema"

const baseEnrollment: Enrollment = {
  type: "enrollment",
  id: 9,
  student_id: 4,
  student_number: "2026-0001",
  academic_term_id: 2,
  status: "pending_registrar_approval",
  status_label: "Pending Registrar Approval",
  total_units: 3,
  requires_overload_approval: false,
  submitted_at: "2026-07-30T00:00:00Z",
  registrar_decided_at: null,
  payment_confirmed_at: null,
  enrolled_at: null,
  subjects: [],
  queue_ticket: null,
  assessment: null,
}

describe("EnrollmentQueuePaymentPanel", () => {
  it("shows the enrollment id and status", () => {
    render(<EnrollmentQueuePaymentPanel enrollment={baseEnrollment} />)

    expect(screen.getByText("Enrollment #9")).toBeInTheDocument()
    expect(screen.getByText("Pending Registrar Approval")).toBeInTheDocument()
  })

  it("shows a waiting message when pending registrar approval with no ticket", () => {
    render(<EnrollmentQueuePaymentPanel enrollment={baseEnrollment} />)

    expect(
      screen.getByText("Waiting for registrar approval — no queue number yet"),
    ).toBeInTheDocument()
  })

  it("shows the queue ticket once one is issued", () => {
    render(
      <EnrollmentQueuePaymentPanel
        enrollment={{
          ...baseEnrollment,
          status: "pending_payment",
          registrar_decided_at: "2026-07-31T00:00:00Z",
          queue_ticket: {
            ticket_number: "Q000001",
            queue_date: "2026-07-31",
            status: "waiting",
            status_label: "Waiting",
            priority: "regular",
            priority_label: "Regular",
            position: 0,
          },
        }}
      />,
    )

    expect(screen.getByText(/Q000001/)).toBeInTheDocument()
    expect(screen.getByText(/Waiting/)).toBeInTheDocument()
  })

  it("shows how many students are ahead when waiting", () => {
    render(
      <EnrollmentQueuePaymentPanel
        enrollment={{
          ...baseEnrollment,
          status: "pending_payment",
          registrar_decided_at: "2026-07-31T00:00:00Z",
          queue_ticket: {
            ticket_number: "Q000003",
            queue_date: "2026-07-31",
            status: "waiting",
            status_label: "Waiting",
            priority: "regular",
            priority_label: "Regular",
            position: 3,
          },
        }}
      />,
    )

    expect(
      screen.getByText("3 students are ahead of you."),
    ).toBeInTheDocument()
  })

  it("shows a next-in-line message when nobody is ahead", () => {
    render(
      <EnrollmentQueuePaymentPanel
        enrollment={{
          ...baseEnrollment,
          status: "pending_payment",
          registrar_decided_at: "2026-07-31T00:00:00Z",
          queue_ticket: {
            ticket_number: "Q000004",
            queue_date: "2026-07-31",
            status: "waiting",
            status_label: "Waiting",
            priority: "regular",
            priority_label: "Regular",
            position: 0,
          },
        }}
      />,
    )

    expect(screen.getByText("You're next in line.")).toBeInTheDocument()
  })

  it("does not show a position message once the ticket is being served", () => {
    render(
      <EnrollmentQueuePaymentPanel
        enrollment={{
          ...baseEnrollment,
          status: "pending_payment",
          registrar_decided_at: "2026-07-31T00:00:00Z",
          queue_ticket: {
            ticket_number: "Q000005",
            queue_date: "2026-07-31",
            status: "serving",
            status_label: "Serving",
            priority: "regular",
            priority_label: "Regular",
            position: null,
          },
        }}
      />,
    )

    expect(screen.queryByText(/ahead of you/)).not.toBeInTheDocument()
    expect(screen.queryByText(/next in line/)).not.toBeInTheDocument()
  })

  it("shows the assessed amount due and its breakdown once assessed", () => {
    render(
      <EnrollmentQueuePaymentPanel
        enrollment={{
          ...baseEnrollment,
          status: "pending_payment",
          registrar_decided_at: "2026-07-31T00:00:00Z",
          assessment: {
            total_amount: "5775.00",
            currency: "PHP",
            assessed_at: "2026-07-31T00:00:00Z",
            items: [
              {
                category: "tuition",
                category_label: "Tuition",
                label: "Tuition",
                quantity: "10.5",
                unit_amount: "450.00",
                amount: "4725.00",
              },
              {
                category: "miscellaneous",
                category_label: "Miscellaneous",
                label: "Registration",
                quantity: null,
                unit_amount: null,
                amount: "350.00",
              },
            ],
          },
        }}
      />,
    )

    expect(screen.getByText("₱5775.00")).toBeInTheDocument()
    expect(screen.getByText("₱4725.00")).toBeInTheDocument()
    expect(screen.getByText("₱350.00")).toBeInTheDocument()
    expect(screen.getByText("Registration")).toBeInTheDocument()
  })

  it("does not show an amount-due section before assessment", () => {
    render(<EnrollmentQueuePaymentPanel enrollment={baseEnrollment} />)

    expect(screen.queryByText("Amount due")).not.toBeInTheDocument()
  })

  it("shows the payment confirmation date once paid", () => {
    render(
      <EnrollmentQueuePaymentPanel
        enrollment={{
          ...baseEnrollment,
          status: "enrolled",
          registrar_decided_at: "2026-07-31T00:00:00Z",
          payment_confirmed_at: "2026-08-01T00:00:00Z",
          enrolled_at: "2026-08-01T00:00:00Z",
        }}
      />,
    )

    expect(
      screen.getByText(new Date("2026-08-01T00:00:00Z").toLocaleString()),
    ).toBeInTheDocument()
  })

  it("has no detectable accessibility violations", async () => {
    const { container } = render(
      <EnrollmentQueuePaymentPanel enrollment={baseEnrollment} />,
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})
