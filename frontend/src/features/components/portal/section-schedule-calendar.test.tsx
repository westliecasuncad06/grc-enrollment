import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import {
  SectionScheduleCalendar,
  type SectionScheduleItem,
} from "@/features/components/portal/section-schedule-calendar"
import { SectionScheduleCalendarDialog } from "@/features/components/portal/section-schedule-calendar-dialog"

const sampleItems: SectionScheduleItem[] = [
  {
    id: 101,
    subject_code: "IT101",
    subject_title: "Introduction to Computing",
    units: 3,
    room: "3F",
    professor_name: "Danilo Portiles",
    schedule_days: "TUE",
    starts_at_time: "07:30:00",
    ends_at_time: "09:30:00",
    modality: "hyflex_a",
  },
  {
    id: 102,
    subject_code: "IT101L",
    subject_title: "Introduction to Computing LAB",
    units: 1,
    room: "LAB2",
    professor_name: "Danilo Portiles",
    schedule_days: "WED",
    starts_at_time: "07:30:00",
    ends_at_time: "10:30:00",
    modality: "f2f",
  },
  {
    id: 103,
    subject_code: "ITASYNC",
    subject_title: "Asynchronous Subject",
    units: 2,
    room: null,
    professor_name: "Online Prof",
    schedule_days: null,
    starts_at_time: null,
    ends_at_time: null,
    modality: "online" as unknown as null,
  },
]

describe("SectionScheduleCalendar", () => {
  it("renders the weekly calendar grid with scheduled subjects", () => {
    render(<SectionScheduleCalendar items={sampleItems} />)

    expect(screen.getByText("IT101")).toBeInTheDocument()
    expect(screen.getByText("IT101L")).toBeInTheDocument()
    expect(screen.getAllByText("Danilo Portiles").length).toBeGreaterThan(0)
    expect(screen.getByText("3F")).toBeInTheDocument()
    expect(screen.getByText("LAB2")).toBeInTheDocument()
    expect(screen.getByText("7:30 AM–9:30 AM")).toBeInTheDocument()
    expect(screen.getByText("7:30 AM–10:30 AM")).toBeInTheDocument()
  })

  it("renders asynchronous / unscheduled subjects in the bottom tray", () => {
    render(<SectionScheduleCalendar items={sampleItems} />)

    expect(
      screen.getByText(/Asynchronous & Unscheduled Subjects/i),
    ).toBeInTheDocument()
    expect(screen.getByText("ITASYNC")).toBeInTheDocument()
    expect(screen.getByText("Asynchronous Subject")).toBeInTheDocument()
  })

  it("calls onSelectSubject when a subject block is clicked", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <SectionScheduleCalendar
        items={sampleItems}
        onSelectSubject={onSelect}
      />,
    )

    const buttons = screen.getAllByRole("button", {
      name: /click to edit assignment/i,
    })
    await user.click(buttons[0])

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 101,
        subject_code: "IT101",
      }),
    )
  })

  it("has no detectable accessibility violations", async () => {
    const { container } = render(
      <SectionScheduleCalendar items={sampleItems} />,
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("SectionScheduleCalendarDialog", () => {
  it("renders modal with calendar view by default and allows switching to table", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <SectionScheduleCalendarDialog
        open={true}
        onOpenChange={onOpenChange}
        title="IT101 Schedule"
        subtitle="1st Year Block Section · 3 subjects"
        items={sampleItems}
      />,
    )

    const dialog = screen.getByRole("dialog", { name: /IT101 Schedule/i })
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getAllByText(/3 subjects/i).length).toBeGreaterThan(0)

    // Calendar is default
    expect(within(dialog).getByText("IT101")).toBeInTheDocument()
    expect(within(dialog).getByText("7:30 AM–9:30 AM")).toBeInTheDocument()

    // Switch to Table view
    await user.click(within(dialog).getByRole("radio", { name: "Table view" }))
    expect(within(dialog).getByRole("table")).toBeInTheDocument()
    expect(
      within(dialog).getByText("Introduction to Computing"),
    ).toBeInTheDocument()
  })
})
