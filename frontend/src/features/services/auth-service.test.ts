import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  AUTH_LOGIN_PATH,
  fetchCurrentUser,
  login,
  logout,
} from "@/features/services/auth-service"
import { setAuthTokenProvider } from "@/features/services/api-client"

const validUser = {
  type: "user" as const,
  id: 7,
  name: "Seed Registrar Head",
  email: "registrar-head.seed@grc.test",
  role: "registrar_head",
  role_label: "Registrar Head",
  status: "active",
}

const validAuthEnvelope = {
  data: {
    type: "auth-session" as const,
    token: "1|plaintext-token-value",
    token_type: "Bearer" as const,
    expires_at: "2026-07-27T18:46:36Z",
    user: validUser,
  },
}

describe("auth-service", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    setAuthTokenProvider(() => "1|plaintext-token-value")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("login parses the exact auth envelope and requests the documented path", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(validAuthEnvelope), { status: 200 }),
    )

    await expect(
      login({ email: "registrar-head.seed@grc.test", password: "secret" }),
    ).resolves.toEqual({
      token: "1|plaintext-token-value",
      expiresAt: "2026-07-27T18:46:36Z",
      user: validUser,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      `http://127.0.0.1:8000${AUTH_LOGIN_PATH}`,
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("login rejects an envelope with an undeclared field", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { ...validAuthEnvelope.data, unexpected: "leak" },
        }),
        { status: 200 },
      ),
    )

    await expect(
      login({ email: "registrar-head.seed@grc.test", password: "secret" }),
    ).rejects.toMatchObject({ kind: "contract" })
  })

  it("fetchCurrentUser parses the exact user envelope", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: validUser }), { status: 200 }),
    )

    await expect(fetchCurrentUser()).resolves.toEqual(validUser)
  })

  it("fetchCurrentUser rejects a response missing a required field", async () => {
    const { role_label: _roleLabel, ...incomplete } = validUser
    void _roleLabel

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: incomplete }), { status: 200 }),
    )

    await expect(fetchCurrentUser()).rejects.toMatchObject({
      kind: "contract",
    })
  })

  it("logout completes without throwing on a 204 response", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(logout()).resolves.toBeUndefined()
  })
})
