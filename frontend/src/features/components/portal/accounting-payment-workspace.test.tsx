import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AccountingPaymentWorkspace } from "@/features/components/portal/accounting-payment-workspace"
import { renderWithSession } from "@/tests/render-app"

const paginationLinks = {
  first: "https://api.test/queue-tickets?page=1",
  last: "https://api.test/queue-tickets?page=1",
  prev: null,
  next: null,
}
const paginationMeta = {
  current_page: 1,
  last_page: 1,
  per_page: 20,
  total: 1,
}

const waitingTicket = {
  type: "queue_ticket",
  id: 1,
  enrollment_id: 9,
  student_number: "2026-0001",
  ticket_number: "Q000009",
  queue_date: "2026-07-30",
  status: "waiting",
  status_label: "Waiting",
  served_at: null,
} as const

const pendingPaymentEnrollment = {
  type: "enrollment",
  id: 9,
  student_id: 4,
  student_number: "2026-0001",
  academic_term_id: 2,
  status: "pending_payment",
  status_label: "Pending Payment",
  total_units: 3,
  submitted_at: "2026-07-30T00:00:00Z",
  registrar_decided_at: "2026-07-30T00:00:00Z",
  payment_confirmed_at: null,
  enrolled_at: null,
  subjects: [],
  queue_ticket: null,
} as const

const accountingSession = {
  userId: "6",
  displayName: "Accounting Staff",
  role: "accounting_staff",
  signedInAt: "2026-07-29T12:00:00Z",
} as const

function url(input: RequestInfo | URL) {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
}

function mockRoutes() {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const target = url(input)
    if (target.includes("/queue-tickets"))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [waitingTicket],
            links: paginationLinks,
            meta: paginationMeta,
          }),
        ),
      )
    if (target.includes("/enrollments") && init?.method === "POST")
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              enrollment: { ...pendingPaymentEnrollment, status: "enrolled" },
              payment: {
                external_reference: null,
                amount: null,
                confirmed_at: "2026-07-30T00:00:00Z",
              },
              document: {
                document_type: "com",
                document_number: "COM000009",
                generated_at: "2026-07-30T00:00:00Z",
              },
            },
          }),
          { status: 201 },
        ),
      )
    if (target.includes("/enrollments"))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [pendingPaymentEnrollment],
            links: paginationLinks,
            meta: paginationMeta,
          }),
        ),
      )
    return Promise.resolve(new Response(JSON.stringify({ data: [] })))
  }
}

describe("AccountingPaymentWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("does not render the queue for an unauthorized role", () => {
    fetchMock.mockImplementation(mockRoutes())
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: {
        userId: "1",
        displayName: "Student",
        role: "student",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
  })

  it("offers to call a waiting ticket and confirm a pending payment", async () => {
    fetchMock.mockImplementation(mockRoutes())
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    expect(await screen.findByText(/Q000009/)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Call to serve" }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole("button", { name: "Confirm payment" }),
    ).toBeInTheDocument()
  })

  it("confirms a payment and shows the generated Digital COM", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(mockRoutes())
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    await user.click(
      await screen.findByRole("button", { name: "Confirm payment" }),
    )
    const dialog = screen.getByRole("alertdialog")
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm payment" }),
    )

    expect(await screen.findByText(/COM000009/)).toBeInTheDocument()
  })
})
