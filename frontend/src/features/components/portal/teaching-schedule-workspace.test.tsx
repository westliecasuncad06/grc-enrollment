import { screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TeachingScheduleWorkspace } from "@/features/components/portal/teaching-schedule-workspace"
import { renderWithSession } from "@/tests/render-app"

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

describe("TeachingScheduleWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("renders the assigned API response in desktop and mobile schedule views", async () => {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.endsWith("/academic-terms"))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  type: "academic-term",
                  id: 1,
                  school_year: "2026-2027",
                  semester: "1st",
                  starts_at: null,
                  ends_at: null,
                  enrollment_opens_at: null,
                  enrollment_closes_at: null,
                  status: "active",
                  status_label: "Active",
                },
              ],
            }),
          ),
        )
      if (url.endsWith("/subjects"))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  type: "subject",
                  id: 101,
                  code: "CS101",
                  title: "Programming 1",
                  units: 3,
                  status: "active",
                  status_label: "Active",
                },
                {
                  type: "subject",
                  id: 102,
                  code: "CS102",
                  title: "Programming 2",
                  units: 3,
                  status: "active",
                  status_label: "Active",
                },
              ],
            }),
          ),
        )
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [
              {
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
                enrolled_count: 0,
                remaining_seats: 30,
                status: "published",
                status_label: "Published",
              },
              {
                type: "section",
                id: 45,
                academic_term_id: 1,
                subject_id: 102,
                section_code: "CS102-A",
                professor_id: 6,
                schedule_days: "TTh",
                starts_at_time: "10:00:00",
                ends_at_time: "11:30:00",
                room: "R202",
                capacity: 30,
                viability_threshold: null,
                enrolled_count: 0,
                remaining_seats: 30,
                status: "published",
                status_label: "Published",
              },
            ],
          }),
        ),
      )
    })
    renderWithSession(<TeachingScheduleWorkspace />, {
      session: {
        userId: "5",
        displayName: "Faculty",
        role: "faculty",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    expect(
      await screen.findByRole("cell", { name: "CS101 · Programming 1" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("article", { name: "CS101 Programming 1" }),
    ).toHaveTextContent("R201")
    expect(screen.getAllByText("Published")).toHaveLength(2)
    expect(screen.queryByText("CS102 · Programming 2")).not.toBeInTheDocument()
  })

  it("states clearly when no assigned schedule is visible", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ data: [] }))),
    )
    renderWithSession(<TeachingScheduleWorkspace />, {
      session: {
        userId: "5",
        displayName: "Faculty",
        role: "faculty",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    expect(
      await screen.findByText(
        "No teaching schedule is available for your account.",
      ),
    ).toBeInTheDocument()
  })
})
