import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { EligibleSubjectTable } from "@/features/components/portal/eligible-subject-table"
import type { EligibleSubject } from "@/features/schemas/enrollment-schema"

function section(
  overrides: Partial<EligibleSubject["available_sections"][number]> = {},
): EligibleSubject["available_sections"][number] {
  return {
    type: "section",
    id: 1,
    academic_term_id: 2,
    subject_id: 7,
    section_code: "A",
    professor_id: null,
    schedule_days: "MWF",
    starts_at_time: "08:00:00",
    ends_at_time: "09:00:00",
    room: "R101",
    capacity: 30,
    capacity_source: "plan",
    viability_threshold: null,
    enrolled_count: 0,
    remaining_seats: 30,
    is_block_exclusive: null,
    status: "published",
    status_label: "Published",
    college: "ccs",
    is_own_department: true,
    ...overrides,
  }
}

function subject(overrides: Partial<EligibleSubject> = {}): EligibleSubject {
  return {
    type: "eligible_subject",
    subject_id: 1,
    code: "CS101",
    title: "Programming 1",
    units: 3,
    year_level: 1,
    semester: "1st",
    is_required: true,
    is_eligible: true,
    reasons: [{ code: "eligible", message: "All requirements are met." }],
    preference_score: null,
    preference_reasons: [],
    available_sections: [section()],
    ...overrides,
  }
}

function renderTable({
  subjects = [subject()],
  selections = {},
  onChoose = vi.fn(),
  onClear = vi.fn(),
  disabled = false,
}: {
  subjects?: readonly EligibleSubject[]
  selections?: Record<number, number>
  onChoose?: (subjectId: number, sectionId: number) => void
  onClear?: (subjectId: number) => void
  disabled?: boolean
} = {}) {
  return render(
    <EligibleSubjectTable
      subjects={subjects}
      selections={selections}
      onChoose={onChoose}
      onClear={onClear}
      disabled={disabled}
    />,
  )
}

describe("EligibleSubjectTable", () => {
  it("lists every subject with a manual section picker", () => {
    renderTable()

    expect(screen.getAllByText("CS101").length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText("CS101 section").length).toBeGreaterThan(0)
  })

  it("calls onChoose when a section is picked", async () => {
    const user = userEvent.setup()
    const onChoose = vi.fn()
    renderTable({ onChoose })

    await user.click(screen.getAllByLabelText("CS101 section")[0])
    await user.click(await screen.findByRole("option", { name: /Section A/ }))

    expect(onChoose).toHaveBeenCalledWith(1, 1)
  })

  it("labels a cross-department section in the picker before it's chosen", async () => {
    const user = userEvent.setup()
    const otherCollege = subject({
      available_sections: [
        section({ id: 2, college: "coe", is_own_department: false }),
      ],
    })
    renderTable({ subjects: [otherCollege] })

    await user.click(screen.getAllByLabelText("CS101 section")[0])

    expect(
      await screen.findByRole("option", { name: /Section A.*COE/ }),
    ).toBeInTheDocument()
  })

  it("shows a College badge for a cross-department section once selected", () => {
    const otherCollege = subject({
      available_sections: [
        section({ id: 2, college: "coe", is_own_department: false }),
      ],
    })
    renderTable({ subjects: [otherCollege], selections: { 1: 2 } })

    expect(screen.getAllByText("COE section").length).toBeGreaterThan(0)
  })

  it("removes a subject from view and clears its selection", async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    renderTable({ selections: { 1: 1 }, onClear })

    await user.click(screen.getAllByRole("button", { name: "Remove CS101" })[0])

    expect(onClear).toHaveBeenCalledWith(1)
    expect(screen.queryByText("CS101")).not.toBeInTheDocument()
    expect(screen.getByText("1 subject removed")).toBeInTheDocument()
  })

  it("brings a removed subject back into view via Show", async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(screen.getAllByRole("button", { name: "Remove CS101" })[0])
    expect(screen.queryByText("CS101")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Show" }))

    expect(screen.getAllByText("CS101").length).toBeGreaterThan(0)
  })

  it("disables the picker and Remove when the enrollment window is closed", () => {
    renderTable({ disabled: true })

    for (const trigger of screen.getAllByLabelText("CS101 section")) {
      expect(trigger).toBeDisabled()
    }
    for (const button of screen.getAllByRole("button", {
      name: "Remove CS101",
    })) {
      expect(button).toBeDisabled()
    }
  })

  it("has no detectable accessibility violations", async () => {
    const { container } = renderTable()

    expect(await axe(container)).toHaveNoViolations()
  })
})
