import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { StuckEnrollmentStatusChart } from "@/features/components/portal/stuck-enrollment-status-chart"

// See enrollment-year-over-year-chart.test.tsx for why this stub is scoped
// to only the responsive-container div.
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

describe("StuckEnrollmentStatusChart", () => {
  it("renders a fallback message and no bars for an empty rows array", () => {
    const { container } = render(
      <StuckEnrollmentStatusChart rows={[]} thresholdConfigured />,
    )

    expect(
      screen.getByText(
        "No enrollments are currently in progress toward enrolled for this term.",
      ),
    ).toBeInTheDocument()
    expect(
      container.querySelector(".recharts-bar-rectangle"),
    ).not.toBeInTheDocument()
  })

  it("groups rows into one stacked bar row per status", () => {
    const { container } = render(
      <StuckEnrollmentStatusChart
        rows={[
          { status_label: "Draft", is_flagged: false },
          { status_label: "Draft", is_flagged: true },
          { status_label: "Pending registrar approval", is_flagged: false },
        ]}
        thresholdConfigured
      />,
    )

    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0)
    expect(
      screen.getAllByText("Pending registrar approval").length,
    ).toBeGreaterThan(0)
    // 2 statuses x up to 2 stacked segments each (on-time + flagged, only
    // rendered when nonzero) = 3 rectangles for these rows.
    expect(
      container.querySelectorAll(".recharts-bar-rectangle"),
    ).toHaveLength(3)
  })

  it("surfaces the flagged count in the description when a threshold is configured", () => {
    render(
      <StuckEnrollmentStatusChart
        rows={[
          { status_label: "Draft", is_flagged: true },
          { status_label: "Draft", is_flagged: false },
        ]}
        thresholdConfigured
      />,
    )

    expect(screen.getByText(/1 of 2 in progress right now/)).toBeInTheDocument()
  })

  it("explains that flagged stays at zero when no threshold is configured", () => {
    render(
      <StuckEnrollmentStatusChart
        rows={[{ status_label: "Draft", is_flagged: false }]}
        thresholdConfigured={false}
      />,
    )

    expect(
      screen.getByText(/No institutional threshold is configured yet/),
    ).toBeInTheDocument()
  })
})
