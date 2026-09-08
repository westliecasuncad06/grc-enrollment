import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { YearOverYearReportDialog } from "@/features/components/portal/year-over-year-report-dialog"
import { renderWithSession } from "@/tests/render-app"

const sampleYoy = [
  { school_year: "2024-2025", enrollment_count: 100 },
  { school_year: "2025-2026", enrollment_count: 150 },
  { school_year: "2026-2027", enrollment_count: 200 },
]

describe("YearOverYearReportDialog", () => {
  beforeEach(() => {
    vi.stubGlobal("print", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("renders institutional header, metrics, and year-over-year comparison table", () => {
    renderWithSession(
      <YearOverYearReportDialog
        open={true}
        onOpenChange={vi.fn()}
        data={sampleYoy}
      />,
    )

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("GLOBAL RECIPROCAL COLLEGES")).toBeInTheDocument()
    expect(
      screen.getByText("Official Year-over-Year Enrollment Report"),
    ).toBeInTheDocument()

    // Metric cards and summary
    expect(screen.getAllByText("450").length).toBeGreaterThan(0)
    expect(screen.getAllByText("2026-2027").length).toBeGreaterThan(0)
    expect(screen.getAllByText("200").length).toBeGreaterThan(0)

    // Table rows
    const table = screen.getByRole("table")
    expect(within(table).getByText("2024-2025")).toBeInTheDocument()
    expect(within(table).getByText("2025-2026")).toBeInTheDocument()
    expect(within(table).getByText("2026-2027")).toBeInTheDocument()

    // Calculated percentage changes
    expect(within(table).getByText("Baseline")).toBeInTheDocument()
    expect(within(table).getByText("+50.0%")).toBeInTheDocument()
    expect(within(table).getByText("+33.3%")).toBeInTheDocument()

    // Total row
    expect(within(table).getByText("Total Historical")).toBeInTheDocument()
    expect(within(table).getByText("100.0%")).toBeInTheDocument()
  })

  it("calls print when Print report button is clicked", async () => {
    const user = userEvent.setup()
    const printSpy = vi.fn()
    vi.stubGlobal("print", printSpy)

    renderWithSession(
      <YearOverYearReportDialog
        open={true}
        onOpenChange={vi.fn()}
        data={sampleYoy}
      />,
    )

    const printBtn = screen.getByRole("button", { name: "Print report" })
    expect(printBtn).toBeInTheDocument()
    await user.click(printBtn)

    // requestAnimationFrame triggers print
    await vi.waitFor(() => {
      expect(printSpy).toHaveBeenCalled()
    })
  })

  it("has no detectable accessibility violations once rendered", async () => {
    const { container } = renderWithSession(
      <YearOverYearReportDialog
        open={true}
        onOpenChange={vi.fn()}
        data={sampleYoy}
      />,
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})
