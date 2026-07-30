import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { GradeSubmissionWorkspace } from "@/features/components/portal/grade-submission-workspace"
import { renderWithSession } from "@/tests/render-app"

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

const facultySession = {
  userId: "5",
  displayName: "Faculty",
  role: "faculty" as const,
  signedInAt: "2026-07-29T12:00:00Z",
}

const ownSection = {
  type: "section",
  id: 44,
  academic_term_id: 1,
  subject_id: 101,
  section_code: "CS101-A",
  professor_id: 5,
  schedule_days: "MWF",
  starts_at_time: "08:00:00",
  ends_at_time: "09:30:00",
  room: "R201",
  capacity: 30,
  viability_threshold: null,
  enrolled_count: 1,
  remaining_seats: 29,
  status: "published",
  status_label: "Published",
}

function rosterResponse(entries: unknown[]) {
  return {
    data: entries,
    links: { first: "http://x/1", last: "http://x/1", prev: null, next: null },
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 100,
      total: entries.length,
    },
  }
}

function gradesResponse(entries: unknown[]) {
  return {
    data: entries,
    links: { first: "http://x/1", last: "http://x/1", prev: null, next: null },
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 100,
      total: entries.length,
    },
  }
}

const rosterEntry = {
  type: "class_roster_entry",
  id: 1,
  enrollment_id: 10,
  section_id: 44,
  section_code: "CS101-A",
  subject_code: "CS101",
  academic_term_id: 1,
  student_id: 20,
  student_number: "2026-0001",
  status: "enrolled",
  status_label: "Enrolled",
}

function stubGradeRoutes(
  fetchMock: ReturnType<typeof vi.fn<typeof fetch>>,
  { grades = [] as unknown[] } = {},
) {
  fetchMock.mockImplementation((input) => {
    const url = requestUrl(input)
    if (url.includes("/class-rosters")) {
      return Promise.resolve(
        new Response(JSON.stringify(rosterResponse([rosterEntry]))),
      )
    }
    if (url.includes("/academic-grades")) {
      return Promise.resolve(
        new Response(JSON.stringify(gradesResponse(grades))),
      )
    }
    return Promise.resolve(new Response(JSON.stringify({ data: [ownSection] })))
  })
}

async function selectSection(user: ReturnType<typeof userEvent.setup>) {
  const trigger = await screen.findByLabelText("Section")
  await user.click(trigger)
  await user.click(screen.getByRole("option", { name: /CS101-A/ }))
}

describe("GradeSubmissionWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("is not available for a non-faculty role", () => {
    renderWithSession(<GradeSubmissionWorkspace />, {
      session: { ...facultySession, role: "student" },
    })

    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("shows an ungraded student with a Record grade action", async () => {
    stubGradeRoutes(fetchMock)
    const user = userEvent.setup()
    renderWithSession(<GradeSubmissionWorkspace />, { session: facultySession })

    await selectSection(user)

    const table = await screen.findByRole("table", { name: "Roster grades" })
    expect(within(table).getByText("Not recorded")).toBeInTheDocument()
    expect(
      within(table).getByRole("button", { name: "Record grade" }),
    ).toBeInTheDocument()
  })

  it("shows Save and Submit actions for a draft grade", async () => {
    stubGradeRoutes(fetchMock, {
      grades: [
        {
          type: "academic_grade",
          id: 9,
          student_id: 20,
          student_number: "2026-0001",
          subject_id: 101,
          subject_code: "CS101",
          section_id: 44,
          academic_term_id: 1,
          final_grade: "1.50",
          remarks: null,
          status: "draft",
          status_label: "Draft",
          submitted_at: null,
          locked_at: null,
        },
      ],
    })
    const user = userEvent.setup()
    renderWithSession(<GradeSubmissionWorkspace />, { session: facultySession })

    await selectSection(user)

    const table = await screen.findByRole("table", { name: "Roster grades" })
    expect(
      within(table).getByRole("button", { name: "Save" }),
    ).toBeInTheDocument()
    expect(
      within(table).getByRole("button", { name: "Submit" }),
    ).toBeInTheDocument()
  })

  it("shows a locked grade as read-only with no actions", async () => {
    stubGradeRoutes(fetchMock, {
      grades: [
        {
          type: "academic_grade",
          id: 9,
          student_id: 20,
          student_number: "2026-0001",
          subject_id: 101,
          subject_code: "CS101",
          section_id: 44,
          academic_term_id: 1,
          final_grade: "1.50",
          remarks: "Good work",
          status: "locked",
          status_label: "Locked",
          submitted_at: "2026-07-29T00:00:00Z",
          locked_at: "2026-07-29T00:00:00Z",
        },
      ],
    })
    const user = userEvent.setup()
    renderWithSession(<GradeSubmissionWorkspace />, { session: facultySession })

    await selectSection(user)

    const table = await screen.findByRole("table", { name: "Roster grades" })
    expect(within(table).getByText("1.50")).toBeInTheDocument()
    expect(
      within(table).queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument()
    expect(
      within(table).queryByRole("button", { name: "Submit" }),
    ).not.toBeInTheDocument()
  })

  it("shows an empty state when no enrolled students are in the section", async () => {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes("/class-rosters")) {
        return Promise.resolve(new Response(JSON.stringify(rosterResponse([]))))
      }
      if (url.includes("/academic-grades")) {
        return Promise.resolve(new Response(JSON.stringify(gradesResponse([]))))
      }
      return Promise.resolve(
        new Response(JSON.stringify({ data: [ownSection] })),
      )
    })
    const user = userEvent.setup()
    renderWithSession(<GradeSubmissionWorkspace />, { session: facultySession })

    await selectSection(user)

    expect(
      await screen.findByText("No enrolled students are in this section yet."),
    ).toBeInTheDocument()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    stubGradeRoutes(fetchMock)
    const user = userEvent.setup()
    const { container } = renderWithSession(<GradeSubmissionWorkspace />, {
      session: facultySession,
    })

    await selectSection(user)
    await screen.findByRole("table", { name: "Roster grades" })
    expect(await axe(container)).toHaveNoViolations()
  })
})
