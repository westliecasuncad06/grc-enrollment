import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { AnalyticsDashboardWorkspace } from "@/features/components/portal/analytics-dashboard-workspace"
import { renderWithSession } from "@/tests/render-app"

const terms = {
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
      add_drop_deadline_at: null,
      grading_deadline_at: null,
      status: "semester_ongoing",
      status_label: "Semester Ongoing",
    },
  ],
} as const

const summary = {
  data: {
    type: "program_chair_analytics_summary",
    academic_term_id: 1,
    college: "ccs",
    enrollment_status_counts: { draft: 3, enrolled: 22, withdrawn: 1 },
    grade_status_counts: { pending: 10, passed: 12, failed: 1 },
    retention_breakdown: [
      { grade_status: "passed", enrollment_status: "enrolled", count: 12 },
      { grade_status: "failed", enrollment_status: "enrolled", count: 1 },
      { grade_status: "pending", enrollment_status: "enrolled", count: 9 },
      { grade_status: "pending", enrollment_status: "withdrawn", count: 1 },
    ],
    year_over_year: [
      { school_year: "2025-2026", semester: "1st", enrollee_count: 18 },
      { school_year: "2026-2027", semester: "1st", enrollee_count: 22 },
    ],
  },
} as const

const run = {
  data: {
    type: "schedule_generation_run",
    id: 501,
    academic_term_id: 1,
    prediction_run_id: 77,
    college: "ccs",
    status: "succeeded",
    warnings: [],
    error_summary: null,
    started_at: "2026-08-01T00:00:00Z",
    completed_at: "2026-08-01T00:05:00Z",
    created_at: "2026-08-01T00:00:00Z",
    forecasts: [
      {
        subject_id: 101,
        subject_code: "IT101",
        subject_title: "Introduction to Computing",
        year_level: 1,
        predicted_demand: 42,
        suggested_section_count: 2,
        confidence_lower: 38,
        confidence_upper: 46,
        historical_basis: {
          school_year: "2025-2026",
          semester: "1st",
          year_level: 1,
        },
        rationale: {},
      },
    ],
  },
} as const

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

// recharts' ResponsiveContainer measures its container via
// getBoundingClientRect on mount before its ResizeObserver ever fires; jsdom
// reports every element as 0x0, which otherwise leaves recharts falling back
// to an uninstrumented canvas text measurement and logging a jsdom warning.
// Matches the stub in enrollment-year-over-year-chart.test.tsx.
// eslint-disable-next-line @typescript-eslint/unbound-method
const realGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

function renderWorkspace() {
  return renderWithSession(<AnalyticsDashboardWorkspace />, {
    session: {
      userId: "chair-1",
      displayName: "Program Chair",
      role: "program_chair",
      college: "ccs",
      signedInAt: "2026-08-12T00:00:00Z",
    },
  })
}

describe("AnalyticsDashboardWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()

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
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      const body = url.endsWith("/academic-terms")
        ? terms
        : url.includes("/dashboards/program-chair-analytics-summary")
          ? summary
          : url.includes("/schedule-generation-runs/latest")
            ? run
            : { data: [] }
      return Promise.resolve(new Response(JSON.stringify(body)))
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("withholds the workspace from a non-program-chair role", () => {
    renderWithSession(<AnalyticsDashboardWorkspace />, {
      session: {
        userId: "5",
        displayName: "Dean",
        role: "dean",
        signedInAt: "2026-08-12T00:00:00Z",
      },
    })
    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("shows enrollment status counts and the year-over-year chart on the Descriptive tab", async () => {
    renderWorkspace()

    expect(await screen.findByText(/Enrolled: 22/)).toBeInTheDocument()
    expect(screen.getByText(/Draft: 3/)).toBeInTheDocument()
    expect(screen.getByText("Enrollment Year-over-Year")).toBeInTheDocument()
  })

  it("shows a readable grade-status by enrollment-status crosstab on the Diagnostic tab", async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await screen.findByText(/Enrolled: 22/)

    await user.click(screen.getByRole("tab", { name: "Diagnostic" }))

    const table = await screen.findByRole("table")
    expect(
      screen.getByRole("columnheader", { name: "Enrolled" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: "Withdrawn" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("row", { name: /Passed 12/ })).toBeInTheDocument()
    expect(table).toBeInTheDocument()
  })

  it("shows a read-only forecast table on the Predictive tab", async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await screen.findByText(/Enrolled: 22/)

    await user.click(screen.getByRole("tab", { name: "Predictive" }))

    expect(await screen.findByText("IT101")).toBeInTheDocument()
    expect(screen.getByText("42")).toBeInTheDocument()
  })

  it("shows rule-based recommendations on the Prescriptive tab", async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await screen.findByText(/Enrolled: 22/)

    await user.click(screen.getByRole("tab", { name: "Prescriptive" }))

    expect(
      await screen.findByText(/Expected 42 IT101 students/),
    ).toBeInTheDocument()
    expect(screen.getByText("Rule-based, not a new model")).toBeInTheDocument()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    const { container } = renderWorkspace()
    await screen.findByText(/Enrolled: 22/)
    expect(await axe(container)).toHaveNoViolations()
  })
})
