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
    subject_code: "CS101",
    subject_title: "Programming 1",
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
  currentYearLevel = null,
  currentSemester = null,
}: {
  subjects?: readonly EligibleSubject[]
  selections?: Record<number, number>
  onChoose?: (subjectId: number, sectionId: number) => void
  onClear?: (subjectId: number) => void
  disabled?: boolean
  currentYearLevel?: number | null
  currentSemester?: string | null
} = {}) {
  return render(
    <EligibleSubjectTable
      subjects={subjects}
      selections={selections}
      onChoose={onChoose}
      onClear={onClear}
      disabled={disabled}
      currentYearLevel={currentYearLevel}
      currentSemester={currentSemester}
    />,
  )
}

describe("EligibleSubjectTable", () => {
  it("lists every subject with a manual section picker", () => {
    renderTable()

    expect(screen.getAllByText("CS101").length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText("CS101 section").length).toBeGreaterThan(0)
  })

  it("shows the schedule column in 12-hour clock time, not military time", () => {
    renderTable({ selections: { 1: 1 } })

    expect(
      screen.getAllByText("MWF · 8:00 AM–9:00 AM").length,
    ).toBeGreaterThan(0)
  })

  it("shows the picker option's own time in 12-hour clock time", async () => {
    const user = userEvent.setup()
    const afternoon = subject({
      available_sections: [
        section({ starts_at_time: "13:00:00", ends_at_time: "14:00:00" }),
      ],
    })
    renderTable({ subjects: [afternoon] })

    await user.click(screen.getAllByLabelText("CS101 section")[0])

    expect(
      await screen.findByRole("option", { name: /1:00 PM–2:00 PM/ }),
    ).toBeInTheDocument()
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
        section({
          id: 2,
          college: "coe",
          is_own_department: false,
          subject_code: "RIZAL",
          subject_title: "Life and Works of Rizal",
        }),
      ],
    })
    renderTable({ subjects: [otherCollege] })

    await user.click(screen.getAllByLabelText("CS101 section")[0])

    expect(
      await screen.findByRole("option", {
        name: /Section A.*COE.*Life and Works of Rizal/,
      }),
    ).toBeInTheDocument()
  })

  it("shows only the section code and seat count once chosen — the Schedule column already has the time", () => {
    renderTable({ selections: { 1: 1 } })

    const trigger = screen.getAllByLabelText("CS101 section")[0]
    expect(trigger).toHaveTextContent("Section A · 30 seats open")
    expect(trigger).not.toHaveTextContent("MWF")
    expect(trigger).not.toHaveTextContent("8:00 AM")
  })

  it("still shows each option's own schedule while the picker is open, to tell sections apart", async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(screen.getAllByLabelText("CS101 section")[0])

    expect(
      await screen.findByRole("option", { name: /MWF.*8:00 AM–9:00 AM/ }),
    ).toBeInTheDocument()
  })

  it("shows a College badge naming the section's own course once selected", () => {
    const otherCollege = subject({
      available_sections: [
        section({
          id: 2,
          college: "coe",
          is_own_department: false,
          subject_code: "RIZAL",
          subject_title: "Life and Works of Rizal",
        }),
      ],
    })
    renderTable({ subjects: [otherCollege], selections: { 1: 2 } })

    expect(
      screen.getAllByText("COE section — Life and Works of Rizal").length,
    ).toBeGreaterThan(0)
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

  it("brings every removed subject back into view via Show all", async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(screen.getAllByRole("button", { name: "Remove CS101" })[0])
    expect(screen.queryByText("CS101")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Show all" }))

    expect(screen.getAllByText("CS101").length).toBeGreaterThan(0)
  })

  it("tags a subject from an earlier semester than the student's standing as Backlog", () => {
    const backlog = subject({ year_level: 2, semester: "1st" })
    renderTable({
      subjects: [backlog],
      currentYearLevel: 3,
      currentSemester: "1st",
    })

    expect(screen.getAllByText("Backlog").length).toBeGreaterThan(0)
  })

  it("does not tag the student's current-semester subject as Backlog", () => {
    const current = subject({ year_level: 3, semester: "1st" })
    renderTable({
      subjects: [current],
      currentYearLevel: 3,
      currentSemester: "1st",
    })

    expect(screen.queryByText("Backlog")).not.toBeInTheDocument()
  })

  it("does not tag anything Backlog when the student's standing is unknown", () => {
    const earlier = subject({ year_level: 1, semester: "1st" })
    renderTable({ subjects: [earlier] })

    expect(screen.queryByText("Backlog")).not.toBeInTheDocument()
  })

  it("lets you add back one specific removed subject via the Add subject picker", async () => {
    const user = userEvent.setup()
    const another = subject({
      subject_id: 2,
      code: "CS102",
      title: "Programming 2",
      available_sections: [section({ id: 2, subject_id: 2 })],
    })
    renderTable({ subjects: [subject(), another] })

    await user.click(screen.getAllByRole("button", { name: "Remove CS101" })[0])
    expect(screen.queryByText("CS101")).not.toBeInTheDocument()
    expect(screen.getAllByText("CS102").length).toBeGreaterThan(0)

    const addInput = screen.getByLabelText("Add subject")
    await user.click(addInput)
    await user.click(await screen.findByRole("option", { name: /CS101/ }))

    expect(screen.getAllByText("CS101").length).toBeGreaterThan(0)
    expect(screen.getAllByText("CS102").length).toBeGreaterThan(0)
  })

  it("does not render a Recommend subjects button — the table already shows every recommended subject", () => {
    renderTable({ currentYearLevel: 3, currentSemester: "1st" })

    expect(
      screen.queryByRole("button", { name: "Recommend subjects" }),
    ).not.toBeInTheDocument()
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

  it("disables a section that would overlap another subject's picked schedule, and explains why", async () => {
    const user = userEvent.setup()
    const cs101 = subject({
      subject_id: 1,
      code: "CS101",
      available_sections: [section({ id: 1 })], // MWF 08:00-09:00
    })
    const math101 = subject({
      subject_id: 2,
      code: "MATH101",
      available_sections: [
        section({
          id: 10,
          subject_id: 2,
          section_code: "B",
          schedule_days: "MWF",
          starts_at_time: "08:30:00",
          ends_at_time: "09:30:00",
        }),
        section({
          id: 11,
          subject_id: 2,
          section_code: "C",
          schedule_days: "TTh",
          starts_at_time: "10:00:00",
          ends_at_time: "11:00:00",
        }),
      ],
    })
    renderTable({ subjects: [cs101, math101], selections: { 1: 1 } })

    await user.click(screen.getAllByLabelText("MATH101 section")[0])

    const conflicting = await screen.findByRole("option", {
      name: /Section B.*Conflicts with CS101/,
    })
    expect(conflicting).toHaveAttribute("aria-disabled", "true")
    expect(
      screen.getByRole("option", { name: /Section C/ }),
    ).not.toHaveAttribute("aria-disabled", "true")
  })

  it("does not disable a section on a day that doesn't overlap another pick", async () => {
    const user = userEvent.setup()
    const cs101 = subject({
      subject_id: 1,
      code: "CS101",
      available_sections: [section({ id: 1 })], // MWF 08:00-09:00
    })
    const math101 = subject({
      subject_id: 2,
      code: "MATH101",
      available_sections: [
        section({
          id: 11,
          subject_id: 2,
          section_code: "C",
          schedule_days: "TTh",
          starts_at_time: "10:00:00",
          ends_at_time: "11:00:00",
        }),
      ],
    })
    renderTable({ subjects: [cs101, math101], selections: { 1: 1 } })

    await user.click(screen.getAllByLabelText("MATH101 section")[0])

    expect(
      await screen.findByRole("option", { name: /Section C/ }),
    ).not.toHaveAttribute("aria-disabled", "true")
  })

  it("arranges rows by schedule, sinking not-yet-picked subjects to the bottom", async () => {
    const user = userEvent.setup()
    const afternoon = subject({
      subject_id: 1,
      code: "AFTERNOON",
      available_sections: [
        section({
          id: 1,
          subject_id: 1,
          schedule_days: "MWF",
          starts_at_time: "13:00:00",
          ends_at_time: "14:00:00",
        }),
      ],
    })
    const morning = subject({
      subject_id: 2,
      code: "MORNING",
      available_sections: [
        section({
          id: 2,
          subject_id: 2,
          schedule_days: "M",
          starts_at_time: "07:30:00",
          ends_at_time: "08:30:00",
        }),
      ],
    })
    const unpicked = subject({
      subject_id: 3,
      code: "UNPICKED",
      available_sections: [section({ id: 3, subject_id: 3 })],
    })
    const { container } = renderTable({
      subjects: [afternoon, morning, unpicked],
      selections: { 1: 1, 2: 2 },
    })

    await user.click(
      screen.getByRole("button", { name: "Arrange by schedule" }),
    )

    const text = container.textContent ?? ""
    expect(text.indexOf("MORNING")).toBeLessThan(text.indexOf("AFTERNOON"))
    expect(text.indexOf("AFTERNOON")).toBeLessThan(text.indexOf("UNPICKED"))
  })

  it("stays arranged by schedule after a second click, it never un-arranges", async () => {
    const user = userEvent.setup()
    const afternoon = subject({
      subject_id: 1,
      code: "AFTERNOON",
      available_sections: [
        section({
          id: 1,
          subject_id: 1,
          schedule_days: "MWF",
          starts_at_time: "13:00:00",
          ends_at_time: "14:00:00",
        }),
      ],
    })
    const morning = subject({
      subject_id: 2,
      code: "MORNING",
      available_sections: [
        section({
          id: 2,
          subject_id: 2,
          schedule_days: "M",
          starts_at_time: "07:30:00",
          ends_at_time: "08:30:00",
        }),
      ],
    })
    const { container } = renderTable({
      subjects: [afternoon, morning],
      selections: { 1: 1, 2: 2 },
    })

    const arrangeButton = screen.getByRole("button", {
      name: "Arrange by schedule",
    })
    await user.click(arrangeButton)
    await user.click(arrangeButton)

    const text = container.textContent ?? ""
    expect(text.indexOf("MORNING")).toBeLessThan(text.indexOf("AFTERNOON"))
  })

  it("keeps Arrange by schedule clickable and red, never grayed out, after it's applied", async () => {
    const user = userEvent.setup()
    renderTable()

    const arrangeButton = screen.getByRole("button", {
      name: "Arrange by schedule",
    })
    expect(arrangeButton).not.toBeDisabled()
    expect(arrangeButton).toHaveAttribute("data-variant", "default")

    await user.click(arrangeButton)

    expect(arrangeButton).not.toBeDisabled()
    expect(arrangeButton).toHaveAttribute("data-variant", "default")
  })

  it("has no detectable accessibility violations", async () => {
    const { container } = renderTable()

    expect(await axe(container)).toHaveNoViolations()
  })
})
