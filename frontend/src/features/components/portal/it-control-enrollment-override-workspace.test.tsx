import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { ItControlEnrollmentOverrideWorkspace } from "@/features/components/portal/it-control-enrollment-override-workspace"
import { renderWithSession } from "@/tests/render-app"

const succeededRun = {
  type: "it-control-automation-run",
  id: 41,
  step: "chair_generate_sections",
  academic_term_id: 9,
  status: "succeeded",
  processed_count: 3210,
  failed_count: 0,
  warnings: [],
  error_summary: null,
  started_at: "2026-08-12T08:00:00+00:00",
  completed_at: "2026-08-12T08:01:00+00:00",
  created_at: "2026-08-12T08:00:00+00:00",
} as const

const queuedRun = { ...succeededRun, status: "queued", processed_count: 0 }

function renderWorkspace(role: "it_admin" | "registrar_head" = "it_admin") {
  return renderWithSession(<ItControlEnrollmentOverrideWorkspace />, {
    session: {
      userId: "it-1",
      displayName: "IT Control",
      role,
      signedInAt: "2026-08-12T00:00:00Z",
    },
  })
}

describe("ItControlEnrollmentOverrideWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockImplementation((input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url

      if (init?.method === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify({ data: queuedRun })),
        )
      }

      if (url.endsWith("/automation-runs/41")) {
        return Promise.resolve(
          new Response(JSON.stringify({ data: succeededRun })),
        )
      }

      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it("runs a step and reports progress until it completes", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(
      await screen.findByRole("button", { name: /Generate all sections/i }),
    )
    await user.click(screen.getByRole("button", { name: /Run step/i }))

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/it-control/automation-runs"),
      expect.objectContaining({ method: "POST" }),
    )
    expect(await screen.findByText(/3,210 processed/)).toBeInTheDocument()
  })

  it("disables later steps until the prerequisite step has succeeded", async () => {
    renderWorkspace()

    expect(
      await screen.findByRole("button", { name: /Dean approves all/i }),
    ).toBeDisabled()
  })

  it("renders the role guard without fetching automation runs for an unauthorized role", () => {
    renderWorkspace("registrar_head")

    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("has no detectable accessibility violations", async () => {
    const { container } = renderWorkspace()

    await screen.findByRole("button", { name: /Generate all sections/i })
    expect(await axe(container)).toHaveNoViolations()
  })
})
