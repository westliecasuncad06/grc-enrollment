import { act, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

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

const servingTicket = {
  type: "queue_ticket",
  id: 1,
  enrollment_id: 9,
  student_number: "2026-0001",
  ticket_number: "Q001",
  queue_date: "2026-07-30",
  status: "serving",
  status_label: "Serving",
  priority: "regular",
  priority_label: "Regular",
  created_at: "2026-07-30T00:05:00Z",
  served_at: null,
  requeued_at: null,
} as const

const waitingTicket = {
  ...servingTicket,
  id: 2,
  enrollment_id: 10,
  student_number: "2026-0002",
  ticket_number: "Q002",
  status: "waiting",
  status_label: "Waiting",
  created_at: "2026-07-30T00:10:00Z",
} as const

const pendingPaymentEnrollment = {
  type: "enrollment",
  id: 9,
  student_id: 4,
  student_number: "2026-0001",
  student_financial_status: null,
  student_financial_status_label: null,
  academic_term_id: 2,
  status: "pending_payment",
  status_label: "Pending Payment",
  total_units: 10.5,
  requires_overload_approval: false,
  submitted_at: "2026-07-30T00:00:00Z",
  registrar_decided_at: "2026-07-30T00:00:00Z",
  payment_confirmed_at: null,
  enrolled_at: null,
  subjects: [],
  queue_ticket: null,
  assessment: {
    total_amount: "5775.00",
    currency: "PHP",
    assessed_at: "2026-07-30T00:00:00Z",
    items: [],
  },
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

function mockRoutes(
  overrides: { tickets?: readonly unknown[] } = {},
) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const target = url(input)
    if (target.includes("/queue-tickets"))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: overrides.tickets ?? [servingTicket, waitingTicket],
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
                amount: "5775.00",
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
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

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

  it("shows the currently serving ticket with its amount due", async () => {
    fetchMock.mockImplementation(mockRoutes())
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    expect(await screen.findByText("Q001")).toBeInTheDocument()
    expect(screen.getByText(/10.5 units/)).toBeInTheDocument()
    expect(screen.getByText(/₱5775.00/)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Confirm payment" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Call next →" }),
    ).toBeInTheDocument()

    const waitingRow = await screen.findByRole("table", { name: "Waiting" })
    expect(within(waitingRow).getByText("Q002")).toBeInTheDocument()
  })

  it("refreshes the waiting list when a new ticket appears without a page reload", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let ticketIssued = false
    fetchMock.mockImplementation((input, init) => {
      const target = url(input)
      if (target.includes("/queue-tickets"))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: ticketIssued ? [waitingTicket] : [],
              links: paginationLinks,
              meta: paginationMeta,
            }),
          ),
        )
      return mockRoutes()(input, init)
    })

    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    const table = await screen.findByRole("table", { name: "Waiting" })
    expect(within(table).queryByText("Q002")).not.toBeInTheDocument()

    ticketIssued = true
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })

    expect(await within(table).findByText("Q002")).toBeInTheDocument()
  })

  it("shows the student's financial status as a badge when set", async () => {
    fetchMock.mockImplementation((input, init) => {
      const target = url(input)
      if (target.includes("/enrollments") && init?.method !== "POST")
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  ...pendingPaymentEnrollment,
                  student_financial_status: "scholar",
                  student_financial_status_label: "Scholar",
                },
              ],
              links: paginationLinks,
              meta: paginationMeta,
            }),
          ),
        )
      return mockRoutes()(input, init)
    })
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    expect(await screen.findByText("Q001")).toBeInTheDocument()
    expect(screen.getByText("Scholar")).toBeInTheDocument()
  })

  it("calls the next waiting ticket when nobody is being served", async () => {
    const user = userEvent.setup()
    let servedRequest: RequestInit | undefined
    fetchMock.mockImplementation((input, init) => {
      const target = url(input)
      if (target.includes("/queue-tickets/2") && init?.method === "PATCH") {
        servedRequest = init
        return Promise.resolve(
          new Response(
            JSON.stringify({ data: { ...waitingTicket, status: "serving" } }),
          ),
        )
      }
      return mockRoutes({ tickets: [waitingTicket] })(input, init)
    })
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    expect(
      await screen.findByText("No one is currently being served."),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Call next →" }))

    await vi.waitFor(() => expect(servedRequest).toBeDefined())
    expect(JSON.parse(servedRequest?.body as string)).toEqual({
      action: "serve",
    })
  })

  it("confirms a payment pre-filled with the assessed total and shows the generated Digital COM", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(mockRoutes())
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    await screen.findByText("Q001")
    await user.click(screen.getByRole("button", { name: "Confirm payment" }))
    const dialog = screen.getByRole("alertdialog")
    expect(within(dialog).getByLabelText("Amount")).toHaveValue("5775.00")
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm payment" }),
    )

    expect((await screen.findAllByText(/COM000009/)).length).toBeGreaterThan(0)
    expect(
      screen.getByRole("button", { name: "Print / download" }),
    ).toBeInTheDocument()
  })

  it("requeues the currently serving ticket to the back of the waiting line", async () => {
    const user = userEvent.setup()
    let skipped = false
    const requeuedTicket = {
      ...servingTicket,
      status: "waiting",
      status_label: "Waiting",
      requeued_at: "2026-07-30T01:00:00Z",
    }
    fetchMock.mockImplementation((input, init) => {
      const target = url(input)
      if (target.includes("/queue-tickets/1") && init?.method === "PATCH") {
        skipped = true
        return Promise.resolve(
          new Response(JSON.stringify({ data: requeuedTicket })),
        )
      }
      if (target.includes("/queue-tickets"))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: skipped ? [waitingTicket, requeuedTicket] : [servingTicket, waitingTicket],
              links: paginationLinks,
              meta: paginationMeta,
            }),
          ),
        )
      return mockRoutes()(input, init)
    })
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    await screen.findByText("Q001")
    await user.click(screen.getByRole("button", { name: "Skip" }))

    const table = await screen.findByRole("table", { name: "Waiting" })
    const rows = await within(table).findAllByRole("row")
    // header row, then Q002 (never requeued) ahead of Q001 (just
    // requeued) -- proving the skipped ticket lands at the back, not
    // simply back in the list in its old (lower-id) position.
    expect(within(rows[1]).getByText("Q002")).toBeInTheDocument()
    expect(within(rows[2]).getByText("Q001")).toBeInTheDocument()
  })

  it("sorts a never-requeued ticket before a requeued one on an exact effective-order tie", async () => {
    // Both tickets share the same effective order instant -- the requeued
    // ticket's requeued_at equals the never-requeued ticket's created_at --
    // and the requeued ticket deliberately has the LOWER id, to prove the
    // requeued_at-IS-NOT-NULL regime split (not `id`) breaks the tie, same
    // as QueueTicket::position()/ListQueueTickets server-side.
    const requeuedWaitingTicket = {
      ...servingTicket,
      id: 1,
      ticket_number: "Q001",
      status: "waiting",
      status_label: "Waiting",
      created_at: "2026-07-30T00:00:00Z",
      requeued_at: "2026-07-30T02:00:00Z",
    }
    const neverRequeuedWaitingTicket = {
      ...servingTicket,
      id: 5,
      ticket_number: "Q005",
      status: "waiting",
      status_label: "Waiting",
      created_at: "2026-07-30T02:00:00Z",
      requeued_at: null,
    }
    fetchMock.mockImplementation(
      mockRoutes({
        tickets: [requeuedWaitingTicket, neverRequeuedWaitingTicket],
      }),
    )
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    const table = await screen.findByRole("table", { name: "Waiting" })
    const rows = await within(table).findAllByRole("row")
    // header row, then Q005 (never requeued, higher id) ahead of Q001
    // (requeued, lower id) -- proving the regime split, not `id`, breaks
    // the exact effective-order tie.
    expect(within(rows[1]).getByText("Q005")).toBeInTheDocument()
    expect(within(rows[2]).getByText("Q001")).toBeInTheDocument()
  })

  it("marks a waiting ticket priority", async () => {
    const user = userEvent.setup()
    let priorityRequest: RequestInit | undefined
    fetchMock.mockImplementation((input, init) => {
      const target = url(input)
      if (target.includes("/queue-tickets/2") && init?.method === "PATCH") {
        priorityRequest = init
        return Promise.resolve(
          new Response(
            JSON.stringify({ data: { ...waitingTicket, priority: "priority" } }),
          ),
        )
      }
      return mockRoutes()(input, init)
    })
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    const waitingTable = await screen.findByRole("table", { name: "Waiting" })
    await user.click(
      within(waitingTable).getByRole("button", { name: "Mark priority" }),
    )

    await vi.waitFor(() => expect(priorityRequest).toBeDefined())
    expect(JSON.parse(priorityRequest?.body as string)).toEqual({
      action: "mark_priority",
    })
  })

  it("renders each waiting ticket as a phone-sized action card", async () => {
    fetchMock.mockImplementation(mockRoutes())
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    const card = await screen.findByRole("article", {
      name: "Waiting ticket Q002",
    })
    expect(within(card).getByText("2026-0002")).toBeInTheDocument()
    expect(within(card).getByText("Amount due")).toBeInTheDocument()
    expect(within(card).getByText("—")).toBeInTheDocument()
    expect(
      within(card).getByRole("button", { name: "Mark priority" }),
    ).toBeInTheDocument()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    fetchMock.mockImplementation(mockRoutes())
    const { container } = renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    await screen.findByText("Q001")
    expect(await axe(container)).toHaveNoViolations()
  })
})
