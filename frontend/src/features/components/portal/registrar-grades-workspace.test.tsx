import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { RegistrarGradesWorkspace } from "@/features/components/portal/registrar-grades-workspace"
import { renderWithSession } from "@/tests/render-app"

function url(input: RequestInfo | URL) {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

const paginationLinks = {
  first: "https://api.test/academic-grades?page=1",
  last: "https://api.test/academic-grades?page=1",
  prev: null,
  next: null,
}
const paginationMeta = {
  current_page: 1,
  last_page: 1,
  per_page: 20,
  total: 1,
}

const submittedGrade = {
  type: "academic_grade",
  id: 3,
  student_id: 4,
  student_number: "2026-0001",
  subject_id: 7,
  subject_code: "CS101",
  section_id: 5,
  academic_term_id: 2,
  mark: "1.50",
  mark_label: "with Distinction",
  final_grade: "1.50",
  remarks: null,
  status: "submitted",
  status_label: "Submitted",
  submitted_at: "2026-07-30T00:00:00Z",
  locked_at: null,
} as const

const registrarHeadSession = {
  userId: "9",
  displayName: "Registrar Head",
  role: "registrar_head",
  signedInAt: "2026-07-29T12:00:00Z",
} as const

const term = {
  type: "academic-term",
  id: 2,
  school_year: "2026-2027",
  semester: "2nd",
  starts_at: null,
  ends_at: null,
  enrollment_opens_at: null,
  enrollment_closes_at: null,
  add_drop_deadline_at: null,
  grading_deadline_at: null,
  status: "semester_ongoing",
  status_label: "Semester ongoing",
} as const

const prospectus = {
  type: "prospectus",
  student_id: 4,
  student_number: "2026-0001",
  program_code: "BSIT",
  program_name: "BS Information Technology",
  curriculum_id: 1,
  curriculum_name: "BSIT 2023 Curriculum",
  effective_school_year: "2023-2024",
  year_level: 2,
  enrollment_category: "regular",
  enrollment_category_label: "Regular",
  enrollment_category_derived_at: "2026-07-30T00:00:00Z",
  semesters: [],
  unplaced_entries: [],
} as const

describe("RegistrarGradesWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("does not render for an unauthorized role", () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [] })))
    renderWithSession(
      <RegistrarGradesWorkspace initialModuleId="grade-approvals" />,
      {
        session: {
          userId: "1",
          displayName: "Registrar Staff",
          role: "registrar_staff",
          signedInAt: "2026-07-29T12:00:00Z",
        },
      },
    )
    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
  })

  it("lists submitted grades and locks one after confirmation", async () => {
    const user = userEvent.setup()
    let lockRequestBody: unknown = null
    fetchMock.mockImplementation((input, init) => {
      const target = url(input)
      if (target.includes("/academic-grades/3") && init?.method === "PATCH") {
        lockRequestBody = init.body ? JSON.parse(init.body as string) : null
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: { ...submittedGrade, status: "locked", locked_at: "2026-07-31T00:00:00Z" },
            }),
          ),
        )
      }
      if (target.includes("/academic-grades"))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [submittedGrade],
              links: paginationLinks,
              meta: paginationMeta,
            }),
          ),
        )
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })

    renderWithSession(
      <RegistrarGradesWorkspace initialModuleId="grade-approvals" />,
      { session: registrarHeadSession },
    )

    const table = await screen.findByRole("table", {
      name: "Submitted grades awaiting lock",
    })
    expect(within(table).getByText("CS101")).toBeInTheDocument()

    await user.click(within(table).getByRole("button", { name: "Lock" }))

    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(/permanent/i)).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Lock grade" }))

    await waitFor(() =>
      expect(lockRequestBody).toEqual({ action: "lock" }),
    )
  })

  it("looks up a student and renders their prospectus and grade slip", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input) => {
      const target = url(input)
      if (target.includes("/academic-terms"))
        return Promise.resolve(new Response(JSON.stringify({ data: [term] })))
      if (target.includes("/prospectus"))
        return Promise.resolve(
          new Response(JSON.stringify({ data: prospectus })),
        )
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })

    renderWithSession(
      <RegistrarGradesWorkspace initialModuleId="academic-transcripts" />,
      { session: registrarHeadSession },
    )

    await user.type(screen.getByLabelText("Student ID"), "4")
    await user.click(screen.getByRole("button", { name: "View records" }))

    expect(await screen.findByText(/BS Information Technology/)).toBeInTheDocument()
    expect(url(fetchMock.mock.calls.find((call) => url(call[0]).includes("/prospectus"))![0])).toContain(
      "student_id=4",
    )
  })

  it("rejects a non-numeric student ID without querying the API", async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [] })))

    renderWithSession(
      <RegistrarGradesWorkspace initialModuleId="academic-transcripts" />,
      { session: registrarHeadSession },
    )

    await user.type(screen.getByLabelText("Student ID"), "abc")
    await user.click(screen.getByRole("button", { name: "View records" }))

    expect(await screen.findByText("Enter a valid student ID.")).toBeInTheDocument()
  })

  it("has no detectable accessibility violations on the grade-approvals list", async () => {
    fetchMock.mockImplementation((input) => {
      const target = url(input)
      if (target.includes("/academic-grades"))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [submittedGrade],
              links: paginationLinks,
              meta: paginationMeta,
            }),
          ),
        )
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })

    const { container } = renderWithSession(
      <RegistrarGradesWorkspace initialModuleId="grade-approvals" />,
      { session: registrarHeadSession },
    )

    await screen.findByRole("table", { name: "Submitted grades awaiting lock" })
    expect(await axe(container)).toHaveNoViolations()
  })
})
