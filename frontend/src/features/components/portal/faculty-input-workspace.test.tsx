import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

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
      add_drop_deadline_at: null,
      grading_deadline_at: null,
      status: "semester_ongoing",
      status_label: "Semester Ongoing",
    },
  ],
} as const
const catalog = {
  data: [
    {
      curriculum_id: 11,
      program_id: 2,
      program_code: "BSIT",
      program_name: "Information Technology",
      curriculum_name: "2024–2029",
      effective_school_year: "2024-2029",
      version_label: "new",
      semesters: [
        {
          semester: "1st",
          subjects: [
            { id: 501, code: "LEAD 1", title: "Leadership Seminar 1", units: 1.5 },
            { id: 502, code: "IT 101", title: "Introduction to Computing", units: 3 },
          ],
        },
        { semester: "2nd", subjects: [] },
      ],
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
  type: "faculty_curriculum_subject_preference",
  id: 6,
  professor_id: 5,
  curriculum_id: 11,
  semester: "1st",
  subject_id: 501,
  rank: 1,
  origin: "workbook_seeded",
} as const

function requestUrl(input: RequestInfo | URL): string {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
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
function stubData(fetchMock: ReturnType<typeof vi.fn>) {
  fetchMock.mockImplementation((input, init) => {
    const url = requestUrl(input)
    if (url.endsWith("/academic-terms"))
      return Promise.resolve(new Response(JSON.stringify(terms)))
    if (url.endsWith("/faculty-preference-catalog"))
      return Promise.resolve(new Response(JSON.stringify(catalog)))
    if (
      url.endsWith("/faculty-availabilities") &&
      (!init?.method || init.method === "GET")
    )
      return Promise.resolve(
        new Response(JSON.stringify({ data: [availability] })),
      )
    if (url.endsWith("/faculty-subject-preferences"))
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    if (
      url.endsWith("/faculty-curriculum-subject-preferences") &&
      (!init?.method || init.method === "GET")
    )
      return Promise.resolve(
        new Response(JSON.stringify({ data: [preference] })),
      )
    if (url.endsWith("/faculty-teaching-history"))
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
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
}

describe("FacultyInputWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("shows a curriculum and semester-filtered saved preference table", async () => {
    stubData(fetchMock)
    renderWorkspace()
    expect(
      await screen.findByText("LEAD 1 — Leadership Seminar 1"),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole("combobox", { name: /curriculum/i }),
    ).toBeEnabled()
    expect(
      screen.queryByText(/Faculty input could not be loaded/i),
    ).not.toBeInTheDocument()
    expect(screen.getByText("Seeded")).toBeInTheDocument()
    expect(
      screen.getByText("No workbook teaching history is available yet."),
    ).toBeInTheDocument()
  })

  it("uses the searchable curriculum subject picker and maps validation to rank", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input, init) => {
      const url = requestUrl(input)
      if (url.endsWith("/academic-terms"))
        return Promise.resolve(new Response(JSON.stringify(terms)))
      if (url.endsWith("/faculty-preference-catalog"))
        return Promise.resolve(new Response(JSON.stringify(catalog)))
      if (url.endsWith("/faculty-availabilities"))
        return Promise.resolve(new Response(JSON.stringify({ data: [] })))
      if (
        url.endsWith("/faculty-curriculum-subject-preferences") &&
        init?.method === "POST"
      )
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "VALIDATION_FAILED",
                message: "Invalid",
                errors: {
                  rank: [
                    "This rank is already in use for this curriculum semester.",
                  ],
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
    const subjectPicker = await screen.findByLabelText("Preferred subject")
    await user.click(subjectPicker)
    await user.click(await screen.findByText("LEAD 1 — Leadership Seminar 1"))
    await user.click(
      screen.getByRole("button", { name: "Save subject preference" }),
    )
    expect(
      await screen.findByText(
        "This rank is already in use for this curriculum semester.",
      ),
    ).toBeInTheDocument()
  })

  it("edits and confirms removal of an availability before deleting it", async () => {
    const user = userEvent.setup()
    stubData(fetchMock)
    renderWorkspace()
    await screen.findByRole("button", { name: "Edit availability" })
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

  it("has no detectable accessibility violations once loaded", async () => {
    stubData(fetchMock)
    const { container } = renderWorkspace()
    await screen.findByText("LEAD 1 — Leadership Seminar 1")
    expect(await axe(container)).toHaveNoViolations()
  })
})
