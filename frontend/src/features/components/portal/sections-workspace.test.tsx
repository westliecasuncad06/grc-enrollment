import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SectionsWorkspace } from "@/features/components/portal/sections-workspace"
import { renderWithSession } from "@/tests/render-app"

const terms = {
  data: [
    {
      type: "academic-term",
      id: 2,
      school_year: "2026-2027",
      semester: "1st",
      starts_at: null,
      ends_at: null,
      enrollment_opens_at: null,
      enrollment_closes_at: null,
      status: "active",
      status_label: "Active",
    },
  ],
}
const subjects = {
  data: [
    {
      type: "subject",
      id: 7,
      code: "CS101",
      title: "Programming 1",
      units: 3,
      status: "active",
      status_label: "Active",
    },
  ],
}
const sections = { data: [] }
const created = {
  data: {
    type: "section",
    id: 5,
    academic_term_id: 2,
    subject_id: 7,
    section_code: "A",
    professor_id: null,
    schedule_days: "MWF",
    starts_at_time: "08:00:00",
    ends_at_time: "09:00:00",
    room: "R101",
    capacity: 30,
    viability_threshold: 25,
    enrolled_count: 0,
    remaining_seats: 30,
    status: "planned",
    status_label: "Planned",
  },
}

function url(input: RequestInfo | URL) {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
}

describe("SectionsWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("validates schedule time and capacity before creating a planned section", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input, init) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url(input).endsWith("/academic-terms")
              ? terms
              : url(input).endsWith("/subjects")
                ? subjects
                : init?.method === "POST"
                  ? created
                  : sections,
          ),
          { status: init?.method === "POST" ? 201 : 200 },
        ),
      ),
    )
    renderWithSession(<SectionsWorkspace />, {
      session: {
        userId: "4",
        displayName: "Chair",
        role: "program_chair",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    await screen.findByRole("option", { name: /2026-2027/ })
    await user.selectOptions(screen.getByLabelText("Subject"), "7")
    await user.type(screen.getByLabelText("Section code"), "A")
    await user.clear(screen.getByLabelText("Capacity"))
    await user.type(screen.getByLabelText("Capacity"), "0")
    await user.click(screen.getByRole("button", { name: "Save section" }))
    expect(
      await screen.findByText("Capacity must be at least 1."),
    ).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "POST"),
    ).toBe(false)
  })

  it("creates a section for the selected academic term and refreshes the plan", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input, init) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url(input).endsWith("/academic-terms")
              ? terms
              : url(input).endsWith("/subjects")
                ? subjects
                : init?.method === "POST"
                  ? created
                  : sections,
          ),
          { status: init?.method === "POST" ? 201 : 200 },
        ),
      ),
    )
    renderWithSession(<SectionsWorkspace />, {
      session: {
        userId: "4",
        displayName: "Chair",
        role: "program_chair",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    await screen.findByRole("option", { name: /2026-2027/ })
    await user.selectOptions(screen.getByLabelText("Subject"), "7")
    await user.type(screen.getByLabelText("Section code"), "A")
    await user.clear(screen.getByLabelText("Capacity"))
    await user.type(screen.getByLabelText("Capacity"), "30")
    await user.click(screen.getByRole("button", { name: "Save section" }))
    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/sections"),
        expect.objectContaining({ method: "POST" }),
      ),
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(
      fetchMock.mock.calls.filter(([request]) =>
        url(request).endsWith("/sections"),
      ),
    ).toHaveLength(3)
  })
})
