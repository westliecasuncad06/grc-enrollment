import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getRoomOptions } from "@/features/services/room-catalog-service"

describe("room-catalog-service", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("reads the college-filtered room options from the v1 API", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      data: [
        { type: "room_option", id: 7, name: "LAB 1" },
        { type: "room_option", id: 8, name: "3A" },
      ],
    })))

    await expect(getRoomOptions()).resolves.toEqual([
      { type: "room_option", id: 7, name: "LAB 1" },
      { type: "room_option", id: 8, name: "3A" },
    ])
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/room-options",
      expect.objectContaining({ method: "GET" }),
    )
  })
})
