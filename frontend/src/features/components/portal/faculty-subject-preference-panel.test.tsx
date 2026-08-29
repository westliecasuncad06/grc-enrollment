import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { FacultyInputWorkspace } from "@/features/components/portal/faculty-input-workspace"
import { renderWithSession } from "@/tests/render-app"

const session = {
  userId: "5",
  displayName: "Faculty",
  role: "faculty" as const,
  signedInAt: "2026-07-29T12:00:00Z",
}

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
            {
              id: 501,
              code: "LEAD 1",
              title: "Leadership Seminar 1",
              units: 1.5,
            },
          ],
        },
        { semester: "2nd", subjects: [] },
      ],
    },
  ],
} as const

const specialization = {
  type: "faculty-specialization",
  id: 9,
  professor_id: 5,
  subject_id: 501,
  proficiency: "primary",
  proficiency_label: "Primary",
  source: "declared",
  notes: null,
  status: "approved",
  status_label: "Approved",
  decided_at: null,
  decision_reason: null,
} as const

function url(input: RequestInfo | URL): string {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
}

describe("FacultySubjectPreferencePanel", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("shows the subject picker, optional rank, and specialization proficiency", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input) => {
      const requestUrl = url(input)
      if (requestUrl.endsWith("/faculty-preference-catalog"))
        return Promise.resolve(new Response(JSON.stringify(catalog)))
      if (requestUrl.endsWith("/faculty-specializations"))
        return Promise.resolve(
          new Response(JSON.stringify({ data: [specialization] })),
        )
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })
    renderWithSession(<FacultyInputWorkspace />, { session })

    await user.click(
      await screen.findByRole("tab", { name: "Subject preferences" }),
    )

    expect(await screen.findByLabelText("Preferred subject")).toBeEnabled()
    expect(screen.getByLabelText("Preference rank")).not.toBeRequired()
    expect(
      screen.getByRole("combobox", { name: "Proficiency" }),
    ).toBeInTheDocument()
    expect(
      within(
        screen.getByRole("table", { name: "Declared specializations" }),
      ).getByText("Primary"),
    ).toBeInTheDocument()
  })

  it("appends a preference without a rank and records its specialization", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input, init) => {
      const requestUrl = url(input)

      if (requestUrl.endsWith("/faculty-preference-catalog"))
        return Promise.resolve(new Response(JSON.stringify(catalog)))
      if (
        requestUrl.endsWith("/faculty-curriculum-subject-preferences") &&
        init?.method === "POST"
      )
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                type: "faculty_curriculum_subject_preference",
                id: 6,
                professor_id: 5,
                curriculum_id: 11,
                semester: "1st",
                subject_id: 501,
                rank: 4,
                origin: "declared",
              },
            }),
          ),
        )
      if (
        requestUrl.endsWith("/faculty-specializations") &&
        init?.method === "POST"
      )
        return Promise.resolve(
          new Response(JSON.stringify({ data: specialization })),
        )

      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })
    renderWithSession(<FacultyInputWorkspace />, { session })
    await user.click(
      await screen.findByRole("tab", { name: "Subject preferences" }),
    )
    await user.click(await screen.findByLabelText("Preferred subject"))
    await user.click(await screen.findByText("LEAD 1 — Leadership Seminar 1"))
    await user.click(
      screen.getByRole("button", { name: "Save subject preference" }),
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(
          "/api/v1/faculty-curriculum-subject-preferences",
        ),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            curriculum_id: 11,
            semester: "1st",
            subject_id: 501,
          }),
        }),
      )
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/faculty-specializations"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ subject_id: 501, proficiency: "secondary" }),
        }),
      )
    })
  })

  it("keeps the preference saved and shows a distinct message when only the specialization write fails", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input, init) => {
      const requestUrl = url(input)

      if (requestUrl.endsWith("/faculty-preference-catalog"))
        return Promise.resolve(new Response(JSON.stringify(catalog)))
      if (
        requestUrl.endsWith("/faculty-curriculum-subject-preferences") &&
        init?.method === "POST"
      )
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                type: "faculty_curriculum_subject_preference",
                id: 6,
                professor_id: 5,
                curriculum_id: 11,
                semester: "1st",
                subject_id: 501,
                rank: 4,
                origin: "declared",
              },
            }),
          ),
        )
      if (
        requestUrl.endsWith("/faculty-specializations") &&
        init?.method === "POST"
      )
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "VALIDATION_FAILED",
                message: "Invalid",
                errors: {
                  subject_id: ["This subject is outside your college."],
                },
                request_id: "request-9",
              },
            }),
            { status: 422 },
          ),
        )

      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })
    renderWithSession(<FacultyInputWorkspace />, { session })
    await user.click(
      await screen.findByRole("tab", { name: "Subject preferences" }),
    )
    await user.click(await screen.findByLabelText("Preferred subject"))
    await user.click(await screen.findByText("LEAD 1 — Leadership Seminar 1"))
    await user.click(
      screen.getByRole("button", { name: "Save subject preference" }),
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/faculty-specializations"),
        expect.objectContaining({ method: "POST" }),
      )
    })

    // The preference write succeeded, so its success path always runs: the
    // form resets (the subject picker clears) regardless of the
    // specialization write's outcome.
    expect(screen.getByLabelText("Preferred subject")).toHaveValue("")
    expect(
      await screen.findByText(
        "Preference saved, but the proficiency could not be recorded. Try setting it again.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(
        "Subject preference could not be saved. Check the connection and try again.",
      ),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("This subject is outside your college."),
    ).not.toBeInTheDocument()
  })

  it("maps a 422 validation error to a FieldError on the form, not a generic banner", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input, init) => {
      const requestUrl = url(input)
      if (requestUrl.endsWith("/faculty-preference-catalog"))
        return Promise.resolve(new Response(JSON.stringify(catalog)))
      if (
        requestUrl.endsWith("/faculty-curriculum-subject-preferences") &&
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
    renderWithSession(<FacultyInputWorkspace />, { session })

    await user.click(
      await screen.findByRole("tab", { name: "Subject preferences" }),
    )
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
    expect(
      screen.queryByText(
        "Subject preference could not be saved. Check the connection and try again.",
      ),
    ).not.toBeInTheDocument()
  })
})
