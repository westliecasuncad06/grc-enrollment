import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  getAuthenticatedJson,
  postAuthenticatedJson,
  postJson,
  setAuthTokenProvider,
  setUnauthorizedHandler,
} from "@/app/services/api-client"

describe("authenticated api-client requests", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    setAuthTokenProvider(() => null)
    setUnauthorizedHandler(() => undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("postJson sends a JSON body without a bearer header", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }),
    )

    await postJson("/api/v1/auth/login", { email: "a@b.test", password: "x" })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe("POST")
    expect(init.body).toBe(JSON.stringify({ email: "a@b.test", password: "x" }))
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBeUndefined()
  })

  it("getAuthenticatedJson attaches the bearer token from the registered provider", async () => {
    setAuthTokenProvider(() => "1|the-token")
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }),
    )

    await getAuthenticatedJson("/api/v1/auth/me")

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer 1|the-token",
    )
  })

  it("sends no Authorization header when no token is available", async () => {
    setAuthTokenProvider(() => null)
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }),
    )

    await getAuthenticatedJson("/api/v1/auth/me")

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBeUndefined()
  })

  it("invokes the unauthorized handler on a 401 to an authenticated call", async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    setAuthTokenProvider(() => "1|expired-token")
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication is required.",
            errors: {},
            request_id: "req-1",
          },
        }),
        { status: 401 },
      ),
    )

    await expect(getAuthenticatedJson("/api/v1/auth/me")).rejects.toMatchObject(
      { status: 401 },
    )

    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it("does not invoke the unauthorized handler for an unauthenticated 401 (e.g. login)", async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "UNAUTHENTICATED",
            message: "The provided credentials are incorrect.",
            errors: {},
            request_id: "req-2",
          },
        }),
        { status: 401 },
      ),
    )

    await expect(
      postJson("/api/v1/auth/login", { email: "a@b.test", password: "wrong" }),
    ).rejects.toMatchObject({ status: 401 })

    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it("postAuthenticatedJson resolves to null on a 204 No Content response", async () => {
    setAuthTokenProvider(() => "1|the-token")
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(
      postAuthenticatedJson("/api/v1/auth/logout"),
    ).resolves.toBeNull()
  })
})
