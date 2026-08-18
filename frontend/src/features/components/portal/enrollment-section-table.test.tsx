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

function renderTable({
  selectedBlockCode = null,
  onChoose = vi.fn(),
  onChangeSection = vi.fn(),
  disabled = false,
}: {
  selectedBlockCode?: string | null
  onChoose?: (blockCode: string) => void
  onChangeSection?: () => void
  disabled?: boolean
} = {}) {
  return render(
    <EnrollmentSectionTable
      blocks={blocks}
      selectedBlockCode={selectedBlockCode}
      onChoose={onChoose}
      onChangeSection={onChangeSection}
      disabled={disabled}
      renderSelectedFooter={() => <span>Selected section actions</span>}
    />,
  )
}

describe("EnrollmentSectionTable", () => {
  it("lists every section as an inline schedule card", () => {
    renderTable()

    const section = screen.getByRole("article", { name: "IT301 section" })
    expect(
      screen.getByRole("article", { name: "IT302 section" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("article", { name: "IT303 section" }),
    ).toBeInTheDocument()
    expect(within(section).getByText("40 seats")).toBeInTheDocument()
    expect(within(section).getByText("6 units")).toBeInTheDocument()
    expect(
      within(section).getByRole("table", { name: "IT301 schedule" }),
    ).toBeInTheDocument()
    expect(within(section).getByText("Subject code")).toBeInTheDocument()
    expect(within(section).getAllByText("Section ID")).not.toHaveLength(0)
    expect(within(section).getAllByText("Data Structures")).not.toHaveLength(0)
    expect(
      within(section).getByRole("button", { name: "Choose IT301" }),
    ).toBeInTheDocument()
  })

  it("calls onChoose with the inline section code", async () => {
    const user = userEvent.setup()
    const onChoose = vi.fn()
    renderTable({ onChoose })

    await user.click(screen.getByRole("button", { name: "Choose IT303" }))

    expect(onChoose).toHaveBeenCalledWith("IT303")
  })

  it("keeps a low-scoring section selectable", () => {
    renderTable()

    expect(screen.getByRole("button", { name: "Choose IT302" })).toBeEnabled()
  })

  it("shows only the selected section and changes back to the full list", async () => {
    const user = userEvent.setup()
    const onChangeSection = vi.fn()
    renderTable({ selectedBlockCode: "IT302", onChangeSection })

    expect(
      screen.getByRole("article", { name: "IT302 section" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("article", { name: "IT301 section" }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Change section" }))
    expect(onChangeSection).toHaveBeenCalledOnce()
  })

  it("disables an inline choice when the enrollment window is closed", () => {
    renderTable({ disabled: true })

    expect(screen.getByRole("button", { name: "Choose IT301" })).toBeDisabled()
  })

  it("has no detectable accessibility violations", async () => {
    const { container } = renderTable()

    expect(await axe(container)).toHaveNoViolations()
  })
})
