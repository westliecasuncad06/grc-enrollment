import { screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { ProspectusDocument } from "@/features/components/portal/prospectus-document"
import { renderWithSession } from "@/tests/render-app"

function url(input: RequestInfo | URL) {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

const takenEntry = {
  subject_id: 7,
  code: "CS101",
  title: "Introduction to Computing",
  units: 3,
  is_required: true,
  offered_either_semester: false,
  is_completion_only: false,
  mark: "1.50",
  mark_label: "with Distinction",
  final_grade: "1.50",
  status: "locked",
  status_label: "Locked",
  academic_term_id: 2,
  term_label: "2025-2026 · 1st",
  attempt_count: 1,
} as const

const untakenEntry = {
  subject_id: 8,
  code: "CS102",
  title: "Data Structures",
  units: 3,
  is_required: true,
  offered_either_semester: false,
  is_completion_only: false,
  mark: null,
  mark_label: null,
  final_grade: null,
  status: null,
  status_label: null,
  academic_term_id: null,
  term_label: null,
  attempt_count: 0,
} as const

const unplacedEntry = {
  subject_id: 99,
  code: "ELEC1",
  title: "Free Elective",
  units: 3,
  mark: "1.00",
  mark_label: "Excellent",
  final_grade: "1.00",
  status: "locked",
  status_label: "Locked",
  academic_term_id: 3,
  term_label: "2025-2026 · 2nd",
} as const

function prospectusFixture(
  overrides: Partial<{
    semesters: unknown[]
    unplaced_entries: unknown[]
  }> = {},
) {
  return {
    data: {
      type: "prospectus",
      student_id: 4,
      student_number: "2026-0001",
      program_code: "BSIT",
      program_name: "BS Information Technology",
      curriculum_id: 1,
      curriculum_name: "BSIT 2023 Curriculum",
      effective_school_year: "2023-2024",
      year_level: 1,
      enrollment_category: "regular",
      enrollment_category_label: "Regular",
      enrollment_category_derived_at: "2026-07-30T00:00:00Z",
      semesters:
        overrides.semesters ?? [
          {
            year_level: 1,
            semester: "1st",
            semester_label: "1st Semester",
            entries: [takenEntry, untakenEntry],
          },
        ],
      unplaced_entries: overrides.unplaced_entries ?? [],
    },
  }
}

describe("ProspectusDocument", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("renders a table per semester with taken and untaken subjects", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(prospectusFixture())),
    )

    renderWithSession(<ProspectusDocument />)

    expect(await screen.findByText(/BS Information Technology/)).toBeInTheDocument()
    expect(screen.getByText(/Year 1 · 1st Semester/)).toBeInTheDocument()
    expect(screen.getByText("with Distinction")).toBeInTheDocument()
    expect(screen.getByText("Not taken")).toBeInTheDocument()
  })

  it("requests another student's prospectus when studentId is provided", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(prospectusFixture())),
    )

    renderWithSession(<ProspectusDocument studentId={4} />)

    await screen.findByText(/BS Information Technology/)
    expect(url(fetchMock.mock.calls[0]![0])).toContain("student_id=4")
  })

  it("shows unplaced entries in their own table when present", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(prospectusFixture({ unplaced_entries: [unplacedEntry] })),
      ),
    )

    renderWithSession(<ProspectusDocument />)

    const table = await screen.findByText("Additional / credited subjects")
    expect(within(table.closest("table")!).getByText("ELEC1")).toBeInTheDocument()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(prospectusFixture())),
    )

    const { container } = renderWithSession(<ProspectusDocument />)

    await screen.findByText(/BS Information Technology/)
    expect(await axe(container)).toHaveNoViolations()
  })
})
