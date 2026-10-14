import {
  chedListResponseSchema,
  chedSummaryResponseSchema,
  type ChedDownloadFormat,
  type ChedListResponse,
  type ChedReportKey,
  type ChedSummaryResponse,
} from "@/features/schemas/ched-report-schema"
import {
  ApiClientError,
  getAuthenticatedBlob,
  getAuthenticatedJson,
} from "@/features/services/api-client"

const BASE_PATH = "/api/v1/ched-reports"

function parse<T>(
  schema: {
    safeParse: (
      value: unknown,
    ) => { success: true; data: T } | { success: false; error: unknown }
  },
  payload: unknown,
  label: string,
): T {
  const result = schema.safeParse(payload)
  if (result.success) return result.data
  throw new ApiClientError({
    kind: "contract",
    message: `The API responded, but its ${label} did not match the published v1 contract.`,
    cause: result.error,
  })
}

/** One page of a CHED Enrollment List or an NSTP Form 2-B list for a term. */
export async function getChedList(
  report: Exclude<ChedReportKey, "nstp-summary">,
  academicTermId: number,
  page: number,
  perPage: number,
  signal?: AbortSignal,
): Promise<ChedListResponse> {
  return parse(
    chedListResponseSchema,
    await getAuthenticatedJson(
      `${BASE_PATH}/${report}?academic_term_id=${academicTermId}&page=${page}&per_page=${perPage}`,
      signal,
    ),
    "CHED report",
  )
}

/** NSTP Form 2-A for the school year of the term. */
export async function getChedSummary(
  academicTermId: number,
  signal?: AbortSignal,
): Promise<ChedSummaryResponse> {
  return parse(
    chedSummaryResponseSchema,
    await getAuthenticatedJson(
      `${BASE_PATH}/nstp-summary?academic_term_id=${academicTermId}`,
      signal,
    ),
    "NSTP summary",
  )
}

const FILE_STEMS: Record<ChedReportKey, string> = {
  "enrollment-list": "CHED-Enrollment-List",
  "nstp-enrollment": "NSTP-Form-2B-Enrollment",
  "nstp-graduates": "NSTP-Form-2B-Graduates",
  "nstp-summary": "NSTP-Form-2A-Summary",
}

/** The same file name the API's Content-Disposition carries. */
export function chedReportFileName(
  report: ChedReportKey,
  term: { school_year: string; semester: string },
  format: ChedDownloadFormat,
): string {
  const when =
    report === "nstp-summary"
      ? term.school_year
      : `${term.school_year}-${term.semester}`
  return `${FILE_STEMS[report]}_${when}.${format}`
}

/**
 * Downloads a report as CSV or as the CHED template filled in (Excel). The bearer token goes in the
 * request header, never in the URL, so the file is fetched as a blob and saved from memory.
 */
export async function downloadChedReport(
  input: {
    report: ChedReportKey
    academicTermId: number
    format: ChedDownloadFormat
    fileName: string
  },
  signal?: AbortSignal,
): Promise<void> {
  const blob = await getAuthenticatedBlob(
    `${BASE_PATH}/${input.report}/export?academic_term_id=${input.academicTermId}&format=${input.format}`,
    signal,
  )
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = input.fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(url)
}
