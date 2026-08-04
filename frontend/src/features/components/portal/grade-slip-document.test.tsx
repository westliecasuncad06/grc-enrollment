import { screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { GradeSlipDocument } from "@/features/components/portal/grade-slip-document"
import { renderWithSession } from "@/tests/render-app"

function url(input: RequestInfo | URL) {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

const row = {
  academic_grade_id: 3,
  code: "CS101",
  title: "Introduction to Computing",
  units: 3,
  mark: "1.50",
  mark_label: "with Distinction",
  final_grade: "1.50",
  section_code: "BSIT-1A",
  professor_name: "Prof. Reyes",
  status: "locked",
  status_label: "Locked",
  counts_toward_gpa: true,
} as const

const sectionlessRow = {
  ...row,
  academic_grade_id: 4,
  code: "LEAD1",
  title: "Leadership 1",
  mark: "C",
  mark_label: "Complete",
  final_grade: null,
  section_code: null,
  professor_name: null,
  counts_toward_gpa: false,
} as const

function gradeSlipFixture(
  overrides: Partial<{ rows: unknown[]; excluded_from_gpa_count: number }> = {},
) {
  return {
    data: {
      type: "grade_slip",
      student_id: 4,
      student_number: "2026-0001",
      program_code: "BSIT",
      program_name: "BS Information Technology",
      year_level: 1,
      enrollment_category: "regular",
      enrollment_category_label: "Regular",
      academic_term_id: 2,
      school_year: "2026-2027",
      semester: "2nd",
      term_label: "2026-2027 · 2nd Semester",
      rows: overrides.rows ?? [row, sectionlessRow],
      total_academic_units: 6,
      gpa_units: 3,
      gpa: "1.50",
      excluded_from_gpa_count: overrides.excluded_from_gpa_count ?? 1,
      generated_at: "2026-07-30T00:00:00Z",
    },
  }
}

describe("GradeSlipDocument", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("renders the slip rows, totals, and GPA", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(gradeSlipFixture())),
    )

    renderWithSession(<GradeSlipDocument academicTermId={2} />)

    expect(await screen.findByText("CS101")).toBeInTheDocument()
    expect(screen.getByText("BSIT-1A")).toBeInTheDocument()
    expect(screen.getByText("Prof. Reyes")).toBeInTheDocument()
    expect(screen.getByText("6")).toBeInTheDocument()
    expect(screen.getAllByText("1.50")).toHaveLength(2)
  })

  it("shows a dash for a section-less grade instead of failing", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(gradeSlipFixture())),
    )

    renderWithSession(<GradeSlipDocument academicTermId={2} />)

    await screen.findByText("LEAD1")
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2)
  })

  it("notes how many subjects are excluded from the GPA", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(gradeSlipFixture())),
    )

    renderWithSession(<GradeSlipDocument academicTermId={2} />)

    expect(
      await screen.findByText(/1 subject.*excluded from the GPA/),
    ).toBeInTheDocument()
  })

  it("requests another student's grade slip when studentId is provided", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(gradeSlipFixture())),
    )

    renderWithSession(<GradeSlipDocument academicTermId={2} studentId={4} />)

    await screen.findByText("CS101")
    const requested = url(fetchMock.mock.calls[0]![0])
    expect(requested).toContain("academic_term_id=2")
    expect(requested).toContain("student_id=4")
  })

  it("has no detectable accessibility violations once loaded", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(gradeSlipFixture())),
    )

    const { container } = renderWithSession(
      <GradeSlipDocument academicTermId={2} />,
    )

    await screen.findByText("CS101")
    expect(await axe(container)).toHaveNoViolations()
  })
})
