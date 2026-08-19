import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { MasterScheduleWorkspace } from "@/features/components/portal/master-schedule-workspace"
import { renderWithSession } from "@/tests/render-app"

const sectionPlans = {
  data: [
    {
      type: "academic-term-section-plan",
      id: 100,
      academic_term_id: 2,
      curriculum_id: 5,
      college: "ccs",
      year_level: 1,
      section_count: 1,
      students_per_block: 40,
      status: "submitted",
      status_label: "Submitted",
      submitted_at: null,
    },
    {
      type: "academic-term-section-plan",
      id: 101,
      academic_term_id: 2,
      curriculum_id: 12,
      college: "coa",
      year_level: 4,
      section_count: 1,
      students_per_block: 40,
      status: "submitted",
      status_label: "Submitted",
      submitted_at: null,
    },
  ],
}
const sections = {
  data: [
    {
      type: "section",
      id: 1,
      academic_term_id: 2,
      section_plan_id: 100,
      subject_id: 3,
      section_code: "A",
      professor_id: null,
      schedule_days: null,
      starts_at_time: null,
      ends_at_time: null,
      room: null,
      capacity: 40,
      capacity_source: "plan",
      viability_threshold: null,
      enrolled_count: 0,
      remaining_seats: 40,
      is_block_exclusive: null,
      status: "published",
      status_label: "Published",
    },
    {
      type: "section",
      id: 2,
      academic_term_id: 2,
      subject_id: 3,
      section_code: "B",
      professor_id: null,
      schedule_days: null,
      starts_at_time: null,
      ends_at_time: null,
      room: null,
      capacity: 40,
      capacity_source: "plan",
      viability_threshold: null,
      enrolled_count: 0,
      remaining_seats: 40,
      is_block_exclusive: null,
      status: "planned",
      status_label: "Planned",
    },
    {
      type: "section",
      id: 4,
      academic_term_id: 2,
      section_plan_id: 101,
      subject_id: 6,
      section_code: "C",
      professor_id: null,
      schedule_days: null,
      starts_at_time: null,
      ends_at_time: null,
      room: null,
      capacity: 40,
      capacity_source: "plan",
      viability_threshold: null,
      enrolled_count: 0,
      remaining_seats: 40,
      is_block_exclusive: null,
      status: "published",
      status_label: "Published",
    },
  ],
}
const curricula = {
  data: [
    {
      type: "curriculum",
      id: 5,
      program_id: 1,
      name: "BSIT Curriculum",
      effective_school_year: "2026-2027",
      status: "active",
      status_label: "Active",
      decided_at: null,
      last_decision_reason: null,
      subjects: [],
    },
    {
      type: "curriculum",
      id: 12,
      program_id: 2,
      name: "BSA Curriculum",
      effective_school_year: "2026-2027",
      status: "active",
      status_label: "Active",
      decided_at: null,
      last_decision_reason: null,
      subjects: [],
    },
  ],
}
const programs = {
  data: [
    {
      type: "program",
      id: 1,
      code: "BSIT",
      name: "BS Information Technology",
      status: "active",
      status_label: "Active",
    },
    {
      type: "program",
      id: 2,
      code: "BSA",
      name: "BS Accountancy",
      status: "active",
      status_label: "Active",
    },
  ],
}
const subjects = {
  data: [
    {
      type: "subject",
      id: 3,
      code: "ENG101",
      title: "English",
      units: 3,
      status: "active",
      status_label: "Active",
      is_completion_only: false,
    },
    {
      type: "subject",
      id: 6,
      code: "ACC101",
      title: "Accounting",
      units: 3,
      status: "active",
      status_label: "Active",
      is_completion_only: false,
    },
  ],
}
const terms = {
  data: [
    {
      type: "academic-term",
      id: 2,
      school_year: "2026-2027",
      semester: "1st",
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
}
const proposals = { data: [] }
const noPublishedSections = { data: [] }
const deanApprovedProposal = {
  data: [
    {
      type: "schedule_proposal",
      id: 9,
      academic_term_id: 2,
      submitted_by: 4,
      submitted_by_name: "COA Program Chair",
      college: "coa",
      college_label: "College of Accountancy",
      academic_term_label: "2026-2027 · 1st",
      is_submitted: true,
      status: "dean_approved",
      status_label: "Dean approved",
      decided_by: 5,
      decided_at: "2026-07-29T12:00:00Z",
      decision_reason: null,
    },
  ],
}
function url(input: RequestInfo | URL) {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
}

function routeFixtures(input: RequestInfo | URL) {
  const target = url(input)
  if (target.includes("section-plans")) return sectionPlans
  if (target.includes("curricula")) return curricula
  if (target.includes("programs")) return programs
  if (target.includes("academic-terms")) return terms
  if (target.includes("subjects")) return subjects
  if (target.includes("schedule-proposals")) return proposals
  return sections
}

describe("MasterScheduleWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("shows the executive only published master schedule", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input) =>
      Promise.resolve(new Response(JSON.stringify(routeFixtures(input)))),
    )
    renderWithSession(<MasterScheduleWorkspace />, {
      session: {
        userId: "6",
        displayName: "Executive",
        role: "executive_director",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    expect(
      await screen.findByRole("tab", { name: "For review", selected: true }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/ENG101/)).not.toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Published" }))
    const table = await screen.findByRole("table", { name: "A schedule" })
    expect(within(table).getByText(/ENG101/)).toBeInTheDocument()
    expect(screen.queryByText("B")).not.toBeInTheDocument()
  })

  it("filters published sections by College and Year buttons", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input) =>
      Promise.resolve(new Response(JSON.stringify(routeFixtures(input)))),
    )
    renderWithSession(<MasterScheduleWorkspace />, {
      session: {
        userId: "6",
        displayName: "Executive",
        role: "executive_director",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    await user.click(await screen.findByRole("tab", { name: "Published" }))
    within(await screen.findByRole("table", { name: "A schedule" })).getByText(/ENG101/)
    within(await screen.findByRole("table", { name: "C schedule" })).getByText(/ACC101/)

    await user.click(screen.getByRole("button", { name: "COA" }))
    expect(screen.queryByRole("table", { name: "A schedule" })).not.toBeInTheDocument()
    within(await screen.findByRole("table", { name: "C schedule" })).getByText(/ACC101/)

    await user.click(screen.getByRole("button", { name: "CCS" }))
    within(await screen.findByRole("table", { name: "A schedule" })).getByText(/ENG101/)
    expect(screen.queryByRole("table", { name: "C schedule" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "4th Year" }))
    expect(
      await screen.findByText("No published sections match the current filters."),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "1st Year" }))
    within(await screen.findByRole("table", { name: "A schedule" })).getByText(/ENG101/)
  })

  it("shows executive decision controls even when no sections are published yet", async () => {
    const user = userEvent.setup()
    // Regression test: the decision controls used to sit inside the same
    // AsyncBoundary as the published-sections list, so an empty schedule
    // locked the Executive Director out of approving the very first
    // proposal — the one action that would publish the very first section.
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url(input).includes("academic-terms")
              ? terms
              : url(input).includes("subjects")
                ? subjects
                : url(input).includes("schedule-proposals")
                  ? deanApprovedProposal
                  : noPublishedSections,
          ),
        ),
      ),
    )
    renderWithSession(<MasterScheduleWorkspace />, {
      session: {
        userId: "6",
        displayName: "Executive",
        role: "executive_director",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    expect(
      await screen.findByRole("button", {
        name: "Publish schedule",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Return with notes" }),
    ).toBeInTheDocument()
    expect(screen.getByText("College of Accountancy")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Published" }))
    expect(
      await screen.findByText("No published sections are available."),
    ).toBeInTheDocument()
  })

  it("withholds the master schedule from non-executive roles", () => {
    renderWithSession(<MasterScheduleWorkspace />, {
      session: {
        userId: "5",
        displayName: "Dean",
        role: "dean",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url(input).includes("academic-terms")
              ? terms
              : url(input).includes("subjects")
                ? subjects
                : url(input).includes("schedule-proposals")
                  ? proposals
                  : sections,
          ),
        ),
      ),
    )
    const { container } = renderWithSession(<MasterScheduleWorkspace />, {
      session: {
        userId: "6",
        displayName: "Executive",
        role: "executive_director",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    await screen.findByRole("tab", { name: "For review", selected: true })
    expect(await axe(container)).toHaveNoViolations()
  })
})
