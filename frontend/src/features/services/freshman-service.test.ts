import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  confirmFreshmanPayment,
  getFreshmanPaymentPreview,
  listFreshmanEnrollees,
} from "@/features/services/freshman-service"

const preview = {
  type: "freshman_payment_preview",
  student_id: 12,
  student_number: "2026-10-00012",
  student_name: "Juan Dela Cruz",
  // The API now names the student's type and, for a transferee, the subjects they chose (ADR 0043, amended 2026-10-05).
  student_type: "freshman",
  enrollment: null,
  ticket_number: "Q003",
  minimum_amount: "1000.00",
  already_confirmed: false,
  can_enroll: true,
  block: {
    block_code: "IT101",
    total_units: 21,
    seats_remaining: 5,
    subjects: [{ code: "ITP1", title: "Programming 1", units: 3 }],
  },
  estimated_total: "9200.00",
} as const

const enrolledResult = {
  type: "freshman_payment",
  outcome: "enrolled",
  block_code: "IT101",
  student: { id: 12, student_number: "2026-10-00012", name: "Juan Dela Cruz" },
  enrollment: { id: 40, status: "enrolled", total_units: 21 },
  payment: {
    external_reference: "OR-9",
    amount: "1000.00",
    promissory_note_on_file: false,
    confirmed_at: "2026-10-04T01:00:00Z",
  },
  document: {
    id: 70,
    document_type: "cor",
    document_number: "COR000040",
    generated_at: "2026-10-04T01:00:00Z",
  },
  held_amount: null,
} as const

function urlOf(input: RequestInfo | URL | undefined): string {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : (input?.url ?? "")
}

describe("freshman-service", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it("reads what a freshman's first payment will do", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: preview })),
    )

    await expect(getFreshmanPaymentPreview(12)).resolves.toEqual(preview)

    const [url] = fetchMock.mock.calls[0] ?? []
    expect(urlOf(url)).toContain(
      "/api/v1/student-profiles/12/freshman-payment-preview",
    )
  })

  it("reads a preview when every section is full", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            ...preview,
            can_enroll: false,
            block: null,
            estimated_total: null,
          },
        }),
      ),
    )

    await expect(getFreshmanPaymentPreview(12)).resolves.toMatchObject({
      can_enroll: false,
      block: null,
    })
  })

  it("confirms the first payment with the amount and an optional reference", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: enrolledResult }), { status: 201 }),
    )

    const result = await confirmFreshmanPayment(12, {
      amount: "1000.00",
      external_reference: "OR-9",
    })

    expect(result.outcome).toBe("enrolled")
    expect(result.block_code).toBe("IT101")
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/api/v1/student-profiles/12/freshman-payment")
    expect(request.method).toBe("POST")
    expect(JSON.parse(request.body as string)).toEqual({
      amount: "1000.00",
      external_reference: "OR-9",
    })
  })

  it("reads a held payment (every section was full)", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            ...enrolledResult,
            outcome: "awaiting_section",
            block_code: null,
            enrollment: null,
            payment: null,
            document: null,
            held_amount: "1000.00",
          },
        }),
        { status: 201 },
      ),
    )

    await expect(
      confirmFreshmanPayment(12, { amount: "1000.00" }),
    ).resolves.toMatchObject({
      outcome: "awaiting_section",
      held_amount: "1000.00",
    })
  })

  it("does not call the API for an amount that is not a number", async () => {
    await expect(
      confirmFreshmanPayment(12, { amount: "a lot" }),
    ).rejects.toThrow()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("lists the freshmen with the chosen status and search", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              type: "freshman_enrollee",
              id: 12,
              student_number: "2026-10-00012",
              name: "Juan Dela Cruz",
              program_code: "BSIT",
              year_level: 1,
              status: "enrolled",
              status_label: "Enrolled",
              block_code: "IT101",
              amount_paid: "1000.00",
              ticket_number: "Q003",
              payment_confirmed_at: "2026-10-04T01:00:00Z",
            },
          ],
          links: {
            first: "http://localhost/api/v1/freshman-enrollees?page=1",
            last: "http://localhost/api/v1/freshman-enrollees?page=1",
            prev: null,
            next: null,
          },
          meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 },
        }),
      ),
    )

    const page = await listFreshmanEnrollees({
      status: "enrolled",
      search: "Juan",
    })

    expect(page.data[0]?.block_code).toBe("IT101")
    const [url] = fetchMock.mock.calls[0] ?? []
    expect(urlOf(url)).toContain("status=enrolled")
    expect(urlOf(url)).toContain("search=Juan")
  })
})
