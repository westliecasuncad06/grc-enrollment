import { screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { StuckStudentsWorkspace } from "@/features/components/portal/stuck-students-workspace"
import { renderWithSession } from "@/tests/render-app"

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

const unconfiguredStuck = {
  data: [
    {
      type: "stuck_enrollment",
      enrollment_id: 9,
      student_number: "2023-06-00002",
      status: "pending_registrar_approval",
      status_label: "Pending Registrar Approval",
      days_in_status: 5,
      is_flagged: false,
    },
  ],
  meta: {
    threshold_configured: false,
    threshold_days: null,
    academic_term_id: 2,
  },
}

const configuredStuck = {
  data: [
    {
      type: "stuck_enrollment",
      enrollment_id: 9,
      student_number: "2023-06-00002",
      status: "pending_registrar_approval",
      status_label: "Pending Registrar Approval",
      days_in_status: 5,
      is_flagged: true,
    },
  ],
  meta: { threshold_configured: true, threshold_days: 3, academic_term_id: 2 },
}

function url(input: RequestInfo | URL) {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
}

describe("StuckStudentsWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("withholds the workspace from a non-dean role", () => {
    renderWithSession(<StuckStudentsWorkspace />, {
      session: {
        userId: "6",
        displayName: "Executive",
        role: "executive_director",
        signedInAt: "2026-07-31T00:00:00Z",
      },
    })
    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
  })

  it("shows dwell time and an unconfigured-threshold notice when no threshold is set", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url(input).includes("academic-terms") ? terms : unconfiguredStuck,
          ),
        ),
      ),
    )
    renderWithSession(<StuckStudentsWorkspace />, {
      session: {
        userId: "5",
        displayName: "Dean",
        role: "dean",
        signedInAt: "2026-07-31T00:00:00Z",
      },
    })

    const table = await screen.findByRole("table", { name: "Stuck students" })
    expect(within(table).getByText("2023-06-00002")).toBeInTheDocument()
    expect(
      screen.getByText(/No institutional threshold is configured/),
    ).toBeInTheDocument()
  })

  it("flags rows past a configured threshold and hides the unconfigured notice", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url(input).includes("academic-terms") ? terms : configuredStuck,
          ),
        ),
      ),
    )
    renderWithSession(<StuckStudentsWorkspace />, {
      session: {
        userId: "5",
        displayName: "Dean",
        role: "dean",
        signedInAt: "2026-07-31T00:00:00Z",
      },
    })

    const table = await screen.findByRole("table", { name: "Stuck students" })
    expect(within(table).getByText("Past threshold")).toBeInTheDocument()
    expect(
      screen.queryByText(/No institutional threshold is configured/),
    ).not.toBeInTheDocument()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url(input).includes("academic-terms") ? terms : unconfiguredStuck,
          ),
        ),
      ),
    )
    const { container } = renderWithSession(<StuckStudentsWorkspace />, {
      session: {
        userId: "5",
        displayName: "Dean",
        role: "dean",
        signedInAt: "2026-07-31T00:00:00Z",
      },
    })
    await screen.findByRole("table", { name: "Stuck students" })
    expect(await axe(container)).toHaveNoViolations()
  })
})
