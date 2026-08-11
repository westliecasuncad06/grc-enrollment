import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { EnrollmentSectionTable } from "@/features/components/portal/enrollment-section-table"
import type { EnrollmentBlock } from "@/features/schemas/enrollment-block-schema"

function block(overrides: Partial<EnrollmentBlock>): EnrollmentBlock {
  return {
    type: "enrollment_block",
    block_code: "IT301",
    year_level: 2,
    curriculum_id: 9,
    section_plan_id: 12,
    total_units: 6,
    seats_remaining: 7,
    capacity: 40,
    is_selectable: true,
    reasons: [],
    preference_score: null,
    preference_reasons: [],
    subjects: [
      {
        section_id: 5,
        subject_id: 7,
        code: "CS201",
        title: "Data Structures",
        units: 3,
        schedule_days: "MWF",
        starts_at_time: "08:00:00",
        ends_at_time: "09:00:00",
        room: "LAB-1",
        modality: "f2f",
        professor_name: "Dr. Cruz",
        capacity: 40,
        enrolled_count: 33,
        remaining_seats: 7,
      },
      {
        section_id: 6,
        subject_id: 8,
        code: "GE201",
        title: "Ethics",
        units: 3,
        schedule_days: "TTh",
        starts_at_time: "10:00:00",
        ends_at_time: "11:30:00",
        room: "R201",
        modality: "f2f",
        professor_name: "Dr. Reyes",
        capacity: 40,
        enrolled_count: 30,
        remaining_seats: 10,
      },
    ],
    ...overrides,
  }
}

const blocks: EnrollmentBlock[] = [
  block({
    block_code: "IT301",
    preference_score: 40,
    preference_reasons: ["Matches your preferred time block"],
  }),
  block({
    block_code: "IT302",
    preference_score: null,
    preference_reasons: [],
  }),
  block({
    block_code: "IT303",
    preference_score: 90,
    preference_reasons: ["Matches your preferred days"],
  }),
]

describe("EnrollmentSectionTable", () => {
  it("lists every section with a uniquely named View action", () => {
    render(<EnrollmentSectionTable blocks={blocks} onView={vi.fn()} />)

    const table = screen.getByRole("table", { name: /available sections/i })
    expect(within(table).getByText("IT301")).toBeInTheDocument()
    expect(within(table).getByText("IT302")).toBeInTheDocument()
    expect(within(table).getByText("IT303")).toBeInTheDocument()
    expect(
      within(table).getByRole("button", { name: "View IT301" }),
    ).toBeInTheDocument()
    expect(
      within(table).getByRole("button", { name: "View IT303" }),
    ).toBeInTheDocument()
  })

  it("calls onView with the chosen block", async () => {
    const user = userEvent.setup()
    const onView = vi.fn()
    render(<EnrollmentSectionTable blocks={blocks} onView={onView} />)

    const table = screen.getByRole("table", { name: /available sections/i })
    await user.click(within(table).getByRole("button", { name: "View IT303" }))

    expect(onView).toHaveBeenCalledWith(
      expect.objectContaining({ block_code: "IT303" }),
    )
  })

  it("shows a preference score badge and top reason, or an em dash when unscored", () => {
    render(<EnrollmentSectionTable blocks={blocks} onView={vi.fn()} />)

    const table = screen.getByRole("table", { name: /available sections/i })
    expect(within(table).getByText("40")).toBeInTheDocument()
    expect(
      within(table).getByText("Matches your preferred time block"),
    ).toBeInTheDocument()
    expect(within(table).getByText("—")).toBeInTheDocument()
  })

  it("sorts by preference match when preferences are applied, without removing any row", async () => {
    const user = userEvent.setup()
    render(<EnrollmentSectionTable blocks={blocks} onView={vi.fn()} />)

    await user.click(
      screen.getByRole("switch", { name: "Apply my preferences" }),
    )

    const rows = within(
      screen.getByRole("table", { name: /available sections/i }),
    ).getAllByRole("row")
    // rows[0] is the header row; the highest preference_score sorts first.
    expect(within(rows[1]).getByText("IT303")).toBeInTheDocument()
    // Every section is still present — the switch ranks, it never filters.
    expect(within(rows[2]).getByText(/IT301|IT302/)).toBeInTheDocument()
    expect(within(rows[3]).getByText(/IT301|IT302/)).toBeInTheDocument()
  })

  it("keeps a low-scoring section's View action enabled", () => {
    render(<EnrollmentSectionTable blocks={blocks} onView={vi.fn()} />)

    const table = screen.getByRole("table", { name: /available sections/i })
    expect(
      within(table).getByRole("button", { name: "View IT302" }),
    ).toBeEnabled()
  })

  it("has no detectable accessibility violations", async () => {
    const { container } = render(
      <EnrollmentSectionTable blocks={blocks} onView={vi.fn()} />,
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})
