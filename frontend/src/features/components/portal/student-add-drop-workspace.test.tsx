import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { StudentAddDropWorkspace } from "@/features/components/portal/student-add-drop-workspace"
import { renderWithSession } from "@/tests/render-app"

function url(input: RequestInfo | URL) {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

const paginationLinks = {
  first: "https://api.test/x?page=1",
  last: "https://api.test/x?page=1",
  prev: null,
  next: null,
}
const paginationMeta = {
  current_page: 1,
  last_page: 1,
  per_page: 20,
  total: 1,
}

const enrolledEnrollment = {
  type: "enrollment",
  id: 9,
  student_id: 4,
  student_number: "2026-0001",
  academic_term_id: 2,
  status: "enrolled",
  status_label: "Enrolled",
  total_units: 3,
  submitted_at: "2026-07-30T00:00:00Z",
  registrar_decided_at: "2026-07-30T00:00:00Z",
  payment_confirmed_at: "2026-07-30T00:00:00Z",
  enrolled_at: "2026-07-30T00:00:00Z",
  subjects: [
    {
      section_id: 5,
      subject_code: "CS101",
      subject_title: "Programming 1",
      status: "selected",
      status_label: "Selected",
    },
  ],
  queue_ticket: {
    ticket_number: "Q000009",
    queue_date: "2026-07-30",
    status: "waiting",
    status_label: "Waiting",
  },
} as const

const pendingApprovalEnrollment = {
  ...enrolledEnrollment,
  status: "pending_registrar_approval",
  status_label: "Pending Registrar Approval",
} as const

const heldSection = {
  type: "section",
  id: 5,
  academic_term_id: 2,
  subject_id: 7,
  section_code: "A",
  professor_id: null,
  schedule_days: "MWF",
  starts_at_time: "08:00:00",
  ends_at_time: "09:00:00",
  room: null,
  capacity: 40,
  capacity_source: "manual",
  viability_threshold: null,
  enrolled_count: 1,
  remaining_seats: 39,
  is_block_exclusive: false,
  status: "published",
  status_label: "Published",
} as const

const addableSection = {
  ...heldSection,
  id: 6,
  subject_id: 8,
  section_code: "B",
  enrolled_count: 0,
  remaining_seats: 40,
}

const subjects = [
  { type: "subject", id: 7, code: "CS101", title: "Programming 1", units: 3, status: "active", status_label: "Active", is_completion_only: false },
  { type: "subject", id: 8, code: "CS102", title: "Data Structures", units: 3, status: "active", status_label: "Active", is_completion_only: false },
] as const

const changeRequest = {
  type: "enrollment_change_request",
  id: 3,
  enrollment_id: 9,
  student_number: "2026-0001",
  request_type: "drop",
  request_type_label: "Drop subject",
  subject_code: "CS101",
  from_section_code: "A",
  to_section_code: null,
  reason: "Overloaded this term.",
  status: "pending",
  status_label: "Pending",
  decided_at: null,
  decision_reason: null,
  created_at: "2026-08-04T00:00:00Z",
} as const

const studentSession = {
  userId: "4",
  displayName: "Student",
  role: "student",
  signedInAt: "2026-07-29T12:00:00Z",
} as const

function mockRoutes(overrides: { enrollment?: unknown; onPost?: () => unknown } = {}) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const target = url(input)
    if (target.includes("/change-requests") && init?.method === "POST")
      return Promise.resolve(
        new Response(JSON.stringify(overrides.onPost?.() ?? { data: changeRequest }), {
          status: 201,
        }),
      )
    if (target.includes("/enrollment-change-requests"))
      return Promise.resolve(
        new Response(
          JSON.stringify({ data: [changeRequest], links: paginationLinks, meta: paginationMeta }),
        ),
      )
    if (target.includes("/enrollments"))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [overrides.enrollment ?? enrolledEnrollment],
            links: paginationLinks,
            meta: paginationMeta,
          }),
        ),
      )
    if (target.includes("/subjects"))
      return Promise.resolve(new Response(JSON.stringify({ data: subjects })))
    if (target.includes("/sections"))
      return Promise.resolve(
        new Response(JSON.stringify({ data: [heldSection, addableSection] })),
      )
    return Promise.resolve(new Response(JSON.stringify({ data: [] })))
  }
}

describe("StudentAddDropWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("does not render for an unauthorized role", () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [] })))
    renderWithSession(<StudentAddDropWorkspace />, {
      session: {
        userId: "1",
        displayName: "Registrar Head",
        role: "registrar_head",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
  })

  it("shows a not-yet-enrolled message before the enrollment is fully confirmed", async () => {
    fetchMock.mockImplementation(mockRoutes({ enrollment: pendingApprovalEnrollment }))
    renderWithSession(<StudentAddDropWorkspace />, { session: studentSession })

    expect(
      await screen.findByText(/open only once your enrollment is fully confirmed/),
    ).toBeInTheDocument()
  })

  it("lists current subjects and submits a drop request with a reason", async () => {
    const user = userEvent.setup()
    let postBody: unknown = null
    fetchMock.mockImplementation((input, init) => {
      const target = url(input)
      if (target.includes("/change-requests") && init?.method === "POST") {
        postBody = init.body ? JSON.parse(init.body as string) : null
        return Promise.resolve(new Response(JSON.stringify({ data: changeRequest }), { status: 201 }))
      }
      if (target.includes("/enrollment-change-requests"))
        return Promise.resolve(
          new Response(JSON.stringify({ data: [], links: paginationLinks, meta: paginationMeta })),
        )
      if (target.includes("/enrollments"))
        return Promise.resolve(
          new Response(
            JSON.stringify({ data: [enrolledEnrollment], links: paginationLinks, meta: paginationMeta }),
          ),
        )
      if (target.includes("/subjects"))
        return Promise.resolve(new Response(JSON.stringify({ data: subjects })))
      if (target.includes("/sections"))
        return Promise.resolve(new Response(JSON.stringify({ data: [heldSection, addableSection] })))
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })

    renderWithSession(<StudentAddDropWorkspace />, { session: studentSession })

    const table = await screen.findByRole("table", { name: "Your subjects" })
    expect(within(table).getByText("Programming 1")).toBeInTheDocument()

    await user.click(within(table).getByRole("button", { name: "Drop" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.type(within(dialog).getByLabelText("Reason"), "Overloaded this term.")
    await user.click(within(dialog).getByRole("button", { name: "Submit request" }))

    await vi.waitFor(() =>
      expect(postBody).toEqual({
        type: "drop",
        from_section_id: 5,
        reason: "Overloaded this term.",
      }),
    )
  })

  it("surfaces the backend's specific validation message instead of a generic fallback", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input, init) => {
      const target = url(input)
      if (target.includes("/change-requests") && init?.method === "POST")
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "VALIDATION_FAILED",
                message: "The submitted data is invalid.",
                errors: {
                  enrollment: [
                    "The add/drop window opens once enrollment closes for this term.",
                  ],
                },
                request_id: "test-request-id",
              },
            }),
            { status: 422 },
          ),
        )
      if (target.includes("/enrollment-change-requests"))
        return Promise.resolve(
          new Response(JSON.stringify({ data: [], links: paginationLinks, meta: paginationMeta })),
        )
      if (target.includes("/enrollments"))
        return Promise.resolve(
          new Response(
            JSON.stringify({ data: [enrolledEnrollment], links: paginationLinks, meta: paginationMeta }),
          ),
        )
      if (target.includes("/subjects"))
        return Promise.resolve(new Response(JSON.stringify({ data: subjects })))
      if (target.includes("/sections"))
        return Promise.resolve(new Response(JSON.stringify({ data: [heldSection, addableSection] })))
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })

    renderWithSession(<StudentAddDropWorkspace />, { session: studentSession })

    const table = await screen.findByRole("table", { name: "Your subjects" })
    await user.click(within(table).getByRole("button", { name: "Drop" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.type(within(dialog).getByLabelText("Reason"), "Overloaded this term.")
    await user.click(within(dialog).getByRole("button", { name: "Submit request" }))

    expect(
      await screen.findByText(
        "The add/drop window opens once enrollment closes for this term.",
      ),
    ).toBeInTheDocument()
  })

  it("shows the student's own request history", async () => {
    fetchMock.mockImplementation(mockRoutes())
    renderWithSession(<StudentAddDropWorkspace />, { session: studentSession })

    const table = await screen.findByRole("table", {
      name: "Your add/drop requests",
    })
    expect(within(table).getByText("Drop subject")).toBeInTheDocument()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    fetchMock.mockImplementation(mockRoutes())
    const { container } = renderWithSession(<StudentAddDropWorkspace />, {
      session: studentSession,
    })

    await screen.findByRole("table", { name: "Your subjects" })
    expect(await axe(container)).toHaveNoViolations()
  })
})
