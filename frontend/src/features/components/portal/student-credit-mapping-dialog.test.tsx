import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { StudentCreditMappingDialog } from "@/features/components/portal/student-credit-mapping-dialog"
import { renderWithSession } from "@/tests/render-app"

const studentSession = {
  userId: "4",
  displayName: "Test Student",
  role: "student",
  signedInAt: "2026-07-29T12:00:00Z",
} as const

const mockCredit = {
  type: "transferee_credit",
  id: 1,
  student_id: 4,
  student_number: "2026-0001",
  source_institution: "University of the East",
  source_subject_code: "CS101",
  source_subject_title: "Computer Concepts",
  source_grade: "1.50",
  credited_units: 3,
  subject_id: 10,
  subject_code: "CS101",
  status: "pending",
  status_label: "Pending",
  processed_at: null,
  created_at: "2026-08-01T00:00:00Z",
}

function mockFetch(credits = [mockCredit]) {
  return vi.fn<typeof fetch>().mockImplementation((input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    const method = init?.method ?? "GET"

    if (url.includes("/transferee-credits") && method === "GET") {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: credits,
            links: {
              first: "http://localhost/api/v1/transferee-credits?page=1",
              last: "http://localhost/api/v1/transferee-credits?page=1",
              prev: null,
              next: null,
            },
            meta: { current_page: 1, last_page: 1, per_page: 20, total: credits.length },
          }),
        ),
      )
    }

    if (url.includes("/transferee-credits") && method === "POST") {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: { ...mockCredit, id: 2 },
          }),
          { status: 201 },
        ),
      )
    }

    return Promise.resolve(new Response(JSON.stringify({ data: [] })))
  })
}

describe("StudentCreditMappingDialog", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("renders trigger button and opens dialog", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("fetch", mockFetch())

    renderWithSession(<StudentCreditMappingDialog />, {
      session: studentSession,
    })

    const trigger = screen.getByRole("button", { name: /Request Credit Mapping/i })
    expect(trigger).toBeInTheDocument()

    await user.click(trigger)

    expect(await screen.findByRole("heading", { name: "Transferee Credit Mapping" })).toBeInTheDocument()
    expect(screen.getByLabelText(/Previous School/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Previous Subject Code/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Subject Title/i)).toBeInTheDocument()
    expect(await screen.findByText(/Your Credited & Pending Subjects/i)).toBeInTheDocument()
    expect(await screen.findByText(/CS101 — Computer Concepts/i)).toBeInTheDocument()
  })

  it("submits a credit mapping request for the student themselves and shows success feedback", async () => {
    const user = userEvent.setup()
    const fetchFn = mockFetch([])
    vi.stubGlobal("fetch", fetchFn)

    renderWithSession(<StudentCreditMappingDialog />, {
      session: studentSession,
    })

    await user.click(screen.getByRole("button", { name: /Request Credit Mapping/i }))
    await screen.findByRole("heading", { name: "Transferee Credit Mapping" })

    await user.type(screen.getByLabelText(/Previous School/i), "FEU Tech")
    await user.type(screen.getByLabelText(/Previous Subject Code/i), "PROG101")
    await user.type(screen.getByLabelText(/Subject Title/i), "Computer Programming 1")
    await user.type(screen.getByLabelText(/Grade Obtained/i), "1.25")
    await user.clear(screen.getByLabelText("Units"))
    await user.type(screen.getByLabelText("Units"), "1.5")
    await user.type(screen.getByLabelText("School Year"), "2023-2024")
    await user.type(screen.getByLabelText("Semester"), "1st Semester")

    await user.click(screen.getByRole("button", { name: /Submit Subject for Crediting/i }))

    expect(
      await screen.findByText(/Credit mapping request submitted/i),
    ).toBeInTheDocument()
    const post = fetchFn.mock.calls.find(([, init]) => init?.method === "POST")
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({
      source_institution: "FEU Tech",
      source_subject_code: "PROG101",
      source_subject_title: "Computer Programming 1",
      source_grade: "1.25",
      credited_units: 1.5,
      source_school_year: "2023-2024",
      source_semester: "1st Semester",
    })
  })

  it("does not need a subject code, and asks for the school year and semester the API requires", async () => {
    const user = userEvent.setup()
    const fetchFn = mockFetch([])
    vi.stubGlobal("fetch", fetchFn)
    renderWithSession(<StudentCreditMappingDialog />, { session: studentSession })

    await user.click(screen.getByRole("button", { name: /Request Credit Mapping/i }))
    await screen.findByRole("heading", { name: "Transferee Credit Mapping" })
    await user.type(screen.getByLabelText(/Previous School/i), "FEU Tech")
    await user.type(screen.getByLabelText(/Subject Title/i), "Computer Programming 1")

    await user.click(screen.getByRole("button", { name: /Submit Subject for Crediting/i }))
    expect(await screen.findByText(/enter the school year/i)).toBeInTheDocument()
    expect(fetchFn.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false)

    await user.type(screen.getByLabelText("School Year"), "2023-2024")
    await user.click(screen.getByRole("button", { name: /Submit Subject for Crediting/i }))
    expect(await screen.findByText(/enter the semester/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText("Semester"), "2nd")
    await user.click(screen.getByRole("button", { name: /Submit Subject for Crediting/i }))
    expect(
      await screen.findByText(/Credit mapping request submitted/i),
    ).toBeInTheDocument()
  })

  it("tells the student where each request is on its way", async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      "fetch",
      mockFetch([
        { ...mockCredit, id: 1, status: "pending", status_label: "Pending" },
        {
          ...mockCredit,
          id: 2,
          source_subject_title: "Statistics",
          status: "endorsed",
          status_label: "Endorsed",
        },
      ]),
    )
    renderWithSession(<StudentCreditMappingDialog />, { session: studentSession })

    await user.click(screen.getByRole("button", { name: /Request Credit Mapping/i }))

    expect(await screen.findByText("Awaiting Program Head")).toBeInTheDocument()
    expect(screen.getByText("Awaiting Registrar")).toBeInTheDocument()
  })

  it("has no detectable accessibility violations when open", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("fetch", mockFetch())

    const { container } = renderWithSession(<StudentCreditMappingDialog />, {
      session: studentSession,
    })

    await user.click(screen.getByRole("button", { name: /Request Credit Mapping/i }))
    await screen.findByRole("heading", { name: "Transferee Credit Mapping" })

    expect(await axe(container)).toHaveNoViolations()
  })
})
