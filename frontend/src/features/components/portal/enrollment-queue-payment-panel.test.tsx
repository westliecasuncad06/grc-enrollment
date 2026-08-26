import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { EnrollmentQueuePaymentPanel } from "@/features/components/portal/enrollment-queue-payment-panel"
import type { Enrollment } from "@/features/schemas/enrollment-schema"
import { renderWithSession } from "@/tests/render-app"

const baseEnrollment: Enrollment = {
  type: "enrollment",
  id: 9,
  student_id: 4,
  student_number: "2026-0001",
  student_name: null,
  student_year_level: null,
  student_financial_status: null,
  student_financial_status_label: null,
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

const liveQueueView = {
  type: "student_queue_view",
  stage: "pending_payment",
  can_claim: false,
  ticket: {
    ticket_number: "Q-LIVE-007",
    status: "waiting",
    status_label: "Waiting",
    priority: "regular",
    priority_label: "Regular",
    position: 2,
  },
  now_serving_ticket_number: "Q-LIVE-005",
  upcoming_ticket_numbers: ["Q-LIVE-006", "Q-LIVE-007"],
  cut_off_today: false,
} as const

describe("EnrollmentQueuePaymentPanel", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ data: liveQueueView }))),
    )
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("shows the enrollment id and status", () => {
    renderWithSession(
      <EnrollmentQueuePaymentPanel enrollment={baseEnrollment} />,
    )

    expect(screen.getByText("Enrollment #9")).toBeInTheDocument()
    expect(screen.getByText("Pending Registrar Approval")).toBeInTheDocument()
  })

  it("shows the assessed amount due and its breakdown once assessed", () => {
    renderWithSession(
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
    renderWithSession(
      <EnrollmentQueuePaymentPanel enrollment={baseEnrollment} />,
    )

    expect(screen.queryByText("Amount due")).not.toBeInTheDocument()
  })

  it("shows the payment confirmation date once paid", () => {
    renderWithSession(
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
    const { container } = renderWithSession(
      <EnrollmentQueuePaymentPanel enrollment={baseEnrollment} />,
    )

    expect(await axe(container)).toHaveNoViolations()
  })

  it("replaces the enrollment snapshot ticket with the current live queue view", async () => {
    renderWithSession(
      <EnrollmentQueuePaymentPanel
        enrollment={{
          ...baseEnrollment,
          status: "pending_payment",
          registrar_decided_at: "2026-07-31T00:00:00Z",
          queue_ticket: {
            ticket_number: "Q-STALE-001",
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

    const queueRegion = await screen.findByRole("region", {
      name: "Your Cashier queue",
    })
    expect(
      within(queueRegion).getAllByText("Q-LIVE-007").length,
    ).toBeGreaterThan(0)
    expect(screen.queryByText("Q-STALE-001")).not.toBeInTheDocument()
    expect(within(queueRegion).getByText("Q-LIVE-005")).toBeInTheDocument()
  })

  it("makes the live queue loading and retryable failure states explicit", async () => {
    const user = userEvent.setup()
    let resolveQueue: ((response: Response) => void) | undefined
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveQueue = resolve
        }),
    )

    renderWithSession(
      <EnrollmentQueuePaymentPanel enrollment={baseEnrollment} />,
    )

    expect(screen.getByText("Loading your Cashier queue…")).toBeInTheDocument()

    await waitFor(() => expect(resolveQueue).toBeTypeOf("function"))

    resolveQueue?.(
      new Response(JSON.stringify({ message: "Unavailable" }), {
        status: 400,
      }),
    )
    expect(
      await screen.findByRole("button", { name: "Retry queue status" }),
    ).toBeInTheDocument()

    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(new Response(JSON.stringify({ data: liveQueueView }))),
    )
    await user.click(screen.getByRole("button", { name: "Retry queue status" }))
    expect(
      await screen.findByRole("region", { name: "Your Cashier queue" }),
    ).toBeInTheDocument()
  })

  it("guides claim-eligible students to the Cashier kiosk without a claim action", async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              ...liveQueueView,
              can_claim: true,
              ticket: null,
            },
          }),
        ),
      ),
    )

    renderWithSession(
      <EnrollmentQueuePaymentPanel enrollment={baseEnrollment} />,
    )

    expect(
      await screen.findByText("Claim your number at the Cashier kiosk."),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /claim/i }),
    ).not.toBeInTheDocument()
  })
})
