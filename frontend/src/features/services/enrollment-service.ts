import {
  confirmPaymentInputSchema,
  eligibleSubjectsEnvelopeSchema,
  enrollmentEnvelopeSchema,
  enrollmentFiltersSchema,
  paginatedEnrollmentsSchema,
  paymentConfirmationEnvelopeSchema,
  storeEnrollmentInputSchema,
  updateEnrollmentInputSchema,
  type ConfirmPaymentInput,
  type EligibleSubject,
  type Enrollment,
  type EnrollmentFilters,
  type Paginated,
  type PaymentConfirmation,
  type StoreEnrollmentInput,
  type UpdateEnrollmentInput,
} from "@/features/schemas/enrollment-schema"
import {
  ApiClientError,
  getAuthenticatedJson,
  patchAuthenticatedJson,
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

/**
 * The authenticated student's own enrollments only — page 1 of the
 * role-scoped paginated endpoint, unwrapped to a flat list. A student
 * accumulates at most a handful of enrollments across their whole academic
 * life, so pagination controls add nothing here; `listEnrollments` below is
 * for the Registrar Head/Accounting Staff queues, which do need them.
 */
export async function getEnrollments(
  signal?: AbortSignal,
): Promise<readonly Enrollment[]> {
  const payload = await getAuthenticatedJson(ENROLLMENTS_PATH, signal)
  return parse(paginatedEnrollmentsSchema, payload, "enrollment list").data
}

export async function listEnrollments(
  filters: EnrollmentFilters,
  signal?: AbortSignal,
): Promise<Paginated<Enrollment>> {
  const parsed = parse(enrollmentFiltersSchema, filters, "enrollment filter")
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(parsed)) {
    if (value !== undefined) query.set(key, String(value))
  }
  return parse(
    paginatedEnrollmentsSchema,
    await getAuthenticatedJson(
      `${ENROLLMENTS_PATH}?${query.toString()}`,
      signal,
    ),
    "enrollment list",
  )
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

export async function updateEnrollment(
  id: number,
  input: UpdateEnrollmentInput,
): Promise<Enrollment> {
  const payload = await patchAuthenticatedJson(
    `${ENROLLMENTS_PATH}/${id}`,
    parse(updateEnrollmentInputSchema, input, "enrollment decision"),
  )
  return parse(enrollmentEnvelopeSchema, payload, "updated enrollment").data
}

export async function confirmPayment(
  id: number,
  input: ConfirmPaymentInput,
): Promise<PaymentConfirmation> {
  const payload = await postAuthenticatedJson(
    `${ENROLLMENTS_PATH}/${id}/payment`,
    parse(confirmPaymentInputSchema, input, "payment confirmation request"),
  )
  return parse(
    paymentConfirmationEnvelopeSchema,
    payload,
    "payment confirmation",
  ).data
}
