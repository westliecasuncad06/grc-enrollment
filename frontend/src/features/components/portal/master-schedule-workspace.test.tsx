import { screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MasterScheduleWorkspace } from "@/features/components/portal/master-schedule-workspace"
import { renderWithSession } from "@/tests/render-app"

const sections = {
  data: [
    {
      type: "section",
      id: 1,
      academic_term_id: 2,
      subject_id: 3,
      section_code: "A",
      professor_id: null,
      schedule_days: null,
      starts_at_time: null,
      ends_at_time: null,
      room: null,
      capacity: 40,
      viability_threshold: null,
      enrolled_count: 0,
      remaining_seats: 40,
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
      viability_threshold: null,
      enrolled_count: 0,
      remaining_seats: 40,
      status: "planned",
      status_label: "Planned",
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
      status: "active",
      status_label: "Active",
    },
  ],
}
const proposals = { data: [] }
function url(input: RequestInfo | URL) {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
}

describe("MasterScheduleWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("shows the executive only published master schedule", async () => {
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
    renderWithSession(<MasterScheduleWorkspace />, {
      session: {
        userId: "6",
        displayName: "Executive",
        role: "executive_director",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    expect(await screen.findByText(/ENG101/)).toBeInTheDocument()
    expect(screen.queryByText("B")).not.toBeInTheDocument()
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
})
