import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { ClassRostersWorkspace } from "@/features/components/portal/class-rosters-workspace"
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
    links: {
      first: "http://x/1",
      last: "http://x/1",
      prev: null,
      next: null,
    },
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

describe("ClassRostersWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("is not available for a non-faculty role", () => {
    renderWithSession(<ClassRostersWorkspace />, {
      session: { ...facultySession, role: "student" },
    })

    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("lists only the signed-in faculty member's own sections", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [ownSection, { ...ownSection, id: 45, professor_id: 6 }],
        }),
      ),
    )
    const user = userEvent.setup()
    renderWithSession(<ClassRostersWorkspace />, { session: facultySession })

    const trigger = await screen.findByLabelText("Section")
    await user.click(trigger)
    expect(screen.getByRole("option", { name: /CS101-A/ })).toBeInTheDocument()
    expect(screen.getAllByRole("option")).toHaveLength(1)
  })

  it("shows a clear empty state when no sections are assigned", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [] })))
    renderWithSession(<ClassRostersWorkspace />, { session: facultySession })

    expect(
      await screen.findByText(
        "No sections are currently assigned to your faculty account.",
      ),
    ).toBeInTheDocument()
  })

  it("loads and displays the roster once a section is selected", async () => {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes("/class-rosters")) {
        return Promise.resolve(
          new Response(JSON.stringify(rosterResponse([rosterEntry]))),
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify({ data: [ownSection] })),
      )
    })
    const user = userEvent.setup()
    renderWithSession(<ClassRostersWorkspace />, { session: facultySession })

    const trigger = await screen.findByLabelText("Section")
    await user.click(trigger)
    await user.click(screen.getByRole("option", { name: /CS101-A/ }))

    const table = await screen.findByRole("table", { name: "Class roster" })
    expect(within(table).getByText("2026-0001")).toBeInTheDocument()
    expect(within(table).getByText("Enrolled")).toBeInTheDocument()
  })

  it("shows an empty roster message when the section has no enrolled students", async () => {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes("/class-rosters")) {
        return Promise.resolve(new Response(JSON.stringify(rosterResponse([]))))
      }
      return Promise.resolve(
        new Response(JSON.stringify({ data: [ownSection] })),
      )
    })
    const user = userEvent.setup()
    renderWithSession(<ClassRostersWorkspace />, { session: facultySession })

    const trigger = await screen.findByLabelText("Section")
    await user.click(trigger)
    await user.click(screen.getByRole("option", { name: /CS101-A/ }))

    expect(
      await screen.findByText("No students are enrolled in this section yet."),
    ).toBeInTheDocument()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [ownSection] })),
    )
    const { container } = renderWithSession(<ClassRostersWorkspace />, {
      session: facultySession,
    })

    await screen.findByLabelText("Section")
    expect(await axe(container)).toHaveNoViolations()
  })
})
