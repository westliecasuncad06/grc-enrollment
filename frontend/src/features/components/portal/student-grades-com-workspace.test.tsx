import { screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { StudentGradesComWorkspace } from "@/features/components/portal/student-grades-com-workspace"
import { renderWithSession } from "@/tests/render-app"

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

const grade = {
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
  status: "locked",
  status_label: "Locked",
  submitted_at: "2026-07-30T00:00:00Z",
  locked_at: "2026-07-30T00:00:00Z",
} as const

const document = {
  type: "enrollment_document",
  id: 1,
  enrollment_id: 9,
  student_number: "2026-0001",
  document_type: "com",
  document_type_label: "Certificate of Matriculation",
  document_number: "COM000009",
  generated_at: "2026-07-30T00:00:00Z",
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

const studentSession = {
  userId: "4",
  displayName: "Student",
  role: "student",
  signedInAt: "2026-07-29T12:00:00Z",
} as const

function mockFetchResponses() {
  return vi.fn<typeof fetch>().mockImplementation((input) => {
    const target =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    if (target.includes("/academic-grades"))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [grade],
            links: paginationLinks,
            meta: paginationMeta,
          }),
        ),
      )
    if (target.includes("/academic-terms"))
      return Promise.resolve(
        new Response(JSON.stringify({ data: [term] })),
      )
    if (target.includes("/prospectus"))
      return Promise.resolve(
        new Response(JSON.stringify({ data: prospectus })),
      )
    return Promise.resolve(
      new Response(
        JSON.stringify({
          data: [document],
          links: paginationLinks,
          meta: paginationMeta,
        }),
      ),
    )
  })
}

describe("StudentGradesComWorkspace", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("does not render for an unauthorized role", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: [] }))),
    )
    renderWithSession(<StudentGradesComWorkspace />, {
      session: {
        userId: "5",
        displayName: "Registrar Head",
        role: "registrar_head",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
  })

  it("shows the student's grades, generated Digital COM, and prospectus", async () => {
    vi.stubGlobal("fetch", mockFetchResponses())
    renderWithSession(<StudentGradesComWorkspace />, {
      session: studentSession,
    })

    const table = await screen.findByRole("table", { name: "Grades" })
    expect(within(table).getByText(/CS101/)).toBeInTheDocument()
    expect(screen.getByText(/COM000009/)).toBeInTheDocument()
    expect(await screen.findByText(/BS Information Technology/)).toBeInTheDocument()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    vi.stubGlobal("fetch", mockFetchResponses())
    const { container } = renderWithSession(<StudentGradesComWorkspace />, {
      session: studentSession,
    })

    await screen.findByRole("table", { name: "Grades" })
    await screen.findByText(/BS Information Technology/)
    expect(await axe(container)).toHaveNoViolations()
  })
})
