import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { ItControlEnrollmentOverrideWorkspace } from "@/features/components/portal/it-control-enrollment-override-workspace"
import { renderWithSession } from "@/tests/render-app"

interface AutomationRunFixture {
  type: "it-control-automation-run"
  id: number
  step: "chair_generate_sections" | "dean_approve_all"
  academic_term_id: number
  status: "queued" | "running" | "succeeded"
  processed_count: number
  failed_count: number
  warnings: string[]
  error_summary: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string | null
}

const succeededRun: AutomationRunFixture = {
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
}

const queuedRun: AutomationRunFixture = {
  ...succeededRun,
  status: "queued",
  processed_count: 0,
}

function automationRuns(runs: readonly AutomationRunFixture[]) {
  return {
    data: runs,
    links: {
      first: "https://api.test/it-control/automation-runs?page=1",
      last: "https://api.test/it-control/automation-runs?page=1",
      prev: null,
      next: null,
    },
    meta: {
      current_page: 1,
      from: runs.length === 0 ? null : 1,
      last_page: 1,
      links: [],
      path: "https://api.test/it-control/automation-runs",
      per_page: 25,
      to: runs.length === 0 ? null : runs.length,
      total: runs.length,
    },
  }
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

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
      const url = requestUrl(input)

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

      return Promise.resolve(new Response(JSON.stringify(automationRuns([]))))
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

  it("keeps the newest completed run when history includes duplicates", async () => {
    fetchMock.mockImplementation(() => {
      return Promise.resolve(
        new Response(
          JSON.stringify(
            automationRuns([
              { ...succeededRun, id: 41, processed_count: 777 },
              { ...succeededRun, id: 40, processed_count: 123 },
            ]),
          ),
        ),
      )
    })
    renderWorkspace()

    expect(await screen.findByText(/777 processed/)).toBeInTheDocument()
  })

  it("resumes polling from a queued run returned after reload", async () => {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)

      if (url.endsWith("/automation-runs/42")) {
        return Promise.resolve(
          new Response(JSON.stringify({ data: { ...queuedRun, id: 42 } })),
        )
      }

      return Promise.resolve(
        new Response(
          JSON.stringify(automationRuns([{ ...queuedRun, id: 42 }])),
        ),
      )
    })
    renderWorkspace()

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/automation-runs/42"),
        expect.anything(),
      ),
    )
  })

  it("polls every active step returned after reload", async () => {
    const deanRun: AutomationRunFixture = {
      ...queuedRun,
      id: 43,
      step: "dean_approve_all",
      status: "running",
      processed_count: 20,
    }
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)

      if (url.endsWith("/automation-runs/42")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: { ...queuedRun, id: 42, processed_count: 10 },
            }),
          ),
        )
      }
      if (url.endsWith("/automation-runs/43")) {
        return Promise.resolve(new Response(JSON.stringify({ data: deanRun })))
      }

      return Promise.resolve(
        new Response(
          JSON.stringify(automationRuns([{ ...queuedRun, id: 42 }, deanRun])),
        ),
      )
    })
    renderWorkspace()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/automation-runs/42"),
        expect.anything(),
      )
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/automation-runs/43"),
        expect.anything(),
      )
    })
    expect(await screen.findByText(/10 processed/)).toBeInTheDocument()
    expect(await screen.findByText(/20 processed/)).toBeInTheDocument()
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
