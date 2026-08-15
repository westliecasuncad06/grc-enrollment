import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ScheduleFacultyLoadingWorkspace } from "@/features/components/portal/schedule-faculty-loading-workspace"
import { renderWithSession } from "@/tests/render-app"

const archivedTerm = {
  type: "academic-term",
  id: 2,
  school_year: "2024-2025",
  semester: "1st",
  starts_at: null,
  ends_at: null,
  enrollment_opens_at: null,
  enrollment_closes_at: null,
  add_drop_deadline_at: null,
  grading_deadline_at: null,
  status: "archived",
  status_label: "Archived",
} as const

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
    archivedTerm,
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
      id: 301,
      code: "OLD101",
      title: "Retired Elective",
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
    {
      type: "section",
      id: 13,
      academic_term_id: 2,
      section_plan_id: 72,
      subject_id: 301,
      section_code: "OLD101",
      professor_id: 12,
      schedule_days: "F",
      starts_at_time: "13:00:00",
      ends_at_time: "15:00:00",
      room: "LAB 3",
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
      // Submitted for Dean/Executive Director review — its section (id 12)
      // must stay editable until it's actually published, not merely
      // submitted.
      status: "submitted",
      status_label: "Submitted",
      submitted_at: "2026-08-01T00:00:00Z",
    },
    {
      type: "academic-term-section-plan",
      id: 72,
      academic_term_id: 2,
      curriculum_id: 10,
      college: "ccs",
      year_level: 1,
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
  let sectionSaveError: unknown = null

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    sectionSaveError = null
    fetchMock.mockImplementation((input, init) => {
      const url = requestUrl(input)
      if (
        url.endsWith("/sections/11") &&
        init?.method === "PATCH" &&
        sectionSaveError !== null
      )
        return Promise.resolve(
          new Response(JSON.stringify(sectionSaveError), { status: 422 }),
        )
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

  it("shows the IT101 block only under its linked year tab, not the long flat list", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    expect(
      await screen.findByRole("cell", { name: "IT101" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("cell", { name: "IT201" }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "2nd Year" }))

    expect(
      await screen.findByRole("cell", { name: "IT201" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("cell", { name: "IT101" }),
    ).not.toBeInTheDocument()
  })

  it("keeps a section editable while its plan is submitted and pending Dean/Executive Director review", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(await screen.findByRole("tab", { name: "2nd Year" }))
    await screen.findByRole("cell", { name: "IT201" })

    const editButton = screen.getByRole("button", { name: "Edit" })
    expect(editButton).toBeEnabled()

    await user.click(editButton)
    expect(
      screen.getByRole("dialog", { name: /Edit section assignment/ }),
    ).toBeInTheDocument()
  })

  it("shows the room conflict returned when saving a section assignment", async () => {
    sectionSaveError = {
      error: {
        code: "VALIDATION_FAILED",
        message: "The submitted data is invalid.",
        errors: {
          room: [
            "This room is already physically occupied by another section at the proposed time.",
          ],
        },
        request_id: "test-room-conflict",
      },
    }
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(await screen.findByRole("button", { name: "Edit" }))
    const dialog = screen.getByRole("dialog", {
      name: "Edit section assignment",
    })
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    )

    expect(
      await screen.findByText(
        "This room is already physically occupied by another section at the proposed time.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("The submitted data is invalid."),
    ).not.toBeInTheDocument()
  })

  it("finds a professor by name and narrows the Faculty Load Report view to that professor", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.type(await screen.findByLabelText("Find professor"), "reyes")
    await user.click(screen.getByRole("tab", { name: "Faculty Load Report" }))

    const reportPanel = await screen.findByRole("tabpanel", {
      name: "Faculty Load Report",
    })
    expect(within(reportPanel).getByText("Prof. Reyes")).toBeInTheDocument()
    expect(
      within(reportPanel).queryByText("Prof. Santos"),
    ).not.toBeInTheDocument()
  })

  it("switches to the Faculty Workforce view in place, without opening a modal", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(
      await screen.findByRole("tab", { name: "Faculty Workforce" }),
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByText("Faculty load threshold")).toBeInTheDocument()
    expect(await screen.findByText("Marian S. Villanueva")).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", {
        name: "Edit workforce profile for Marian S. Villanueva",
      }),
    )

    const editDialog = screen.getByRole("dialog", {
      name: "Update faculty workforce profile",
    })
    expect(editDialog).toHaveTextContent("Employment type")
    expect(screen.getByLabelText("Account status")).toHaveValue("disabled")
    expect(screen.getByLabelText("Employment type")).toHaveValue("part_time")
  })

  it("lets the Program Chair switch to an archived term and view its schedule read-only", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await screen.findByRole("cell", { name: "IT101" })
    expect(
      screen.getByText("Viewing the current term. Assignments are editable."),
    ).toBeInTheDocument()

    await user.selectOptions(
      screen.getByLabelText("Academic term"),
      String(archivedTerm.id),
    )

    expect(
      await screen.findByText(/Viewing an archived schedule/),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole("cell", { name: "OLD101" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Archived" })).toBeDisabled()
  })
})
