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
  student_name: null,
  student_year_level: null,
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

const studentAccount = {
  type: "student_account",
  student_id: 4,
  student_name: "Maria Santos",
  student_number: "2026-0001",
  year_level: 3,
  currency: "PHP",
  total_assessed: "9275.00",
  total_paid: "1000.00",
  prior_balance: "3500.00",
  outstanding_balance: "8275.00",
  has_promissory_note_on_file: true,
  entries: [
    {
      enrollment_id: 3,
      academic_term_id: 1,
      academic_term_label: "2025-2026 · 2nd",
      assessment_amount: "4500.00",
      confirmed_payment_amount: "1000.00",
      account_payment_amount: "0.00",
      outstanding_balance: "3500.00",
      promissory_note_on_file: true,
    },
    {
      enrollment_id: 9,
      academic_term_id: 2,
      academic_term_label: "2026-2027 · 1st",
      assessment_amount: "5775.00",
      confirmed_payment_amount: "0.00",
      account_payment_amount: "0.00",
      outstanding_balance: "5775.00",
      promissory_note_on_file: false,
    },
  ],
} as const

const cashierPaymentCandidate = {
  type: "cashier_payment_candidate",
  student_id: 5,
  student_name: "Juan Dela Cruz",
  student_number: "2026-0002",
  year_level: 3,
  enrollment_id: 10,
  ticket: {
    id: 2,
    ticket_number: "Q002",
    status: "waiting",
  },
} as const

const cashierPaymentCandidateNoTicket = {
  ...cashierPaymentCandidate,
  ticket: null,
} as const

const openCycle = {
  type: "queue_cycle",
  id: 1,
  opened_on: "2026-07-30",
  status: "open",
  status_label: "Open",
  cut_off_at: null,
  cut_off_service_date: null,
} as const

const cutOffCycle = {
  ...openCycle,
  status: "cut_off",
  status_label: "Cut off for today",
  cut_off_at: "2026-07-30T09:00:00Z",
  cut_off_service_date: "2026-07-30",
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
  overrides: {
    tickets?: readonly unknown[]
    candidate?: typeof cashierPaymentCandidate | typeof cashierPaymentCandidateNoTicket
    cycle?: typeof openCycle | typeof cutOffCycle | null
  } = {},
) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const target = url(input)
    if (target.includes("/cashier-payment-candidates"))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: overrides.candidate ?? cashierPaymentCandidate,
          }),
        ),
      )
    if (target.includes("/queue-cycle/cut-off"))
      return Promise.resolve(
        new Response(JSON.stringify({ data: overrides.cycle ?? cutOffCycle })),
      )
    if (target.includes("/queue-cycle/resume"))
      return Promise.resolve(
        new Response(JSON.stringify({ data: overrides.cycle ?? openCycle })),
      )
    if (target.includes("/queue-cycle"))
      return Promise.resolve(
        new Response(JSON.stringify({ data: overrides.cycle ?? null })),
      )
    if (target.includes("/queue-tickets") && init?.method === "POST")
      return Promise.resolve(
        new Response(JSON.stringify({ data: waitingTicket }), { status: 201 }),
      )
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
    if (target.includes("/students/4/account"))
      return Promise.resolve(
        new Response(JSON.stringify({ data: studentAccount })),
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
                promissory_note_on_file: false,
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

  it("shows a cut-off banner and lets the cashier resume the queue", async () => {
    // A static `mockRoutes({ cycle })` override applies to every
    // /queue-cycle route uniformly (GET, /cut-off, /resume alike), so it
    // cannot represent a real state transition -- the polled GET refetch
    // after "Resume queue" would keep echoing the same cutOffCycle value
    // forever. Track the transition locally instead, same pattern as
    // "refreshes the waiting list..." above.
    let resumed = false
    fetchMock.mockImplementation((input, init) => {
      const target = url(input)
      if (target.includes("/queue-cycle/resume")) {
        resumed = true
        return Promise.resolve(
          new Response(JSON.stringify({ data: openCycle })),
        )
      }
      if (target.includes("/queue-cycle") && !target.includes("cut-off"))
        return Promise.resolve(
          new Response(
            JSON.stringify({ data: resumed ? openCycle : cutOffCycle }),
          ),
        )
      return mockRoutes()(input, init)
    })
    const user = userEvent.setup()
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    expect(
      await screen.findByText(/the queue is cut off for today/i),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Resume queue" }))

    expect(
      await screen.findByRole("button", { name: "Cut off for today" }),
    ).toBeInTheDocument()
  })

  it("lets the cashier cut off the queue for today", async () => {
    // Same reasoning as above, mirrored for the open -> cut-off transition.
    let cutOff = false
    fetchMock.mockImplementation((input, init) => {
      const target = url(input)
      if (target.includes("/queue-cycle/cut-off")) {
        cutOff = true
        return Promise.resolve(
          new Response(JSON.stringify({ data: cutOffCycle })),
        )
      }
      if (target.includes("/queue-cycle") && !target.includes("resume"))
        return Promise.resolve(
          new Response(
            JSON.stringify({ data: cutOff ? cutOffCycle : openCycle }),
          ),
        )
      return mockRoutes()(input, init)
    })
    const user = userEvent.setup()
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    await user.click(
      await screen.findByRole("button", { name: "Cut off for today" }),
    )
    await user.click(screen.getByRole("button", { name: "Confirm cut-off" }))

    expect(
      await screen.findByText(/the queue is cut off for today/i),
    ).toBeInTheDocument()
  })

  it("shows an error and keeps the dialog open when cutting off the queue fails", async () => {
    fetchMock.mockImplementation((input, init) => {
      const target = url(input)
      if (target.includes("/queue-cycle/cut-off"))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "VALIDATION_FAILED",
                message: "Invalid",
                errors: { cycle: ["No queue is currently open."] },
                request_id: "request-cutoff-fail",
              },
            }),
            { status: 422 },
          ),
        )
      if (target.includes("/queue-cycle") && !target.includes("resume"))
        return Promise.resolve(
          new Response(JSON.stringify({ data: openCycle })),
        )
      return mockRoutes()(input, init)
    })
    const user = userEvent.setup()
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    await user.click(
      await screen.findByRole("button", { name: "Cut off for today" }),
    )
    await user.click(screen.getByRole("button", { name: "Confirm cut-off" }))

    expect(
      await screen.findByText(
        "The queue could not be cut off. Check the connection and try again.",
      ),
    ).toBeInTheDocument()
    // The dialog stays open on failure, matching every other write path in
    // this file (e.g. "Confirm payment"), so the cashier can retry.
    expect(
      screen.getByRole("button", { name: "Confirm cut-off" }),
    ).toBeInTheDocument()
  })

  it("shows an Issue queue ticket button when the candidate has no ticket yet", async () => {
    fetchMock.mockImplementation(
      mockRoutes({ candidate: cashierPaymentCandidateNoTicket }),
    )
    const user = userEvent.setup()
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    await user.type(
      screen.getByLabelText("Find student number"),
      "2026-0002",
    )
    await user.click(screen.getByRole("button", { name: "Find student" }))

    const issueButton = await screen.findByRole("button", {
      name: "Issue queue ticket",
    })
    await user.click(issueButton)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/queue-tickets"),
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("sorts a carry-over ticket from an earlier date ahead of a later one", async () => {
    const carryOver = { ...waitingTicket, id: 3, ticket_number: "Q000", queue_date: "2026-07-29", created_at: "2026-07-30T23:00:00Z" }
    fetchMock.mockImplementation(
      mockRoutes({ tickets: [servingTicket, carryOver, waitingTicket] }),
    )
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    const table = await screen.findByRole("table", { name: "Waiting" })
    const rows = await within(table).findAllByRole("row")
    // Q000's queue_date (07-29) is earlier than Q002's (07-30) despite a
    // LATER created_at timestamp -- proving queue_date, not just the
    // COALESCE effective-order, decides the tiebreak.
    expect(within(rows[1]).getByText("Q000")).toBeInTheDocument()
    expect(within(rows[2]).getByText("Q002")).toBeInTheDocument()
  })

  it("shows a serving student's cross-term balance and promissory-note state", async () => {
    fetchMock.mockImplementation(mockRoutes())
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    expect(await screen.findByText("Maria Santos")).toBeInTheDocument()
    expect(screen.getByText("Prior balance")).toBeInTheDocument()
    expect(screen.getByText("₱3,500.00")).toBeInTheDocument()
    expect(screen.getByText("Promissory note on file")).toBeInTheDocument()
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
    let paymentRequest: RequestInit | undefined
    fetchMock.mockImplementation((input, init) => {
      if (
        url(input).includes("/enrollments/9/payment") &&
        init?.method === "POST"
      ) {
        paymentRequest = init
      }
      return mockRoutes()(input, init)
    })
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    await screen.findByText("Q001")
    await user.click(screen.getByRole("button", { name: "Confirm payment" }))
    const dialog = screen.getByRole("alertdialog")
    expect(within(dialog).getByLabelText("Amount")).toHaveValue("5775.00")
    await user.click(
      within(dialog).getByRole("checkbox", {
        name: "Promissory note on file",
      }),
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm payment" }),
    )

    expect((await screen.findAllByText(/COM000009/)).length).toBeGreaterThan(0)
    await vi.waitFor(() => expect(paymentRequest).toBeDefined())
    expect(JSON.parse(paymentRequest?.body as string)).toEqual({
      promissory_note_on_file: true,
      amount: 5775,
    })
    expect(
      screen.getByRole("button", { name: "Print / download" }),
    ).toBeInTheDocument()
  })

  it("disables payment confirmation for the enrollment after it succeeds", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(mockRoutes())
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    await user.click(
      await screen.findByRole("button", { name: "Confirm payment" }),
    )
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Confirm payment",
      }),
    )

    expect(
      await screen.findByRole("button", { name: "Payment processed" }),
    ).toBeDisabled()
  })

  it("finds an eligible student but blocks serving them while another ticket is active", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(mockRoutes())
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    await user.type(screen.getByLabelText("Find student number"), "2026-0002")
    await user.click(screen.getByRole("button", { name: "Find student" }))

    expect(await screen.findByText("Juan Dela Cruz")).toBeInTheDocument()
    expect(
      screen.getByText("Skip the current ticket before serving this student."),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Serve selected student" }),
    ).not.toBeInTheDocument()
  })

  it("records a 500 balance payment without confirming the current enrollment or changing its ticket", async () => {
    const user = userEvent.setup()
    let accountRequest: RequestInit | undefined
    let enrollmentRequest: RequestInit | undefined
    let queueRequest: RequestInit | undefined
    fetchMock.mockImplementation((input, init) => {
      const target = url(input)
      if (target.includes("/students/4/account-payments")) {
        accountRequest = init
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: { ...studentAccount, outstanding_balance: "7775.00" },
            }),
            { status: 201 },
          ),
        )
      }
      if (target.includes("/students/4/account"))
        return Promise.resolve(
          new Response(JSON.stringify({ data: studentAccount })),
        )
      if (target.includes("/enrollments") && init?.method === "POST")
        enrollmentRequest = init
      if (target.includes("/queue-tickets/") && init?.method === "PATCH")
        queueRequest = init
      return mockRoutes()(input, init)
    })
    renderWithSession(<AccountingPaymentWorkspace />, {
      session: accountingSession,
    })

    await user.click(
      await screen.findByRole("button", { name: "Record balance payment" }),
    )
    const dialog = screen.getByRole("alertdialog")
    await user.type(
      within(dialog).getByLabelText("Balance payment amount"),
      "500",
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Record payment" }),
    )

    await vi.waitFor(() => expect(accountRequest).toBeDefined())
    expect(JSON.parse(accountRequest?.body as string)).toEqual({ amount: 500 })
    expect(enrollmentRequest).toBeUndefined()
    expect(queueRequest).toBeUndefined()
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
              data: skipped
                ? [waitingTicket, requeuedTicket]
                : [servingTicket, waitingTicket],
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
            JSON.stringify({
              data: { ...waitingTicket, priority: "priority" },
            }),
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
