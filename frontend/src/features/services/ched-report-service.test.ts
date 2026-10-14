import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  chedReportFileName,
  downloadChedReport,
  getChedList,
  getChedSummary,
} from "@/features/services/ched-report-service"

const info = {
  key: "nstp-enrollment",
  title: "NSTP Form 2-B — Enrollment",
  term_label: "2nd Term, AY 2025-2026",
  school_year: "2025-2026",
  columns: [{ key: "no", label: "No." }],
  missing_gender: 0,
  demo_populated: 0,
}

const none = { m: 0, f: 0 }
const components = { rotc: none, cwts: { m: 2, f: 3 }, lts: none }

describe("ched-report-service", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it("reads a page of a list from the versioned endpoint", async () => {
    const payload = {
      data: [{ no: 1, surname: "Reyes" }],
      meta: { current_page: 2, last_page: 3, per_page: 25, total: 60 },
      report: info,
    }
    fetchMock.mockResolvedValue(new Response(JSON.stringify(payload)))

    const result = await getChedList("nstp-enrollment", 7, 2, 25)

    expect(result.data[0]).toEqual({ no: 1, surname: "Reyes" })
    expect(fetchMock.mock.calls[0][0]).toContain(
      "/api/v1/ched-reports/nstp-enrollment?academic_term_id=7&page=2&per_page=25",
    )
  })

  it("reads the summary grid", async () => {
    const payload = {
      data: {
        campus: "Global Reciprocal Colleges",
        classification: "Private",
        academic_year: "2025-2026",
        enrollment: {
          "1st": components,
          "2nd": components,
          summer: components,
        },
        graduates: components,
        missing_gender: 0,
      },
      report: { ...info, key: "nstp-summary", columns: [] },
    }
    fetchMock.mockResolvedValue(new Response(JSON.stringify(payload)))

    const result = await getChedSummary(7)

    expect(result.data.enrollment["2nd"].cwts).toEqual({ m: 2, f: 3 })
    expect(fetchMock.mock.calls[0][0]).toContain(
      "/api/v1/ched-reports/nstp-summary?academic_term_id=7",
    )
  })

  it("rejects a response that does not match the contract", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [], report: info })),
    )

    await expect(getChedList("nstp-enrollment", 7, 1, 25)).rejects.toThrow(
      /published v1 contract/,
    )
  })

  it("names the file like the server does", () => {
    const term = { school_year: "2025-2026", semester: "2nd" }

    expect(chedReportFileName("enrollment-list", term, "xlsx")).toBe(
      "CHED-Enrollment-List_2025-2026-2nd.xlsx",
    )
    expect(chedReportFileName("nstp-enrollment", term, "csv")).toBe(
      "NSTP-Form-2B-Enrollment_2025-2026-2nd.csv",
    )
    expect(chedReportFileName("nstp-graduates", term, "xlsx")).toBe(
      "NSTP-Form-2B-Graduates_2025-2026-2nd.xlsx",
    )
    expect(chedReportFileName("nstp-summary", term, "xlsx")).toBe(
      "NSTP-Form-2A-Summary_2025-2026.xlsx",
    )
  })

  it("downloads through an authenticated request and saves the file", async () => {
    const createObjectURL = vi.fn(() => "blob:ched")
    const revokeObjectURL = vi.fn()
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL, revokeObjectURL }),
    )
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined)
    fetchMock.mockResolvedValue(new Response("a,b\n1,2", { status: 200 }))

    await downloadChedReport({
      report: "nstp-graduates",
      academicTermId: 7,
      format: "csv",
      fileName: "NSTP-Form-2B-Graduates_2025-2026-2nd.csv",
    })

    expect(fetchMock.mock.calls[0][0]).toContain(
      "/api/v1/ched-reports/nstp-graduates/export?academic_term_id=7&format=csv",
    )
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:ched")
    click.mockRestore()
  })
})
