import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { EnrollmentAddDropPanel } from "@/features/components/portal/enrollment-add-drop-panel"
import type { Enrollment } from "@/features/schemas/enrollment-schema"
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

const enrolledEnrollment: Enrollment = {
  type: "enrollment",
  id: 9,
  student_id: 4,
  student_number: "2026-0001",
  student_financial_status: null,
  student_financial_status_label: null,
  academic_term_id: 2,
  status: "enrolled",
  status_label: "Enrolled",
  total_units: 3,
  requires_overload_approval: false,
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
    priority: "regular",
    priority_label: "Regular",
    position: 0,
  },
  assessment: null,
}

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

function mockRoutes(overrides: { onPost?: () => unknown } = {}) {
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
    if (target.includes("/subjects"))
      return Promise.resolve(new Response(JSON.stringify({ data: subjects })))
    if (target.includes("/sections"))
      return Promise.resolve(
        new Response(JSON.stringify({ data: [heldSection, addableSection] })),
      )
    return Promise.resolve(new Response(JSON.stringify({ data: [] })))
  }
}

describe("EnrollmentAddDropPanel", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("shows the closed-window message instead of the form when the window is not open", () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [] })))
    renderWithSession(
      <EnrollmentAddDropPanel
        enrollment={enrolledEnrollment}
        windowOpen={false}
        windowMessage="The add/drop window opens once enrollment closes for this term."
        windowClosesAt={null}
      />,
      { session: studentSession },
    )

    expect(
      screen.getByText(
        "The add/drop window opens once enrollment closes for this term.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole("table", { name: "Your subjects" })).not.toBeInTheDocument()
  })

  it("lists current subjects and submits a drop request with a reason when the window is open", async () => {
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
      if (target.includes("/subjects"))
        return Promise.resolve(new Response(JSON.stringify({ data: subjects })))
      if (target.includes("/sections"))
        return Promise.resolve(new Response(JSON.stringify({ data: [heldSection, addableSection] })))
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })

    renderWithSession(
      <EnrollmentAddDropPanel
        enrollment={enrolledEnrollment}
        windowOpen={true}
        windowMessage="The add/drop window is open."
        windowClosesAt="2026-08-20T00:00:00Z"
      />,
      { session: studentSession },
    )

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

  it("shows the deadline reminder when the window is open", () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [] })))
    renderWithSession(
      <EnrollmentAddDropPanel
        enrollment={enrolledEnrollment}
        windowOpen={true}
        windowMessage="The add/drop window is open."
        windowClosesAt="2026-08-20T00:00:00Z"
      />,
      { session: studentSession },
    )

    expect(
      screen.getByText(/The add\/drop window closes/),
    ).toBeInTheDocument()
  })

  it("shows the student's own request history", async () => {
    fetchMock.mockImplementation(mockRoutes())
    renderWithSession(
      <EnrollmentAddDropPanel
        enrollment={enrolledEnrollment}
        windowOpen={true}
        windowMessage="The add/drop window is open."
        windowClosesAt={null}
      />,
      { session: studentSession },
    )

    const table = await screen.findByRole("table", {
      name: "Your add/drop requests",
    })
    expect(within(table).getByText("Drop subject")).toBeInTheDocument()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    fetchMock.mockImplementation(mockRoutes())
    const { container } = renderWithSession(
      <EnrollmentAddDropPanel
        enrollment={enrolledEnrollment}
        windowOpen={true}
        windowMessage="The add/drop window is open."
        windowClosesAt={null}
      />,
      { session: studentSession },
    )

    await screen.findByRole("table", { name: "Your subjects" })
    expect(await axe(container)).toHaveNoViolations()
  })
})
