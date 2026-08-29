import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { FacultyLoadingWorkspace } from "@/features/components/portal/faculty-loading-workspace"
import { renderWithSession } from "@/tests/render-app"

const terms = {
  data: [
    {
      type: "academic-term",
      id: 1,
      school_year: "2027-2028",
      semester: "2nd",
      starts_at: null,
      ends_at: null,
      enrollment_opens_at: null,
      enrollment_closes_at: null,
      add_drop_deadline_at: null,
      grading_deadline_at: null,
      status: "semester_ongoing",
      status_label: "Semester Ongoing",
    },
  ],
} as const

const subjects = {
  data: [
    {
      type: "subject",
      id: 101,
      code: "IT101",
      title: "Introduction to Computing",
      units: 3,
      status: "active",
      status_label: "Active",
      is_completion_only: false,
    },
    {
      type: "subject",
      id: 201,
      code: "IT201",
      title: "Data Structures",
      units: 3,
      status: "active",
      status_label: "Active",
      is_completion_only: false,
    },
    {
      type: "subject",
      id: 999,
      code: "LEAD4",
      title: "Leadership 4 (Other College)",
      units: 3,
      status: "active",
      status_label: "Active",
      is_completion_only: false,
    },
  ],
} as const

const faculty = {
  data: [
    {
      type: "faculty_member",
      id: 12,
      name: "Prof. Reyes",
      college: "ccs",
      status: "active",
      status_label: "Active",
      employment_type: "full_time",
      employment_type_label: "Full-time",
      planning_unit_reference: 33,
      is_assignable: true,
    },
    {
      type: "faculty_member",
      id: 13,
      name: "Prof. Santos",
      college: "ccs",
      status: "active",
      status_label: "Active",
      employment_type: "part_time",
      employment_type_label: "Part-time",
      planning_unit_reference: null,
      is_assignable: true,
    },
  ],
} as const

const facultyIncludingInactive = {
  data: [
    ...faculty.data,
    {
      type: "faculty_member",
      id: 14,
      name: "Marian S. Villanueva",
      college: "ccs",
      status: "disabled",
      status_label: "Inactive",
      employment_type: "part_time",
      employment_type_label: "Part-time",
      planning_unit_reference: null,
      is_assignable: false,
    },
  ],
} as const

const facultyLoadReport = {
  data: {
    academic_term_id: 1,
    college: "ccs",
    threshold_units: 18,
    required_teaching_units: 6,
    required_assignments: 2,
    equivalent_faculty_loads: 1,
    assigned_count: 2,
    unassigned_count: 0,
    overloaded_count: 0,
    faculty: [
      {
        professor_id: 12,
        professor_name: "Prof. Reyes",
        total_units: 3,
        overloaded: false,
        assignments: [
          {
            section_id: 11,
            section_code: "IT101",
            subject_id: 101,
            subject_code: "IT101",
            subject_title: "Introduction to Computing",
            units: 3,
            professor_id: 12,
            professor_name: "Prof. Reyes",
            recommended_professor_id: 12,
            rationale: ["Ranked preference"],
            override_reason: null,
            schedule_days: "MW",
            starts_at_time: "08:00:00",
            ends_at_time: "10:00:00",
            room: "LAB 1",
            modality: "f2f",
          },
        ],
      },
      {
        professor_id: 13,
        professor_name: "Prof. Santos",
        total_units: 3,
        overloaded: false,
        assignments: [
          {
            section_id: 12,
            section_code: "IT201",
            subject_id: 201,
            subject_code: "IT201",
            subject_title: "Data Structures",
            units: 3,
            professor_id: 13,
            professor_name: "Prof. Santos",
            recommended_professor_id: 13,
            rationale: ["Ranked preference"],
            override_reason: null,
            schedule_days: "TTh",
            starts_at_time: "10:00:00",
            ends_at_time: "12:00:00",
            room: "LAB 2",
            modality: "hyflex_a",
          },
        ],
      },
    ],
    unassigned: [],
  },
} as const

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

function renderWorkspace() {
  return renderWithSession(<FacultyLoadingWorkspace />, {
    session: {
      userId: "chair-1",
      displayName: "Program Chair",
      role: "program_chair",
      college: "ccs",
      signedInAt: "2026-08-09T00:00:00Z",
    },
  })
}

describe("FacultyLoadingWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockImplementation((input, init) => {
      const url = requestUrl(input)
      const body = url.endsWith("/academic-terms")
        ? terms
        : url.endsWith("/subjects")
          ? subjects
          : url.includes("/faculty-members")
            ? url.includes("include_inactive=1")
              ? facultyIncludingInactive
              : faculty
            : url.endsWith("/faculty-load-report")
              ? facultyLoadReport
              : url.includes("/faculty-load-threshold") && init?.method === "PUT"
                ? { data: { max_units: 18 } }
                : { data: [] }
      return Promise.resolve(new Response(JSON.stringify(body)))
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it("narrows the Faculty Load Report to a professor selected from the searchable dropdown", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(await screen.findByLabelText("Professor"))
    await user.click(await screen.findByRole("option", { name: "Prof. Reyes" }))

    expect(
      await screen.findByText("Assigned subjects: IT101"),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Assigned subjects: IT201"),
    ).not.toBeInTheDocument()
  })

  it("narrows the Faculty Load Report to a subject selected from the searchable dropdown", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(await screen.findByLabelText("Subject"))
    await user.click(await screen.findByRole("option", { name: "IT201 — Data Structures" }))

    expect(
      await screen.findByText("Assigned subjects: IT201"),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Assigned subjects: IT101"),
    ).not.toBeInTheDocument()
  })

  it("only offers subjects that appear in this college's faculty load report", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(await screen.findByLabelText("Subject"))

    expect(
      await screen.findByRole("option", {
        name: "IT101 — Introduction to Computing",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "IT201 — Data Structures" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("option", { name: /Other College/ }),
    ).not.toBeInTheDocument()
  })


  it("saves a faculty load threshold successfully", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await screen.findByText("Faculty load threshold")

    const thresholdInput = screen.getByPlaceholderText("e.g. 18") as HTMLInputElement
    await user.clear(thresholdInput)
    await user.type(thresholdInput, "24")

    await user.click(screen.getByRole("button", { name: "Save threshold" }))

    // Verify the PUT request was made to the faculty-load-threshold endpoint
    await new Promise((resolve) => setTimeout(resolve, 150))
    const putCalls = (
      fetchMock.mock.calls as Array<[RequestInfo | URL, RequestInit | undefined]>
    ).filter(([input, init]) => {
      const url = requestUrl(input)
      return url.includes("/faculty-load-threshold") && init?.method === "PUT"
    })
    expect(putCalls.length).toBe(1)
  })

})
