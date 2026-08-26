import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { RegistrarRecordsWorkspace } from "@/features/components/portal/registrar-records-workspace"
import { renderWithSession } from "@/tests/render-app"

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

const registrarSession = {
  userId: "9",
  displayName: "Registrar Staff",
  role: "registrar_staff" as const,
  signedInAt: "2026-07-30T00:00:00Z",
}

function paginated(entries: unknown[]) {
  return {
    data: entries,
    links: { first: "http://x/1", last: "http://x/1", prev: null, next: null },
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 20,
      total: entries.length,
    },
  }
}

const pendingCredit = {
  type: "transferee_credit",
  id: 1,
  student_id: 30,
  student_number: "2026-0002",
  source_institution: "Other University",
  source_subject_code: "MATH101",
  source_subject_title: "Calculus 1",
  source_grade: "1.75",
  credited_units: 3,
  subject_id: null,
  subject_code: null,
  status: "pending",
  status_label: "Pending",
  processed_at: null,
  created_at: "2026-07-01T00:00:00Z",
}

const pendingWithdrawal = {
  type: "withdrawal_request",
  id: 2,
  enrollment_id: 55,
  student_number: "2026-0003",
  reason: "Personal reasons",
  status: "pending",
  status_label: "Pending",
  processed_at: null,
  created_at: "2026-07-01T00:00:00Z",
}

function stubEmptyRoutes(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
  fetchMock.mockImplementation(() =>
    Promise.resolve(new Response(JSON.stringify(paginated([])))),
  )
}

describe("RegistrarRecordsWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("is not available for a non-registrar-staff role", () => {
    renderWithSession(
      <RegistrarRecordsWorkspace initialModuleId="credit-mappings" />,
      { session: { ...registrarSession, role: "student" } },
    )

    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("shows only the credit-mappings module when routed there", async () => {
    stubEmptyRoutes(fetchMock)
    renderWithSession(
      <RegistrarRecordsWorkspace initialModuleId="credit-mappings" />,
      { session: registrarSession },
    )

    expect(
      await screen.findByRole("heading", { name: "Credit mappings" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Record a transferee credit" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Withdrawal requests" }),
    ).not.toBeInTheDocument()
  })

  it("shows only the drops-withdrawals module when routed there", async () => {
    stubEmptyRoutes(fetchMock)
    renderWithSession(
      <RegistrarRecordsWorkspace initialModuleId="drops-withdrawals" />,
      { session: registrarSession },
    )

    expect(
      await screen.findByRole("heading", { name: "Drops & withdrawals" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Withdrawal requests" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Record a transferee credit" }),
    ).not.toBeInTheDocument()
  })

  it("lists pending transferee credits with Approve/Reject actions", async () => {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes("/transferee-credits")) {
        return Promise.resolve(
          new Response(JSON.stringify(paginated([pendingCredit]))),
        )
      }
      return Promise.resolve(new Response(JSON.stringify(paginated([]))))
    })
    renderWithSession(
      <RegistrarRecordsWorkspace initialModuleId="credit-mappings" />,
      { session: registrarSession },
    )

    const table = await screen.findByRole("table", {
      name: "Transferee credits",
    })
    expect(within(table).getByText("2026-0002")).toBeInTheDocument()
    expect(
      within(table).getByRole("button", { name: "Approve" }),
    ).toBeInTheDocument()
    expect(
      within(table).getByRole("button", { name: "Reject" }),
    ).toBeInTheDocument()
  })

  it("requires a reason before confirming a rejection, with a visible message", async () => {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes("/transferee-credits")) {
        return Promise.resolve(
          new Response(JSON.stringify(paginated([pendingCredit]))),
        )
      }
      return Promise.resolve(new Response(JSON.stringify(paginated([]))))
    })
    const user = userEvent.setup()
    renderWithSession(
      <RegistrarRecordsWorkspace initialModuleId="credit-mappings" />,
      { session: registrarSession },
    )

    const table = await screen.findByRole("table", {
      name: "Transferee credits",
    })
    await user.click(within(table).getByRole("button", { name: "Reject" }))

    const dialog = screen.getByRole("alertdialog")
    const confirmButton = within(dialog).getByRole("button", {
      name: "Confirm decision",
    })
    expect(confirmButton).toBeDisabled()
    expect(
      within(dialog).getByText("Reason is required to reject."),
    ).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText("Reason"), "Not eligible")
    expect(confirmButton).toBeEnabled()
  })

  it("lists pending withdrawal requests", async () => {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes("/withdrawal-requests")) {
        return Promise.resolve(
          new Response(JSON.stringify(paginated([pendingWithdrawal]))),
        )
      }
      return Promise.resolve(new Response(JSON.stringify(paginated([]))))
    })
    renderWithSession(
      <RegistrarRecordsWorkspace initialModuleId="drops-withdrawals" />,
      { session: registrarSession },
    )

    const table = await screen.findByRole("table", {
      name: "Withdrawal requests",
    })
    expect(within(table).getByText("2026-0003")).toBeInTheDocument()
    expect(within(table).getByText("Personal reasons")).toBeInTheDocument()
  })

  it("shows the academic records module read-only", async () => {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes("/academic-grades")) {
        return Promise.resolve(
          new Response(
            JSON.stringify(
              paginated([
                {
                  type: "academic_grade",
                  id: 5,
                  student_id: 30,
                  student_number: "2026-0002",
                  subject_id: 101,
                  subject_code: "CS101",
                  section_id: 44,
                  academic_term_id: 1,
                  mark: "1.50",
                  mark_label: "with Distinction",
                  final_grade: "1.50",
                  remarks: null,
                  status: "locked",
                  status_label: "Locked",
                  submitted_at: "2026-07-01T00:00:00Z",
                  locked_at: "2026-07-01T00:00:00Z",
                },
              ]),
            ),
          ),
        )
      }
      return Promise.resolve(new Response(JSON.stringify(paginated([]))))
    })
    renderWithSession(
      <RegistrarRecordsWorkspace initialModuleId="academic-records" />,
      { session: registrarSession },
    )

    const table = await screen.findByRole("table", {
      name: "Academic records",
    })
    expect(within(table).getByText("1.50")).toBeInTheDocument()
    expect(within(table).queryByRole("button")).not.toBeInTheDocument()
  })

  it("shows the enrollment documents module read-only", async () => {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes("/enrollment-documents")) {
        return Promise.resolve(
          new Response(
            JSON.stringify(
              paginated([
                {
                  type: "enrollment_document",
                  id: 7,
                  enrollment_id: 55,
                  student_number: "2026-0003",
                  document_type: "cor",
                  document_type_label: "Certificate of Registration",
                  document_number: "COR-2026-0001",
                  generated_at: "2026-07-01T00:00:00Z",
                },
              ]),
            ),
          ),
        )
      }
      return Promise.resolve(new Response(JSON.stringify(paginated([]))))
    })
    renderWithSession(
      <RegistrarRecordsWorkspace initialModuleId="enrollment-documents" />,
      { session: registrarSession },
    )

    const table = await screen.findByRole("table", {
      name: "Enrollment documents",
    })
    expect(within(table).getByText("COR-2026-0001")).toBeInTheDocument()
  })

  it("shows empty states for each module with nothing recorded", async () => {
    stubEmptyRoutes(fetchMock)
    renderWithSession(
      <RegistrarRecordsWorkspace initialModuleId="credit-mappings" />,
      { session: registrarSession },
    )

    expect(
      await screen.findByText("No transferee credits have been recorded yet."),
    ).toBeInTheDocument()
  })

  it("shows an authorization error when the server denies a 403 for this registrar-scoped module", async () => {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes("/transferee-credits")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "FORBIDDEN",
                message: "You are not authorized to view this module.",
                errors: {},
                request_id: "request-403",
              },
            }),
            { status: 403 },
          ),
        )
      }
      return Promise.resolve(new Response(JSON.stringify(paginated([]))))
    })
    renderWithSession(
      <RegistrarRecordsWorkspace initialModuleId="credit-mappings" />,
      { session: registrarSession },
    )

    expect(await screen.findByText("You don't have access")).toBeInTheDocument()
    expect(
      screen.getByText("You are not authorized to view this module."),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument()
  })

  it("shows a not-found error when the requested records module returns 404", async () => {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes("/transferee-credits")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "NOT_FOUND",
                message: "The requested records could not be found.",
                errors: {},
                request_id: "request-404",
              },
            }),
            { status: 404 },
          ),
        )
      }
      return Promise.resolve(new Response(JSON.stringify(paginated([]))))
    })
    renderWithSession(
      <RegistrarRecordsWorkspace initialModuleId="credit-mappings" />,
      { session: registrarSession },
    )

    expect(await screen.findByText("Not found")).toBeInTheDocument()
    expect(
      screen.getByText("The requested records could not be found."),
    ).toBeInTheDocument()
  })

  it("shows a throttled message with the retry wait time when the server rate-limits the request", async () => {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes("/withdrawal-requests")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "THROTTLED",
                message: "Too many requests.",
                errors: {},
                request_id: "request-429",
              },
            }),
            { status: 429, headers: { "Retry-After": "30" } },
          ),
        )
      }
      return Promise.resolve(new Response(JSON.stringify(paginated([]))))
    })
    renderWithSession(
      <RegistrarRecordsWorkspace initialModuleId="drops-withdrawals" />,
      { session: registrarSession },
    )

    expect(await screen.findByText("Slow down")).toBeInTheDocument()
    expect(
      screen.getByText(/Try again in about 30 seconds/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes("/transferee-credits")) {
        return Promise.resolve(
          new Response(JSON.stringify(paginated([pendingCredit]))),
        )
      }
      return Promise.resolve(new Response(JSON.stringify(paginated([]))))
    })
    const { container } = renderWithSession(
      <RegistrarRecordsWorkspace initialModuleId="credit-mappings" />,
      { session: registrarSession },
    )

    await screen.findByRole("table", { name: "Transferee credits" })
    expect(await axe(container)).toHaveNoViolations()
  })
})
