import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { listEnrollmentDocuments } from "@/features/services/enrollment-document-service"

const paginationLinks = {
  first: "https://api.test/enrollment-documents?page=1",
  last: "https://api.test/enrollment-documents?page=1",
  prev: null,
  next: null,
}
const paginationMeta = {
  current_page: 1,
  last_page: 1,
  per_page: 20,
  total: 1,
}

const document = {
  type: "enrollment_document",
  id: 1,
  enrollment_id: 9,
  student_number: "2026-0001",
  document_type: "com",
  document_type_label: "Certificate of Matriculation",
  document_number: "COM000009",
  generated_at: "2026-07-30T00:00:00Z",
} as const

describe("enrollment-document-service", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("lists enrollment documents with filters and pagination", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [document],
          links: paginationLinks,
          meta: paginationMeta,
        }),
      ),
    )

    const result = await listEnrollmentDocuments({ page: 1, per_page: 20 })

    expect(result.data).toEqual([document])
    expect(fetchMock.mock.calls[0]?.[0]).toContain("page=1&per_page=20")
  })
})
