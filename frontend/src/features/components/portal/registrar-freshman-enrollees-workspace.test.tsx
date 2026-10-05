import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { RegistrarFreshmanEnrolleesWorkspace } from "@/features/components/portal/registrar-freshman-enrollees-workspace"
import { renderWithSession } from "@/tests/render-app"

const links = {
  first: "http://localhost/api/v1/freshman-enrollees?page=1",
  last: "http://localhost/api/v1/freshman-enrollees?page=1",
  prev: null,
  next: null,
}

function enrollee(overrides: Record<string, unknown>) {
  return {
    type: "freshman_enrollee",
    id: 1,
    student_number: "2026-10-00001",
    name: "Juan Dela Cruz",
    program_code: "BSIT",
    year_level: 1,
    status: "enrolled",
    status_label: "Enrolled",
    block_code: "IT101",
    amount_paid: "1000.00",
    ticket_number: "Q001",
    payment_confirmed_at: "2026-10-04T01:00:00Z",
    ...overrides,
  }
}

const rows = [
  enrollee({}),
  enrollee({
    id: 2,
    student_number: "2026-10-00002",
    name: "Maria Santos",
    status: "awaiting_section",
    status_label: "Awaiting a section",
    block_code: null,
    ticket_number: "Q002",
  }),
  enrollee({
    id: 3,
    student_number: "2026-10-00003",
    name: "Pedro Reyes",
    status: "awaiting_payment",
    status_label: "Awaiting payment",
    block_code: null,
    amount_paid: null,
    ticket_number: "Q003",
    payment_confirmed_at: null,
  }),
]

function urlOf(input: RequestInfo | URL): string {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
}

function session(role: "registrar_staff" | "registrar_head" | "student") {
  return {
    session: {
      userId: "1",
      displayName: "Someone",
      role,
      signedInAt: "2026-10-04T00:00:00Z",
    },
  }
}

describe("RegistrarFreshmanEnrolleesWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: rows,
            links,
            meta: { current_page: 1, last_page: 1, per_page: 20, total: 3 },
          }),
        ),
      ),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it.each(["registrar_staff", "registrar_head"] as const)(
    "shows %s the freshmen with their section, status and payment",
    async (role) => {
      renderWithSession(<RegistrarFreshmanEnrolleesWorkspace />, session(role))

      const table = await screen.findByRole("table", {
        name: "Freshmen enrollees",
      })
      const enrolled = within(table).getByText("Juan Dela Cruz").closest("tr")!
      expect(within(enrolled).getByText("IT101")).toBeInTheDocument()
      expect(within(enrolled).getByText("Enrolled")).toBeInTheDocument()
      expect(within(enrolled).getByText(/1,000\.00/)).toBeInTheDocument()
      const waiting = within(table).getByText("Maria Santos").closest("tr")!
      expect(
        within(waiting).getByText("Awaiting a section"),
      ).toBeInTheDocument()
      const unpaid = within(table).getByText("Pedro Reyes").closest("tr")!
      expect(within(unpaid).getByText("Awaiting payment")).toBeInTheDocument()
    },
  )

  it("offers no way to change anything: it is a view only", async () => {
    renderWithSession(
      <RegistrarFreshmanEnrolleesWorkspace />,
      session("registrar_staff"),
    )

    await screen.findByRole("table", { name: "Freshmen enrollees" })

    expect(
      screen.queryByRole("button", { name: /approve|reject|void|confirm/i }),
    ).not.toBeInTheDocument()
  })

  it("asks for only the chosen status", async () => {
    const user = userEvent.setup()
    renderWithSession(
      <RegistrarFreshmanEnrolleesWorkspace />,
      session("registrar_head"),
    )
    await screen.findByRole("table", { name: "Freshmen enrollees" })

    await user.click(screen.getByRole("button", { name: "Awaiting a section" }))

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          urlOf(input).includes("status=awaiting_section"),
        ),
      ).toBe(true),
    )
  })

  it("searches by name or student number", async () => {
    const user = userEvent.setup()
    renderWithSession(
      <RegistrarFreshmanEnrolleesWorkspace />,
      session("registrar_staff"),
    )
    await screen.findByRole("table", { name: "Freshmen enrollees" })

    await user.type(screen.getByLabelText("Search freshmen"), "Maria")

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          urlOf(input).includes("search=Maria"),
        ),
      ).toBe(true),
    )
  })

  it("is not available to a student", () => {
    renderWithSession(
      <RegistrarFreshmanEnrolleesWorkspace />,
      session("student"),
    )

    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("has no detectable accessibility violations", async () => {
    const { container } = renderWithSession(
      <RegistrarFreshmanEnrolleesWorkspace />,
      session("registrar_head"),
    )
    await screen.findByRole("table", { name: "Freshmen enrollees" })

    expect(await axe(container)).toHaveNoViolations()
  })
})
