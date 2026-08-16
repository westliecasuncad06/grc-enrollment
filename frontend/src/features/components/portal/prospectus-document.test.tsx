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
  prerequisites: [
    {
      subject_id: 6,
      code: "CS100",
      title: "Intro to Programming",
      minimum_grade: "75",
    },
  ],
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
  prerequisites: [],
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
    curriculum_transition: unknown
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
      semesters: overrides.semesters ?? [
        {
          year_level: 1,
          semester: "1st",
          semester_label: "1st Semester",
          entries: [takenEntry, untakenEntry],
        },
      ],
      unplaced_entries: overrides.unplaced_entries ?? [],
      curriculum_transition: overrides.curriculum_transition ?? null,
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

    expect(
      await screen.findByText(/BS Information Technology/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Year 1 · 1st Semester/)).toBeInTheDocument()
    // The Grade column shows the mark itself (numeric/C/NC), never the
    // "Good"/"Very Good" label -- that label only appears in the Status badge.
    expect(screen.getByText("1.50")).toBeInTheDocument()
    expect(screen.queryByText("with Distinction")).not.toBeInTheDocument()
    expect(screen.getByText("Not taken")).toBeInTheDocument()
  })

  it("shows a subject's pre-requisite codes, or a dash when it has none", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(prospectusFixture())),
    )

    renderWithSession(<ProspectusDocument />)

    const takenRow = (await screen.findByText("CS101")).closest("tr")!
    expect(within(takenRow).getByText("CS100")).toBeInTheDocument()

    const untakenRow = screen.getByText("CS102").closest("tr")!
    const prerequisiteCell = within(untakenRow).getAllByRole("cell")[2]
    expect(prerequisiteCell).toHaveTextContent("—")
  })

  it("colors a failed, incomplete, or not-taken row distinctly from a passed one", async () => {
    const failedEntry = {
      ...takenEntry,
      subject_id: 20,
      code: "CS999",
      mark: "5.00",
      mark_label: "Failed",
      status_label: "Locked",
    }
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(
          prospectusFixture({
            semesters: [
              {
                year_level: 1,
                semester: "1st",
                semester_label: "1st Semester",
                entries: [takenEntry, failedEntry, untakenEntry],
              },
            ],
          }),
        ),
      ),
    )

    renderWithSession(<ProspectusDocument />)

    const failedRow = (await screen.findByText("5.00")).closest("tr")!
    const passedRow = screen.getByText("1.50").closest("tr")!
    const notTakenRow = screen.getByText("CS102").closest("tr")!

    expect(failedRow.className).not.toBe(passedRow.className)
    expect(notTakenRow.className).not.toBe(passedRow.className)
  })

  it("requests another student's prospectus when studentId is provided", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(prospectusFixture())),
    )

    renderWithSession(<ProspectusDocument studentId={4} />)

    await screen.findByText(/BS Information Technology/)
    expect(url(fetchMock.mock.calls[0][0])).toContain("student_id=4")
  })

  it("shows unplaced entries in their own table when present", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(
          prospectusFixture({ unplaced_entries: [unplacedEntry] }),
        ),
      ),
    )

    renderWithSession(<ProspectusDocument />)

    const table = await screen.findByText("Additional / credited subjects")
    const additionalSubjectsTable = table.closest("table")
    if (!additionalSubjectsTable)
      throw new Error("Additional subjects caption is not in a table.")
    expect(
      within(additionalSubjectsTable).getByText("ELEC1"),
    ).toBeInTheDocument()
  })

  it("shows read-only credited old-to-new curriculum subjects", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(
          prospectusFixture({
            curriculum_transition: {
              source_curriculum_name: "BSIT 2021 Curriculum",
              target_curriculum_name: "BSIT 2026 Curriculum",
              migrated_at: "2026-08-16T00:00:00Z",
              credits: [
                {
                  source_code: "IT-OLD",
                  source_title: "Old Programming",
                  target_code: "IT-NEW",
                  target_title: "Foundations of Programming",
                },
              ],
            },
          }),
        ),
      ),
    )

    renderWithSession(<ProspectusDocument />)

    expect(await screen.findByText(/Curriculum transition/)).toBeInTheDocument()
    expect(screen.getByText(/IT-OLD — Old Programming/)).toBeInTheDocument()
    expect(
      screen.getByText(/IT-NEW — Foundations of Programming/),
    ).toBeInTheDocument()
    expect(screen.getByText("Credited")).toBeInTheDocument()
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
