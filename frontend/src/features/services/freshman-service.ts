import {
  confirmFreshmanPaymentInputSchema,
  freshmanEnrolleeFiltersSchema,
  freshmanPaymentEnvelopeSchema,
  freshmanPaymentPreviewEnvelopeSchema,
  paginatedFreshmanEnrolleesSchema,
  type ConfirmFreshmanPaymentInput,
  type FreshmanEnrolleeFilters,
  type FreshmanPayment,
  type FreshmanPaymentPreview,
  type PaginatedFreshmanEnrollees,
} from "@/features/schemas/freshman-schema"
import {
  ApiClientError,
  getAuthenticatedJson,
  postAuthenticatedJson,
} from "@/features/services/api-client"

const STUDENT_PROFILES_PATH = "/api/v1/student-profiles"
export const FRESHMAN_ENROLLEES_PATH = "/api/v1/freshman-enrollees"

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

/** What confirming this freshman's first payment will do, without doing it. */
export async function getFreshmanPaymentPreview(
  studentId: number,
  signal?: AbortSignal,
): Promise<FreshmanPaymentPreview> {
  return parse(
    freshmanPaymentPreviewEnvelopeSchema,
    await getAuthenticatedJson(
      `${STUDENT_PROFILES_PATH}/${studentId}/freshman-payment-preview`,
      signal,
    ),
    "freshman payment preview",
  ).data
}

/**
 * The Cashier confirms a freshman's first payment (ADR 0043): the freshman is enrolled in the
 * first block with open seats, or the payment is held when every block is full. Safe to repeat.
 */
export async function confirmFreshmanPayment(
  studentId: number,
  input: ConfirmFreshmanPaymentInput,
): Promise<FreshmanPayment> {
  const body = parse(
    confirmFreshmanPaymentInputSchema,
    input,
    "freshman payment",
  )
  return parse(
    freshmanPaymentEnvelopeSchema,
    await postAuthenticatedJson(
      `${STUDENT_PROFILES_PATH}/${studentId}/freshman-payment`,
      body,
    ),
    "freshman payment confirmation",
  ).data
}

/** The Registrar's read-only list of freshmen who paid first, including those waiting for a section. */
export async function listFreshmanEnrollees(
  filters: FreshmanEnrolleeFilters,
  signal?: AbortSignal,
): Promise<PaginatedFreshmanEnrollees> {
  const parsed = parse(
    freshmanEnrolleeFiltersSchema,
    filters,
    "freshman enrollee filter",
  )
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(parsed)) {
    if (value !== undefined && value !== "") query.set(key, String(value))
  }
  return parse(
    paginatedFreshmanEnrolleesSchema,
    await getAuthenticatedJson(
      `${FRESHMAN_ENROLLEES_PATH}?${query.toString()}`,
      signal,
    ),
    "freshman enrollee list",
  )
}
