import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { DemandForecastDialog } from "@/features/components/portal/demand-forecast-dialog"

describe("DemandForecastDialog", () => {
  it("shows advisory demand and faculty-load evidence, then closes through its explicit action", async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()

    render(
      <DemandForecastDialog
        open
        onOpenChange={onOpenChange}
        run={{
          type: "schedule_generation_run",
          id: 8,
          academic_term_id: 3,
          prediction_run_id: 7,
          college: "ccs",
          status: "succeeded",
          warnings: [
            {
              type: "room_metadata_incomplete",
              message: "Section CS101-A is missing room metadata.",
              entity_id: 12,
            },
            {
              type: "room_metadata_incomplete",
              message: "Section CS101-B is missing room metadata.",
              entity_id: 34,
            },
            {
              type: "no_historical_data",
              message: "No historical data was available for this term.",
              entity_id: null,
            },
          ],
          error_summary: null,
          started_at: null,
          completed_at: null,
          created_at: null,
          model: {
            strategy: "random_forest",
            model_version: "section-demand-rf-v1",
            training_observation_count: 12,
            mae: 2.1,
            rmse: 2.8,
          },
          forecasts: [
            {
              subject_id: 5,
              subject_code: "CS101",
              subject_title: "Introduction to Computing",
              year_level: 1,
              predicted_demand: 82,
              suggested_section_count: 3,
              confidence_lower: 74,
              confidence_upper: 89,
              historical_basis: {
                school_year: "2026-2027",
                semester: "1st",
                year_level: 1,
              },
              rationale: {},
            },
          ],
          faculty_load: {
            academic_term_id: 3,
            college: "ccs",
            threshold_units: 18,
            required_teaching_units: 9,
            required_assignments: 3,
            equivalent_faculty_loads: 1,
            assigned_count: 2,
            unassigned_count: 1,
            overloaded_count: 0,
            faculty: [],
            unassigned: [],
          },
        }}
      />,
    )

    expect(screen.getByRole("dialog")).toHaveTextContent("Demand Forecast")
    expect(screen.getByRole("dialog")).toHaveTextContent("CS101")
    expect(screen.getByRole("dialog")).toHaveTextContent("Random Forest")
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Faculty Loading Support",
    )
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "No historical data was available for this term.",
    )
    expect(
      screen.getByRole("button", { name: "Show 2" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /View in Analytics/ }),
    ).toHaveAttribute("href", "/portal/program-chair-analytics")

    await user.click(screen.getByRole("button", { name: "Close forecast" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
