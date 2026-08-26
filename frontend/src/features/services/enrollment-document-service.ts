import {
  enrollmentDocumentFiltersSchema,
  certificateOfRegistrationResponseSchema,
  paginatedEnrollmentDocumentsSchema,
  type EnrollmentDocument,
  type EnrollmentDocumentFilters,
  type Paginated,
} from "@/features/schemas/enrollment-document-schema"
import {
  ApiClientError,
  getAuthenticatedJson,
} from "@/features/services/api-client"

export const ENROLLMENT_DOCUMENTS_PATH = "/api/v1/enrollment-documents"

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

export async function listEnrollmentDocuments(
  filters: EnrollmentDocumentFilters,
  signal?: AbortSignal,
): Promise<Paginated<EnrollmentDocument>> {
  const parsed = parse(
    enrollmentDocumentFiltersSchema,
    filters,
    "enrollment document filter",
  )
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(parsed)) {
    if (value !== undefined) query.set(key, String(value))
  }
  return parse(
    paginatedEnrollmentDocumentsSchema,
    await getAuthenticatedJson(
      `${ENROLLMENT_DOCUMENTS_PATH}?${query.toString()}`,
      signal,
    ),
    "enrollment document list",
  )
}

export async function getCertificateOfRegistration(
  id: number,
  signal?: AbortSignal,
): Promise<import("@/features/schemas/enrollment-document-schema").CertificateOfRegistration> {
  return parse(
    certificateOfRegistrationResponseSchema,
    await getAuthenticatedJson(`${ENROLLMENT_DOCUMENTS_PATH}/${id}`, signal),
    "Certificate of Registration",
  ).data
}
