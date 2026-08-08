import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { RoomsOperationsWorkspace } from "@/features/components/portal/rooms-operations-workspace"
import { renderWithSession } from "@/tests/render-app"

const academicTerms = {
  data: [
    {
      type: "academic-term",
      id: 1,
      school_year: "2027-2028",
      semester: "2nd",
      starts_at: null,
      ends_at: null,
      enrollment_opens_at: null,
      enrollment_closes_at: null,
      add_drop_deadline_at: null,
      grading_deadline_at: null,
      status: "semester_ongoing",
      status_label: "Semester Ongoing",
    },
  ],
} as const

const rooms = {
  data: [
    { type: "room_option", id: 1, name: "LAB 1" },
    { type: "room_option", id: 2, name: "3A" },
    { type: "room_option", id: 3, name: "4B" },
  ],
} as const

const sections = {
  data: [
    {
      type: "section",
      id: 11,
      academic_term_id: 1,
      subject_id: 101,
      section_code: "IT201",
      professor_id: 5,
      schedule_days: "MW",
      starts_at_time: "08:00:00",
      ends_at_time: "10:00:00",
      room: "LAB 1",
      modality: "hyflex_a",
      capacity: 40,
      capacity_source: "plan",
      viability_threshold: null,
      enrolled_count: 0,
      remaining_seats: 40,
      is_block_exclusive: true,
      status: "planned",
      status_label: "Planned",
    },
    {
      type: "section",
      id: 12,
      academic_term_id: 1,
      subject_id: 102,
      section_code: "IT202",
      professor_id: 6,
      schedule_days: "TTh",
      starts_at_time: "10:00:00",
      ends_at_time: "12:00:00",
      room: "3A",
      modality: "f2f",
      capacity: 40,
      capacity_source: "plan",
      viability_threshold: null,
      enrolled_count: 0,
      remaining_seats: 40,
      is_block_exclusive: true,
      status: "planned",
      status_label: "Planned",
    },
  ],
} as const

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

function renderWorkspace() {
  return renderWithSession(<RoomsOperationsWorkspace />, {
    session: {
      userId: "chair-1",
      displayName: "Program Chair",
      role: "program_chair",
      college: "ccs",
      signedInAt: "2026-08-09T00:00:00Z",
    },
  })
}

describe("RoomsOperationsWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.endsWith("/academic-terms"))
        return Promise.resolve(new Response(JSON.stringify(academicTerms)))
      if (url.endsWith("/room-options"))
        return Promise.resolve(new Response(JSON.stringify(rooms)))
      if (url.endsWith("/sections"))
        return Promise.resolve(new Response(JSON.stringify(sections)))

      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it("filters room rows by a case-insensitive room name", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await screen.findByRole("cell", { name: "LAB 1" })
    await user.type(screen.getByLabelText("Search rooms"), "lab")

    expect(screen.getByRole("cell", { name: "LAB 1" })).toBeInTheDocument()
    expect(screen.queryByRole("cell", { name: "3A" })).not.toBeInTheDocument()
  })

  it("filters room rows by availability, modality, and scheduled day", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await screen.findByRole("cell", { name: "LAB 1" })
    await user.selectOptions(screen.getByLabelText("Availability"), "scheduled")
    await user.selectOptions(screen.getByLabelText("Modality"), "hyflex_a")
    await user.selectOptions(screen.getByLabelText("Schedule day"), "M")

    expect(screen.getByRole("cell", { name: "LAB 1" })).toBeInTheDocument()
    expect(screen.queryByRole("cell", { name: "3A" })).not.toBeInTheDocument()
    expect(screen.queryByRole("cell", { name: "4B" })).not.toBeInTheDocument()
  })

  it("restores the complete room board when filters are cleared", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await screen.findByRole("cell", { name: "LAB 1" })
    await user.type(screen.getByLabelText("Search rooms"), "lab")
    await user.click(screen.getByRole("button", { name: "Clear filters" }))

    expect(screen.getByRole("cell", { name: "LAB 1" })).toBeInTheDocument()
    expect(screen.getByRole("cell", { name: "3A" })).toBeInTheDocument()
    expect(screen.getByRole("cell", { name: "4B" })).toBeInTheDocument()
  })
})
