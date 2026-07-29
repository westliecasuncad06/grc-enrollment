import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { FacultyInputWorkspace } from "@/features/components/portal/faculty-input-workspace"
import { renderWithSession } from "@/tests/render-app"

const terms = {
  data: [
    {
      type: "academic-term",
      id: 1,
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
} as const
const subjects = {
  data: [
    {
      type: "subject",
      id: 101,
      code: "CS101",
      title: "Programming 1",
      units: 3,
      status: "active",
      status_label: "Active",
    },
  ],
} as const
const availability = {
  type: "faculty_availability",
  id: 4,
  professor_id: 5,
  academic_term_id: 1,
  day_of_week: 1,
  starts_at_time: "08:00:00",
  ends_at_time: "10:00:00",
} as const
const preference = {
  type: "faculty_subject_preference",
  id: 6,
  professor_id: 5,
  academic_term_id: 1,
  subject_id: 101,
  rank: 1,
} as const

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

function renderWorkspace() {
  return renderWithSession(<FacultyInputWorkspace />, {
    session: {
      userId: "5",
      displayName: "Faculty",
      role: "faculty",
      signedInAt: "2026-07-29T12:00:00Z",
    },
  })
}

describe("FacultyInputWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("renders an accessible empty state before faculty input exists", async () => {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.endsWith("/academic-terms"))
        return Promise.resolve(new Response(JSON.stringify(terms)))
      if (url.endsWith("/subjects"))
        return Promise.resolve(new Response(JSON.stringify(subjects)))
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })
    renderWorkspace()
    expect(
      await screen.findByText("No availability windows yet."),
    ).toBeInTheDocument()
    expect(screen.getByText("No subject preferences yet.")).toBeInTheDocument()
  })

  it("maps a rank conflict 422 to the preference field", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.endsWith("/academic-terms"))
        return Promise.resolve(new Response(JSON.stringify(terms)))
      if (url.endsWith("/subjects"))
        return Promise.resolve(new Response(JSON.stringify(subjects)))
      if (url.endsWith("/faculty-subject-preferences"))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "VALIDATION_FAILED",
                message: "Invalid",
                errors: {
                  rank: ["This rank is already in use for this term."],
                },
                request_id: "request-5",
              },
            }),
            { status: 422 },
          ),
        )
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })
    renderWorkspace()
    await screen.findByRole("option", { name: "CS101 — Programming 1" })
    await user.selectOptions(screen.getByLabelText("Preferred subject"), "101")
    await user.clear(screen.getByLabelText("Preference rank"))
    await user.type(screen.getByLabelText("Preference rank"), "1")
    await user.click(
      screen.getByRole("button", { name: "Save subject preference" }),
    )
    expect(
      await screen.findByText("This rank is already in use for this term."),
    ).toBeInTheDocument()
  })

  it("edits and confirms removal of an availability before deleting it", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input, init) => {
      const url = requestUrl(input)
      if (url.endsWith("/academic-terms"))
        return Promise.resolve(new Response(JSON.stringify(terms)))
      if (url.endsWith("/subjects"))
        return Promise.resolve(new Response(JSON.stringify(subjects)))
      if (url.endsWith("/faculty-availabilities") && init?.method !== "POST")
        return Promise.resolve(
          new Response(JSON.stringify({ data: [availability] })),
        )
      if (url.endsWith("/faculty-subject-preferences"))
        return Promise.resolve(
          new Response(JSON.stringify({ data: [preference] })),
        )
      if (init?.method === "PATCH")
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: { ...availability, starts_at_time: "09:00:00" },
            }),
          ),
        )
      return Promise.resolve(new Response(null, { status: 204 }))
    })
    renderWorkspace()
    await screen.findByText("Monday · 08:00–10:00")
    await user.click(screen.getByRole("button", { name: "Edit availability" }))
    await user.clear(screen.getByLabelText("Start time"))
    await user.type(screen.getByLabelText("Start time"), "09:00:00")
    await user.click(
      screen.getByRole("button", { name: "Update availability" }),
    )
    await user.click(
      screen.getByRole("button", { name: "Remove availability" }),
    )
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Remove availability",
    )
    await user.click(screen.getByRole("button", { name: "Confirm removal" }))
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/faculty-availabilities/4"),
      expect.objectContaining({ method: "DELETE" }),
    )
  })
})
