import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ScheduleWorkspace } from "@/features/components/portal/schedule-workspace"
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

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

function renderWorkspace() {
  return renderWithSession(<ScheduleWorkspace />, {
    session: {
      userId: "chair-1",
      displayName: "Program Chair",
      role: "program_chair",
      college: "ccs",
      signedInAt: "2026-08-09T00:00:00Z",
    },
  })
}

describe("ScheduleWorkspace", () => {
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
              ? faculty
              : url.includes("/academic-term-section-plans")
                ? plans
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
