import { screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { EnrollmentDashboardWorkspace } from "@/features/components/portal/enrollment-dashboard-workspace"
import { renderWithSession } from "@/tests/render-app"

// recharts' ResponsiveContainer measures its container via
// getBoundingClientRect on mount before its ResizeObserver ever fires; jsdom
// reports every element as 0x0, so without this stub the funnel/stuck-status
// charts render no series and their direct labels never appear. See
// enrollment-year-over-year-chart.test.tsx for the same stub.
// eslint-disable-next-line @typescript-eslint/unbound-method
const realGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement): DOMRect {
      if (this.classList.contains("recharts-responsive-container")) {
        return {
          width: 600,
          height: 320,
          top: 0,
          left: 0,
          bottom: 320,
          right: 600,
          x: 0,
          y: 0,
          toJSON: () => "",
        }
      }
      return realGetBoundingClientRect.call(this)
    },
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

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

const stuckEnrollments = {
  data: [
    {
      type: "stuck_enrollment",
      enrollment_id: 1,
      student_number: "2026-0001",
      status: "pending_payment",
      status_label: "Pending payment",
      days_in_status: 12,
      is_flagged: true,
    },
  ],
  meta: { threshold_configured: true, threshold_days: 7, academic_term_id: 2 },
}

function url(input: RequestInfo | URL) {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
}

function mockDashboardFetch(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
  fetchMock.mockImplementation((input) => {
    const requestUrl = url(input)
    const body = requestUrl.includes("academic-terms")
      ? terms
      : requestUrl.includes("stuck-enrollments")
        ? stuckEnrollments
        : summary
    return Promise.resolve(new Response(JSON.stringify(body)))
  })
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

  it("shows enrollment status, funnel, section fill, grade counts, and stuck enrollments", async () => {
    mockDashboardFetch(fetchMock)
    renderWithSession(<EnrollmentDashboardWorkspace />, {
      session: {
        userId: "5",
        displayName: "Dean",
        role: "dean",
        signedInAt: "2026-07-31T00:00:00Z",
      },
    })

    expect(await screen.findByText(/Enrolled: 5/)).toBeInTheDocument()
    expect(screen.getByText("Submitted: 6 (100%)")).toBeInTheDocument()
    expect(screen.getByText(/3 of 4/)).toBeInTheDocument()
    expect(screen.getByText(/40 of 120/)).toBeInTheDocument()
    expect(screen.getByText(/Locked: 2/)).toBeInTheDocument()
    expect(screen.getAllByText("Pending payment").length).toBeGreaterThan(0)
    expect(screen.getByText(/1 of 1 in progress right now/)).toBeInTheDocument()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    mockDashboardFetch(fetchMock)
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
