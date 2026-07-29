import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getAuditLogs } from "@/features/services/audit-service"

describe("getAuditLogs", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("serializes every published audit filter and parses a paginated result", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [],
          links: {
            first: "https://api.test/audit-logs?page=1",
            last: "https://api.test/audit-logs?page=1",
            prev: null,
            next: null,
          },
          meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 },
        }),
      ),
    )

    await expect(
      getAuditLogs({
        action: "section.updated",
        auditable_type: "section",
        actor_user_id: 7,
        from: "2026-07-01",
        to: "2026-07-31",
        page: 2,
        per_page: 20,
      }),
    ).resolves.toMatchObject({ meta: { current_page: 1, per_page: 20 } })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        "action=section.updated&auditable_type=section&actor_user_id=7&from=2026-07-01&to=2026-07-31&page=2&per_page=20",
      ),
      expect.anything(),
    )
  })
})
