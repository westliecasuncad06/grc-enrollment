import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { ItControlEnrollmentOverrideWorkspace } from "@/features/components/portal/it-control-enrollment-override-workspace"
import * as automationHooks from "@/features/hooks/use-it-control-automation"
import { renderWithSession } from "@/tests/render-app"

interface AutomationRunFixture {
  type: "it-control-automation-run"
  id: number
  step: "chair_generate_sections" | "dean_approve_all" | "cashier_confirm_all"
  academic_term_id: number
  status: "queued" | "running" | "succeeded" | "failed"
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

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

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

  it("does not let an off-term success unlock the current workflow", async () => {
    const currentTermFailure: AutomationRunFixture = {
      ...succeededRun,
      id: 44,
      step: "cashier_confirm_all",
      academic_term_id: 10,
      status: "failed",
      error_summary: "Current-term payment step failed.",
    }
    const offTermSuccess: AutomationRunFixture = {
      ...succeededRun,
      id: 42,
      academic_term_id: 9,
    }
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify(automationRuns([currentTermFailure, offTermSuccess])),
        ),
      ),
    )

    renderWorkspace()

    await screen.findByText("Current-term payment step failed.")
    expect(
      screen.getByRole("button", { name: /Dean approves all/i }),
    ).toBeDisabled()
  })

  it("does not poll an active run from an off term", async () => {
    const currentTermFailure: AutomationRunFixture = {
      ...succeededRun,
      id: 44,
      step: "cashier_confirm_all",
      academic_term_id: 10,
      status: "failed",
      error_summary: "Current-term payment step failed.",
    }
    const offTermActive: AutomationRunFixture = {
      ...queuedRun,
      id: 43,
      academic_term_id: 9,
      status: "running",
    }
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify(automationRuns([currentTermFailure, offTermActive])),
        ),
      ),
    )

    renderWorkspace()

    await screen.findByText("Current-term payment step failed.")
    expect(
      screen.getByRole("button", { name: /Generate all sections/i }),
    ).toBeEnabled()
    expect(
      fetchMock.mock.calls.some(([input]) =>
        requestUrl(input).endsWith("/automation-runs/43"),
      ),
    ).toBe(false)
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

  it("continues polling after the first active detail request fails", async () => {
    let detailRequests = 0
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)

      if (url.endsWith("/automation-runs/42")) {
        detailRequests += 1

        if (detailRequests <= 2) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: { message: "Temporary" } }), {
              status: 503,
            }),
          )
        }

        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                ...queuedRun,
                id: 42,
                status: "running",
                processed_count: 10,
              },
            }),
          ),
        )
      }

      return Promise.resolve(
        new Response(
          JSON.stringify(automationRuns([{ ...queuedRun, id: 42 }])),
        ),
      )
    })
    renderWorkspace()

    await waitFor(() => expect(detailRequests).toBe(2), { timeout: 3_000 })
    await waitFor(() => expect(detailRequests).toBeGreaterThan(2), {
      timeout: 5_000,
    })
    expect(await screen.findByText(/10 processed/)).toBeInTheDocument()
  })

  it("identifies the enrollment approval actor as Registrar Staff", async () => {
    renderWorkspace()

    expect(await screen.findByText("Registrar Staff")).toBeInTheDocument()
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

  it("retires a terminal detail run and refreshes history only once", async () => {
    const terminalRun: AutomationRunFixture = {
      ...succeededRun,
      id: 42,
      processed_count: 10,
    }
    const historyRequests = () =>
      fetchMock.mock.calls.filter(([input]) =>
        requestUrl(input).endsWith("/automation-runs"),
      )
    const detailRequests = () =>
      fetchMock.mock.calls.filter(([input]) =>
        requestUrl(input).endsWith("/automation-runs/42"),
      )

    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)

      if (url.endsWith("/automation-runs/42")) {
        return Promise.resolve(
          new Response(JSON.stringify({ data: terminalRun })),
        )
      }

      return Promise.resolve(
        new Response(
          JSON.stringify(
            automationRuns(
              historyRequests().length > 1
                ? [terminalRun]
                : [{ ...queuedRun, id: 42 }],
            ),
          ),
        ),
      )
    })
    renderWorkspace()

    await waitFor(() => expect(historyRequests()).toHaveLength(2))
    expect(detailRequests()).toHaveLength(1)
    expect(await screen.findByText(/10 processed/)).toBeInTheDocument()

    await new Promise((resolve) => window.setTimeout(resolve, 50))
    expect(historyRequests()).toHaveLength(2)
    expect(detailRequests()).toHaveLength(1)
  })

  it("retires a terminal run when the history refresh rejects while other runs keep polling", async () => {
    const terminalRun: AutomationRunFixture = {
      ...succeededRun,
      id: 42,
      processed_count: 10,
    }
    const otherRun: AutomationRunFixture = {
      ...queuedRun,
      id: 43,
      step: "dean_approve_all",
      status: "running",
      processed_count: 20,
    }
    const detailRequests = (runId: number) =>
      fetchMock.mock.calls.filter(([input]) =>
        requestUrl(input).endsWith(`/automation-runs/${runId}`),
      )
    const rejectedRefetch = vi.fn(() =>
      Promise.reject(new Error("History refresh unavailable")),
    )
    const useRunsQuery = automationHooks.useItControlAutomationRunsQuery

    function useRunsQueryWithRejectedRefetch(enabled = true) {
      const query = useRunsQuery(enabled)

      return { ...query, refetch: rejectedRefetch }
    }

    vi.spyOn(
      automationHooks,
      "useItControlAutomationRunsQuery",
    ).mockImplementation(useRunsQueryWithRejectedRefetch)
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)

      if (url.endsWith("/automation-runs/42")) {
        return Promise.resolve(
          new Response(JSON.stringify({ data: terminalRun })),
        )
      }
      if (url.endsWith("/automation-runs/43")) {
        return Promise.resolve(new Response(JSON.stringify({ data: otherRun })))
      }

      return Promise.resolve(
        new Response(
          JSON.stringify(automationRuns([{ ...queuedRun, id: 42 }, otherRun])),
        ),
      )
    })
    const { queryClient } = renderWorkspace()

    expect(await screen.findByText(/10 processed/)).toBeInTheDocument()
    await waitFor(() => expect(rejectedRefetch).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(
        queryClient
          .getQueryCache()
          .find({
            queryKey: automationHooks.itControlAutomationRunQueryKey(
              "it-1",
              42,
            ),
          })
          ?.getObserversCount(),
      ).toBe(0),
    )
    expect(
      queryClient
        .getQueryCache()
        .find({
          queryKey: automationHooks.itControlAutomationRunQueryKey("it-1", 43),
        })
        ?.getObserversCount(),
    ).toBe(1)

    await new Promise((resolve) => window.setTimeout(resolve, 2_100))
    expect(detailRequests(42)).toHaveLength(1)
    expect(detailRequests(43).length).toBeGreaterThan(1)
    expect(screen.getByText(/10 processed/)).toBeInTheDocument()
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
