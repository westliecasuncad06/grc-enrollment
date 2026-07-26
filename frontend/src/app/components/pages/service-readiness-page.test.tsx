import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ServiceReadinessPage } from "@/app/components/pages/service-readiness-page"

const validHealthEnvelope = {
  data: {
    type: "service-health",
    service: "grc-enrollment-api",
    status: "ok",
    api_version: "v1",
    generated_at: "2026-07-26T08:45:00Z",
  },
} as const

function createHealthResponse(): Response {
  return new Response(JSON.stringify(validHealthEnvelope), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

function renderReadinessPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <ServiceReadinessPage />
      </QueryClientProvider>,
    ),
  }
}

describe("ServiceReadinessPage", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("announces the loading state while the public API check is pending", () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined))

    renderReadinessPage()

    expect(
      screen.getByText("Contacting the public gateway…"),
    ).toBeInTheDocument()
    expect(screen.getByText("Checking")).toBeInTheDocument()
  })

  it("renders the validated API result without claiming ML readiness", async () => {
    fetchMock.mockResolvedValue(createHealthResponse())

    renderReadinessPage()

    expect(await screen.findByText("API online")).toBeInTheDocument()
    expect(screen.getByText("grc-enrollment-api")).toBeInTheDocument()
    expect(screen.getByText("Public gateway responding")).toBeInTheDocument()
    expect(screen.getByText("Server only")).toBeInTheDocument()
    expect(screen.getByText("No browser request is made")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("shows a connection error and recovers through an explicit retry", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(createHealthResponse())

    const { user } = renderReadinessPage()

    expect(
      await screen.findByText("Connection interrupted"),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Retry API check" }))

    expect(await screen.findByText("API online")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
