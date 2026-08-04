import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { PaymentRecordsWorkspace } from "@/features/components/portal/payment-records-workspace"
import { renderWithSession } from "@/tests/render-app"

const paginationLinks = {
  first: "https://api.test/payments?page=1",
  last: "https://api.test/payments?page=1",
  prev: null,
  next: null,
}
const paginationMeta = {
  current_page: 1,
  last_page: 1,
  per_page: 20,
  total: 1,
}

const payment = {
  type: "payment",
  id: 1,
  enrollment_id: 9,
  student_number: "2026-0001",
  external_reference: "OR-000123",
  amount: "5775.00",
  confirmed_at: "2026-07-30T00:00:00Z",
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

describe("PaymentRecordsWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("does not render payment history for an unauthorized role", () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ data: [], links: paginationLinks, meta: paginationMeta }),
      ),
    )
    renderWithSession(<PaymentRecordsWorkspace />, {
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

  it("lists confirmed payments", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [payment],
          links: paginationLinks,
          meta: paginationMeta,
        }),
      ),
    )
    renderWithSession(<PaymentRecordsWorkspace />, {
      session: accountingSession,
    })

    const table = await screen.findByRole("table", { name: "Payment history" })
    expect(within(table).getByText("2026-0001")).toBeInTheDocument()
    expect(within(table).getByText("#9")).toBeInTheDocument()
    expect(within(table).getByText("₱5775.00")).toBeInTheDocument()
    expect(within(table).getByText("OR-000123")).toBeInTheDocument()
  })

  it("filters by confirmed date", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: [payment],
            links: paginationLinks,
            meta: paginationMeta,
          }),
        ),
      ).then((response) => {
        void url(input)
        return response
      }),
    )
    renderWithSession(<PaymentRecordsWorkspace />, {
      session: accountingSession,
    })

    await screen.findByRole("table", { name: "Payment history" })
    await user.type(screen.getByLabelText("Confirmed on"), "2026-08-01")

    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          url(input).includes("confirmed_on=2026-08-01"),
        ),
      ).toBe(true),
    )
  })

  it("allows Registrar Head to view payment history too", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [payment],
          links: paginationLinks,
          meta: paginationMeta,
        }),
      ),
    )
    renderWithSession(<PaymentRecordsWorkspace />, {
      session: {
        userId: "5",
        displayName: "Registrar Head",
        role: "registrar_head",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })

    expect(
      await screen.findByRole("table", { name: "Payment history" }),
    ).toBeInTheDocument()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [payment],
          links: paginationLinks,
          meta: paginationMeta,
        }),
      ),
    )
    const { container } = renderWithSession(<PaymentRecordsWorkspace />, {
      session: accountingSession,
    })

    await screen.findByRole("table", { name: "Payment history" })
    expect(await axe(container)).toHaveNoViolations()
  })
})
