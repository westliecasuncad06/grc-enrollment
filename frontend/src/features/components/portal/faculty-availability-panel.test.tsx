import { screen } from "@testing-library/react"
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

const availability = {
  type: "faculty_availability",
  id: 4,
  professor_id: 5,
  day_of_week: 1,
  starts_at_time: "08:00:00",
  ends_at_time: "10:00:00",
} as const

function url(input: RequestInfo | URL): string {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
}

describe("FacultyAvailabilityPanel", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("renders recurring Monday through Saturday availability from the faculty API", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input, init) => {
      const requestUrl = url(input)
      if (
        requestUrl.endsWith("/faculty-availabilities") &&
        (!init?.method || init.method === "GET")
      )
        return Promise.resolve(
          new Response(JSON.stringify({ data: [availability] })),
        )
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })
    renderWithSession(<FacultyInputWorkspace />, { session })

    expect(
      await screen.findByRole("tab", { name: "Availability window" }),
    ).toHaveAttribute("data-state", "active")
    expect(
      await screen.findByRole("table", { name: /availability windows/i }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("combobox", { name: "Day" }))
    expect(
      screen.queryByRole("option", { name: "Sunday" }),
    ).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/faculty-availabilities"),
      expect.objectContaining({ method: "GET" }),
    )
  })
})
