import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { StudentGradesWorkspace } from "@/features/components/portal/student-grades-workspace"
import { renderWithSession } from "@/tests/render-app"

const row = {
  academic_grade_id: 3,
  code: "CS201",
  title: "Computer Programming 2",
  units: 3,
  mark: "1.50",
  mark_label: "with Distinction",
  final_grade: "1.50",
  section_code: "A",
  professor_name: "Prof. Reyes",
  status: "locked",
  status_label: "Locked",
  counts_toward_gpa: true,
} as const

const academicRecord = {
  type: "academic_record",
  student_id: 4,
  student_number: "2026-0001",
  program_code: "BSCS",
  program_name: "BS Computer Science",
  year_level: 1,
  enrollment_category: "regular",
  enrollment_category_label: "Regular",
  terms: [
    {
      academic_term_id: 3,
      school_year: "2026-2027",
      semester: "2nd",
      term_label: "2026-2027 · 2nd",
      rows: [row],
      total_academic_units: 3,
      gpa_units: 3,
      gpa: "1.50",
      excluded_from_gpa_count: 0,
    },
    {
      academic_term_id: 2,
      school_year: "2026-2027",
      semester: "1st",
      term_label: "2026-2027 · 1st",
      rows: [{ ...row, academic_grade_id: 2, code: "CS101" }],
      total_academic_units: 3,
      gpa_units: 3,
      gpa: "2.00",
      excluded_from_gpa_count: 0,
    },
  ],
} as const

const prospectus = {
  type: "prospectus",
  student_id: 4,
  student_number: "2026-0001",
  program_code: "BSCS",
  program_name: "BS Computer Science",
  curriculum_id: 1,
  curriculum_name: "BSCS Curriculum",
  effective_school_year: "2023-2024",
  year_level: 1,
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

function mockFetch() {
  return vi.fn<typeof fetch>().mockImplementation((input) => {
    const target =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    if (target.includes("/academic-record"))
      return Promise.resolve(
        new Response(JSON.stringify({ data: academicRecord })),
      )
    if (target.includes("/prospectus"))
      return Promise.resolve(new Response(JSON.stringify({ data: prospectus })))
    return Promise.resolve(new Response(JSON.stringify({ data: [] })))
  })
}

describe("StudentGradesWorkspace", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("does not render for an unauthorized role", () => {
    vi.stubGlobal("fetch", mockFetch())
    renderWithSession(<StudentGradesWorkspace />, {
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

  it("defaults to the latest term's grade slip, with the numeric mark shown", async () => {
    vi.stubGlobal("fetch", mockFetch())
    renderWithSession(<StudentGradesWorkspace />, { session: studentSession })

    expect(await screen.findByText("CS201")).toBeInTheDocument()
    expect(screen.queryByText("CS101")).not.toBeInTheDocument()
    expect(screen.getAllByText("1.50").length).toBeGreaterThan(0)
  })

  it("switches to another semester's grade slip when clicked", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("fetch", mockFetch())
    renderWithSession(<StudentGradesWorkspace />, { session: studentSession })

    await screen.findByText("CS201")
    await user.click(screen.getByRole("button", { name: "1st" }))

    expect(await screen.findByText("CS101")).toBeInTheDocument()
    expect(screen.queryByText("CS201")).not.toBeInTheDocument()
  })

  it("opens the full prospectus in a dialog", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("fetch", mockFetch())
    renderWithSession(<StudentGradesWorkspace />, { session: studentSession })

    await screen.findByText("CS201")
    await user.click(screen.getByRole("button", { name: "Prospectus" }))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText(/BSCS Curriculum/)).toBeInTheDocument()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    vi.stubGlobal("fetch", mockFetch())
    const { container } = renderWithSession(<StudentGradesWorkspace />, {
      session: studentSession,
    })

    await screen.findByText("CS201")
    expect(await axe(container)).toHaveNoViolations()
  })
})
