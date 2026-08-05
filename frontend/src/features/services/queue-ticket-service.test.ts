import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  listQueueTickets,
  updateQueueTicket,
} from "@/features/services/queue-ticket-service"

const paginationLinks = {
  first: "https://api.test/queue-tickets?page=1",
  last: "https://api.test/queue-tickets?page=1",
  prev: null,
  next: null,
}
const paginationMeta = {
  current_page: 1,
  last_page: 1,
  per_page: 20,
  total: 1,
}

const ticket = {
  type: "queue_ticket",
  id: 1,
  enrollment_id: 9,
  student_number: "2026-0001",
  ticket_number: "Q000009",
  queue_date: "2026-07-30",
  status: "waiting",
  status_label: "Waiting",
  priority: "regular",
  priority_label: "Regular",
  created_at: "2026-07-30T00:00:00Z",
  served_at: null,
  requeued_at: null,
} as const

describe("queue-ticket-service", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("lists queue tickets with filters and pagination", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [ticket],
          links: paginationLinks,
          meta: paginationMeta,
        }),
      ),
    )

    const result = await listQueueTickets({ page: 1, per_page: 20 })

    expect(result.data).toEqual([ticket])
    expect(fetchMock.mock.calls[0]?.[0]).toContain("page=1&per_page=20")
  })

  it("transitions a ticket to serving", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { ...ticket, status: "serving" } })),
    )

    const result = await updateQueueTicket(1, { action: "serve" })

    expect(result.status).toBe("serving")
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/queue-tickets/1")
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("PATCH")
  })
})
