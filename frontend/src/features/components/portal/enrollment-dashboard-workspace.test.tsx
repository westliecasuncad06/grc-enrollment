import { screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { EnrollmentDashboardWorkspace } from "@/features/components/portal/enrollment-dashboard-workspace"
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
      status: "active",
      status_label: "Active",
    },
  ],
}

// funnel_counts.enrolled deliberately differs from status_counts.enrolled so the
// two "Enrolled: N" badges (different cards) don't collide in Testing Library queries.
const summary = {
  data: {
    type: "enrollment_summary",
    academic_term_id: 2,
    status_counts: { draft: 0, enrolled: 5, rejected: 1 },
    funnel_counts: {
      submitted: 6,
      registrar_decided: 6,
      payment_confirmed: 5,
      enrolled: 4,
    },
    total_sections: 4,
    published_sections: 3,
    total_capacity: 120,
    total_enrolled_seats: 40,
    grade_status_counts: { draft: 1, submitted: 0, locked: 2 },
  },
}

function url(input: RequestInfo | URL) {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
}

describe("EnrollmentDashboardWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("withholds the dashboard from a non-dean role", () => {
    renderWithSession(<EnrollmentDashboardWorkspace />, {
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

  it("shows enrollment status, funnel, section fill, and grade counts", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url(input).includes("academic-terms") ? terms : summary,
          ),
        ),
      ),
    )
    renderWithSession(<EnrollmentDashboardWorkspace />, {
      session: {
        userId: "5",
        displayName: "Dean",
        role: "dean",
        signedInAt: "2026-07-31T00:00:00Z",
      },
    })

    expect(await screen.findByText(/Enrolled: 5/)).toBeInTheDocument()
    expect(screen.getByText(/Submitted: 6/)).toBeInTheDocument()
    expect(screen.getByText(/3 of 4/)).toBeInTheDocument()
    expect(screen.getByText(/40 of 120/)).toBeInTheDocument()
    expect(screen.getByText(/Locked: 2/)).toBeInTheDocument()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url(input).includes("academic-terms") ? terms : summary,
          ),
        ),
      ),
    )
    const { container } = renderWithSession(<EnrollmentDashboardWorkspace />, {
      session: {
        userId: "5",
        displayName: "Dean",
        role: "dean",
        signedInAt: "2026-07-31T00:00:00Z",
      },
    })
    await screen.findByText(/Enrolled: 5/)
    expect(await axe(container)).toHaveNoViolations()
  })
})
