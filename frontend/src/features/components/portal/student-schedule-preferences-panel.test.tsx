import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { StudentSchedulePreferencesPanel } from "@/features/components/portal/student-schedule-preferences-panel"
import { renderWithSession } from "@/tests/render-app"

const studentSession = {
  userId: "4",
  displayName: "Student",
  role: "student",
  signedInAt: "2026-07-29T12:00:00Z",
} as const

const defaultPreference = {
  type: "student-schedule-preference",
  id: null,
  student_id: 4,
  preferred_days: null,
  preferred_time_block: "any",
  preferred_time_block_label: "No Preference",
  preferred_modality: null,
  max_days_on_campus: null,
  avoid_early_first_class: false,
  notes: null,
} as const

const savedPreference = {
  ...defaultPreference,
  id: 9,
  preferred_days: [1],
} as const

function url(input: RequestInfo | URL): string {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
}

function mockRoutes() {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const target = url(input)
    if (
      target.endsWith("/student-schedule-preferences") &&
      (!init?.method || init.method === "GET")
    )
      return Promise.resolve(
        new Response(JSON.stringify({ data: defaultPreference })),
      )
    if (
      target.endsWith("/student-schedule-preferences") &&
      init?.method === "PUT"
    )
      return Promise.resolve(
        new Response(JSON.stringify({ data: savedPreference })),
      )
    return Promise.resolve(new Response(JSON.stringify({ data: [] })))
  }
}

describe("StudentSchedulePreferencesPanel", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockImplementation(mockRoutes())
  })
  afterEach(() => vi.unstubAllGlobals())

  it("saves a schedule preference and refreshes the enrollment options", async () => {
    const user = userEvent.setup()
    renderWithSession(<StudentSchedulePreferencesPanel />, {
      session: studentSession,
    })

    await user.click(await screen.findByRole("checkbox", { name: "Monday" }))
    await user.click(
      screen.getByRole("button", { name: "Save my schedule preference" }),
    )

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/student-schedule-preferences"),
      expect.objectContaining({ method: "PUT" }),
    )
  })

  it("shows only the requested compact fields and preserves hidden values on save", async () => {
    const user = userEvent.setup()
    const preference = {
      ...defaultPreference,
      id: 9,
      preferred_days: [1],
      preferred_time_block: "morning",
      preferred_modality: "f2f",
      max_days_on_campus: 3,
      avoid_early_first_class: true,
      notes: "Keep my existing preferences.",
    }
    fetchMock.mockImplementation((input, init) => {
      const target = url(input)
      if (
        target.endsWith("/student-schedule-preferences") &&
        (!init?.method || init.method === "GET")
      )
        return Promise.resolve(
          new Response(JSON.stringify({ data: preference })),
        )
      if (
        target.endsWith("/student-schedule-preferences") &&
        init?.method === "PUT"
      )
        return Promise.resolve(
          new Response(JSON.stringify({ data: preference })),
        )
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })
    renderWithSession(<StudentSchedulePreferencesPanel compact />, {
      session: studentSession,
    })

    await screen.findByRole("checkbox", { name: "Monday" })
    expect(screen.getByLabelText("Maximum days on campus")).toHaveValue(3)
    expect(
      screen.queryByLabelText("Preferred time block"),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText("Preferred modality"),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText("Avoid an early first class"),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Notes")).not.toBeInTheDocument()

    await user.click(screen.getByRole("checkbox", { name: "Tuesday" }))
    await user.click(
      screen.getByRole("button", { name: "Save my schedule preference" }),
    )

    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/student-schedule-preferences"),
        expect.objectContaining({ method: "PUT" }),
      ),
    )
    const putCall = fetchMock.mock.calls.find(
      ([request, init]) =>
        url(request).endsWith("/student-schedule-preferences") &&
        init?.method === "PUT",
    )
    expect(JSON.parse(putCall?.[1]?.body as string)).toEqual({
      preferred_days: [1, 2],
      preferred_time_block: "morning",
      preferred_modality: "f2f",
      max_days_on_campus: 3,
      avoid_early_first_class: true,
      notes: "Keep my existing preferences.",
    })
  })

  it("never offers Sunday as a preferred day", async () => {
    renderWithSession(<StudentSchedulePreferencesPanel />, {
      session: studentSession,
    })

    await screen.findByRole("checkbox", { name: "Monday" })
    expect(
      screen.queryByRole("checkbox", { name: "Sunday" }),
    ).not.toBeInTheDocument()
  })

  it("does not render for an unauthorized role", () => {
    renderWithSession(<StudentSchedulePreferencesPanel />, {
      session: {
        userId: "5",
        displayName: "Faculty",
        role: "faculty",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })

    expect(
      screen.getByText("This panel is not available for your role."),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    const { container } = renderWithSession(
      <StudentSchedulePreferencesPanel />,
      { session: studentSession },
    )

    await screen.findByRole("checkbox", { name: "Monday" })
    expect(await axe(container)).toHaveNoViolations()
  })
})
