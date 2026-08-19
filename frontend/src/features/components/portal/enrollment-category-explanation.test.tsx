import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { EnrollmentCategoryExplanation } from "@/features/components/portal/enrollment-category-explanation"
import type { AudienceAvailability } from "@/features/schemas/enrollment-window-schema"

function viewer(overrides: Partial<AudienceAvailability>): AudienceAvailability {
  return {
    audience: "year_1",
    label: "1st Year",
    opens_at: null,
    closes_at: null,
    is_open: true,
    reason: "open",
    ...overrides,
  }
}

describe("EnrollmentCategoryExplanation", () => {
  it("renders nothing when there is no viewer", () => {
    const { container } = render(
      <EnrollmentCategoryExplanation viewer={null} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("explains Regular standing for a year-level audience", () => {
    render(
      <EnrollmentCategoryExplanation
        viewer={viewer({ audience: "year_2", label: "2nd Year" })}
      />,
    )

    expect(screen.getByText("You're Regular this semester")).toBeInTheDocument()
    expect(screen.getByText(/one section for your whole block/)).toBeInTheDocument()
  })

  it("explains Irregular standing and mentions Backlog for the irregular audience", () => {
    render(
      <EnrollmentCategoryExplanation
        viewer={viewer({ audience: "irregular", label: "Irregular Students" })}
      />,
    )

    expect(
      screen.getByText("You're Irregular this semester"),
    ).toBeInTheDocument()
    expect(screen.getByText(/“Backlog”/)).toBeInTheDocument()
    expect(screen.getByText(/return to Regular automatically/)).toBeInTheDocument()
  })
})
