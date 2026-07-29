import {
  eligibleSubjectsEnvelopeSchema,
  enrollmentEnvelopeSchema,
  enrollmentsEnvelopeSchema,
  storeEnrollmentInputSchema,
  type EligibleSubject,
  type Enrollment,
  type StoreEnrollmentInput,
} from "@/features/schemas/enrollment-schema"
import {
  ApiClientError,
  getAuthenticatedJson,
  postAuthenticatedJson,
} from "@/features/services/api-client"

export const ELIGIBLE_SUBJECTS_PATH = "/api/v1/eligible-subjects"
export const ENROLLMENTS_PATH = "/api/v1/enrollments"

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

export async function getEligibleSubjects(
  academicTermId: number,
  signal?: AbortSignal,
): Promise<readonly EligibleSubject[]> {
  const payload = await getAuthenticatedJson(
    `${ELIGIBLE_SUBJECTS_PATH}?academic_term_id=${academicTermId}`,
    signal,
  )
  return parse(eligibleSubjectsEnvelopeSchema, payload, "eligible subject pool")
    .data
}

export async function getEnrollments(
  signal?: AbortSignal,
): Promise<readonly Enrollment[]> {
  const payload = await getAuthenticatedJson(ENROLLMENTS_PATH, signal)
  return parse(enrollmentsEnvelopeSchema, payload, "enrollment list").data
}

export async function createEnrollment(
  input: StoreEnrollmentInput,
): Promise<Enrollment> {
  const payload = await postAuthenticatedJson(
    ENROLLMENTS_PATH,
    parse(storeEnrollmentInputSchema, input, "enrollment request"),
  )
  return parse(enrollmentEnvelopeSchema, payload, "created enrollment").data
}
