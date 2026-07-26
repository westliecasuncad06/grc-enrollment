import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getJson } from "@/app/services/api-client"

describe("getJson", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("maps a valid API error envelope without leaking response details", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_FAILED",
            message: "The submitted data is invalid.",
            errors: {
              email: ["The email field is required."],
            },
            request_id: "request-001",
          },
        }),
        { status: 422 },
      ),
    )

    await expect(getJson("/api/v1/example")).rejects.toMatchObject({
      kind: "http",
      code: "VALIDATION_FAILED",
      message: "The submitted data is invalid.",
      requestId: "request-001",
      status: 422,
    })
  })

  it("rejects an error envelope with undeclared fields", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "NOT_FOUND",
            message: "The requested resource was not found.",
            errors: {},
            request_id: "request-002",
            debug: "must not be consumed",
          },
        }),
        { status: 404 },
      ),
    )

    await expect(getJson("/api/v1/missing")).rejects.toMatchObject({
      kind: "http",
      message: "The public API returned an unexpected error response.",
      status: 404,
    })
  })

  it("classifies a non-JSON response as a contract failure", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>unexpected</html>", { status: 200 }),
    )

    await expect(getJson("/api/v1/health")).rejects.toMatchObject({
      kind: "contract",
      message: "The public API returned a response that was not valid JSON.",
      status: 200,
    })
  })
})
