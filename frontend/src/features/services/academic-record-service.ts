import {
  gradeSlipEnvelopeSchema,
  prospectusEnvelopeSchema,
  type GradeSlip,
  type Prospectus,
} from "@/features/schemas/academic-record-schema"
import {
  ApiClientError,
  getAuthenticatedJson,
} from "@/features/services/api-client"

export const PROSPECTUS_PATH = "/api/v1/prospectus"
export const GRADE_SLIP_PATH = "/api/v1/grade-slip"

function parse<T>(
  schema: {
    safeParse: (
      value: unknown,
    ) => { success: true; data: T } | { success: false; error: unknown }
  },
  value: unknown,
  label: string,
): T {
  const result = schema.safeParse(value)
  if (result.success) return result.data
  throw new ApiClientError({
    kind: "contract",
    message: `The API responded, but its ${label} did not match the published v1 contract.`,
    cause: result.error,
  })
}

/**
 * `studentId` omitted means "my own" — the Registrar workspaces supply it
 * explicitly to view another student's; the student workspace never does.
 */
export async function getProspectus(
  studentId?: number,
  signal?: AbortSignal,
): Promise<Prospectus> {
  const query = studentId !== undefined ? `?student_id=${studentId}` : ""
  const payload = await getAuthenticatedJson(
    `${PROSPECTUS_PATH}${query}`,
    signal,
  )
  return parse(prospectusEnvelopeSchema, payload, "prospectus").data
}

export async function getGradeSlip(
  academicTermId: number,
  studentId?: number,
  signal?: AbortSignal,
): Promise<GradeSlip> {
  const query = new URLSearchParams({
    academic_term_id: String(academicTermId),
  })
  if (studentId !== undefined) query.set("student_id", String(studentId))

  const payload = await getAuthenticatedJson(
    `${GRADE_SLIP_PATH}?${query.toString()}`,
    signal,
  )
  return parse(gradeSlipEnvelopeSchema, payload, "grade slip").data
}
