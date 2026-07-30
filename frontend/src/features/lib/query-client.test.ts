import { describe, expect, it } from "vitest"

import { createAppQueryClient } from "@/features/lib/query-client"
import { ApiClientError } from "@/features/services/api-client"

function getRetry(): (failureCount: number, error: unknown) => boolean {
  const client = createAppQueryClient()
  const retry = client.getDefaultOptions().queries?.retry

  if (typeof retry !== "function") {
    throw new Error("expected the retry option to be a function")
  }

  return retry as (failureCount: number, error: unknown) => boolean
}

describe("createAppQueryClient retry", () => {
  it("does not retry a 403", () => {
    expect(
      getRetry()(
        0,
        new ApiClientError({ kind: "http", message: "no", status: 403 }),
      ),
    ).toBe(false)
  })

  it("does not retry a 404", () => {
    expect(
      getRetry()(
        0,
        new ApiClientError({ kind: "http", message: "no", status: 404 }),
      ),
    ).toBe(false)
  })

  it("does not retry a 409", () => {
    expect(
      getRetry()(
        0,
        new ApiClientError({ kind: "http", message: "no", status: 409 }),
      ),
    ).toBe(false)
  })

  it("does not retry a 429", () => {
    expect(
      getRetry()(
        0,
        new ApiClientError({ kind: "http", message: "no", status: 429 }),
      ),
    ).toBe(false)
  })

  it("does not retry a 422", () => {
    expect(
      getRetry()(
        0,
        new ApiClientError({ kind: "http", message: "no", status: 422 }),
      ),
    ).toBe(false)
  })

  it("retries a 500 once", () => {
    expect(
      getRetry()(
        0,
        new ApiClientError({ kind: "http", message: "no", status: 500 }),
      ),
    ).toBe(true)
  })

  it("retries a connection failure once", () => {
    expect(
      getRetry()(
        0,
        new ApiClientError({ kind: "connection", message: "offline" }),
      ),
    ).toBe(true)
  })

  it("never retries past the first failure regardless of error type", () => {
    expect(
      getRetry()(
        1,
        new ApiClientError({ kind: "connection", message: "offline" }),
      ),
    ).toBe(false)
  })

  it("retries a non-ApiClientError once, as a safe default", () => {
    expect(getRetry()(0, new Error("unexpected"))).toBe(true)
  })
})
