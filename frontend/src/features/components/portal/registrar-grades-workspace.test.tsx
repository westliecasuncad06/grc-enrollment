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

const academicRecord = {
  type: "academic_record",
  student_id: 4,
  student_number: "2026-0001",
  program_code: "BSIT",
  program_name: "BS Information Technology",
  year_level: 2,
  enrollment_category: "regular",
  enrollment_category_label: "Regular",
  terms: [
    {
      academic_term_id: 2,
      school_year: "2026-2027",
      semester: "2nd",
      term_label: "2026-2027 · 2nd",
      rows: [],
      total_academic_units: 0,
      gpa_units: 0,
      gpa: null,
      excluded_from_gpa_count: 0,
    },
  ],
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

  it("looks up a student and renders their academic record", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input) => {
      const target = url(input)
      if (target.includes("/academic-record"))
        return Promise.resolve(
          new Response(JSON.stringify({ data: academicRecord })),
        )
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
    expect(
      url(
        fetchMock.mock.calls.find((call) =>
          url(call[0]).includes("/academic-record"),
        )![0],
      ),
    ).toContain("student_id=4")
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

  it("renders Department -> Professor -> Submitted Subjects hierarchy and filters by department", async () => {
    const user = userEvent.setup()
    const coeGrade = {
      ...submittedGrade,
      id: 10,
      student_number: "2026-0100",
      student_name: "Mercedes C. Ramos",
      subject_code: "ACC101",
      subject_title: "Accounting 1",
      section_code: "ACC101-A",
      professor_id: 425,
      professor_name: "Henry Nieva Corrales",
      college: "coe",
    }
    const ccsGrade = {
      ...submittedGrade,
      id: 11,
      student_number: "2026-0200",
      student_name: "Alan Turing",
      subject_code: "CS201",
      subject_title: "Object-Oriented Programming",
      section_code: "CS201-A",
      professor_id: 430,
      professor_name: "Maria Delos Santos",
      college: "ccs",
    }

    fetchMock.mockImplementation((input) => {
      const target = url(input)
      if (target.includes("/academic-grades")) {
        if (target.includes("college=ccs")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: [ccsGrade],
                links: paginationLinks,
                meta: { ...paginationMeta, total: 1 },
              }),
            ),
          )
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [coeGrade, ccsGrade],
              links: paginationLinks,
              meta: { ...paginationMeta, total: 2 },
            }),
          ),
        )
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })

    renderWithSession(
      <RegistrarGradesWorkspace initialModuleId="grade-approvals" />,
      { session: registrarHeadSession },
    )

    // Verify both professors render
    expect(
      await screen.findByText("Henry Nieva Corrales"),
    ).toBeInTheDocument()
    expect(screen.getByText("Maria Delos Santos")).toBeInTheDocument()

    // Verify subjects render
    expect(screen.getByText(/ACC101 — Accounting 1/)).toBeInTheDocument()
    expect(
      screen.getByText(/CS201 — Object-Oriented Programming/),
    ).toBeInTheDocument()

    // Filter by CCS department
    const filterGroup = screen.getByRole("group", {
      name: "Filter by department",
    })
    await user.click(within(filterGroup).getByRole("button", { name: "CCS" }))

    // Only CCS professor remains
    expect(await screen.findByText("Maria Delos Santos")).toBeInTheDocument()
    expect(
      screen.queryByText("Henry Nieva Corrales"),
    ).not.toBeInTheDocument()
  })

  it("switches to Grade History tab and searches historical locked records", async () => {
    const user = userEvent.setup()
    const historicalGrade = {
      ...submittedGrade,
      id: 99,
      student_number: "2018-0055",
      student_name: "Historical Student",
      subject_code: "MATH101",
      subject_title: "College Algebra",
      section_code: "MATH101-A",
      professor_id: 425,
      professor_name: "Henry Nieva Corrales",
      college: "cbae",
      school_year: "2018-2019",
      semester: "1st",
      status: "locked",
      status_label: "Official / Locked",
    }

    fetchMock.mockImplementation((input) => {
      const target = url(input)
      if (target.includes("/academic-grades")) {
        if (target.includes("status=locked")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: [historicalGrade],
                links: paginationLinks,
                meta: { ...paginationMeta, total: 1 },
              }),
            ),
          )
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [submittedGrade],
              links: paginationLinks,
              meta: paginationMeta,
            }),
          ),
        )
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })

    renderWithSession(
      <RegistrarGradesWorkspace initialModuleId="grade-approvals" />,
      { session: registrarHeadSession },
    )

    // Switch to Grade history tab
    const viewGroup = screen.getByRole("group", { name: "Approvals view" })
    await user.click(
      within(viewGroup).getByRole("button", { name: /Grade history/i }),
    )

    expect(
      await screen.findByRole("heading", { name: "Official Grade History" }),
    ).toBeInTheDocument()

    const historyTable = screen.getByRole("table", {
      name: "Official Grade History",
    })
    expect(
      within(historyTable).getByText("Historical Student"),
    ).toBeInTheDocument()
    expect(
      within(historyTable).getByText("2018-2019 · 1st"),
    ).toBeInTheDocument()
    expect(
      within(historyTable).getByText("College Algebra"),
    ).toBeInTheDocument()

    // Test search
    const searchInput = screen.getByLabelText("Search grade history")
    await user.type(searchInput, "2018-0055")
    await user.click(screen.getByRole("button", { name: "Search" }))

    expect(
      url(
        fetchMock.mock.calls.find((call) =>
          url(call[0]).includes("search=2018-0055"),
        )![0],
      ),
    ).toContain("status=locked")
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
