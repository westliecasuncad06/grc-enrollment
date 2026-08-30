import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EnrollmentFunnelChart } from "@/features/components/portal/enrollment-funnel-chart"

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

describe("EnrollmentFunnelChart", () => {
  it("renders a fallback message and no funnel when the first stage is empty", () => {
    const { container } = render(
      <EnrollmentFunnelChart
        stages={[
          { key: "submitted", label: "Submitted", count: 0 },
          { key: "enrolled", label: "Enrolled", count: 0 },
        ]}
      />,
    )

    expect(
      screen.getByText("No submitted enrollments yet this term."),
    ).toBeInTheDocument()
    expect(
      container.querySelector(".recharts-funnel-trapezoid"),
    ).not.toBeInTheDocument()
  })

  it("renders one trapezoid per stage, in the given order", () => {
    const { container } = render(
      <EnrollmentFunnelChart
        stages={[
          { key: "submitted", label: "Submitted", count: 100 },
          { key: "registrar_decided", label: "Registrar decided", count: 80 },
          { key: "payment_confirmed", label: "Payment confirmed", count: 60 },
          { key: "enrolled", label: "Enrolled", count: 50 },
        ]}
      />,
    )

    expect(
      container.querySelectorAll(".recharts-funnel-trapezoid"),
    ).toHaveLength(4)
  })

  it("labels each stage with its count and conversion rate off the first stage", () => {
    render(
      <EnrollmentFunnelChart
        stages={[
          { key: "submitted", label: "Submitted", count: 100 },
          { key: "enrolled", label: "Enrolled", count: 50 },
        ]}
      />,
    )

    expect(screen.getByText("Submitted: 100 (100%)")).toBeInTheDocument()
    expect(screen.getByText("Enrolled: 50 (50%)")).toBeInTheDocument()
  })
})
