import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ScheduleFacultyLoadingWorkspace } from "@/features/components/portal/schedule-faculty-loading-workspace"
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
  ],
} as const

const sections = {
  data: [
    {
      type: "section",
      id: 11,
      academic_term_id: 1,
      section_plan_id: 70,
      subject_id: 101,
      section_code: "IT101",
      professor_id: 12,
      schedule_days: "MW",
      starts_at_time: "08:00:00",
      ends_at_time: "10:00:00",
      room: "LAB 1",
      modality: "f2f",
      capacity: 40,
      capacity_source: "plan",
      viability_threshold: null,
      enrolled_count: 0,
      remaining_seats: 40,
      is_block_exclusive: true,
      status: "planned",
      status_label: "Planned",
    },
    {
      type: "section",
      id: 12,
      academic_term_id: 1,
      section_plan_id: 71,
      subject_id: 201,
      section_code: "IT201",
      professor_id: 13,
      schedule_days: "TTh",
      starts_at_time: "10:00:00",
      ends_at_time: "12:00:00",
      room: "LAB 2",
      modality: "hyflex_a",
      capacity: 40,
      capacity_source: "plan",
      viability_threshold: null,
      enrolled_count: 0,
      remaining_seats: 40,
      is_block_exclusive: true,
      status: "planned",
      status_label: "Planned",
    },
  ],
} as const

const plans = {
  data: [
    {
      type: "academic-term-section-plan",
      id: 70,
      academic_term_id: 1,
      curriculum_id: 10,
      college: "ccs",
      year_level: 1,
      section_count: 1,
      students_per_block: 40,
      status: "draft",
      status_label: "Draft",
      submitted_at: null,
    },
    {
      type: "academic-term-section-plan",
      id: 71,
      academic_term_id: 1,
      curriculum_id: 10,
      college: "ccs",
      year_level: 2,
      section_count: 1,
      students_per_block: 40,
      status: "draft",
      status_label: "Draft",
      submitted_at: null,
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
  return renderWithSession(<ScheduleFacultyLoadingWorkspace />, {
    session: {
      userId: "chair-1",
      displayName: "Program Chair",
      role: "program_chair",
      college: "ccs",
      signedInAt: "2026-08-09T00:00:00Z",
    },
  })
}

describe("ScheduleFacultyLoadingWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      const body = url.endsWith("/academic-terms")
        ? terms
        : url.endsWith("/sections")
          ? sections
          : url.endsWith("/subjects")
            ? subjects
            : url.includes("/faculty-members")
              ? url.includes("include_inactive=1")
                ? facultyIncludingInactive
                : faculty
              : url.includes("/academic-term-section-plans")
                ? plans
                : url.endsWith("/faculty-load-report")
                  ? facultyLoadReport
                  : { data: [] }
      return Promise.resolve(new Response(JSON.stringify(body)))
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it("shows an IT101 row when Year 1 is selected from its linked section plan", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await screen.findByText("IT101 · IT101")
    await user.selectOptions(screen.getByLabelText("Year"), "1")

    expect(screen.getByText("IT101 · IT101")).toBeInTheDocument()
    expect(screen.queryByText("IT201 · IT201")).not.toBeInTheDocument()
  })

  it("finds a professor by name and shows that professor's assigned subject", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await screen.findByText("Faculty Load Report")
    await user.type(screen.getByLabelText("Find professor"), "reyes")

    expect(screen.getAllByText("Prof. Reyes").length).toBeGreaterThan(0)
    expect(screen.getAllByText(/IT101/).length).toBeGreaterThan(0)
    expect(screen.queryByText("Prof. Santos")).not.toBeInTheDocument()
  })

  it("lets the Program Chair review and edit each faculty member's active status and employment type", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await screen.findByText("Faculty workforce")
    expect(screen.getByText("Marian S. Villanueva")).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", {
        name: "Edit workforce profile for Marian S. Villanueva",
      }),
    )

    expect(screen.getByRole("dialog")).toHaveTextContent("Employment type")
    expect(screen.getByLabelText("Account status")).toHaveValue("disabled")
    expect(screen.getByLabelText("Employment type")).toHaveValue("part_time")
  })
})
